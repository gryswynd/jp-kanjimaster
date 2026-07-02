#!/usr/bin/env node
/**
 * validate-tokens.mjs — build gate for baked furigana tokens.
 *
 * Walks every token array in grammar files, stories, audiostories and the
 * glossaries, and fails the build when:
 *   1. a token array doesn't reconstruct to its source text (grammar parts
 *      had no such gate; stories are double-covered);
 *   2. a kanji-bearing token has no reading `r` AND no group `g` whose
 *      sibling tokens supply one (okurigana splits like 着(つ)+きます share g);
 *   3. any reading contains display-memo characters (/ ( ) ； spaces) —
 *      slash-joined on/kun lists must never reach furigana;
 *   4. a curated context blacklist hits — instance-dependent suffix readings
 *      that the SUFFIX_READINGS table in scripts/lib/tokenize.mjs must fix:
 *        digit+時=とき, duration+後=あと, 世界/一日+中=なか, bare 時+間 split.
 *
 * Run: node scripts/validate-tokens.mjs        (also wired into build:www)
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { reconstructFromTokens } from './lib/tokenize.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KANJI = /[一-鿿㐀-䶿]/;
const BAD_READING = /[/／()（）;；\s]/;
const NUMLIKE = /[0-9０-９一二三四五六七八九十百千何数]$/;

const problems = [];
function flag(file, where, msg) { problems.push(`${file} :: ${where} :: ${msg}`); }

function groupHasReading(tokens, i) {
  const g = tokens[i].g;
  if (!g) return false;
  return tokens.some(t => t && t.g === g && t.r);
}

function checkTokens(tokens, text, file, where) {
  if (!Array.isArray(tokens) || !tokens.length) return;
  // 1. reconstruction (only when we know the source text)
  if (typeof text === 'string' && text) {
    const rec = reconstructFromTokens(tokens);
    if (rec !== text) flag(file, where, `tokens drift: "${text}" → "${rec}"`);
  }
  let prevText = '';
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t || typeof t !== 'object') continue;
    const k = t.k || '';
    // 2. kanji token must carry a reading (directly or via its group)
    if (KANJI.test(k) && !t.r && !groupHasReading(tokens, i)) {
      flag(file, where, `kanji token without reading: 「${k}」 in "${text || reconstructFromTokens(tokens)}"`);
    }
    // 3. display-memo characters in readings
    if (t.r && BAD_READING.test(t.r)) {
      flag(file, where, `illegal reading "${t.r}" on 「${k}」`);
    }
    // 4. context blacklist
    if (k === '時' && t.r === 'とき' && NUMLIKE.test(prevText)) {
      flag(file, where, `時=とき after a number ("${prevText}時") — should be じ`);
    }
    if (k === '後' && t.r === 'あと' && /(時間|分|秒|週間|か月|ヶ月|年)$/.test(prevText)) {
      flag(file, where, `後=あと after a duration ("${prevText.slice(-3)}後") — should be ご`);
    }
    if (k === '中' && t.r === 'なか' && /(世界|一日|一晩|一年)$/.test(prevText)) {
      flag(file, where, `中=なか after ${prevText.slice(-2)} — should be じゅう`);
    }
    if (k === '間' && !t.r && prevText.endsWith('時')) {
      flag(file, where, `bare 時+間 split in "${text || ''}"`);
    }
    const nextK = (tokens[i + 1] && tokens[i + 1].k) || '';
    if (k === '何' && t.r === 'なん' && /^[をがもか]/.test(nextK)) {
      flag(file, where, `何=なん before ${nextK[0]} — should be なに`);
    }
    if (k === '開' && t.r === 'あ' && /^かれ/.test(nextK)) {
      flag(file, where, `開=あ in passive 開かれ — should be ひら`);
    }
    if (k === '方' && t.r === 'のほう') {
      flag(file, where, `方=のほう — reading must be ほう`);
    }
    prevText += k;
  }
}

// Walk any JSON: token arrays live next to a text-ish sibling field.
const TEXT_KEYS = ['text', 'jp', 'sentence', 'surface'];
function scan(node, file, where) {
  if (Array.isArray(node)) {
    node.forEach((x, i) => scan(x, file, `${where}[${i}]`));
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node.tokens) && node.tokens.every(t => t && typeof t === 'object' && 'k' in t)) {
    const text = TEXT_KEYS.map(k => node[k]).find(v => typeof v === 'string');
    checkTokens(node.tokens, text, file, where);
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === 'tokens') continue;
    scan(v, file, `${where}.${k}`);
  }
}

function walkDir(dir, out = []) {
  let names;
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walkDir(p, out);
    else if (name.endsWith('.json')) out.push(p);
  }
  return out;
}

const files = [];
for (const d of ['data/N5/grammar', 'data/N4/grammar', 'data/N3/grammar',
                 'data/N5/stories', 'data/N4/stories', 'data/N3/stories', 'data/custom/stories',
                 'data/N5/audiostories', 'data/N4/audiostories'])
  walkDir(path.join(ROOT, d), files);
for (const f of ['data/N5/glossary.N5.json', 'data/N4/glossary.N4.json', 'data/N3/glossary.N3.json',
                 'shared/particles.json', 'shared/characters.json', 'shared/loanwords.json'])
  files.push(path.join(ROOT, f));

let scanned = 0;
for (const f of files) {
  let json;
  try { json = JSON.parse(readFileSync(f, 'utf8')); } catch { continue; }
  scan(json, path.relative(ROOT, f), '$');
  scanned++;
}

if (problems.length) {
  console.error(`✗ validate-tokens: ${problems.length} problem(s) across ${scanned} files:\n`);
  for (const p of problems.slice(0, 80)) console.error('  ' + p);
  if (problems.length > 80) console.error(`  … and ${problems.length - 80} more`);
  process.exit(1);
}
console.log(`✓ validate-tokens: ${scanned} files, all baked readings sane.`);

#!/usr/bin/env node
// gen-drill-explanations.mjs
// ---------------------------------------------------------------------------
// Authors English `explanation` text for lesson drill MCQ items that lack one,
// so a wrong answer always shows feedback (not just the bare correct answer).
//
// The renderer (Lesson.js renderDrills) reads `item.explain || item.explanation`
// and otherwise falls back to "Answer: <correct>". Every `kind:"mcq"` item here
// gets a derived `explanation` keyed off the question shape + the glossaries.
//
// Explanations are DISPLAY-ONLY English (never sent to TTS) — no audio regen
// needed. They reuse Japanese surfaces/readings already present in the lesson
// content, so they introduce no new glyphs beyond the font subset.
//
// Idempotent: items that already carry `explanation`/`explain` are left alone.
// Items the generator can't classify confidently are reported (not written) so
// they can be authored by hand.
//
//   node scripts/gen-drill-explanations.mjs            # write in place
//   node scripts/gen-drill-explanations.mjs --dry      # report only, no writes
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');

// ── Build a surface → { reading, meaning } lookup from every glossary,
//    plus particles and characters. First writer wins (level order N5→N4→N3).
const lookup = new Map();
function add(surface, reading, meaning) {
  if (!surface) return;
  if (!lookup.has(surface)) lookup.set(surface, { reading: reading || '', meaning: meaning || '' });
}
function loadGlossaries() {
  for (const lvl of ['N5', 'N4', 'N3']) {
    const gp = path.join(ROOT, 'data', lvl, `glossary.${lvl}.json`);
    if (!fs.existsSync(gp)) continue;
    for (const e of JSON.parse(fs.readFileSync(gp, 'utf8')).entries || [])
      add(e.surface, e.reading, e.meaning);
  }
  for (const rel of ['shared/particles.json', 'shared/characters.json']) {
    const fp = path.join(ROOT, rel);
    if (!fs.existsSync(fp)) continue;
    const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const arr = Array.isArray(j) ? j : (j.entries || j.particles || j.characters || []);
    for (const e of arr) {
      if (!e || typeof e !== 'object') continue;
      add(e.surface || e.particle || e.k, e.reading || e.r, e.meaning || e.gloss || e.en);
    }
  }
}

// ── Question-shape patterns ────────────────────────────────────────────────
const OPEN = '[\\[「『【]', CLOSE = '[\\]」』】]';      // bracket pairs: [] 「」 『』 【】
// Reading/meaning stems must sit at the END of the question (after an optional
// は/って and ？) so a sentence that merely contains 意味/よみ mid-clause (a
// fill-blank) is not mistaken for a vocab question.
const TAIL = '\\s*(?:は|って)?\\s*[？?]?\\s*$';
const RE_READING = new RegExp(`^(.+?)\\s*の\\s*よみかた${TAIL}`);      // [帰る]/帰る の よみかたは？
const RE_MEANING = new RegExp(`^(.+?)\\s*の\\s*(?:いみ|意味)${TAIL}`); // 「待ち合わせ」の いみは？
const RE_VOCAB   = new RegExp(`^\\s*(\\S+?)\\s*${OPEN}([^\\]」』】]+)${CLOSE}\\s*$`); // 帰る [かえる]
const RE_VOCAB_P = /^\s*(\S+?)\s*（([^）]+)）\s*$/;                  // 工員（こういん）
const RE_QUOTED  = new RegExp(`${OPEN}([^\\]」』】]+)${CLOSE}`);       // first bracketed JP span
const RE_BLANK   = /_{2,}|＿+|〇|（\s*）|\(\s*\)/;                     // fill-in-the-blank slot
const hasLatin = (s) => /[A-Za-z]/.test(s);
const hasJP = (s) => /[぀-ヿ㐀-鿿]/.test(s);
const stripBrackets = (s) => s.replace(new RegExp(`^${OPEN}`), '').replace(new RegExp(`${CLOSE}$`), '').trim();

// Returns an explanation string, or null if the item can't be classified.
function deriveExplanation(item) {
  const q = (item.q || '').trim();
  const a = (item.answer || '').trim();
  if (!q || !a) return null;

  let m;
  // 1. Fill-in-the-blank FIRST (a sentence may itself contain 意味/よみ):
  //    show the completed sentence + gloss the answer word.
  if (RE_BLANK.test(q)) {
    const completed = q.replace(RE_BLANK, a);
    const g = lookup.get(a);
    const gloss = g && g.meaning ? ` — 「${a}」${g.reading ? ` (${g.reading})` : ''} means "${g.meaning}".` : '';
    return `Correct: ${completed}${gloss}`;
  }
  // 2. Reading drill: "[帰る] の よみかたは？" / "待ち合わせ の よみかたは？" → answer is the reading.
  if ((m = q.match(RE_READING))) {
    const surface = stripBrackets(m[1]);
    const meaning = lookup.get(surface)?.meaning;
    return `「${surface}」 is read 「${a}」${meaning ? ` — ${meaning}` : ''}.`;
  }
  // 3. Meaning drill: "「待ち合わせ」の いみは？" → answer is the English meaning.
  if ((m = q.match(RE_MEANING))) {
    return `「${stripBrackets(m[1])}」 means "${a}".`;
  }
  // 4. Vocab card with shown reading: "帰る [かえる]" / "工員（こういん）" + English answer.
  if (((m = q.match(RE_VOCAB)) || (m = q.match(RE_VOCAB_P))) && hasLatin(a)) {
    return `「${m[1]}」 (${m[2]}) means "${a}".`;
  }
  // 5. Conjugation transform: "Today was good. （いい → past）" → show target + answer.
  if ((m = q.match(/（([^）]*[→\-➝>][^）]*)）/))) {
    const english = q.replace(/（[^）]*）/, '').trim();
    return `${english}${english ? ' → ' : ''}「${a}」 (${m[1].trim()}).`;
  }
  // 6. Bare vocab card: q is a Japanese word (no slot), answer is English → gloss with glossary reading.
  if (hasJP(q) && !hasLatin(q) && hasLatin(a)) {
    const r = lookup.get(q)?.reading;
    return `「${q}」${r ? ` (${r})` : ''} means "${a}".`;
  }
  // 7. English-framed meaning: "What does 「…」mean?" → gloss the quoted span.
  if (hasLatin(q) && (m = q.match(RE_QUOTED)) && hasLatin(a)) {
    return `「${m[1]}」 means "${a}".`;
  }
  // 8. Fallback: answer is a known Japanese word → gloss it.
  if (!hasLatin(a)) {
    const g = lookup.get(a);
    if (g && g.meaning) return `「${a}」${g.reading ? ` (${g.reading})` : ''} means "${g.meaning}".`;
  }
  return null;
}

// ── Walk lesson files ──────────────────────────────────────────────────────
function lessonFiles() {
  const out = [];
  for (const lvl of ['N5', 'N4', 'N3']) {
    const dir = path.join(ROOT, 'data', lvl, 'lessons');
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) out.push(path.join(dir, f));
  }
  return out.sort();
}

loadGlossaries();
let total = 0, written = 0, skipped = 0;
const flagged = [];

for (const fp of lessonFiles()) {
  const json = JSON.parse(fs.readFileSync(fp, 'utf8'));
  let changed = false;
  const visit = (o) => {
    if (Array.isArray(o)) { o.forEach(visit); return; }
    if (!o || typeof o !== 'object') return;
    if (o.kind === 'mcq') {
      total++;
      const already = (o.explanation && o.explanation.trim()) || (o.explain && o.explain.trim());
      if (already) { skipped++; }
      else {
        const exp = deriveExplanation(o);
        if (exp) { o.explanation = exp; written++; changed = true; }
        else flagged.push({ file: path.relative(ROOT, fp), q: o.q, answer: o.answer });
      }
    }
    for (const v of Object.values(o)) visit(v);
  };
  visit(json);
  if (changed && !DRY) fs.writeFileSync(fp, JSON.stringify(json, null, 2) + '\n');
}

console.log(`\n[gen-drill-explanations] mcq items: ${total}`);
console.log(`  already had explanation : ${skipped}`);
console.log(`  ${DRY ? 'would write' : 'wrote'} new explanation : ${written}`);
console.log(`  flagged (unclassified)  : ${flagged.length}`);
if (flagged.length) {
  const rep = path.join(ROOT, 'scripts', 'drill-explanations-flagged.json');
  if (!DRY) fs.writeFileSync(rep, JSON.stringify(flagged, null, 2) + '\n');
  console.log(`\n  Flagged items${DRY ? '' : ` written to ${path.relative(ROOT, rep)}`}:`);
  for (const f of flagged.slice(0, 40)) console.log(`    [${f.file}] q=${JSON.stringify(f.q)} answer=${JSON.stringify(f.answer)}`);
  if (flagged.length > 40) console.log(`    … and ${flagged.length - 40} more`);
}

#!/usr/bin/env node
/**
 * scripts/tokenize-story-paragraph.mjs
 *
 * THE ONLY sanctioned way to append content to a story. Hand-authoring
 * tokens is forbidden — let the shared tokenizer build them so they pass
 * validator + use the same glossary index as every other story.
 *
 * Usage:
 *   node scripts/tokenize-story-paragraph.mjs <slug> "<japanese text>" --en "<english>"
 *   node scripts/tokenize-story-paragraph.mjs <slug> "<jp>" --en "<en>" --insert=3
 *   node scripts/tokenize-story-paragraph.mjs <slug> "<jp>" --en "<en>" --replace=3
 *
 * Looks up the story.json across data/N5/N4/N3/custom/stories/<slug>/.
 * Tokenizes the JP via lib/tokenize.mjs against the same glossary + characters
 * + particles index used by migration. Appends (or inserts) {jp, en, tokens}
 * into paragraphs[].
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { buildGlossaryIndex, tokenizeText, reconstructFromTokens } from './lib/tokenize.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const positional = args.filter(a => !a.startsWith('--'));
const slug = positional[0];
const jp = positional[1];
const flags = Object.fromEntries(
  args.filter(a => a.startsWith('--')).map(a => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=') || true];
  })
);
const en = flags.en || flags.english || '';
const insertAt = flags.insert != null ? parseInt(flags.insert, 10) : null;
const replaceAt = flags.replace != null ? parseInt(flags.replace, 10) : null;
// --kind=audiostory targets data/<lvl>/audiostories/<slug>/audiostory.json
// (the Audio Dojo listening passages); default is the reading Stories.
const kind = flags.kind === 'audiostory' ? 'audiostory' : 'story';
const subdir = kind === 'audiostory' ? 'audiostories' : 'stories';
const fileName = kind === 'audiostory' ? 'audiostory.json' : 'story.json';

if (!slug || !jp) {
  console.error('Usage: node scripts/tokenize-story-paragraph.mjs <slug> "<japanese>" --en "<english>" [--insert=N | --replace=N] [--kind=audiostory]');
  process.exit(1);
}

// ── Locate the target JSON ─────────────────────────────────────────────────
let storyPath = null;
for (const lvl of ['N5', 'N4', 'N3', 'custom']) {
  const p = path.join(ROOT, 'data', lvl, subdir, slug, fileName);
  if (existsSync(p)) { storyPath = p; break; }
}
if (!storyPath) {
  console.error(`[error] ${fileName} not found for slug "${slug}". Run the scaffolder first.`);
  process.exit(1);
}

const story = JSON.parse(await readFile(storyPath, 'utf8'));
if (!Array.isArray(story.paragraphs)) story.paragraphs = [];

// ── Tokenize via the shared library ────────────────────────────────────────
// Load conjugation rules so conjugated verb forms (思って, 出て, …) resolve to
// their glossary readings/groups — must match migrate-stories-to-json.mjs, or
// te/ta/potential forms tokenize as reading-less bare kanji.
const conjugationRules = JSON.parse(await readFile(path.join(ROOT, 'conjugation_rules.json'), 'utf8'));
const glossaryIndex = await buildGlossaryIndex(
  [
    path.join(ROOT, 'data/N5/glossary.N5.json'),
    path.join(ROOT, 'data/N4/glossary.N4.json'),
    path.join(ROOT, 'data/N3/glossary.N3.json'),
    path.join(ROOT, 'shared/particles.json'),
    path.join(ROOT, 'shared/characters.json')
  ],
  readFile,
  { includeReadings: true, conjugationRules }
);

const tokens = tokenizeText(jp, glossaryIndex);
const reconstructed = reconstructFromTokens(tokens);
if (reconstructed !== jp) {
  console.error(`[error] token reconstruction mismatch:`);
  console.error(`        got: ${reconstructed}`);
  console.error(`        expected: ${jp}`);
  process.exit(1);
}

const para = { jp, en, tokens };

if (replaceAt != null) {
  if (replaceAt < 0 || replaceAt >= story.paragraphs.length) {
    console.error(`[error] --replace=${replaceAt} out of range (0..${story.paragraphs.length - 1})`);
    process.exit(1);
  }
  story.paragraphs[replaceAt] = para;
  console.log(`✓ Replaced paragraph at index ${replaceAt}`);
} else if (insertAt != null && insertAt >= 0 && insertAt <= story.paragraphs.length) {
  story.paragraphs.splice(insertAt, 0, para);
  console.log(`✓ Inserted paragraph at index ${insertAt}`);
} else {
  story.paragraphs.push(para);
  console.log(`✓ Appended paragraph at index ${story.paragraphs.length - 1}`);
}

await writeFile(storyPath, JSON.stringify(story, null, 2) + '\n', 'utf8');
console.log(`✓ Wrote ${path.relative(ROOT, storyPath)}`);
console.log(`\nTokens (${tokens.length}):`);
for (const t of tokens) {
  const r = t.r ? ` r=${t.r}` : '';
  const g = t.g ? ` g=${t.g}` : '';
  console.log(`  ${t.k}${r}${g}`);
}
console.log(`\nValidate: node scripts/validate-stories.mjs --only=${slug}`);

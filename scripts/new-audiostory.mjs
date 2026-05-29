#!/usr/bin/env node
/**
 * scripts/new-audiostory.mjs
 *
 * THE ONLY sanctioned way to create a new Audio Dojo listening passage.
 * Parallels new-story.mjs. Scaffolds the directory + skeleton audiostory.json
 * and registers it in data/audiostories.index.json (the list AudioDojo.js reads).
 *
 * Usage:
 *   node scripts/new-audiostory.mjs <slug> --level=N5|N4|N3|custom [--title="…"] [--english="…"] [--order=10]
 *
 * After scaffolding:
 *   node scripts/tokenize-story-paragraph.mjs <slug> "<jp>" --en "<en>" --kind=audiostory
 *   (then hand-author comprehension.questions[] — each {q, options, correct, explanation};
 *    `q` is the SPOKEN question, shown only as audio. Bake audio via npm run gen:audio.)
 */
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SCHEMA_VERSION = '1.0.0';

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--'));
const flags = Object.fromEntries(
  args.filter((a) => a.startsWith('--')).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=') || true];
  })
);
const level = flags.level;
const title = flags.title || '';
const englishTitle = flags.english || flags['english-title'] || '';
const order = flags.order != null ? Number(flags.order) : null;

if (!slug || !level || !['N5', 'N4', 'N3', 'custom'].includes(level)) {
  console.error('Usage: node scripts/new-audiostory.mjs <slug> --level=N5|N4|N3|custom [--title=…] [--english=…] [--order=N]');
  process.exit(1);
}

const dir = path.join('data', level, 'audiostories', slug);
const dirAbs = path.join(ROOT, dir);
const jsonPath = path.join(dirAbs, 'audiostory.json');

if (existsSync(jsonPath)) {
  console.error(`[error] audiostory.json already exists at ${jsonPath} — refusing to overwrite.`);
  process.exit(1);
}

await mkdir(dirAbs, { recursive: true });

const skeleton = {
  schemaVersion: SCHEMA_VERSION,
  id: slug,
  title: title || `(set title in ${dir}/audiostory.json)`,
  englishTitle: englishTitle || '(set English title)',
  level,
  unlocksAfter: null,
  difficulty: 1,
  // Filled by scripts/generate-audio.mjs (concatenated passage + breakpoints + peaks).
  audio: { file: 'passage.m4a', dur: 0, breakpoints: [], peaks: [] },
  paragraphs: [],          // append via tokenize-story-paragraph.mjs --kind=audiostory
  comprehension: {
    questions: []          // each: { q, options:[…], correct, explanation } — q is spoken
  }
};

await writeFile(jsonPath, JSON.stringify(skeleton, null, 2) + '\n', 'utf8');
console.log(`✓ Created ${path.relative(ROOT, jsonPath)}`);

// ── Register in the audiostories index ──────────────────────────────────────
const indexPath = path.join(ROOT, 'data', 'audiostories.index.json');
let index = { schemaVersion: SCHEMA_VERSION, audiostories: [] };
if (existsSync(indexPath)) index = JSON.parse(await readFile(indexPath, 'utf8'));
if (!Array.isArray(index.audiostories)) index.audiostories = [];

if (index.audiostories.some((s) => s.id === slug)) {
  console.log(`✓ Index already has ${slug}`);
} else {
  index.audiostories.push({
    id: slug,
    level,
    title: title || '(Japanese title)',
    englishTitle: englishTitle || '(English title)',
    dir,
    file: 'audiostory.json',
    order: order != null ? order : index.audiostories.length * 10
  });
  index.audiostories.sort((a, b) => (a.order || 0) - (b.order || 0));
  await writeFile(indexPath, JSON.stringify(index, null, 2) + '\n', 'utf8');
  console.log(`✓ Registered in data/audiostories.index.json`);
}

console.log('\nNext steps:');
console.log(`  1. Append paragraphs (short — this is a listening passage).`);
console.log(`     WRITE IN KANJI + furigana, never bare kana — Chirp reads kanji with`);
console.log(`     correct pitch/length; bare kana (e.g. こうえん) sounds off. Furigana`);
console.log(`     (auto from the tokenizer) serves learners. Use --en="..." WITH the`);
console.log(`     equals sign (--en "..." with a space does NOT parse):`);
console.log(`     node scripts/tokenize-story-paragraph.mjs ${slug} "朝、6時に起きます。" --en="I wake up at six." --kind=audiostory`);
console.log(`  2. Hand-author comprehension.questions[] (q is spoken — kanji too; options are written).`);
console.log(`  3. Bake audio: GOOGLE_TTS_API_KEY=... npm run gen:audio`);

#!/usr/bin/env node
/**
 * scripts/new-story.mjs
 *
 * THE ONLY sanctioned way to create a new story. Hand-creating story.json
 * from scratch is forbidden — this scaffolder ensures every required field
 * is present and the manifest stub points to the new file.
 *
 * Usage:
 *   node scripts/new-story.mjs <slug> --level=N5|N4|custom [--title="…"] [--english="…"]
 *
 * After scaffolding, append paragraphs with:
 *   node scripts/tokenize-story-paragraph.mjs <slug> "<japanese>" --en "<english>"
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SCHEMA_VERSION = '2.0.0';

// ── Parse args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const slug = args.find(a => !a.startsWith('--'));
const flags = Object.fromEntries(
  args.filter(a => a.startsWith('--')).map(a => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=') || true];
  })
);
const level = flags.level;
const title = flags.title || '';
const englishTitle = flags.english || flags['english-title'] || '';

if (!slug || !level || !['N5', 'N4', 'N3', 'custom'].includes(level)) {
  console.error('Usage: node scripts/new-story.mjs <slug> --level=N5|N4|N3|custom [--title=…] [--english=…]');
  console.error('Example: node scripts/new-story.mjs my-trip --level=N5 --title="りょこう" --english="My Trip"');
  process.exit(1);
}

// ── Create dir + skeleton ──────────────────────────────────────────────────
const category = level === 'custom' ? 'custom' : 'curriculum';
const dir = path.join('data', level, 'stories', slug);
const dirAbs = path.join(ROOT, dir);
const jsonPath = path.join(dirAbs, 'story.json');

if (existsSync(jsonPath)) {
  console.error(`[error] story.json already exists at ${jsonPath}`);
  console.error('Refusing to overwrite. Delete the file first if you intended to start over.');
  process.exit(1);
}

await mkdir(dirAbs, { recursive: true });

const skeleton = {
  schemaVersion: SCHEMA_VERSION,
  id: slug,
  title: title || `(set title in ${dir}/story.json)`,
  englishTitle: englishTitle || '(set English title)',
  category,
  level: category === 'custom' ? null : level,
  unlocksAfter: null,   // set this once you know which lesson the story follows
  paragraphs: [],       // append via scripts/tokenize-story-paragraph.mjs
  vocabUsed: [],        // optional: glossary ids referenced by the story
  grammarUsed: [],
  comprehension: {
    intro: 'Did you follow the story?',
    questions: []       // 3–5 MCQ blocks added by the author
  }
};

await writeFile(jsonPath, JSON.stringify(skeleton, null, 2) + '\n', 'utf8');
console.log(`✓ Created ${path.relative(ROOT, jsonPath)}`);

// ── Add manifest stub ──────────────────────────────────────────────────────
const manifestPath = path.join(ROOT, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (!manifest.data) manifest.data = {};
if (!manifest.data[level]) manifest.data[level] = {};
if (!manifest.data[level].stories) manifest.data[level].stories = [];

const existing = manifest.data[level].stories.find(s => s.id === slug);
if (existing) {
  console.log(`✓ Manifest already has stub for ${slug}`);
} else {
  manifest.data[level].stories.push({
    id: slug,
    title: englishTitle || '(English title)',
    titleJp: title || '(Japanese title)',
    dir,
    file: 'story.json',
    unlocksAfter: null
  });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`✓ Added manifest stub: data.${level}.stories[].${slug}`);
}

console.log('\nNext steps:');
console.log(`  1. Open ${path.relative(ROOT, jsonPath)} — fill in title, englishTitle, unlocksAfter.`);
console.log(`  2. Append paragraphs:`);
console.log(`     node scripts/tokenize-story-paragraph.mjs ${slug} "今日は天気がいいです。" --en "Today the weather is nice."`);
console.log(`  3. Authour 3–5 comprehension questions in the JSON directly.`);
console.log(`  4. Validate: node scripts/validate-stories.mjs --only=${slug}`);

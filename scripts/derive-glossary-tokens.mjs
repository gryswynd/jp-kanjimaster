#!/usr/bin/env node
/**
 * scripts/derive-glossary-tokens.mjs
 * One-shot derivation of `tokens` arrays for glossary + particle entries.
 *
 * For every entry that has both a surface (or `particle`) AND a `reading`,
 * compute a tokens[] array that the jp-text renderer can consume directly.
 *
 * Smart tokenization: when the surface contains both kana and kanji (e.g.
 * お父さん / おとうさん), match the kana prefix/suffix to split the kanji-only
 * middle off so furigana lands ONLY on the kanji portion:
 *
 *   surface "お父さん", reading "おとうさん"
 *     → tokens: [{k:"お"}, {k:"父", r:"とう"}, {k:"さん"}]
 *
 * Kanji-only words tokenize as a single span:
 *   surface "学生", reading "がくせい"
 *     → tokens: [{k:"学生", r:"がくせい"}]
 *
 * Kana-only entries where surface == reading are skipped (no tokens needed —
 * the renderer falls back to the bare string).
 *
 * Run:
 *   node scripts/derive-glossary-tokens.mjs
 *
 * Operates on the in-place files (root data). Build pipeline will copy them
 * to www/ + ios/App/App/public/ on the next `npm run build:www`.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { deriveTokens } from './lib/tokenize.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── File processors ────────────────────────────────────────────────────────

async function processGlossary(file) {
  const fullPath = path.join(ROOT, file);
  const raw = await readFile(fullPath, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data.entries)) {
    console.warn(`[skip] ${file}: no entries[]`);
    return { file, written: false };
  }
  let added = 0;
  let unchanged = 0;
  for (const entry of data.entries) {
    if (entry.tokens) { unchanged++; continue; }  // preserve manual edits
    const tokens = deriveTokens(entry.surface, entry.reading);
    if (tokens) {
      entry.tokens = tokens;
      added++;
    } else {
      unchanged++;
    }
  }
  if (added > 0) {
    // Keep 2-space indent + trailing newline to match existing files.
    await writeFile(fullPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
  console.log(`[${file}] added tokens to ${added} entries, ${unchanged} unchanged`);
  return { file, added, unchanged, written: added > 0 };
}

async function processParticles(file) {
  const fullPath = path.join(ROOT, file);
  const raw = await readFile(fullPath, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data.particles)) {
    console.warn(`[skip] ${file}: no particles[]`);
    return { file, written: false };
  }
  let added = 0;
  let unchanged = 0;
  for (const entry of data.particles) {
    if (entry.tokens) { unchanged++; continue; }
    // Particles use `particle` as the surface field.
    const tokens = deriveTokens(entry.particle, entry.reading);
    if (tokens) {
      entry.tokens = tokens;
      added++;
    } else {
      unchanged++;
    }
  }
  if (added > 0) {
    await writeFile(fullPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
  console.log(`[${file}] added tokens to ${added} particles, ${unchanged} unchanged`);
  return { file, added, unchanged, written: added > 0 };
}

// ── Main ────────────────────────────────────────────────────────────────────

const TARGETS = [
  { type: 'glossary',  file: 'data/N5/glossary.N5.json' },
  { type: 'glossary',  file: 'data/N4/glossary.N4.json' },
  { type: 'glossary',  file: 'data/N3/glossary.N3.json' },
  { type: 'particles', file: 'shared/particles.json' }
];

const results = [];
for (const t of TARGETS) {
  try {
    const r = t.type === 'particles'
      ? await processParticles(t.file)
      : await processGlossary(t.file);
    results.push(r);
  } catch (err) {
    console.error(`[error] ${t.file}:`, err.message);
    results.push({ file: t.file, error: err.message });
  }
}

const totalAdded = results.reduce((s, r) => s + (r.added || 0), 0);
console.log(`\nDone. ${totalAdded} entries newly tokenized across ${results.filter(r => r.written).length} file(s).`);

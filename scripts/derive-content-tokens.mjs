#!/usr/bin/env node
/**
 * scripts/derive-content-tokens.mjs
 * Bakes `tokens` onto every grammar example `parts[].text` so the grammar
 * "new rules" and "compare" views render furigana + romaji through the shared
 * jpText renderer (Grammar.js renderParts() already passes {text, tokens}).
 *
 * Uses the SAME deterministic glossary-greedy tokenizer as the story pipeline
 * (scripts/lib/tokenize.mjs) — NOT exact whole-surface matching — so sentence
 * fragments like 本を / 持って / 寒く tokenize correctly. Conjugated forms are
 * matched via the pre-generated inflection index.
 *
 * Targets every parts[] array (examples[].parts and items[].example.parts) in:
 *   - data/N5/grammar/*.json
 *   - data/N4/grammar/*.json
 *   - data/N3/grammar/*.json
 *
 * NEVER hand-edit grammar tokens — re-run this script.
 *
 * Run:
 *   node scripts/derive-content-tokens.mjs
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { tokenizeText, buildGlossaryIndex, reconstructFromTokens } from './lib/tokenize.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Build the canonical glossary index (vocab + particles + characters +
// pre-generated inflections), identical to the story migration setup.
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
console.log(`Indexed ${glossaryIndex.size} surfaces (incl. readings + characters + inflections).`);

const stats = { parts: 0, withReading: 0, mismatches: [] };

// Walk a tree; tokenize the .text of every member of any `parts` array.
function deriveOnParts(node, file) {
  if (Array.isArray(node)) {
    for (const child of node) deriveOnParts(child, file);
    return;
  }
  if (node && typeof node === 'object') {
    if (Array.isArray(node.parts)) {
      for (const part of node.parts) {
        if (part && typeof part === 'object' && typeof part.text === 'string' && part.text) {
          const tokens = tokenizeText(part.text, glossaryIndex);
          const reconstructed = reconstructFromTokens(tokens);
          if (reconstructed !== part.text) {
            // Don't write tokens that don't reconstruct — leave the part bare
            // rather than render drifted text.
            stats.mismatches.push(`${file}: "${part.text}" → "${reconstructed}"`);
            delete part.tokens;
          } else {
            part.tokens = tokens;
            stats.parts++;
            if (tokens.some(t => t && t.r)) stats.withReading++;
          }
        }
      }
    }
    for (const key in node) deriveOnParts(node[key], file);
  }
}

const GRAMMAR_DIRS = ['data/N5/grammar', 'data/N4/grammar', 'data/N3/grammar'];
let filesWritten = 0;
for (const dir of GRAMMAR_DIRS) {
  let files;
  try {
    files = (await readdir(path.join(ROOT, dir))).filter(f => f.endsWith('.json'));
  } catch {
    continue; // level dir may not exist
  }
  for (const f of files) {
    const full = path.join(ROOT, dir, f);
    const data = JSON.parse(await readFile(full, 'utf8'));
    deriveOnParts(data, `${dir}/${f}`);
    await writeFile(full, JSON.stringify(data, null, 2) + '\n', 'utf8');
    filesWritten++;
  }
}

console.log(`Tokenized ${stats.parts} parts (${stats.withReading} carry a reading) across ${filesWritten} grammar files.`);
if (stats.mismatches.length) {
  console.log(`\n⚠ ${stats.mismatches.length} parts left bare (token reconstruction mismatch):`);
  for (const m of stats.mismatches) console.log('  ' + m);
}

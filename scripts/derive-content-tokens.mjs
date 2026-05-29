#!/usr/bin/env node
/**
 * scripts/derive-content-tokens.mjs
 * Demo-data pass: walks specific content files and adds `tokens` to fields
 * that match a glossary entry exactly (by surface). Conjugated / inflected
 * forms are skipped because the base tokens don't fit.
 *
 * Currently targets:
 *   - data/N5/grammar/G1.json  →  every parts[].text
 *
 * Run:
 *   node scripts/derive-content-tokens.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Build a single surface→entry lookup across all glossaries + particles.
async function buildIndex() {
  const idx = new Map();
  const sources = [
    'data/N5/glossary.N5.json',
    'data/N4/glossary.N4.json',
    'data/N3/glossary.N3.json'
  ];
  for (const s of sources) {
    const data = JSON.parse(await readFile(path.join(ROOT, s), 'utf8'));
    for (const e of (data.entries || [])) {
      if (e.surface && !idx.has(e.surface)) idx.set(e.surface, e);
    }
  }
  const particles = JSON.parse(await readFile(path.join(ROOT, 'shared/particles.json'), 'utf8'));
  for (const p of (particles.particles || [])) {
    if (p.particle && !idx.has(p.particle)) idx.set(p.particle, p);
  }
  return idx;
}

// Walk a tree and add tokens to every `parts[].text` field via glossary lookup.
function deriveOnParts(node, idx) {
  let added = 0;
  if (Array.isArray(node)) {
    for (const child of node) added += deriveOnParts(child, idx);
    return added;
  }
  if (node && typeof node === 'object') {
    if (Array.isArray(node.parts)) {
      for (const part of node.parts) {
        if (part && typeof part === 'object' && typeof part.text === 'string' && !part.tokens) {
          const entry = idx.get(part.text);
          if (entry && entry.tokens) {
            part.tokens = entry.tokens;
            added++;
          }
        }
      }
    }
    for (const key in node) added += deriveOnParts(node[key], idx);
  }
  return added;
}

const idx = await buildIndex();
console.log(`Indexed ${idx.size} surfaces.`);

const targets = ['data/N5/grammar/G1.json'];
for (const file of targets) {
  const full = path.join(ROOT, file);
  const data = JSON.parse(await readFile(full, 'utf8'));
  const added = deriveOnParts(data, idx);
  if (added > 0) {
    await writeFile(full, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`[${file}] added tokens to ${added} parts`);
  } else {
    console.log(`[${file}] nothing to add`);
  }
}

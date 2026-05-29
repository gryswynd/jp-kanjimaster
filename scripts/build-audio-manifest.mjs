#!/usr/bin/env node
// Builds the audio work-list: the complete deduped set of normalized keys to
// synthesize. Writes data/audio/keys.audio.json. NO network — safe to run any
// time. generate-audio.mjs consumes this; validate-audio.mjs re-derives it.
//
// Run: node scripts/build-audio-manifest.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { argv } from 'node:process';
import { pathToFileURL } from 'node:url';
import { collectKeys } from './lib/audio-collect.mjs';

const ROOT = new URL('..', import.meta.url).pathname;

export function keyHash(key) {
  return createHash('sha1').update(key, 'utf8').digest('hex');
}

function main() {
  const keys = collectKeys(ROOT);
  const items = [...keys.entries()]
    .map(([key, rec]) => ({ key, hash: keyHash(key), text: rec.text || key, sources: [...rec.sources].sort() }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const outDir = join(ROOT, 'data', 'audio');
  mkdirSync(outDir, { recursive: true });
  const out = { schemaVersion: '1.0.0', count: items.length, items };
  writeFileSync(join(outDir, 'keys.audio.json'), JSON.stringify(out, null, 2));

  // Rough character total (for cost awareness — Chirp is ~$30/1M chars).
  const chars = items.reduce((n, it) => n + it.key.length, 0);
  console.log(`audio work-list: ${items.length} unique keys, ~${chars} chars`);
  console.log(`written: data/audio/keys.audio.json`);
}

// Only build the work-list when run directly — when imported (e.g. by
// generate-audio.mjs for keyHash) we just expose the helper.
if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) main();

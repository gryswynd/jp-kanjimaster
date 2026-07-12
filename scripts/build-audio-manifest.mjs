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

// The single voice everything that isn't a conversation line is spoken in:
// narration, glossary words, kanji readings, Audio Dojo passages.
export const NARRATOR = 'Fenrir';

/**
 * Clip filename hash. The narrator's hash is the bare key — that grandfathers
 * the ~10k clips baked before per-character voices existed, so adding a voice
 * dimension costs zero regeneration. NEVER "fix" this to hash the narrator's
 * voice in for symmetry: it renames every existing clip (~282 MB).
 */
export function keyHash(key, voice) {
  const input = voice && voice !== NARRATOR ? `${voice}\u0000${key}` : key;
  return createHash('sha1').update(input, 'utf8').digest('hex');
}

function main() {
  const keys = collectKeys(ROOT);
  const items = [...keys.values()]
    .map((rec) => ({
      key: rec.key,
      voice: rec.voice,
      hash: keyHash(rec.key, rec.voice),
      text: rec.text || rec.key,
      sources: [...rec.sources].sort()
    }))
    .sort((a, b) => a.voice.localeCompare(b.voice) || a.key.localeCompare(b.key));

  const outDir = join(ROOT, 'data', 'audio');
  mkdirSync(outDir, { recursive: true });
  const out = { schemaVersion: '2.0.0', narrator: NARRATOR, count: items.length, items };
  writeFileSync(join(outDir, 'keys.audio.json'), JSON.stringify(out, null, 2));

  // Rough character total (for cost awareness — Chirp is ~$30/1M chars).
  const chars = items.reduce((n, it) => n + it.key.length, 0);
  const voiced = items.filter((it) => it.voice !== NARRATOR).length;
  console.log(`audio work-list: ${items.length} unique keys (${voiced} voiced), ~${chars} chars`);
  console.log(`written: data/audio/keys.audio.json`);
}

// Only build the work-list when run directly — when imported (e.g. by
// generate-audio.mjs for keyHash) we just expose the helper.
if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) main();

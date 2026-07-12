#!/usr/bin/env node
// Audio coverage gate. Re-derives the full key set (same collector the generator
// uses) and asserts the committed manifest has a clip for every key.
//
// If the manifest doesn't exist yet (audio not generated), this PASSES with a
// warning so build:www still works during development. Once a manifest exists,
// any drift (new content lacking a clip) FAILS the build.
//
// Run: node scripts/validate-audio.mjs
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { collectKeys, NARRATOR } from './lib/audio-collect.mjs';

const ROOT = new URL('..', import.meta.url).pathname;

function main() {
  const manifestPath = join(ROOT, 'data', 'audio', 'manifest.audio.json');
  if (!existsSync(manifestPath)) {
    console.warn('[validate-audio] no manifest.audio.json yet — skipping coverage gate. ' +
      'Run scripts/build-audio-manifest.mjs && scripts/generate-audio.mjs to bake audio.');
    return;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const clips = manifest.clips || {};
  const voices = manifest.voices || {};
  const keys = collectKeys(ROOT);

  // Narrator keys live in `clips`; a conversation line's voiced clip lives under
  // `voices[<Voice>]`. tts.js falls back to the narrator when a voiced clip is
  // missing, so ONLY this gate can catch a character silently losing their voice.
  const missing = [];
  for (const { key, voice } of keys.values()) {
    const found = voice === NARRATOR ? clips[key] : (voices[voice] || {})[key];
    if (!found) missing.push(voice === NARRATOR ? key : `${voice}: ${key}`);
  }

  if (missing.length) {
    console.error(`[validate-audio] ${missing.length} key(s) have no clip:`);
    for (const k of missing.slice(0, 25)) console.error('  ' + JSON.stringify(k));
    if (missing.length > 25) console.error(`  ...and ${missing.length - 25} more`);
    console.error('Run: node scripts/build-audio-manifest.mjs && node scripts/generate-audio.mjs');
    process.exit(1);
  }

  const voicedClips = Object.values(voices).reduce((n, m) => n + Object.keys(m).length, 0);
  console.log(`[validate-audio] OK — ${keys.size} keys all covered ` +
    `(${Object.keys(clips).length} narrator + ${voicedClips} voiced clips).`);
}

main();

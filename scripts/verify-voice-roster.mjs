#!/usr/bin/env node
// Opt-in roster check: does shared/chirp-voices.json still match what Google
// actually serves for ja-JP?
//
// NOT part of build:www — that runs without GOOGLE_TTS_API_KEY, and the gate
// (validate-voices.mjs) reads the committed roster so it stays deterministic and
// offline. Run this by hand when Google adds voices, or when a synth 400s on a
// voice name you believe exists.
//
// Run: GOOGLE_TTS_API_KEY=... npm run voices:verify-roster
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const API_KEY = process.env.GOOGLE_TTS_API_KEY || '';
const PREFIX = 'ja-JP-Chirp3-HD-';

async function main() {
  if (!API_KEY) throw new Error('Set GOOGLE_TTS_API_KEY to verify the roster.');

  const roster = JSON.parse(readFileSync(join(ROOT, 'shared', 'chirp-voices.json'), 'utf8'));
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/voices?languageCode=ja-JP&key=${encodeURIComponent(API_KEY)}`
  );
  if (!res.ok) throw new Error(`voices.list HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const live = new Set(
    (await res.json()).voices
      .filter((v) => v.name.startsWith(PREFIX))
      .map((v) => v.name.slice(PREFIX.length))
  );
  const mine = Object.keys(roster.voices || {});

  const stale = mine.filter((v) => !live.has(v));
  const fresh = [...live].filter((v) => !roster.voices[v]);

  if (stale.length) console.error(`✗ in shared/chirp-voices.json but NOT served: ${stale.join(', ')}`);
  if (fresh.length) console.log(`+ served but missing from the roster: ${fresh.join(', ')}`);
  if (!roster.voices[roster.narrator]) console.error(`✗ narrator "${roster.narrator}" is not in the roster`);

  if (stale.length) {
    console.error('\nA voice assigned in shared/characters.json that Google no longer serves will 400 at bake time.');
    process.exit(1);
  }
  console.log(`[verify-voice-roster] OK — all ${mine.length} roster voices are live` +
    (fresh.length ? `; ${fresh.length} new voice(s) available to adopt.` : '; roster is complete.'));
}

main().catch((e) => { console.error(String((e && e.message) || e)); process.exit(1); });

#!/usr/bin/env node
// Conversation voice gate.
//
// Every line of every conversation is spoken in its speaker's voice. This gate
// fails the build when a speaker has no voice — because the runtime CANNOT tell
// you: tts.js falls back to the narrator's clip, so a miscast character just
// quietly sounds like Rikizo. Nothing else catches that.
//
// Checks:
//   1. every `spk` in every conversation resolves to a cast voice, a roleVoices
//      entry, or the block's own `speakers` map;
//   2. every voice named anywhere is a real Chirp 3 HD voice (shared/chirp-voices.json);
//   3. every `type:"character"` entry that speaks has a voice.
//
// The rule is RESOLUTION SUCCESS, not `voice !== narrator` — Rikizo's voice
// legitimately IS the narrator (Fenrir).
//
// Roster source is the committed shared/chirp-voices.json, not the live API:
// build:www runs without GOOGLE_TTS_API_KEY. Re-confirm it against Google with
// `npm run voices:verify-roster`.
//
// Run: node scripts/validate-voices.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { isConversation } from './lib/audio-collect.mjs';
import { loadVoiceResolver } from './lib/load-characters.mjs';

const ROOT = new URL('..', import.meta.url).pathname;

function listJson(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) listJson(p, out);
    else if (name.endsWith('.json')) out.push(p);
  }
  return out;
}

function main() {
  const { voiceFor, roleVoices, roster, narrator } = loadVoiceResolver(ROOT);
  const valid = roster.voices || {};
  const errors = [];
  const warnings = [];

  if (!valid[narrator]) errors.push(`narrator "${narrator}" is not in shared/chirp-voices.json`);

  // --- characters.json hygiene ---
  const charJson = JSON.parse(readFileSync(join(ROOT, 'shared', 'characters.json'), 'utf8'));
  const seenVoice = new Map();
  for (const c of charJson.characters || []) {
    if (!c || c.type !== 'character' || !c.voice) continue;   // voiceless = never speaks
    if (!valid[c.voice]) errors.push(`shared/characters.json: ${c.id} has unknown voice "${c.voice}"`);
    if (seenVoice.has(c.voice)) warnings.push(`${c.id} shares voice "${c.voice}" with ${seenVoice.get(c.voice)}`);
    else seenVoice.set(c.voice, c.id);
  }
  for (const [label, v] of Object.entries(roleVoices)) {
    if (!valid[v]) errors.push(`shared/characters.json roleVoices["${label}"] is unknown voice "${v}"`);
  }

  // --- every conversation speaker resolves ---
  const unresolved = new Map();   // "file: spk" → count
  let lines = 0, blocks = 0;
  const voiceless = new Set();

  for (const lvl of ['N5', 'N4', 'N3', 'custom']) {
    for (const kind of ['lessons', 'grammar', 'reviews']) {
      for (const file of listJson(join(ROOT, 'data', lvl, kind))) {
        let data;
        try { data = JSON.parse(readFileSync(file, 'utf8')); } catch { continue; }
        const rel = relative(ROOT, file);

        (function walk(node) {
          if (!node || typeof node !== 'object') return;
          if (Array.isArray(node)) { node.forEach(walk); return; }
          if (isConversation(node)) {
            blocks++;
            for (const line of node.lines) {
              if (!line || !line.jp) continue;
              lines++;
              const spk = String(line.spk == null ? '' : line.spk);
              const { voice, known } = voiceFor(spk, node.speakers);
              if (!known) {
                const k = `${rel}: "${spk}"`;
                unresolved.set(k, (unresolved.get(k) || 0) + 1);
              } else if (!valid[voice]) {
                voiceless.add(`${rel}: "${spk}" → unknown voice "${voice}"`);
              }
            }
          }
          Object.values(node).forEach(walk);
        })(data);
      }
    }
  }

  for (const [k, n] of unresolved) {
    errors.push(`${k} has no voice (${n} line${n === 1 ? '' : 's'}) — add it to the block's ` +
      `\`speakers\` map, or to roleVoices in shared/characters.json`);
  }
  for (const v of voiceless) errors.push(v);

  for (const w of warnings) console.warn(`[validate-voices] warning: ${w}`);

  if (errors.length) {
    console.error(`[validate-voices] ${errors.length} problem(s):`);
    for (const e of errors.slice(0, 30)) console.error('  ' + e);
    if (errors.length > 30) console.error(`  ...and ${errors.length - 30} more`);
    process.exit(1);
  }

  console.log(`[validate-voices] OK — ${lines} lines across ${blocks} conversations, ` +
    `every speaker voiced (${seenVoice.size} cast + ${new Set(Object.values(roleVoices)).size} role voices).`);
}

main();

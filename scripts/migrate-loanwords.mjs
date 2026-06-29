#!/usr/bin/env node
/**
 * scripts/migrate-loanwords.mjs
 * One-shot (idempotent) migration: MOVE katakana loanwords (gairaigo) out of the
 * leveled glossaries (data/N5|N4|N3/glossary.*.json) into the always-allowed pool
 * shared/loanwords.json — a sibling of shared/particles.json / characters.json.
 *
 * Why: the app gates content by KANJI level. Katakana loanwords have no kanji to
 * gate on and dilute the leveled vocab lists. Pulling them into one level-agnostic
 * pool keeps the N-glossaries pure-kanji and lets ALL content (incl. future
 * genre-themed custom stories) draw on loanwords "where natural" without ever
 * flagging out-of-level. See plan: Gairaigo Gauntlet.
 *
 * Migration rule (no hand-maintained keep-list needed):
 *   migrate  ⟺  surface is PURE katakana (only katakana + ー/・) AND gtype != interjection
 * This auto-keeps interjections (うーん, えー, えーと) and kanji-bearing hybrids
 * (ローマ字 — has 字) in their level glossary.
 *
 * Data cleaning on the way out:
 *   - reading folded katakana → hiragana (the dojo grades on hiragana)
 *   - origin (source LANGUAGE) stamped from ORIGIN map
 *   - duplicate ids collapsed (known: v_sarada in N5.7 + N5.9)
 *
 * Idempotent + corpus-safe: an existing shared/loanwords.json is preserved and
 * merged by id, so re-running after the corpus has grown never wipes it.
 *
 * Run:  node scripts/migrate-loanwords.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const GLOSSARIES = [
  'data/N5/glossary.N5.json',
  'data/N4/glossary.N4.json',
  'data/N3/glossary.N3.json',
];
const LOANWORDS_FILE = 'shared/loanwords.json';

// Source LANGUAGE per migrated id (linguistic origin of the borrowing, not the
// referent country — so アメリカ=American English, イギリス=Portuguese (from "Inglez")).
// English split US/UK: modern/ambiguous loans default to American English; none of
// the migrated set is distinctly British. Any pure-katakana entry NOT listed here
// defaults to American English with a warning.
const ORIGIN = {
  // N5
  v_beddo: 'American English', v_pasokon: 'American English', v_terebi: 'American English', v_toire: 'American English',
  v_geemu: 'American English', v_keeki: 'American English', v_sumaho: 'American English', v_basu: 'American English',
  v_konbini: 'American English', v_suupaa: 'American English', v_takushii: 'American English', v_meeru: 'American English',
  v_juusu: 'American English', v_karee: 'American English', v_koohii: 'Dutch', v_pan: 'Portuguese',
  v_resutoran: 'French', v_sarada: 'American English', v_depaato: 'American English', v_purezento: 'American English',
  v_teeburu: 'American English', v_chokoreeto: 'American English', v_piza: 'Italian', v_sandoicchi: 'American English',
  v_aisukuriimu: 'American English', v_purin: 'American English', v_hoteru: 'American English', v_kurasu_class: 'American English',
  v_nooto: 'American English', v_pen: 'American English', v_tesuto: 'American English', v_arubaito: 'German',
  // N4
  v_shatsu: 'American English', v_memo: 'American English', v_america: 'American English', v_igirisu: 'Portuguese',
  v_kamera: 'American English', v_furi_maaketto: 'American English', v_sumisu: 'American English', v_konsaato: 'American English',
  v_saabisu: 'American English', v_purezenteshon: 'American English',
};

const PURE_KATAKANA = /^[ァ-ヶー・]+$/;
const isLoanword = (e) => PURE_KATAKANA.test(e.surface || '') && e.gtype !== 'interjection';

// Fold katakana → hiragana, leaving prolonged-sound ー / nakaguro ・ as-is.
function kataToHira(s) {
  return (s || '').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

const readJson = async (f) => JSON.parse(await readFile(path.join(ROOT, f), 'utf8'));
const writeJson = async (f, data) =>
  writeFile(path.join(ROOT, f), JSON.stringify(data, null, 2) + '\n', 'utf8');

// ── Collect existing loanwords (corpus-safe merge) ───────────────────────────
const byId = new Map();
if (existsSync(path.join(ROOT, LOANWORDS_FILE))) {
  const existing = await readJson(LOANWORDS_FILE);
  for (const w of existing.loanwords || []) byId.set(w.id, w);
  console.log(`[loanwords] preserving ${byId.size} existing entries`);
}

// ── Extract from each glossary, rewriting the glossary in place ───────────────
let movedTotal = 0;
for (const gfile of GLOSSARIES) {
  const data = await readJson(gfile);
  const kept = [];
  const moved = [];
  for (const e of data.entries) {
    if (!isLoanword(e)) { kept.push(e); continue; }
    moved.push(e);
    if (byId.has(e.id)) continue; // existing pool entry wins (idempotent re-run)
    const origin = ORIGIN[e.id];
    if (!origin) console.warn(`  ⚠ no ORIGIN for ${e.id} (${e.surface}) → defaulting American English`);
    const lw = {
      id: e.id,
      surface: e.surface,
      reading: kataToHira(e.reading || e.surface),
      meaning: e.meaning,
      origin: origin || 'American English',
      gtype: 'noun',
      tier: 'common',                 // migrated set = core N5/N4 = high-frequency
      themes: ['slice-of-life'],      // everyday words; refine per-entry later
    };
    if (e.notes) lw.notes = e.notes;
    if (e.tokens) lw.tokens = e.tokens; // preserve any hand-baked tokens
    byId.set(e.id, lw);
  }
  if (moved.length) {
    data.entries = kept;
    await writeJson(gfile, data);
    movedTotal += moved.length;
    console.log(`[${gfile}] moved ${moved.length} loanwords → pool (${kept.length} kept):`);
    for (const e of moved) console.log(`    - ${e.id}  ${e.surface}  (${ORIGIN[e.id] || 'English'})`);
  } else {
    console.log(`[${gfile}] no loanwords to move`);
  }
}

// ── Write the pool (sorted by id for stable diffs) ───────────────────────────
const loanwords = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
await writeJson(LOANWORDS_FILE, { contentVersion: '1.0.0', loanwords });

console.log(`\nDone. Pool now has ${loanwords.length} loanwords (moved ${movedTotal} this run).`);
console.log(`Next: node scripts/derive-glossary-tokens.mjs  (bakes tokens onto the pool)`);

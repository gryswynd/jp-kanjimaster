// Shared audio key collector.
//
// Walks all spoken content and produces the COMPLETE set of normalized keys
// that the runtime might look up, using the SAME normalization the browser uses
// (app/shared/tts-normalize.js via load-normalize). Both the generator
// (build-audio-manifest.mjs) and the coverage gate (validate-audio.mjs) call
// this, so what we generate is exactly what we validate.
//
// Strategy: be GENEROUS. For every spoken string we emit the plain key AND, when
// the node carries a `terms` array, the terms-aware key too — because different
// callsites speak the same text with and without terms (Stories speaks plain,
// Lesson/Review speak terms-aware). Over-generating a few clips is cheap; a
// missing clip is a silent failure. Keys are deduped, so overlap is free.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadTtsNormalize } from './load-normalize.mjs';

const norm = loadTtsNormalize();

// The literal sentence the Settings "Test voice" button speaks.
const TEST_SENTENCE = 'こんにちは、元気ですか。今日はいい天気ですね。';

// on/kun reading strings are split into individual readings exactly as
// Lesson.js readingCell() does before sending each to tts.speak().
function splitReadings(s) {
  if (!s || s === '—') return [];
  return String(s)
    .split(/[,、\/／;；・·]/)
    // strip okurigana notation so the reading is clean kana for TTS + display:
    // leading/trailing dashes (う-まれる), the dictionary dot (あそ.ぶ→あそぶ), and
    // okurigana parens (あ(ける)→あける).
    .map((r) => r.trim().replace(/^-+|-+$/g, '').replace(/[.．（）()]/g, ''))
    .filter(Boolean);
}

function listJson(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...listJson(p));
    else if (name.endsWith('.json')) out.push(p);
  }
  return out;
}

function readJson(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

// Build id→entry term map from every glossary.
export function buildTermMap(root) {
  const termMap = {};
  for (const lvl of ['N5', 'N4', 'N3']) {
    const g = readJson(join(root, 'data', lvl, `glossary.${lvl}.json`));
    const entries = g && (g.entries || g);
    if (Array.isArray(entries)) {
      for (const e of entries) if (e && e.id) termMap[e.id] = e;
    }
  }
  return termMap;
}

// Which string fields are actually SPOKEN (passed to tts.speak), per content
// kind. Scoped deliberately: e.g. lesson quiz `q` is rendered visually, never
// spoken — including it would bake English parentheticals and ___ blanks. Only
// audiostory `q` is spoken (the comprehension-question audio).
const SPOKEN_FIELDS = {
  lessons: ['jp'],
  stories: ['jp'],
  reviews: ['jp'],
  grammar: ['jp', 'sentence', 'given', 'answer'],
  audiostories: ['jp', 'q'],
  compose: []
};

// Recursively walk a parsed JSON node, emitting keys via emit(key, source).
function walkNode(node, termMap, emit, source, kind) {
  if (node == null) return;
  if (Array.isArray(node)) { for (const x of node) walkNode(x, termMap, emit, source, kind); return; }
  if (typeof node !== 'object') return;

  const fields = SPOKEN_FIELDS[kind] || ['jp'];

  // terms→kana layer dropped: every spoken unit is keyed by normalizeKey(jp, null)
  // (kanji kept; ambiguous readings handled by the static override table). This
  // matches the runtime, which no longer builds termPairs.
  for (const field of fields) {
    const v = node[field];
    if (typeof v === 'string' && v.trim()) {
      emit(norm.normalizeKey(v, null), source + ':' + field, v);
    }
  }

  // Grammar examples: speakParts joins parts[].text with '' then speaks it.
  if (kind === 'grammar' && Array.isArray(node.parts) &&
      node.parts.some((p) => p && typeof p.text === 'string')) {
    const joined = node.parts.map((p) => (p && p.text) || '').join('');
    if (joined.trim()) emit(norm.normalizeKey(joined, null), source + ':parts', joined);
  }

  // newKanji on/kun readings → each split reading is a data-speak chip, spoken
  // with {reading:true}, so collect via readingKey (katakana for は/へ/を).
  for (const k of [].concat(node.newKanji || [])) {
    for (const r of splitReadings(k && k.kun)) emit(norm.readingKey(r), source + ':kun', r);
    for (const r of splitReadings(k && k.on)) emit(norm.readingKey(r), source + ':on', r);
  }

  for (const key of Object.keys(node)) {
    if (key === 'terms' || key === 'parts' || key === 'newKanji') continue;
    walkNode(node[key], termMap, emit, source, kind);
  }
}

/**
 * Collect every normalized key. Returns a Map: key → Set(sources).
 */
export function collectKeys(root) {
  const termMap = buildTermMap(root);
  const keys = new Map();
  // value: { sources:Set, text } — text is a representative ORIGINAL string
  // (pre-normalization) for display in the QA page.
  const emit = (key, source, original) => {
    if (!key || !key.trim()) return;
    // Fenrir is a JAPANESE voice — never synthesize English/romaji/symbol-only
    // strings (e.g. grammar `answer` fields that hold English meanings). English
    // narration will use a separate English voice later. Require ≥1 Japanese char.
    if (!/[぀-ヿ一-鿿]/.test(key)) return;
    if (!keys.has(key)) keys.set(key, { sources: new Set(), text: '' });
    const rec = keys.get(key);
    rec.sources.add(source);
    if (!rec.text && original) rec.text = String(original).trim();
  };

  // Glossary: surface, reading, and split on/kun.
  for (const lvl of ['N5', 'N4', 'N3']) {
    const g = readJson(join(root, 'data', lvl, `glossary.${lvl}.json`));
    const entries = g && (g.entries || g);
    if (Array.isArray(entries)) {
      for (const e of entries) {
        if (!e) continue;
        if (e.surface) emit(norm.normalizeKey(e.surface, null), `glossary.${lvl}:surface`, e.surface);
        // Readings are isolated kana → readingKey (katakana for は/へ/を). Run the
        // reading field through splitReadings too (it can carry slashes / parens).
        for (const r of splitReadings(e.reading)) emit(norm.readingKey(r), `glossary.${lvl}:reading`, r);
        for (const r of splitReadings(e.on)) emit(norm.readingKey(r), `glossary.${lvl}:on`, r);
        for (const r of splitReadings(e.kun)) emit(norm.readingKey(r), `glossary.${lvl}:kun`, r);
      }
    }
  }

  // Particles.
  const particles = readJson(join(root, 'shared', 'particles.json'));
  const plist = particles && (particles.particles || particles);
  if (Array.isArray(plist)) {
    for (const p of plist) {
      if (p && p.particle) emit(norm.normalizeKey(p.particle, null), 'particles:particle', p.particle);
      if (p && p.reading) emit(norm.normalizeKey(p.reading, null), 'particles:reading', p.reading);
    }
  }

  // Content dirs (lessons, stories, grammar, reviews, audiostories, compose).
  for (const lvl of ['N5', 'N4', 'N3', 'custom']) {
    for (const kind of ['lessons', 'stories', 'grammar', 'reviews', 'audiostories', 'compose']) {
      for (const file of listJson(join(root, 'data', lvl, kind))) {
        const data = readJson(file);
        walkNode(data, termMap, emit, `${lvl}/${kind}`, kind);
      }
    }
  }

  // Settings test sentence.
  emit(norm.normalizeKey(TEST_SENTENCE, null), 'settings:test', TEST_SENTENCE);

  return keys;
}

/**
 * server/lib/curriculum.js
 * Server-side "where is X taught" index — the engine behind the `lookup_curriculum`
 * tool. Ports the proven indexing logic from app/shared/tutor-curriculum.js so the
 * SERVER can answer lesson-placement questions on demand, instead of relying only
 * on the client's per-question hint (which misses typed/English questions).
 *
 * Why a tool, not files-in-context: the full curriculum is ~12 MB / ~4M tokens —
 * far too large to put in the prompt. Claude calls this with the Japanese form it
 * is about to teach (or an English grammar keyword) and gets back the lesson/grammar
 * id + title. See /Users/joel/.claude/plans/partitioned-dancing-sifakis.md.
 *
 * Data source: the repo's manifest.json + level glossaries. Override the repo root
 * with CURRICULUM_ROOT (e.g. when the server is deployed apart from the app tree).
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
// server/lib → repo root is two levels up. Override via env for standalone deploys.
const ROOT = process.env.CURRICULUM_ROOT || join(__dir, '..', '..');

let loadPromise = null;
let whereIndex = null;   // [{ key, where, title, kind, level }] kana/romaji surface index
let titleIndex = null;   // [{ id, title, kind, level, words:Set }] for English keyword search

// Ultra-common forms that would match almost any question — excluded so the
// lookup surfaces specific items (になる), not noise (する). (Ported verbatim.)
const WHERE_STOPLIST = new Set([
  'する', 'ある', 'いる', 'です', 'ます', 'だ', 'この', 'その', 'あの',
  'して', 'から', 'まで', 'こと', 'もの', 'なる', 'いう', 'ない', 'これ', 'それ',
]);

// Generic English words that shouldn't drive a title match on their own.
const EN_STOPLIST = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'with', 'for', 'your',
  'you', 'how', 'do', 'does', 'i', 'is', 'it', 'what', 'when', 'where', 'why',
  'this', 'that', 'use', 'using', 'say', 'mean', 'means', 'japanese', 'word',
]);

function isValidWhere(w) {
  return /^N\d\.\d/.test(w) || /^G\d+$/.test(w) || /Review/i.test(w);
}

/** Normalize romaji for fuzzy matching (lowercase, strip macrons + non-alnum). */
function normRoma(s) {
  return String(s || '').toLowerCase()
    .replace(/[āîûêôōū]/g, (c) => ({ 'ā': 'a', 'î': 'i', 'û': 'u', 'ê': 'e', 'ô': 'o', 'ō': 'o', 'ū': 'u' }[c] || c))
    .replace(/[^a-z0-9]/g, '');
}

const JP_RE = /[ぁ-ん゠-ヿ一-鿿]/;

/** Pull individual kana forms out of a grammar title's slash/dash list. */
function extractForms(title) {
  return String(title || '').split(/[\s/、・—\-–]+/)
    .map((t) => t.replace(/[〜～]/g, '').trim())
    .filter((t) => t.length >= 2 && t.length <= 14 && /[ぁ-んァ-ヶ]/.test(t) && !/[A-Za-z]/.test(t) && !WHERE_STOPLIST.has(t));
}

function enWords(title) {
  return String(title || '').toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w.length >= 3 && !EN_STOPLIST.has(w));
}

function buildIndexes(manifest, glossParts) {
  const levels = manifest.levels || Object.keys(manifest.data || {});
  const where = [];
  const titles = [];
  const seen = new Set();

  function add(key, w, title, kind, level) {
    if (!key || !w || WHERE_STOPLIST.has(key) || !isValidWhere(w)) return;
    const sig = key + '|' + w;
    if (seen.has(sig)) return;
    seen.add(sig);
    where.push({ key, where: w, title: title || '', kind, level });
  }

  // Vocab + kanji from glossaries (key = surface/reading, where = lesson id).
  glossParts.forEach((g) => {
    ((g && g.entries) || []).forEach((e) => {
      const lid = e.lesson || e.lesson_ids;
      if (!lid) return;
      const first = String(lid).split(/[,\s]+/).filter(Boolean)[0];
      const lvl = /^N4/.test(first) ? 'N4' : /^N5/.test(first) ? 'N5' : '';
      if (e.surface && e.surface.length >= 2) add(e.surface, first, e.meaning, e.type || 'vocab', lvl);
      if (e.reading && e.reading !== e.surface && e.reading.length >= 2) add(e.reading, first, e.meaning, e.type || 'vocab', lvl);
    });
  });

  // Grammar + lessons from the manifest (kana forms for `where`, titles for English search).
  levels.forEach((lvl) => {
    const d = manifest.data[lvl] || {};
    (d.grammar || []).forEach((gr) => {
      extractForms(gr.title).forEach((form) => add(form, gr.id, gr.title, 'grammar', lvl));
      titles.push({ id: gr.id, title: gr.title, kind: 'grammar', level: lvl, words: new Set(enWords(gr.title)) });
    });
    (d.lessons || []).forEach((l) => {
      titles.push({ id: l.id, title: l.title, kind: 'lesson', level: lvl, words: new Set(enWords(l.title)) });
    });
  });

  return { where, titles };
}

async function load() {
  const manifest = JSON.parse(await readFile(join(ROOT, 'manifest.json'), 'utf8'));
  const levels = manifest.levels || Object.keys(manifest.data || {});
  const glossParts = await Promise.all(levels.map(async (lvl) => {
    const rel = manifest.data[lvl] && manifest.data[lvl].glossary;
    if (!rel) return { entries: [] };
    try { return JSON.parse(await readFile(join(ROOT, rel), 'utf8')); }
    catch { return { entries: [] }; }
  }));
  const idx = buildIndexes(manifest, glossParts);
  whereIndex = idx.where;
  titleIndex = idx.titles;
  console.log(JSON.stringify({
    severity: 'NOTICE', kind: 'curriculum_loaded',
    surfaceKeys: whereIndex.length, titles: titleIndex.length,
  }));
}

/** Idempotent boot loader; safe to call repeatedly (warms on first call). */
export function initCurriculum() {
  if (!loadPromise) loadPromise = load().catch((e) => {
    console.error(JSON.stringify({ severity: 'ERROR', kind: 'curriculum_load_failed', msg: String(e && e.message || e) }));
    whereIndex = whereIndex || [];
    titleIndex = titleIndex || [];
  });
  return loadPromise;
}

/**
 * Look up where a term/grammar/keyword is taught.
 * @param {string} query  Japanese form (kana/kanji/romaji) OR English keyword.
 * @returns {Array<{key,where,title,kind,level}>} up to 6 matches, best first.
 */
export async function lookup(query) {
  await initCurriculum();
  const q = String(query || '').trim();
  if (!q || !whereIndex) return [];

  const byWhere = {};
  const romaQ = normRoma(q);

  // 1. Japanese/romaji surface match (longest key per destination wins).
  for (const e of whereIndex) {
    const keyIsJP = JP_RE.test(e.key);
    const hay = keyIsJP ? q : romaQ;
    const needle = keyIsJP ? e.key : normRoma(e.key);
    if (needle && hay.indexOf(needle) !== -1) {
      if (byWhere[e.where] && byWhere[e.where].key.length >= e.key.length) continue;
      byWhere[e.where] = e;
    }
  }

  // 2. English keyword match against grammar/lesson titles (when the query has latin).
  if (/[a-z]/i.test(q) && titleIndex) {
    const qWords = enWords(q);
    if (qWords.length) {
      const scored = [];
      for (const t of titleIndex) {
        let hits = 0;
        for (const w of qWords) if (t.words.has(w)) hits++;
        if (hits) scored.push({ t, hits });
      }
      scored.sort((a, b) => b.hits - a.hits);
      for (const { t } of scored.slice(0, 4)) {
        if (!byWhere[t.id]) byWhere[t.id] = { key: q, where: t.id, title: t.title, kind: t.kind, level: t.level };
      }
    }
  }

  const hits = Object.values(byWhere);
  hits.sort((a, b) => b.key.length - a.key.length);
  return hits.slice(0, 6);
}

/** Format lookup() results as a compact tool-result string for Claude. */
export async function describeMatches(query) {
  const hits = await lookup(query);
  if (!hits.length) {
    return `No curriculum match for "${query}". It may be outside the N5–N4 curriculum — ` +
      `teach it normally without naming a lesson id.`;
  }
  const lines = [`WHERE TAUGHT — matches for "${query}":`];
  for (const h of hits) {
    const t = String(h.title || '').replace(/^G\d+\s*[—–-]\s*/, '');
    const lvl = h.level ? ` [${h.level}]` : '';
    if (h.kind === 'grammar') lines.push(`- grammar ${h.where}${t ? ` (${t})` : ''}${lvl}`);
    else lines.push(`- lesson ${h.where}${t ? ` (${t})` : ''}${lvl}`);
  }
  lines.push('Cross-reference the student\'s "lessons completed" / "grammar already taught" lists to say whether this is a review or something coming up.');
  return lines.join('\n');
}

/**
 * server/lib/content.js
 * Server-side "what is on the student's screen right now" resolver.
 *
 * The client sends only tiny identifiers — { view, lessonId, page, item } — and
 * this module turns them into the actual on-screen Japanese by reading the one
 * content file the identifiers point at. This is the inverse of the old design
 * (where the client extracted and shipped the visible text in a big hint): the
 * server already has the whole content tree on disk + a manifest mapping every
 * id → file, so resolving one page per question is cheap and keeps payloads tiny.
 *
 * Companion to curriculum.js (the "where is X taught" index). Same ROOT.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
// server/lib → repo root is two levels up. Override via env for standalone deploys.
const ROOT = process.env.CURRICULUM_ROOT || join(__dir, '..', '..');

const SAMPLE_CAP = 280;          // max chars of visible Japanese in the hint
const JP_RE = /[ぁ-ん゠-ヿ一-鿿]/; // hiragana / katakana / kanji (matches curriculum.js)
const PARA_WINDOW = 2;           // story paragraphs: current + next N for context

let loadPromise = null;
let buckets = null;              // { <manifestArrayKey>: { '<id>': 'data/.../file.json' } }
let flatIndex = null;            // { '<id>': rel } fallback when the view bucket misses
const fileCache = new Map();     // rel path → parsed JSON (content is static per deploy)

// Which manifest array (or audiostories index) backs each client `view`. Lessons
// and compose both use "N4.x" ids, so a flat map collides — bucketing by view
// keeps compose:N4.26 distinct from lesson:N4.26.
const VIEW_TO_BUCKET = {
  lesson: 'lessons', grammar: 'grammar', compose: 'compose',
  story: 'stories', custom: 'stories', audiodojo: 'audiostories',
};

// Views that must NEVER resolve a content file server-side: reviews hold the
// answers (only the question travels as `item`); the others have no page file.
// Defense-in-depth so a future client bug can't make Rikizo leak quiz answers.
const NO_FILE_VIEWS = new Set(['review', 'practice', 'glossary', 'map', 'home']);

// Friendly labels, mirrors app/shared/tutor-context.js VIEW_LABELS.
const VIEW_LABELS = {
  home: 'the home screen', lesson: 'a lesson', grammar: 'a grammar point',
  practice: 'the Dojo (practice)', review: 'a review', story: 'a story',
  custom: 'a custom story', compose: 'composition practice',
  audiodojo: 'listening practice', glossary: 'the glossary',
  game: 'the adventure', map: 'the map',
};

/** Build per-bucket id→file maps from the manifest (+ the audiostories index). */
async function load() {
  const manifest = JSON.parse(await readFile(join(ROOT, 'manifest.json'), 'utf8'));
  const bk = {};
  const flat = {};
  const levels = manifest.levels || Object.keys(manifest.data || {});

  const register = (bucketKey, entry) => {
    if (!entry || typeof entry !== 'object') return;
    const rel = entry.dir ? join(entry.dir, entry.file || '') : entry.file;
    if (!rel) return;
    bk[bucketKey] = bk[bucketKey] || {};
    // Index by every id-like field (lessons/grammar/reviews use `id`; compose uses `lesson`).
    for (const key of [entry.id, entry.lesson]) {
      if (!key) continue;
      if (!bk[bucketKey][key]) bk[bucketKey][key] = rel;
      if (!flat[key]) flat[key] = rel;
    }
  };

  levels.forEach((lvl) => {
    const d = (manifest.data && manifest.data[lvl]) || {};
    Object.keys(d).forEach((k) => {
      if (Array.isArray(d[k])) d[k].forEach((e) => register(k, e));
    });
  });

  // Audiostories live in their own index, not the manifest.
  try {
    const idx = JSON.parse(await readFile(join(ROOT, 'data/audiostories.index.json'), 'utf8'));
    (idx.audiostories || []).forEach((e) => register('audiostories', e));
  } catch { /* optional */ }

  buckets = bk;
  flatIndex = flat;
  console.log(JSON.stringify({
    severity: 'NOTICE', kind: 'content_index_loaded', ids: Object.keys(flat).length,
  }));
}

/** Idempotent boot loader; safe to call repeatedly (warms on first call). */
export function initContent() {
  if (!loadPromise) loadPromise = load().catch((e) => {
    console.error(JSON.stringify({
      severity: 'ERROR', kind: 'content_index_failed', msg: String((e && e.message) || e),
    }));
    buckets = buckets || {};
    flatIndex = flatIndex || {};
  });
  return loadPromise;
}

async function readContentFile(rel) {
  if (fileCache.has(rel)) return fileCache.get(rel);
  const data = JSON.parse(await readFile(join(ROOT, rel), 'utf8'));
  fileCache.set(rel, data);
  return data;
}

/**
 * Shape-agnostic Japanese collector: walk any section/prompt/paragraph node and
 * gather every string that contains Japanese script. This naturally pulls
 * items[].jp, lines[].jp, examples[].pattern, compose .model, drill .segments[],
 * summaries, etc. while skipping English fields (prompt/q/en/title-in-english) —
 * no per-shape special-casing needed.
 */
function collectJP(node, out, seen, depth) {
  if (out._len >= SAMPLE_CAP || depth > 7) return;
  if (typeof node === 'string') {
    const s = node.trim();
    if (s && JP_RE.test(s) && !seen.has(s)) {
      seen.add(s);
      out.push(s);
      out._len += s.length + 3;
    }
    return;
  }
  if (Array.isArray(node)) {
    for (const v of node) { collectJP(v, out, seen, depth + 1); if (out._len >= SAMPLE_CAP) return; }
    return;
  }
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      collectJP(node[k], out, seen, depth + 1);
      if (out._len >= SAMPLE_CAP) return;
    }
  }
}

function sampleFrom(node) {
  const out = []; out._len = 0;
  collectJP(node, out, new Set(), 0);
  const joined = out.join(' / ');
  return joined.length > SAMPLE_CAP ? joined.slice(0, SAMPLE_CAP) : joined;
}

/** Pick the node for the current page from whatever array the file uses. */
function pageNode(file, page) {
  const arr = file.sections || file.prompts || file.paragraphs;
  if (!Array.isArray(arr) || !arr.length) return file;
  const p = (typeof page === 'number') ? page : null;
  if (p == null || p < 0 || p >= arr.length) return arr; // out of range → sample whole
  if (file.paragraphs) return arr.slice(p, p + PARA_WINDOW); // story: current + next
  return arr[p];
}

/**
 * Resolve the on-screen context into a compact hint block for the model.
 * @param {{view?:string, lessonId?:string, page?:number, item?:string}} ctx
 * @returns {Promise<string>} a "WHAT'S ON SCREEN" block, or '' when nothing to add.
 */
export async function resolveContext(ctx) {
  if (!ctx || typeof ctx !== 'object') return '';
  await initContent();

  const view = ctx.view || '';
  const label = VIEW_LABELS[view] || (view ? ('the ' + view + ' screen') : 'the app');

  // Random card / open term / review question: the client already told us exactly
  // what's on screen (for reviews this is the QUESTION only — never the answer).
  if (ctx.item && JP_RE.test(String(ctx.item))) {
    const verb = (view === 'glossary') ? 'looking at the glossary entry'
      : (view === 'practice') ? 'being quizzed on'
        : (view === 'review') ? 'working on the question'
          : 'looking at';
    return `WHAT'S ON SCREEN\nThe student is on ${label}, ${verb}: ${String(ctx.item).slice(0, 160)}.`;
  }

  // Views that never read a file (reviews especially — no answer leaks).
  if (NO_FILE_VIEWS.has(view)) {
    return view && view !== 'home'
      ? `WHAT'S ON SCREEN\nThe student is on ${label}.`
      : '';
  }

  // Nothing to resolve (missing id) — let the model answer generally.
  const bucket = VIEW_TO_BUCKET[view];
  const rel = ctx.lessonId && (
    (bucket && buckets && buckets[bucket] && buckets[bucket][ctx.lessonId]) ||
    (flatIndex && flatIndex[ctx.lessonId])
  );
  if (!rel) {
    return view && view !== 'home'
      ? `WHAT'S ON SCREEN\nThe student is on ${label}.`
      : '';
  }

  let sample = '';
  let title = '';
  try {
    const file = await readContentFile(rel);
    title = file.title || '';
    sample = sampleFrom(pageNode(file, ctx.page));
  } catch (e) {
    return `WHAT'S ON SCREEN\nThe student is on ${label} (${ctx.lessonId}).`;
  }

  const lines = ['WHAT\'S ON SCREEN'];
  let head = `The student is on ${label}`;
  if (title) head += ` — ${title}`;
  head += ` (${ctx.lessonId})`;
  if (typeof ctx.page === 'number') head += `, page ${ctx.page}`;
  lines.push(head + '.');
  if (sample) lines.push(`Visible Japanese: "${sample}"`);
  return lines.join('\n');
}

/**
 * The raw on-screen Japanese for the current context — used to bias speech-to-text
 * (Whisper's `prompt`) so a voice question is transcribed toward what's actually on
 * the page (e.g. hears "takasou desu" → 高そうです because it's visible). Returns
 * '' when there's nothing to bias toward. Honors the same no-file-views guard.
 * @returns {Promise<string>}
 */
export async function resolveSampleText(ctx) {
  if (!ctx || typeof ctx !== 'object') return '';
  await initContent();
  const view = ctx.view || '';

  if (ctx.item && JP_RE.test(String(ctx.item))) return String(ctx.item).slice(0, 200);
  if (NO_FILE_VIEWS.has(view)) return '';

  const bucket = VIEW_TO_BUCKET[view];
  const rel = ctx.lessonId && (
    (bucket && buckets && buckets[bucket] && buckets[bucket][ctx.lessonId]) ||
    (flatIndex && flatIndex[ctx.lessonId])
  );
  if (!rel) return '';
  try {
    const file = await readContentFile(rel);
    return sampleFrom(pageNode(file, ctx.page));
  } catch (e) { return ''; }
}

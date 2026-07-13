#!/usr/bin/env node
/**
 * scripts/qa-content.mjs
 *
 * Curriculum-scope + tagging gate for LESSONS, GRAMMAR, and REVIEWS — the
 * counterpart of qa-story.mjs for non-story content. Stories/audiostories had
 * this gate for a year; lesson/grammar/review content had nothing, which is
 * how 猫 (taught N3.44) ended up in an N5.5 grammar drill.
 *
 * Per file, for a ceiling derived from the manifest unlock chain:
 *
 *   HARD (build-failing once wired):
 *   1. UNTAUGHT-KANJI     — a kanji char displayed before its lesson.
 *   2. UNTAUGHT-VOCAB     — a tokenized word resolving above the ceiling.
 *   3. UNTAUGHT-PARTICLE  — particle introducedIn above the ceiling.
 *   4. UNTAUGHT-FORM      — conjugation form introducedIn above the ceiling.
 *   5. UNKNOWN-TERM-ID    — a terms[] ref that resolves to nothing (dead chip),
 *                           or an {id,form} with an unknown form key.
 *   6. STORY-VOCAB-LEAK   — a helper word from shared/story-vocab.json (custom-
 *                           story-only pool) referenced by curriculum content.
 *
 *   WARN (report-only; triage → fix or baseline):
 *   7. UNGLOSSARIED       — content tokens resolving to nothing (no scope info).
 *   8. CHIP-COVERAGE      — content words in a {jp, terms} pair not covered by
 *                           any term ref (they render as un-tappable flat text).
 *   9. DISTRACTOR         — kana-only untaught word used as an MCQ distractor.
 *
 * A committed baseline (scripts/qa-content-baseline.json) holds accepted
 * findings (proper nouns, meta-language, deliberate distractors). Default runs
 * are baseline-filtered and exit 1 only on NEW hard findings.
 *
 * Usage:
 *   node scripts/qa-content.mjs                       # everything, baseline-filtered
 *   node scripts/qa-content.mjs --level=N5 --kind=grammar --only=G5
 *   node scripts/qa-content.mjs --strict              # ignore baseline (full report)
 *   node scripts/qa-content.mjs --update-baseline     # accept current findings
 *   node scripts/qa-content.mjs --bucket=kanji,vocab  # filter report buckets
 *   node scripts/qa-content.mjs --json                # machine-readable output
 *   node scripts/qa-content.mjs --warns               # ALSO fail on new warn findings
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildGlossaryIndex, tokenizeText } from './lib/tokenize.mjs';
import { conjugate } from './lib/conjugate.mjs';
import { buildCounterTerm } from './lib/counters.mjs';
import {
  parseLessonId, inScope,
  buildTaughtKanji as buildTaughtKanjiFrom,
  entryLessonId,
  synthFormScope as synthFormScopeWith,
  makeClassifyToken
} from './lib/scope.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

// ── CLI ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args.filter(a => a.startsWith('--')).map(a => {
    const [k, ...v] = a.slice(2).split('=');
    return [k, v.length ? v.join('=') : true];
  })
);

const LEVELS = flags.level ? [flags.level] : ['N5', 'N4'];   // N3 unshipped; audit explicitly via --level=N3
const KINDS = flags.kind ? [flags.kind] : ['lessons', 'grammar', 'reviews'];
const ONLY = flags.only ? String(flags.only).split(',') : null;
const BUCKET_FILTER = flags.bucket ? new Set(String(flags.bucket).split(',')) : null;

const HARD_BUCKETS = ['kanji', 'vocab', 'particle', 'form', 'unknownId', 'storyLeak', 'particleSense'];
const WARN_BUCKETS = ['unglossaried', 'chipCoverage', 'distractor', 'formEdge'];

// ── Data ─────────────────────────────────────────────────────────────────────
const MANIFEST = JSON.parse(await fs.readFile(path.join(ROOT, 'manifest.json'), 'utf8'));
const CONJUGATION_RULES = JSON.parse(await fs.readFile(path.join(ROOT, 'conjugation_rules.json'), 'utf8'));
const COUNTER_RULES = JSON.parse(await fs.readFile(path.join(ROOT, 'counter_rules.json'), 'utf8'));
const STORY_VOCAB = JSON.parse(await fs.readFile(path.join(ROOT, 'shared/story-vocab.json'), 'utf8'));
const storyVocabIds = new Set((STORY_VOCAB.entries || []).map(e => e.id));
const storyVocabSurfaces = new Map((STORY_VOCAB.entries || []).map(e => [e.surface, e.id]));

const GLOSSARY_PATHS = [
  path.join(ROOT, 'data/N5/glossary.N5.json'),
  path.join(ROOT, 'data/N4/glossary.N4.json'),
  path.join(ROOT, 'data/N3/glossary.N3.json'),
  path.join(ROOT, 'shared/particles.json'),
  path.join(ROOT, 'shared/characters.json'),
  path.join(ROOT, 'shared/loanwords.json')
];

const surfaceIdx = await buildGlossaryIndex(
  GLOSSARY_PATHS,
  (p, enc) => fs.readFile(p, enc),
  { includeReadings: true, conjugationRules: CONJUGATION_RULES, counterRules: COUNTER_RULES }
);

// Reverse id→entry map. RAW glossary entries take priority — the surface index
// contains synth inflected entries that carry their ROOT id (来られ has
// id:v_kuru), and letting one of those shadow the real v_kuru breaks id-ref
// resolution (lesson_ids lookup, conjugation). SurfaceIdx entries only fill
// gaps afterwards.
const idIdx = new Map();
for (const p of GLOSSARY_PATHS) {
  let data;
  try { data = JSON.parse(await fs.readFile(p, 'utf8')); } catch { continue; }
  for (const e of (data.entries || [])) {
    if (e && e.id && !idIdx.has(e.id)) idIdx.set(e.id, e);
  }
  for (const e of (data.particles || [])) {
    if (e && e.id && !idIdx.has(e.id)) {
      idIdx.set(e.id, { ...e, surface: e.particle, type: 'particle' });
    }
  }
  for (const e of (data.characters || [])) {
    if (e && e.id && !idIdx.has(e.id)) idIdx.set(e.id, { ...e, surface: e.surface || e.name, type: 'character' });
  }
  for (const e of (data.loanwords || [])) {
    if (e && e.id && !idIdx.has(e.id)) idIdx.set(e.id, { ...e, type: 'loanword' });
  }
}
for (const [, e] of surfaceIdx) {
  if (e && e.id && !idIdx.has(e.id)) idIdx.set(e.id, e);
}

// Shared homograph particle resolver (same shim as validate-particle-senses.mjs)
const senseSrc = await fs.readFile(path.join(ROOT, 'app/shared/particle-sense.js'), 'utf8');
const shimWindow = {};
new Function('window', 'module', senseSrc)(shimWindow, undefined);
const PS = shimWindow.JPShared.particleSense;
const SENTENCE_ENDERS = new Set(['\u3002', '\uff01', '\uff1f', '!', '?', '\u300d', '\u300f', '\n']);

const classifyToken = makeClassifyToken({ surfaceIdx, idIdx });
const synthFormScope = (entry, ceiling) => synthFormScopeWith(entry, ceiling, CONJUGATION_RULES);
const buildTaughtKanji = (ceiling) => buildTaughtKanjiFrom(MANIFEST, ceiling);

// ── Ceiling resolution ───────────────────────────────────────────────────────
// Lessons: their own id (a lesson may use its own vocab). Grammar/reviews: walk
// the manifest unlocksAfter chain (review→review, review→G, G→G, G→lesson)
// until it reaches a lesson id — that's the last lesson taught when this
// content unlocks.
const unlockChain = new Map();  // id → unlocksAfter
for (const lvl of ['N5', 'N4', 'N3']) {
  const data = MANIFEST.data && MANIFEST.data[lvl];
  if (!data) continue;
  for (const g of data.grammar || []) unlockChain.set(g.id, g.unlocksAfter || null);
  for (const r of data.reviews || []) unlockChain.set(r.id, r.unlocksAfter || null);
  for (const l of data.lessons || []) unlockChain.set(l.id, l.unlocksAfter || null);
}

function resolveCeiling(kind, id, doc) {
  if (kind === 'lessons') return parseLessonId(id);
  let cur = unlockChain.has(id) ? unlockChain.get(id)
    : (doc.meta && doc.meta.unlocksAfter) || null;
  const seen = new Set();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const asLesson = parseLessonId(cur);
    if (asLesson) return asLesson;
    cur = unlockChain.get(cur) || null;
  }
  return null;
}

// ── Japanese-run extraction ──────────────────────────────────────────────────
// Content strings are often mixed EN/JP (explanations, hints). Analyze each
// contiguous JP run independently so English never confuses the tokenizer.
const JP_RUN = /[぀-ヿ一-鿿㐀-䶿々〆ー]+/g;
function jpRuns(s) {
  if (!s || typeof s !== 'string') return [];
  return s.match(JP_RUN) || [];
}
const HAS_CJK_CHAR = /[一-鿿㐀-䶿々]/;

// ── Field extraction ─────────────────────────────────────────────────────────
// Every extractor yields { text, terms?, where, distractor? } items. `terms`
// present → the pair is also chip-coverage checked. `distractor: true` softens
// kana-only scope violations into the DISTRACTOR warn bucket.
function extractSection(sec, si) {
  const out = [];
  const at = (suffix) => `${sec.type}[${si}]${suffix}`;
  const push = (text, where, opts = {}) => {
    if (text && typeof text === 'string') out.push({ text, where, ...opts });
  };

  switch (sec.type) {
    case 'warmup':
      (sec.items || []).forEach((it, i) => push(it.jp, at(`.items[${i}]`), { terms: it.terms }));
      break;
    case 'kanjiGrid':
      // The lesson's own new kanji — taught here, nothing to gate.
      break;
    case 'vocabList':
      // Id refs only; checked in the terms pass.
      (sec.groups || []).forEach((g, gi) =>
        (g.items || []).forEach((id, ii) => out.push({ idRef: id, where: at(`.groups[${gi}].items[${ii}]`) })));
      break;
    case 'conversation':
      (sec.lines || []).forEach((l, i) => push(l.jp, at(`.lines[${i}]`), { terms: l.terms }));
      push(sec.context, at('.context'));
      break;
    case 'reading':
      (sec.passage || []).forEach((p, i) => push(p.jp, at(`.passage[${i}]`), { terms: p.terms }));
      (sec.questions || []).forEach((q, i) => {
        push(q.q, at(`.questions[${i}].q`), { terms: q.terms });
        push(q.a, at(`.questions[${i}].a`), { terms: q.a_terms });
      });
      break;
    case 'drills':
      (sec.items || []).forEach((it, i) => {
        const kind = it.kind || 'mcq';
        if (kind === 'mcq') {
          push(it.q, at(`.items[${i}].q`), { terms: it.terms });
          push(it.answer, at(`.items[${i}].answer`));
          (it.choices || []).forEach((c, ci) =>
            push(c, at(`.items[${i}].choices[${ci}]`), { distractor: c !== it.answer }));
          push(it.explanation, at(`.items[${i}].explanation`));
        } else if (kind === 'scramble') {
          (it.segments || []).forEach((s, si2) => push(s, at(`.items[${i}].segments[${si2}]`)));
          (it.distractors || []).forEach((d, di) => push(d, at(`.items[${i}].distractors[${di}]`), { distractor: true }));
          (it.alts || []).forEach((alt, ai) => (alt || []).forEach((s, si2) => push(s, at(`.items[${i}].alts[${ai}][${si2}]`))));
          push(it.explanation, at(`.items[${i}].explanation`));
        }
      });
      break;

    // ── grammar sections ──
    case 'grammarIntro':
      push(sec.summary, at('.summary'));
      push(sec.whyItMatters, at('.whyItMatters'));
      (sec.youWillLearn || []).forEach((s, i) => push(s, at(`.youWillLearn[${i}]`)));
      break;
    case 'grammarRule':
      (sec.pattern || []).forEach((p, i) => push(p.text, at(`.pattern[${i}]`)));
      push(sec.meaning, at('.meaning'));
      push(sec.explanation, at('.explanation'));
      (sec.notes || []).forEach((n, i) => push(n, at(`.notes[${i}]`)));
      (sec.examples || []).forEach((ex, ei) => {
        (ex.parts || []).forEach((p, pi) => push(p.text, at(`.examples[${ei}].parts[${pi}]`)));
        push(ex.breakdown, at(`.examples[${ei}].breakdown`));
      });
      break;
    case 'grammarTable':
      push(sec.description, at('.description'));
      (sec.rows || []).forEach((r, ri) => {
        push(r.label, at(`.rows[${ri}].label`));
        (r.cells || []).forEach((c, ci) => push(c, at(`.rows[${ri}].cells[${ci}]`)));
        push(r.meaning, at(`.rows[${ri}].meaning`));
      });
      (Array.isArray(sec.notes) ? sec.notes : sec.notes ? [sec.notes] : [])
        .forEach((n, i) => push(n, at(`.notes[${i}]`)));
      break;
    case 'grammarComparison':
      (sec.items || []).forEach((it, ii) => {
        push(it.label, at(`.items[${ii}].label`));
        (it.points || []).forEach((p, pi) => push(p, at(`.items[${ii}].points[${pi}]`)));
        ((it.example && it.example.parts) || []).forEach((p, pi) =>
          push(p.text, at(`.items[${ii}].example.parts[${pi}]`)));
        push(it.example && it.example.en, null); // English — skipped by push (JP runs only anyway)
      });
      push(sec.tip, at('.tip'));
      break;
    case 'annotatedExample':
      (sec.examples || []).forEach((ex, ei) => {
        push(ex.context, at(`.examples[${ei}].context`));
        (ex.parts || []).forEach((p, pi) => push(p.text, at(`.examples[${ei}].parts[${pi}]`)));
        push(ex.note, at(`.examples[${ei}].note`));
      });
      break;
    case 'sentenceTransform':
      (sec.items || []).forEach((it, i) => {
        push(it.given, at(`.items[${i}].given`));
        push(it.answer, at(`.items[${i}].answer`));
        (it.choices || []).forEach((c, ci) => push(c, at(`.items[${i}].choices[${ci}]`), { distractor: c !== it.answer }));
        push(it.hint, at(`.items[${i}].hint`));
      });
      break;
    case 'conjugationDrill':
      (sec.items || []).forEach((it, i) => {
        push(it.verb, at(`.items[${i}].verb`));
        push(it.answer, at(`.items[${i}].answer`));
        (it.choices || []).forEach((c, ci) => push(c, at(`.items[${i}].choices[${ci}]`), { distractor: c !== it.answer }));
        push(it.hint, at(`.items[${i}].hint`));
      });
      break;
    case 'fillSlot':
      (sec.items || []).forEach((it, i) => {
        push(it.before, at(`.items[${i}].before`));
        push(it.after, at(`.items[${i}].after`));
        push(it.answer, at(`.items[${i}].answer`));
        (it.also_accept || []).forEach((c, ci) => push(c, at(`.items[${i}].also_accept[${ci}]`)));
        (it.choices || []).forEach((c, ci) => push(c, at(`.items[${i}].choices[${ci}]`), { distractor: c !== it.answer }));
        push(it.explanation, at(`.items[${i}].explanation`));
        push(it.translation, at(`.items[${i}].translation`));
      });
      break;
    case 'patternMatch':
      (sec.items || []).forEach((it, i) => {
        push(it.sentence, at(`.items[${i}].sentence`));
        push(it.explanation, at(`.items[${i}].explanation`));
      });
      break;

    // ── review game sections ──
    case 'speed_round':
      (sec.items || []).forEach((it, i) => {
        push(it.kanji, at(`.items[${i}].kanji`));
        push(it.answer, at(`.items[${i}].answer`));
        (it.choices || []).forEach((c, ci) => push(c, at(`.items[${i}].choices[${ci}]`), { distractor: c !== it.answer }));
      });
      break;
    case 'grammar_roulette':
      (sec.categories || []).forEach((cat, ci) => {
        push(cat.label, at(`.categories[${ci}].label`));
        (cat.items || []).forEach((it, i) => {
          push(it.q, at(`.categories[${ci}].items[${i}].q`));
          push(it.answer, at(`.categories[${ci}].items[${i}].answer`));
          (it.choices || []).forEach((c, xi) =>
            push(c, at(`.categories[${ci}].items[${i}].choices[${xi}]`), { distractor: c !== it.answer }));
          push(it.explanation, at(`.categories[${ci}].items[${i}].explanation`));
        });
      });
      break;
    case 'scramble_relay':
      (sec.items || []).forEach((it, i) => {
        (it.segments || []).forEach((s, si2) => push(s, at(`.items[${i}].segments[${si2}]`)));
        (it.distractors || []).forEach((d, di) => push(d, at(`.items[${i}].distractors[${di}]`), { distractor: true }));
        (it.alts || []).forEach((alt, ai) => (alt || []).forEach((s, si2) => push(s, at(`.items[${i}].alts[${ai}][${si2}]`))));
        push(it.explanation, at(`.items[${i}].explanation`));
      });
      break;
    case 'detective_reading':
      (sec.passages || []).forEach((p, pi) => {
        push(p.label, at(`.passages[${pi}].label`));
        (p.lines || []).forEach((l, li) => push(l.jp, at(`.passages[${pi}].lines[${li}]`), { terms: l.terms }));
      });
      (sec.questions || []).forEach((q, i) => {
        push(q.q, at(`.questions[${i}].q`));
        push(q.answer, at(`.questions[${i}].answer`));
        (q.choices || []).forEach((c, ci) => push(c, at(`.questions[${i}].choices[${ci}]`), { distractor: c !== q.answer }));
        push(q.explanation, at(`.questions[${i}].explanation`));
      });
      break;
    case 'match_pairs':
      (sec.pairs || []).forEach((p, i) => push(p.kanji, at(`.pairs[${i}].kanji`)));
      break;
    case 'vocab_categories':
      (sec.rounds || []).forEach((r, ri) =>
        (r.groups || []).forEach((g, gi) =>
          (g.words || []).forEach((w, wi) => push(w, at(`.rounds[${ri}].groups[${gi}].words[${wi}]`)))));
      break;
    case 'kanji_bingo':
      (sec.kanjiPool || []).forEach((k, i) => push(k.kanji, at(`.kanjiPool[${i}].kanji`)));
      break;
    default:
      // Unknown section type — scan any string fields one level deep so new
      // section types never silently bypass the gate.
      for (const [key, val] of Object.entries(sec)) {
        if (typeof val === 'string' && key !== 'type' && key !== 'title' && key !== 'id') {
          push(val, at('.' + key));
        }
      }
      break;
  }

  // Titles/instructions may carry JP (かいわ１…) — scan them too.
  ['title', 'instructions', 'header', 'lead'].forEach(k => {
    if (sec[k]) push(sec[k], at('.' + k));
  });
  return out;
}

// ── Term-ref helpers ─────────────────────────────────────────────────────────
// Resolve a term ref to the entry + the display surfaces the runtime can match
// (surface, reading fallback, matches[] alternates). Mirrors processText.
function resolveTermRef(ref) {
  if (typeof ref === 'string') {
    const e = idIdx.get(ref);
    if (!e) return { ok: false, ref, reason: 'unknown-id' };
    const surfaces = [e.surface || e.particle, e.reading, ...(e.matches || [])].filter(Boolean);
    return { ok: true, entry: e, surfaces, id: ref };
  }
  if (ref && typeof ref === 'object' && ref.id && (ref.form || ref.form === null)) {
    const root = idIdx.get(ref.id);
    if (!root) return { ok: false, ref: ref.id, reason: 'unknown-id' };
    const ruleKey = ref.form !== null ? ref.form : 'masu_stem';
    if (ref.form !== null && !CONJUGATION_RULES[ruleKey]) {
      return { ok: false, ref: `${ref.id}#${ruleKey}`, reason: 'unknown-form' };
    }
    let conj = null;
    try { conj = conjugate(root, ruleKey, CONJUGATION_RULES); } catch { /* ignore */ }
    const surfaces = conj ? [conj.surface, conj.reading].filter(Boolean) : [];
    return { ok: true, entry: root, surfaces, id: ref.id, form: ruleKey };
  }
  if (ref && typeof ref === 'object' && ref.counter !== undefined) {
    const term = buildCounterTerm(ref.counter, ref.n, COUNTER_RULES);
    if (!term) return { ok: false, ref: `counter:${ref.counter}#${ref.n}`, reason: 'unknown-counter' };
    return { ok: true, entry: term, surfaces: [term.surface, term.reading].filter(Boolean), counter: true };
  }
  return { ok: false, ref: JSON.stringify(ref), reason: 'bad-shape' };
}

// ── Per-file QA ──────────────────────────────────────────────────────────────
function emptyV() {
  const v = {};
  for (const b of [...HARD_BUCKETS, ...WARN_BUCKETS]) v[b] = [];
  return v;
}

function scopeCheckRun(run, where, ceiling, ceilingLabel, v, opts = {}) {
  const tokens = tokenizeText(run, surfaceIdx, { ceiling: ceilingLabel });
  for (const t of tokens) {
    const c = classifyToken(t);
    if (c.kind === 'untagged') {
      // Kana-only distractor words soften to DISTRACTOR; everything else is
      // an unglossaried content token (warn).
      const bucket = opts.distractor && !HAS_CJK_CHAR.test(c.k) ? 'distractor' : 'unglossaried';
      v[bucket].push({ where, k: c.k });
      continue;
    }
    const entry = c.entry;
    if (!entry) continue;
    if (storyVocabIds.has(entry.id)) {
      v.storyLeak.push({ where, k: t.k, id: entry.id });
      continue;
    }
    if (entry.particle || (entry.id && String(entry.id).startsWith('p_'))) {
      const lid = parseLessonId(entry.introducedIn);
      if (lid && !inScope(lid, ceiling)) {
        const bucket = opts.distractor ? 'distractor' : 'particle';
        v[bucket].push({ where, k: t.k, id: entry.id, intro: entry.introducedIn });
      }
      continue;
    }
    if (entry.type === 'character') continue;
    if (entry.type === 'inflected') {
      const f = synthFormScope(entry, ceiling);
      if (f && f.violation) {
        // Exactly one lesson ahead at the same level = the form is taught by
        // the grammar point sitting BETWEEN ceiling and intro (introducedIn
        // can only name lessons). Warn, don't fail.
        const edge = f.intro && ceiling && f.intro.lvl === ceiling.lvl && f.intro.idx === ceiling.idx + 1;
        v[edge ? 'formEdge' : 'form'].push({ where, k: t.k, form: f.formKey, intro: CONJUGATION_RULES[f.formKey]?.introducedIn });
      }
      const root = idIdx.get(entry.original_id);
      if (root) {
        const rid = entryLessonId(root);
        if (rid && !inScope(rid, ceiling)) {
          const bucket = opts.distractor && !HAS_CJK_CHAR.test(t.k) ? 'distractor' : 'vocab';
          v[bucket].push({ where, k: t.k, id: root.id, lesson: root.lesson_ids || root.lesson });
        }
      }
      continue;
    }
    const lid = entryLessonId(entry);
    if (lid && !inScope(lid, ceiling)) {
      const bucket = opts.distractor && !HAS_CJK_CHAR.test(t.k) ? 'distractor' : 'vocab';
      v[bucket].push({ where, k: t.k, id: entry.id, lesson: entry.lesson_ids || entry.lesson });
    }
  }
  // Story-vocab surface belt-and-braces: the pool isn't in surfaceIdx, so its
  // words come out untagged — catch them by surface too.
  for (const [surf, id] of storyVocabSurfaces) {
    if (surf.length >= 2 && run.includes(surf)) {
      // Only flag if the run doesn't resolve that span to a real entry.
      const covered = tokens.some(t => t.k === surf && classifyToken(t).entry);
      if (!covered) v.unglossaried.push({ where, k: surf, note: 'also-in-story-pool:' + id });
    }
  }
}

// Chip-coverage: emulate processText span-marking, then flag content residue.
function chipCoverage(text, terms, where, v) {
  if (!text || !Array.isArray(terms) || !terms.length) return;
  const resolved = [];
  for (const ref of terms) {
    const r = resolveTermRef(ref);
    if (r.ok) resolved.push(r);
  }
  // Longest-first marking with the runtime's single-char lookahead rule and
  // its tiebreak: same length → kana-only (particles) before kanji-bearing,
  // so a wrapped particle stops the kanji's no-kana-follows lookahead failing.
  const candidates = [];
  for (const r of resolved) for (const s of r.surfaces) candidates.push(s);
  const isKanaOnly = s => !/[一-鿿㐀-䶿]/.test(s);
  candidates.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    const ak = isKanaOnly(a), bk = isKanaOnly(b);
    if (ak !== bk) return ak ? -1 : 1;
    return 0;
  });
  let marked = text;
  for (const s of candidates) {
    if (!s || !marked.includes(s)) continue;
    if (s.length === 1) {
      const esc = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      marked = marked.replace(new RegExp(esc + '(?![\\u3040-\\u30FF])', 'g'), ' ');
    } else {
      marked = marked.split(s).join(' ');
    }
  }
  for (const run of jpRuns(marked)) {
    for (const t of tokenizeText(run, surfaceIdx)) {
      const c = classifyToken(t);
      if (c.kind === 'punct' || c.kind === 'empty' || c.kind === 'bare-kana') continue;
      if (c.kind === 'untagged' && !HAS_CJK_CHAR.test(t.k) && t.k.length < 2) continue;
      if (c.entry && c.entry.type === 'character') continue;
      // A resolvable content word (or CJK-bearing anything) with no chip.
      if (HAS_CJK_CHAR.test(t.k) || t.k.length >= 2) {
        v.chipCoverage.push({ where, k: t.k, id: c.entry ? c.entry.id : '' });
      }
    }
  }
}

// Mis-chipped homograph particles: the renderer wraps EVERY occurrence of an
// authored particle's surface with that one id, with no context resolution
// (unlike stories). For each hazard surface authored in `terms`, resolve each
// occurrence in the tokenized sentence with the runtime's own resolver and
// flag occurrences whose sense isn't among the authored ids (e.g. a quoting
// と in a line whose only と ref is p_to "and" — the chip would gloss the
// wrong sense).
// Punctuation-preserving runs — the resolver's rules key on 、。」 neighbours.
const JP_RUN_PUNCT = /[぀-ヿ一-鿿㐀-䶿々〆ー、。！？「」『』：；・…]+/g;
// Each hazard's context-blind fallback sense: the resolver returns these when
// it CAN'T tell (e.g. conditional と). Only a non-default (confident) verdict
// may contradict the authored id — the author often knows what the resolver
// can't distinguish.
const DEFAULT_SENSE = { 'でも': 'p_demo', 'と': 'p_to', 'から': 'p_kara', 'が': 'p_ga', 'の': 'p_no', 'では': 'p_dewa', 'そうだ': 'p_sou_da' };

function particleSenseCheck(text, terms, where, v) {
  if (!text || !Array.isArray(terms) || !terms.length) return;
  const authoredBySurface = new Map();   // surface -> Set(authored particle ids)
  for (const ref of terms) {
    if (typeof ref !== 'string') continue;
    const e = idIdx.get(ref);
    if (!e || e.type !== 'particle') continue;
    const surf = e.surface || e.particle;
    if (!surf || !PS.isHazard(surf) || !PS.hasRule(surf)) continue;
    if (!authoredBySurface.has(surf)) authoredBySurface.set(surf, new Set());
    authoredBySurface.get(surf).add(ref);
  }
  if (!authoredBySurface.size) return;
  for (const run of (text.match(JP_RUN_PUNCT) || [])) {
    // A run that starts mid-sentence (after an MCQ blank ______ or English) is
    // NOT a sentence start — only trust position when the run opens the text.
    const runOpensText = text.trimStart().startsWith(run);
    const toks = tokenizeText(run, surfaceIdx);
    toks.forEach((t, i) => {
      const k = t && t.k;
      if (!k || !authoredBySurface.has(k)) return;
      const prevK = i > 0 ? (toks[i - 1].k || '') : '';
      const nextK = i + 1 < toks.length ? (toks[i + 1].k || '') : '';
      const atSentenceStart = (i === 0 && runOpensText) || SENTENCE_ENDERS.has(prevK);
      const expected = PS.resolveParticleSense(k, { prevK, nextK, atSentenceStart });
      if (!expected || expected === DEFAULT_SENSE[k]) return;   // fallback verdicts can't overrule the author
      // The runtime resolver's PREDICATE_RE is loose (any つ/う/い-final kana
      // matches, so nouns like いつ/ほう trip it). For flagging purposes only
      // trust because/but verdicts behind an unambiguous predicate ending.
      if ((expected === 'p_kara_because' || expected === 'p_ga_but') &&
          !/(です|ます|ました|でした|ません|ない|なかった|だった|ている|ていた)$/.test(prevK)) return;
      const authored = authoredBySurface.get(k);
      if (!authored.has(expected)) {
        const at = Math.max(0, run.indexOf(k) - 12);
        v.particleSense.push({ where, k, authored: [...authored].join('+'), expected, sample: run.slice(at, at + 28) });
      }
    });
  }
}

async function qaFile(kind, level, file) {
  const p = path.join(ROOT, 'data', level, kind, file);
  const doc = JSON.parse(await fs.readFile(p, 'utf8'));
  const id = doc.id || file.replace(/\.json$/, '');
  const relPath = `data/${level}/${kind}/${file}`;
  let ceiling = resolveCeiling(kind, id, doc);

  // Grammar files also declare meta.unlocksAfter. Compare RESOLVED lesson
  // ceilings (meta often names the lesson directly while the manifest chains
  // through prior grammar — usually the same lesson). If they genuinely
  // differ, gate at the LATER one: unlock truth is the manifest, but an
  // author-declared later window means the content assumes it.
  if (kind === 'grammar' && doc.meta && doc.meta.unlocksAfter) {
    const metaCeiling = parseLessonId(doc.meta.unlocksAfter);
    if (metaCeiling && ceiling && !inScope(metaCeiling, ceiling)) {
      console.error(`  ⚠ ${id}: manifest chain resolves to ${ceiling.lvl}.${ceiling.idx}, meta.unlocksAfter=${doc.meta.unlocksAfter} — gating at the later (meta).`);
      ceiling = metaCeiling;
    }
  }

  const ceilingLabel = ceiling ? `${ceiling.lvl}.${ceiling.idx}` : null;
  const taughtKanji = buildTaughtKanji(ceiling);
  const v = emptyV();

  const extracted = [];
  (doc.sections || []).forEach((sec, si) => extracted.push(...extractSection(sec, si)));
  // Grammar top-level targetVocab: id refs.
  (doc.targetVocab || []).forEach((tid, i) => extracted.push({ idRef: tid, where: `targetVocab[${i}]` }));

  const seenKanji = new Set();
  for (const item of extracted) {
    // Pure id refs (vocabList groups, targetVocab)
    if (item.idRef !== undefined) {
      const r = resolveTermRef(item.idRef);
      if (!r.ok) { v.unknownId.push({ where: item.where, ref: r.ref, reason: r.reason }); continue; }
      if (storyVocabIds.has(r.id)) { v.storyLeak.push({ where: item.where, id: r.id }); continue; }
      const lid = entryLessonId(r.entry);
      if (lid && !inScope(lid, ceiling)) {
        v.vocab.push({ where: item.where, k: r.entry.surface || '', id: r.id, lesson: r.entry.lesson_ids || r.entry.lesson });
      }
      continue;
    }

    const { text, terms, where, distractor } = item;

    // 1) Kanji gate — every displayed CJK char must already be taught.
    // 々 (iteration mark) rides its base kanji (人々 = taught 人) — always ok.
    for (const ch of text) {
      if (ch === '々') continue;
      if (HAS_CJK_CHAR.test(ch) && !seenKanji.has(ch)) {
        seenKanji.add(ch);
        if (!taughtKanji.has(ch)) {
          v.kanji.push({ ch, where, sample: text.slice(0, 36) });
        }
      }
    }

    // 2) Vocab/particle/form scope on each JP run.
    for (const run of jpRuns(text)) {
      scopeCheckRun(run, where, ceiling, ceilingLabel, v, { distractor });
    }

    // 3) Terms array integrity + scope + chip coverage.
    if (Array.isArray(terms)) {
      for (const ref of terms) {
        const r = resolveTermRef(ref);
        if (!r.ok) { v.unknownId.push({ where, ref: r.ref, reason: r.reason }); continue; }
        if (storyVocabIds.has(r.id)) { v.storyLeak.push({ where, id: r.id }); continue; }
        if (r.form) {
          const rule = CONJUGATION_RULES[r.form];
          const intro = rule && parseLessonId(rule.introducedIn);
          if (intro && !inScope(intro, ceiling)) {
            const edge = ceiling && intro.lvl === ceiling.lvl && intro.idx === ceiling.idx + 1;
            v[edge ? 'formEdge' : 'form'].push({ where, k: r.surfaces[0] || '', form: r.form, intro: rule.introducedIn });
          }
        }
        if (!r.counter) {
          const lid = entryLessonId(r.entry);
          if (lid && !inScope(lid, ceiling)) {
            v.vocab.push({ where, k: r.entry.surface || r.entry.particle || '', id: r.id, lesson: r.entry.lesson_ids || r.entry.lesson });
          }
        }
      }
      chipCoverage(text, terms, where, v);
      particleSenseCheck(text, terms, where, v);
    }
  }

  return { id, kind, level, file: relPath, ceiling: ceilingLabel, violations: v };
}

// ── Baseline ─────────────────────────────────────────────────────────────────
const BASELINE_PATH = path.join(ROOT, 'scripts/qa-content-baseline.json');

function fingerprint(file, bucket, f) {
  const key = f.ch || f.k || f.ref || f.id || '';
  const sub = f.id || f.form || f.lesson || f.reason || '';
  return `${file}|${bucket}|${key}|${sub}`;
}

async function loadBaseline() {
  try {
    const j = JSON.parse(await fs.readFile(BASELINE_PATH, 'utf8'));
    return new Set(j.accepted || []);
  } catch { return new Set(); }
}

// ── Report ───────────────────────────────────────────────────────────────────
function table(rows, cols) {
  if (!rows.length) return '  (none)\n';
  const widths = cols.map(c => Math.max(c.length, ...rows.map(r => String(r[c] ?? '').length)));
  const fmt = r => '  ' + cols.map((c, i) => String(r[c] ?? '').padEnd(widths[i])).join('  ');
  const header = '  ' + cols.map((c, i) => c.padEnd(widths[i])).join('  ');
  const sep = '  ' + cols.map((_, i) => '-'.repeat(widths[i])).join('  ');
  return [header, sep, ...rows.map(fmt)].join('\n') + '\n';
}
function dedupe(rows, keyFn) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const k = keyFn(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

const BUCKET_LABELS = {
  kanji: 'UNTAUGHT KANJI', vocab: 'UNTAUGHT VOCAB', particle: 'UNTAUGHT PARTICLES',
  form: 'UNTAUGHT FORMS', unknownId: 'UNKNOWN TERM IDS', storyLeak: 'STORY-VOCAB LEAKS', particleSense: 'MIS-CHIPPED PARTICLE SENSE',
  unglossaried: 'UNGLOSSARIED (warn)', chipCoverage: 'CHIP COVERAGE (warn)', distractor: 'UNTAUGHT DISTRACTORS (warn)', formEdge: 'FORM ONE-LESSON-EDGE (warn)'
};
const BUCKET_COLS = {
  kanji: ['ch', 'where', 'sample'],
  vocab: ['k', 'id', 'lesson', 'where'],
  particle: ['k', 'id', 'intro', 'where'],
  form: ['k', 'form', 'intro', 'where'],
  unknownId: ['ref', 'reason', 'where'],
  storyLeak: ['k', 'id', 'where'],
  particleSense: ['k', 'authored', 'expected', 'sample', 'where'],
  unglossaried: ['k', 'where'],
  chipCoverage: ['k', 'id', 'where'],
  distractor: ['k', 'where'],
  formEdge: ['k', 'form', 'intro', 'where']
};
const BUCKET_KEY = {
  kanji: f => f.ch, vocab: f => f.id, particle: f => f.id, form: f => f.form,
  unknownId: f => f.ref, storyLeak: f => f.id, particleSense: f => f.k + '|' + f.authored + '|' + f.expected, unglossaried: f => f.k,
  chipCoverage: f => f.k, distractor: f => f.k, formEdge: f => f.form
};

// ── Main ─────────────────────────────────────────────────────────────────────
const baseline = flags.strict ? new Set() : await loadBaseline();

const targets = [];
for (const level of LEVELS) {
  for (const kind of KINDS) {
    const dir = path.join(ROOT, 'data', level, kind);
    let files;
    try { files = (await fs.readdir(dir)).filter(f => f.endsWith('.json')); } catch { continue; }
    for (const f of files) {
      const id = f.replace(/\.json$/, '');
      if (ONLY && !ONLY.includes(id)) continue;
      targets.push({ kind, level, file: f });
    }
  }
}

if (!targets.length) {
  console.error('no matching content files (check --level/--kind/--only)');
  process.exit(2);
}

const allResults = [];
const allFingerprints = [];
let newHard = 0, newWarn = 0, baselined = 0;

for (const t of targets) {
  const r = await qaFile(t.kind, t.level, t.file);
  // Split findings into new vs baselined.
  const fresh = emptyV();
  for (const bucket of Object.keys(r.violations)) {
    for (const f of r.violations[bucket]) {
      const fp = fingerprint(r.file, bucket, f);
      allFingerprints.push(fp);
      if (baseline.has(fp)) { baselined++; continue; }
      fresh[bucket].push(f);
      if (HARD_BUCKETS.includes(bucket)) newHard++; else newWarn++;
    }
  }
  r.fresh = fresh;
  allResults.push(r);
}

if (flags['update-baseline']) {
  const accepted = [...new Set(allFingerprints)].sort();
  await fs.writeFile(BASELINE_PATH, JSON.stringify({
    note: 'Accepted qa-content findings. Regenerate with --update-baseline after triage; NEVER add hard-bucket regressions here without review.',
    updated: new Date().toISOString().slice(0, 10),
    accepted
  }, null, 2) + '\n');
  console.log(`baseline updated: ${accepted.length} accepted fingerprints → ${path.relative(ROOT, BASELINE_PATH)}`);
  process.exit(0);
}

if (flags.json) {
  console.log(JSON.stringify(allResults.map(r => ({
    id: r.id, kind: r.kind, level: r.level, file: r.file, ceiling: r.ceiling,
    findings: r.fresh
  })), null, 2));
} else {
  for (const r of allResults) {
    const counts = Object.values(r.fresh).reduce((n, a) => n + a.length, 0);
    if (!counts) continue;
    const hard = HARD_BUCKETS.reduce((n, b) => n + r.fresh[b].length, 0);
    console.log(`\n${hard ? '✗' : '⚠'} ${r.id}  (${r.kind}/${r.level}, ceiling=${r.ceiling || '—'})`);
    for (const bucket of [...HARD_BUCKETS, ...WARN_BUCKETS]) {
      if (BUCKET_FILTER && !BUCKET_FILTER.has(bucket)) continue;
      const rows = r.fresh[bucket];
      if (!rows.length) continue;
      console.log(`\n  ${BUCKET_LABELS[bucket]} (${rows.length}):`);
      process.stdout.write(table(dedupe(rows, BUCKET_KEY[bucket]).slice(0, 40), BUCKET_COLS[bucket]));
    }
  }
}

const filesWithNew = allResults.filter(r => Object.values(r.fresh).some(a => a.length)).length;
// Summary goes to stderr in --json mode so stdout stays parseable.
(flags.json ? console.error : console.log)(
  `\n${targets.length} file(s) checked · ${filesWithNew} with new findings · ` +
  `${newHard} new hard, ${newWarn} new warn, ${baselined} baselined.`);

const failOnWarn = !!flags.warns;
process.exit(newHard || (failOnWarn && newWarn) ? 1 : 0);

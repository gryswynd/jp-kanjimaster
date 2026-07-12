#!/usr/bin/env node
/**
 * scripts/qa-story.mjs
 *
 * Agent 3 (QA) — mechanical per-story scope + tagging checker.
 *
 * Hooks + validator catch structure errors (tokens reconstruct, ids resolve).
 * This tool catches the *content* errors that slipped through the N4 expansion
 * pipeline: untaught vocab on a too-early story, conjugation forms beyond the
 * story's window ceiling, untagged content tokens, and kanji not yet taught.
 *
 * Per story, for the unlocksAfter window:
 *   1. UNTAGGED — content tokens (CJK or kana word) with no g AND no
 *      surface-index resolution. Renders as flat text.
 *   2. OUT-OF-SCOPE VOCAB — token's resolved entry has lesson_ids > ceiling.
 *   3. OUT-OF-SCOPE PARTICLE — particle introducedIn > ceiling.
 *   4. OUT-OF-SCOPE FORM — conjugated synth's form introducedIn > ceiling.
 *   5. OUT-OF-SCOPE KANJI — kanji char in narration not yet in cumulative
 *      taught set (N5 all + N4.1..ceiling.idx).
 *
 * Usage:
 *   node scripts/qa-story.mjs <slug>          # one story
 *   node scripts/qa-story.mjs --level=N4      # every N4 story
 *   node scripts/qa-story.mjs --all           # every story across levels
 *
 * Exit code: 0 if no violations, 1 otherwise.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildGlossaryIndex, tokenizeText } from './lib/tokenize.mjs';
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
const positional = args.filter(a => !a.startsWith('--'));

// ── Lesson-id parsing + ordering ─────────────────────────────────────────────
// parseLessonId / inScope / buildTaughtKanji / entryLessonId / synthFormScope /
// classifyToken now live in scripts/lib/scope.mjs, shared with qa-content.mjs.

// ── Manifest data ────────────────────────────────────────────────────────────
const MANIFEST = JSON.parse(await fs.readFile(path.join(ROOT, 'manifest.json'), 'utf8'));

function getStoryMeta(slug) {
  for (const lvl of ['N5', 'N4', 'N3', 'custom']) {
    const data = MANIFEST.data && MANIFEST.data[lvl];
    if (!data) continue;
    for (const s of data.stories || []) {
      if (s.id === slug) return { ...s, level: lvl };
    }
  }
  return null;
}

function listStories({ level, all }) {
  const out = [];
  const levels = all ? ['N5', 'N4', 'N3', 'custom'] : (level ? [level] : []);
  for (const lvl of levels) {
    const data = MANIFEST.data && MANIFEST.data[lvl];
    if (!data) continue;
    for (const s of data.stories || []) out.push({ slug: s.id, level: lvl });
  }
  return out;
}

// ── Audiostory registry (data/audiostories.index.json, NOT in the manifest) ──
const AUDIO_INDEX = JSON.parse(
  await fs.readFile(path.join(ROOT, 'data/audiostories.index.json'), 'utf8')
);
function getAudioMeta(slug) {
  const e = (AUDIO_INDEX.audiostories || []).find(a => a.id === slug);
  if (!e) return null;
  const level = e.level || (e.dir ? e.dir.split('/')[1] : null);   // dir = data/<lvl>/audiostories/<slug>
  return { slug, level, unlocksAfter: e.unlocksAfter || null, dir: e.dir, file: e.file || 'audiostory.json' };
}
function listAudiostories({ level } = {}) {
  return (AUDIO_INDEX.audiostories || [])
    .map(a => ({ slug: a.id, level: a.level || (a.dir ? a.dir.split('/')[1] : null) }))
    .filter(t => !level || t.level === level);
}
// Empty violations shape (so printReport never dereferences undefined on errors).
function emptyV() {
  return { untagged: [], vocab: [], particle: [], form: [], kanji: [], unknownId: [], split: [], orthography: [] };
}

// Cumulative kanji taught through ceiling (N5 all + N4.1..idx if ceiling is N4).
const buildTaughtKanji = (ceiling) => buildTaughtKanjiFrom(MANIFEST, ceiling);

// ── Build glossary index + reverse id-map ────────────────────────────────────
const GLOSSARY_PATHS = [
  path.join(ROOT, 'data/N5/glossary.N5.json'),
  path.join(ROOT, 'data/N4/glossary.N4.json'),
  path.join(ROOT, 'data/N3/glossary.N3.json'),
  path.join(ROOT, 'shared/particles.json'),
  path.join(ROOT, 'shared/characters.json'),
  path.join(ROOT, 'shared/loanwords.json')
];
const CONJUGATION_RULES = JSON.parse(
  await fs.readFile(path.join(ROOT, 'conjugation_rules.json'), 'utf8')
);
const COUNTER_RULES = JSON.parse(
  await fs.readFile(path.join(ROOT, 'counter_rules.json'), 'utf8')
);

const surfaceIdx = await buildGlossaryIndex(
  GLOSSARY_PATHS,
  (p, enc) => fs.readFile(p, enc),
  { includeReadings: true, conjugationRules: CONJUGATION_RULES, counterRules: COUNTER_RULES }
);

// Build a reverse id→entry map so we can resolve token.g lookups.
const idIdx = new Map();
for (const [, e] of surfaceIdx) {
  if (e && e.id && !idIdx.has(e.id)) idIdx.set(e.id, e);
}
// ALSO index every raw glossary entry by id: homograph "losers" that share a
// surface with another entry (v_me_ordinal vs v_me on 目) never occupy a
// surface slot, but suffix rules / hand tags may still reference them by id.
for (const p of GLOSSARY_PATHS) {
  let data;
  try { data = JSON.parse(await fs.readFile(p, 'utf8')); } catch { continue; }
  for (const e of (data.entries || [])) {
    if (e && e.id && e.type !== 'kanji' && !idIdx.has(e.id)) idIdx.set(e.id, e);
  }
}
// Particles also have an `id` but their surface is keyed under `particle`.
// They're already in surfaceIdx via the buildGlossaryIndex particle branch.

// ── Per-token classification (shared classifier bound to this index) ────────
const classifyToken = makeClassifyToken({ surfaceIdx, idIdx });
const synthFormScope = (entry, ceiling) => synthFormScopeWith(entry, ceiling, CONJUGATION_RULES);

// ── Per-story QA pass ────────────────────────────────────────────────────────
async function qaStory(slug, opts = {}) {
  const isAudio = !!opts.audiostory;
  const meta = isAudio ? getAudioMeta(slug) : getStoryMeta(slug);
  if (!meta) {
    console.error(`[qa] ${slug} not in ${isAudio ? 'audiostories.index.json' : 'manifest'}`);
    return { slug, ok: false, error: 'not-found', violations: emptyV() };
  }
  const docPath = isAudio
    ? path.join(ROOT, meta.dir, meta.file)
    : path.join(ROOT, 'data', meta.level, 'stories', slug, 'story.json');
  let story;
  try {
    story = JSON.parse(await fs.readFile(docPath, 'utf8'));
  } catch (e) {
    console.error(`[qa] cannot read ${docPath}: ${e.message}`);
    return { slug, ok: false, error: 'read-failed', violations: emptyV() };
  }
  // Audiostories always gate to a lesson (unlocksAfter = N5.2, N5.4, …). Custom
  // (paid) stories have no unlocksAfter — they rank at N4 end (mirrors
  // audit-story-vocab.mjs); without this ceiling is null and EVERY scope check
  // silently passes, which is how untaught kanji slipped into paid content.
  const ceiling = (!isAudio && meta.level === 'custom')
    ? { lvl: 'N4', idx: Number.MAX_SAFE_INTEGER }
    : parseLessonId(meta.unlocksAfter || story.unlocksAfter);
  const taughtKanji = buildTaughtKanji(ceiling);

  const violations = {
    untagged: [],
    vocab: [],
    particle: [],
    form: [],
    kanji: [],
    unknownId: [],
    split: [],        // kana grammatical unit rendered as raw particle chips (とき→と+き)
    orthography: []   // same word written both kanji and kana within the story
  };

  // Walk every kanji char in narration ONCE per char (dedupe per story to
  // keep the report short — repeats are obvious from context).
  const seenKanji = new Set();
  for (const p of story.paragraphs || []) {
    for (const ch of p.jp || '') {
      if (/[一-鿿㐀-䶿]/.test(ch) && !seenKanji.has(ch)) {
        seenKanji.add(ch);
        if (!taughtKanji.has(ch)) {
          violations.kanji.push({ ch, paragraph: p.jp.slice(0, 40) + '…' });
        }
      }
    }
  }

  // Walk tokens.
  story.paragraphs.forEach((p, pi) => {
    for (const t of p.tokens || []) {
      const c = classifyToken(t);
      if (c.kind === 'untagged') {
        violations.untagged.push({ p: pi + 1, k: c.k });
        continue;
      }
      if (c.kind === 'g-unknown') {
        violations.unknownId.push({ p: pi + 1, g: c.g, k: t.k });
        continue;
      }
      const entry = c.entry;
      if (!entry) continue;

      // Particle scope
      if (entry.particle || (entry.id && entry.id.startsWith('p_'))) {
        const lid = parseLessonId(entry.introducedIn);
        if (lid && !inScope(lid, ceiling)) {
          violations.particle.push({
            p: pi + 1, k: t.k, id: entry.id,
            intro: entry.introducedIn, ceiling: meta.unlocksAfter
          });
        }
        continue;
      }

      // Character — no scope check (characters appear in their first story).
      if (entry.type === 'character') continue;

      // Inflected synth form scope
      if (entry.type === 'inflected') {
        const f = synthFormScope(entry, ceiling);
        if (f && f.violation) {
          violations.form.push({
            p: pi + 1, k: t.k, id: entry.id, form: f.formKey,
            intro: CONJUGATION_RULES[f.formKey]?.introducedIn,
            ceiling: meta.unlocksAfter
          });
        }
        // Also check the root entry's lesson scope
        const root = idIdx.get(entry.original_id);
        if (root) {
          const rid = entryLessonId(root);
          if (rid && !inScope(rid, ceiling)) {
            violations.vocab.push({
              p: pi + 1, k: t.k, id: root.id,
              lesson: root.lesson_ids || root.lesson,
              ceiling: meta.unlocksAfter
            });
          }
        }
        continue;
      }

      // Vocab / kanji entry scope
      const lid = entryLessonId(entry);
      if (lid && !inScope(lid, ceiling)) {
        violations.vocab.push({
          p: pi + 1, k: t.k, id: entry.id,
          lesson: entry.lesson_ids || entry.lesson,
          ceiling: meta.unlocksAfter
        });
      }
    }
  });

  // Comprehension questions are shown to the learner too — gate their kanji the
  // same way (this block was previously unchecked, letting 本当/最後/段落/選 in).
  const seenQKanji = new Set();
  for (const q of (story.comprehension && story.comprehension.questions) || []) {
    for (const field of ['q', 'answer', 'explanation']) {
      const txt = q[field] || '';
      for (const ch of txt) {
        if (/[一-鿿㐀-䶿]/.test(ch) && !seenQKanji.has(ch)) {
          seenQKanji.add(ch);
          if (!taughtKanji.has(ch)) {
            violations.kanji.push({ ch, paragraph: `[Q.${field}] ${txt.slice(0, 30)}…` });
          }
        }
      }
    }
  }

  // Spoken comprehension question `q` is audio content — gate its vocab/particle/
  // FORM scope too (live-tokenized; mirrors the paragraph-token scope above).
  for (const q of (story.comprehension && story.comprehension.questions) || []) {
    for (const t of tokenizeText(q.q || '', surfaceIdx)) {
      const c = classifyToken(t);
      const entry = c.entry;
      if (!entry) continue;
      if (entry.particle || (entry.id && String(entry.id).startsWith('p_'))) {
        const lid = parseLessonId(entry.introducedIn);
        if (lid && !inScope(lid, ceiling)) violations.particle.push({ p: 'Q', k: t.k, id: entry.id, intro: entry.introducedIn, ceiling: meta.unlocksAfter });
        continue;
      }
      if (entry.type === 'character') continue;
      if (entry.type === 'inflected') {
        const f = synthFormScope(entry, ceiling);
        if (f && f.violation) violations.form.push({ p: 'Q', k: t.k, id: entry.id, form: f.formKey, intro: CONJUGATION_RULES[f.formKey]?.introducedIn, ceiling: meta.unlocksAfter });
        const root = idIdx.get(entry.original_id);
        if (root) { const rid = entryLessonId(root); if (rid && !inScope(rid, ceiling)) violations.vocab.push({ p: 'Q', k: t.k, id: root.id, lesson: root.lesson_ids || root.lesson, ceiling: meta.unlocksAfter }); }
        continue;
      }
      const lid = entryLessonId(entry);
      if (lid && !inScope(lid, ceiling)) violations.vocab.push({ p: 'Q', k: t.k, id: entry.id, lesson: entry.lesson_ids || entry.lesson, ceiling: meta.unlocksAfter });
    }
  }

  // Kana grammatical units that must NOT render as raw particle chips. とき→時 /
  // もの→物 (taught kanji); counter+とも ("both") splits to と+も (misleading).
  const SPLIT_UNITS = { 'とき': 'use 時', 'もの': 'use 物' };
  const isCounter = (t) =>
    !!t && ((t.g && String(t.g).startsWith('count_')) || /(?:人|つ|本|個|回|匹|台)$/.test(t.k || ''));
  story.paragraphs.forEach((p, pi) => {
    const ts = p.tokens || [];
    for (let j = 0; j < ts.length - 1; j++) {
      const a = ts[j], b = ts[j + 1];
      if ((a.k || '').length !== 1 || (b.k || '').length !== 1) continue;
      const two = (a.k || '') + (b.k || '');
      if (SPLIT_UNITS[two] && !a.g && !b.g) {
        violations.split.push({ p: pi + 1, k: two, fix: SPLIT_UNITS[two] });
      } else if (two === 'とも' && !a.g && !b.g && isCounter(ts[j - 1])) {
        violations.split.push({ p: pi + 1, k: (ts[j - 1].k || '') + 'とも', fix: 'reword (…も…も / は)' });
      }
    }
  });

  // Orthography consistency: a standalone word written both kanji and kana in the
  // same story. Curated to words that genuinely should be one form; nominalizers
  // (こと/ところ) and compounds (事/所) are excluded — they legitimately differ.
  const PAIRS = [['次', 'つぎ'], ['時', 'とき']];
  const allText = (story.paragraphs || []).map(p => p.jp || '').join('') +
    ((story.comprehension && story.comprehension.questions) || [])
      .map(q => [q.q, q.answer, q.explanation].join('')).join('');
  for (const [kj, kn] of PAIRS) {
    if (allText.includes(kj) && allText.includes(kn)) {
      violations.orthography.push({ pair: kj + '/' + kn });
    }
  }

  return {
    slug,
    level: meta.level,
    unlocksAfter: meta.unlocksAfter,
    violations,
    ok:
      violations.untagged.length === 0 &&
      violations.vocab.length === 0 &&
      violations.particle.length === 0 &&
      violations.form.length === 0 &&
      violations.kanji.length === 0 &&
      violations.unknownId.length === 0 &&
      violations.split.length === 0 &&
      violations.orthography.length === 0
  };
}

// ── Report formatting ────────────────────────────────────────────────────────
function table(rows, cols) {
  if (!rows.length) return '  (none)\n';
  const widths = cols.map(c => Math.max(c.length, ...rows.map(r => String(r[c] ?? '').length)));
  const fmt = r => '  ' + cols.map((c, i) => String(r[c] ?? '').padEnd(widths[i])).join('  ');
  const header = '  ' + cols.map((c, i) => c.padEnd(widths[i])).join('  ');
  const sep = '  ' + cols.map((_, i) => '-'.repeat(widths[i])).join('  ');
  return [header, sep, ...rows.map(fmt)].join('\n') + '\n';
}

function printReport(r) {
  const star = r.ok ? '✓' : '✗';
  console.log(`\n${star} ${r.slug}  (${r.level}, unlocksAfter=${r.unlocksAfter || '—'})`);
  const v = r.violations;
  if (v.untagged.length) {
    console.log(`\n  UNTAGGED tokens (${v.untagged.length}):`);
    process.stdout.write(table(dedupe(v.untagged, t => t.k), ['p', 'k']));
  }
  if (v.unknownId.length) {
    console.log(`\n  UNKNOWN IDs (${v.unknownId.length}):`);
    process.stdout.write(table(v.unknownId, ['p', 'k', 'g']));
  }
  if (v.vocab.length) {
    console.log(`\n  OUT-OF-SCOPE VOCAB (${v.vocab.length}):`);
    process.stdout.write(table(dedupe(v.vocab, x => x.id), ['p', 'k', 'id', 'lesson', 'ceiling']));
  }
  if (v.particle.length) {
    console.log(`\n  OUT-OF-SCOPE PARTICLES (${v.particle.length}):`);
    process.stdout.write(table(dedupe(v.particle, x => x.id), ['p', 'k', 'id', 'intro', 'ceiling']));
  }
  if (v.form.length) {
    console.log(`\n  OUT-OF-SCOPE FORMS (${v.form.length}):`);
    process.stdout.write(table(dedupe(v.form, x => x.form), ['p', 'k', 'form', 'intro', 'ceiling']));
  }
  if (v.kanji.length) {
    console.log(`\n  OUT-OF-SCOPE KANJI (${v.kanji.length}):`);
    process.stdout.write(table(v.kanji, ['ch', 'paragraph']));
  }
  if (v.split.length) {
    console.log(`\n  SPLIT KANA CHIPS (${v.split.length}):`);
    process.stdout.write(table(v.split, ['p', 'k', 'fix']));
  }
  if (v.orthography.length) {
    console.log(`\n  ORTHOGRAPHY INCONSISTENCY (${v.orthography.length}):`);
    process.stdout.write(table(v.orthography, ['pair']));
  }
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

// ── Main ─────────────────────────────────────────────────────────────────────
const AUDIO = !!flags.audiostories;
let targets = [];
if (positional.length) {
  targets = positional.map(slug => ({ slug }));
} else if (flags.all || flags.level) {
  targets = AUDIO ? listAudiostories({ level: flags.level }) : listStories({ level: flags.level, all: flags.all });
} else {
  console.error('usage: node scripts/qa-story.mjs <slug> [--audiostories] | --level=N5 [--audiostories] | --all [--audiostories]');
  process.exit(2);
}

let failed = 0;
for (const t of targets) {
  const r = await qaStory(t.slug, { audiostory: AUDIO });
  printReport(r);
  if (!r.ok) failed++;
}

console.log(`\n${targets.length} ${AUDIO ? 'audiostory(ies)' : 'story(ies)'} checked, ${failed} with violations.`);
process.exit(failed ? 1 : 0);

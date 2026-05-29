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
import { buildGlossaryIndex } from './lib/tokenize.mjs';

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
// "N5.7" → { lvl: 'N5', idx: 7 }; level rank N5=0 < N4=1 < N3=2 (taught earliest first).
const LEVEL_RANK = { N5: 0, N4: 1, N3: 2 };
function parseLessonId(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/^(N[345])\.(\d+)$/);
  if (!m) return null;
  return { lvl: m[1], idx: Number(m[2]) };
}
// True if `a` is taught no later than `ceiling`.
function inScope(a, ceiling) {
  if (!a) return true;            // untagged ids aren't a scope violation
  if (!ceiling) return true;      // no ceiling = level wildcard, accept all
  const ra = LEVEL_RANK[a.lvl] ?? 99;
  const rc = LEVEL_RANK[ceiling.lvl] ?? 99;
  if (ra < rc) return true;
  if (ra > rc) return false;
  return a.idx <= ceiling.idx;
}

// ── Manifest data ────────────────────────────────────────────────────────────
const MANIFEST = JSON.parse(await fs.readFile(path.join(ROOT, 'manifest.json'), 'utf8'));

function getStoryMeta(slug) {
  for (const lvl of ['N5', 'N4', 'N3']) {
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
  const levels = all ? ['N5', 'N4', 'N3'] : (level ? [level] : []);
  for (const lvl of levels) {
    const data = MANIFEST.data && MANIFEST.data[lvl];
    if (!data) continue;
    for (const s of data.stories || []) out.push({ slug: s.id, level: lvl });
  }
  return out;
}

// Cumulative kanji taught through ceiling (N5 all + N4.1..idx if ceiling is N4).
function buildTaughtKanji(ceiling) {
  const set = new Set();
  for (const lvl of ['N5', 'N4', 'N3']) {
    const data = MANIFEST.data && MANIFEST.data[lvl];
    if (!data) continue;
    for (const lesson of data.lessons || []) {
      const lid = parseLessonId(lesson.id);
      if (!lid) continue;
      if (!inScope(lid, ceiling)) continue;
      for (const k of lesson.kanji || []) set.add(k);
    }
  }
  return set;
}

// ── Build glossary index + reverse id-map ────────────────────────────────────
const GLOSSARY_PATHS = [
  path.join(ROOT, 'data/N5/glossary.N5.json'),
  path.join(ROOT, 'data/N4/glossary.N4.json'),
  path.join(ROOT, 'data/N3/glossary.N3.json'),
  path.join(ROOT, 'shared/particles.json'),
  path.join(ROOT, 'shared/characters.json')
];
const CONJUGATION_RULES = JSON.parse(
  await fs.readFile(path.join(ROOT, 'conjugation_rules.json'), 'utf8')
);

const surfaceIdx = await buildGlossaryIndex(
  GLOSSARY_PATHS,
  (p, enc) => fs.readFile(p, enc),
  { includeReadings: true, conjugationRules: CONJUGATION_RULES }
);

// Build a reverse id→entry map so we can resolve token.g lookups.
const idIdx = new Map();
for (const [, e] of surfaceIdx) {
  if (e && e.id && !idIdx.has(e.id)) idIdx.set(e.id, e);
}
// Particles also have an `id` but their surface is keyed under `particle`.
// They're already in surfaceIdx via the buildGlossaryIndex particle branch.

// ── Per-token classification ─────────────────────────────────────────────────
const KANA_ONLY = /^[぀-ヿー]+$/;
const HAS_CJK = /[一-鿿㐀-䶿]/;
const HAS_KANA = /[぀-ヿー]/;
const PUNCT_ONLY = /^[、。！？「」『』（）：；・…\s「」\-—()『』]+$/;

// Decide whether a no-g token is "untagged" or is just a particle/punctuation
// that doesn't need a chip. We flag CJK tokens and any kana word ≥2 chars
// that doesn't resolve via surfaceIdx. Single-kana particles and punctuation
// pass through.
function classifyToken(t) {
  const k = t.k || '';
  if (!k) return { kind: 'empty' };
  if (PUNCT_ONLY.test(k)) return { kind: 'punct' };
  // 1) Explicit group id?
  if (t.g) {
    const entry = idIdx.get(t.g);
    if (!entry) {
      // Could be a synth not in idx (shouldn't happen; we built idx with
      // synths). Try parsing as <root>_<formKey>.
      const m = t.g.match(/^(.+?)_(.+)$/);
      const rootId = m && m[1];
      const root = rootId && idIdx.get(rootId);
      return { kind: 'g-unknown', g: t.g, root };
    }
    return { kind: 'g', g: t.g, entry };
  }
  // 2) Surface lookup (what the renderer's surfaceIdx does at runtime).
  const entry = surfaceIdx.get(k);
  if (entry && entry.id) return { kind: 'surface', g: entry.id, entry };
  // 3) Bare kana of length 1 — assume particle/sound (passes silently here;
  //    out-of-scope check below catches anything unindexed).
  if (k.length === 1 && KANA_ONLY.test(k)) return { kind: 'bare-kana' };
  // 4) Anything else: content token that doesn't resolve.
  return { kind: 'untagged', k };
}

// Look up an entry's level rank for scope checks.
function entryLessonId(e) {
  if (!e) return null;
  // Vocab entries: lesson_ids "N5.3" (string)
  if (typeof e.lesson_ids === 'string') {
    const first = e.lesson_ids.split(/[,;\s]+/)[0];
    const parsed = parseLessonId(first);
    if (parsed) return parsed;
  }
  // Kanji entries: lesson "N5.1"
  if (typeof e.lesson === 'string') {
    const p = parseLessonId(e.lesson);
    if (p) return p;
  }
  // Particle / character / inflected: introducedIn
  if (typeof e.introducedIn === 'string') {
    const p = parseLessonId(e.introducedIn);
    if (p) return p;
  }
  return null;
}

// Parse an inflected synth id → form key + check against rules.
function synthFormScope(entry, ceiling) {
  if (!entry || entry.type !== 'inflected') return null;
  const formKey = entry._ruleKey;
  if (!formKey) return null;
  const rule = CONJUGATION_RULES[formKey];
  if (!rule) return { formKey, intro: null, violation: false };
  const intro = parseLessonId(rule.introducedIn);
  return {
    formKey,
    intro,
    violation: intro && !inScope(intro, ceiling)
  };
}

// ── Per-story QA pass ────────────────────────────────────────────────────────
async function qaStory(slug) {
  const meta = getStoryMeta(slug);
  if (!meta) {
    console.error(`[qa] no story in manifest: ${slug}`);
    return { slug, ok: false, error: 'not-in-manifest' };
  }
  const storyPath = path.join(ROOT, 'data', meta.level, 'stories', slug, 'story.json');
  let story;
  try {
    story = JSON.parse(await fs.readFile(storyPath, 'utf8'));
  } catch (e) {
    console.error(`[qa] cannot read ${storyPath}: ${e.message}`);
    return { slug, ok: false, error: 'read-failed' };
  }
  const ceiling = parseLessonId(meta.unlocksAfter || story.unlocksAfter);
  const taughtKanji = buildTaughtKanji(ceiling);

  const violations = {
    untagged: [],
    vocab: [],
    particle: [],
    form: [],
    kanji: [],
    unknownId: []
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
      violations.unknownId.length === 0
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
let targets = [];
if (positional.length) {
  targets = positional.map(slug => {
    const meta = getStoryMeta(slug);
    return { slug, level: meta?.level };
  });
} else if (flags.all || flags.level) {
  targets = listStories({ level: flags.level, all: flags.all });
} else {
  console.error('usage: node scripts/qa-story.mjs <slug> | --level=N4 | --all');
  process.exit(2);
}

let failed = 0;
for (const t of targets) {
  const r = await qaStory(t.slug);
  printReport(r);
  if (!r.ok) failed++;
}

console.log(`\n${targets.length} story(ies) checked, ${failed} with violations.`);
process.exit(failed ? 1 : 0);

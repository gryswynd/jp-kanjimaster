#!/usr/bin/env node
/**
 * scripts/validate-stories.mjs
 *
 * Schema + integrity validator for every story.json under data/**.
 *
 * Exits 0 on success, 1 on any error. Used by:
 *   - pre-commit hook (when story.json or manifest.json is staged)
 *   - npm run build:www  (prepended; blocks build on bad data)
 *
 * Checks:
 *   - schemaVersion === "2.0.0"
 *   - Required fields present (id, title, englishTitle, paragraphs[])
 *   - Each paragraph's tokens reconstruct to its jp string (concatenated `k`)
 *   - vocabUsed / grammarUsed ids resolve against the glossary
 *   - comprehension.questions[].correct is a valid index into options[]
 *   - manifest entries reference existing story.json files
 *
 * Run:
 *   node scripts/validate-stories.mjs
 *   node scripts/validate-stories.mjs --only=my-family
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { reconstructFromTokens } from './lib/tokenize.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SCHEMA_VERSION = '2.0.0';

const onlyArg = process.argv.slice(2).find(a => a.startsWith('--only='));
const onlySlug = onlyArg ? onlyArg.split('=')[1] : null;

const errors = [];
function fail(file, msg) { errors.push(`[${file}] ${msg}`); }

// ── Load manifest + glossary index ──────────────────────────────────────────

const manifest = JSON.parse(await readFile(path.join(ROOT, 'manifest.json'), 'utf8'));

const glossaryIds = new Set();
const glossaryFiles = [
  'data/N5/glossary.N5.json',
  'data/N4/glossary.N4.json',
  'data/N3/glossary.N3.json',
  'shared/particles.json'
];
for (const gf of glossaryFiles) {
  const p = path.join(ROOT, gf);
  if (!existsSync(p)) continue;
  const data = JSON.parse(await readFile(p, 'utf8'));
  for (const e of (data.entries || data.particles || [])) {
    if (e.id) glossaryIds.add(e.id);
  }
}

// ── Walk every story listed in the manifest ─────────────────────────────────

const stories = [];
for (const level of Object.keys(manifest.data || {})) {
  for (const s of (manifest.data[level].stories || [])) {
    const slug = s.id || path.basename(s.dir);
    if (onlySlug && slug !== onlySlug) continue;
    stories.push({ slug, dir: s.dir, manifestEntry: s, level });
  }
}

let checked = 0;
for (const story of stories) {
  const slug = story.slug;
  const jsonPath = path.join(ROOT, story.dir, 'story.json');

  if (!existsSync(jsonPath)) {
    // Stories that haven't been migrated yet are not an error during the
    // transition window — but if the manifest declares `file: "story.json"`,
    // the file MUST exist.
    if (story.manifestEntry.file === 'story.json') {
      fail(slug, 'manifest declares file:"story.json" but the file is missing');
    }
    continue;
  }

  let data;
  try {
    data = JSON.parse(await readFile(jsonPath, 'utf8'));
  } catch (e) {
    fail(slug, 'invalid JSON: ' + e.message);
    continue;
  }
  checked++;

  // schemaVersion
  if (data.schemaVersion !== SCHEMA_VERSION) {
    fail(slug, `schemaVersion must be "${SCHEMA_VERSION}" (got ${JSON.stringify(data.schemaVersion)})`);
  }
  // required fields
  for (const k of ['id', 'title', 'englishTitle', 'paragraphs']) {
    if (data[k] == null || data[k] === '') fail(slug, `missing required field "${k}"`);
  }
  if (!Array.isArray(data.paragraphs)) {
    fail(slug, 'paragraphs must be an array');
    continue;
  }

  // per-paragraph: tokens reconstruct to jp
  data.paragraphs.forEach((p, i) => {
    if (typeof p.jp !== 'string' || !p.jp) {
      fail(slug, `paragraphs[${i}].jp missing or empty`);
      return;
    }
    if (!Array.isArray(p.tokens) || p.tokens.length === 0) {
      fail(slug, `paragraphs[${i}].tokens missing or empty`);
      return;
    }
    const reconstructed = reconstructFromTokens(p.tokens);
    if (reconstructed !== p.jp) {
      fail(slug, `paragraphs[${i}].tokens reconstructs to "${reconstructed}" but jp is "${p.jp}"`);
    }
    // Token shape: must have `k`; `r` (furigana) and `g` (group id) optional.
    p.tokens.forEach((t, ti) => {
      if (!t || typeof t !== 'object') {
        fail(slug, `paragraphs[${i}].tokens[${ti}] is not an object`);
      } else if (typeof t.k !== 'string') {
        fail(slug, `paragraphs[${i}].tokens[${ti}].k must be a string`);
      } else if (t.r != null && typeof t.r !== 'string') {
        fail(slug, `paragraphs[${i}].tokens[${ti}].r must be a string when present`);
      } else if (t.g != null && typeof t.g !== 'string') {
        fail(slug, `paragraphs[${i}].tokens[${ti}].g must be a string when present`);
      }
    });
  });

  // vocabUsed / grammarUsed must resolve to glossary ids
  for (const list of ['vocabUsed', 'grammarUsed']) {
    if (data[list] == null) continue;
    if (!Array.isArray(data[list])) {
      fail(slug, `${list} must be an array`);
      continue;
    }
    data[list].forEach((id, i) => {
      if (typeof id !== 'string') fail(slug, `${list}[${i}] must be a string`);
      else if (!glossaryIds.has(id)) fail(slug, `${list}[${i}] = "${id}" not found in glossary`);
    });
  }

  // comprehension structure
  if (data.comprehension) {
    const c = data.comprehension;
    if (!Array.isArray(c.questions)) {
      fail(slug, 'comprehension.questions must be an array (empty is OK)');
    } else {
      c.questions.forEach((q, i) => {
        if (typeof q.q !== 'string' || !q.q) fail(slug, `comprehension.questions[${i}].q missing`);
        if (!Array.isArray(q.options) || q.options.length < 2) fail(slug, `comprehension.questions[${i}].options must have 2+ entries`);
        if (typeof q.correct !== 'number' || q.correct < 0 || q.correct >= (q.options || []).length) {
          fail(slug, `comprehension.questions[${i}].correct must be a valid index into options`);
        }
      });
    }
  }
}

// ── Report ──────────────────────────────────────────────────────────────────

if (errors.length) {
  console.error(`\n✘ ${errors.length} validation error(s) across ${checked} story file(s):\n`);
  for (const e of errors) console.error('  ' + e);
  console.error('');
  process.exit(1);
}
console.log(`✓ ${checked} story file(s) validated, no errors.`);

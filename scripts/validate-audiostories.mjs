#!/usr/bin/env node
/**
 * scripts/validate-audiostories.mjs
 * Validation gate for Audio Dojo passages (data/<lvl>/audiostories/<slug>/audiostory.json),
 * listed in data/audiostories.index.json. Wired into build:www.
 *
 * Checks per passage:
 *   - schemaVersion === "1.0.0"; required fields id/title/englishTitle/paragraphs
 *   - each paragraphs[i].tokens reconstructs to paragraphs[i].jp (token drift)
 *   - comprehension.questions[]: q present, options 2+, correct a valid index
 *   - if audio is baked (breakpoints non-empty): breakpoints.length === paragraphs.length
 *   - index entry has level + (warn) unlocksAfter for gating
 *
 * Run: node scripts/validate-audiostories.mjs   (or via npm run build:www)
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { reconstructFromTokens } from './lib/tokenize.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const SCHEMA = '1.0.0';
const errors = [];
const warnings = [];
const fail = (slug, m) => errors.push(`[${slug}] ${m}`);
const warn = (slug, m) => warnings.push(`[${slug}] ${m}`);

const indexPath = join(ROOT, 'data', 'audiostories.index.json');
if (!existsSync(indexPath)) {
  console.log('[validate-audiostories] no audiostories.index.json — nothing to validate.');
  process.exit(0);
}
const index = JSON.parse(readFileSync(indexPath, 'utf8'));
const entries = index.audiostories || [];

for (const entry of entries) {
  const slug = entry.id || '(unknown)';
  if (!entry.level) warn(slug, 'index entry missing "level"');
  if (!entry.unlocksAfter) warn(slug, 'index entry has no "unlocksAfter" — passage will always be unlocked');

  const file = join(ROOT, entry.dir, entry.file || 'audiostory.json');
  if (!existsSync(file)) { fail(slug, `audiostory.json not found at ${entry.dir}`); continue; }
  let data;
  try { data = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { fail(slug, `invalid JSON: ${e.message}`); continue; }

  if (data.schemaVersion !== SCHEMA) fail(slug, `schemaVersion must be "${SCHEMA}" (got ${JSON.stringify(data.schemaVersion)})`);
  for (const k of ['id', 'title', 'englishTitle']) {
    if (typeof data[k] !== 'string' || !data[k]) fail(slug, `missing "${k}"`);
  }
  if (!Array.isArray(data.paragraphs) || !data.paragraphs.length) {
    fail(slug, 'paragraphs[] is empty'); continue;
  }

  data.paragraphs.forEach((p, i) => {
    if (typeof p.jp !== 'string' || !p.jp) { fail(slug, `paragraphs[${i}].jp missing`); return; }
    if (Array.isArray(p.tokens) && p.tokens.length) {
      const recon = reconstructFromTokens(p.tokens);
      if (recon !== p.jp) fail(slug, `paragraphs[${i}].tokens reconstruct to "${recon}" but jp is "${p.jp}"`);
    } else {
      warn(slug, `paragraphs[${i}] has no tokens (run tokenize-story-paragraph --kind=audiostory)`);
    }
  });

  const c = data.comprehension;
  if (!c || !Array.isArray(c.questions)) {
    warn(slug, 'no comprehension.questions[]');
  } else {
    c.questions.forEach((q, i) => {
      if (typeof q.q !== 'string' || !q.q) fail(slug, `questions[${i}].q (spoken question) missing`);
      if (!Array.isArray(q.options) || q.options.length < 2) fail(slug, `questions[${i}].options must have 2+ entries`);
      if (typeof q.correct !== 'number' || q.correct < 0 || q.correct >= ((q.options || []).length)) {
        fail(slug, `questions[${i}].correct must be a valid index into options`);
      }
    });
  }

  // Only meaningful once audio is baked (breakpoints populated by generate-audio).
  const bps = data.audio && data.audio.breakpoints;
  if (Array.isArray(bps) && bps.length && bps.length !== data.paragraphs.length) {
    fail(slug, `audio.breakpoints (${bps.length}) must equal paragraphs (${data.paragraphs.length}) — re-run gen:audio`);
  }
}

if (warnings.length) {
  console.warn(`[validate-audiostories] ${warnings.length} warning(s):`);
  warnings.forEach((w) => console.warn('  ' + w));
}
if (errors.length) {
  console.error(`[validate-audiostories] ${errors.length} error(s):`);
  errors.forEach((e) => console.error('  ' + e));
  process.exit(1);
}
console.log(`[validate-audiostories] OK — ${entries.length} passage(s) validated.`);

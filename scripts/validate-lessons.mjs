#!/usr/bin/env node
/**
 * scripts/validate-lessons.mjs
 *
 * Lesson content guard. Currently enforces ONE rule:
 *   - every `type:"reading"` section has at least 3 comprehension `questions`.
 *
 * Reading questions are now graded written-answers that count toward the lesson
 * pass score, so a reading shipping with <3 questions is a real content gap.
 *
 * Exits 0 on success, 1 on any violation. Run: node scripts/validate-lessons.mjs
 */
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIN_Q = 3;
const errors = [];

for (const level of ['N5', 'N4', 'N3']) {
  const dir = path.join(ROOT, 'data', level, 'lessons');
  let files;
  try { files = (await readdir(dir)).filter((f) => f.endsWith('.json')); }
  catch { continue; } // level may not exist yet
  for (const f of files.sort()) {
    let data;
    try { data = JSON.parse(await readFile(path.join(dir, f), 'utf8')); }
    catch (e) { errors.push(`${level}/lessons/${f} — invalid JSON: ${e.message}`); continue; }
    for (const sec of (data.sections || [])) {
      if (sec.type !== 'reading') continue;
      const n = Array.isArray(sec.questions) ? sec.questions.length : 0;
      if (n < MIN_Q) {
        errors.push(`${data.id || f} — reading "${sec.title || '(untitled)'}" has ${n} question(s); needs ${MIN_Q}.`);
      }
    }
  }
}

if (errors.length) {
  console.error(`[validate-lessons] ${errors.length} issue(s):`);
  errors.forEach((e) => console.error('  ✗ ' + e));
  process.exit(1);
}
console.log('[validate-lessons] OK — every reading section has at least ' + MIN_Q + ' questions.');

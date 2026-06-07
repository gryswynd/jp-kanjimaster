/**
 * server/scripts/stage-curriculum.mjs
 * Copies the curriculum files the server needs into server/curriculum/, so they
 * ship inside the Docker image (the build context is server/, which otherwise
 * can't see the repo-root manifest + content tree).
 *
 * Two consumers:
 *   - lib/curriculum.js (lookup_curriculum tool) → needs manifest + glossaries.
 *   - lib/content.js (on-screen context resolver) → needs the actual content
 *     files (lessons/grammar/compose/reviews/stories) + the audiostories index
 *     and audiostory files, addressed by the same relative subpaths.
 *
 * Run via `npm run predeploy` before `gcloud run deploy`. At runtime the server
 * reads them with CURRICULUM_ROOT=/app/curriculum (set in the Cloud Run env), so
 * we MUST preserve each file's repo-relative subpath here.
 *
 * server/curriculum/ is gitignored — it's generated, not source.
 */

import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dir, '..', '..');          // server/scripts → repo root
const OUT = join(__dir, '..', 'curriculum');   // server/curriculum

async function copyInto(relPath, copied, seen) {
  if (!relPath || seen.has(relPath)) return;
  seen.add(relPath);
  const src = join(REPO, relPath);
  const dst = join(OUT, relPath);
  try {
    await mkdir(dirname(dst), { recursive: true });
    await copyFile(src, dst);
    copied.push(relPath);
  } catch (e) {
    console.warn('  (skip, unreadable) ' + relPath + ' — ' + ((e && e.code) || e));
  }
}

// A content entry references its file either as `file` or `dir` + `file`.
function entryRel(entry) {
  if (!entry || typeof entry !== 'object') return null;
  return entry.dir ? join(entry.dir, entry.file || '') : (entry.file || null);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const copied = [];
  const seen = new Set();

  await copyInto('manifest.json', copied, seen);
  const manifest = JSON.parse(await readFile(join(REPO, 'manifest.json'), 'utf8'));
  const levels = manifest.levels || Object.keys(manifest.data || {});

  for (const lvl of levels) {
    const d = (manifest.data && manifest.data[lvl]) || {};
    // Glossaries (string path) for the lookup index.
    if (d.glossary) await copyInto(d.glossary, copied, seen);
    // Every content array: lessons, grammar, compose, reviews, stories, game…
    for (const k of Object.keys(d)) {
      if (!Array.isArray(d[k])) continue;
      for (const entry of d[k]) await copyInto(entryRel(entry), copied, seen);
    }
  }

  // Audiostories live in their own index, not the manifest.
  const audioIdxRel = 'data/audiostories.index.json';
  await copyInto(audioIdxRel, copied, seen);
  try {
    const idx = JSON.parse(await readFile(join(REPO, audioIdxRel), 'utf8'));
    for (const entry of (idx.audiostories || [])) await copyInto(entryRel(entry), copied, seen);
  } catch (e) { console.warn('  (no audiostories index)', (e && e.code) || e); }

  console.log('staged curriculum → ' + OUT + '  (' + copied.length + ' files)');
}

main().catch((e) => { console.error('stage-curriculum failed:', e); process.exit(1); });

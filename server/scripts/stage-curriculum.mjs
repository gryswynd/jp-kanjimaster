/**
 * server/scripts/stage-curriculum.mjs
 * Copies the curriculum files the `lookup_curriculum` tool needs into
 * server/curriculum/, so they ship inside the Docker image (the build context is
 * server/, which otherwise can't see the repo-root manifest + glossaries).
 *
 * Run via `npm run predeploy` before `gcloud run deploy`. At runtime the server
 * reads them with CURRICULUM_ROOT=/app/curriculum (set in the Cloud Run env);
 * lib/curriculum.js joins ROOT + the manifest's relative glossary paths
 * (e.g. data/N5/glossary.N5.json), so we MUST preserve those subpaths here.
 *
 * server/curriculum/ is gitignored — it's generated, not source.
 */

import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dir, '..', '..');          // server/scripts → repo root
const OUT = join(__dir, '..', 'curriculum');   // server/curriculum

async function copyInto(relPath) {
  const src = join(REPO, relPath);
  const dst = join(OUT, relPath);
  await mkdir(dirname(dst), { recursive: true });
  await copyFile(src, dst);
  return relPath;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const copied = ['manifest.json'];
  await copyInto('manifest.json');

  const manifest = JSON.parse(await readFile(join(REPO, 'manifest.json'), 'utf8'));
  const levels = manifest.levels || Object.keys(manifest.data || {});
  for (const lvl of levels) {
    const rel = manifest.data[lvl] && manifest.data[lvl].glossary;
    if (rel) { await copyInto(rel); copied.push(rel); }
  }

  console.log('staged curriculum →', OUT);
  copied.forEach((p) => console.log('  ' + p));
}

main().catch((e) => { console.error('stage-curriculum failed:', e); process.exit(1); });

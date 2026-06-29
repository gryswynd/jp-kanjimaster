/**
 * story-gen/scripts/stage.mjs
 * Makes the service self-contained for Cloud Run by copying the shared pipeline
 * libs (scripts/lib/*) into ./vendor/lib and the curriculum content the gates
 * read into ./content (same relative layout buildGateContext expects). Run by
 * `npm run predeploy` (before docker build) and `npm run dev`. ./vendor + ./content
 * are gitignored — regenerated, never hand-edited.
 */
import { mkdir, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SVC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');   // story-gen/
const REPO = path.resolve(SVC, '..');                                          // repo root

const LIB_FILES = ['tokenize.mjs', 'conjugate.mjs', 'counters.mjs', 'story-gates.mjs', 'generate-story.mjs'];
const CONTENT_FILES = [
  'manifest.json', 'conjugation_rules.json', 'counter_rules.json',
  'data/N5/glossary.N5.json', 'data/N4/glossary.N4.json', 'data/N3/glossary.N3.json',
  'shared/particles.json', 'shared/characters.json', 'shared/loanwords.json',
];

async function cp(srcAbs, dstAbs) {
  await mkdir(path.dirname(dstAbs), { recursive: true });
  await copyFile(srcAbs, dstAbs);
}

await rm(path.join(SVC, 'vendor'), { recursive: true, force: true });
await rm(path.join(SVC, 'content'), { recursive: true, force: true });

for (const f of LIB_FILES) await cp(path.join(REPO, 'scripts/lib', f), path.join(SVC, 'vendor/lib', f));
for (const f of CONTENT_FILES) await cp(path.join(REPO, f), path.join(SVC, 'content', f));

console.log(`staged ${LIB_FILES.length} lib + ${CONTENT_FILES.length} content file(s) into story-gen/{vendor,content}`);

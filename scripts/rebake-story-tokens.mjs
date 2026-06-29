/**
 * scripts/rebake-story-tokens.mjs
 *
 * Re-tokenizes every paragraph of every story + audiostory in place with the
 * current tokenizer (the min-cost lattice), passing the content's level ceiling
 * so out-of-level disambiguation applies. Reconstruction is enforced per
 * paragraph; a paragraph whose tokens don't rebuild its jp is left untouched and
 * reported (never write drifted tokens).
 *
 * Run: node scripts/rebake-story-tokens.mjs [--only=<slug>]
 */
import { readFile, writeFile, glob } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGlossaryIndex, tokenizeText, reconstructFromTokens } from './lib/tokenize.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1] || null;

const conjugationRules = JSON.parse(await readFile(path.join(ROOT, 'conjugation_rules.json')));
const counterRules = JSON.parse(await readFile(path.join(ROOT, 'counter_rules.json')));
const idx = await buildGlossaryIndex(
  ['data/N5/glossary.N5.json','data/N4/glossary.N4.json','data/N3/glossary.N3.json','shared/particles.json','shared/characters.json','shared/loanwords.json'].map(p => path.join(ROOT, p)),
  readFile, { includeReadings: true, conjugationRules, counterRules });

function ceilingFor(file) {
  if (file.includes('/custom/')) return 'N4.99';
  const m = file.match(/data\/(N[345])\//);
  return m ? `${m[1]}.99` : null;
}

const files = [];
for (const pat of ['data/*/stories/*/story.json', 'data/*/audiostories/*/audiostory.json']) {
  for await (const f of glob(path.join(ROOT, pat))) files.push(f);
}
files.sort();

let storiesTouched = 0, parasChanged = 0, mismatches = [];
for (const file of files) {
  const slug = path.basename(path.dirname(file));
  if (ONLY && slug !== ONLY) continue;
  const ceiling = ceilingFor(file);
  const d = JSON.parse(await readFile(file, 'utf8'));
  let changed = false;
  for (const p of d.paragraphs || []) {
    if (!p.jp) continue;
    const toks = tokenizeText(p.jp, idx, { ceiling });
    if (reconstructFromTokens(toks) !== p.jp) { mismatches.push(`${slug}: ${p.jp.slice(0, 40)}`); continue; }
    if (JSON.stringify(toks) !== JSON.stringify(p.tokens)) { p.tokens = toks; changed = true; parasChanged++; }
  }
  if (changed) { await writeFile(file, JSON.stringify(d, null, 2) + '\n'); storiesTouched++; }
}
console.log(`Re-baked ${parasChanged} paragraph(s) across ${storiesTouched} file(s).`);
if (mismatches.length) { console.log(`\n⚠ ${mismatches.length} paragraph(s) left untouched (reconstruction mismatch):`); for (const m of mismatches) console.log('  ' + m); }

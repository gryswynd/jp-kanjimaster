/**
 * scripts/derive-answer-terms.mjs
 *
 * Bakes `aTerms` onto each written comprehension question in story.json files.
 *
 * The runtime grader (app/shared/written-answer.js) accepts any valid
 * conjugation of the answer's verbs/adjectives — but it needs to know which
 * words in the answer are conjugatable, by dictionary id. Lessons already carry
 * that (q.a_terms); stories only have a flat `answer` string. This script
 * tokenizes each answer with the SAME glossary-greedy tokenizer used to bake
 * story paragraphs, then records the answer's term ids (resolved to their
 * dictionary ROOT — stripping any conjugation-form suffix) as q.aTerms.
 *
 * Run:  node scripts/derive-answer-terms.mjs [--only=<slug>]
 * Re-run any time comprehension answers change (and after authoring a story).
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'node:fs/promises';
import { buildGlossaryIndex, tokenizeText } from './lib/tokenize.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1] || null;

const conjugationRules = JSON.parse(await readFile(path.join(ROOT, 'conjugation_rules.json'), 'utf8'));
const counterRules = JSON.parse(await readFile(path.join(ROOT, 'counter_rules.json'), 'utf8'));
const GLOSSARY_PATHS = [
  'data/N5/glossary.N5.json', 'data/N4/glossary.N4.json', 'data/N3/glossary.N3.json',
  'shared/particles.json', 'shared/characters.json', 'shared/loanwords.json'
].map(p => path.join(ROOT, p));

const glossaryIndex = await buildGlossaryIndex(GLOSSARY_PATHS, readFile,
  { includeReadings: true, conjugationRules, counterRules });

// Set of valid base (dictionary) ids — note ids themselves may contain
// underscores (v_ageru_raise, v_aku_2, g_da), so root resolution checks the
// stripped remainder against this set.
const baseIds = new Set();
for (const p of GLOSSARY_PATHS) {
  const data = JSON.parse(await readFile(p, 'utf8'));
  for (const e of (data.entries || [])) if (e.id) baseIds.add(e.id);
  for (const e of (data.particles || [])) if (e.id) baseIds.add(e.id);
  for (const c of (data.characters || [])) if (c.id) baseIds.add(c.id);
}
const ruleKeys = Object.keys(conjugationRules).sort((a, b) => b.length - a.length);

// A conjugated/synthetic id is <baseId>_<ruleKey>. We must reduce to the
// dictionary <baseId> EVEN WHEN the conjugated id is itself a glossary entry —
// the glossary bakes some inflected forms (e.g. an entry id'd v_iku__polite_past),
// and treating those as roots would generate garbage forms. So: try rule-key
// reduction FIRST (longest key first; tolerate the extra underscore irregulars
// like 行く produce), and only fall back to g if no base-id prefix is found.
// Note base ids themselves contain underscores (v_ageru_raise, v_aku_2, g_da) —
// the rule-key match + base-id check avoids over-reducing those.
function toRoot(g) {
  if (!g) return null;
  if (g.startsWith('count_')) return g;          // counter forms: leave as-is (skipped by grader)
  // Hand-baked conjugated glossary entries (13 of them: v_iku__polite_past,
  // v_aru__polite_neg, …) use a DOUBLE underscore; the dictionary root is the
  // part before it. These are themselves glossary entries, so they'd otherwise
  // masquerade as roots and generate wrong forms.
  const dbl = g.indexOf('__');
  if (dbl !== -1) { const r = g.slice(0, dbl); if (baseIds.has(r)) return r; }
  // Standard conjugated/synthetic ids: <baseId>_<ruleKey>. Base ids contain
  // underscores too (v_aku_2, v_ageru_raise), so require the prefix to be a
  // real base id rather than splitting blindly.
  for (const k of ruleKeys) {
    if (g.endsWith('_' + k)) {
      const root = g.slice(0, -(k.length + 1));
      if (baseIds.has(root)) return root;
    }
  }
  return g; // a real dictionary id, or unresolved (grader treats unknown as optional)
}

// Ordered, de-duped root ids from the answer's tokens.
function answerTerms(answer, ceiling) {
  const toks = tokenizeText(String(answer || ''), glossaryIndex, { ceiling });
  const out = [], seen = new Set();
  for (const t of toks) {
    if (!t.g) continue;
    const r = toRoot(t.g);
    if (r && !seen.has(r)) { seen.add(r); out.push(r); }
  }
  return out;
}

const files = [];
for await (const f of glob(path.join(ROOT, 'data/*/stories/*/story.json'))) files.push(f);
files.sort();

let storiesTouched = 0, qsTouched = 0;
for (const file of files) {
  const slug = path.basename(path.dirname(file));
  if (ONLY && slug !== ONLY) continue;
  const data = JSON.parse(await readFile(file, 'utf8'));
  const lvlMatch = file.match(/data\/(N[345])\//);
  const ceiling = file.includes('/custom/') ? 'N4.99' : (lvlMatch ? `${lvlMatch[1]}.99` : null);
  const qs = (data.comprehension && data.comprehension.questions) || [];
  let changed = false;
  for (const q of qs) {
    const isWritten = q.type === 'written' || (!q.options && q.answer);
    if (!isWritten || !q.answer) continue;
    const aTerms = answerTerms(q.answer, ceiling);
    const prev = JSON.stringify(q.aTerms || null);
    if (JSON.stringify(aTerms) !== prev) { q.aTerms = aTerms; changed = true; qsTouched++; }
  }
  if (changed) {
    await writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
    storiesTouched++;
    console.log(`✓ ${slug}: ${qs.length} question(s) → aTerms baked`);
  }
}
console.log(`\nDone. ${storiesTouched} story file(s) updated, ${qsTouched} question(s) (re)derived.`);

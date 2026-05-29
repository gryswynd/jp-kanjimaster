#!/usr/bin/env node
/**
 * scripts/audit-story-vocab.mjs
 *
 * Vocab-APPROVAL gate (reporting only — makes no edits).
 *
 * The tokenizer + validate-stories.mjs only check that tokens *reconstruct* and
 * that vocabUsed/grammarUsed *resolve*. Neither rejects vocab for being
 * out-of-level or unglossaried. This audit fills that hole.
 *
 * Approval rule (per project decision):
 *   A token is APPROVED when it is one of:
 *     - a glossary entry at the story's level OR below (N4 story → N4/N5 ok, N3 not)
 *     - a particle (shared/particles.json) or character (shared/characters.json)
 *     - a conjugated form of an approved verb/adj (group id like v_omou_te_form
 *       whose base id v_omou is approved)
 *     - a grammatical function morpheme on FUNCTION_ALLOWLIST (copula, polite
 *       endings, sentence-final particles, taught-grammar connectives, demonstratives)
 *     - punctuation / proper-noun kana already in the glossary
 *   Everything else is a VIOLATION, in one of two buckets:
 *     [OUT-OF-LEVEL]  token resolves to a glossary entry ABOVE the story's level
 *     [UNGLOSSARIED]  content word with no group + not a function morpheme
 *
 * Usage:
 *   node scripts/audit-story-vocab.mjs                 # all N4 stories
 *   node scripts/audit-story-vocab.mjs --level=N4
 *   node scripts/audit-story-vocab.mjs --only=factory-owner,rikizo-journey
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const flag = (n) => { const a = args.find(x => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : null; };
const LEVEL = flag('level') || 'N4';
const ONLY = flag('only') ? new Set(flag('only').split(',')) : null;

const LEVELS = ['N5', 'N4', 'N3'];               // index = difficulty rank
const STORY_RANK = LEVELS.indexOf(LEVEL);

const load = async (p) => JSON.parse(await readFile(path.join(ROOT, p), 'utf8'));
const entriesOf = (g) => Array.isArray(g) ? g : (g.entries || g.particles || g.characters || []);

// ── Build id → level-rank map (lowest level wins) + always-approved ids ──────
const idRank = {};                                // glossary entry id → rank
const approvedIds = new Set();                    // particles + characters
for (let r = 0; r < LEVELS.length; r++) {
  for (const e of entriesOf(await load(`data/${LEVELS[r]}/glossary.${LEVELS[r]}.json`))) {
    if (e && e.id && !(e.id in idRank)) idRank[e.id] = r;
  }
}
for (const f of ['shared/particles.json', 'shared/characters.json']) {
  try { for (const e of entriesOf(await load(f))) if (e && e.id) approvedIds.add(e.id); } catch {}
}
const ALL_IDS = [...Object.keys(idRank), ...approvedIds].sort((a, b) => b.length - a.length);

// Surface → lowest level-rank. A token is glossaried if its SURFACE matches a
// glossary/particle/character entry (the `g` group tag is unreliable — most
// vocab tokens carry a reading but no group). Built from entry.surface, the
// joined tokens[], and any kanji-card surface.
const surfaceRank = {};
const noteSurface = (s, r) => { if (s && (!(s in surfaceRank) || r < surfaceRank[s])) surfaceRank[s] = r; };
for (let r = 0; r < LEVELS.length; r++) {
  for (const e of entriesOf(await load(`data/${LEVELS[r]}/glossary.${LEVELS[r]}.json`))) {
    if (!e) continue;
    noteSurface(e.surface, r);
    if (Array.isArray(e.tokens)) noteSurface(e.tokens.map(t => t.k).join(''), r);
  }
}
for (const f of ['shared/particles.json', 'shared/characters.json']) {
  try {
    for (const e of entriesOf(await load(f))) {
      if (!e) continue;
      noteSurface(e.surface || e.particle || e.name, -1);          // always-approved
      if (Array.isArray(e.tokens)) noteSurface(e.tokens.map(t => t.k).join(''), -1);
    }
  } catch {}
}

// N3-glossary verb ids that double as N4-taught grammar suffixes — not real
// out-of-level vocab. v_sugiru = the 〜すぎる suffix (G15/G30), distinct from the
// standalone N3 verb 過ぎる "to pass".
const GRAMMAR_SUFFIX_IDS = new Set(['v_sugiru']);

// Map a (possibly conjugated) group id back to its base glossary id.
function baseId(g) {
  if (g in idRank || approvedIds.has(g)) return g;
  for (const id of ALL_IDS) if (g === id || g.startsWith(id + '_')) return id;   // longest first
  return g;
}

// Grammatical function morphemes that legitimately have NO glossary entry.
// Copula, polite endings, aux verbs, sentence-final particles, taught-grammar
// connectives, demonstratives. Content words (nouns/verbs/adverbs) are NOT here
// — if they aren't glossaried they SHOULD surface for triage.
const FUNCTION_ALLOWLIST = new Set([
  // copula
  'だ','です','でした','じゃ','では','である','だった','だろう','でしょう','だと','だそう','だそうです','でして',
  // polite verb endings / aux
  'ます','ました','ません','ましょう','まして','ましたら','ましたが',
  'いる','いた','いて','います','いました','いません','ています','ている','ていました','ていて','ている',
  'ある','あった','あって','あります','ありました','ありません','あろう',
  'なる','なった','なって','なります','なりました',
  'する','した','して','します','しました','しよう',
  // te / negative / request endings
  'て','って','で','ないで','なくて','ない','なかった','なき','ず','ぬ',
  'ください','くださいません','ちゃ','じゃう',
  // sentence-final / interjection
  'か','ね','よ','わ','の','さ','ぞ','な','かな','かしら','っけ','んだ','んです','の。',
  // conjunctions / connectives (taught grammar)
  'でも','それから','そして','しかし','だから','それで','ので','のに','から','けど','けれど','が','し','ても','たり',
  // taught-grammar kana (G13–G31)
  'ばかり','だけ','しか','みたい','みたいに','みたいな','みたいだ','みたいです','そう','そうだ','そうです','よう','ように','ような','ようになりました',
  'について','くらい','ぐらい','ほど','なら','たら','れば','ば','ながら','まえに','てから','ため','ために','こと','という',
  // demonstratives / pro-forms
  'この','その','あの','どの','ここ','そこ','あそこ','どこ','これ','それ','あれ','どれ',
  'こう','ああ','どう','こんな','そんな','あんな','どんな','なに','なん','いつ','だれ','どれ',
]);

const isKana = (s) => /^[ぁ-んァ-ヶー]+$/.test(s);
const isPunct = (s) => /^[、。「」『』！？…・〜（）\s\.\-]+$/.test(s);

// ── Audit one story ──────────────────────────────────────────────────────────
function auditStory(data, slug) {
  const outOfLevel = new Map();   // surface → {rank, g, paras:Set}
  const unglossaried = new Map(); // surface → {paras:Set}
  (data.paragraphs || []).forEach((p, pi) => {
    for (const t of (p.tokens || [])) {
      const k = t.k || '';
      if (isPunct(k) || !k) continue;
      if (FUNCTION_ALLOWLIST.has(k)) continue;
      if (isKana(k) && k.length === 1) continue;            // stray single kana (inflection)

      if (t.g && GRAMMAR_SUFFIX_IDS.has(baseId(t.g))) continue;   // N4 grammar suffix, not N3 vocab

      // Lowest known level across the group-id path and the surface path.
      const gRank = t.g ? idRank[baseId(t.g)] : undefined;
      const sRank = surfaceRank[k];
      const ranks = [gRank, sRank].filter(r => r != null);
      const known = ranks.length ? Math.min(...ranks) : undefined;

      if (known === undefined) {                            // not in any glossary
        const m = unglossaried.get(k) || { paras: new Set() };
        m.paras.add(pi + 1); unglossaried.set(k, m);
      } else if (known > STORY_RANK) {                      // only known above level
        const g = t.g ? baseId(t.g) : '(by surface)';
        const m = outOfLevel.get(k) || { rank: known, g, paras: new Set() };
        m.paras.add(pi + 1); outOfLevel.set(k, m);
      }
    }
  });
  return { outOfLevel, unglossaried };
}

// ── Run ──────────────────────────────────────────────────────────────────────
const manifest = await load('manifest.json');
let stories = (manifest.data?.[LEVEL]?.stories || []);
if (ONLY) stories = stories.filter(s => ONLY.has(s.id));

let totalOOL = 0, totalUNG = 0, storiesWith = 0;
for (const s of stories) {
  const data = await load(path.join(s.dir, s.file || 'story.json'));
  const { outOfLevel, unglossaried } = auditStory(data, s.id);
  if (!outOfLevel.size && !unglossaried.size) continue;
  storiesWith++;
  console.log(`\n■ ${s.id}  (${s.titleJp || ''})`);
  if (outOfLevel.size) {
    console.log(`  OUT-OF-LEVEL (above ${LEVEL}):`);
    for (const [k, m] of [...outOfLevel].sort()) {
      totalOOL++;
      console.log(`    ⨯ ${k}  [${LEVELS[m.rank]} · ${m.g}]  ¶${[...m.paras].join(',')}`);
    }
  }
  if (unglossaried.size) {
    console.log(`  UNGLOSSARIED content words (no group, not a function morpheme):`);
    for (const [k, m] of [...unglossaried].sort((a,b)=>b[1].paras.size-a[1].paras.size)) {
      totalUNG++;
      console.log(`    ? ${k}  ¶${[...m.paras].join(',')}`);
    }
  }
}
console.log(`\n──────────\n${stories.length} ${LEVEL} stories scanned · ${storiesWith} with findings`);
console.log(`OUT-OF-LEVEL surfaces: ${totalOOL} · UNGLOSSARIED surfaces: ${totalUNG}`);
console.log(`(UNGLOSSARIED includes basic adverbs the glossary simply lacks — triage: promote-to-glossary vs reword.)`);

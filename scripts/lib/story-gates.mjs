/**
 * scripts/lib/story-gates.mjs
 *
 * The story content gates — extracted from the CLI scripts so BOTH the build-time
 * tools and the (server-side) custom-story generator hold a story to the exact
 * same standard. Operates on story OBJECTS + a shared context (built once), so it
 * runs equally well inside a long-lived server process or a CLI script.
 *
 * Source of truth for:
 *   - validateStory  (← validate-stories.mjs)  schema + token reconstruction
 *   - auditStory     (← audit-story-vocab.mjs) OUT-OF-LEVEL / UNGLOSSARIED vocab
 *   - qaStory        (← qa-story.mjs)          untaught kanji / split / orthography / scope
 *   - deriveAnswerTerms (← derive-answer-terms.mjs) conjugatable answer root ids
 *
 * Build with `buildGateContext({ readFile, root })` once, then call the gates.
 */
import path from 'node:path';
import { buildGlossaryIndex, tokenizeText, reconstructFromTokens } from './tokenize.mjs';

export const SCHEMA_VERSION = '2.0.0';
export const LEVELS = ['N5', 'N4', 'N3'];        // index = difficulty rank
export const LEVEL_RANK = { N5: 0, N4: 1, N3: 2 };

// "N5.7" → { lvl:'N5', idx:7 }
export function parseLessonId(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/^(N[345])\.(\d+)$/);
  return m ? { lvl: m[1], idx: Number(m[2]) } : null;
}

// True if lesson `a` is taught no later than `ceiling` ({lvl,idx} | null).
export function inScope(a, ceiling) {
  if (!a) return true;
  if (!ceiling) return true;
  const ra = LEVEL_RANK[a.lvl] ?? 99;
  const rc = LEVEL_RANK[ceiling.lvl] ?? 99;
  if (ra < rc) return true;
  if (ra > rc) return false;
  return a.idx <= ceiling.idx;
}

// Ceiling for a story given its manifest meta. Custom (paid) stories rank at
// N4-end (N3 out); level/audiostory gate to their unlocksAfter lesson.
export function ceilingForStory(level, unlocksAfter, storyUnlocksAfter) {
  if (level === 'custom') return { lvl: 'N4', idx: Number.MAX_SAFE_INTEGER };
  return parseLessonId(unlocksAfter || storyUnlocksAfter);
}

// ── Context (load everything the gates need, ONCE) ───────────────────────────
export async function buildGateContext({ readFile, root }) {
  const R = root;
  const load = async (p) => JSON.parse(await readFile(path.join(R, p), 'utf8'));
  const entriesOf = (g) => Array.isArray(g)
    ? g : (g.entries || g.particles || g.characters || g.loanwords || []);

  const manifest = await load('manifest.json');
  const conjugationRules = await load('conjugation_rules.json');
  const counterRules = await load('counter_rules.json');

  const GLOSSARY_PATHS = [
    'data/N5/glossary.N5.json', 'data/N4/glossary.N4.json', 'data/N3/glossary.N3.json',
    'shared/particles.json', 'shared/characters.json', 'shared/loanwords.json'
  ].map(p => path.join(R, p));

  const surfaceIdx = await buildGlossaryIndex(
    GLOSSARY_PATHS, (p, enc) => readFile(p, enc),
    { includeReadings: true, conjugationRules, counterRules });

  // id → entry (for token.g lookups)
  const idIdx = new Map();
  for (const [, e] of surfaceIdx) if (e && e.id && !idIdx.has(e.id)) idIdx.set(e.id, e);
  // ALSO index raw entries by id: homograph "losers" (v_me_ordinal vs v_me on
  // 目) never win a surface slot but are legal token.g targets via suffix
  // rules and hand tags.
  for (const gf of GLOSSARY_PATHS) {
    let data; try { data = JSON.parse(await readFile(gf, 'utf8')); } catch { continue; }
    for (const e of (data.entries || [])) {
      if (e && e.id && e.type !== 'kanji' && !idIdx.has(e.id)) idIdx.set(e.id, e);
    }
  }

  // validate: set of resolvable ids (vocab/particle/loanword — NOT characters,
  // matching validate-stories.mjs exactly).
  const glossaryIds = new Set();
  for (const gf of ['data/N5/glossary.N5.json', 'data/N4/glossary.N4.json',
                    'data/N3/glossary.N3.json', 'shared/particles.json', 'shared/loanwords.json']) {
    let data; try { data = await load(gf); } catch { continue; }
    for (const e of (data.entries || data.particles || data.loanwords || [])) if (e.id) glossaryIds.add(e.id);
  }

  // audit: id→rank, approved ids, surface→rank.
  const idRank = {};
  const approvedIds = new Set();
  const surfaceRank = {};
  const noteSurface = (s, r) => { if (s && (!(s in surfaceRank) || r < surfaceRank[s])) surfaceRank[s] = r; };
  // kana reading → its KANJI surface + lowest level rank. Lets the generator tell
  // the difference between "you wrote a taught-kanji word in kana (use the kanji)"
  // and "this word is out of scope (reword it)".
  const readingToEntry = {};
  const noteReading = (reading, surface, r) => {
    if (!reading || !surface || !/[一-鿿]/.test(surface)) return;
    const cur = readingToEntry[reading];
    if (!cur || r < cur.rank) readingToEntry[reading] = { surface, rank: r };
  };
  // Every vocab entry with its lesson — lets the generator build the exact
  // in-scope WORD palette for a learner's ceiling (the "PM handoff").
  const vocabEntries = [];
  for (let r = 0; r < LEVELS.length; r++) {
    for (const e of entriesOf(await load(`data/${LEVELS[r]}/glossary.${LEVELS[r]}.json`))) {
      if (!e) continue;
      if (e.id && !(e.id in idRank)) idRank[e.id] = r;
      noteSurface(e.surface, r);
      if (Array.isArray(e.tokens)) noteSurface(e.tokens.map(t => t.k).join(''), r);
      noteReading(e.reading, e.surface, r);
      if (e.surface) vocabEntries.push({ surface: e.surface, reading: e.reading || '', meaning: e.meaning || '', lesson: parseLessonId(String(e.lesson_ids || e.lesson || '').split(/[,;\s]+/)[0]) });
    }
  }
  // Counter forms (一つ/ひとつ, 三本/さんぼん…) come from the engine, not the glossary —
  // add their kana readings so "ひとつ" → "use 一つ".
  for (const [key, e] of surfaceIdx) {
    if (e && e.type === 'counter' && e.reading) noteReading(e.reading, e.surface || key, 0);
  }
  for (const f of ['shared/particles.json', 'shared/characters.json', 'shared/loanwords.json']) {
    try {
      for (const e of entriesOf(await load(f))) {
        if (!e) continue;
        if (e.id) approvedIds.add(e.id);
        noteSurface(e.surface || e.particle || e.name, -1);
        if (Array.isArray(e.tokens)) noteSurface(e.tokens.map(t => t.k).join(''), -1);
      }
    } catch {}
  }
  const ALL_IDS = [...Object.keys(idRank), ...approvedIds].sort((a, b) => b.length - a.length);

  // deriveAnswerTerms: base (dictionary) ids + conjugation rule keys.
  const baseIds = new Set();
  for (const gf of GLOSSARY_PATHS) {
    let data; try { data = JSON.parse(await readFile(gf, 'utf8')); } catch { continue; }
    for (const e of (data.entries || [])) if (e.id) baseIds.add(e.id);
    for (const e of (data.particles || [])) if (e.id) baseIds.add(e.id);
    for (const c of (data.characters || [])) if (c.id) baseIds.add(c.id);
  }
  const ruleKeys = Object.keys(conjugationRules).sort((a, b) => b.length - a.length);

  // Cast roster (for the generator's character picker + author brief).
  let characters = [];
  try { characters = (JSON.parse(await readFile(path.join(R, 'shared/characters.json'), 'utf8')).characters) || []; } catch {}

  // Always-allowed gairaigo pool (katakana loanwords) — surfaced to the author
  // for genre flavor (they're in-scope: indexed in surfaceIdx + approved).
  let loanwords = [];
  try { loanwords = (JSON.parse(await readFile(path.join(R, 'shared/loanwords.json'), 'utf8')).loanwords || []).map(e => e.surface).filter(Boolean); } catch {}

  // lesson id → vocab surfaces (for the "focus on these lessons" feature) and
  // grammar id → title (for "focus on this grammar"). Both feed the author brief.
  const lessonVocab = {};
  for (const lvl of LEVELS) {
    for (const e of entriesOf(await load(`data/${lvl}/glossary.${lvl}.json`))) {
      if (!e || !e.surface || !e.lesson_ids) continue;
      for (const lid of String(e.lesson_ids).split(/[,;\s]+/).filter(Boolean)) {
        (lessonVocab[lid] = lessonVocab[lid] || []).push(e.surface);
      }
    }
  }
  const grammarTitles = {};
  for (const lvl of Object.keys(manifest.data || {})) {
    for (const g of (manifest.data[lvl].grammar || [])) if (g && g.id) grammarTitles[g.id] = g.title || g.titleJp || g.id;
  }

  return { surfaceIdx, idIdx, glossaryIds, idRank, approvedIds, surfaceRank, readingToEntry, vocabEntries,
           ALL_IDS, baseIds, ruleKeys, manifest, conjugationRules, characters, loanwords, lessonVocab, grammarTitles };
}

// ── validateStory (← validate-stories.mjs) ───────────────────────────────────
export function validateStory(data, ctx) {
  const errors = [];
  const fail = (m) => errors.push(m);
  if (data.schemaVersion !== SCHEMA_VERSION) fail(`schemaVersion must be "${SCHEMA_VERSION}" (got ${JSON.stringify(data.schemaVersion)})`);
  for (const k of ['id', 'title', 'englishTitle', 'paragraphs']) {
    if (data[k] == null || data[k] === '') fail(`missing required field "${k}"`);
  }
  if (!Array.isArray(data.paragraphs)) { fail('paragraphs must be an array'); return { ok: false, errors }; }

  data.paragraphs.forEach((p, i) => {
    if (typeof p.jp !== 'string' || !p.jp) { fail(`paragraphs[${i}].jp missing or empty`); return; }
    if (!Array.isArray(p.tokens) || p.tokens.length === 0) { fail(`paragraphs[${i}].tokens missing or empty`); return; }
    const reconstructed = reconstructFromTokens(p.tokens);
    if (reconstructed !== p.jp) fail(`paragraphs[${i}].tokens reconstructs to "${reconstructed}" but jp is "${p.jp}"`);
    p.tokens.forEach((t, ti) => {
      if (!t || typeof t !== 'object') fail(`paragraphs[${i}].tokens[${ti}] is not an object`);
      else if (typeof t.k !== 'string') fail(`paragraphs[${i}].tokens[${ti}].k must be a string`);
      else if (t.r != null && typeof t.r !== 'string') fail(`paragraphs[${i}].tokens[${ti}].r must be a string when present`);
      else if (t.g != null && typeof t.g !== 'string') fail(`paragraphs[${i}].tokens[${ti}].g must be a string when present`);
    });
  });

  for (const list of ['vocabUsed', 'grammarUsed']) {
    if (data[list] == null) continue;
    if (!Array.isArray(data[list])) { fail(`${list} must be an array`); continue; }
    data[list].forEach((id, i) => {
      if (typeof id !== 'string') fail(`${list}[${i}] must be a string`);
      else if (!ctx.glossaryIds.has(id)) fail(`${list}[${i}] = "${id}" not found in glossary`);
    });
  }

  if (data.comprehension) {
    const c = data.comprehension;
    if (!Array.isArray(c.questions)) fail('comprehension.questions must be an array (empty is OK)');
    else c.questions.forEach((q, i) => {
      if (typeof q.q !== 'string' || !q.q) fail(`comprehension.questions[${i}].q missing`);
      const isWritten = typeof q.answer === 'string' && q.answer.length > 0;
      const isMcq = Array.isArray(q.options);
      if (isWritten) {
        if (q.accept != null && (!Array.isArray(q.accept) || q.accept.some(x => typeof x !== 'string'))) fail(`comprehension.questions[${i}].accept must be an array of strings`);
        if (q.terms != null && (!Array.isArray(q.terms) || q.terms.some(x => typeof x !== 'string'))) fail(`comprehension.questions[${i}].terms must be an array of strings`);
      } else if (isMcq) {
        if (q.options.length < 2) fail(`comprehension.questions[${i}].options must have 2+ entries`);
        if (typeof q.correct !== 'number' || q.correct < 0 || q.correct >= (q.options || []).length) fail(`comprehension.questions[${i}].correct must be a valid index into options`);
      } else fail(`comprehension.questions[${i}] must have either options[]+correct (mcq) or answer (written)`);
    });
  }
  return { ok: errors.length === 0, errors };
}

// ── auditStory (← audit-story-vocab.mjs) ─────────────────────────────────────
const GRAMMAR_SUFFIX_IDS = new Set(['v_sugiru']);
const FUNCTION_ALLOWLIST = new Set([
  'だ','です','でした','じゃ','では','である','だった','だろう','でしょう','だと','だそう','だそうです','でして',
  'ます','ました','ません','ましょう','まして','ましたら','ましたが',
  'いる','いた','いて','います','いました','いません','ています','ている','ていました','ていて','ている',
  'ある','あった','あって','あります','ありました','ありません','あろう',
  'なる','なった','なって','なります','なりました',
  'する','した','して','します','しました','しよう',
  'て','って','で','ないで','なくて','ない','なかった','なき','ず','ぬ',
  'ください','くださいません','ちゃ','じゃう',
  'か','ね','よ','わ','の','さ','ぞ','な','かな','かしら','っけ','んだ','んです','の。',
  'でも','それから','そして','しかし','だから','それで','ので','のに','から','けど','けれど','が','し','ても','たり',
  'ばかり','だけ','しか','みたい','みたいに','みたいな','みたいだ','みたいです','そう','そうだ','そうです','よう','ように','ような','ようになりました',
  'について','くらい','ぐらい','ほど','なら','たら','れば','ば','ながら','まえに','てから','ため','ために','こと','という',
  'この','その','あの','どの','ここ','そこ','あそこ','どこ','これ','それ','あれ','どれ',
  'こう','ああ','どう','こんな','そんな','あんな','どんな','なに','なん','いつ','だれ','どれ',
]);
const auditIsKana = (s) => /^[ぁ-んァ-ヶー]+$/.test(s);
const auditIsPunct = (s) => /^[、。「」『』！？…・〜（）\s\.\-]+$/.test(s);

// storyRank: 0/1/2 (custom → 1, i.e. N4-end).
export function auditStory(data, ctx, storyRank) {
  const baseId = (g) => {
    if (g in ctx.idRank || ctx.approvedIds.has(g)) return g;
    for (const id of ctx.ALL_IDS) if (g === id || g.startsWith(id + '_')) return id;
    return g;
  };
  const outOfLevel = new Map();
  const unglossaried = new Map();
  (data.paragraphs || []).forEach((p, pi) => {
    for (const t of (p.tokens || [])) {
      const k = t.k || '';
      if (auditIsPunct(k) || !k) continue;
      if (FUNCTION_ALLOWLIST.has(k)) continue;
      if (auditIsKana(k) && k.length === 1) continue;
      if (t.g && GRAMMAR_SUFFIX_IDS.has(baseId(t.g))) continue;
      if (t.g && /^count_/.test(t.g)) continue;
      const gRank = t.g ? ctx.idRank[baseId(t.g)] : undefined;
      const sRank = ctx.surfaceRank[k];
      const ranks = [gRank, sRank].filter(r => r != null);
      const known = ranks.length ? Math.min(...ranks) : undefined;
      if (known === undefined) {
        const m = unglossaried.get(k) || { paras: new Set() };
        m.paras.add(pi + 1); unglossaried.set(k, m);
      } else if (known > storyRank) {
        const g = t.g ? baseId(t.g) : '(by surface)';
        const m = outOfLevel.get(k) || { rank: known, g, paras: new Set() };
        m.paras.add(pi + 1); outOfLevel.set(k, m);
      }
    }
  });
  return { outOfLevel, unglossaried };
}

// ── qaStory (← qa-story.mjs) ─────────────────────────────────────────────────
const QA_KANA_ONLY = /^[぀-ヿー]+$/;
const QA_PUNCT_ONLY = /^[、。！？「」『』（）：；・…\s「」\-—()『』]+$/;
const SPLIT_UNITS = { 'とき': 'use 時', 'もの': 'use 物' };
const ORTHO_PAIRS = [['次', 'つぎ'], ['時', 'とき']];

export function buildTaughtKanji(manifest, ceiling) {
  const set = new Set();
  for (const lvl of ['N5', 'N4', 'N3']) {
    const data = manifest.data && manifest.data[lvl];
    if (!data) continue;
    for (const lesson of data.lessons || []) {
      const lid = parseLessonId(lesson.id);
      if (!lid || !inScope(lid, ceiling)) continue;
      for (const k of lesson.kanji || []) set.add(k);
    }
  }
  return set;
}

function emptyV() {
  return { untagged: [], vocab: [], particle: [], form: [], kanji: [], unknownId: [], split: [], orthography: [] };
}

// `meta` = { level, unlocksAfter } (for ceiling + report labels).
export function qaStory(story, ctx, meta) {
  const { idIdx, surfaceIdx, manifest, conjugationRules } = ctx;
  const ceiling = ceilingForStory(meta.level, meta.unlocksAfter, story.unlocksAfter);
  const taughtKanji = buildTaughtKanji(manifest, ceiling);
  const violations = emptyV();

  const classifyToken = (t) => {
    const k = t.k || '';
    if (!k) return { kind: 'empty' };
    if (QA_PUNCT_ONLY.test(k)) return { kind: 'punct' };
    if (t.g) {
      const entry = idIdx.get(t.g);
      if (!entry) {
        // Homograph-loser synth (v_hiraku_te_form lost 開いて's surface slot
        // to v_aku_2_te_form): resolve <root>_<formKey> by trying every
        // known-id prefix, longest first.
        const parts = t.g.split('_');
        for (let n = parts.length - 1; n >= 1; n--) {
          const root = idIdx.get(parts.slice(0, n).join('_'));
          if (root) {
            return { kind: 'g', g: t.g, entry: { ...root, _ruleKey: parts.slice(n).join('_'), original_id: root.id } };
          }
        }
        return { kind: 'g-unknown', g: t.g, root: null };
      }
      return { kind: 'g', g: t.g, entry };
    }
    const entry = surfaceIdx.get(k);
    if (entry && entry.id) return { kind: 'surface', g: entry.id, entry };
    if (k.length === 1 && QA_KANA_ONLY.test(k)) return { kind: 'bare-kana' };
    return { kind: 'untagged', k };
  };
  const entryLessonId = (e) => {
    if (!e) return null;
    if (typeof e.lesson_ids === 'string') { const p = parseLessonId(e.lesson_ids.split(/[,;\s]+/)[0]); if (p) return p; }
    if (typeof e.lesson === 'string') { const p = parseLessonId(e.lesson); if (p) return p; }
    if (typeof e.introducedIn === 'string') { const p = parseLessonId(e.introducedIn); if (p) return p; }
    return null;
  };
  const synthFormScope = (entry) => {
    if (!entry || entry.type !== 'inflected') return null;
    const formKey = entry._ruleKey;
    if (!formKey) return null;
    const rule = conjugationRules[formKey];
    if (!rule) return { formKey, intro: null, violation: false };
    const intro = parseLessonId(rule.introducedIn);
    return { formKey, intro, violation: intro && !inScope(intro, ceiling) };
  };
  const uA = meta.unlocksAfter;

  // Narration kanji (deduped).
  const seenKanji = new Set();
  for (const p of story.paragraphs || []) {
    for (const ch of p.jp || '') {
      if (/[一-鿿㐀-䶿]/.test(ch) && !seenKanji.has(ch)) {
        seenKanji.add(ch);
        if (!taughtKanji.has(ch)) violations.kanji.push({ ch, paragraph: p.jp.slice(0, 40) + '…' });
      }
    }
  }

  // Narration tokens.
  (story.paragraphs || []).forEach((p, pi) => {
    for (const t of p.tokens || []) {
      const c = classifyToken(t);
      if (c.kind === 'untagged') { violations.untagged.push({ p: pi + 1, k: c.k }); continue; }
      if (c.kind === 'g-unknown') { violations.unknownId.push({ p: pi + 1, g: c.g, k: t.k }); continue; }
      const entry = c.entry;
      if (!entry) continue;
      if (entry.particle || (entry.id && entry.id.startsWith('p_'))) {
        const lid = parseLessonId(entry.introducedIn);
        if (lid && !inScope(lid, ceiling)) violations.particle.push({ p: pi + 1, k: t.k, id: entry.id, intro: entry.introducedIn, ceiling: uA });
        continue;
      }
      if (entry.type === 'character') continue;
      if (entry.type === 'inflected') {
        const f = synthFormScope(entry);
        if (f && f.violation) violations.form.push({ p: pi + 1, k: t.k, id: entry.id, form: f.formKey, intro: conjugationRules[f.formKey]?.introducedIn, ceiling: uA });
        const root = idIdx.get(entry.original_id);
        if (root) { const rid = entryLessonId(root); if (rid && !inScope(rid, ceiling)) violations.vocab.push({ p: pi + 1, k: t.k, id: root.id, lesson: root.lesson_ids || root.lesson, ceiling: uA }); }
        continue;
      }
      const lid = entryLessonId(entry);
      if (lid && !inScope(lid, ceiling)) violations.vocab.push({ p: pi + 1, k: t.k, id: entry.id, lesson: entry.lesson_ids || entry.lesson, ceiling: uA });
    }
  });

  // Comprehension kanji (q/answer/explanation).
  const seenQKanji = new Set();
  for (const q of (story.comprehension && story.comprehension.questions) || []) {
    for (const field of ['q', 'answer', 'explanation']) {
      for (const ch of (q[field] || '')) {
        if (/[一-鿿㐀-䶿]/.test(ch) && !seenQKanji.has(ch)) {
          seenQKanji.add(ch);
          if (!taughtKanji.has(ch)) violations.kanji.push({ ch, paragraph: `[Q.${field}] ${(q[field] || '').slice(0, 30)}…` });
        }
      }
    }
  }

  // Spoken comprehension `q` scope (live-tokenized).
  for (const q of (story.comprehension && story.comprehension.questions) || []) {
    for (const t of tokenizeText(q.q || '', surfaceIdx)) {
      const c = classifyToken(t);
      const entry = c.entry;
      if (!entry) continue;
      if (entry.particle || (entry.id && String(entry.id).startsWith('p_'))) {
        const lid = parseLessonId(entry.introducedIn);
        if (lid && !inScope(lid, ceiling)) violations.particle.push({ p: 'Q', k: t.k, id: entry.id, intro: entry.introducedIn, ceiling: uA });
        continue;
      }
      if (entry.type === 'character') continue;
      if (entry.type === 'inflected') {
        const f = synthFormScope(entry);
        if (f && f.violation) violations.form.push({ p: 'Q', k: t.k, id: entry.id, form: f.formKey, intro: conjugationRules[f.formKey]?.introducedIn, ceiling: uA });
        const root = idIdx.get(entry.original_id);
        if (root) { const rid = entryLessonId(root); if (rid && !inScope(rid, ceiling)) violations.vocab.push({ p: 'Q', k: t.k, id: root.id, lesson: root.lesson_ids || root.lesson, ceiling: uA }); }
        continue;
      }
      const lid = entryLessonId(entry);
      if (lid && !inScope(lid, ceiling)) violations.vocab.push({ p: 'Q', k: t.k, id: entry.id, lesson: entry.lesson_ids || entry.lesson, ceiling: uA });
    }
  }

  // Split kana chips.
  const isCounter = (t) => !!t && ((t.g && String(t.g).startsWith('count_')) || /(?:人|つ|本|個|回|匹|台)$/.test(t.k || ''));
  (story.paragraphs || []).forEach((p, pi) => {
    const ts = p.tokens || [];
    for (let j = 0; j < ts.length - 1; j++) {
      const a = ts[j], b = ts[j + 1];
      if ((a.k || '').length !== 1 || (b.k || '').length !== 1) continue;
      const two = (a.k || '') + (b.k || '');
      if (SPLIT_UNITS[two] && !a.g && !b.g) violations.split.push({ p: pi + 1, k: two, fix: SPLIT_UNITS[two] });
      else if (two === 'とも' && !a.g && !b.g && isCounter(ts[j - 1])) violations.split.push({ p: pi + 1, k: (ts[j - 1].k || '') + 'とも', fix: 'reword (…も…も / は)' });
    }
  });

  // Orthography consistency.
  const allText = (story.paragraphs || []).map(p => p.jp || '').join('') +
    ((story.comprehension && story.comprehension.questions) || []).map(q => [q.q, q.answer, q.explanation].join('')).join('');
  for (const [kj, kn] of ORTHO_PAIRS) {
    if (allText.includes(kj) && allText.includes(kn)) violations.orthography.push({ pair: kj + '/' + kn });
  }

  const ok = Object.values(violations).every(arr => arr.length === 0);
  return { violations, ok };
}

// ── deriveAnswerTerms (← derive-answer-terms.mjs) ────────────────────────────
export function deriveAnswerTerms(answer, ctx, ceilingStr) {
  const toRoot = (g) => {
    if (!g) return null;
    if (g.startsWith('count_')) return g;
    const dbl = g.indexOf('__');
    if (dbl !== -1) { const r = g.slice(0, dbl); if (ctx.baseIds.has(r)) return r; }
    for (const k of ctx.ruleKeys) {
      if (g.endsWith('_' + k)) { const root = g.slice(0, -(k.length + 1)); if (ctx.baseIds.has(root)) return root; }
    }
    return g;
  };
  const toks = tokenizeText(String(answer || ''), ctx.surfaceIdx, { ceiling: ceilingStr });
  const out = [], seen = new Set();
  for (const t of toks) {
    if (!t.g) continue;
    const r = toRoot(t.g);
    if (r && !seen.has(r)) { seen.add(r); out.push(r); }
  }
  return out;
}

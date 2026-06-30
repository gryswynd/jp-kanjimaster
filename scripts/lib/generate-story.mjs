/**
 * scripts/lib/generate-story.mjs
 *
 * The custom-story generation pipeline, reused by both a local test harness and
 * the rikizo-story-gen Cloud Run service. Pure-ish: Claude access is INJECTED
 * (`anthropicCall`) so it's testable/mockable and the module carries no SDK dep.
 *
 * Flow: build author brief → Claude authors JSON → tokenize each paragraph →
 * run the SAME gates a hand-authored story faces (validate/audit/qa via
 * story-gates.mjs) → on any violation, feed a structured fix-list back to Claude
 * and regenerate (bounded rounds) → derive aTerms → return the story + token usage.
 *
 * Returns { ok, story, usage:{inputTokens,outputTokens}, rounds, violations }.
 */
import {
  validateStory, auditStory, qaStory, deriveAnswerTerms,
  buildTaughtKanji, parseLessonId, LEVELS, LEVEL_RANK,
} from './story-gates.mjs';
import { tokenizeText, reconstructFromTokens } from './tokenize.mjs';

// Level rank of a token's group id (glossary entries only; particles/characters/
// loanwords aren't ranked → in scope). Strips conjugation/counter suffixes.
function gLevelRank(g, ctx) {
  if (!g || g.startsWith('count_')) return null;
  if (g in ctx.idRank) return ctx.idRank[g];
  const base = ctx.ALL_IDS.find(id => g === id || g.startsWith(id + '_'));
  return base != null ? ctx.idRank[base] : null;
}

const MAX_ROUNDS = 6;

// Common interjections / fillers that are natural in dialogue but aren't glossary
// vocab — they render fine as plain kana, so don't make the author strip them
// (that hurt convergence: the model kept reaching for ねえ/ああ/etc.). The most
// common ones (はい/ええ/うん/おい…) are real glossary entries; this covers the
// long tail the glossary doesn't carry.
const INTERJECTION_OK = new Set([
  'ねえ', 'ねぇ', 'なあ', 'なぁ', 'ああ', 'あぁ', 'ううん', 'へえ', 'へぇ',
  'わあ', 'わぁ', 'おお', 'あれ', 'あら', 'まあ', 'やあ', 'よし', 'うわ', 'うわあ', 'ほら', 'さあ',
  'ふう', 'ふうん', 'うーん', 'ええと', 'えっと', 'あのう', 'おおっ', 'はあ', 'ふふ', 'あはは',
]);

// Grammatical helper verbs that are written in kana in their taught forms — the
// ～てみる / ～てしまう / ～ておく / ～ていく / ～てくる auxiliaries (G24-era grammar).
// They're short kana so the tokenizer doesn't resolve them, but they're correct
// and render fine; don't make the author strip natural grammar (it can't win:
// the kanji forms 見る/置く/etc. are a different meaning, and kana is "untagged").
const GRAMMAR_KANA_OK = new Set([
  'みる', 'みて', 'みた', 'みよう', 'みない', 'みなかった', 'みます', 'みました', 'みません', 'みる。',
  'しまう', 'しまって', 'しまった', 'しまいます', 'しまいました', 'ちゃう', 'ちゃった', 'じゃう', 'じゃった',
  'おく', 'おいて', 'おいた', 'おきます', 'おきました',
  'いく', 'いって', 'いった', 'いきます', 'くる', 'きて', 'きた', 'きます',
  'ろう', 'だろう', 'でしょう',   // copula conjecture / volitional tail (だろう→だ+ろう split)
]);
function isOkKana(k) { return INTERJECTION_OK.has(k) || GRAMMAR_KANA_OK.has(k); }

// Out-of-curriculum words that the model reaches for in titles (mystery tropes
// especially). They tokenize as bare kana / untaught kanji and slip the audit,
// so gate them explicitly. Value = the suggested in-level replacement.
const TITLE_STOPLIST = {
  'なぞ': '問題 (mondai) or rephrase', '謎': '問題 (mondai) or rephrase',
  '事件': '問題 or rephrase', 'じけん': '問題 or rephrase',
  '秘密': 'reword with in-level vocabulary', 'ひみつ': 'reword with in-level vocabulary',
};

// Pull the first balanced {...} JSON object out of a model reply (tolerates
// ```json fences / stray prose).
function parseJsonObject(text) {
  if (!text) throw new Error('empty model reply');
  let s = text.indexOf('{');
  if (s < 0) throw new Error('no JSON object in reply');
  let depth = 0, inStr = false, esc = false;
  for (let i = s; i < text.length; i++) {
    const ch = text[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return JSON.parse(text.slice(s, i + 1)); }
  }
  throw new Error('unterminated JSON object in reply');
}

// Structured scope/level/structure problems for a candidate story. Each is
// { scope:'paragraph'|'title'|'comprehension'|'length'|'schema', index, msg }
// so the repair can target ONLY the affected pieces (no whole-story regen).
// `index` is a 1-based paragraph number for scope 'paragraph', else null.
function collectViolations(story, ctx, { vocabLevel, ceiling, gateMeta, ceilingStr, minParagraphs }) {
  const out = [];
  const add = (scope, index, msg) => out.push({ scope, index, msg });
  const vocabRank = LEVELS.indexOf(vocabLevel) >= 0 ? LEVELS.indexOf(vocabLevel) : 1;
  const paras = story.paragraphs || [];
  const paraOfKanji = (ch) => { const i = paras.findIndex(p => (p.jp || '').includes(ch)); return i >= 0 ? i + 1 : null; };

  // Length floor — pages drive pricing, so too-short must reliably expand.
  const np = paras.length;
  if (minParagraphs && np < minParagraphs) add('length', null, `Only ${np} paragraphs; needs at least ${minParagraphs}.`);

  // Title scope (the qa gate skips titles).
  if (story.title) {
    const tStory = { paragraphs: [{ jp: story.title, tokens: tokenizeText(story.title, ctx.surfaceIdx, { ceiling: ceilingStr }) }] };
    const ta = auditStory(tStory, ctx, vocabRank);
    for (const [surface] of ta.outOfLevel) add('title', null, `out-of-level word "${surface}" — use ${vocabLevel}-or-below vocab`);
    for (const [surface] of ta.unglossaried) add('title', null, `"${surface}" isn't in the curriculum — use taught vocabulary`);
    for (const [word, fix] of Object.entries(TITLE_STOPLIST)) if (story.title.includes(word)) add('title', null, `uses "${word}" (out of scope) — use ${fix}`);
    const taught = buildTaughtKanji(ctx.manifest, ceiling);
    for (const ch of story.title) if (/[一-鿿㐀-䶿]/.test(ch) && !taught.has(ch)) add('title', null, `kanji 「${ch}」 isn't taught — use kana or a different word`);
  }

  // Reconstruction (a paragraph's tokens didn't rebuild its jp).
  paras.forEach((p, i) => { if (reconstructFromTokens(p.tokens || []) !== p.jp) add('paragraph', i + 1, `a chunk didn't tokenize cleanly — reword it`); });

  // Schema (rare after round 1; treat as a structural problem).
  const v = validateStory(story, ctx);
  if (!v.ok) for (const e of v.errors.slice(0, 6)) add('schema', null, e);

  // Out-of-level vocab (audit) — attributed to each paragraph it appears in.
  const a = auditStory(story, ctx, vocabRank);
  for (const [surface, m] of a.outOfLevel) for (const pi of m.paras) add('paragraph', pi, `out-of-level word "${surface}" — use a ${vocabLevel}-or-below word`);

  // qa: untaught kanji / out-of-scope / split / orthography (at the student ceiling).
  const q = qaStory(story, ctx, gateMeta);
  for (const k of dedupe(q.violations.kanji, x => x.ch).slice(0, 16)) {
    if (/^\[Q/.test(k.paragraph)) add('comprehension', null, `untaught kanji 「${k.ch}」 — write that word in kana`);
    else add('paragraph', paraOfKanji(k.ch), `untaught kanji 「${k.ch}」 — write that word in kana`);
  }
  const paraOrComp = (p) => (p === 'Q' ? ['comprehension', null] : ['paragraph', p]);
  for (const x of dedupe(q.violations.vocab, x => x.p + x.id).slice(0, 16)) { const [s, i] = paraOrComp(x.p); add(s, i, `out-of-scope word "${x.k}" — use a simpler in-level word`); }
  for (const x of q.violations.untagged.slice(0, 16)) if (!isOkKana(x.k)) { const [s, i] = paraOrComp(x.p); add(s, i, `"${x.k}" isn't a recognized word — reword it`); }
  for (const x of q.violations.split) { const [s, i] = paraOrComp(x.p); add(s, i, `"${x.k}" — ${x.fix}`); }
  for (const x of q.violations.form.slice(0, 10)) { const [s, i] = paraOrComp(x.p); add(s, i, `grammar form "${x.k}" is taught later — use a simpler form`); }
  for (const x of q.violations.particle.slice(0, 10)) { const [s, i] = paraOrComp(x.p); add(s, i, `particle "${x.k}" is taught later — rephrase (e.g. 〜って → 〜と)`); }
  for (const x of q.violations.orthography) add('paragraph', null, `spelling inconsistency ${x.pair} — pick one spelling throughout`);

  // Out-of-level words the ceiling-biased tokenizer hid by splitting (ことば=N3 → こと+ば).
  const ceilingRank = ceiling ? (LEVEL_RANK[ceiling.lvl] != null ? LEVEL_RANK[ceiling.lvl] : 1) : 1;
  const seenOOL = new Set();
  paras.forEach((p, i) => {
    for (const t of tokenizeText(p.jp || '', ctx.surfaceIdx)) {
      if (!t.g) continue;
      const r = gLevelRank(t.g, ctx);
      if (r == null || r <= ceilingRank) continue;
      const key = (i + 1) + ':' + t.k;
      if (seenOOL.has(key)) continue;
      seenOOL.add(key);
      add('paragraph', i + 1, `out-of-level word "${t.k}" (taught in ${LEVELS[r] || 'N3'}) — replace with an in-level word`);
    }
  });

  return out;
}
function dedupe(rows, keyFn) {
  const seen = new Set(), out = [];
  for (const r of rows) { const k = keyFn(r); if (!seen.has(k)) { seen.add(k); out.push(r); } }
  return out;
}

// Bake one paragraph (tokenize) / one comprehension question (aTerms).
function bakeParagraph(jp, en, params, ctx) {
  return { jp: String(jp || ''), en: String(en || ''), tokens: tokenizeText(String(jp || ''), ctx.surfaceIdx, { ceiling: params.ceilingStr }) };
}
function bakeQuestion(q, params, ctx) {
  const out = { type: 'written', q: String(q.q || ''), q_en: String(q.q_en || ''), answer: String(q.answer || ''), explanation: String(q.explanation || '') };
  out.aTerms = deriveAnswerTerms(out.answer, ctx, params.ceilingStr);
  return out;
}

// Turn the author's JSON into a schema-2.0.0 story object with baked tokens + aTerms.
function assembleStory(raw, params, ctx) {
  const paragraphs = (raw.paragraphs || []).map(p => bakeParagraph(p.jp, p.en, params, ctx));
  const questions = (raw.comprehension || []).map(q => bakeQuestion(q, params, ctx));
  return {
    schemaVersion: '2.0.0',
    id: params.id,
    title: String(raw.title || ''),
    englishTitle: String(raw.englishTitle || ''),
    category: 'custom',
    level: null,
    unlocksAfter: null,
    paragraphs,
    vocabUsed: [],
    grammarUsed: [],
    comprehension: { intro: 'Did you follow the story?', questions },
  };
}

function buildBrief(params, ctx) {
  const ceiling = params.ceiling;
  const kanji = [...buildTaughtKanji(ctx.manifest, ceiling)].sort();
  const cast = (params.castIds || [])
    .map(id => (ctx.characters || []).find(c => c.id === id))
    .filter(Boolean)
    .map(c => `- ${c.surface} (${c.meaning}): ${c.description}`)
    .join('\n');
  // Focus words = flagged words + vocab drawn from the lessons the learner chose
  // to reinforce (capped so the brief stays lean).
  const lessonWords = [];
  for (const lid of (params.focusLessons || [])) {
    for (const w of (ctx.lessonVocab && ctx.lessonVocab[lid]) || []) lessonWords.push(w);
  }
  const allFocus = [];
  const seenF = new Set();
  for (const w of [...(params.focusWords || []), ...lessonWords]) {
    if (w && !seenF.has(w)) { seenF.add(w); allFocus.push(w); }
  }
  const focus = allFocus.slice(0, 50).join('、');
  const focusGrammar = (params.focusGrammar || [])
    .map(id => (ctx.grammarTitles && ctx.grammarTitles[id]) ? `${id} (${ctx.grammarTitles[id]})` : id)
    .join('; ');
  const lines = [
    `Write a graded-reader story of ${params.targetParagraphs} paragraphs` +
      (params.minParagraphs ? ` (this is important: NO FEWER than ${params.minParagraphs} paragraphs)` : '') + '.',
    `Each paragraph should be a full beat of 2–4 sentences — not one-liners — so the story has real substance.`,
    '',
    `THEME(S): ${(params.themes || []).join(', ') || 'slice of life'}.`,
    params.tone ? `TONE: ${params.tone}.` : '',
    '',
    'CAST (use these characters by their Japanese names):',
    cast || '- (narrator only)',
    '',
    `VOCAB LEVEL: ${params.vocabLevel} or below (this is the hard ceiling — no harder vocab).`,
    `GRAMMAR GATE: up to and including ${params.grammarGate}. Do not use grammar taught after it.`,
    '',
    `ALLOWED KANJI (use ONLY these; write every other word in kana):`,
    kanji.join(''),
    '',
    focus ? `FOCUS WORDS (weave these in naturally, repeat where it fits): ${focus}` : '',
    focusGrammar ? `FOCUS GRAMMAR (make sure the story uses these patterns): ${focusGrammar}` : '',
    (function () {
      const genre = (params.themes || []).filter(t => /fantasy|sci-?fi|horror|adventure|period/i.test(t));
      if (!genre.length) return '';
      const pool = (ctx.loanwords || []);
      const sample = ['ヒーロー', 'モンスター', 'レベル', 'ゲーム', 'ロボット', 'エネルギー', 'チーム', 'パワー', 'ドア', 'ベル']
        .filter(w => pool.indexOf(w) >= 0);
      return `GENRE FLAVOR: authentic Japanese katakana loanwords (gairaigo) are IN SCOPE and encouraged for ${genre.join('/')} — use real, common ones where they fit${sample.length ? ` (e.g. ${sample.join('、')})` : ''}. Write them in katakana.`;
    })(),
    params.includeComprehension
      ? `\nEnd with ${params.numQuestions || 4} short-answer (written) comprehension questions.`
      : `\nNo comprehension questions (use an empty array).`,
    '',
    'Return ONLY the JSON object described in your instructions.',
  ];
  return lines.filter(l => l !== '').join('\n');
}

/**
 * @param {object}   opts
 * @param {object}   opts.params  generation parameters (see buildBrief / assembleStory)
 * @param {object}   opts.ctx     buildGateContext() result (+ characters)
 * @param {function} opts.anthropicCall  async ({system, messages, maxTokens}) =>
 *                                        { text, usage:{inputTokens,outputTokens} }
 * @param {string}   opts.authorSystem   the static author system prompt (author.v1.md)
 * @param {function} [opts.log]
 */
export async function generateStory({ params, ctx, anthropicCall, authorSystem, log = () => {} }) {
  // Gate ceiling: a real student lesson gates precisely; otherwise custom = N4-end.
  const gateMeta = (params.ceiling && params.ceiling.idx !== Number.MAX_SAFE_INTEGER)
    ? { level: params.ceiling.lvl, unlocksAfter: `${params.ceiling.lvl}.${params.ceiling.idx}` }
    : { level: 'custom', unlocksAfter: null };

  const usage = { inputTokens: 0, outputTokens: 0 };
  const addUsage = (u) => { usage.inputTokens += u?.inputTokens || 0; usage.outputTokens += u?.outputTokens || 0; };
  const vopts = { vocabLevel: params.vocabLevel, ceiling: params.ceiling, gateMeta, ceilingStr: params.ceilingStr, minParagraphs: params.minParagraphs };
  const call = async (msgs, maxTokens) => { const r = await anthropicCall({ system: authorSystem, messages: msgs, maxTokens }); addUsage(r.usage); return r.text; };

  // Longer stories have more surface area for scope edge-cases → more rounds.
  const maxRounds = Math.min(9, MAX_ROUNDS + Math.floor((params.targetParagraphs || 8) / 8));

  // ── Round 1: full generation ──────────────────────────────────────────────
  let story;
  {
    let text = await call([{ role: 'user', content: buildBrief(params, ctx) }], 4000);
    let raw;
    try { raw = parseJsonObject(text); }
    catch (e) {
      text = await call([{ role: 'user', content: buildBrief(params, ctx) }, { role: 'assistant', content: text }, { role: 'user', content: 'That was not valid JSON. Reply with ONLY the JSON object, no prose or fences.' }], 4000);
      raw = parseJsonObject(text);
    }
    story = assembleStory(raw, params, ctx);
  }
  let violations = collectViolations(story, ctx, vopts);
  log(`round 1: ${story.paragraphs.length} paragraphs, ${violations.length} violation(s)`);
  if (!violations.length) return { ok: true, story, usage, rounds: 1, violations: [] };

  // ── Repair rounds: fix ONLY the flagged pieces (no whole-story regen) ──────
  const compactStory = () => 'Title: ' + story.title + '\n' + story.paragraphs.map((p, i) => (i + 1) + '. ' + p.jp).join('\n');

  for (let round = 2; round <= maxRounds; round++) {
    const lengthViol = violations.find(v => v.scope === 'length');
    try {
      if (lengthViol) {
        // Expand: ask for ADD-ONLY new paragraphs that continue the story.
        const need = params.minParagraphs || (params.targetParagraphs || 8);
        const addN = Math.max(2, need - story.paragraphs.length + 1);
        const req = `The story is too short (${story.paragraphs.length} paragraphs; needs at least ${need}). Continue it with ${addN} MORE paragraphs that flow naturally from the current ending — same characters, theme, and scope (2–4 sentences each). Return ONLY {"paragraphs":[{"jp":"…","en":"…"}]} containing JUST the new paragraphs.\n\nCURRENT ENDING:\n` + story.paragraphs.slice(-4).map(p => p.jp).join('\n');
        const fix = parseJsonObject(await call([{ role: 'user', content: req }], 2500));
        for (const np of (fix.paragraphs || [])) if (np && np.jp) story.paragraphs.push(bakeParagraph(np.jp, np.en, params, ctx));
      } else {
        // Targeted splice: rewrite only flagged paragraphs / title / comprehension.
        const byPara = new Map(); const titleMsgs = []; const compMsgs = []; const generalMsgs = [];
        for (const v of violations) {
          if (v.scope === 'title') titleMsgs.push(v.msg);
          else if (v.scope === 'comprehension') compMsgs.push(v.msg);
          else if (v.scope === 'paragraph' && v.index) { if (!byPara.has(v.index)) byPara.set(v.index, []); byPara.get(v.index).push(v.msg); }
          else generalMsgs.push(v.msg);   // schema / orthography / unindexed
        }
        const flagged = [...byPara.keys()].sort((a, b) => a - b);
        let req = 'Fix ONLY the listed problems in this story and return a JSON object with just the changed pieces:\n' +
          '{ "title": "…" (only if a Title fix is listed), "paragraphs": [{"index":N,"jp":"…","en":"…"}] (only the listed paragraphs), "comprehension": [{"q":"…","q_en":"…","answer":"…","explanation":"…"}] (ALL questions, only if a Comprehension fix is listed) }\n\n' +
          'CURRENT STORY:\n' + compactStory() + '\n\nPROBLEMS TO FIX:\n';
        if (titleMsgs.length) req += '- Title: ' + titleMsgs.join('; ') + '\n';
        for (const idx of flagged) req += `- Paragraph ${idx}: ${byPara.get(idx).join('; ')}\n`;
        if (generalMsgs.length) req += '- Overall (apply across the story): ' + generalMsgs.join('; ') + '\n';
        if (compMsgs.length) req += `- Comprehension (return ALL ${params.numQuestions || (story.comprehension.questions || []).length} questions): ${compMsgs.join('; ')}\n`;
        req += '\nKeep every unflagged paragraph EXACTLY as-is. Stay strictly in scope.';

        const fix = parseJsonObject(await call([{ role: 'user', content: req }], 3000));
        if (fix.title && titleMsgs.length) story.title = String(fix.title);
        for (const fp of (fix.paragraphs || [])) {
          const i = (parseInt(fp.index, 10) || 0) - 1;
          if (i >= 0 && i < story.paragraphs.length && fp.jp) story.paragraphs[i] = bakeParagraph(fp.jp, fp.en || story.paragraphs[i].en, params, ctx);
        }
        if (compMsgs.length && Array.isArray(fix.comprehension) && fix.comprehension.length) {
          story.comprehension.questions = fix.comprehension.map(q => bakeQuestion(q, params, ctx));
        }
      }
    } catch (e) {
      log(`round ${round}: repair parse failed (${e.message})`);
      continue;   // try again next round with the same violations
    }

    violations = collectViolations(story, ctx, vopts);
    log(`round ${round}: ${story.paragraphs.length} paragraphs, ${violations.length} violation(s)`);
    if (!violations.length) return { ok: true, story, usage, rounds: round, violations: [] };
  }

  return { ok: false, story, usage, rounds: maxRounds, violations: violations.map(v => v.msg) };
}

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
  buildTaughtKanji, parseLessonId, inScope, LEVELS, LEVEL_RANK,
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
  const ceilingRank = ceiling ? (LEVEL_RANK[ceiling.lvl] != null ? LEVEL_RANK[ceiling.lvl] : 1) : 1;
  const taughtKanji = buildTaughtKanji(ctx.manifest, ceiling);
  const allKanjiTaught = (s) => [...String(s || '')].every(ch => !/[一-鿿]/.test(ch) || taughtKanji.has(ch));
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
    for (const ch of story.title) if (/[一-鿿㐀-䶿]/.test(ch) && !taughtKanji.has(ch)) add('title', null, `kanji 「${ch}」 isn't taught — use kana or a different word`);
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
  for (const x of q.violations.untagged.slice(0, 16)) {
    if (isOkKana(x.k)) continue;
    const [s, i] = paraOrComp(x.p);
    const re = ctx.readingToEntry && ctx.readingToEntry[x.k];
    if (!re) { add(s, i, `"${x.k}" isn't a recognized word — reword it (or use a simpler in-level word)`); continue; }
    if (re.rank > ceilingRank) { add(s, i, `out-of-level word "${x.k}" (${re.surface}, ${LEVELS[re.rank] || 'N3'}) — replace with an in-level word`); continue; }
    // In-scope word: push to kanji ONLY if its kanji is taught; otherwise the kana
    // form is correct (in-scope vocab whose kanji comes later) → allow, no flag.
    if (allKanjiTaught(re.surface)) add(s, i, `write "${x.k}" in its taught KANJI form (${re.surface}) — don't write a taught-kanji word in kana`);
  }
  for (const x of q.violations.split) { const [s, i] = paraOrComp(x.p); add(s, i, `"${x.k}" — ${x.fix}`); }
  for (const x of q.violations.form.slice(0, 10)) { const [s, i] = paraOrComp(x.p); add(s, i, `grammar form "${x.k}" is taught later — use a simpler form`); }
  for (const x of q.violations.particle.slice(0, 10)) { const [s, i] = paraOrComp(x.p); add(s, i, `particle "${x.k}" is taught later — rephrase (e.g. 〜って → 〜と)`); }
  for (const x of q.violations.orthography) add('paragraph', null, `spelling inconsistency ${x.pair} — pick one spelling throughout`);

  // Out-of-level words the ceiling-biased tokenizer hid by splitting (ことば=N3 → こと+ば).
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

// The per-generation scope (cast, level, grammar gate, allowed kanji, the in-scope
// WORD palette, focus, gairaigo). Injected ONCE into the cached system prompt and
// reused across every incremental call.
function buildScope(params, ctx) {
  const ceiling = params.ceiling;
  const kanji = [...buildTaughtKanji(ctx.manifest, ceiling)].sort();
  const cast = (params.castIds || [])
    .map(id => (ctx.characters || []).find(c => c.id === id))
    .filter(Boolean)
    .map(c => `- ${c.surface} (${c.meaning}): ${c.description}`)
    .join('\n');
  const lessonWords = [];
  for (const lid of (params.focusLessons || [])) for (const w of (ctx.lessonVocab && ctx.lessonVocab[lid]) || []) lessonWords.push(w);
  const allFocus = []; const seenF = new Set();
  for (const w of [...(params.focusWords || []), ...lessonWords]) if (w && !seenF.has(w)) { seenF.add(w); allFocus.push(w); }
  const focus = allFocus.slice(0, 50).join('、');
  const focusGrammar = (params.focusGrammar || [])
    .map(id => (ctx.grammarTitles && ctx.grammarTitles[id]) ? `${id} (${ctx.grammarTitles[id]})` : id).join('; ');
  const palette = [...new Set((ctx.vocabEntries || []).filter(e => e.surface && inScope(e.lesson, ceiling)).map(e => e.surface))];
  const genre = (params.themes || []).filter(t => /fantasy|sci-?fi|horror|adventure|period/i.test(t));
  const gairaigo = ['ヒーロー', 'モンスター', 'レベル', 'ゲーム', 'ロボット', 'エネルギー', 'チーム', 'パワー', 'ドア', 'ベル'].filter(w => (ctx.loanwords || []).indexOf(w) >= 0);

  return [
    `THEME(S): ${(params.themes || []).join(', ') || 'slice of life'}.` + (params.tone ? ` TONE: ${params.tone}.` : ''),
    'CAST (use these characters by their Japanese names):',
    cast || '- (narrator only)',
    `VOCAB LEVEL: ${params.vocabLevel} or below. GRAMMAR: up to and including ${params.grammarGate} — no grammar taught after it.`,
    `ALLOWED KANJI (use ONLY these; write every other word in kana):`,
    kanji.join(''),
    `ALLOWED VOCABULARY — the learner has been taught these ${palette.length} content words (plus particles, copula/polite endings, numbers/counters, and conjugations of these). Build the story almost entirely from this list. If a word you want is NOT here, it is NOT taught yet — DO NOT use it; express the idea with listed words (e.g. if 笑う isn't here, use うれしい/おもしろい or describe the action). Even basics like 思う/言う/見る are allowed ONLY if they appear here:`,
    palette.join('、'),
    focus ? `FOCUS WORDS (weave in naturally where they fit): ${focus}` : '',
    focusGrammar ? `FOCUS GRAMMAR (use these patterns): ${focusGrammar}` : '',
    genre.length ? `GENRE FLAVOR: authentic katakana loanwords (gairaigo) are IN SCOPE for ${genre.join('/')}${gairaigo.length ? ` (e.g. ${gairaigo.join('、')})` : ''}.` : '',
  ].filter(l => l !== '').join('\n');
}

function buildSystem(authorSystem, params, ctx) {
  return authorSystem + '\n\n=== THIS STORY — STAY STRICTLY IN SCOPE ===\n' + buildScope(params, ctx);
}

// Violations for ONE paragraph (reuses collectViolations on a 1-paragraph pseudo-
// story; keeps only paragraph-scope problems). The benign title 'x' is filtered out.
function paragraphViolations(para, ctx, vopts) {
  const mini = { schemaVersion: '2.0.0', id: 'p', title: 'x', englishTitle: 'x', paragraphs: [para], comprehension: { questions: [] } };
  return collectViolations(mini, ctx, { ...vopts, minParagraphs: 0 }).filter(v => v.scope === 'paragraph').map(v => v.msg);
}

// Give the story a short in-scope title, gated + repaired (≤3 tries).
async function writeTitle(story, call, params, ctx, vopts) {
  const body = story.paragraphs.map(p => p.jp).join(' ').slice(0, 600);
  let msgs = [{ role: 'user', content: `Give this story a short Japanese title, STRICTLY in scope (only allowed vocab/kanji). STORY:\n${body}\nReturn ONLY {"title":"…","englishTitle":"…"}.` }];
  for (let attempt = 1; attempt <= 3; attempt++) {
    let o; try { o = parseJsonObject(await call(msgs, 300)); } catch (e) { if (e && e.fatal) throw e; continue; }
    story.title = String(o.title || ''); story.englishTitle = String(o.englishTitle || story.englishTitle || '');
    const tv = collectViolations(story, ctx, { ...vopts, minParagraphs: 0 }).filter(v => v.scope === 'title').map(v => v.msg);
    if (!tv.length) return;
    msgs = [...msgs, { role: 'assistant', content: JSON.stringify({ title: story.title, englishTitle: story.englishTitle }) },
      { role: 'user', content: 'The title is out of scope:\n' + tv.map(m => '• ' + m).join('\n') + '\nGive a different short in-scope title. Return ONLY {"title":"…","englishTitle":"…"}.' }];
  }
}

// Write + gate the comprehension questions (≤3 tries).
async function writeComprehension(story, call, params, ctx, vopts) {
  const n = params.numQuestions || 3;
  const body = story.paragraphs.map((p, i) => (i + 1) + '. ' + p.jp).join('\n');
  let msgs = [{ role: 'user', content: `Write ${n} short-answer (written) comprehension questions for this story, STRICTLY in scope. STORY:\n${body}\nEach question: {q (Japanese), q_en (English), answer (short Japanese), explanation (English)}. Return ONLY {"comprehension":[…]}.` }];
  for (let attempt = 1; attempt <= 3; attempt++) {
    let o; try { o = parseJsonObject(await call(msgs, 1600)); } catch (e) { if (e && e.fatal) throw e; continue; }
    story.comprehension.questions = (o.comprehension || []).map(q => bakeQuestion(q, params, ctx));
    const cv = collectViolations(story, ctx, { ...vopts, minParagraphs: 0 }).filter(v => v.scope === 'comprehension').map(v => v.msg);
    if (!cv.length) return;
    msgs = [...msgs, { role: 'assistant', content: JSON.stringify(o) },
      { role: 'user', content: 'The questions are out of scope:\n' + cv.map(m => '• ' + m).join('\n') + '\nRewrite ALL questions in scope. Return ONLY {"comprehension":[…]}.' }];
  }
}

/**
 * Incremental, paragraph-by-paragraph generation — mirrors the human authoring
 * pipeline (outline → write+gate+fix each paragraph before moving on → title →
 * comprehension), so scope problems are fixed locally instead of piling up into a
 * whole-story whack-a-mole. The scope + in-scope vocab palette live in the cached
 * system prompt; each call is small.
 * @param {function} opts.anthropicCall  async ({system, messages, maxTokens}) => { text, usage }
 * @param {string}   opts.authorSystem   the static author prompt (author.v1.md)
 */
export async function generateStory({ params, ctx, anthropicCall, authorSystem, log = () => {} }) {
  const gateMeta = (params.ceiling && params.ceiling.idx !== Number.MAX_SAFE_INTEGER)
    ? { level: params.ceiling.lvl, unlocksAfter: `${params.ceiling.lvl}.${params.ceiling.idx}` }
    : { level: 'custom', unlocksAfter: null };
  const vopts = { vocabLevel: params.vocabLevel, ceiling: params.ceiling, gateMeta, ceilingStr: params.ceilingStr, minParagraphs: params.minParagraphs };
  const usage = { inputTokens: 0, outputTokens: 0 };
  const sys = buildSystem(authorSystem, params, ctx);
  const call = async (msgs, maxTokens) => {
    let r;
    // A throw HERE is a real API/transport failure (auth, billing/credits, rate
    // limit, network) — NOT retryable bad-JSON. Tag it fatal so the call-site
    // catches re-throw it and the job aborts fast with the true reason, instead
    // of silently burning every retry and surfacing a misleading "scope_unmet".
    try { r = await anthropicCall({ system: sys, messages: msgs, maxTokens }); }
    catch (e) { if (e && typeof e === 'object') e.fatal = true; throw e; }
    usage.inputTokens += r.usage?.inputTokens || 0; usage.outputTokens += r.usage?.outputTokens || 0;
    return r.text;
  };
  const total = Math.max(2, params.targetParagraphs || 8);

  // 1) Outline (beats) for coherence.
  let beats = [];
  try {
    const o = parseJsonObject(await call([{ role: 'user', content: `Plan a ${total}-beat outline (use the theme, cast, and scope above). Each beat = one short English sentence describing what happens in that paragraph. Return ONLY {"beats":["…"]} with exactly ${total} beats.` }], 1500));
    if (Array.isArray(o.beats)) beats = o.beats.map(String);
  } catch (e) { if (e && e.fatal) throw e; log(`outline parse failed (${e.message})`); }
  while (beats.length < total) beats.push(`Continue the story (paragraph ${beats.length + 1}).`);
  beats = beats.slice(0, total);

  // 2) Author each paragraph; gate + repair it in place before moving on.
  const story = { schemaVersion: '2.0.0', id: params.id, title: '', englishTitle: '', category: 'custom', level: null, unlocksAfter: null, paragraphs: [], vocabUsed: [], grammarUsed: [], comprehension: { intro: 'Did you follow the story?', questions: [] } };
  for (let i = 0; i < beats.length; i++) {
    const soFar = story.paragraphs.slice(-6).map(p => p.jp).join('\n') || '(none — this is the opening)';
    const basePrompt = `STORY SO FAR:\n${soFar}\n\nWrite paragraph ${i + 1} of ${total}. BEAT: ${beats[i]}\n2–4 sentences, flowing naturally from the story so far, STRICTLY in scope. Return ONLY {"jp":"…","en":"…"}.`;
    let para = null, msgs = [{ role: 'user', content: basePrompt }];
    for (let attempt = 1; attempt <= 3; attempt++) {
      let obj;
      try { obj = parseJsonObject(await call(msgs, 800)); }
      catch (e) { if (e && e.fatal) throw e; msgs = [{ role: 'user', content: basePrompt }, { role: 'user', content: 'Return ONLY {"jp":"…","en":"…"} — valid JSON, no prose.' }]; continue; }
      const cand = bakeParagraph(obj.jp, obj.en, params, ctx);
      para = cand;
      const v = paragraphViolations(cand, ctx, vopts);
      if (!v.length) break;
      if (attempt < 3) msgs = [{ role: 'user', content: basePrompt }, { role: 'assistant', content: JSON.stringify({ jp: cand.jp, en: cand.en }) },
        { role: 'user', content: 'This paragraph is out of scope:\n' + v.map(m => '• ' + m).join('\n') + '\nRewrite ONLY this paragraph fixing every issue, same beat, strictly in scope. Return ONLY {"jp":"…","en":"…"}.' }];
    }
    if (para && para.jp) {
      story.paragraphs.push(para);
      const rem = paragraphViolations(para, ctx, vopts).length;
      log(`¶${i + 1}/${total}${rem ? ` (${rem} residual)` : ''}`);
    }
  }

  // 3) Title + 4) comprehension (each gated).
  await writeTitle(story, call, params, ctx, vopts);
  if (params.includeComprehension !== false) await writeComprehension(story, call, params, ctx, vopts);

  // 5) Finishing pass — targeted splice repair to clean residual paragraph
  // stragglers + cross-paragraph issues (e.g. 時/とき orthography) the per-paragraph
  // gate can't see. Fixes only flagged pieces, never regenerates the whole story.
  let violations = collectViolations(story, ctx, vopts);
  for (let round = 1; round <= 7 && violations.length; round++) {
    const byPara = new Map(); const titleMsgs = []; const compMsgs = []; const generalMsgs = [];
    for (const v of violations) {
      if (v.scope === 'title') titleMsgs.push(v.msg);
      else if (v.scope === 'comprehension') compMsgs.push(v.msg);
      else if (v.scope === 'paragraph' && v.index) { if (!byPara.has(v.index)) byPara.set(v.index, []); byPara.get(v.index).push(v.msg); }
      else generalMsgs.push(v.msg);
    }
    const flagged = [...byPara.keys()].sort((a, b) => a - b);
    let req = 'Fix ONLY the listed problems and return JSON with just the changed pieces:\n' +
      '{ "title":"…" (only if a Title fix is listed), "paragraphs":[{"index":N,"jp":"…","en":"…"}] (only listed paragraphs), "comprehension":[{"q":"…","q_en":"…","answer":"…","explanation":"…"}] (ALL questions, only if a Comprehension fix is listed) }\n\nCURRENT STORY:\nTitle: ' + story.title + '\n' + story.paragraphs.map((p, i) => (i + 1) + '. ' + p.jp).join('\n') + '\n\nPROBLEMS TO FIX:\n';
    if (titleMsgs.length) req += '- Title: ' + titleMsgs.join('; ') + '\n';
    for (const idx of flagged) req += `- Paragraph ${idx}: ${byPara.get(idx).join('; ')}\n`;
    if (generalMsgs.length) req += '- Overall (apply across the whole story): ' + generalMsgs.join('; ') + '\n';
    if (compMsgs.length) req += `- Comprehension (return ALL ${params.numQuestions || (story.comprehension.questions || []).length} questions): ${compMsgs.join('; ')}\n`;
    req += '\nKeep every unflagged paragraph EXACTLY as-is. Stay strictly in scope.';
    try {
      const fix = parseJsonObject(await call([{ role: 'user', content: req }], Math.min(8000, 1500 + flagged.length * 360 + (compMsgs.length ? (params.numQuestions || 3) * 220 : 0) + (titleMsgs.length ? 200 : 0))));
      if (fix.title && titleMsgs.length) story.title = String(fix.title);
      for (const fp of (fix.paragraphs || [])) { const i = (parseInt(fp.index, 10) || 0) - 1; if (i >= 0 && i < story.paragraphs.length && fp.jp) story.paragraphs[i] = bakeParagraph(fp.jp, fp.en || story.paragraphs[i].en, params, ctx); }
      if (compMsgs.length && Array.isArray(fix.comprehension) && fix.comprehension.length) story.comprehension.questions = fix.comprehension.map(q => bakeQuestion(q, params, ctx));
    } catch (e) { if (e && e.fatal) throw e; log(`finish ${round}: parse failed (${e.message})`); }
    violations = collectViolations(story, ctx, vopts);
    log(`finish ${round}: ${violations.length} violation(s)`);
  }

  // 6) Last resort — a stubborn word that survived repeated rewording has no
  // in-scope synonym. Rather than bin a near-perfect story over it, instruct a
  // DELETE/replace of the offending sentence (guaranteed removal). Paragraph
  // count is preserved (we rewrite, not drop, the paragraph), so the length
  // floor still holds.
  if (violations.length) {
    const byPara = new Map();
    for (const v of violations) if (v.scope === 'paragraph' && v.index) { if (!byPara.has(v.index)) byPara.set(v.index, []); byPara.get(v.index).push(v.msg); }
    for (const [idx, msgs] of byPara) {
      const i = idx - 1;
      if (i < 0 || i >= story.paragraphs.length) continue;
      const prompt = `This paragraph STILL has out-of-scope content that earlier rewrites could not fix — the offending word likely has no in-scope synonym:\n\n${story.paragraphs[i].jp}\n\nProblems:\n${msgs.map(m => '• ' + m).join('\n')}\n\nRewrite this paragraph and simply DELETE or replace the offending sentence(s) entirely — it is better to drop a sentence than to keep ANY out-of-scope word. Keep 1–3 natural, strictly in-scope sentences that still fit the story. Return ONLY {"jp":"…","en":"…"}.`;
      try {
        const obj = parseJsonObject(await call([{ role: 'user', content: prompt }], 700));
        if (obj && obj.jp) story.paragraphs[i] = bakeParagraph(obj.jp, obj.en || story.paragraphs[i].en, params, ctx);
      } catch (e) { if (e && e.fatal) throw e; }
    }
    violations = collectViolations(story, ctx, vopts);
    log(`last-resort: ${violations.length} violation(s)`);
  }

  const ok = violations.length === 0;
  log(`final: ${story.paragraphs.length} paragraphs, ${violations.length} violation(s)`);
  return { ok, story, usage, rounds: beats.length, violations: ok ? [] : violations.map(v => v.msg) };
}

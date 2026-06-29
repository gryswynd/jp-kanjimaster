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

const MAX_ROUNDS = 4;

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

// Human-readable scope/level/structure problems for a candidate story, in the
// terms the author prompt understands. Empty array = ships.
function collectViolations(story, ctx, { vocabLevel, ceiling, gateMeta, ceilingStr }) {
  const out = [];
  const vocabRank = LEVELS.indexOf(vocabLevel) >= 0 ? LEVELS.indexOf(vocabLevel) : 1;

  // 0) title scope — the qa gate skips titles, but a title can smuggle in
  //    out-of-level vocab written in kana (e.g. なぞ = N3 謎). Gate it via a
  //    title-only pseudo-story through the same audit + kanji checks.
  if (story.title) {
    const tStory = { paragraphs: [{ jp: story.title, tokens: tokenizeText(story.title, ctx.surfaceIdx, { ceiling: ceilingStr }) }] };
    const ta = auditStory(tStory, ctx, vocabRank);
    for (const [surface] of ta.outOfLevel) out.push(`Title word "${surface}" is out-of-level — reword the title with ${vocabLevel}-or-below vocabulary.`);
    // Titles should use known, in-curriculum vocabulary — an unglossaried content
    // word (e.g. なぞ = 謎, not in-curriculum) is out of scope for a title.
    for (const [surface] of ta.unglossaried) out.push(`Title word "${surface}" isn't in the curriculum — reword the title using taught vocabulary.`);
    for (const [word, fix] of Object.entries(TITLE_STOPLIST)) if (story.title.includes(word)) out.push(`Title uses "${word}" (out of scope) — use ${fix}.`);
    const taught = buildTaughtKanji(ctx.manifest, ceiling);
    for (const ch of story.title) if (/[一-鿿㐀-䶿]/.test(ch) && !taught.has(ch)) out.push(`Title kanji 「${ch}」 isn't taught — use kana or a different word in the title.`);
  }

  // 1) reconstruction (a paragraph's tokens didn't rebuild its jp)
  (story.paragraphs || []).forEach((p, i) => {
    if (reconstructFromTokens(p.tokens || []) !== p.jp) out.push(`Paragraph ${i + 1}: a chunk didn't tokenize cleanly — reword "${p.jp.slice(0, 30)}…".`);
  });

  // 2) schema
  const v = validateStory(story, ctx);
  if (!v.ok) for (const e of v.errors.slice(0, 8)) out.push(`Schema: ${e}`);

  // 3) out-of-level vocab (audit)
  const a = auditStory(story, ctx, LEVELS.indexOf(vocabLevel) >= 0 ? LEVELS.indexOf(vocabLevel) : 1);
  for (const [surface, m] of a.outOfLevel) out.push(`Out-of-level word "${surface}" (¶${[...m.paras].join(',')}) — replace with a ${vocabLevel}-or-below word.`);

  // 4) qa: untaught kanji / out-of-scope / split / orthography (gated at the
  //    student's ceiling via gateMeta)
  const q = qaStory(story, ctx, gateMeta);
  for (const k of dedupe(q.violations.kanji, x => x.ch).slice(0, 12)) out.push(`Untaught kanji 「${k.ch}」 (${k.paragraph}) — write that word in kana instead.`);
  for (const x of dedupe(q.violations.vocab, x => x.id).slice(0, 12)) out.push(`Out-of-scope word "${x.k}" (¶${x.p}) — use a simpler in-level word.`);
  for (const x of q.violations.untagged.slice(0, 10)) out.push(`"${x.k}" (¶${x.p}) isn't a recognized word — reword it.`);
  for (const x of q.violations.split) out.push(`"${x.k}" (¶${x.p}) — ${x.fix}.`);
  for (const x of q.violations.form.slice(0, 8)) out.push(`Grammar form "${x.k}" (¶${x.p}) is taught later — use a simpler form.`);
  for (const x of q.violations.particle.slice(0, 8)) out.push(`Particle "${x.k}" (¶${x.p}) is taught later — rephrase.`);
  for (const x of q.violations.orthography) out.push(`Spelling inconsistency ${x.pair} — pick one spelling throughout.`);

  return out;
}
function dedupe(rows, keyFn) {
  const seen = new Set(), out = [];
  for (const r of rows) { const k = keyFn(r); if (!seen.has(k)) { seen.add(k); out.push(r); } }
  return out;
}

// Turn the author's JSON into a schema-2.0.0 story object with baked tokens + aTerms.
function assembleStory(raw, params, ctx) {
  const paragraphs = (raw.paragraphs || []).map(p => ({
    jp: String(p.jp || ''),
    en: String(p.en || ''),
    tokens: tokenizeText(String(p.jp || ''), ctx.surfaceIdx, { ceiling: params.ceilingStr }),
  }));
  const questions = (raw.comprehension || []).map(q => {
    const out = {
      type: 'written',
      q: String(q.q || ''),
      q_en: String(q.q_en || ''),
      answer: String(q.answer || ''),
      explanation: String(q.explanation || ''),
    };
    out.aTerms = deriveAnswerTerms(out.answer, ctx, params.ceilingStr);
    return out;
  });
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
  const focus = (params.focusWords || []).slice(0, 40).join('、');
  const lines = [
    `Write a graded-reader story of about ${params.targetParagraphs} short paragraphs.`,
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
  const messages = [{ role: 'user', content: buildBrief(params, ctx) }];
  let story = null, violations = [];

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const res = await anthropicCall({ system: authorSystem, messages, maxTokens: 4000 });
    usage.inputTokens += res.usage?.inputTokens || 0;
    usage.outputTokens += res.usage?.outputTokens || 0;

    let raw;
    try { raw = parseJsonObject(res.text); }
    catch (e) {
      log(`round ${round}: JSON parse failed (${e.message}); asking for clean JSON`);
      messages.push({ role: 'assistant', content: res.text });
      messages.push({ role: 'user', content: 'That was not valid JSON. Reply with ONLY the JSON object, no prose or fences.' });
      continue;
    }

    story = assembleStory(raw, params, ctx);
    violations = collectViolations(story, ctx, { vocabLevel: params.vocabLevel, ceiling: params.ceiling, gateMeta, ceilingStr: params.ceilingStr });
    log(`round ${round}: ${story.paragraphs.length} paragraphs, ${violations.length} violation(s)`);
    if (violations.length === 0) return { ok: true, story, usage, rounds: round, violations: [] };

    // Repair: hand back the model's own JSON + a precise fix list.
    messages.push({ role: 'assistant', content: JSON.stringify(raw) });
    messages.push({ role: 'user', content:
      'The story has these scope problems. Fix ONLY the affected paragraphs/fields (reword, keep the story coherent) and return the full JSON again:\n\n' +
      violations.map(v => '• ' + v).join('\n') });
  }

  return { ok: false, story, usage, rounds: MAX_ROUNDS, violations };
}

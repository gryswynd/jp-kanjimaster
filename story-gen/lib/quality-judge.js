/**
 * story-gen/lib/quality-judge.js
 * Silent post-gate quality rating. After a story clears the mechanical gates, an
 * independent Claude "judge" scores it on a rubric (1–5 each). It is NEVER shown
 * to the learner — it feeds the admin report and the auto-regenerate decision.
 * Best-effort: any failure returns null scores (the story still ships).
 */
import { anthropicCall } from './anthropic.js';
import { env } from './config.js';

const JUDGE_SYSTEM = [
  'You are a strict editor reviewing a Japanese graded-reader story written for a',
  'learner at a fixed curriculum level. Rate it on a 1–5 integer scale per dimension',
  '(5 = excellent, 1 = poor):',
  '- coherence: is it a real, connected story (not a disjoint vocab parade)?',
  '- naturalness: is the Japanese idiomatic and natural (not contrived/translationese)?',
  '- inScope: does it stay within the stated level (no obviously advanced vocab/kanji)?',
  '- themeFit: does it match the requested theme(s)?',
  '- castUsage: are the requested characters meaningfully present (if any were asked for)?',
  'Then give an overall 1–5 (your holistic judgement) and a note (≤140 chars) flagging the',
  'single biggest issue, or "" if none.',
  'Reply with ONLY a JSON object, no prose:',
  '{"coherence":N,"naturalness":N,"inScope":N,"themeFit":N,"castUsage":N,"overall":N,"note":"..."}',
].join('\n');

export async function judgeStory({ story, params }) {
  const paras = (story.paragraphs || []).map((p, i) => `${i + 1}. ${p.jp || ''}`).join('\n');
  const themes = (params.themes || []).join(', ') || '(none specified)';
  const cast = (params.castIds || []).join(', ') || '(none specified)';
  const user =
    `Requested theme(s): ${themes}\n` +
    `Requested cast: ${cast}\n` +
    `Target level: ${params.level || params.vocabLevel || 'N4'}\n` +
    `Title: ${story.title || ''}\n\n` +
    `Story (${(story.paragraphs || []).length} paragraphs):\n${paras}`;

  let usage = { inputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, outputTokens: 0 };
  try {
    const res = await anthropicCall({
      system: JUDGE_SYSTEM,
      messages: [{ role: 'user', content: user }],
      maxTokens: 400,
      model: env.judgeModel,   // independent, cheaper judge
    });
    usage = res.usage || usage;
    return { scores: parseScores(res.text), usage };
  } catch (e) {
    return { scores: null, usage };
  }
}

function parseScores(text) {
  try {
    const m = String(text || '').match(/\{[\s\S]*\}/);
    if (!m) return null;
    const o = JSON.parse(m[0]);
    const clamp = (v) => Math.max(1, Math.min(5, Math.round(Number(v) || 0)));
    return {
      coherence: clamp(o.coherence),
      naturalness: clamp(o.naturalness),
      inScope: clamp(o.inScope),
      themeFit: clamp(o.themeFit),
      castUsage: clamp(o.castUsage),
      overall: clamp(o.overall),
      note: String(o.note || '').slice(0, 140),
    };
  } catch (e) {
    return null;
  }
}

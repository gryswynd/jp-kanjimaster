/**
 * story-gen/lib/generate-runner.js
 * Warms the gate context once, maps the builder's request → pipeline params,
 * and runs a generation job in the background (writing status to Firestore).
 * The pipeline + gates are staged into ./vendor/lib by scripts/stage.mjs.
 */
import { readFile } from 'node:fs/promises';
import { buildGateContext, parseLessonId } from '../vendor/lib/story-gates.mjs';
import { generateStory } from '../vendor/lib/generate-story.mjs';
import { anthropicCall, authorSystem } from './anthropic.js';
import { computeCost } from './cost-meter.js';
import { env, DEFAULT_FLAGS } from './config.js';
import { updateJob, saveStory, recordCost, releaseGeneration, getPricingFlags, getPushTokens, prunePushTokens } from './store.js';
import { sendPush } from './firebase.js';

let _ctxPromise = null;
let _authorPromise = null;
export function warm() {
  if (!_ctxPromise) _ctxPromise = buildGateContext({ readFile: (p, e) => readFile(p, e), root: env.contentRoot });
  if (!_authorPromise) _authorPromise = authorSystem();
  return Promise.all([_ctxPromise, _authorPromise]);
}

// Map the client request (+ the learner's synced gates) to pipeline params.
export function toParams(body, storyId, maxParagraphs) {
  const gates = body.gates || {};
  // Custom stories cap at N4; a learner still on N5 caps at N5 (no unlearned N4).
  const vocabLevel = gates.level === 'N4' ? 'N4' : (gates.level === 'N5' ? 'N5' : 'N4');
  const lid = parseLessonId(gates.furthestLesson || '');
  const ceiling = lid ? { lvl: lid.lvl, idx: lid.idx } : { lvl: vocabLevel, idx: Number.MAX_SAFE_INTEGER };
  const want = Math.max(4, Math.min(maxParagraphs || DEFAULT_FLAGS.maxParagraphs, parseInt(body.targetParagraphs, 10) || 12));
  const minParagraphs = Math.max(4, Math.round(want * 0.85));   // enforced floor → reliable page count
  return {
    id: storyId,
    castIds: Array.isArray(body.castIds) ? body.castIds.slice(0, 5) : [],
    themes: Array.isArray(body.themes) ? body.themes.slice(0, 3) : [],
    tone: typeof body.tone === 'string' ? body.tone.slice(0, 80) : '',
    vocabLevel,
    ceiling,
    ceilingStr: `${vocabLevel}.99`,
    focusWords: Array.isArray(body.focusWords) ? body.focusWords.slice(0, 40).map(String) : [],
    focusLessons: Array.isArray(body.focusLessons) ? body.focusLessons.slice(0, 20).map(String) : [],
    focusGrammar: Array.isArray(body.focusGrammar) ? body.focusGrammar.slice(0, 20).map(String) : [],
    grammarGate: typeof body.grammarGate === 'string' ? body.grammarGate.slice(0, 80) : 'the latest grammar taught',
    targetParagraphs: want,
    minParagraphs: minParagraphs,
    includeComprehension: body.includeComprehension !== false,
    numQuestions: Math.max(0, Math.min(8, parseInt(body.numQuestions, 10) || 4)),
  };
}

// Background generation: never throws to the caller — records terminal state on
// the job. Refunds the per-user quota slot if generation fails.
export async function runJob(uid, email, jobId, params) {
  try {
    await updateJob(uid, jobId, { status: 'running' });
    const [ctx, sys] = await warm();
    const res = await generateStory({ params, ctx, anthropicCall, authorSystem: sys, log: () => {} });
    const cost = computeCost(res.usage);
    await recordCost(uid, email, cost.totalCents, cost.breakdown);

    if (!res.ok) {
      await releaseGeneration(uid);
      await updateJob(uid, jobId, { status: 'failed', error: 'scope_unmet', rounds: res.rounds, violations: res.violations.slice(0, 8) });
      return;
    }
    const storyId = await saveStory(uid, res.story);
    await updateJob(uid, jobId, { status: 'done', storyId, rounds: res.rounds, costCents: Math.round(cost.totalCents * 100) / 100 });

    // Notify the device(s) the story is ready (no-op if no tokens / no push set up).
    try {
      const tokens = await getPushTokens(uid);
      if (tokens.length) {
        const dead = await sendPush(
          tokens,
          { title: 'Your story is ready! 📖', body: res.story.title || 'Tap to read your new story.' },
          { type: 'story', storyId }
        );
        if (dead.length) await prunePushTokens(uid, dead);
      }
    } catch (e) { /* push is best-effort */ }
  } catch (e) {
    await releaseGeneration(uid).catch(() => {});
    await updateJob(uid, jobId, { status: 'failed', error: String((e && e.reason) || (e && e.message) || 'error') }).catch(() => {});
  }
}

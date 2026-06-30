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
import { judgeStory } from './quality-judge.js';
import { env, DEFAULT_FLAGS } from './config.js';
import { updateJob, saveStory, recordCost, recordGeneration, releaseGeneration, getPricingFlags, getPushTokens, prunePushTokens } from './store.js';
import { sendPush } from './firebase.js';

const addUsage = (a, b) => ({
  inputTokens: (a.inputTokens || 0) + (b.inputTokens || 0),
  outputTokens: (a.outputTokens || 0) + (b.outputTokens || 0),
});
const round2 = (c) => Math.round((c || 0) * 100) / 100;

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
    level: gates.furthestLesson || vocabLevel,   // human-readable, for the report
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
  const t0 = Date.now();
  try {
    const flags = await getPricingFlags();
    await updateJob(uid, jobId, { status: 'running' });
    const [ctx, sys] = await warm();
    let res = await generateStory({ params, ctx, anthropicCall, authorSystem: sys, log: () => {} });
    let usage = res.usage || {};

    if (!res.ok) {
      const cost = computeCost(usage);
      await recordCost(uid, email, cost.totalCents, cost.breakdown);
      await releaseGeneration(uid);
      await updateJob(uid, jobId, { status: 'failed', error: 'scope_unmet', rounds: res.rounds, violations: (res.violations || []).slice(0, 8) });
      await recordGeneration(genRecord({ uid, email, params, res, status: 'failed', error: 'scope_unmet', costCents: cost.totalCents, t0 }));
      await notifyFailure(uid);
      return;
    }

    // Silent quality judge (best-effort) + at-most-one auto-regeneration if the
    // story scores below threshold. The better-scoring story is the one shipped.
    let quality = null, regenerated = false;
    if (flags.qualityJudge !== false) {
      const j = await judgeStory({ story: res.story, params });
      usage = addUsage(usage, j.usage); quality = j.scores;
      if (flags.autoRegen !== false && quality && quality.overall < (flags.qualityThreshold || 3)) {
        const res2 = await generateStory({ params, ctx, anthropicCall, authorSystem: sys, log: () => {} });
        usage = addUsage(usage, res2.usage || {});
        regenerated = true;
        if (res2.ok) {
          const j2 = await judgeStory({ story: res2.story, params });
          usage = addUsage(usage, j2.usage);
          if (j2.scores && (!quality || j2.scores.overall > quality.overall)) { res = res2; quality = j2.scores; }
        }
      }
    }

    const cost = computeCost(usage);
    await recordCost(uid, email, cost.totalCents, cost.breakdown);
    const storyId = await saveStory(uid, res.story);
    await updateJob(uid, jobId, { status: 'done', storyId, rounds: res.rounds, costCents: round2(cost.totalCents), quality });
    await recordGeneration(genRecord({ uid, email, params, res, status: 'done', storyId, quality, regenerated, costCents: cost.totalCents, t0 }));

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
    const reason = String((e && e.reason) || (e && e.message) || 'error');
    await releaseGeneration(uid).catch(() => {});
    await updateJob(uid, jobId, { status: 'failed', error: reason }).catch(() => {});
    await recordGeneration(genRecord({ uid, email, params, res: null, status: 'failed', error: reason, t0 })).catch(() => {});
    await notifyFailure(uid).catch(() => {});
  }
}

// Build the rich per-generation report row (success OR failure).
function genRecord({ uid, email, params, res, status, storyId, error, quality, regenerated, costCents, t0 }) {
  const story = (res && res.story) || {};
  return {
    createdAt: Date.now(),
    uid,
    email: email || null,
    title: story.title || null,
    englishTitle: story.englishTitle || null,
    themes: params.themes || [],
    castIds: params.castIds || [],
    level: params.level || params.vocabLevel || null,
    targetParagraphs: params.targetParagraphs || null,
    actualParagraphs: Array.isArray(story.paragraphs) ? story.paragraphs.length : 0,
    status,
    error: error || null,
    rounds: (res && res.rounds) || 0,
    residualViolations: (res && Array.isArray(res.violations)) ? res.violations.length : 0,
    regenerated: !!regenerated,
    quality: quality || null,
    costCents: round2(costCents),
    latencyMs: Date.now() - t0,
    storyId: storyId || null,
  };
}

// Push a "didn't work, try again" so the user is never left waiting on a failure.
async function notifyFailure(uid) {
  try {
    const tokens = await getPushTokens(uid);
    if (tokens.length) {
      const dead = await sendPush(tokens,
        { title: 'Story didn\'t finish', body: 'That one didn\'t come together — tap to try again.' },
        { type: 'story_failed' });
      if (dead.length) await prunePushTokens(uid, dead);
    }
  } catch (e) { /* best-effort */ }
}

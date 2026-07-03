/**
 * story-gen/lib/generate-runner.js
 * Warms the gate context once, maps the builder's request → pipeline params,
 * and runs a generation job in the background (writing status to Firestore).
 * The pipeline + gates are staged into ./vendor/lib by scripts/stage.mjs.
 */
import { readFile } from 'node:fs/promises';
import { buildGateContext, parseLessonId } from '../vendor/lib/story-gates.mjs';
import { generateStory, reviseStory, collectUnglossaried } from '../vendor/lib/generate-story.mjs';
import { anthropicCall, authorSystem } from './anthropic.js';
import { computeCost } from './cost-meter.js';
import { judgeStory } from './quality-judge.js';
import { env, DEFAULT_FLAGS, COSTS, JUDGE_COSTS } from './config.js';
import { updateJob, saveStory, recordCost, recordGeneration, releaseGeneration, getPricingFlags, getPushTokens, prunePushTokens } from './store.js';
import { sendPush } from './firebase.js';

const emptyUsage = () => ({ inputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, outputTokens: 0 });
const addUsage = (a, b) => ({
  inputTokens: (a.inputTokens || 0) + (b.inputTokens || 0),
  cacheReadTokens: (a.cacheReadTokens || 0) + (b.cacheReadTokens || 0),
  cacheCreationTokens: (a.cacheCreationTokens || 0) + (b.cacheCreationTokens || 0),
  outputTokens: (a.outputTokens || 0) + (b.outputTokens || 0),
});
const round2 = (c) => Math.round((c || 0) * 100) / 100;

// Author usage is Sonnet-priced, judge usage Haiku-priced — meter each at its own
// rate, then combine into the single {claudeInputCents,claudeOutputCents} the
// dashboard reads. (claudeInputCents already folds in the correctly-priced cache
// reads/writes, so the per-service line is accurate again.)
function billing(authorUsage, judgeUsage) {
  const a = computeCost(authorUsage, COSTS);
  const j = computeCost(judgeUsage, JUDGE_COSTS);
  return {
    totalCents: a.totalCents + j.totalCents,
    breakdown: {
      claudeInputCents: a.breakdown.claudeInputCents + j.breakdown.claudeInputCents,
      claudeOutputCents: a.breakdown.claudeOutputCents + j.breakdown.claudeOutputCents,
    },
  };
}
// The dimensions the revision should target (inScope is already gate-guaranteed).
function weakDims(q) {
  const map = [['coherence', 'coherence'], ['naturalness', 'naturalness'], ['themeFit', 'theme fit'], ['castUsage', 'character use']];
  return map.filter(([k]) => (q[k] || 5) <= 2).map(([, label]) => label);
}

// Turn a thrown API/transport error into a clean, legible report reason.
function classifyError(e) {
  const msg = String((e && e.message) || '');
  const st = e && e.status;
  if (/credit balance|too low|billing/i.test(msg)) return 'anthropic_out_of_credits';
  if (st === 401 || st === 403) return 'anthropic_auth';
  if (st === 429) return 'anthropic_rate_limited';
  if (typeof st === 'number' && st >= 500) return 'anthropic_unavailable';
  return (e && e.reason) || (msg ? msg.slice(0, 80) : 'error');
}

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
    // Free text → prompt: strip newlines / structural chars so it can't inject a
    // new instruction line, collapse whitespace, cap length.
    tone: typeof body.tone === 'string' ? body.tone.replace(/[\r\n<>{}]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) : '',
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
    let authorUsage = res.usage || emptyUsage();
    let judgeUsage = emptyUsage();

    if (!res.ok) {
      const { totalCents, breakdown } = billing(authorUsage, judgeUsage);
      await recordCost(uid, email, totalCents, breakdown);
      await releaseGeneration(uid);
      await updateJob(uid, jobId, { status: 'failed', error: 'scope_unmet', rounds: res.rounds, violations: (res.violations || []).slice(0, 8) });
      const unglossaried = res.story ? collectUnglossaried(res.story, ctx, params.vocabLevel) : [];
      await recordGeneration(genRecord({ uid, email, params, res, status: 'failed', error: 'scope_unmet', costCents: totalCents, unglossaried, t0 }));
      await notifyFailure(uid);
      return;
    }

    // Silent quality judge (best-effort) + at-most-one TARGETED revision if the
    // story scores below threshold. The revision is guided by the judge's own note
    // + weak dimensions and reuses the in-scope story as its starting point
    // (cheaper and more effective than a from-scratch regen). Ship the better one.
    let quality = null, regenerated = false;
    if (flags.qualityJudge !== false) {
      const j = await judgeStory({ story: res.story, params });
      judgeUsage = addUsage(judgeUsage, j.usage); quality = j.scores;
      if (flags.autoRegen !== false && quality && quality.overall < (flags.qualityThreshold || 3)) {
        const rev = await reviseStory({ params, ctx, anthropicCall, authorSystem: sys, story: res.story, judgeNote: quality.note, weakDimensions: weakDims(quality), log: () => {} });
        authorUsage = addUsage(authorUsage, rev.usage || emptyUsage());
        regenerated = true;
        if (rev.ok) {
          const j2 = await judgeStory({ story: rev.story, params });
          judgeUsage = addUsage(judgeUsage, j2.usage);
          if (j2.scores && j2.scores.overall >= quality.overall) { res = { ...res, story: rev.story, violations: rev.violations }; quality = j2.scores; }
        }
      }
    }

    const { totalCents, breakdown } = billing(authorUsage, judgeUsage);
    await recordCost(uid, email, totalCents, breakdown);
    const storyId = await saveStory(uid, res.story);
    const unglossaried = collectUnglossaried(res.story, ctx, params.vocabLevel);
    await updateJob(uid, jobId, { status: 'done', storyId, rounds: res.rounds, costCents: round2(totalCents), quality });
    await recordGeneration(genRecord({ uid, email, params, res, status: 'done', storyId, quality, regenerated, costCents: totalCents, unglossaried, t0 }));

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
    const reason = classifyError(e);
    await releaseGeneration(uid).catch(() => {});
    await updateJob(uid, jobId, { status: 'failed', error: reason }).catch(() => {});
    await recordGeneration(genRecord({ uid, email, params, res: null, status: 'failed', error: reason, t0 })).catch(() => {});
    await notifyFailure(uid).catch(() => {});
  }
}

// Build the rich per-generation report row (success OR failure).
function genRecord({ uid, email, params, res, status, storyId, error, quality, regenerated, costCents, unglossaried, t0 }) {
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
    rounds: (res && res.rounds) || 0,             // finishing-repair rounds (effort, not para count)
    paraRetries: (res && res.paraRetries) || 0,   // extra per-paragraph attempts
    lastResort: !!(res && res.lastResort),        // did the sentence-delete pass fire?
    residualViolations: (res && Array.isArray(res.violations)) ? res.violations.length : 0,
    residualMessages: (res && Array.isArray(res.violations)) ? res.violations.slice(0, 8) : [],
    unglossaried: Array.isArray(unglossaried) ? unglossaried.slice(0, 20) : [],   // soft-gate slips to watch
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

/**
 * server/lib/cost-meter.js
 * Translates raw usage (STT seconds, Claude tokens, Firestore ops) into USD cents,
 * split per service, and emits a structured cost log line per request which Cloud
 * Logging turns into log-based metrics.
 */

import { COSTS, FIRESTORE_OPS_PER_PRESSASK } from './config.js';

function round2(n) { return Math.round((n || 0) * 100) / 100; }

/**
 * Compute the cost of one request, split per service. firestoreReads/Writes default
 * to the fixed per-Press-to-Ask estimate (see config.FIRESTORE_OPS_PER_PRESSASK).
 * Returns { totalCents, breakdown:{ claudeInputCents, claudeOutputCents, sttCents,
 * firestoreCents } } — all in cents.
 */
export function computeCost({ sttSeconds = 0, inputTokens = 0, outputTokens = 0,
                              firestoreReads, firestoreWrites } = {}) {
  const reads = firestoreReads ?? FIRESTORE_OPS_PER_PRESSASK.reads;
  const writes = firestoreWrites ?? FIRESTORE_OPS_PER_PRESSASK.writes;
  const claudeInputCents = inputTokens * COSTS.claudeInputPerToken * 100;
  const claudeOutputCents = outputTokens * COSTS.claudeOutputPerToken * 100;
  const sttCents = sttSeconds * COSTS.sttPerSecond * 100;
  const firestoreCents = (reads * COSTS.firestoreReadPer + writes * COSTS.firestoreWritePer) * 100;
  const totalCents = claudeInputCents + claudeOutputCents + sttCents + firestoreCents;
  return { totalCents, breakdown: { claudeInputCents, claudeOutputCents, sttCents, firestoreCents } };
}

/** Back-compat shim: the combined cents the quota cost-cap path settles on. */
export function computeCostCents(usage) {
  return computeCost(usage).totalCents;
}

/** Structured log — one JSON line per billable request for Cloud Monitoring. */
export function logCost(route, deviceId, usage, costCents, breakdown = {}) {
  console.log(JSON.stringify({
    severity: 'INFO',
    kind: 'cost_meter',
    route,
    deviceId,
    sttSeconds: usage.sttSeconds || 0,
    inputTokens: usage.inputTokens || 0,
    outputTokens: usage.outputTokens || 0,
    costCents: round2(costCents),
    // Per-service split (cents) — Cloud Monitoring log-based metrics key on these.
    claudeInputCents: round2(breakdown.claudeInputCents),
    claudeOutputCents: round2(breakdown.claudeOutputCents),
    sttCents: round2(breakdown.sttCents),
    firestoreCents: round2(breakdown.firestoreCents),
  }));
}

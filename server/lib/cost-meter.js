/**
 * server/lib/cost-meter.js
 * Translates raw usage (STT seconds, Claude tokens) into USD cents and emits a
 * structured cost log line per request, which Cloud Logging turns into a metric.
 */

import { COSTS } from './config.js';

export function computeCostCents({ sttSeconds = 0, inputTokens = 0, outputTokens = 0 }) {
  const usd =
    sttSeconds * COSTS.sttPerSecond +
    inputTokens * COSTS.claudeInputPerToken +
    outputTokens * COSTS.claudeOutputPerToken;
  return usd * 100;
}

/** Structured log — one JSON line per billable request for Cloud Monitoring. */
export function logCost(route, deviceId, usage, costCents) {
  console.log(JSON.stringify({
    severity: 'INFO',
    kind: 'cost_meter',
    route,
    deviceId,
    sttSeconds: usage.sttSeconds || 0,
    inputTokens: usage.inputTokens || 0,
    outputTokens: usage.outputTokens || 0,
    costCents: Math.round(costCents * 100) / 100,
  }));
}

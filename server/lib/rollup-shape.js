/**
 * server/lib/rollup-shape.js
 * Canonical normalized shape for a daily cost-rollup doc, shared by the Firestore
 * and in-memory stores so the admin endpoint sees identical data regardless of
 * backend. Raw stored docs use maps (svc, byDevice, hourly-by-hour); these helpers
 * normalize to the stable shape the dashboard consumes (hourly as a 24-slot array,
 * avgPerRequest derived).
 */

const SERVICES = ['claudeInput', 'claudeOutput', 'stt', 'firestore'];

function zeroSvc() {
  return { claudeInput: 0, claudeOutput: 0, stt: 0, firestore: 0 };
}

function normSvc(raw = {}) {
  const out = zeroSvc();
  for (const k of SERVICES) out[k] = raw[k] || 0;
  return out;
}

/** A fully-zeroed rollup for a day with no activity (keeps the graph x-axis continuous). */
export function zeroRollup(day) {
  return {
    day,
    requests: 0,
    total: 0,
    svc: zeroSvc(),
    costSumCents: 0,
    maxRequestCents: 0,
    avgPerRequest: 0,
    byDevice: {},
    hourly: Array.from({ length: 24 }, () => ({ total: 0, requests: 0 })),
  };
}

/** Normalize a raw stored rollup doc (maps + sentinels resolved) into the stable shape. */
export function normalizeRollup(day, raw = {}) {
  const requests = raw.requests || 0;
  const costSumCents = raw.costSumCents || raw.total || 0;
  const hourly = Array.from({ length: 24 }, (_, h) => {
    const slot = (raw.hourly && raw.hourly[h]) || (raw.hourly && raw.hourly[String(h)]) || {};
    return { total: slot.total || 0, requests: slot.requests || 0 };
  });
  const byDevice = {};
  for (const [id, d] of Object.entries(raw.byDevice || {})) {
    byDevice[id] = { requests: d.requests || 0, total: d.total || 0, svc: normSvc(d.svc) };
  }
  return {
    day,
    requests,
    total: raw.total || 0,
    svc: normSvc(raw.svc),
    costSumCents,
    maxRequestCents: raw.maxRequestCents || 0,
    avgPerRequest: requests ? costSumCents / requests : 0,
    byDevice,
    hourly,
  };
}

export { SERVICES };

/**
 * server/lib/store-memory.js
 * In-memory implementation of the tutor store, API-compatible with
 * lib/firestore.js. Lets the server run with ONLY an Anthropic key — no GCP — for
 * local testing and the family beta before Firestore is provisioned.
 *
 * ⚠️ State is per-process and lost on restart. Quota resets when the server
 * restarts. Fine for local "does the answer feel good in a lesson" testing; NOT a
 * production backing store. Selected via TUTOR_STORE=memory or an empty
 * GCLOUD_PROJECT (see lib/config.js useMemoryStore + lib/store.js).
 */

import { env, DEFAULT_TIERS, DEFAULT_FLAGS } from './config.js';
import { httpError } from './errors.js';
import { mergeProgress } from './merge-progress.js';

// deviceId -> { entitlement, attestKeyId }
const devices = new Map();
// `${deviceId}:${day}` -> { pressAsks, costCents }
const quota = new Map();
// `${day}` -> costCents
const globalCost = new Map();
// deviceId -> learner profile (cross-session memory; see lib/profile.js)
const profiles = new Map();

export function todayStr(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function qkey(deviceId) { return deviceId + ':' + todayStr(); }
function qget(deviceId) {
  return quota.get(qkey(deviceId)) || { pressAsks: 0, costCents: 0 };
}
function qset(deviceId, v) { quota.set(qkey(deviceId), v); }

export async function getEntitlement(deviceId) {
  if (env.betaEntitlements[deviceId]) return env.betaEntitlements[deviceId];
  const d = devices.get(deviceId);
  const tier = d && d.entitlement;
  return tier && DEFAULT_TIERS[tier] ? tier : 'free';
}

export async function ensureDevice(deviceId, attestKeyId) {
  const d = devices.get(deviceId);
  if (!d) {
    devices.set(deviceId, { entitlement: 'free', attestKeyId: attestKeyId || null });
  } else if (attestKeyId && !d.attestKeyId) {
    d.attestKeyId = attestKeyId;
  }
}

export async function getPricingFlags() {
  return DEFAULT_FLAGS;
}

export async function getQuotaState(deviceId, tier) {
  const limits = DEFAULT_TIERS[tier] || DEFAULT_TIERS.free;
  const q = qget(deviceId);
  return {
    used: q.pressAsks,
    limit: limits.pressAsksPerDay,
    remaining: Math.max(0, limits.pressAsksPerDay - q.pressAsks),
    costCents: q.costCents,
    costCapCents: Math.round(limits.dailyCostCapUSD * 100),
  };
}

export async function reservePressAsk(deviceId, tier) {
  const limits = DEFAULT_TIERS[tier] || DEFAULT_TIERS.free;
  const q = qget(deviceId);
  if (q.pressAsks >= limits.pressAsksPerDay) throw httpError(429, 'tier_quota');
  if (q.costCents >= limits.dailyCostCapUSD * 100) throw httpError(429, 'daily_cost_cap');
  q.pressAsks += 1;
  qset(deviceId, q);
  return { used: q.pressAsks, limit: limits.pressAsksPerDay, remaining: Math.max(0, limits.pressAsksPerDay - q.pressAsks) };
}

export async function settleCost(deviceId, costCents) {
  if (!costCents) return;
  const cents = Math.ceil(costCents);
  const q = qget(deviceId);
  q.costCents += cents;
  qset(deviceId, q);
  const day = todayStr();
  globalCost.set(day, (globalCost.get(day) || 0) + cents);
}

export async function refundPressAsk(deviceId) {
  const q = qget(deviceId);
  q.pressAsks = Math.max(0, q.pressAsks - 1);
  qset(deviceId, q);
}

export async function getGlobalSpendCents() {
  return globalCost.get(todayStr()) || 0;
}

export async function getProfile(deviceId) {
  return profiles.get(deviceId) || null;
}

export async function saveProfile(deviceId, profile) {
  profiles.set(deviceId, profile);
}

// uid -> merged progress doc
const progress = new Map();

export async function getProgress(uid) {
  return progress.get(uid) || null;
}

export async function saveProgress(uid, incoming) {
  const merged = mergeProgress(progress.get(uid) || null, incoming, Date.now());
  progress.set(uid, merged);
  return merged;
}

export { httpError };

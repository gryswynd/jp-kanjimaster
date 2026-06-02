/**
 * server/lib/firestore.js
 * Firestore access for devices, daily quota counters, and pricing flags.
 *
 * Collections (per the tutor plan):
 *   devices/{deviceId}                      { createdAt, entitlement, expiresAt, attestKeyId }
 *   devices/{deviceId}/quota/{YYYY-MM-DD}   { pressAsks, costCents }
 *   pricing-flags/global                    { killSwitch, maxDailyTotalUSD, ... }
 *   global-cost/{YYYY-MM-DD}                { costCents }  (aggregate circuit breaker)
 *
 * All counter mutations use transactions / atomic increments so concurrent
 * requests from one device can't race past a quota. Quota is enforced BEFORE the
 * expensive call (reserve), and actual cost is settled AFTER (settle).
 */

import { Firestore, FieldValue } from '@google-cloud/firestore';
import { env, DEFAULT_TIERS, DEFAULT_FLAGS } from './config.js';
import { mergeProgress } from './merge-progress.js';

let db = null;
/** Lazy singleton so the module imports cleanly even with no credentials. */
function client() {
  if (!db) db = new Firestore(env.gcloudProject ? { projectId: env.gcloudProject } : {});
  return db;
}

export function todayStr(d = new Date()) {
  // YYYY-MM-DD in UTC — server-side day boundary (documented for client mirror).
  return d.toISOString().slice(0, 10);
}

/** Resolve a device's tier. Beta entitlements (env) win, then Firestore, else free. */
export async function getEntitlement(deviceId) {
  if (env.betaEntitlements[deviceId]) return env.betaEntitlements[deviceId];
  const snap = await client().doc(`devices/${deviceId}`).get();
  const tier = snap.exists ? snap.get('entitlement') : null;
  return tier && DEFAULT_TIERS[tier] ? tier : 'free';
}

export async function ensureDevice(deviceId, attestKeyId) {
  const ref = client().doc(`devices/${deviceId}`);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      createdAt: FieldValue.serverTimestamp(),
      entitlement: 'free',
      attestKeyId: attestKeyId || null,
    });
  } else if (attestKeyId && !snap.get('attestKeyId')) {
    await ref.update({ attestKeyId });
  }
}

export async function getPricingFlags() {
  try {
    const snap = await client().doc('pricing-flags/global').get();
    if (!snap.exists) return DEFAULT_FLAGS;
    return { ...DEFAULT_FLAGS, ...snap.data(), pressAsk: { ...DEFAULT_FLAGS.pressAsk, ...(snap.get('pressAsk') || {}) } };
  } catch {
    return DEFAULT_FLAGS;
  }
}

export async function getQuotaState(deviceId, tier) {
  const limits = DEFAULT_TIERS[tier] || DEFAULT_TIERS.free;
  const ref = client().doc(`devices/${deviceId}/quota/${todayStr()}`);
  const snap = await ref.get();
  const used = snap.exists ? (snap.get('pressAsks') || 0) : 0;
  const costCents = snap.exists ? (snap.get('costCents') || 0) : 0;
  return {
    used,
    limit: limits.pressAsksPerDay,
    remaining: Math.max(0, limits.pressAsksPerDay - used),
    costCents,
    costCapCents: Math.round(limits.dailyCostCapUSD * 100),
  };
}

/**
 * Atomically reserve one Press-to-Ask slot. Throws {status,reason} if the daily
 * count or the daily cost cap is already exceeded. Returns the post-increment state.
 */
export async function reservePressAsk(deviceId, tier) {
  const limits = DEFAULT_TIERS[tier] || DEFAULT_TIERS.free;
  const ref = client().doc(`devices/${deviceId}/quota/${todayStr()}`);
  return client().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const used = snap.exists ? (snap.get('pressAsks') || 0) : 0;
    const costCents = snap.exists ? (snap.get('costCents') || 0) : 0;
    if (used >= limits.pressAsksPerDay) {
      throw httpError(429, 'tier_quota');
    }
    if (costCents >= limits.dailyCostCapUSD * 100) {
      throw httpError(429, 'daily_cost_cap');
    }
    tx.set(ref, { pressAsks: used + 1 }, { merge: true });
    return { used: used + 1, limit: limits.pressAsksPerDay, remaining: Math.max(0, limits.pressAsksPerDay - used - 1) };
  });
}

/** Settle the real cost of a request onto today's device counter + global aggregate. */
export async function settleCost(deviceId, costCents) {
  if (!costCents) return;
  const cents = Math.ceil(costCents);
  const day = todayStr();
  await Promise.all([
    client().doc(`devices/${deviceId}/quota/${day}`).set(
      { costCents: FieldValue.increment(cents) }, { merge: true }),
    client().doc(`global-cost/${day}`).set(
      { costCents: FieldValue.increment(cents) }, { merge: true }),
  ]);
}

/** Refund a reserved P2A slot when the request fails before doing real work. */
export async function refundPressAsk(deviceId) {
  const ref = client().doc(`devices/${deviceId}/quota/${todayStr()}`);
  await ref.set({ pressAsks: FieldValue.increment(-1) }, { merge: true }).catch(() => {});
}

/** Global circuit breaker: today's total spend across all devices, in cents. */
export async function getGlobalSpendCents() {
  const snap = await client().doc(`global-cost/${todayStr()}`).get();
  return snap.exists ? (snap.get('costCents') || 0) : 0;
}

// Cross-session learner profile (summarized; see lib/profile.js). Path:
// devices/{deviceId}/meta/profile  (meta subcollection keeps it off the device doc).
export async function getProfile(deviceId) {
  const snap = await client().doc(`devices/${deviceId}/meta/profile`).get();
  return snap.exists ? snap.data() : null;
}

export async function saveProfile(deviceId, profile) {
  await client().doc(`devices/${deviceId}/meta/profile`).set(profile, { merge: true });
}

// ── Account-scoped progress (Firebase uid) — shared by the web app + Godot ──
// users/{uid} = { learning, streak, profile, game?, updatedAt, schemaVersion }

export async function getProgress(uid) {
  const snap = await client().doc(`users/${uid}`).get();
  return snap.exists ? snap.data() : null;
}

/** Merge the client's snapshot onto the stored doc in a transaction; return merged. */
export async function saveProgress(uid, incoming) {
  const ref = client().doc(`users/${uid}`);
  return client().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const stored = snap.exists ? snap.data() : null;
    const merged = mergeProgress(stored, incoming, Date.now());
    tx.set(ref, merged);
    return merged;
  });
}

// ── Bug reports (beta) ──────────────────────────────────────────────────────
// bug-reports/{auto-id} — one doc per submission. Read in the Firebase console.
export async function saveBugReport(report) {
  const ref = await client().collection('bug-reports').add({
    ...report,
    serverAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export function httpError(status, reason) {
  const e = new Error(reason);
  e.status = status;
  e.reason = reason;
  return e;
}

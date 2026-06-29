/**
 * story-gen/lib/store.js
 * Persistence for the generator: per-user story jobs + generated stories, a
 * per-user daily generation quota, global guardrails (pricing-flags/storygen),
 * and a cost rollup for the admin dashboard. Firestore in prod; an in-memory
 * backend for local dev (STORYGEN_STORE=memory or no GCLOUD_PROJECT).
 *
 * Firestore layout (same project as the tutor):
 *   users/{uid}/storyJobs/{jobId}        { status, params, storyId?, error?, rounds?, createdAt, updatedAt }
 *   users/{uid}/customStories/{storyId}  { ...story.json, createdAt, sharedBy? }
 *   users/{uid}/storyGenQuota/{day}      { count }
 *   pricing-flags/storygen               { killSwitch, maxDailyTotalUSD, perUserPerDay, maxParagraphs }
 *   storygen-cost-rollup/{day}           { day, generations, costSumCents, svc, byUser }
 */
import { randomUUID } from 'node:crypto';
import { env, DEFAULT_FLAGS } from './config.js';
import { httpError } from './errors.js';

const today = () => new Date().toISOString().slice(0, 10);

// ── Firestore backend ────────────────────────────────────────────────────────
let _db = null;
async function db() {
  if (_db) return _db;
  const { Firestore } = await import('@google-cloud/firestore');
  _db = new Firestore({ projectId: env.gcloudProject || undefined });
  return _db;
}

// ── In-memory backend ────────────────────────────────────────────────────────
const mem = { jobs: new Map(), stories: new Map(), quota: new Map(), flags: null, rollup: new Map() };
const memKey = (uid, id) => `${uid}/${id}`;

const MEMORY = env.useMemoryStore;

// ── Pricing flags ─────────────────────────────────────────────────────────────
export async function getPricingFlags() {
  if (MEMORY) return { ...DEFAULT_FLAGS, ...(mem.flags || {}) };
  try {
    const snap = await (await db()).doc('pricing-flags/storygen').get();
    return { ...DEFAULT_FLAGS, ...(snap.exists ? snap.data() : {}) };
  } catch { return { ...DEFAULT_FLAGS }; }
}

// ── Quota / guardrails ─────────────────────────────────────────────────────────
// Reserve a generation slot: kill switch, global daily cost cap, per-user daily
// count. Throws 503/429 if blocked; increments the per-user count on success.
export async function reserveGeneration(uid) {
  const flags = await getPricingFlags();
  if (flags.killSwitch) throw httpError(503, 'kill_switch');
  const day = today();

  // Global daily spend cap (advisory pre-check; cost recorded post-hoc).
  const spentCents = await globalSpendCents(day);
  if (spentCents >= (flags.maxDailyTotalUSD || 0) * 100) throw httpError(503, 'daily_cost_cap');

  if (MEMORY) {
    const k = memKey(uid, day);
    const n = mem.quota.get(k) || 0;
    if (n >= flags.perUserPerDay) throw httpError(429, 'user_daily_cap');
    mem.quota.set(k, n + 1);
    return;
  }
  const ref = (await db()).doc(`users/${uid}/storyGenQuota/${day}`);
  await (await db()).runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const n = (snap.exists && snap.data().count) || 0;
    if (n >= flags.perUserPerDay) throw httpError(429, 'user_daily_cap');
    tx.set(ref, { count: n + 1 }, { merge: true });
  });
}

export async function releaseGeneration(uid) {
  const day = today();
  try {
    if (MEMORY) { const k = memKey(uid, day); mem.quota.set(k, Math.max(0, (mem.quota.get(k) || 1) - 1)); return; }
    const ref = (await db()).doc(`users/${uid}/storyGenQuota/${day}`);
    await (await db()).runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const n = (snap.exists && snap.data().count) || 0;
      tx.set(ref, { count: Math.max(0, n - 1) }, { merge: true });
    });
  } catch { /* refund is best-effort */ }
}

async function globalSpendCents(day) {
  try {
    if (MEMORY) return (mem.rollup.get(day) || {}).costSumCents || 0;
    const snap = await (await db()).doc(`storygen-cost-rollup/${day}`).get();
    return (snap.exists && snap.data().costSumCents) || 0;
  } catch { return 0; }
}

// ── Jobs ───────────────────────────────────────────────────────────────────────
export async function createJob(uid, params) {
  const jobId = randomUUID();
  const job = { jobId, status: 'pending', params, storyId: null, error: null, rounds: 0, createdAt: Date.now(), updatedAt: Date.now() };
  if (MEMORY) { mem.jobs.set(memKey(uid, jobId), job); return jobId; }
  await (await db()).doc(`users/${uid}/storyJobs/${jobId}`).set(job);
  return jobId;
}
export async function updateJob(uid, jobId, patch) {
  const p = { ...patch, updatedAt: Date.now() };
  if (MEMORY) { const k = memKey(uid, jobId); mem.jobs.set(k, { ...(mem.jobs.get(k) || {}), ...p }); return; }
  await (await db()).doc(`users/${uid}/storyJobs/${jobId}`).set(p, { merge: true });
}
export async function getJob(uid, jobId) {
  if (MEMORY) return mem.jobs.get(memKey(uid, jobId)) || null;
  const snap = await (await db()).doc(`users/${uid}/storyJobs/${jobId}`).get();
  return snap.exists ? snap.data() : null;
}

// ── Stories ──────────────────────────────────────────────────────────────────
export async function saveStory(uid, story, extra = {}) {
  const storyId = story.id || randomUUID();
  const doc = { ...story, id: storyId, createdAt: Date.now(), ...extra };
  if (MEMORY) { mem.stories.set(memKey(uid, storyId), doc); return storyId; }
  await (await db()).doc(`users/${uid}/customStories/${storyId}`).set(doc);
  return storyId;
}
export async function getStory(uid, storyId) {
  if (MEMORY) return mem.stories.get(memKey(uid, storyId)) || null;
  const snap = await (await db()).doc(`users/${uid}/customStories/${storyId}`).get();
  return snap.exists ? snap.data() : null;
}
export async function listStories(uid) {
  const meta = (s) => ({ id: s.id, title: s.title, englishTitle: s.englishTitle, createdAt: s.createdAt, sharedBy: s.sharedBy || null, paragraphs: (s.paragraphs || []).length });
  if (MEMORY) {
    return [...mem.stories.entries()].filter(([k]) => k.startsWith(uid + '/')).map(([, s]) => meta(s)).sort((a, b) => b.createdAt - a.createdAt);
  }
  const snap = await (await db()).collection(`users/${uid}/customStories`).get();
  return snap.docs.map(d => meta(d.data())).sort((a, b) => b.createdAt - a.createdAt);
}

// ── Cost rollup ────────────────────────────────────────────────────────────────
export async function recordCost(uid, email, totalCents, breakdown) {
  const day = today();
  if (MEMORY) {
    const r = mem.rollup.get(day) || { day, generations: 0, costSumCents: 0, svc: {}, byUser: {} };
    r.generations++; r.costSumCents += totalCents;
    r.svc.claudeInputCents = (r.svc.claudeInputCents || 0) + (breakdown.claudeInputCents || 0);
    r.svc.claudeOutputCents = (r.svc.claudeOutputCents || 0) + (breakdown.claudeOutputCents || 0);
    const bu = r.byUser[uid] || { generations: 0, costCents: 0, email: email || null };
    bu.generations++; bu.costCents += totalCents; bu.email = email || bu.email;
    r.byUser[uid] = bu; mem.rollup.set(day, r);
    return;
  }
  const { FieldValue } = await import('@google-cloud/firestore');
  const ref = (await db()).doc(`storygen-cost-rollup/${day}`);
  await ref.set({
    day,
    generations: FieldValue.increment(1),
    costSumCents: FieldValue.increment(totalCents),
    [`svc.claudeInputCents`]: FieldValue.increment(breakdown.claudeInputCents || 0),
    [`svc.claudeOutputCents`]: FieldValue.increment(breakdown.claudeOutputCents || 0),
    [`byUser.${uid}.generations`]: FieldValue.increment(1),
    [`byUser.${uid}.costCents`]: FieldValue.increment(totalCents),
    [`byUser.${uid}.email`]: email || null,
  }, { merge: true });
}

export async function getCostRollups(days = 7) {
  if (MEMORY) return [...mem.rollup.values()].sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, days);
  const snap = await (await db()).collection('storygen-cost-rollup').orderBy('day', 'desc').limit(days).get();
  return snap.docs.map(d => d.data());
}

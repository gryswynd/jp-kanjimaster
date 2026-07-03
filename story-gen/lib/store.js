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
import { randomUUID, randomBytes } from 'node:crypto';
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
const mem = { jobs: new Map(), stories: new Map(), quota: new Map(), flags: null, rollup: new Map(), codes: new Map(), userCode: new Map(), friends: new Map(), generations: [] };
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

// ── Push tokens (FCM) ───────────────────────────────────────────────────────
// Stored as users/{uid}.pushTokens (array of {token, platform, ts}); de-duped.
export async function savePushToken(uid, token, platform) {
  if (!token) return;
  if (MEMORY) {
    const k = memKey(uid, 'push');
    const arr = (mem.quota.get(k) || []).filter(t => t.token !== token);
    arr.push({ token, platform: platform || '', ts: Date.now() });
    mem.quota.set(k, arr);
    return;
  }
  const ref = (await db()).doc(`users/${uid}`);
  await (await db()).runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const arr = ((snap.exists && snap.data().pushTokens) || []).filter(t => t && t.token !== token);
    arr.push({ token, platform: platform || '', ts: Date.now() });
    tx.set(ref, { pushTokens: arr.slice(-10) }, { merge: true });   // cap per user
  });
}
export async function getPushTokens(uid) {
  if (MEMORY) return (mem.quota.get(memKey(uid, 'push')) || []).map(t => t.token);
  const snap = await (await db()).doc(`users/${uid}`).get();
  return ((snap.exists && snap.data().pushTokens) || []).map(t => t.token).filter(Boolean);
}
export async function prunePushTokens(uid, deadTokens) {
  if (!deadTokens || !deadTokens.length) return;
  const dead = new Set(deadTokens);
  if (MEMORY) {
    const k = memKey(uid, 'push');
    mem.quota.set(k, (mem.quota.get(k) || []).filter(t => !dead.has(t.token)));
    return;
  }
  const ref = (await db()).doc(`users/${uid}`);
  await (await db()).runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const arr = ((snap.exists && snap.data().pushTokens) || []).filter(t => t && !dead.has(t.token));
    tx.set(ref, { pushTokens: arr }, { merge: true });
  });
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
  // NOTE: set({merge:true}) treats dotted keys as LITERAL field names (not nested
  // paths — that's update()'s behaviour). Nest the maps as real objects so the
  // dashboard's r.svc.* / r.byUser[uid].* reads resolve; increment sentinels and
  // deep-merge both work at any depth, so sibling users aren't clobbered.
  await ref.set({
    day,
    generations: FieldValue.increment(1),
    costSumCents: FieldValue.increment(totalCents),
    svc: {
      claudeInputCents: FieldValue.increment(breakdown.claudeInputCents || 0),
      claudeOutputCents: FieldValue.increment(breakdown.claudeOutputCents || 0),
    },
    byUser: {
      [uid]: {
        generations: FieldValue.increment(1),
        costCents: FieldValue.increment(totalCents),
        email: email || null,
      },
    },
  }, { merge: true });
}

export async function getCostRollups(days = 7) {
  if (MEMORY) return [...mem.rollup.values()].sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, days);
  const snap = await (await db()).collection('storygen-cost-rollup').orderBy('day', 'desc').limit(days).get();
  return snap.docs.map(d => d.data());
}

// ── Per-generation report log (storygen-generations/{id}) ────────────────────
// One rich row per request (success OR failure) for the admin report: who, title,
// theme/cast, level, length target→actual, rounds, latency, cost, quality scores.
export async function recordGeneration(record) {
  const rec = { ...record, createdAt: record.createdAt || Date.now() };
  if (MEMORY) {
    mem.generations.unshift(rec);
    if (mem.generations.length > 500) mem.generations.length = 500;
    return;
  }
  await (await db()).doc(`storygen-generations/${randomUUID()}`).set(rec);
}

export async function getRecentGenerations(limit = 50) {
  if (MEMORY) return mem.generations.slice(0, limit);
  const snap = await (await db()).collection('storygen-generations').orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map(d => d.data());
}

// ── Friends (codes + mutual links + coarse progress) ─────────────────────────
// Firestore: users/{uid}.friendCode, friendCodes/{code}={uid},
//            users/{uid}/friends/{friendUid}={since}
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I/L
function makeCode() {
  let s = '';
  const bytes = randomBytes(8);
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return s;
}

export async function ensureFriendCode(uid) {
  if (MEMORY) {
    if (mem.userCode.has(uid)) return mem.userCode.get(uid);
    let code; do { code = makeCode(); } while (mem.codes.has(code));
    mem.userCode.set(uid, code); mem.codes.set(code, uid); return code;
  }
  const ref = (await db()).doc(`users/${uid}`);
  const snap = await ref.get();
  if (snap.exists && snap.data().friendCode) return snap.data().friendCode;
  // Mint a unique code (retry on collision).
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makeCode();
    const codeRef = (await db()).doc(`friendCodes/${code}`);
    try {
      await (await db()).runTransaction(async (tx) => {
        const c = await tx.get(codeRef);
        if (c.exists) throw new Error('collision');
        tx.set(codeRef, { uid });
        tx.set(ref, { friendCode: code }, { merge: true });
      });
      return code;
    } catch (e) { if (String(e.message) !== 'collision') throw e; }
  }
  throw httpError(500, 'code_mint_failed');
}

export async function resolveFriendCode(code) {
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!c) return null;
  if (MEMORY) return mem.codes.get(c) || null;
  const snap = await (await db()).doc(`friendCodes/${c}`).get();
  return snap.exists ? snap.data().uid : null;
}

export async function addFriendMutual(uid, friendUid) {
  if (uid === friendUid) throw httpError(400, 'cannot_friend_self');
  const now = Date.now();
  if (MEMORY) {
    if (!mem.friends.has(uid)) mem.friends.set(uid, new Map());
    if (!mem.friends.has(friendUid)) mem.friends.set(friendUid, new Map());
    mem.friends.get(uid).set(friendUid, now); mem.friends.get(friendUid).set(uid, now);
    return;
  }
  await (await db()).doc(`users/${uid}/friends/${friendUid}`).set({ since: now }, { merge: true });
  await (await db()).doc(`users/${friendUid}/friends/${uid}`).set({ since: now }, { merge: true });
}

export async function removeFriend(uid, friendUid) {
  if (MEMORY) {
    if (mem.friends.has(uid)) mem.friends.get(uid).delete(friendUid);
    if (mem.friends.has(friendUid)) mem.friends.get(friendUid).delete(uid);
    return;
  }
  await (await db()).doc(`users/${uid}/friends/${friendUid}`).delete().catch(() => {});
  await (await db()).doc(`users/${friendUid}/friends/${uid}`).delete().catch(() => {});
}

export async function listFriendUids(uid) {
  if (MEMORY) return [...(mem.friends.get(uid) || new Map()).keys()];
  const snap = await (await db()).collection(`users/${uid}/friends`).get();
  return snap.docs.map(d => d.id);
}

// Coarse progress for a friend (no raw scores / flags). Pure so it's testable
// without Firestore — friendSummary fetches the synced users/{uid} doc
// (written by the tutor's progress sync; same Firestore project) and delegates.
export function summarizeUserDoc(uid, data) {
  const learning = (data && data.learning) || {};
  const completed = learning.lessonCompleted || {};
  const rank = (id) => { const m = /^N([345])\.(\d+)$/.exec(id); return m ? (5 - +m[1]) * 1000 + +m[2] : -1; };
  let furthest = '', best = -1;
  for (const id of Object.keys(completed)) if (completed[id] && rank(id) > best) { best = rank(id); furthest = id; }
  const level = /^N4\./.test(furthest) ? 'N4' : (furthest ? 'N5' : (learning.n4Unlocked ? 'N4' : 'N5'));
  const profile = (data && data.profile) || {};
  const streak = (data && data.streak) || {};
  const gamify = (data && data.gamify) || {};
  const srsItems = (data && data.srs && data.srs.items) || {};
  const kw = gamify.keikoWeek;
  return {
    uid,
    name: (profile.first || '').trim() || 'Friend',
    level,
    lessonsCompleted: Object.values(completed).filter(Boolean).length,
    streak: streak.current || 0,
    streakBest: streak.best || 0,
    lastActive: streak.lastActive || '',
    // {weekStart, earned} | null — the dojo-roster ranking metric. Clients
    // compare weekStart against their own current week (stale → ranks as 0).
    weekKeiko: (kw && typeof kw.weekStart === 'string' && kw.weekStart)
      ? { weekStart: kw.weekStart, earned: +kw.earned || 0 }
      : null,
    achievementCount: Object.keys(gamify.achievements || {}).length,
    masteredCount: Object.values(srsItems).filter((it) => it && it.r === 5).length,
  };
}

export async function friendSummary(uid) {
  let data = null;
  if (!MEMORY) { const s = await (await db()).doc(`users/${uid}`).get(); data = s.exists ? s.data() : null; }
  return summarizeUserDoc(uid, data);
}

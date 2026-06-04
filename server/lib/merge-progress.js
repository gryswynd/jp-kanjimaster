/**
 * server/lib/merge-progress.js
 * Pure, idempotent merge of two progress snapshots into one. The server is the
 * single merge authority: a client PUTs its snapshot, we merge it onto the stored
 * doc and return the result, which the client then applies — so two devices
 * converge without either clobbering the other.
 *
 * Merge rules (chosen so progress is MONOTONIC — you can never lose ground):
 *   scores / reviewScores / bestScores / flags → max per key
 *   lessonCompleted / activeFlags             → OR  per key (true wins)
 *   n4Unlocked                                → OR
 *   streak.best / freezes                     → max
 *   streak.history                            → union (deduped, sorted)
 *   streak.current / lastActive               → the side with the later lastActive
 *   composeDrafts / profile                   → last-write (side with newer updatedAt)
 *
 * Shape (both stored + incoming):
 *   { learning:{ lessonScores, lessonCompleted, reviewScores, flags, activeFlags,
 *                bestScores, composeDrafts, n4Unlocked },
 *     streak:{ current, best, lastActive, history[], freezes },
 *     profile:{ first, last, email },
 *     updatedAt: <ms epoch>, schemaVersion: 1 }
 */

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);

function maxMap(a, b) {
  const out = { ...(a || {}) };
  const src = b || {};
  for (const k of Object.keys(src)) out[k] = Math.max(num(out[k]), num(src[k]));
  return out;
}

function orMap(a, b) {
  const out = { ...(a || {}) };
  const src = b || {};
  for (const k of Object.keys(src)) out[k] = !!out[k] || !!src[k];
  return out;
}

function unionSorted(a, b) {
  const set = new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]);
  return Array.from(set).sort();
}

function mergeLearning(a, b) {
  a = a || {}; b = b || {};
  return {
    lessonScores:    maxMap(a.lessonScores, b.lessonScores),
    lessonCompleted: orMap(a.lessonCompleted, b.lessonCompleted),
    reviewScores:    maxMap(a.reviewScores, b.reviewScores),
    flags:           maxMap(a.flags, b.flags),
    activeFlags:     orMap(a.activeFlags, b.activeFlags),
    bestScores:      maxMap(a.bestScores, b.bestScores),
    // drafts are last-write at the section level (handled by caller via updatedAt)
    composeDrafts:   { ...(a.composeDrafts || {}), ...(b.composeDrafts || {}) },
    n4Unlocked:      !!a.n4Unlocked || !!b.n4Unlocked,
  };
}

function mergeStreak(a, b) {
  a = a || {}; b = b || {};
  const aDate = a.lastActive || '';
  const bDate = b.lastActive || '';
  const newer = bDate >= aDate ? b : a; // ties → incoming (b)
  return {
    best:       Math.max(num(a.best), num(b.best)),
    freezes:    Math.max(num(a.freezes), num(b.freezes)),
    history:    unionSorted(a.history, b.history),
    current:    num(newer.current),
    lastActive: newer.lastActive || aDate || bDate || '',
  };
}

/**
 * @param {object|null} stored  — current server doc (or null if first write)
 * @param {object} incoming     — the client's snapshot (carries `updatedAt`)
 * @param {number} now          — ms epoch (server clock)
 */
export function mergeProgress(stored, incoming, now) {
  incoming = incoming || {};
  if (!stored) {
    return {
      learning: mergeLearning(null, incoming.learning),
      streak:   mergeStreak(null, incoming.streak),
      profile:  incoming.profile || {},
      updatedAt: now,
      schemaVersion: 1,
    };
  }
  const incomingNewer = num(incoming.updatedAt) >= num(stored.updatedAt);
  // last-write sections pick the newer side wholesale
  const profile = incomingNewer ? (incoming.profile || stored.profile || {})
                                 : (stored.profile || {});
  const merged = {
    learning: mergeLearning(stored.learning, incoming.learning),
    streak:   mergeStreak(stored.streak, incoming.streak),
    profile,
    updatedAt: Math.max(num(stored.updatedAt), num(incoming.updatedAt), num(now)),
    schemaVersion: 1,
  };
  // composeDrafts: union keys, but on a key conflict the newer side wins
  const base = incomingNewer ? (stored.learning && stored.learning.composeDrafts)
                             : (incoming.learning && incoming.learning.composeDrafts);
  const top  = incomingNewer ? (incoming.learning && incoming.learning.composeDrafts)
                             : (stored.learning && stored.learning.composeDrafts);
  merged.learning.composeDrafts = { ...(base || {}), ...(top || {}) };
  // preserve the game section (Godot, Phase 2) — web never sends it
  if (stored.game || incoming.game) {
    merged.game = { ...(stored.game || {}), ...(incoming.game || {}) };
  }
  return merged;
}

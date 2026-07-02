/**
 * server/lib/merge-progress.js
 * Pure, idempotent merge of two progress snapshots into one. The server is the
 * single merge authority: a client PUTs its snapshot, we merge it onto the stored
 * doc and return the result, which the client then applies — so two devices
 * converge without either clobbering the other.
 *
 * Merge rules (chosen so progress is MONOTONIC — you can never lose ground):
 *   scores / reviewScores / bestScores / flags → max per key
 *   gameResults                               → completion monotonic (complete wins), ts tiebreak
 *   lessonCompleted / activeFlags             → OR  per key (true wins)
 *   n4Unlocked                                → OR
 *   streak.best / freezes                     → max
 *   streak.history                            → union (deduped, sorted)
 *   streak.current / lastActive               → the side with the later lastActive
 *   gamify.keikoEarned / keikoSpent           → max (monotonic lifetime counters)
 *   srs.items                                 → per-key later-lastReviewed-ts wins; srs.seeded → OR
 *   composeDrafts / profile                   → last-write (side with newer updatedAt)
 *
 * Shape (both stored + incoming):
 *   { learning:{ lessonScores, lessonCompleted, reviewScores, flags, activeFlags,
 *                bestScores, composeDrafts, gameResults, n4Unlocked },
 *     streak:{ current, best, lastActive, history[], freezes },
 *     gamify:{ keikoEarned, keikoSpent },
 *     profile:{ first, last, email },
 *     updatedAt: <ms epoch>, schemaVersion: 2 }
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

// Web mini-game results, keyed by full localStorage key (k-scr-/k-conn-/k-conn4-/
// k-mara-…) → { status, ts, tilt }. Completion is monotonic (status:'complete'
// wins); ties broken by most-recent ts. Mirror of app/shared/sync.js.
function mergeGameResults(a, b) {
  const out = { ...(a || {}) };
  const src = b || {};
  for (const k of Object.keys(src)) {
    const av = out[k], bv = src[k];
    if (!av) { out[k] = bv; continue; }
    if (!bv) continue;
    const aDone = av && av.status === 'complete';
    const bDone = bv && bv.status === 'complete';
    if (aDone && !bDone) out[k] = av;
    else if (bDone && !aDone) out[k] = bv;
    else out[k] = (num(bv && bv.ts) >= num(av && av.ts)) ? bv : av;
  }
  return out;
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
    gameResults:     mergeGameResults(a.gameResults, b.gameResults),
    n4Unlocked:      !!a.n4Unlocked || !!b.n4Unlocked,
  };
}

// SRS review items: { "<level>:<id>"|"G12": {r, due, ts} }. Per-key merge:
// the side with the later lastReviewed ts wins (a real review, ts>0, always
// beats a fresh seed at ts:0; ties resolve to the incoming/b side so two
// same-day seeds converge deterministically). Mirror of app/shared/sync.js.
function mergeSrsItems(a, b) {
  const out = { ...(a || {}) };
  const src = b || {};
  for (const k of Object.keys(src)) {
    const av = out[k], bv = src[k];
    if (!av) { out[k] = bv; continue; }
    if (!bv) continue;
    out[k] = (num(bv && bv.ts) >= num(av && av.ts)) ? bv : av;
  }
  return out;
}

function mergeSrs(a, b) {
  a = a || {}; b = b || {};
  return {
    items: mergeSrsItems(a.items, b.items),
    seeded: !!a.seeded || !!b.seeded,
  };
}

// Achievement grants: union of ids, earliest positive grant timestamp wins.
function minTsMap(a, b) {
  const out = { ...(a || {}) };
  const src = b || {};
  for (const k of Object.keys(src)) {
    const av = num(out[k]), bv = num(src[k]);
    out[k] = (av > 0 && bv > 0) ? Math.min(av, bv) : (av || bv);
  }
  return out;
}

// Keiko currency counters are monotonic (earned/spent only ever increase on a
// device), so max() per counter converges without ever "un-spending".
// Phase 3 adds achievement grants (min-ts), cosmetic ownership (OR), and the
// active seal ink (later selection wins). Mirror of app/shared/sync.js.
function mergeGamify(a, b) {
  a = a || {}; b = b || {};
  const inkNewer = num(b.sealInkTs) >= num(a.sealInkTs) ? b : a;
  return {
    keikoEarned: Math.max(num(a.keikoEarned), num(b.keikoEarned)),
    keikoSpent:  Math.max(num(a.keikoSpent), num(b.keikoSpent)),
    achievements: minTsMap(a.achievements, b.achievements),
    inksOwned:    orMap(a.inksOwned, b.inksOwned),
    stampsOwned:  orMap(a.stampsOwned, b.stampsOwned),
    castUnlocked: orMap(a.castUnlocked, b.castUnlocked),
    sealInk:      inkNewer.sealInk || a.sealInk || b.sealInk || '',
    sealInkTs:    Math.max(num(a.sealInkTs), num(b.sealInkTs)),
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
      gamify:   mergeGamify(null, incoming.gamify),
      srs:      mergeSrs(null, incoming.srs),
      profile:  incoming.profile || {},
      updatedAt: now,
      schemaVersion: 2,
    };
  }
  const incomingNewer = num(incoming.updatedAt) >= num(stored.updatedAt);
  // last-write sections pick the newer side wholesale
  const profile = incomingNewer ? (incoming.profile || stored.profile || {})
                                 : (stored.profile || {});
  const merged = {
    learning: mergeLearning(stored.learning, incoming.learning),
    streak:   mergeStreak(stored.streak, incoming.streak),
    gamify:   mergeGamify(stored.gamify, incoming.gamify),
    srs:      mergeSrs(stored.srs, incoming.srs),
    profile,
    updatedAt: Math.max(num(stored.updatedAt), num(incoming.updatedAt), num(now)),
    schemaVersion: 2,
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

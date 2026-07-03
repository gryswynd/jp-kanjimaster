// app/shared/sync.js
// Mirrors local progress (the k-* keys) to the cloud and back, through OUR server
// (/v1/progress) using the Firebase ID token from auth.js. Registers
// window.JPShared.sync.
//
// INERT unless BOTH (a) auth is enabled (RIKIZO_FIREBASE configured) and (b) a
// server base URL is known. Otherwise everything no-ops and the app stays purely
// local — exactly as today.
//
// Strategy: snapshot the known keys → PUT (server merges + returns the merged
// doc) → apply merged back locally. pull() on login/foreground; push() debounced
// after any synced-key write + on backgrounding. A localStorage.setItem
// interceptor catches scattered writes so no other module needs editing.
(function () {
  'use strict';
  window.JPShared = window.JPShared || {};

  var EXACT = [
    'k-lesson-scores', 'k-lesson-completed', 'k-review-scores',
    'k-flags', 'k-active-flags', 'k-n4-unlocked',
    'k-streak-current', 'k-streak-best', 'k-streak-last-active',
    'k-streak-history', 'k-streak-freezes',
    'k-keiko-earned', 'k-keiko-spent', 'k-keiko-week',
    'k-srs-items', 'k-srs-seeded',
    'k-achievements', 'k-seal-ink', 'k-seal-ink-ts',
    'k-inks-owned', 'k-stamps-owned', 'k-cast-unlocked',
    'k-user-first', 'k-user-last', 'k-user-email',
  ];
  // Web mini-game per-puzzle results (status:'complete' + stamp): scramble k-scr-,
  // link-up k-conn-/k-conn4-, marathon k-mara-. Synced as learning.gameResults so
  // students keep their stamps across devices/reinstalls. (Distinct from the
  // server's reserved `game` section, which is for the Godot adventure — Phase 2.)
  var GAME_PREFIXES = ['k-scr-', 'k-conn-', 'k-conn4-', 'k-mara-'];
  var PREFIXES = ['k-best-', 'compose-draft-'].concat(GAME_PREFIXES);

  var suppress = false;       // true while applyRemote writes (don't re-trigger push)
  var pushTimer = null;
  var pushing = false;
  var pendingPush = false;

  // ── helpers ────────────────────────────────────────────────────────────────
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function parseObj(k) { try { return JSON.parse(lsGet(k) || '{}') || {}; } catch (e) { return {}; } }
  function parseArr(k) { try { return JSON.parse(lsGet(k) || '[]') || []; } catch (e) { return []; } }
  function numOf(k) { var n = parseFloat(lsGet(k)); return isFinite(n) ? n : 0; }

  function isSyncedKey(k) {
    if (!k) return false;
    if (EXACT.indexOf(k) >= 0) return true;
    for (var i = 0; i < PREFIXES.length; i++) if (k.indexOf(PREFIXES[i]) === 0) return true;
    return false;
  }

  function collectPrefixed(prefix, asNumber) {
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(prefix) === 0) {
          var sub = k.slice(prefix.length);
          out[sub] = asNumber ? numOf(k) : lsGet(k);
        }
      }
    } catch (e) {}
    return out;
  }

  // Collect all web mini-game results, keyed by FULL localStorage key (so apply
  // can write them straight back). Values are parsed result objects {status,ts,tilt}.
  function collectGameResults() {
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i); if (!k) continue;
        for (var p = 0; p < GAME_PREFIXES.length; p++) {
          if (k.indexOf(GAME_PREFIXES[p]) === 0) {
            try { out[k] = JSON.parse(lsGet(k)); } catch (e) { out[k] = lsGet(k); }
            break;
          }
        }
      }
    } catch (e) {}
    return out;
  }

  // Merge two SRS item maps per key: later lastReviewed ts wins (a real review,
  // ts>0, always beats a fresh ts:0 seed; ties → the b side, so two same-day
  // seeds converge). Mirror of server lib/merge-progress.js mergeSrsItems.
  function mergeSrsItems(a, b) {
    var out = {}; var k;
    a = a || {}; b = b || {};
    for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) out[k] = a[k];
    for (k in b) {
      if (!Object.prototype.hasOwnProperty.call(b, k)) continue;
      var av = out[k], bv = b[k];
      if (!av) { out[k] = bv; continue; }
      if (!bv) continue;
      out[k] = ((+(bv && bv.ts) || 0) >= (+(av && av.ts) || 0)) ? bv : av;
    }
    return out;
  }

  // Merge two gameResults maps: completion is monotonic (status:'complete' wins);
  // ties broken by the most-recent ts. Mirror of server lib/merge-progress.js.
  function mergeGameResults(a, b) {
    var out = {}; var k;
    a = a || {}; b = b || {};
    for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) out[k] = a[k];
    for (k in b) {
      if (!Object.prototype.hasOwnProperty.call(b, k)) continue;
      var av = out[k], bv = b[k];
      if (!av) { out[k] = bv; continue; }
      if (!bv) continue;
      var aDone = av && av.status === 'complete';
      var bDone = bv && bv.status === 'complete';
      if (aDone && !bDone) out[k] = av;
      else if (bDone && !aDone) out[k] = bv;
      else out[k] = ((+(bv && bv.ts) || 0) >= (+(av && av.ts) || 0)) ? bv : av;
    }
    return out;
  }

  function baseUrl() {
    try { var qp = new URLSearchParams(location.search).get('tutor'); if (qp) return qp; } catch (e) {}
    var ls = lsGet('k-tutor-base-url'); if (ls) return ls;
    var c = (window.JPApp && window.JPApp.config) || {};
    // apiBaseUrl is sync's own default (set in index.html) — kept separate from
    // tutorBaseUrl so enabling progress sync does NOT enable the paid AI tutor.
    if (c.apiBaseUrl) return c.apiBaseUrl;
    if (c.tutorBaseUrl) return c.tutorBaseUrl;
    return '';
  }
  function deviceId() { return lsGet('k-device-id') || ''; }
  function authApi() { return window.JPShared && window.JPShared.auth; }
  function ready() {
    var a = authApi();
    return !!(a && a.isEnabled() && baseUrl());
  }

  // ── snapshot (local → structured) ────────────────────────────────────────
  function snapshot() {
    return {
      learning: {
        lessonScores: parseObj('k-lesson-scores'),
        lessonCompleted: parseObj('k-lesson-completed'),
        reviewScores: parseObj('k-review-scores'),
        flags: parseObj('k-flags'),
        activeFlags: parseObj('k-active-flags'),
        bestScores: collectPrefixed('k-best-', true),
        composeDrafts: collectPrefixed('compose-draft-', false),
        gameResults: collectGameResults(),
        n4Unlocked: lsGet('k-n4-unlocked') === 'true',
      },
      streak: {
        current: numOf('k-streak-current'),
        best: numOf('k-streak-best'),
        lastActive: lsGet('k-streak-last-active') || '',
        history: parseArr('k-streak-history'),
        freezes: numOf('k-streak-freezes'),
      },
      // Keiko currency: two MONOTONIC counters (earned/spent only increase),
      // so cross-device merge is a plain max() and never "un-spends".
      gamify: {
        keikoEarned: numOf('k-keiko-earned'),
        keikoSpent: numOf('k-keiko-spent'),
        // This week's earnings {weekStart, earned} — the friend-roster metric.
        keikoWeek: (function () {
          var w = null;
          try { w = JSON.parse(lsGet('k-keiko-week') || 'null'); } catch (e) {}
          return (w && typeof w.ws === 'string' && w.ws) ? { weekStart: w.ws, earned: +w.earned || 0 } : null;
        })(),
        // Phase 3: achievement grants (earliest ts wins per id) + cosmetic
        // ownership (OR) + active seal ink (later selection wins).
        achievements: parseObj('k-achievements'),
        inksOwned: parseObj('k-inks-owned'),
        stampsOwned: parseObj('k-stamps-owned'),
        castUnlocked: parseObj('k-cast-unlocked'),
        sealInk: lsGet('k-seal-ink') || '',
        sealInkTs: numOf('k-seal-ink-ts'),
      },
      // SRS review schedules: per-key {r, due, ts}. Merged per key by later
      // lastReviewed ts (a real review always beats a ts:0 seed).
      srs: {
        items: parseObj('k-srs-items'),
        seeded: lsGet('k-srs-seeded') === '1',
      },
      profile: {
        first: lsGet('k-user-first') || '',
        last: lsGet('k-user-last') || '',
        email: lsGet('k-user-email') || '',
      },
      updatedAt: Date.now(),
      schemaVersion: 2,
    };
  }

  // ── client-side merge (mirror of server lib/merge-progress.js) ─────────────
  function maxMap(a, b) { var o = Object.assign({}, a || {}); var s = b || {}; for (var k in s) o[k] = Math.max(+o[k] || 0, +s[k] || 0); return o; }
  // Achievement grants: union of ids, earliest positive grant timestamp wins.
  function minTsMap(a, b) { var o = Object.assign({}, a || {}); var s = b || {}; for (var k in s) { var av = +o[k] || 0, bv = +s[k] || 0; o[k] = (av > 0 && bv > 0) ? Math.min(av, bv) : (av || bv); } return o; }
  // Weekly keiko: a missing/invalid side never wins (old clients can't erase
  // it); different weeks → later week wholesale; same week → max(earned).
  function mergeKeikoWeek(a, b) {
    var ok = function (x) { return x && typeof x.weekStart === 'string' && x.weekStart; };
    if (!ok(a)) return ok(b) ? b : null;
    if (!ok(b)) return a;
    if (a.weekStart !== b.weekStart) return a.weekStart > b.weekStart ? a : b;
    return { weekStart: a.weekStart, earned: Math.max(+a.earned || 0, +b.earned || 0) };
  }
  function orMap(a, b) { var o = Object.assign({}, a || {}); var s = b || {}; for (var k in s) o[k] = !!o[k] || !!s[k]; return o; }
  function unionSorted(a, b) { var set = {}; (a || []).concat(b || []).forEach(function (x) { set[x] = 1; }); return Object.keys(set).sort(); }

  function mergeProgress(local, remote) {
    local = local || {}; remote = remote || {};
    var L = local.learning || {}, R = remote.learning || {};
    var remoteNewer = (+remote.updatedAt || 0) >= (+local.updatedAt || 0);
    var draftBase = remoteNewer ? (L.composeDrafts) : (R.composeDrafts);
    var draftTop = remoteNewer ? (R.composeDrafts) : (L.composeDrafts);
    var ls = local.streak || {}, rs = remote.streak || {};
    var newerStreak = (rs.lastActive || '') >= (ls.lastActive || '') ? rs : ls;
    return {
      learning: {
        lessonScores: maxMap(L.lessonScores, R.lessonScores),
        lessonCompleted: orMap(L.lessonCompleted, R.lessonCompleted),
        reviewScores: maxMap(L.reviewScores, R.reviewScores),
        flags: maxMap(L.flags, R.flags),
        activeFlags: orMap(L.activeFlags, R.activeFlags),
        bestScores: maxMap(L.bestScores, R.bestScores),
        composeDrafts: Object.assign({}, draftBase || {}, draftTop || {}),
        gameResults: mergeGameResults(L.gameResults, R.gameResults),
        n4Unlocked: !!L.n4Unlocked || !!R.n4Unlocked,
      },
      streak: {
        current: +newerStreak.current || 0,
        best: Math.max(+ls.best || 0, +rs.best || 0),
        lastActive: newerStreak.lastActive || ls.lastActive || rs.lastActive || '',
        history: unionSorted(ls.history, rs.history),
        freezes: Math.max(+ls.freezes || 0, +rs.freezes || 0),
      },
      gamify: (function () {
        var lg = local.gamify || {}, rg = remote.gamify || {};
        var inkNewer = (+rg.sealInkTs || 0) >= (+lg.sealInkTs || 0) ? rg : lg;
        return {
          keikoEarned: Math.max(+lg.keikoEarned || 0, +rg.keikoEarned || 0),
          keikoSpent: Math.max(+lg.keikoSpent || 0, +rg.keikoSpent || 0),
          keikoWeek: mergeKeikoWeek(lg.keikoWeek, rg.keikoWeek),
          achievements: minTsMap(lg.achievements, rg.achievements),
          inksOwned: orMap(lg.inksOwned, rg.inksOwned),
          stampsOwned: orMap(lg.stampsOwned, rg.stampsOwned),
          castUnlocked: orMap(lg.castUnlocked, rg.castUnlocked),
          sealInk: inkNewer.sealInk || lg.sealInk || rg.sealInk || '',
          sealInkTs: Math.max(+lg.sealInkTs || 0, +rg.sealInkTs || 0),
        };
      })(),
      srs: {
        items: mergeSrsItems((local.srs || {}).items, (remote.srs || {}).items),
        seeded: !!(local.srs || {}).seeded || !!(remote.srs || {}).seeded,
      },
      // Per-field, non-empty-preferring: the newer side wins a field only when
      // it actually HAS a value — an empty/missing name never replaces a real
      // one (protects against the old close()-wipe bug + clock skew). Known
      // limitation: an intentional cross-device clear won't propagate.
      profile: (function () {
        var lp = local.profile || {}, rp = remote.profile || {};
        var pick = function (pref, alt) { return String(pref || '').trim() ? pref : (alt || ''); };
        return remoteNewer
          ? { first: pick(rp.first, lp.first), last: pick(rp.last, lp.last), email: pick(rp.email, lp.email) }
          : { first: pick(lp.first, rp.first), last: pick(lp.last, rp.last), email: pick(lp.email, rp.email) };
      })(),
      updatedAt: Math.max(+local.updatedAt || 0, +remote.updatedAt || 0),
    };
  }

  // ── apply (merged → local) ─────────────────────────────────────────────────
  function applyRemote(remote) {
    if (!remote) return;
    var merged = mergeProgress(snapshot(), remote);
    suppress = true;
    try {
      var Lr = merged.learning;
      lsSet('k-lesson-scores', JSON.stringify(Lr.lessonScores));
      lsSet('k-lesson-completed', JSON.stringify(Lr.lessonCompleted));
      lsSet('k-review-scores', JSON.stringify(Lr.reviewScores));
      lsSet('k-flags', JSON.stringify(Lr.flags));
      lsSet('k-active-flags', JSON.stringify(Lr.activeFlags));
      Object.keys(Lr.bestScores || {}).forEach(function (cat) { lsSet('k-best-' + cat, String(Lr.bestScores[cat])); });
      Object.keys(Lr.composeDrafts || {}).forEach(function (sub) {
        var v = Lr.composeDrafts[sub]; if (v != null) lsSet('compose-draft-' + sub, String(v));
      });
      Object.keys(Lr.gameResults || {}).forEach(function (gk) {
        var gv = Lr.gameResults[gk];
        if (gv != null) lsSet(gk, typeof gv === 'string' ? gv : JSON.stringify(gv));
      });
      if (Lr.n4Unlocked) lsSet('k-n4-unlocked', 'true');

      var S = merged.streak;
      lsSet('k-streak-current', String(S.current));
      lsSet('k-streak-best', String(S.best));
      if (S.lastActive) lsSet('k-streak-last-active', S.lastActive);
      lsSet('k-streak-history', JSON.stringify(S.history));
      lsSet('k-streak-freezes', String(S.freezes));

      var G = merged.gamify || {};
      lsSet('k-keiko-earned', String(+G.keikoEarned || 0));
      lsSet('k-keiko-spent', String(+G.keikoSpent || 0));
      if (G.keikoWeek && G.keikoWeek.weekStart) {
        lsSet('k-keiko-week', JSON.stringify({ ws: G.keikoWeek.weekStart, earned: +G.keikoWeek.earned || 0 }));
      }
      if (G.achievements && Object.keys(G.achievements).length) lsSet('k-achievements', JSON.stringify(G.achievements));
      if (G.inksOwned && Object.keys(G.inksOwned).length) lsSet('k-inks-owned', JSON.stringify(G.inksOwned));
      if (G.stampsOwned && Object.keys(G.stampsOwned).length) lsSet('k-stamps-owned', JSON.stringify(G.stampsOwned));
      if (G.castUnlocked && Object.keys(G.castUnlocked).length) lsSet('k-cast-unlocked', JSON.stringify(G.castUnlocked));
      if (G.sealInk) { lsSet('k-seal-ink', G.sealInk); lsSet('k-seal-ink-ts', String(+G.sealInkTs || 0)); }

      var SR = merged.srs || {};
      if (SR.items && Object.keys(SR.items).length) lsSet('k-srs-items', JSON.stringify(SR.items));
      if (SR.seeded) lsSet('k-srs-seeded', '1'); // only ever sets — a device that seeded stays seeded

      var P = merged.profile || {};
      if (P.first) lsSet('k-user-first', P.first);
      if (P.last) lsSet('k-user-last', P.last);
      if (P.email) lsSet('k-user-email', P.email);
    } finally {
      suppress = false;
    }
    try { window.dispatchEvent(new CustomEvent('jp-progress-synced')); } catch (e) {}
  }

  // ── network ──────────────────────────────────────────────────────────────
  async function headers() {
    var token = await authApi().getIdToken();
    if (!token) return null;
    return { 'Authorization': 'Bearer ' + token, 'X-Device-Id': deviceId() };
  }

  async function pull() {
    if (!ready()) return;
    try {
      var h = await headers(); if (!h) return;
      var res = await fetch(baseUrl() + '/v1/progress', { headers: h });
      if (!res.ok) return;
      var data = await res.json();
      if (data && data.progress) applyRemote(data.progress);
      schedulePush(); // send any local-only progress up so both sides converge
    } catch (e) { /* offline: stay local, try again later */ }
  }

  async function push() {
    if (!ready()) { pendingPush = false; return; }
    if (pushing) { pendingPush = true; return; }
    pushing = true;
    try {
      var h = await headers(); if (!h) { pushing = false; return; }
      h['Content-Type'] = 'application/json';
      var res = await fetch(baseUrl() + '/v1/progress', {
        method: 'PUT', headers: h, body: JSON.stringify({ progress: snapshot() }), keepalive: true,
      });
      if (res.ok) {
        var data = await res.json();
        if (data && data.progress) applyRemote(data.progress);
      }
    } catch (e) { /* offline: retry on next trigger */ }
    pushing = false;
    if (pendingPush) { pendingPush = false; schedulePush(); }
  }

  function schedulePush(delay) {
    if (!ready()) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { pushTimer = null; push(); }, delay == null ? 4000 : delay);
  }

  // ── install ────────────────────────────────────────────────────────────────
  function installInterceptor() {
    if (localStorage.__jpSyncWrapped) return;
    var orig = localStorage.setItem.bind(localStorage);
    try {
      localStorage.setItem = function (k, v) {
        orig(k, v);
        if (!suppress && isSyncedKey(k)) schedulePush();
      };
      localStorage.__jpSyncWrapped = true;
    } catch (e) { /* some webviews lock Storage; sync still works via explicit push() */ }
  }

  function start() {
    installInterceptor();
    // Pull whenever a (signed-in) auth state arrives.
    window.addEventListener('jp-auth-changed', function (e) {
      if (e.detail && e.detail.user) pull();
    });
    // Foreground → pull; background → flush push.
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') pull();
      else schedulePush(0);
    });
    window.addEventListener('pagehide', function () { schedulePush(0); });
  }

  window.JPShared.sync = {
    start: start,
    snapshot: snapshot,
    applyRemote: applyRemote,
    pull: pull,
    push: function () { schedulePush(0); },
    isReady: ready,
  };
})();

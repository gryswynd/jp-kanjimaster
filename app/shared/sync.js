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
    'k-user-first', 'k-user-last', 'k-user-email',
  ];
  var PREFIXES = ['k-best-', 'compose-draft-'];

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
        n4Unlocked: lsGet('k-n4-unlocked') === 'true',
      },
      streak: {
        current: numOf('k-streak-current'),
        best: numOf('k-streak-best'),
        lastActive: lsGet('k-streak-last-active') || '',
        history: parseArr('k-streak-history'),
        freezes: numOf('k-streak-freezes'),
      },
      profile: {
        first: lsGet('k-user-first') || '',
        last: lsGet('k-user-last') || '',
        email: lsGet('k-user-email') || '',
      },
      updatedAt: Date.now(),
      schemaVersion: 1,
    };
  }

  // ── client-side merge (mirror of server lib/merge-progress.js) ─────────────
  function maxMap(a, b) { var o = Object.assign({}, a || {}); var s = b || {}; for (var k in s) o[k] = Math.max(+o[k] || 0, +s[k] || 0); return o; }
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
        n4Unlocked: !!L.n4Unlocked || !!R.n4Unlocked,
      },
      streak: {
        current: +newerStreak.current || 0,
        best: Math.max(+ls.best || 0, +rs.best || 0),
        lastActive: newerStreak.lastActive || ls.lastActive || rs.lastActive || '',
        history: unionSorted(ls.history, rs.history),
        freezes: Math.max(+ls.freezes || 0, +rs.freezes || 0),
      },
      profile: remoteNewer ? (remote.profile || local.profile || {}) : (local.profile || {}),
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
      if (Lr.n4Unlocked) lsSet('k-n4-unlocked', 'true');

      var S = merged.streak;
      lsSet('k-streak-current', String(S.current));
      lsSet('k-streak-best', String(S.best));
      if (S.lastActive) lsSet('k-streak-last-active', S.lastActive);
      lsSet('k-streak-history', JSON.stringify(S.history));
      lsSet('k-streak-freezes', String(S.freezes));

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

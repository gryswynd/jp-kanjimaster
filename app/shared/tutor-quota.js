/**
 * app/shared/tutor-quota.js
 * Best-effort local mirror of the Rikizo tutor's daily Press-to-Ask quota, so the
 * UI can show "N left today" without a round-trip on every render.
 *
 * The SERVER is the source of truth. This module is display-only and is
 * reconciled from server responses via syncFromServer(). It self-resets each
 * local day using the same todayStr() convention as app/shared/streak.js.
 *
 * localStorage keys:
 *   k-rikizo-quota — JSON { date: 'YYYY-MM-DD', pressAsks: <used>, limit: <n> }
 *
 * Self-registers on window.JPShared.tutorQuota.
 */

(function () {
  'use strict';

  window.JPShared = window.JPShared || {};

  var KEY = 'k-rikizo-quota';
  var DEFAULT_LIMIT = 5; // Free tier P2A/day — see tutor plan pricing table.

  /** YYYY-MM-DD in user's local timezone (matches streak.js). */
  function todayStr() {
    return new Date().toLocaleDateString('en-CA');
  }

  function read() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
    var st = null;
    if (raw) { try { st = JSON.parse(raw); } catch (e2) { st = null; } }
    if (!st || st.date !== todayStr()) {
      st = { date: todayStr(), pressAsks: 0, limit: (st && st.limit) || DEFAULT_LIMIT };
    }
    return st;
  }

  function write(st) {
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ }
  }

  /** Current display state: { used, limit, remaining }. */
  function getState() {
    var st = read();
    return {
      used: st.pressAsks,
      limit: st.limit,
      remaining: Math.max(0, st.limit - st.pressAsks)
    };
  }

  /** Optimistically count one local use (UI feedback before the server confirms). */
  function recordPressAsk() {
    var st = read();
    st.pressAsks += 1;
    write(st);
    return getState();
  }

  /** Reconcile with authoritative numbers carried on a tutor response. */
  function syncFromServer(info) {
    if (!info) return getState();
    var st = read();
    if (typeof info.limit === 'number') st.limit = info.limit;
    if (typeof info.used === 'number') {
      st.pressAsks = info.used;
    } else if (typeof info.remaining === 'number') {
      st.pressAsks = Math.max(0, st.limit - info.remaining);
    }
    write(st);
    return getState();
  }

  window.JPShared.tutorQuota = {
    getState: getState,
    recordPressAsk: recordPressAsk,
    syncFromServer: syncFromServer,
    DEFAULT_LIMIT: DEFAULT_LIMIT
  };
})();

/**
 * app/shared/keiko.js
 * Keiko (けいこ) points — the light practice currency earned from daily quests.
 *
 * localStorage keys:
 *   k-keiko-earned  — number, MONOTONIC lifetime total earned
 *   k-keiko-spent   — number, MONOTONIC lifetime total spent
 *   k-keiko-ledger  — JSON array [{ts, delta, reason}], newest last, capped
 *
 * Balance is DERIVED (earned - spent), never stored. Both counters only ever
 * increase, so cloud sync merges them with max() per device — a stored raw
 * balance would "un-spend" keiko when an older snapshot merged in.
 *
 * Load after streak.js (buyFreeze delegates to streak.addFreeze).
 */

(function () {
  'use strict';

  window.JPShared = window.JPShared || {};
  if (window.JPShared.keiko) return;

  var LEDGER_CAP = 40;

  // ── Week tracking (feeds the friend leaderboard) ────────────────────────
  // k-keiko-week = {ws:'YYYY-MM-DD' (Monday of the current week), earned:N}.
  // Rolls over inside earn(); reads normalize without writing so home renders
  // never trigger sync pushes.

  function todayStr() {
    try {
      var qa = localStorage.getItem('k-qa-date');
      if (qa && /^\d{4}-\d{2}-\d{2}$/.test(qa)) return qa;
    } catch (e) {}
    return new Date().toLocaleDateString('en-CA');
  }

  function weekStartOf(dateStr) {
    var d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // back to Monday
    return d.toLocaleDateString('en-CA');
  }

  function readWeek() {
    try { return JSON.parse(localStorage.getItem('k-keiko-week') || 'null'); }
    catch (e) { return null; }
  }

  function bumpWeek(amount) {
    try {
      var ws = weekStartOf(todayStr());
      var w = readWeek();
      if (!w || w.ws !== ws) w = { ws: ws, earned: 0 };
      w.earned = (+w.earned || 0) + amount;
      localStorage.setItem('k-keiko-week', JSON.stringify(w));
    } catch (e) {}
  }

  function getInt(key) {
    try {
      var v = parseInt(localStorage.getItem(key) || '0', 10);
      return isNaN(v) || v < 0 ? 0 : v;
    } catch (e) { return 0; }
  }

  function setInt(key, val) {
    try { localStorage.setItem(key, String(val)); } catch (e) { /* quota/private */ }
  }

  function appendLedger(delta, reason) {
    try {
      var arr = JSON.parse(localStorage.getItem('k-keiko-ledger') || '[]');
      arr.push({ ts: Date.now(), delta: delta, reason: reason || '' });
      if (arr.length > LEDGER_CAP) arr = arr.slice(-LEDGER_CAP);
      localStorage.setItem('k-keiko-ledger', JSON.stringify(arr));
    } catch (e) { /* ledger is cosmetic */ }
  }

  window.JPShared.keiko = {

    /** Current spendable balance (earned - spent, clamped >= 0). */
    getBalance: function () {
      return Math.max(0, getInt('k-keiko-earned') - getInt('k-keiko-spent'));
    },

    /** Award keiko. Returns the new balance. */
    earn: function (amount, reason) {
      amount = Math.max(0, Math.floor(amount || 0));
      if (amount > 0) {
        setInt('k-keiko-earned', getInt('k-keiko-earned') + amount);
        bumpWeek(amount);
        appendLedger(amount, reason);
      }
      return this.getBalance();
    },

    /**
     * This week's earnings {weekStart, earned}. Normalized at READ time — a
     * stale stored week reports 0 for the current week without writing (so
     * renders can't trigger sync pushes).
     */
    getWeekly: function () {
      var ws = weekStartOf(todayStr());
      var w = readWeek();
      return (w && w.ws === ws) ? { weekStart: ws, earned: +w.earned || 0 } : { weekStart: ws, earned: 0 };
    },

    /** Spend keiko. Returns false (and spends nothing) if insufficient. */
    spend: function (amount, reason) {
      amount = Math.max(0, Math.floor(amount || 0));
      if (amount === 0) return true;
      if (this.getBalance() < amount) return false;
      setInt('k-keiko-spent', getInt('k-keiko-spent') + amount);
      appendLedger(-amount, reason);
      return true;
    },

    /** Recent ledger entries, newest first. */
    getLedger: function () {
      try {
        return JSON.parse(localStorage.getItem('k-keiko-ledger') || '[]').slice().reverse();
      } catch (e) { return []; }
    },

    /**
     * Buy a streak freeze for FREEZE_PRICE keiko.
     * Checks the freeze cap BEFORE spending so a refusal never costs anything.
     * @returns {{ok: boolean, reason?: 'max'|'funds'}}
     */
    FREEZE_PRICE: 30,
    buyFreeze: function () {
      var streak = window.JPShared.streak;
      if (!streak || typeof streak.addFreeze !== 'function') return { ok: false, reason: 'max' };
      if (streak.getState().freezes >= 2) return { ok: false, reason: 'max' };
      if (this.getBalance() < this.FREEZE_PRICE) return { ok: false, reason: 'funds' };
      if (!streak.addFreeze()) return { ok: false, reason: 'max' };
      this.spend(this.FREEZE_PRICE, 'freeze');
      return { ok: true };
    }
  };

})();

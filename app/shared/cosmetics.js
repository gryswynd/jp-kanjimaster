/**
 * app/shared/cosmetics.js
 * Keiko sinks: seal inks (color themes for seal CHROME — never tints character
 * art), purchasable face stamps (Settings stamp picker), and cast bio unlocks.
 *
 * localStorage:
 *   k-seal-ink       — ink id ('vermilion' default)
 *   k-seal-ink-ts    — ms of last selection (sync: later wins)
 *   k-inks-owned     — { inkId: true }   (vermilion implicitly owned)
 *   k-stamps-owned   — { char_id: true } (char_rikizo implicitly owned;
 *                       seeded by the grandfather migration in stamp-settings.js)
 *   k-cast-unlocked  — { char_id: true } (char_rikizo implicitly unlocked)
 *
 * The active ink is exposed as the CSS custom property --seal-ink on <html>;
 * consumers use per-site fallbacks, e.g. var(--seal-ink, var(--vermilion)).
 *
 * Load after keiko.js.
 */

(function () {
  'use strict';

  window.JPShared = window.JPShared || {};
  if (window.JPShared.cosmetics) return;

  var INKS = [
    { id: 'vermilion', label: '朱 · Vermilion', color: 'var(--vermilion)', price: 0 },
    { id: 'ink',       label: 'すみ · Sumi',    color: 'var(--ink)',       price: 25 },
    { id: 'moss',      label: 'こけ · Moss',    color: 'var(--moss)',      price: 25 },
    { id: 'indigo',    label: 'あい · Indigo',  color: 'var(--indigo)',    price: 25 },
    { id: 'gold',      label: 'きん · Gold',    color: 'var(--gold)',      price: 25 }
  ];
  var STAMP_PRICE = 20;
  var BIO_PRICE = 15;

  function readMap(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; }
    catch (e) { return {}; }
  }

  function writeMap(key, map) {
    try { localStorage.setItem(key, JSON.stringify(map)); } catch (e) {}
  }

  function inkById(id) {
    for (var i = 0; i < INKS.length; i++) if (INKS[i].id === id) return INKS[i];
    return INKS[0];
  }

  var api = {

    INKS: INKS,
    STAMP_PRICE: STAMP_PRICE,
    BIO_PRICE: BIO_PRICE,

    // ── Seal inks ───────────────────────────────────────────────────────────

    ownsInk: function (id) {
      if (id === 'vermilion') return true;
      return !!readMap('k-inks-owned')[id];
    },

    /**
     * Active ink id with a render-guard: a selection that isn't owned on THIS
     * device (sync race — selection merged before ownership) falls back to
     * vermilion WITHOUT rewriting the stored choice, so it revives once the
     * ownership map merges in.
     */
    getInk: function () {
      var id = 'vermilion';
      try { id = localStorage.getItem('k-seal-ink') || 'vermilion'; } catch (e) {}
      return this.ownsInk(id) ? id : 'vermilion';
    },

    setInk: function (id) {
      if (!this.ownsInk(id)) return false;
      try {
        localStorage.setItem('k-seal-ink', id);
        localStorage.setItem('k-seal-ink-ts', String(Date.now()));
      } catch (e) {}
      this.applyInk();
      return true;
    },

    buyInk: function (id) {
      var ink = inkById(id);
      if (this.ownsInk(id)) { this.setInk(id); return { ok: true }; }
      var keiko = window.JPShared.keiko;
      if (!keiko || !keiko.spend(ink.price, 'ink:' + id)) return { ok: false, reason: 'funds' };
      var owned = readMap('k-inks-owned');
      owned[id] = true;
      writeMap('k-inks-owned', owned);
      this.setInk(id);
      return { ok: true };
    },

    /** Push the active ink color onto <html> as --seal-ink. */
    applyInk: function () {
      try {
        document.documentElement.style.setProperty('--seal-ink', inkById(this.getInk()).color);
      } catch (e) {}
    },

    // ── Face stamps (Settings picker) ───────────────────────────────────────

    ownsStamp: function (charId) {
      if (charId === 'char_rikizo') return true;
      return !!readMap('k-stamps-owned')[charId];
    },

    buyStamp: function (charId) {
      if (this.ownsStamp(charId)) return { ok: true };
      var keiko = window.JPShared.keiko;
      if (!keiko || !keiko.spend(STAMP_PRICE, 'stamp:' + charId)) return { ok: false, reason: 'funds' };
      var owned = readMap('k-stamps-owned');
      owned[charId] = true;
      writeMap('k-stamps-owned', owned);
      return { ok: true };
    },

    // ── Cast bio unlocks ────────────────────────────────────────────────────

    isCastUnlocked: function (charId) {
      if (charId === 'char_rikizo') return true;
      return !!readMap('k-cast-unlocked')[charId];
    },

    unlockCast: function (charId) {
      if (this.isCastUnlocked(charId)) return { ok: true };
      var keiko = window.JPShared.keiko;
      if (!keiko || !keiko.spend(BIO_PRICE, 'bio:' + charId)) return { ok: false, reason: 'funds' };
      var un = readMap('k-cast-unlocked');
      un[charId] = true;
      writeMap('k-cast-unlocked', un);
      return { ok: true };
    }
  };

  window.JPShared.cosmetics = api;

  // Active ink onto the page now, and again whenever a cloud merge may have
  // changed selection/ownership.
  api.applyInk();
  try {
    window.addEventListener('jp-progress-synced', function () { api.applyInk(); });
  } catch (e) {}

})();

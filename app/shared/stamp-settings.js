/**
 * app/shared/stamp-settings.js
 * Character stamp picker — lets users choose which character headshot
 * is used as their stamp in Scramble, Link Up, and Bingo.
 *
 * Depends on: asset-loader.js (window.getAssetUrl)
 * Load this file after asset-loader.js and before tts-settings.js.
 */

(function () {
  'use strict';

  window.JPShared = window.JPShared || {};

  var STORAGE_KEY = 'k-stamp-character';
  var OWNED_KEY = 'k-stamps-owned';
  var DEFAULT_CHARACTER = 'char_rikizo';
  var POO_PATH = 'assets/ui/poo_stamp.png';
  var charactersCache = null;
  var _repoConfig = null;

  // Grandfather migration: face stamps became keiko purchases in Phase 3, but
  // whatever a user had already selected stays theirs (plus Rikizo, always
  // free). Runs once — the absence of the owned map is the trigger. Lives
  // HERE (not cosmetics.js) because this file is in every lazy sharedModules
  // list, so the guard below can never observe an unseeded map.
  function ownedMap() {
    try { return JSON.parse(localStorage.getItem(OWNED_KEY) || 'null'); }
    catch (e) { return null; }
  }

  (function grandfather() {
    try {
      if (ownedMap()) return;
      var seed = {};
      seed[DEFAULT_CHARACTER] = true;
      var current = localStorage.getItem(STORAGE_KEY);
      if (current) seed[current] = true;
      localStorage.setItem(OWNED_KEY, JSON.stringify(seed));
    } catch (e) {}
  })();

  function isOwned(id) {
    if (id === DEFAULT_CHARACTER) return true;
    var m = ownedMap();
    return !!(m && m[id]);
  }

  function getSelected() {
    try {
      var id = localStorage.getItem(STORAGE_KEY) || DEFAULT_CHARACTER;
      // Selection can outrun ownership (cloud merge order) — render the
      // default rather than an unowned stamp; never rewrite the choice.
      return isOwned(id) ? id : DEFAULT_CHARACTER;
    }
    catch(e) { return DEFAULT_CHARACTER; }
  }

  function setSelected(id) {
    if (!isOwned(id)) return;
    try { localStorage.setItem(STORAGE_KEY, id); } catch(e) {}
  }

  function getPortrait(charId, characters) {
    if (!characters) return '';
    var c = characters.find(function (ch) { return ch.id === charId; });
    return c ? c.portrait : '';
  }

  function resolve(relativePath) {
    if (_repoConfig && window.getAssetUrl) {
      return window.getAssetUrl(_repoConfig, relativePath);
    }
    return relativePath;
  }

  /**
   * Resolve the user's chosen stamp URL.
   * @returns {string} URL to the stamp image
   */
  function getStampUrl() {
    var id = getSelected();
    if (!charactersCache) {
      return resolve('assets/characters/rikizo/rikizo_head.png');
    }
    var portrait = getPortrait(id, charactersCache);
    if (!portrait) portrait = 'assets/characters/rikizo/rikizo_head.png';
    return resolve(portrait);
  }

  /**
   * Get the poo stamp URL.
   * @returns {string}
   */
  function getPooUrl() {
    return resolve(POO_PATH);
  }

  /**
   * Store the repo config so we can resolve asset URLs.
   * Call this from any module's start() that has sharedConfig.
   */
  function setConfig(config) {
    _repoConfig = config;
  }

  /**
   * Load characters.json (cached after first load).
   * @returns {Promise<Array>}
   */
  async function loadCharacters() {
    if (charactersCache) return charactersCache;
    try {
      var url = resolve('shared/characters.json') + '?t=' + Date.now();
      var res = await fetch(url);
      var data = await res.json();
      charactersCache = data.characters || data;
      return charactersCache;
    } catch(e) {
      charactersCache = [];
      return [];
    }
  }

  // --- Public API ---
  window.JPShared.stampSettings = {
    getSelected: getSelected,
    setSelected: setSelected,
    isOwned: isOwned,
    getStampUrl: getStampUrl,
    getPooUrl: getPooUrl,
    setConfig: setConfig,
    loadCharacters: loadCharacters,
    getCharactersCache: function () { return charactersCache; },
    resolveUrl: resolve,
    DEFAULT_CHARACTER: DEFAULT_CHARACTER
  };

})();

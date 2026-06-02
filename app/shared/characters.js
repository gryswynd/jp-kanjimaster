/**
 * app/shared/characters.js
 * Shared speaker → character resolver for conversation rendering.
 *
 * Conversations everywhere (lessons, grammar, reviews, final review) render as
 * a text-message thread: each line shows the speaker's headshot + display name.
 * A line carries only a `spk` label ("A", "けん", "先生", …); this module turns
 * that label into a concrete character so every renderer behaves identically.
 *
 * Resolution precedence for resolve(spk, speakersMap, termMap, getUrl):
 *   1. explicit per-conversation map  — speakersMap[spk] ("char_ken" or "ken")
 *   2. name match against characters  — spk vs surface / reading / matches[]
 *   3. unresolved                     — caller renders a colored initial circle
 *
 * Character entries are read straight from the renderer's existing `termMap`
 * (every renderer already loads shared/characters.json into it with a
 * precomputed `portraitUrl`), so this module fetches nothing of its own.
 *
 * Returned descriptor:
 *   { id, name, portraitUrl, initial, known }
 *   - id          normalized character id without the "char_" prefix ('' if none)
 *   - name        display name (character `meaning`, e.g. "Yamamoto-sensei")
 *   - portraitUrl resolved headshot URL, or null when the character has no art
 *                 yet (→ initial circle); also null for unresolved speakers
 *   - initial     first character of the name/label, for the fallback circle
 *   - known       true when the speaker resolved to a real character entry
 */

(function () {
  'use strict';

  window.JPShared = window.JPShared || {};

  // termMap object → built name-index. WeakMap so each renderer's map is
  // indexed once and garbage-collected with it.
  var idxCache = new WeakMap();

  function norm(id) {
    return String(id == null ? '' : id).replace(/^char_/, '');
  }

  function buildIndex(termMap) {
    var byMatch = {}; // match string → normalized id
    var chars = {};   // normalized id → character entry
    for (var key in termMap) {
      var e = termMap[key];
      if (!e || e.type !== 'character') continue;
      var nid = norm(e.id || key);
      chars[nid] = e;
      var keys = [e.surface, e.reading].concat(e.matches || []);
      for (var i = 0; i < keys.length; i++) {
        var m = keys[i];
        // First entry wins, so an exact surface isn't overridden by a later
        // character's looser match.
        if (m && byMatch[m] == null) byMatch[m] = nid;
      }
    }
    return { byMatch: byMatch, chars: chars };
  }

  function getIndex(termMap) {
    if (!termMap) return { byMatch: {}, chars: {} };
    var hit = idxCache.get(termMap);
    if (!hit) { hit = buildIndex(termMap); idxCache.set(termMap, hit); }
    return hit;
  }

  function displayName(entry, nid) {
    if (entry && entry.meaning) return entry.meaning;
    if (!nid) return '';
    return nid.charAt(0).toUpperCase() + nid.slice(1);
  }

  function resolve(spk, speakersMap, termMap, getUrl) {
    spk = String(spk == null ? '' : spk);
    var ix = getIndex(termMap);

    var nid = '';
    if (speakersMap && speakersMap[spk] != null && speakersMap[spk] !== '') {
      nid = norm(speakersMap[spk]);
    }
    if (!nid && ix.byMatch[spk]) nid = ix.byMatch[spk];

    var entry = nid ? ix.chars[nid] : null;
    var name = entry ? displayName(entry, nid) : spk;

    var portraitUrl = null;
    if (entry) {
      // Trust the raw `portrait` field as the gate: an empty string means the
      // character intentionally has no art yet → initial circle. (portraitUrl
      // is precomputed but resolves a non-empty base URL even for "", so it
      // can't be used as the truthiness test.)
      if (entry.portrait) {
        portraitUrl = entry.portraitUrl || (getUrl ? getUrl(entry.portrait) : entry.portrait);
      }
    } else if (nid) {
      // Mapped to an id with no entry in this termMap (unexpected) — fall back
      // to the conventional headshot path.
      var rel = 'assets/characters/' + nid + '/' + nid + '_head.png';
      portraitUrl = getUrl ? getUrl(rel) : rel;
    }

    var initial = (name || spk || '?').trim().slice(0, 1) || '?';
    return { id: nid, name: name, portraitUrl: portraitUrl, initial: initial, known: !!entry };
  }

  // Pick which speaker label sits on the right ("you") side of the thread:
  // Rikizo whenever he speaks, else the first line's speaker.
  function rightSpeaker(lines, speakersMap, termMap) {
    var list = lines || [];
    for (var i = 0; i < list.length; i++) {
      var spk = String((list[i] && list[i].spk) || '');
      if (resolve(spk, speakersMap, termMap).id === 'rikizo') return spk;
    }
    return (list[0] && String(list[0].spk || '')) || 'A';
  }

  window.JPShared.characters = {
    resolve: resolve,
    rightSpeaker: rightSpeaker,
    _buildIndex: buildIndex
  };

})();

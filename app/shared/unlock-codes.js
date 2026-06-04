/**
 * app/shared/unlock-codes.js
 * Settings → "Unlock code" system. A code seeds unlock/completion state so a
 * student lands at a chosen point in the curriculum. Extensible: add entries to
 * CODES as you need them.
 *
 * How a code seeds (generic, manifest-driven — no hardcoded ID lists):
 *   unlockThrough: "<id>"  → mark that item AND everything ORDERED BEFORE it
 *   (in each category's manifest order) as completed at PASS_THRESHOLD. Crossing
 *   into N4 also sets the k-n4-unlocked gateway flag.
 *
 * Coexistence with the progress importer (the critical requirement):
 *   • Seeding only ever RAISES state — it uses unlock._markCompleted /
 *     _saveLessonScore semantics (set-true / max-score), never lowers. So a code
 *     applied before OR after an import yields the UNION of both.
 *   • Applied codes are remembered in k-unlock-codes and RE-APPLIED after any
 *     import (see tts-settings import flow), so the unlock floor always survives.
 *
 * reviewsBackfill: when true, the reviews up to the boundary are auto-marked
 * complete (the student already covered that material); reviews AFTER the
 * boundary remain normally gated.
 *
 * Registers window.JPShared.unlockCodes.
 */
(function () {
  'use strict';
  window.JPShared = window.JPShared || {};
  if (window.JPShared.unlockCodes) return;

  var APPLIED_KEY = 'k-unlock-codes';
  var PASS = 60; // mirror unlock.PASS_THRESHOLD

  // ── Code registry ──────────────────────────────────────────────────────────
  // Keys are matched case-insensitively. Add codes here as needed.
  var CODES = {
    rikizo69: {
      label: 'Founding student',
      // Seed complete through N4.19 → resumes at N4.20 / next grammar / next story.
      unlockThrough: 'N4.19',
      reviewsBackfill: true,   // auto-pass past reviews; later reviews stay gated
      blurb: 'Unlocked through N4.19 — you’re set up at your current level.'
    }
  };

  // ── Applied-codes persistence ────────────────────────────────────────────────
  function _appliedList() {
    try { return JSON.parse(localStorage.getItem(APPLIED_KEY) || '[]') || []; }
    catch (e) { return []; }
  }
  function _remember(code) {
    var list = _appliedList();
    if (list.indexOf(code) < 0) {
      list.push(code);
      try { localStorage.setItem(APPLIED_KEY, JSON.stringify(list)); } catch (e) {}
    }
  }

  // ── Manifest access ──────────────────────────────────────────────────────────
  function _manifest() {
    // Prefer the already-loaded manifest; fall back to a sync fetch so the code
    // works even if applied very early (or re-applied right after an import).
    if (window.JPApp && window.JPApp._manifest) return window.JPApp._manifest;
    try {
      var x = new XMLHttpRequest();
      x.open('GET', (window.JPApp && window.JPApp._assetUrl ? window.JPApp._assetUrl('manifest.json') : 'manifest.json') + '?t=' + Date.now(), false);
      x.send(null);
      return JSON.parse(x.responseText);
    } catch (e) { return null; }
  }

  // Level order for "through" comparisons (N5 before N4).
  var LEVEL_ORDER = ['N5', 'N4'];

  // Build the flat ordered list of every gateable item across levels, tagged with
  // category, in curriculum order. Used to compute "everything up to <id>".
  function _orderedItems(m) {
    var out = [];
    if (!m || !m.data) return out;
    LEVEL_ORDER.forEach(function (lvl) {
      var d = m.data[lvl];
      if (!d) return;
      ['lessons', 'grammar', 'reviews', 'stories'].forEach(function (kind) {
        (d[kind] || []).forEach(function (it) {
          if (it && it.id) out.push({ id: it.id, kind: kind, level: lvl });
        });
      });
    });
    return out;
  }

  // Find the level of the boundary id, so we know how far to seed.
  function _levelOf(m, id) {
    var items = _orderedItems(m);
    for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i].level;
    // Infer from id shape if not found in manifest.
    return /^N4\./.test(id) || /^G(1[3-9]|[2-9]\d)/.test(id) ? 'N4' : 'N5';
  }

  // Find a manifest item by id across all levels/categories. Returns the raw
  // entry (with its unlocksAfter), or null. Cached per manifest for speed.
  var _entryCache = null;
  function _findEntry(m, id) {
    if (!_entryCache) {
      _entryCache = {};
      if (m && m.data) {
        Object.keys(m.data).forEach(function (lvl) {
          var d = m.data[lvl];
          ['lessons', 'grammar', 'reviews', 'stories'].forEach(function (kind) {
            (d[kind] || []).forEach(function (it) { if (it && it.id) _entryCache[it.id] = it; });
          });
        });
      }
    }
    return _entryCache[id] || null;
  }

  // ── Core: compute + apply the seed set for a code ────────────────────────────
  // Returns { lessons, grammar, reviews, stories, n4 } counts seeded.
  function _applyCode(def) {
    var m = _manifest();
    var unlock = window.JPShared.unlock;
    if (!m || !unlock) return null;

    var through = def.unlockThrough;
    var throughLevel = _levelOf(m, through);
    var counts = { lessons: 0, grammar: 0, reviews: 0, stories: 0, n4: false };

    // Pull a lesson's numeric index (N4.18 → 18) for in-level ordering.
    function lessonNum(id) {
      var mt = /^N[45]\.(\d+)$/.exec(id || '');
      return mt ? parseInt(mt[1], 10) : null;
    }
    var throughNum = lessonNum(through); // null if boundary isn't a plain lesson id

    // A LESSON is in-boundary if it's in an earlier level, or same level with a
    // number ≤ the boundary's. (Reviews/stories/grammar are gated by deps below.)
    function lessonInBoundary(lvl, id) {
      if (LEVEL_ORDER.indexOf(lvl) < LEVEL_ORDER.indexOf(throughLevel)) return true;
      if (lvl !== throughLevel) return false;
      var n = lessonNum(id);
      if (n == null || throughNum == null) return false;
      return n <= throughNum;
    }

    // Build the set of in-boundary lesson ids first (the spine).
    var lessonSet = {};
    LEVEL_ORDER.forEach(function (lvl) {
      var d = m.data[lvl]; if (!d) return;
      (d.lessons || []).forEach(function (it) {
        if (it && it.id && lessonInBoundary(lvl, it.id)) lessonSet[it.id] = true;
      });
    });

    // An item (review/story/grammar) is in-boundary iff its prerequisite is:
    //   • no prereq → it's a starting item → in
    //   • prereq is an in-boundary lesson → in
    //   • prereq is an in-boundary grammar/review (resolved transitively) → in
    // Memoized to handle grammar→grammar chains.
    // Is an id a plain lesson (N5.3 / N4.18)? Lessons are NEVER "available from
    // start" — they're gated by number + the N4 flag — so a lesson counts as
    // in-boundary ONLY if it's in lessonSet, never via the no-prereq rule.
    function isLessonId(id) { return /^N[45]\.\d+$/.test(id || ''); }

    var memo = {};
    function idInBoundary(id) {
      if (id == null) return false;
      if (lessonSet[id]) return true;
      if (isLessonId(id)) return false;               // a lesson not in the spine is out
      if (id in memo) return memo[id];
      memo[id] = false; // guard against cycles
      var entry = _findEntry(m, id);
      if (!entry) return (memo[id] = false);
      var prereq = entry.unlocksAfter;
      if (!prereq) return (memo[id] = true);          // non-lesson with no gate → from start
      if (lessonSet[prereq]) return (memo[id] = true);
      if (isLessonId(prereq)) return (memo[id] = false); // gated by a lesson out of boundary
      return (memo[id] = idInBoundary(prereq));        // transitive (grammar/review chains)
    }

    LEVEL_ORDER.forEach(function (lvl) {
      var d = m.data[lvl]; if (!d) return;
      // Lessons: seed the in-boundary spine.
      (d.lessons || []).forEach(function (it) {
        if (it && it.id && lessonSet[it.id]) { unlock._seedComplete(it.id, PASS); counts.lessons += 1; }
      });
      // Grammar: seed if its dependency chain is in-boundary.
      (d.grammar || []).forEach(function (it) {
        if (it && it.id && idInBoundary(it.id)) { unlock._seedComplete(it.id, PASS); counts.grammar += 1; }
      });
      // Stories: seed if their unlocking lesson is in-boundary.
      (d.stories || []).forEach(function (it) {
        if (it && it.id && idInBoundary(it.id)) { unlock._seedComplete(it.id, PASS); counts.stories += 1; }
      });
      // Reviews: only if backfill is on AND their gate is in-boundary.
      if (def.reviewsBackfill) {
        (d.reviews || []).forEach(function (it) {
          if (it && it.id && idInBoundary(it.id)) { unlock._seedComplete(it.id, PASS); counts.reviews += 1; }
        });
      }
    });

    // Crossing into N4 requires the gateway flag.
    if (throughLevel === 'N4' && unlock.unlockN4) {
      unlock.unlockN4();
      counts.n4 = true;
    }
    return counts;
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  // Apply a typed code. Returns { ok, def, counts, reason }.
  function apply(rawCode) {
    var code = String(rawCode || '').trim().toLowerCase();
    if (!code) return { ok: false, reason: 'empty' };
    var def = CODES[code];
    if (!def) return { ok: false, reason: 'unknown' };

    var counts = _applyCode(def);
    if (!counts) return { ok: false, reason: 'no_manifest' };

    _remember(code);
    // Refresh home so the new unlocks show immediately.
    try {
      if (window.JPApp && window.JPApp._view === 'home' && window.JPApp.renderMenu) {
        window.JPApp.renderMenu();
      }
    } catch (e) {}
    // Push to cloud if signed in.
    try { if (window.JPShared.sync && window.JPShared.sync.push) window.JPShared.sync.push(); } catch (e) {}

    return { ok: true, def: def, counts: counts };
  }

  // Re-apply every previously-entered code. Call after an import so a destructive
  // or merging import can't drop the unlock floor.
  function reapplyAll() {
    var list = _appliedList();
    list.forEach(function (code) {
      var def = CODES[code];
      if (def) _applyCode(def);
    });
    return list.length;
  }

  function appliedCodes() { return _appliedList(); }
  function isKnown(rawCode) { return !!CODES[String(rawCode || '').trim().toLowerCase()]; }

  window.JPShared.unlockCodes = {
    apply: apply,
    reapplyAll: reapplyAll,
    appliedCodes: appliedCodes,
    isKnown: isKnown,
    _CODES: CODES,   // exposed for tests
  };
})();

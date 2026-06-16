/**
 * app/shared/session-progress.js
 * In-session resume + per-answer persistence so backing out of a lesson,
 * grammar set, or review and returning never loses earned credit.
 *
 * Background: drill answers used to live in memory only — leaving a lesson
 * mid-way and re-entering wiped the answers for already-completed drills
 * (the N4.22 incident). This stores, per domain + id, the resume step and the
 * per-item correct/incorrect map so the module can replay them on load.
 *
 * Key schema (one map per domain):
 *   k-session-lesson   — { [lessonId]:  { step, results, ts } }
 *   k-session-grammar  — { [grammarId]: { step, results, ts } }
 *   k-session-review   — { [reviewId]:  { step, score, ts } }
 *
 * where `results` is { [itemKey]: boolean }  (true = answered correctly).
 * `score` is used by reviews (a running points total) instead of `results`.
 *
 * Writes are MERGE-on-update (read-modify-write a single id's record) so a
 * save never clobbers other fields. All access is try/catch wrapped so private
 * mode / disabled storage degrades gracefully (mirrors Lesson._saveResume).
 *
 * Load this file before the feature module scripts (after progress.js).
 */

(function () {
  'use strict';

  window.JPShared = window.JPShared || {};

  function keyFor(domain) { return 'k-session-' + domain; }

  function readMap(domain) {
    try { return JSON.parse(localStorage.getItem(keyFor(domain)) || '{}'); }
    catch (e) { return {}; }
  }

  function writeMap(domain, map) {
    try { localStorage.setItem(keyFor(domain), JSON.stringify(map)); }
    catch (e) {}
  }

  function now() {
    try { return Date.now(); } catch (e) { return 0; }
  }

  window.JPShared.sessionProgress = {

    /**
     * Return the saved record for an id, or null if none.
     * Shape: { step:number, results?:Object, score?:number, ts:number }
     */
    get: function (domain, id) {
      if (!domain || !id) return null;
      var rec = readMap(domain)[id];
      return rec || null;
    },

    /**
     * Persist the resume step (the question/section index the learner is on).
     */
    saveStep: function (domain, id, step) {
      if (!domain || !id) return;
      var map = readMap(domain);
      var rec = map[id] || {};
      rec.step = step;
      rec.ts = now();
      map[id] = rec;
      writeMap(domain, map);
    },

    /**
     * Record one drill item's outcome (merges into the results map).
     */
    saveResult: function (domain, id, itemKey, correct) {
      if (!domain || !id || !itemKey) return;
      var map = readMap(domain);
      var rec = map[id] || {};
      rec.results = rec.results || {};
      rec.results[itemKey] = !!correct;
      rec.ts = now();
      map[id] = rec;
      writeMap(domain, map);
    },

    /**
     * Persist a running score (used by reviews, which track points not per-item).
     */
    saveScore: function (domain, id, score) {
      if (!domain || !id) return;
      var map = readMap(domain);
      var rec = map[id] || {};
      rec.score = score;
      rec.ts = now();
      map[id] = rec;
      writeMap(domain, map);
    },

    /**
     * Merge an arbitrary set of fields into an id's record. Used by modules
     * (e.g. grammar) that snapshot a richer runtime state than a single
     * step/result — pass a plain object of fields to persist.
     */
    save: function (domain, id, patch) {
      if (!domain || !id || !patch) return;
      var map = readMap(domain);
      var rec = map[id] || {};
      for (var k in patch) {
        if (Object.prototype.hasOwnProperty.call(patch, k)) rec[k] = patch[k];
      }
      rec.ts = now();
      map[id] = rec;
      writeMap(domain, map);
    },

    /**
     * Drop the saved record for an id (call on completion so a fresh re-attempt
     * starts clean).
     */
    clear: function (domain, id) {
      if (!domain || !id) return;
      var map = readMap(domain);
      if (map[id] == null) return;
      delete map[id];
      writeMap(domain, map);
    }

  };

})();

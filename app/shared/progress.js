/**
 * app/shared/progress.js
 * Shared progress persistence: flags, streaks, best scores, and draft storage
 * via localStorage, with a consistent key schema.
 *
 * Replaces duplicated localStorage operations in:
 *   - Practice.js — flag counts, active flags, streak & best-score tracking
 *                   (localStorage keys: k-flags, k-active-flags, k-best-*)
 *   - Lesson.js   — flag get/set for individual terms (k-flags, k-active-flags)
 *   - Compose.js  — draft saving per prompt (compose-draft-<id>)
 *   - Review.js   — flag get/set + review scores (k-flags, k-active-flags, k-review-scores)
 *   - Story.js    — flag get/set for individual terms (k-flags, k-active-flags)
 *   - term-modal.js — default count-based flagging (k-flags, k-active-flags)
 *
 * All methods use the EXACT same localStorage keys as before so existing
 * user data is preserved with zero migration:
 *   k-flags              — { [key]: number }   flag counts (key = surface form)
 *   k-active-flags       — { [key]: boolean }  currently-active flags
 *   k-best-<category>    — number string       best streak per quiz category
 *   k-review-scores      — { [reviewId]: number } best review percentage
 *   compose-draft-<id>   — string              in-progress compose draft
 *
 * Load this file before any feature module scripts (after text-processor.js).
 */

(function () {
  'use strict';

  window.JPShared = window.JPShared || {};

  window.JPShared.progress = {

    // -------------------------------------------------------------------------
    // Flagging — k-flags and k-active-flags
    //
    // k-flags stores flag counts keyed by surface form (or term ID for Story.js).
    // k-active-flags tracks which keys are currently in the practice queue.
    // -------------------------------------------------------------------------

    /**
     * Return the full flags map { key → count }.
     * @returns {Object}
     */
    getAllFlags: function () {
      return JSON.parse(localStorage.getItem('k-flags') || '{}');
    },

    /**
     * Return the active-flags map { key → boolean }.
     * On first call when k-active-flags has never been set, runs a one-time
     * migration: initialises from k-flags (preserving existing Practice.js
     * migration logic that previously lived inline at module startup).
     * @returns {Object}
     */
    getAllActiveFlags: function () {
      var raw = localStorage.getItem('k-active-flags');
      if (raw !== null) return JSON.parse(raw);

      // First-time migration: build active flags from any positive flag counts
      var flags = this.getAllFlags();
      var active = {};
      Object.keys(flags).forEach(function (k) {
        if (flags[k]) active[k] = true;
      });
      localStorage.setItem('k-active-flags', JSON.stringify(active));
      return active;
    },

    /**
     * Get the flag count for a single key.
     * Returns a truthy value (number or boolean) if ever flagged, 0 if not.
     * @param {string} key
     * @returns {number|boolean}
     */
    getFlagCount: function (key) {
      return this.getAllFlags()[key] || 0;
    },

    /**
     * Check whether a key is currently in the active-flags set.
     * @param {string} key
     * @returns {boolean}
     */
    isActive: function (key) {
      return !!this.getAllActiveFlags()[key];
    },

    /**
     * Increment the flag count for a key and mark it active.
     * This is the standard flag operation used by Lesson.js, Review.js, and
     * Practice.js (which also passes the surface form as key).
     * @param {string} key — surface form or term ID
     */
    flagTerm: function (key) {
      var flags = this.getAllFlags();
      flags[key] = (flags[key] || 0) + 1;
      localStorage.setItem('k-flags', JSON.stringify(flags));

      var active = this.getAllActiveFlags();
      active[key] = true;
      localStorage.setItem('k-active-flags', JSON.stringify(active));
    },

    /**
     * Remove a key from the active-flags set (does not touch k-flags counts).
     * Used by Practice.js clearFlag — removes from the practice queue without
     * erasing the flag history.
     * @param {string} key
     */
    clearFlag: function (key) {
      var active = this.getAllActiveFlags();
      delete active[key];
      localStorage.setItem('k-active-flags', JSON.stringify(active));
    },

    // -------------------------------------------------------------------------
    // Best scores — k-best-<category>
    //
    // Category values: 'meaning' | 'reading' | 'vocab' | 'verb'
    // -------------------------------------------------------------------------

    /**
     * Get the stored best streak score for a quiz category.
     * @param {string} category
     * @returns {number}
     */
    getBestScore: function (category) {
      return parseInt(localStorage.getItem('k-best-' + category) || '0');
    },

    /**
     * Persist a new best score for a category (caller is responsible for
     * checking that score > current best before calling).
     * @param {string} category
     * @param {number} score
     */
    setBestScore: function (category, score) {
      localStorage.setItem('k-best-' + category, score);
    },

    // -------------------------------------------------------------------------
    // Review scores — k-review-scores
    // -------------------------------------------------------------------------

    /**
     * Get the stored best score for a review.
     * @param {string} reviewId
     * @returns {number|undefined} percentage (0–100), or undefined if not attempted
     */
    getReviewScore: function (reviewId) {
      var scores = JSON.parse(localStorage.getItem('k-review-scores') || '{}');
      return scores[reviewId];
    },

    /**
     * Persist a review score (caller is responsible for checking isNewBest
     * before calling if conditional saving is desired).
     * @param {string} reviewId
     * @param {number} pct — percentage score (0–100)
     */
    setReviewScore: function (reviewId, pct) {
      var scores = JSON.parse(localStorage.getItem('k-review-scores') || '{}');
      scores[reviewId] = pct;
      localStorage.setItem('k-review-scores', JSON.stringify(scores));
    },

    // -------------------------------------------------------------------------
    // Compose drafts — compose-draft-<promptId>
    // -------------------------------------------------------------------------

    /**
     * Get a saved compose draft for a prompt.
     * @param {string} promptId
     * @returns {string} draft text, or empty string if none saved
     */
    getDraft: function (promptId) {
      return localStorage.getItem('compose-draft-' + promptId) || '';
    },

    /**
     * Save a compose draft.
     * @param {string} promptId
     * @param {string} text
     */
    saveDraft: function (promptId, text) {
      localStorage.setItem('compose-draft-' + promptId, text);
    },

    /**
     * Clear a compose draft on successful submission.
     * @param {string} promptId
     */
    clearDraft: function (promptId) {
      localStorage.removeItem('compose-draft-' + promptId);
    }

  };

})();

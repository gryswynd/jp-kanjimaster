/**
 * app/shared/unlock.js
 * Content gating / progressive unlock engine.
 *
 * Two serving modes (set once per Webflow page via window.RIKIZO_CONFIG):
 *   { mode: 'free'  } — all content visible (existing students / unlocked page)
 *   { mode: 'gated' } — progressive unlock (new students / gated page)
 *
 * New localStorage keys (non-conflicting with existing progress.js keys):
 *   k-lesson-scores     { [lessonId]: number }   best percentage (0-100) per lesson / review
 *   k-lesson-completed  { [lessonId]: boolean }   any-completion flag (score irrelevant)
 *
 * Module visibility rules (gated mode):
 *   lesson   → always visible
 *   grammar  → any completion of N5.1
 *   practice → any completion of N5.1
 *   compose  → ≥75% on N5.1
 *   story    → ≥75% on N5.2
 *   review   → ≥75% on N5.2
 *   game     → ≥75% on N5.1
 *
 * Load this file as the 5th shared module (after progress.js, before text-processor.js).
 */

(function () {
  'use strict';

  window.JPShared = window.JPShared || {};

  // ── Internal constants ─────────────────────────────────────────────────────

  var PASS_THRESHOLD = 60; // minimum percentage to "pass" a lesson

  // localStorage key for the explicit N4 unlock (paid gateway placeholder).
  var N4_UNLOCK_KEY = 'k-n4-unlocked';

  var MODULE_META = {
    grammar:  { icon: '🌿', label: 'Grammar Garden' },
    practice: { icon: '🥋', label: 'Dojo' },
    compose:  { icon: '✏️',  label: 'Compose' },
    story:    { icon: '📖', label: 'Stories' },
    review:   { icon: '📝', label: 'Review' },
    game:     { icon: '🎮', label: "Rikizo's Adventures" }
  };

  // ── Private helpers ────────────────────────────────────────────────────────

  function _getScores() {
    return JSON.parse(localStorage.getItem('k-lesson-scores') || '{}');
  }

  function _getCompleted() {
    return JSON.parse(localStorage.getItem('k-lesson-completed') || '{}');
  }

  function _saveLessonScore(id, pct) {
    var scores = _getScores();
    if (pct > (scores[id] || 0)) {
      scores[id] = pct;
      localStorage.setItem('k-lesson-scores', JSON.stringify(scores));
    }
  }

  function _markCompleted(id) {
    var completed = _getCompleted();
    if (!completed[id]) {
      completed[id] = true;
      localStorage.setItem('k-lesson-completed', JSON.stringify(completed));
    }
  }

  // Returns true if the prerequisite ID has been passed (≥75%) or completed
  // (any score) depending on anyCompletion flag.
  // Grammar lesson IDs (G1, G2, …) always use any-completion semantics —
  // they have no pass/fail score, so completing them is sufficient.
  function _prereqMet(prereqId, anyCompletion) {
    if (!prereqId) return true; // no prerequisite → always available
    var isGrammarId = /^G\d+$/.test(prereqId);
    if (isGrammarId || anyCompletion) return !!_getCompleted()[prereqId];
    return (_getScores()[prereqId] || 0) >= PASS_THRESHOLD;
  }

  // Snapshot all currently-unlocked IDs across all content types.
  // Returns { modules: Set, lessons: Set, grammar: Set, reviews: Set,
  //           stories: Set, compose: Set, game: Set }
  function _snapshotUnlocks(manifest) {
    var api = window.JPShared.unlock;
    var snap = {
      modules: new Set(),
      lessons: new Set(),
      grammar: new Set(),
      reviews: new Set(),
      stories: new Set(),
      compose: new Set(),
      game:    new Set()
    };

    // modules
    ['grammar','practice','compose','story','review','game'].forEach(function (m) {
      if (api.isModuleVisible(m)) snap.modules.add(m);
    });

    var d = manifest && manifest.data;
    if (!d) return snap;

    // lessons (N5 + N4)
    ['N5','N4'].forEach(function (level) {
      var ld = d[level];
      if (!ld) return;
      (ld.lessons || []).forEach(function (entry) {
        if (api.isLessonUnlocked(entry)) snap.lessons.add(entry.id);
      });
      (ld.grammar || []).forEach(function (entry) {
        if (api.isGrammarUnlocked(entry)) snap.grammar.add(entry.id);
      });
      (ld.reviews || []).forEach(function (entry) {
        if (api.isReviewUnlocked(entry)) snap.reviews.add(entry.id);
      });
      (ld.stories || []).forEach(function (entry) {
        if (api.isStoryUnlocked(entry)) snap.stories.add(entry.id);
      });
      (ld.compose || []).forEach(function (entry) {
        if (api.isComposeUnlocked(entry)) snap.compose.add(entry.lesson || entry.id);
      });
      (ld.game || []).forEach(function (entry) {
        if (api.isGameDayUnlocked(entry)) snap.game.add(entry.id);
      });
    });

    return snap;
  }

  // Diff two snapshots → array of newly unlocked item descriptors in reveal order:
  // modules first, then lessons, grammar, reviews, stories, compose, game.
  function _diffSnapshots(before, after) {
    var items = [];

    // modules
    ['grammar','practice','compose','story','review','game'].forEach(function (m) {
      if (!before.modules.has(m) && after.modules.has(m)) {
        var meta = MODULE_META[m] || {};
        items.push({ type: 'module', id: m, icon: meta.icon || '🔓', label: meta.label || m });
      }
    });

    function addItems(type, beforeSet, afterSet, icon) {
      afterSet.forEach(function (id) {
        if (!beforeSet.has(id)) {
          items.push({ type: type, id: id, icon: icon, label: id });
        }
      });
    }

    addItems('lesson',  before.lessons, after.lessons, '📚');
    addItems('grammar', before.grammar, after.grammar, '🌿');
    addItems('review',  before.reviews, after.reviews, '📝');
    addItems('story',   before.stories, after.stories, '📖');
    addItems('compose', before.compose, after.compose, '✏️');
    addItems('game',    before.game,    after.game,    '🎮');

    return items;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  window.JPShared.unlock = {

    PASS_THRESHOLD: PASS_THRESHOLD,
    MODULE_META: MODULE_META,

    // ── N4 gateway ─────────────────────────────────────────────────────────

    /**
     * Returns true when the student has explicitly unlocked N4 content
     * (by tapping the unlock button on the N5 Final Review completion screen).
     * Free mode always returns true.
     * This is a placeholder for a future paid gateway.
     */
    isN4Unlocked: function () {
      if (this.isFree()) return true;
      return localStorage.getItem(N4_UNLOCK_KEY) === 'true';
    },

    /**
     * Grants access to all N4 content. Call this when the student taps
     * the "Unlock N4" button on the N5 Final Review completion screen.
     */
    unlockN4: function () {
      localStorage.setItem(N4_UNLOCK_KEY, 'true');
    },

    // ── Mode ───────────────────────────────────────────────────────────────

    /**
     * Returns true when the serving mode is 'free' (all content visible).
     * In free mode every isXxxUnlocked() call returns true.
     */
    isFree: function () {
      var cfg = window.RIKIZO_CONFIG;
      return cfg && cfg.mode === 'free';
    },

    // ── Score / completion accessors ───────────────────────────────────────

    getLessonScore: function (id) {
      return _getScores()[id] || 0;
    },

    isCompleted: function (id) {
      return !!_getCompleted()[id];
    },

    isPassed: function (id) {
      return (_getScores()[id] || 0) >= PASS_THRESHOLD;
    },

    // ── Module visibility ──────────────────────────────────────────────────

    /**
     * Returns true if the given module tab should be visible in the menu.
     * module: 'lesson' | 'grammar' | 'practice' | 'compose' | 'story' | 'review' | 'game'
     */
    isModuleVisible: function (module) {
      if (this.isFree()) return true;
      switch (module) {
        case 'lesson':   return true;                       // always visible
        case 'grammar':  return _prereqMet('N5.1', true);  // any completion
        case 'practice': return _prereqMet('N5.1', true);  // any completion
        case 'compose':  return _prereqMet('N5.1', false); // ≥75%
        case 'game':     return _prereqMet('N5.1', false); // ≥75%
        case 'story':    return _prereqMet('N5.2', false); // ≥75%
        case 'review':   return _prereqMet('N5.2', false); // ≥75%
        default:         return false;
      }
    },

    // ── Per-entry unlock checks ────────────────────────────────────────────

    /**
     * Lesson entry unlocks when its prereq has been *passed* (≥75%).
     * N5.1 has no unlocksAfter → always unlocked.
     * Any N4 lesson requires the explicit N4 unlock in addition.
     */
    isLessonUnlocked: function (entry) {
      if (this.isFree()) return true;
      if (entry.id && /^N4\./.test(entry.id)) return this.isN4Unlocked();
      return _prereqMet(entry.unlocksAfter, false);
    },

    /**
     * Grammar entries unlock when their prereq has been *completed* (any score).
     */
    isGrammarUnlocked: function (entry) {
      if (this.isFree()) return true;
      return _prereqMet(entry.unlocksAfter, true);
    },

    /**
     * Review entries unlock when their prereq has been *passed* (≥75%).
     * Any N4 review requires the explicit N4 unlock in addition.
     */
    isReviewUnlocked: function (entry) {
      if (this.isFree()) return true;
      if (entry.id && /^N4\./.test(entry.id)) return this.isN4Unlocked();
      return _prereqMet(entry.unlocksAfter, false);
    },

    /**
     * Story entries unlock when their prereq has been *passed* (≥75%).
     */
    isStoryUnlocked: function (entry) {
      if (this.isFree()) return true;
      return _prereqMet(entry.unlocksAfter, false);
    },

    /**
     * Compose entries unlock when their prereq has been *passed* (≥75%).
     */
    isComposeUnlocked: function (entry) {
      if (this.isFree()) return true;
      return _prereqMet(entry.unlocksAfter, false);
    },

    /**
     * Game day entries unlock when their prereq has been *passed* (≥75%).
     */
    isGameDayUnlocked: function (entry) {
      if (this.isFree()) return true;
      return _prereqMet(entry.unlocksAfter, false);
    },

    // ── Unlock computation ─────────────────────────────────────────────────

    /**
     * Called at lesson / review completion.
     * Snapshots current state, persists the new score, then diffs.
     *
     * @param {string} lessonId — e.g. "N5.1" or "N5.Review.1"
     * @param {number} pct      — score percentage 0-100
     * @param {Object} manifest — parsed manifest.json
     * @returns {{ passed: boolean, pct: number, newItems: Array }}
     */
    computeUnlocks: function (lessonId, pct, manifest) {
      var before = _snapshotUnlocks(manifest);

      _markCompleted(lessonId);
      _saveLessonScore(lessonId, pct);

      var after = _snapshotUnlocks(manifest);
      var newItems = _diffSnapshots(before, after);
      var passed = pct >= PASS_THRESHOLD;

      return { passed: passed, pct: pct, newItems: newItems };
    },

    /**
     * Read-only — what would unlock if the student scored ≥75%?
     * Used in the <75% encouragement screen to show the reward.
     * Does NOT modify localStorage.
     *
     * @param {string} lessonId
     * @param {Object} manifest
     * @returns {Array} array of item descriptors (same shape as newItems above)
     */
    getPendingUnlocks: function (lessonId, manifest) {
      // Take a current snapshot, then simulate a passing save without writing.
      var scores    = _getScores();
      var completed = _getCompleted();

      // Temporarily inject a passing score into the in-memory data.
      var origScore     = scores[lessonId];
      var origCompleted = completed[lessonId];

      scores[lessonId]    = PASS_THRESHOLD;
      completed[lessonId] = true;

      // Override localStorage read with patched data for the duration.
      var origGetScores    = _getScores;
      var origGetCompleted = _getCompleted;
      // We cannot easily patch the closed-over helpers, so instead we compute
      // the before snapshot first, then manually check what would change.

      // Strategy: compute current snapshot using real data, then compute a
      // "what if passed" snapshot using a lightweight override approach.
      var before = _snapshotUnlocks(manifest);

      // Temporarily write passing score so _snapshotUnlocks picks it up,
      // then restore afterwards.
      var realScores    = JSON.parse(localStorage.getItem('k-lesson-scores') || '{}');
      var realCompleted = JSON.parse(localStorage.getItem('k-lesson-completed') || '{}');

      var tempScores    = Object.assign({}, realScores);
      var tempCompleted = Object.assign({}, realCompleted);
      tempScores[lessonId]    = PASS_THRESHOLD;
      tempCompleted[lessonId] = true;

      localStorage.setItem('k-lesson-scores',    JSON.stringify(tempScores));
      localStorage.setItem('k-lesson-completed', JSON.stringify(tempCompleted));

      var after = _snapshotUnlocks(manifest);

      // Restore
      localStorage.setItem('k-lesson-scores',    JSON.stringify(realScores));
      localStorage.setItem('k-lesson-completed', JSON.stringify(realCompleted));

      return _diffSnapshots(before, after);
    }

  };

})();

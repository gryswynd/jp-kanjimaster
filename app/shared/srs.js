/**
 * app/shared/srs.js
 * Spaced-repetition scheduler — the "reviews due today" engine.
 *
 * Every vocab word and kanji from a COMPLETED lesson (and every completed
 * grammar point) gets a review schedule on a fixed interval ladder:
 *
 *   rung:      0    1    2    3     4     5
 *   interval:  1d   3d   7d   14d   30d   90d
 *
 * Correct answer while due  → climb one rung (due = today + interval[rung]).
 * Wrong answer anywhere     → drop one rung, due tomorrow.
 * Correct while NOT due     → no movement (anti-grind).
 * At most ONE ladder movement per item per day.
 *
 * Item identity:
 *   vocab/kanji — "<glossaryFileLevel>:<glossaryId>"  e.g. "N5:v_oi", "N4:k_hatara"
 *                 (surfaces are NOT unique — 何/なに/なん; v_dekiru exists in both
 *                 N5 and N4 — so the key is level-namespaced id, PERIOD. Practice.js
 *                 projections carry {id, level} for exactly this.)
 *   grammar     — bare "G12" (ids globally unique; land in k-lesson-completed via
 *                 unlock.computeUnlocks at grammar completion).
 *
 * Enumeration rule (MUST stay in lockstep with the Practice.js DB projections —
 * see "key-derivation drift" risk in the plan):
 *   kanji: type==='kanji' && lesson === <completed lesson id>
 *   vocab: type==='vocab' && /^N\d\.\d+$/.test(lesson_ids) === completed id
 *          && id has no '__' (conjugation sub-entries)
 *   Level-only lesson_ids ("N5") are auxiliaries / kana display variants —
 *   deliberately NOT reviewable (grammar points cover that ground).
 *
 * localStorage:
 *   k-srs-items        — { key: {r:0-5, due:'YYYY-MM-DD', ts:<ms; 0=seeded, never reviewed>} }
 *   k-srs-seeded       — '1' once initial seeding completed
 *   k-srs-last-cleared — date of the last daily clear payout (local-only, not synced)
 *
 * Seeding for pre-existing progress staggers first dues over up to 4 weeks
 * (deterministic per key) so day one never shows an avalanche; the surfaced
 * session is additionally capped at DAILY_CAP.
 *
 * Load at boot after quests.js. Subscribes to JPShared.events.
 */

(function () {
  'use strict';

  window.JPShared = window.JPShared || {};
  if (window.JPShared.srs) return;

  var INTERVALS = [1, 3, 7, 14, 30, 90];
  var DAILY_CAP = 20;    // vocab+kanji surfaced per session
  var GRAMMAR_CAP = 2;   // grammar rows surfaced per day
  var KEIKO_CLEAR = 5;   // paid once per day for finishing a session

  var LESSON_RE = /^N\d\.\d+$/;
  var GRAMMAR_RE = /^G\d+$/;

  // ---------------------------------------------------------------------------
  // Dates (same conventions as quests.js: local YYYY-MM-DD, k-qa-date override)
  // ---------------------------------------------------------------------------

  function todayStr() {
    try {
      var qa = localStorage.getItem('k-qa-date');
      if (qa && /^\d{4}-\d{2}-\d{2}$/.test(qa)) return qa;
    } catch (e) {}
    return new Date().toLocaleDateString('en-CA');
  }

  /** dateStr + n days → YYYY-MM-DD. Noon anchor sidesteps DST edges. */
  function addDays(dateStr, n) {
    var d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toLocaleDateString('en-CA');
  }

  function dateOfTs(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('en-CA');
  }

  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // ---------------------------------------------------------------------------
  // Storage
  // ---------------------------------------------------------------------------

  function readItems() {
    try { return JSON.parse(localStorage.getItem('k-srs-items') || '{}') || {}; }
    catch (e) { return {}; }
  }

  function writeItems(items) {
    try { localStorage.setItem('k-srs-items', JSON.stringify(items)); } catch (e) {}
  }

  function completedMap() {
    try { return JSON.parse(localStorage.getItem('k-lesson-completed') || '{}') || {}; }
    catch (e) { return {}; }
  }

  // ---------------------------------------------------------------------------
  // Glossary index: lessonId → [srs keys]. Fetched lazily, cached per session.
  // ---------------------------------------------------------------------------

  var indexPromise = null;

  function loadIndex(manifest) {
    if (indexPromise) return indexPromise;
    var m = manifest || (window.JPApp && window.JPApp._manifest);
    if (!m || !m.data || !Array.isArray(m.levels)) return Promise.resolve(null);
    var cfg = (window.JPApp && window.JPApp.config) || null;
    indexPromise = Promise.all(m.levels.map(function (lvl) {
      var path = m.data[lvl] && m.data[lvl].glossary;
      if (!path) return null;
      var url = window.getAssetUrl ? window.getAssetUrl(cfg, path) : path;
      return fetch(url + '?t=' + Date.now()).then(function (r) { return r.json(); })
        .then(function (g) { return { lvl: lvl, entries: (g && g.entries) || [] }; });
    })).then(function (parts) {
      var byLesson = {}; // lessonId -> [keys]
      parts.forEach(function (part) {
        if (!part) return;
        part.entries.forEach(function (e) {
          if (!e || !e.id) return;
          var lessonId = null;
          // Multi-id entries ("N5.13, N4.25" — word introduced early, revisited
          // later) enroll at their FIRST (introducing) lesson.
          var firstVocabLesson = String(e.lesson_ids || '').split(/[,\s]+/)[0] || '';
          if (e.type === 'kanji' && LESSON_RE.test(e.lesson || '')) lessonId = e.lesson;
          else if (e.type === 'vocab' && LESSON_RE.test(firstVocabLesson) && e.id.indexOf('__') === -1) lessonId = firstVocabLesson;
          if (!lessonId) return;
          if (!byLesson[lessonId]) byLesson[lessonId] = [];
          byLesson[lessonId].push(part.lvl + ':' + e.id);
        });
      });
      return byLesson;
    }).catch(function () {
      indexPromise = null; // allow retry on next call
      return null;
    });
    return indexPromise;
  }

  // ---------------------------------------------------------------------------
  // Core mutations
  // ---------------------------------------------------------------------------

  /** Add keys that aren't already tracked. offsetFn(key) → days-from-today. */
  function enrollKeys(keys, offsetFn) {
    if (!keys || !keys.length) return 0;
    var items = readItems();
    var today = todayStr();
    var added = 0;
    keys.forEach(function (key) {
      if (items[key]) return; // idempotent — live rungs are never reset
      items[key] = { r: 0, due: addDays(today, offsetFn(key)), ts: 0 };
      added++;
    });
    if (added) writeItems(items);
    return added;
  }

  function seedAll(byLesson) {
    var done = completedMap();
    var itemKeys = [];
    var grammarKeys = [];
    Object.keys(done).forEach(function (id) {
      if (!done[id]) return;
      if (LESSON_RE.test(id) && byLesson[id]) itemKeys = itemKeys.concat(byLesson[id]);
      else if (GRAMMAR_RE.test(id)) grammarKeys.push(id);
    });
    // Stagger vocab/kanji over up to 4 weeks so day one is a normal session.
    var spreadDays = Math.max(3, Math.min(28, Math.ceil(itemKeys.length / DAILY_CAP)));
    enrollKeys(itemKeys, function (key) { return 1 + (hashStr('srs:' + key) % spreadDays); });
    // Grammar gets its own 2-week spread (~GRAMMAR_CAP/day).
    enrollKeys(grammarKeys, function (key) { return 1 + (hashStr('srs:' + key) % 14); });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  var api = {

    INTERVALS: INTERVALS,
    DAILY_CAP: DAILY_CAP,
    GRAMMAR_CAP: GRAMMAR_CAP,
    KEIKO_CLEAR: KEIKO_CLEAR,

    todayStr: todayStr,

    isSeeded: function () {
      try { return localStorage.getItem('k-srs-seeded') === '1'; } catch (e) { return false; }
    },

    /**
     * One-time seed from pre-existing progress. Async (fetches glossaries);
     * dispatches 'jp-srs-changed' when the map changes so Home can re-render.
     * Fresh installs (nothing completed) seed instantly to an empty map.
     */
    ensureSeeded: function (manifest) {
      if (this.isSeeded()) return Promise.resolve(false);
      var done = completedMap();
      var hasAny = Object.keys(done).some(function (k) { return done[k]; });
      if (!hasAny) {
        try { localStorage.setItem('k-srs-seeded', '1'); } catch (e) {}
        return Promise.resolve(true);
      }
      var self = this;
      return loadIndex(manifest).then(function (byLesson) {
        if (!byLesson) return false; // fetch failed — flag stays unset, retry next boot
        seedAll(byLesson);
        try { localStorage.setItem('k-srs-seeded', '1'); } catch (e) {}
        try { window.dispatchEvent(new CustomEvent('jp-srs-changed')); } catch (e) {}
        return true;
      });
    },

    /** Enroll one lesson's items (fires on lesson-complete). Async, idempotent. */
    enrollLesson: function (lessonId) {
      if (!LESSON_RE.test(lessonId || '')) return Promise.resolve(0);
      return loadIndex().then(function (byLesson) {
        if (!byLesson || !byLesson[lessonId]) return 0;
        // New material comes due quickly: 1-3 days out, deterministic per key.
        var added = enrollKeys(byLesson[lessonId], function (key) {
          return 1 + (hashStr('srs:' + key) % 3);
        });
        if (added) { try { window.dispatchEvent(new CustomEvent('jp-srs-changed')); } catch (e) {} }
        return added;
      });
    },

    /**
     * Storage-only due summary (cheap enough for every home render):
     * { items, itemsSurfaced, capped, grammar: [<=GRAMMAR_CAP G-keys, most overdue first] }
     * "Due" = due <= today AND not already reviewed today.
     */
    getDueCounts: function () {
      var items = readItems();
      var today = todayStr();
      var due = 0;
      var grammarDue = [];
      Object.keys(items).forEach(function (key) {
        var it = items[key];
        if (!it || it.due > today || dateOfTs(it.ts) === today) return;
        if (GRAMMAR_RE.test(key)) grammarDue.push(key);
        else due++;
      });
      grammarDue.sort(function (a, b) {
        var d = items[a].due < items[b].due ? -1 : items[a].due > items[b].due ? 1 : 0;
        return d || (hashStr(a) - hashStr(b));
      });
      return {
        items: due,
        itemsSurfaced: Math.min(due, DAILY_CAP),
        capped: due > DAILY_CAP,
        grammar: grammarDue.slice(0, GRAMMAR_CAP)
      };
    },

    /** Due vocab/kanji keys, most overdue first (hash tiebreak), sliced to cap. */
    getDueKeys: function (cap) {
      var items = readItems();
      var today = todayStr();
      var due = [];
      Object.keys(items).forEach(function (key) {
        if (GRAMMAR_RE.test(key)) return;
        var it = items[key];
        if (!it || it.due > today || dateOfTs(it.ts) === today) return;
        due.push(key);
      });
      due.sort(function (a, b) {
        var d = items[a].due < items[b].due ? -1 : items[a].due > items[b].due ? 1 : 0;
        return d || (hashStr(a) - hashStr(b));
      });
      return due.slice(0, cap == null ? DAILY_CAP : cap);
    },

    /**
     * Move an item on the ladder. See header rules. Unknown keys are ignored —
     * drills never auto-enroll (enrollment is lesson/grammar completion only).
     */
    recordAnswer: function (key, correct) {
      var items = readItems();
      var it = items[key];
      if (!it) return false;
      var today = todayStr();
      if (dateOfTs(it.ts) === today) return false;       // one movement per day
      if (correct) {
        if (it.due > today) return false;                // anti-grind: climb only when due
        it.r = Math.min(INTERVALS.length - 1, (it.r || 0) + 1);
        it.due = addDays(today, INTERVALS[it.r]);
      } else {
        it.r = Math.max(0, (it.r || 0) - 1);
        it.due = addDays(today, 1);
      }
      it.ts = Date.now();
      writeItems(items);
      return true;
    },

    /** Remove an orphan (entry no longer in the glossary). Session-resolution only. */
    retireKey: function (key) {
      var items = readItems();
      if (!(key in items)) return;
      delete items[key];
      writeItems(items);
    },

    /** Has today's clear already been paid? (Summary uses this for the +keiko line.) */
    clearedToday: function () {
      try { return localStorage.getItem('k-srs-last-cleared') === todayStr(); }
      catch (e) { return false; }
    }
  };

  window.JPShared.srs = api;

  // ---------------------------------------------------------------------------
  // Event subscriptions
  // ---------------------------------------------------------------------------

  if (window.JPShared.events) {
    var ev = window.JPShared.events;

    ev.on('drill-answer', function (p) {
      // Only id-carrying answers move the ladder. KOTD per-step answers are
      // ignored here — kotd-complete is that drill's single review signal.
      if (!p || !p.srsKey || p.module === 'kotd') return;
      api.recordAnswer(p.srsKey, !!p.correct);
    });

    ev.on('kotd-complete', function (p) {
      if (p && p.srsKey) api.recordAnswer(p.srsKey, true);
    });

    ev.on('grammar-complete', function (p) {
      if (!p || !GRAMMAR_RE.test(p.id || '')) return;
      var items = readItems();
      if (items[p.id]) {
        api.recordAnswer(p.id, (p.pct == null) || p.pct >= 60);
      } else {
        // First completion = enrollment; first review lands in a day.
        items[p.id] = { r: 0, due: addDays(todayStr(), INTERVALS[0]), ts: 0 };
        writeItems(items);
      }
    });

    ev.on('lesson-complete', function (p) {
      if (p && p.id) api.enrollLesson(p.id);
    });

    ev.on('srs-session-complete', function () {
      if (api.clearedToday()) return;
      try { localStorage.setItem('k-srs-last-cleared', todayStr()); } catch (e) {}
      try { if (window.JPShared.keiko) window.JPShared.keiko.earn(KEIKO_CLEAR, 'srs-clear'); } catch (e) {}
    });
  }

})();

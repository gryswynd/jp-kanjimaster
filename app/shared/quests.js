/**
 * app/shared/quests.js
 * Daily quests ("Today's Training") — the close-the-loop-every-day mechanic.
 *
 * 2-3 micro-quests are drawn deterministically per calendar day from a pool,
 * filtered so a quest is NEVER dealt unless the user can actually complete it
 * (module visible + at least one available content item). Progress ticks off
 * typed activity events on JPShared.events; completions pay keiko.
 *
 * localStorage keys:
 *   k-quests-today    — {date, quests:[{id,target,progress,done,doneTs}], bonusPaid, celebrated}
 *   k-quests-history  — [{date, done, total}] capped at 60 days
 *   k-qa-date         — QA-only date override (quests only, never streak)
 *
 * Display strings are NOT persisted — always re-derived from POOL so copy
 * fixes never strand stored state.
 *
 * Load after events.js + keiko.js + streak.js, before first renderMenu().
 */

(function () {
  'use strict';

  window.JPShared = window.JPShared || {};
  if (window.JPShared.quests) return;

  var KEIKO_TABLE = {
    quest: 10,      // per quest completed
    dailyBonus: 15  // all quests done
  };

  var HISTORY_CAP = 60;
  var QUESTS_PER_DAY = 3;

  // ---------------------------------------------------------------------------
  // Dates (mirrors streak.js todayStr; k-qa-date override is quests-only)
  // ---------------------------------------------------------------------------

  function todayStr() {
    try {
      var qa = localStorage.getItem('k-qa-date');
      if (qa && /^\d{4}-\d{2}-\d{2}$/.test(qa)) return qa;
    } catch (e) {}
    return new Date().toLocaleDateString('en-CA');
  }

  // ---------------------------------------------------------------------------
  // Deterministic per-day RNG
  // ---------------------------------------------------------------------------

  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffled(arr, rand) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // ---------------------------------------------------------------------------
  // Storage
  // ---------------------------------------------------------------------------

  function readState() {
    try { return JSON.parse(localStorage.getItem('k-quests-today') || 'null'); }
    catch (e) { return null; }
  }

  function writeState(state) {
    try { localStorage.setItem('k-quests-today', JSON.stringify(state)); } catch (e) {}
  }

  function archiveDay(state) {
    if (!state || !state.date || !Array.isArray(state.quests)) return;
    try {
      var hist = JSON.parse(localStorage.getItem('k-quests-history') || '[]');
      if (hist.length && hist[hist.length - 1].date === state.date) return;
      var done = 0;
      state.quests.forEach(function (q) { if (q.done) done++; });
      hist.push({ date: state.date, done: done, total: state.quests.length });
      if (hist.length > HISTORY_CAP) hist = hist.slice(-HISTORY_CAP);
      localStorage.setItem('k-quests-history', JSON.stringify(hist));
    } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // Audiostories index — fetched once at load so `listen` eligibility can gate
  // on actually-unlocked passages. If the fetch hasn't resolved by generation
  // time, `listen` is simply ineligible for that day (quests freeze per-day).
  // ---------------------------------------------------------------------------

  var audioIndex = null; // array of entries, or null while loading/unavailable

  function fetchAudioIndex() {
    try {
      var cfg = (window.JPApp && window.JPApp.config) || null;
      var url = window.getAssetUrl
        ? window.getAssetUrl(cfg, 'data/audiostories.index.json')
        : 'data/audiostories.index.json';
      fetch(url + '?t=' + Date.now())
        .then(function (r) { return r.json(); })
        .then(function (data) { audioIndex = (data && data.audiostories) || []; })
        .catch(function () { audioIndex = null; });
    } catch (e) { audioIndex = null; }
  }

  // ---------------------------------------------------------------------------
  // Eligibility helpers
  // ---------------------------------------------------------------------------

  function getUnlock() { return window.JPShared.unlock || null; }

  function getCompletedMap() {
    try { return JSON.parse(localStorage.getItem('k-lesson-completed') || '{}'); }
    catch (e) { return {}; }
  }

  function activeFlagCount() {
    try {
      var af = JSON.parse(localStorage.getItem('k-active-flags') || '[]');
      return Array.isArray(af) ? af.length : Object.keys(af || {}).length;
    } catch (e) { return 0; }
  }

  function moduleVisible(mod) {
    var u = getUnlock();
    return u ? u.isModuleVisible(mod) : false;
  }

  // Any unlocked-but-uncompleted lesson/grammar/review left on the path?
  function pathHasWork(manifest) {
    var u = getUnlock();
    var d = manifest && manifest.data;
    if (!u || !d) return false;
    var completed = getCompletedMap();
    var levels = ['N5', 'N4'];
    for (var li = 0; li < levels.length; li++) {
      var ld = d[levels[li]];
      if (!ld) continue;
      var kinds = [
        { list: ld.lessons || [], check: 'isLessonUnlocked' },
        { list: ld.grammar || [], check: 'isGrammarUnlocked' },
        { list: ld.reviews || [], check: 'isReviewUnlocked' }
      ];
      for (var ki = 0; ki < kinds.length; ki++) {
        var k = kinds[ki];
        for (var i = 0; i < k.list.length; i++) {
          var entry = k.list[i];
          if (!completed[entry.id] && u[k.check](entry)) return true;
        }
      }
    }
    return false;
  }

  // ≥1 unlocked AND uncompleted story (fresh reading available).
  function storyAvailable(manifest) {
    var u = getUnlock();
    var d = manifest && manifest.data;
    if (!u || !d) return false;
    var completed = getCompletedMap();
    var levels = ['N5', 'N4'];
    for (var li = 0; li < levels.length; li++) {
      var stories = (d[levels[li]] && d[levels[li]].stories) || [];
      for (var i = 0; i < stories.length; i++) {
        if (!completed[stories[i].id] && u.isStoryUnlocked(stories[i])) return true;
      }
    }
    return false;
  }

  // ≥1 unlocked Audio Dojo passage. Listening is replayable (the module
  // re-emits per session), so completion isn't required — only availability.
  function audioAvailable() {
    var u = getUnlock();
    if (!u || !Array.isArray(audioIndex) || !audioIndex.length) return false;
    for (var i = 0; i < audioIndex.length; i++) {
      if (u.isAudioStoryUnlocked(audioIndex[i])) return true;
    }
    return false;
  }

  function composeAvailable(manifest) {
    var u = getUnlock();
    var d = manifest && manifest.data;
    if (!u || !d) return false;
    var levels = ['N5', 'N4'];
    for (var li = 0; li < levels.length; li++) {
      var entries = (d[levels[li]] && d[levels[li]].compose) || [];
      for (var i = 0; i < entries.length; i++) {
        if (u.isComposeUnlocked(entries[i])) return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Quest pool
  // ---------------------------------------------------------------------------
  // matches(type, payload) → integer increment (0 = no match).
  // eligible(manifest) → can this quest be dealt today?
  // launch: {mode, special?} — special 'path' resolves to the current blocker
  // at render time; special 'games'/'flags' hint at a Dojo hub.

  var POOL = [
    {
      id: 'path',
      icon: '⛩️',
      title: 'Advance your path',
      sub: 'Finish a lesson, grammar drill, or review',
      target: 1,
      launch: { special: 'path' },
      eligible: function (manifest) { return pathHasWork(manifest); },
      matches: function (type) {
        return (type === 'lesson-complete' || type === 'grammar-complete' || type === 'review-complete') ? 1 : 0;
      }
    },
    {
      id: 'dojo10',
      icon: '🥋',
      title: 'Answer 10 Dojo questions',
      sub: 'Any flashcards or quiz in the Dojo',
      target: 10,
      launch: { mode: 'practice' },
      eligible: function () { return moduleVisible('practice'); },
      matches: function (type) { return type === 'drill-answer' ? 1 : 0; }
    },
    {
      id: 'hotstreak',
      icon: '🔥',
      title: 'Get a 5-answer streak',
      sub: 'Five correct in a row, any quiz',
      target: 1,
      launch: { mode: 'practice' },
      eligible: function () { return moduleVisible('practice'); },
      matches: function (type, payload) {
        return (type === 'drill-answer' && payload && payload.correct && (payload.streak || 0) >= 5) ? 1 : 0;
      }
    },
    {
      id: 'story',
      icon: '📖',
      title: 'Finish a story',
      sub: 'Read one story to the end',
      target: 1,
      launch: { mode: 'story' },
      eligible: function (manifest) { return moduleVisible('story') && storyAvailable(manifest); },
      matches: function (type) { return type === 'story-complete' ? 1 : 0; }
    },
    {
      id: 'listen',
      icon: '🎧',
      title: 'Listen through a passage',
      sub: 'One Audio Dojo listening exercise',
      target: 1,
      launch: { mode: 'audiodojo' },
      eligible: function () { return moduleVisible('audiodojo') && audioAvailable(); },
      matches: function (type) { return type === 'audio-complete' ? 1 : 0; }
    },
    {
      id: 'flags3',
      icon: '🚩',
      title: 'Clear 3 flagged items',
      sub: 'Review words you marked tricky',
      target: 3,
      launch: { mode: 'practice' },
      eligible: function () { return moduleVisible('practice') && activeFlagCount() >= 3; },
      matches: function (type) { return type === 'flag-cleared' ? 1 : 0; }
    },
    {
      id: 'write',
      icon: '✍️',
      title: 'Complete a writing session',
      sub: 'Kanji or kana stroke practice',
      target: 1,
      launch: { mode: 'practice' },
      eligible: function () { return moduleVisible('practice'); },
      matches: function (type) { return type === 'writing-complete' ? 1 : 0; }
    },
    {
      id: 'compose',
      icon: '✏️',
      title: 'Complete a Composer prompt',
      sub: 'Write and grade a short composition',
      target: 1,
      launch: { mode: 'compose' },
      eligible: function (manifest) { return moduleVisible('compose') && composeAvailable(manifest); },
      matches: function (type) { return type === 'compose-scored' ? 1 : 0; }
    },
    {
      id: 'srs',
      icon: '🔁',
      title: 'Clear your due reviews',
      sub: 'Finish today’s review session',
      target: 1,
      launch: { mode: 'practice', arg: 'reviews' },
      eligible: function () {
        var s = window.JPShared.srs;
        return moduleVisible('practice') && !!s && s.isSeeded() && s.getDueCounts().items > 0;
      },
      matches: function (type) { return type === 'srs-session-complete' ? 1 : 0; }
    },
    {
      id: 'kotd',
      icon: '🀄',
      title: 'Master the kanji of the day',
      sub: 'Meaning, readings, and one clean write',
      target: 1,
      launch: { mode: 'practice', arg: 'daily' },
      eligible: function (manifest) {
        return moduleVisible('practice') && !!window.JPShared.quests.kanjiOfDay(manifest);
      },
      matches: function (type) { return type === 'kotd-complete' ? 1 : 0; }
    },
    {
      id: 'minigame',
      icon: '🎴',
      title: 'Play Scramble or Link Up',
      sub: 'One round of a word game',
      target: 1,
      launch: { mode: 'practice' },
      eligible: function () {
        var u = getUnlock();
        return !!u && (u.isScrambleUnlocked() || u.isLinkUpUnlocked());
      },
      matches: function (type) { return type === 'minigame-complete' ? 1 : 0; }
    }
  ];

  function poolById(id) {
    for (var i = 0; i < POOL.length; i++) if (POOL[i].id === id) return POOL[i];
    return null;
  }

  // ---------------------------------------------------------------------------
  // Generation
  // ---------------------------------------------------------------------------

  function generate(dateStr, manifest) {
    var rand = mulberry32(hashStr('quests:' + dateStr));
    var ids = [];

    var pathQ = poolById('path');
    var pathIn = pathQ.eligible(manifest);
    if (pathIn) ids.push('path');

    var eligible = [];
    for (var i = 0; i < POOL.length; i++) {
      var q = POOL[i];
      if (q.id === 'path') continue;
      try { if (q.eligible(manifest)) eligible.push(q.id); } catch (e) {}
    }
    var drawn = shuffled(eligible, rand).slice(0, QUESTS_PER_DAY - ids.length);
    ids = ids.concat(drawn);

    return {
      date: dateStr,
      quests: ids.map(function (id) {
        return { id: id, target: poolById(id).target, progress: 0, done: false, doneTs: 0 };
      }),
      bonusPaid: false,
      celebrated: false
    };
  }

  // Merge pool display fields into stored quests for UI consumption.
  function decorate(state) {
    if (!state) return null;
    var out = {
      date: state.date,
      bonusPaid: !!state.bonusPaid,
      celebrated: !!state.celebrated,
      quests: [],
      allDone: false,
      doneCount: 0
    };
    (state.quests || []).forEach(function (q) {
      var def = poolById(q.id);
      if (!def) return; // pool entry removed in an update — drop silently
      out.quests.push({
        id: q.id, icon: def.icon, title: def.title, sub: def.sub,
        target: q.target, progress: q.progress, done: q.done,
        launch: def.launch
      });
      if (q.done) out.doneCount++;
    });
    out.allDone = out.quests.length > 0 && out.doneCount === out.quests.length;
    return out;
  }

  // ---------------------------------------------------------------------------
  // Completion side-effects
  // ---------------------------------------------------------------------------

  function onQuestDone(def) {
    try { if (window.JPShared.keiko) window.JPShared.keiko.earn(KEIKO_TABLE.quest, 'quest'); } catch (e) {}
    try { if (window.JPShared.sfx) window.JPShared.sfx.stamp(); } catch (e) {}
    try { if (window.JPShared.haptics) window.JPShared.haptics.light(); } catch (e) {}
    // Tell the user WHAT happened — the haptic alone reads as a mystery buzz.
    try {
      if (window.JPApp && window.JPApp._toast) {
        window.JPApp._toast('✓ Goal complete: ' + ((def && def.title) || 'training goal') + ' · +' + KEIKO_TABLE.quest + ' けいこ');
      }
    } catch (e) {}
  }

  function onAllDone(state) {
    try { if (window.JPShared.keiko) window.JPShared.keiko.earn(KEIKO_TABLE.dailyBonus, 'daily-bonus'); } catch (e) {}
    try { if (window.JPShared.sfx) window.JPShared.sfx.unlock(); } catch (e) {}
    try { if (window.JPShared.haptics) window.JPShared.haptics.success(); } catch (e) {}
    // Delay so it reads AFTER the final goal's own toast instead of stacking
    // on top of it (both render at the same fixed position).
    try {
      setTimeout(function () {
        if (window.JPApp && window.JPApp._toast) {
          window.JPApp._toast('今日のけいこ complete! +' + KEIKO_TABLE.dailyBonus + ' けいこ bonus');
        }
      }, 2600);
    } catch (e) {}
    // Queue the Rikizo celebration for the next home render — but never clobber
    // an already-pending celebration (a lesson finish carries the unlock tour,
    // which is higher-value than ours).
    try {
      if (!localStorage.getItem('k-rikizo-pending-celebration')) {
        localStorage.setItem('k-rikizo-pending-celebration', JSON.stringify({
          source: 'quests',
          keiko: KEIKO_TABLE.dailyBonus + KEIKO_TABLE.quest * state.quests.length
        }));
      }
    } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  window.JPShared.quests = {

    KEIKO_TABLE: KEIKO_TABLE,

    /** Stored day differs from today (cheap re-render check). */
    isStale: function () {
      var s = readState();
      return !s || s.date !== todayStr();
    },

    /**
     * Today's quest state for UI consumption (decorated with display fields).
     * Regenerates lazily on day rollover — needs the manifest for content
     * eligibility, so pass it when available (home render). Without a manifest
     * a stale day is archived but NOT regenerated (returns null); the next
     * call with a manifest generates.
     */
    getToday: function (manifest) {
      var today = todayStr();
      var state = readState();
      if (state && state.date === today) return decorate(state);
      if (state && state.date !== today) archiveDay(state);
      if (!manifest) {
        if (state && state.date !== today) {
          try { localStorage.removeItem('k-quests-today'); } catch (e) {}
        }
        return null;
      }
      state = generate(today, manifest);
      writeState(state);
      return decorate(state);
    },

    /**
     * Internal event sink (wired to JPShared.events below).
     * Idempotent: only undone quests tick; bonus/celebration are one-shot.
     */
    handleEvent: function (type, payload) {
      var state = readState();
      if (!state || state.date !== todayStr()) {
        // Day rolled over mid-session: archive; regeneration happens at the
        // next home render (getToday with manifest). This event predates the
        // new day's card, so it doesn't tick anything.
        if (state) { archiveDay(state); try { localStorage.removeItem('k-quests-today'); } catch (e) {} }
        return;
      }

      var changed = false;
      var newlyDone = [];
      state.quests.forEach(function (q) {
        if (q.done) return;
        var def = poolById(q.id);
        if (!def) return;
        var inc = 0;
        try { inc = def.matches(type, payload) || 0; } catch (e) { inc = 0; }
        if (inc > 0) {
          q.progress = Math.min(q.target, q.progress + inc);
          changed = true;
          if (q.progress >= q.target) {
            q.done = true;
            q.doneTs = Date.now();
            newlyDone.push(def);
          }
        }
      });

      if (!changed) return;

      for (var i = 0; i < newlyDone.length; i++) onQuestDone(newlyDone[i]);

      var allDone = state.quests.length > 0 && state.quests.every(function (q) { return q.done; });
      if (allDone && !state.bonusPaid) {
        state.bonusPaid = true;
        writeState(state);
        onAllDone(state);
        return;
      }
      writeState(state);
    },

    /** Mark today's all-done card burst as played (one-shot). */
    markCelebrated: function () {
      var state = readState();
      if (!state) return;
      state.celebrated = true;
      writeState(state);
    },

    /** Completion history, oldest first: [{date, done, total}]. */
    getHistory: function () {
      try { return JSON.parse(localStorage.getItem('k-quests-history') || '[]'); }
      catch (e) { return []; }
    },

    /**
     * Kanji of the day — one deterministic pick per calendar day from the
     * student's KNOWN pool (kanji of completed lessons; free mode = all
     * taught kanji). Home card footer and the Dojo Daily drill both call
     * this so they can never disagree. Returns null when nothing is known
     * yet (brand-new student) or the manifest/unlock engine is unavailable.
     */
    kanjiOfDay: function (manifest) {
      var u = getUnlock();
      if (!u || !u.getKnownKanjiSet || !manifest) return null;
      var known;
      try { known = Array.from(u.getKnownKanjiSet(null, manifest, [])); }
      catch (e) { return null; }
      if (!known.length) return null;
      return known[hashStr('kotd:' + todayStr()) % known.length];
    },

    /** QA only — regenerate for an arbitrary date without touching storage. */
    _generate: generate
  };

  // Subscribe to every quest-relevant event type through one sink.
  if (window.JPShared.events) {
    ['drill-answer', 'lesson-complete', 'grammar-complete', 'review-complete',
     'story-complete', 'audio-complete', 'compose-scored', 'writing-complete',
     'minigame-complete', 'flag-cleared', 'kotd-complete', 'srs-session-complete'].forEach(function (type) {
      window.JPShared.events.on(type, function (payload) {
        window.JPShared.quests.handleEvent(type, payload);
      });
    });
  }

  fetchAudioIndex();

})();

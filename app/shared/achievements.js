/**
 * app/shared/achievements.js
 * Milestone achievement stamps for the 印帳 album.
 *
 * Each DEF is either RETRO-SCANNABLE (check() over persisted state, so a
 * veteran device grants everything already earned on first boot) or
 * EVENT-ONLY (the underlying signal isn't persisted — compose scores, audio
 * listens, in-quiz hot streaks — so the grant fires from the live event).
 *
 * Granting: +10 keiko each, stamp sfx/haptic, a toast — with a STORM GUARD:
 * when a scan grants more than 3 at once (typical for the first boot on an
 * established device) it collapses to one summary toast. Keiko is still paid
 * per grant (the veteran windfall deliberately funds the new cosmetic sinks).
 *
 * localStorage: k-achievements — { defId: grantTs }.
 * Load AFTER srs.js (drill-answer listener order: srs updates k-srs-items
 * before we re-check mastery counts).
 */

(function () {
  'use strict';

  window.JPShared = window.JPShared || {};
  if (window.JPShared.achievements) return;

  var KEIKO_PER = 10;
  var STORM_THRESHOLD = 3;

  var HIRAGANA = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';
  var KATAKANA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';

  var manifest = null;

  // ---------------------------------------------------------------------------
  // Storage helpers
  // ---------------------------------------------------------------------------

  function readMap(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; }
    catch (e) { return {}; }
  }

  function readInt(key) {
    try { var v = parseInt(localStorage.getItem(key) || '0', 10); return isNaN(v) ? 0 : v; }
    catch (e) { return 0; }
  }

  function todayStr() {
    try {
      var qa = localStorage.getItem('k-qa-date');
      if (qa && /^\d{4}-\d{2}-\d{2}$/.test(qa)) return qa;
    } catch (e) {}
    return new Date().toLocaleDateString('en-CA');
  }

  function addDays(dateStr, n) {
    var d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toLocaleDateString('en-CA');
  }

  function completedMap() { return readMap('k-lesson-completed'); }

  function srsMasteredCount() {
    var items = readMap('k-srs-items');
    var n = 0;
    Object.keys(items).forEach(function (k) {
      var it = items[k];
      if (it && it.r === 5 && k.indexOf(':') > 0) n++;
    });
    return n;
  }

  function gameCompleteCount() {
    var prefixes = ['k-scr-', 'k-conn-', 'k-conn4-', 'k-mara-'];
    var n = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key) continue;
        for (var p = 0; p < prefixes.length; p++) {
          if (key.indexOf(prefixes[p]) === 0) {
            try {
              var v = JSON.parse(localStorage.getItem(key));
              if (v && v.status === 'complete') n++;
            } catch (e) {}
            break;
          }
        }
      }
    } catch (e) {}
    return n;
  }

  function allIdsCompleted(ids) {
    if (!ids.length) return false;
    var done = completedMap();
    return ids.every(function (id) { return !!done[id]; });
  }

  function levelIds(lvl) {
    if (!manifest || !manifest.data || !manifest.data[lvl]) return [];
    var d = manifest.data[lvl];
    return [].concat(
      (d.lessons || []).map(function (e) { return e.id; }),
      (d.grammar || []).map(function (e) { return e.id; }),
      (d.reviews || []).map(function (e) { return e.id; })
    );
  }

  function perfectWeek() {
    var hist;
    try { hist = JSON.parse(localStorage.getItem('k-quests-history') || '[]'); }
    catch (e) { return false; }
    if (!Array.isArray(hist) || hist.length < 7) return false;
    var perfect = {};
    hist.forEach(function (h) {
      if (h && h.date && h.total > 0 && h.done === h.total) perfect[h.date] = true;
    });
    var dates = Object.keys(perfect);
    for (var i = 0; i < dates.length; i++) {
      var run = 1;
      var d = dates[i];
      while (perfect[addDays(d, run)]) run++;
      if (run >= 7) return true;
    }
    return false;
  }

  function kanaAll() {
    var m = readMap('k-kana-mastered');
    var all = HIRAGANA + KATAKANA;
    for (var i = 0; i < all.length; i++) {
      if (!m[all[i]]) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Definitions — order is the album shelf order.
  // icon: emoji string, or {belt:'belt-green.png'} for assets/ui art.
  // check(): retro-scannable predicate; event-only DEFs return false here and
  // are granted from the live event handler below.
  // ---------------------------------------------------------------------------

  var DEFS = [
    { id: 'first-lesson', title: 'First Steps', sub: 'Complete your first lesson', icon: '⛩️',
      check: function () { var d = completedMap(); return Object.keys(d).some(function (k) { return d[k] && /^N\d\.\d+$/.test(k); }); } },
    { id: 'first-grammar', title: 'Pattern Reader', sub: 'Complete your first grammar point', icon: '🌿',
      check: function () { var d = completedMap(); return Object.keys(d).some(function (k) { return d[k] && /^G\d+$/.test(k); }); } },
    { id: 'first-story', title: 'Bookworm', sub: 'Read a story to the end', icon: '📖',
      check: function () {
        if (!manifest || !manifest.data) return false;
        var d = completedMap();
        return (manifest.levels || []).some(function (lvl) {
          return ((manifest.data[lvl] || {}).stories || []).some(function (s) { return !!d[s.id]; });
        });
      } },
    { id: 'stories-n5', title: 'N5 Library', sub: 'Finish every N5 story', icon: '🏮',
      check: function () {
        if (!manifest || !manifest.data || !manifest.data.N5) return false;
        return allIdsCompleted((manifest.data.N5.stories || []).map(function (s) { return s.id; }));
      } },
    { id: 'first-review-clear', title: 'Fresh Mind', sub: 'Clear a review session', icon: '🔁',
      check: function () { try { return !!localStorage.getItem('k-srs-last-cleared'); } catch (e) { return false; } } },
    { id: 'kotd-first', title: 'Kanji of the Day', sub: 'Master a daily kanji', icon: '🀄',
      check: function () { try { return !!localStorage.getItem('k-kotd-last-done'); } catch (e) { return false; } } },
    { id: 'first-compose', title: 'Wordsmith', sub: 'Grade a composition', icon: '✏️', eventOnly: true,
      check: function () { return false; } },
    { id: 'first-listen', title: 'Open Ears', sub: 'Listen through an Audio Dojo passage', icon: '🎧', eventOnly: true,
      check: function () { return false; } },
    { id: 'hotstreak-20', title: 'On Fire', sub: '20 correct answers in a row', icon: '🔥', eventOnly: true,
      check: function () { return false; } },
    { id: 'streak-7', title: 'A Week of Training', sub: '7-day streak', icon: { belt: 'belt-green.png' },
      check: function () { return readInt('k-streak-best') >= 7; } },
    { id: 'streak-30', title: 'A Month of Training', sub: '30-day streak', icon: { belt: 'belt-purple.png' },
      check: function () { return readInt('k-streak-best') >= 30; } },
    { id: 'streak-90', title: 'A Season of Training', sub: '90-day streak', icon: { belt: 'belt-black.png' },
      check: function () { return readInt('k-streak-best') >= 90; } },
    { id: 'quest-perfect-week', title: 'Perfect Week', sub: 'All daily goals, 7 days running', icon: '🌸',
      check: perfectWeek },
    { id: 'mastered-1', title: 'First Seal', sub: 'Master your first word or kanji (90-day review)', icon: '判',
      check: function () { return srsMasteredCount() >= 1; } },
    { id: 'mastered-10', title: 'Ten Seals', sub: '10 items mastered', icon: '🎖️',
      check: function () { return srsMasteredCount() >= 10; } },
    { id: 'mastered-50', title: 'Seal Collector', sub: '50 items mastered', icon: '🏵️',
      check: function () { return srsMasteredCount() >= 50; } },
    { id: 'writing-perfect-10', title: 'Steady Hand', sub: '10 kanji written perfectly', icon: '✍️',
      check: function () {
        var m = readMap('k-writing-mastered');
        return Object.keys(m).filter(function (k) { return m[k] && m[k].perfect === true; }).length >= 10;
      } },
    { id: 'kana-all', title: 'Kana Complete', sub: 'Master every hiragana and katakana', icon: 'あ',
      check: kanaAll },
    { id: 'games-10', title: 'Game Master', sub: 'Clear 10 word-game puzzles', icon: '🎴',
      check: function () { return gameCompleteCount() >= 10; } },
    { id: 'n5-complete', title: 'N5 Conquered', sub: 'Every N5 lesson, grammar point, and review', icon: '五',
      check: function () { return allIdsCompleted(levelIds('N5')); } },
    { id: 'n4-complete', title: 'N4 Conquered', sub: 'Every N4 lesson, grammar point, and review', icon: '四',
      check: function () { return allIdsCompleted(levelIds('N4')); } },
    { id: 'keiko-500', title: 'Rich in Practice', sub: 'Earn 500 lifetime mon', icon: '🪙',
      check: function () { return readInt('k-keiko-earned') >= 500; } }
  ];

  function defById(id) {
    for (var i = 0; i < DEFS.length; i++) if (DEFS[i].id === id) return DEFS[i];
    return null;
  }

  // ---------------------------------------------------------------------------
  // Granting
  // ---------------------------------------------------------------------------

  function getGranted() { return readMap('k-achievements'); }

  function writeGranted(map) {
    try { localStorage.setItem('k-achievements', JSON.stringify(map)); } catch (e) {}
  }

  var toastQueue = 0;

  function announce(defs) {
    try { if (window.JPShared.sfx) window.JPShared.sfx.stamp(); } catch (e) {}
    try { if (window.JPShared.haptics) window.JPShared.haptics.success(); } catch (e) {}
    var toast = function (msg, delay) {
      setTimeout(function () {
        try { if (window.JPApp && window.JPApp._toast) window.JPApp._toast(msg); } catch (e) {}
      }, delay);
    };
    if (defs.length > STORM_THRESHOLD) {
      // Veteran retro-scan: one summary instead of a toast storm.
      toast('🏆 ' + defs.length + ' stamps added to your album · +' + (defs.length * KEIKO_PER) + ' 文', 1300);
    } else {
      defs.forEach(function (def, i) {
        // Staggered, and delayed behind any same-moment quest toast.
        toast('🏆 Stamp earned: ' + def.title + ' · +' + KEIKO_PER + ' 文', 1300 + i * 1600);
      });
    }
    try { window.dispatchEvent(new CustomEvent('jp-achievements-changed')); } catch (e) {}
  }

  /** Grant a single def now (no announce) — returns true if newly granted. */
  function grantSilent(id) {
    var granted = getGranted();
    if (granted[id]) return false;
    granted[id] = Date.now();
    writeGranted(granted);
    try { if (window.JPShared.keiko) window.JPShared.keiko.earn(KEIKO_PER, 'achievement:' + id); } catch (e) {}
    return true;
  }

  /**
   * Check all un-granted retro-scannable DEFs; fixpoint ≤3 passes because a
   * grant's keiko bonus can itself satisfy keiko-500. Announces in one batch.
   */
  function scan() {
    var newly = [];
    for (var pass = 0; pass < 3; pass++) {
      var found = false;
      var granted = getGranted();
      for (var i = 0; i < DEFS.length; i++) {
        var def = DEFS[i];
        if (granted[def.id] || def.eventOnly) continue;
        var ok = false;
        try { ok = !!def.check(); } catch (e) { ok = false; }
        if (ok && grantSilent(def.id)) { newly.push(def); found = true; }
      }
      if (!found) break;
    }
    if (newly.length) announce(newly);
    return newly.length;
  }

  var scanTimer = null;
  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(function () { scanTimer = null; scan(); }, 200);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  window.JPShared.achievements = {
    DEFS: DEFS,
    KEIKO_PER: KEIKO_PER,
    getGranted: getGranted,
    isGranted: function (id) { return !!getGranted()[id]; },
    earnedCount: function () { return Object.keys(getGranted()).length; },
    scan: scan,
    /** Boot entry: store the manifest and retro-scan. */
    init: function (m) {
      manifest = m || (window.JPApp && window.JPApp._manifest) || null;
      scheduleScan();
    }
  };

  // ---------------------------------------------------------------------------
  // Event wiring
  // ---------------------------------------------------------------------------

  if (window.JPShared.events) {
    var ev = window.JPShared.events;

    // Direct grants for signals that aren't persisted anywhere.
    ev.on('compose-scored', function () {
      if (grantSilent('first-compose')) announce([defById('first-compose')]);
    });
    ev.on('audio-complete', function () {
      if (grantSilent('first-listen')) announce([defById('first-listen')]);
    });
    ev.on('drill-answer', function (p) {
      if (p && p.correct && (p.streak || 0) >= 20 && grantSilent('hotstreak-20')) {
        announce([defById('hotstreak-20')]);
      }
      scheduleScan();
    });

    // Everything else: any activity event may have satisfied a check.
    ['lesson-complete', 'grammar-complete', 'review-complete', 'story-complete',
     'writing-complete', 'minigame-complete', 'kotd-complete',
     'srs-session-complete', 'flag-added', 'flag-cleared'].forEach(function (type) {
      ev.on(type, scheduleScan);
    });
  }

  try {
    window.addEventListener('jp-progress-synced', scheduleScan);
    window.addEventListener('jp-srs-changed', scheduleScan);
  } catch (e) {}

})();

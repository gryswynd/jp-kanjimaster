/**
 * app/shared/tutor-curriculum.js
 * Builds the "what has this student been taught so far" picture that makes Ask
 * Rikizo curriculum-aware. The overlay sends this to the server each question so
 * Rikizo can keep kanji within what's been learned, name the lesson where
 * something was taught, and answer at the right level.
 *
 * Source of truth (no new state — derived from existing progress):
 *   - window.JPShared.unlock  → isCompleted(id), getKnownKanjiSet(...)
 *   - manifest (window.getManifest) → ordered path: data.<lvl>.lessons/grammar
 *   - glossary data.<lvl>.glossary → vocab count by lesson tag
 *
 * Async init() preloads + caches the manifest and glossary counts at boot; the
 * synchronous getState()/describe() read localStorage live (so completion is
 * always current) and fold in the cached manifest/glossary. Degrades gracefully
 * if init hasn't finished (returns what it can from localStorage).
 *
 * Self-registers on window.JPShared.tutorCurriculum.
 */

(function () {
  'use strict';

  window.JPShared = window.JPShared || {};
  if (window.JPShared.tutorCurriculum) return;

  var cfg = null;
  var manifest = null;                 // cached manifest
  var vocabLessonIndex = null;         // { lessonId: count } of glossary vocab/kanji
  var whereIndex = null;               // [{ key, where, title, kind }] for where-taught lookup

  function S() { return window.JPShared; }

  // ---- ordered path helpers (from the manifest) ----------------------------

  /** Flattened lesson list in path order, across levels, e.g. N5.1..N5.18,N4.1.. */
  function orderedLessons() {
    if (!manifest || !manifest.data) return [];
    var out = [];
    var levels = manifest.levels || Object.keys(manifest.data);
    levels.forEach(function (lvl) {
      var ls = (manifest.data[lvl] && manifest.data[lvl].lessons) || [];
      ls.forEach(function (l) { out.push({ id: l.id, title: l.title, level: lvl, kanji: l.kanji || [] }); });
    });
    return out;
  }

  function allGrammar() {
    if (!manifest || !manifest.data) return [];
    var out = [];
    var levels = manifest.levels || Object.keys(manifest.data);
    levels.forEach(function (lvl) {
      var gs = (manifest.data[lvl] && manifest.data[lvl].grammar) || [];
      gs.forEach(function (g) { out.push({ id: g.id, title: g.title, level: lvl }); });
    });
    return out;
  }

  function isDone(id) {
    return !!(S().unlock && S().unlock.isCompleted && S().unlock.isCompleted(id));
  }

  // ---- public state --------------------------------------------------------

  function getState() {
    var lessons = orderedLessons();
    var completedLessons = lessons.filter(function (l) { return isDone(l.id); });
    var furthest = completedLessons.length ? completedLessons[completedLessons.length - 1] : null;

    // Known kanji = union of completed lessons' kanji (manifest carries l.kanji).
    var knownKanji = '';
    if (S().unlock && S().unlock.getKnownKanjiSet) {
      // getKnownKanjiSet returns a Set — Array.from, not Object.keys.
      var set = S().unlock.getKnownKanjiSet(null, manifest, null);
      knownKanji = set ? Array.from(set).join('') : '';
    }

    var knownGrammar = allGrammar().filter(function (g) { return isDone(g.id); })
      .map(function (g) { return { id: g.id, title: g.title }; });

    // Vocab count = sum of glossary entries tagged to completed lessons.
    var knownVocabCount = null;
    if (vocabLessonIndex) {
      knownVocabCount = 0;
      completedLessons.forEach(function (l) {
        knownVocabCount += vocabLessonIndex[l.id] || 0;
      });
    }

    // Level the student is working in = level of the furthest completed lesson,
    // or the first level if nothing completed yet.
    var level = furthest ? furthest.level
      : (manifest && (manifest.levels || Object.keys(manifest.data || {}))[0]) || 'N5';

    return {
      level: level,
      furthestLesson: furthest ? furthest.id : null,
      lessonsCompletedCount: completedLessons.length,
      lessonsCompleted: completedLessons.map(function (l) { return l.id; }),
      knownKanji: knownKanji,
      knownGrammar: knownGrammar,
      knownVocabCount: knownVocabCount,
      ready: !!manifest
    };
  }

  /** Compact text block for the server prompt hint. */
  function describe() {
    var s = getState();
    var lines = ['STUDENT PROGRESS (only reference lessons/ids listed here):'];
    lines.push('- Working in level: ' + s.level);
    if (s.furthestLesson) {
      lines.push('- Lessons completed: ' + s.lessonsCompletedCount + ' (furthest: ' + s.furthestLesson + ')');
    } else {
      lines.push('- Lessons completed: 0 (just starting)');
    }
    if (s.knownKanji) {
      lines.push('- Kanji already taught (treat as known): ' + s.knownKanji);
    } else {
      lines.push('- Kanji already taught: none yet');
    }
    if (s.knownGrammar.length) {
      lines.push('- Grammar already taught: ' + s.knownGrammar.map(function (g) {
        return g.id + ' (' + g.title + ')';
      }).join('; '));
    } else {
      lines.push('- Grammar already taught: none yet');
    }
    if (s.knownVocabCount != null) {
      lines.push('- Vocabulary words learned so far: ~' + s.knownVocabCount);
    }
    return lines.join('\n');
  }

  // ---- init / preload ------------------------------------------------------

  function buildVocabIndex(glossParts) {
    var idx = {};
    glossParts.forEach(function (g) {
      var entries = (g && g.entries) || [];
      entries.forEach(function (e) {
        var lid = e.lesson || e.lesson_ids; // kanji/vocab use `lesson`, grammar `lesson_ids`
        if (!lid) return;
        // A few entries carry multiple ids ("N5.1, N5.2"); count toward each.
        String(lid).split(/[,\s]+/).filter(Boolean).forEach(function (one) {
          idx[one] = (idx[one] || 0) + 1;
        });
      });
    });
    return idx;
  }

  // Ultra-common forms that would match almost any question — excluded from the
  // where-taught lookup so it surfaces specific items (になる), not noise (する).
  var WHERE_STOPLIST = {
    'する': 1, 'ある': 1, 'いる': 1, 'です': 1, 'ます': 1, 'だ': 1,
    'この': 1, 'その': 1, 'あの': 1, 'して': 1, 'から': 1, 'まで': 1,
    'こと': 1, 'もの': 1, 'なる': 1, 'いう': 1, 'ない': 1, 'これ': 1, 'それ': 1
  };

  /** Pull individual kana forms out of a grammar title's slash/dash list. */
  function extractForms(title) {
    return String(title || '').split(/[\s/、・—\-–]+/)
      .map(function (t) { return t.replace(/[〜～]/g, '').trim(); })
      .filter(function (t) {
        return t.length >= 2 && t.length <= 14 &&
          /[ぁ-んァ-ヶ]/.test(t) && !/[A-Za-z]/.test(t) && !WHERE_STOPLIST[t];
      });
  }

  /**
   * Build the "where is X taught" index: an array of { key, where, title, kind }.
   *   - vocab/kanji: key = surface or reading, where = lesson id (N4.12)
   *   - grammar:     key = a kana form from the title, where = grammar id (G31)
   * Used by lookup() to point students back to the lesson that introduced a term.
   */
  // A usable "where" is a real lesson id (N4.1), grammar id (G31), or review
  // (N5.Review.2) — NOT a bare level tag like "N5"/"N4" (some glossary entries
  // are mistagged that way; those point nowhere useful).
  function isValidWhere(w) {
    return /^N\d\.\d/.test(w) || /^G\d+$/.test(w) || /Review/i.test(w);
  }

  // Normalize romaji for fuzzy matching: lowercase, drop long-vowel marks and
  // anything that isn't a latin letter. So "nakereba", "Nakereba", "nakerēba"
  // all collapse to the same comparable string.
  function normRoma(s) {
    return String(s || '').toLowerCase()
      .replace(/[āîûēō]/g, function (c) { return { 'ā': 'a', 'î': 'i', 'û': 'u', 'ē': 'e', 'ō': 'o' }[c]; })
      .replace(/[^a-z]/g, '');
  }

  var PURE_KANA = /^[ぁ-んァ-ヶー]+$/;

  /** Romaji form of a pure-kana key, via jp-text's Hepburn converter. '' otherwise. */
  function romaKey(key) {
    if (!PURE_KANA.test(key)) return '';
    var jt = S().jpText;
    if (!jt || typeof jt.kanaToRomaji !== 'function') return '';
    var r = normRoma(jt.kanaToRomaji(key));
    // Only index romaji >= 5 chars — shorter forms (to, ba, nara, tara) collide
    // badly with English question text.
    return r.length >= 5 ? r : '';
  }

  function buildWhereIndex(glossParts) {
    var out = [];
    var seen = {}; // key|where dedup
    function add(key, where, title, kind) {
      if (!key || !where || WHERE_STOPLIST[key] || !isValidWhere(where)) return;
      var sig = key + '|' + where;
      if (seen[sig]) return;
      seen[sig] = 1;
      out.push({ key: key, roma: romaKey(key), where: where, title: title || '', kind: kind });
    }
    // Vocab + kanji from the glossary.
    glossParts.forEach(function (g) {
      ((g && g.entries) || []).forEach(function (e) {
        var lid = e.lesson || e.lesson_ids;
        if (!lid) return;
        var first = String(lid).split(/[,\s]+/).filter(Boolean)[0];
        if (e.surface && e.surface.length >= 2) add(e.surface, first, e.meaning, e.type || 'vocab');
        if (e.reading && e.reading !== e.surface && e.reading.length >= 2) add(e.reading, first, e.meaning, e.type || 'vocab');
      });
    });
    // Grammar forms parsed from manifest titles.
    allGrammar().forEach(function (gr) {
      extractForms(gr.title).forEach(function (form) { add(form, gr.id, gr.title, 'grammar'); });
    });
    return out;
  }

  /**
   * Scan free text (a student's question) for curriculum items and return where
   * each was taught. Longest/most-specific matches first, capped to keep the
   * prompt small. Each result: { key, where, title, kind, completed }.
   */
  function lookup(text) {
    if (!whereIndex || !text) return [];
    var hits = [];
    var byWhere = {};
    var romaText = normRoma(text); // for matching romaji-typed questions
    for (var i = 0; i < whereIndex.length; i++) {
      var e = whereIndex[i];
      // Match either the kana key in the raw text OR the romaji key in the
      // normalized-romaji text (so "nakereba" finds なければ).
      var matched = text.indexOf(e.key) !== -1 || (e.roma && romaText.indexOf(e.roma) !== -1);
      if (!matched) continue;
      // Keep only the longest matching key per destination (e.g. ようになる over なる).
      if (byWhere[e.where] && byWhere[e.where].key.length >= e.key.length) continue;
      byWhere[e.where] = e;
    }
    Object.keys(byWhere).forEach(function (w) { hits.push(byWhere[w]); });
    hits.sort(function (a, b) { return b.key.length - a.key.length; });
    return hits.slice(0, 6).map(function (e) {
      return {
        key: e.key, where: e.where, title: e.title, kind: e.kind,
        completed: !!(S().unlock && S().unlock.isCompleted && S().unlock.isCompleted(e.where))
      };
    });
  }

  /** Format lookup() results as a hint block, or '' if nothing matched. */
  function describeLookup(text) {
    var hits = lookup(text);
    if (!hits.length) return '';
    var lines = ['WHERE THIS IS TAUGHT IN THE APP (mention the lesson/grammar id if the student asks about that item):'];
    hits.forEach(function (h) {
      // Titles already start with the id ("G31 — …"); strip it to avoid "G31 (G31 — …)".
      var t = String(h.title || '').replace(/^G\d+\s*[—–-]\s*/, '');
      var place = h.kind === 'grammar'
        ? ('grammar ' + h.where + (t ? ' (' + t + ')' : ''))
        : ('lesson ' + h.where);
      lines.push('- "' + h.key + '" → ' + place + (h.completed ? ' [already studied]' : ' [not yet reached]'));
    });
    return lines.join('\n');
  }

  function init(config) {
    cfg = config || cfg;
    // Preload manifest + glossary once; failures are non-fatal (describe() just
    // omits the cached parts).
    if (!window.getManifest) return Promise.resolve();
    return window.getManifest(cfg).then(function (m) {
      manifest = m;
      var levels = manifest.levels || Object.keys(manifest.data || {});
      var urls = levels.map(function (lvl) {
        var path = manifest.data[lvl] && manifest.data[lvl].glossary;
        return path ? (window.getAssetUrl ? window.getAssetUrl(cfg, path) : path) : null;
      }).filter(Boolean);
      return Promise.all(urls.map(function (u) {
        return fetch(u).then(function (r) { return r.json(); }).catch(function () { return { entries: [] }; });
      })).then(function (parts) {
        vocabLessonIndex = buildVocabIndex(parts);
        whereIndex = buildWhereIndex(parts);
      });
    }).catch(function () { /* leave caches null; describe() degrades */ });
  }

  /**
   * Resolve a lesson/grammar/review id the way the launcher needs it, so the
   * answer bubble can turn "G25" into a tappable link.
   *   mode:      'grammar' (G##) | 'review' (N#.Review.#) | 'lesson' (N#.#) | null
   *   exists:    the id is a real entry in the cached manifest (guards hallucinated ids)
   *   reachable: the student can open it now (free mode, or they've completed it)
   * Returns { exists:false, mode:null, reachable:false } for anything unrecognized.
   */
  function resolveId(id) {
    id = String(id || '').trim();
    // Check Review BEFORE lesson — "N5.Review.1" also loosely matches N#.#.
    var mode = /^G\d+$/.test(id) ? 'grammar'
      : /^N\d\.Review\.\d+$/i.test(id) ? 'review'
      : /^N\d\.\d+$/.test(id) ? 'lesson'
      : null;
    if (!mode) return { exists: false, mode: null, reachable: false };

    var exists = false;
    if (manifest && manifest.data) {
      var levels = manifest.levels || Object.keys(manifest.data);
      for (var i = 0; i < levels.length && !exists; i++) {
        var d = manifest.data[levels[i]] || {};
        var arr = mode === 'grammar' ? d.grammar : mode === 'review' ? d.reviews : d.lessons;
        if (arr && arr.some(function (e) { return e.id === id; })) exists = true;
      }
    }

    var unlock = S().unlock;
    var reachable = !!(exists && unlock && (
      (unlock.isFree && unlock.isFree()) ||
      (unlock.isCompleted && unlock.isCompleted(id))
    ));
    return { exists: exists, mode: mode, reachable: reachable };
  }

  window.JPShared.tutorCurriculum = {
    init: init,
    getState: getState,
    describe: describe,
    lookup: lookup,
    describeLookup: describeLookup,
    resolveId: resolveId
  };
})();

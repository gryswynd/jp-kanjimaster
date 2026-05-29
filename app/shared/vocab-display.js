/**
 * app/shared/vocab-display.js
 * Pure function: pick the right display form for a vocab entry given the
 * set of kanji the learner has been taught.
 *
 * A vocab entry has:
 *   surface  — canonical kanji form (e.g. "友達")
 *   reading  — hiragana reading (e.g. "ともだち")
 *   matches  — optional array of alternate written forms (e.g. ["友だち"])
 *
 * When one or more kanji in `surface` haven't been taught yet, we want to
 * render a form that uses only known kanji — preferring the most
 * kanji-rich form from `matches[]`, and falling back to `reading` when
 * nothing in `matches[]` qualifies.
 */
(function () {
  'use strict';

  window.JPShared = window.JPShared || {};

  // CJK Unified Ideographs + Extension A. The iteration mark 々 is deliberately
  // excluded — it's not a kanji taught in any lesson, it just duplicates the
  // preceding character, so it should never gate the display form.
  var CJK = /[㐀-鿿]/g;

  function pick(entry, known) {
    if (!entry) return '';
    var surf = entry.surface || '';
    var surfCjk = surf.match(CJK) || [];

    // Pure kana surface — nothing to gate.
    if (surfCjk.length === 0) return surf;

    // Every kanji in surface is known — render the canonical surface.
    var allSurfKnown = true;
    for (var i = 0; i < surfCjk.length; i++) {
      if (!known || !known.has(surfCjk[i])) { allSurfKnown = false; break; }
    }
    if (allSurfKnown) return surf;

    // Otherwise look in matches[] for the "richest" form using only known kanji.
    var matches = Array.isArray(entry.matches) ? entry.matches : [];
    var best = null;
    for (var m = 0; m < matches.length; m++) {
      var form = matches[m];
      if (typeof form !== 'string' || form.length === 0) continue;
      var cjk = form.match(CJK) || [];
      var ok = true;
      for (var c = 0; c < cjk.length; c++) {
        if (!known || !known.has(cjk[c])) { ok = false; break; }
      }
      if (!ok) continue;
      if (
        best === null ||
        cjk.length > best.knownCount ||
        (cjk.length === best.knownCount && form.length < best.form.length)
      ) {
        best = { form: form, knownCount: cjk.length };
      }
    }
    if (best) return best.form;

    return entry.reading || surf;
  }

  // Eligibility decision shared by Practice.js (vocab pool, stats counter) and
  // flashcards.js (buildSet, getDynamicCompounds). A vocab is eligible iff
  // pick() yields a form containing at least one kanji from the active set
  // (the author has authored a renderable form for the current state — covers
  // hybrids like 名まえ on N5.1, 月よう日 on N5.2), OR the vocab's own
  // lesson_ids is in active lessons (covers pure-kana vocab and "must teach
  // here" overrides). Returns { eligible, display } so callers don't repeat
  // the pick.
  function evaluate(entry, activeKanjiSet, activeLessons) {
    if (!entry) return { eligible: false, display: '' };
    var display = pick(entry, activeKanjiSet);
    var hasActiveKanji = false;
    if (display) {
      var chars = display.match(CJK) || [];
      for (var i = 0; i < chars.length; i++) {
        if (activeKanjiSet && activeKanjiSet.has(chars[i])) { hasActiveKanji = true; break; }
      }
    }
    var lessonMatch = !!(entry.lesson_ids && activeLessons && activeLessons.has(entry.lesson_ids));
    return { eligible: hasActiveKanji || lessonMatch, display: display };
  }

  window.JPShared.vocabDisplay = { pick: pick, evaluate: evaluate };
})();

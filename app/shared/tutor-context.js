/**
 * app/shared/tutor-context.js
 * Tracks "what is the student looking at right now" so an Ask-Rikizo question can
 * be answered in context (which lesson, which page/section, which content).
 *
 * It is deliberately tiny: a single in-memory object the launcher and feature
 * modules write to, and the tutor overlay reads from. No persistence — context is
 * only meaningful for the live session.
 *
 *   set(ctx)    — replace the whole context (launcher calls this on every launch)
 *   patch(ctx)  — merge fields (a module enriches with lessonId / page / sample)
 *   get()       — the current context object
 *   describe()  — a short human/LLM-readable hint string, or '' if on a menu
 *
 * Self-registers on window.JPShared.tutorContext.
 */

(function () {
  'use strict';

  window.JPShared = window.JPShared || {};

  var ctx = { view: 'home' };

  // Friendly labels for the module keys used by JPApp.launch.
  var VIEW_LABELS = {
    home: 'the home screen',
    lesson: 'a lesson',
    grammar: 'a grammar point',
    practice: 'the Dojo (practice)',
    review: 'a review',
    story: 'a story',
    custom: 'a custom story',
    compose: 'composition practice',
    audiodojo: 'listening practice',
    game: 'the adventure',
    map: 'the map'
  };

  function set(next) {
    ctx = Object.assign({ view: 'home' }, next || {});
    return ctx;
  }

  function patch(next) {
    ctx = Object.assign({}, ctx, next || {});
    return ctx;
  }

  function get() {
    return ctx;
  }

  /**
   * Best-effort: pull a short sample of the Japanese text in a lesson/grammar
   * section object, regardless of its shape (items[].jp, lines[].jp, groups, a
   * summary, examples). Used by the content modules so Rikizo can answer "what
   * does this mean?" about whatever section the student is viewing. Returns a
   * string capped to ~240 chars.
   */
  function sampleFromSection(sec) {
    if (!sec || typeof sec !== 'object') return '';
    var bits = [];
    var push = function (v) { if (v && typeof v === 'string') bits.push(v); };
    if (sec.summary) push(sec.summary);
    var arrays = [].concat(sec.items || [], sec.lines || [], sec.examples || []);
    (sec.groups || []).forEach(function (g) { arrays = arrays.concat(g.items || []); });
    arrays.forEach(function (it) {
      if (!it) return;
      if (typeof it === 'string') { push(it); return; }
      push(it.jp); push(it.kanji); push(it.pattern && it.meaning);
    });
    var joined = bits.join(' / ');
    return joined.length > 240 ? joined.slice(0, 240) : joined;
  }

  /** Build a compact hint for the tutor backend (and a UI subtitle). */
  function describe() {
    var parts = [];
    var label = VIEW_LABELS[ctx.view] || ('the ' + (ctx.view || 'app') + ' screen');
    parts.push('The student is on ' + label + '.');
    if (ctx.lessonId) parts.push('Lesson/section id: ' + ctx.lessonId + '.');
    if (ctx.title) parts.push('Title: ' + ctx.title + '.');
    if (ctx.sectionType) parts.push('Section type: ' + ctx.sectionType + '.');
    if (ctx.page != null) parts.push('Page/section index: ' + ctx.page + '.');
    if (ctx.sample) parts.push('Currently visible text: "' + String(ctx.sample).slice(0, 240) + '".');
    return parts.join(' ');
  }

  /** Short label for the ask sheet subtitle, e.g. "about a lesson · N4.1". */
  function shortLabel() {
    var label = VIEW_LABELS[ctx.view] || (ctx.view || 'app');
    return ctx.lessonId ? (label + ' · ' + ctx.lessonId) : label;
  }

  window.JPShared.tutorContext = {
    set: set,
    patch: patch,
    get: get,
    describe: describe,
    shortLabel: shortLabel,
    sampleFromSection: sampleFromSection
  };
})();

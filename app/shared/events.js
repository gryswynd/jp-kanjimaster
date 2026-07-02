/**
 * app/shared/events.js
 * Minimal typed event bus for gamification + progress observers.
 *
 * Modules emit lightweight activity events (guarded, one line, adjacent to
 * their existing streak.recordActivity() calls); subscribers like quests.js
 * (and later achievements / SRS) listen without the emitters knowing.
 *
 * Event types in use:
 *   drill-answer       {module, correct, streak, item?}   — one per quiz answer
 *   lesson-complete    {id, pct}
 *   grammar-complete   {id, pct}
 *   review-complete    {id, pct}
 *   story-complete     {id, pct}
 *   audio-complete     {id}                               — first completion only
 *   compose-scored     {score}
 *   writing-complete   {kind}                             — 'kana' | 'kanji'
 *   minigame-complete  {game}
 *   flag-added         {key}
 *   flag-cleared       {key}
 *
 * Load early (before any feature module) so subscribers never miss events.
 */

(function () {
  'use strict';

  window.JPShared = window.JPShared || {};
  if (window.JPShared.events) return;

  var listeners = {}; // type -> [fn]

  window.JPShared.events = {

    /** Subscribe. Returns the fn for convenience. */
    on: function (type, fn) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(fn);
      return fn;
    },

    /** Unsubscribe a previously registered fn. */
    off: function (type, fn) {
      var arr = listeners[type];
      if (!arr) return;
      var i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    },

    /**
     * Emit an event. Payload is always an object (defaults to {}).
     * Each listener is isolated — one throwing listener never breaks
     * the emitting module or the other listeners.
     */
    emit: function (type, payload) {
      var arr = listeners[type];
      if (!arr || !arr.length) return;
      var p = payload || {};
      for (var i = 0; i < arr.length; i++) {
        try { arr[i](p, type); } catch (e) { /* listener error is never fatal */ }
      }
    }
  };

})();

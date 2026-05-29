// app/shared/practice-helpers.js
// Tiny persistence + change-pubsub for opt-in "helper" practice modules.
// Each helper is a boolean toggle in Settings → Practice Helpers, persisted to
// localStorage. Modules that conditionally render UI based on a helper flag can
// subscribe to onChange(...) so the toggle takes effect without a re-mount.
(function () {
  'use strict';
  window.JPShared = window.JPShared || {};

  var KEYS = {
    kanaWriting: 'k-helper-kana-writing'
  };

  // Default = false for every helper. Opt-in only — see Plan: "Off by default".
  function read(key) {
    try { return localStorage.getItem(key) === '1'; }
    catch (e) { return false; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, val ? '1' : '0'); } catch (e) {}
  }

  var listeners = [];
  function emit() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](); } catch (e) {}
    }
  }

  window.JPShared.practiceHelpers = {
    getKanaWriting: function () { return read(KEYS.kanaWriting); },
    setKanaWriting: function (v) {
      var cur = read(KEYS.kanaWriting);
      var next = !!v;
      if (cur === next) return;
      write(KEYS.kanaWriting, next);
      emit();
    },
    onChange: function (cb) {
      if (typeof cb !== 'function') return function () {};
      listeners.push(cb);
      return function () {
        var i = listeners.indexOf(cb);
        if (i >= 0) listeners.splice(i, 1);
      };
    }
  };
})();

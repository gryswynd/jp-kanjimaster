// app/shared/practice-helpers.js
// Tiny persistence + change-pubsub for opt-in "helper" practice modules.
// Each helper is a boolean toggle in Settings → Practice Helpers, persisted to
// localStorage. Modules that conditionally render UI based on a helper flag can
// subscribe to onChange(...) so the toggle takes effect without a re-mount.
(function () {
  'use strict';
  window.JPShared = window.JPShared || {};

  var listeners = [];
  function emit() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](); } catch (e) {}
    }
  }

  window.JPShared.practiceHelpers = {
    // Kana Writing Practice is a core feature now — always on. The Settings
    // toggle was removed (2026-07); the getter stays so gating call-sites
    // (Practice.js, WritingKana.js) keep working unchanged. The old
    // k-helper-kana-writing localStorage key is simply ignored.
    getKanaWriting: function () { return true; },
    setKanaWriting: function () {},
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

// app/shared/haptics.js
// Thin Capacitor-aware wrapper. Registers `window.JPShared.haptics`.
// Safe to call from any context: no-ops in browser/Android, swallows errors
// if the plugin isn't installed/synced.
(function () {
  window.JPShared = window.JPShared || {};

  function plugin() {
    var C = window.Capacitor;
    if (!C || !C.isNativePlatform || !C.isNativePlatform()) return null;
    return (C.Plugins && C.Plugins.Haptics) || null;
  }

  function safe(fn) { try { fn(); } catch (e) {} }

  function impact(style) {
    var p = plugin();
    if (!p || !p.impact) return;
    safe(function () { p.impact({ style: style }); });
  }

  function notify(type) {
    var p = plugin();
    if (!p || !p.notification) return;
    safe(function () { p.notification({ type: type }); });
  }

  var H = {
    light:   function () { impact('LIGHT'); },
    medium:  function () { impact('MEDIUM'); },
    heavy:   function () { impact('HEAVY'); },
    select:  function () {
      var p = plugin();
      if (!p) return;
      // selectionChanged() is the cheap one — Capacitor recommends pairing
      // selectionStart/changed/end for sliders. For one-shot taps, changed alone
      // gives the right "tick".
      if (p.selectionChanged) safe(function () { p.selectionChanged(); });
      else if (p.impact)      safe(function () { p.impact({ style: 'LIGHT' }); });
    },
    success: function () { notify('SUCCESS'); },
    warning: function () { notify('WARNING'); },
    error:   function () { notify('ERROR'); }
  };

  window.JPShared.haptics = H;
})();

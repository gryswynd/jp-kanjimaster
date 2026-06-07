// app/shared/font-scale.js
// Accessibility text-size control. Mirrors the Reading Aids pattern (jp-text.js):
// a single value lives in localStorage and is reflected onto <html> at boot, so
// every lazily-loaded module + every <body>-level popup inherits it for free.
//
// The value is exposed as the CSS custom property `--font-scale` on
// document.documentElement. Reading-content wrappers opt IN by consuming it with
// `zoom: var(--font-scale, 1)` (see index.html) — px AND rem text scale uniformly.
// Anything that does NOT carry that rule (games, the writing canvas, nav chrome)
// stays at 1x, so pointer/stroke math and fixed layout are untouched.
(function () {
  'use strict';
  window.JPShared = window.JPShared || {};

  var KEY = 'k-font-scale';

  // Preset steps shown in Settings. `scale` is the zoom multiplier.
  var PRESETS = [
    { id: 'default', label: 'A',  title: 'Default', scale: 1 },
    { id: 'large',   label: 'A',  title: 'Large',   scale: 1.15 },
    { id: 'larger',  label: 'A',  title: 'Larger',  scale: 1.3 },
    { id: 'largest', label: 'A',  title: 'Largest', scale: 1.5 },
  ];
  var MIN = 1, MAX = 1.5;
  var listeners = [];

  function clamp(v) {
    var n = parseFloat(v);
    if (!isFinite(n)) return 1;
    return n < MIN ? MIN : (n > MAX ? MAX : n);
  }

  function getScale() {
    try { return clamp(localStorage.getItem(KEY)); } catch (e) { return 1; }
  }

  // Nearest preset id for the current scale ('default' if unset/1x).
  function getPresetId() {
    var s = getScale();
    for (var i = 0; i < PRESETS.length; i++) {
      if (Math.abs(PRESETS[i].scale - s) < 0.001) return PRESETS[i].id;
    }
    return 'default';
  }

  function apply() {
    var h = document.documentElement;
    if (!h) return;
    h.style.setProperty('--font-scale', String(getScale()));
  }

  function setScale(scale) {
    try { localStorage.setItem(KEY, String(clamp(scale))); } catch (e) {}
    apply();
    fire();
  }

  function setPreset(id) {
    for (var i = 0; i < PRESETS.length; i++) {
      if (PRESETS[i].id === id) { setScale(PRESETS[i].scale); return; }
    }
  }

  function onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }
  function fire() {
    for (var i = 0; i < listeners.length; i++) { try { listeners[i](); } catch (e) {} }
  }

  window.JPShared.fontScale = {
    apply: apply,
    getScale: getScale,
    setScale: setScale,
    setPreset: setPreset,
    getPresetId: getPresetId,
    presets: PRESETS.slice(),
    onChange: onChange,
  };
})();

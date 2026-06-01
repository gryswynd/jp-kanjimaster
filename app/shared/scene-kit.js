// app/shared/scene-kit.js
// Shared presentational primitives for the themed module menus
// (teacher's desk / student desk / grammar garden). Registers
// `window.JPShared.sceneKit`. Stateless: deterministic per-item variety,
// a reduced-motion check, tap feedback, and an inline-SVG injection helper.
// Depends on window.JPShared.haptics (loaded just before this in index.html).
(function () {
  'use strict';

  window.JPShared = window.JPShared || {};

  // Stable string-hash → index. Same h*31+charCode algorithm as Stories'
  // colorFromId, so an id always maps to the same slot app-wide.
  function hashIndex(id, len) {
    if (!len || len < 1) return 0;
    var h = 0;
    var str = String(id == null ? '' : id);
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(h) % len;
  }

  // Deterministic pick from a passed-in array (palette, scenery set, …).
  function pick(id, arr) {
    if (!arr || !arr.length) return undefined;
    return arr[hashIndex(id, arr.length)];
  }

  // A second, independent hash channel so two attributes of the same id don't
  // correlate (e.g. lantern side vs. tilt). Vary `salt` per attribute.
  function hashIndexSalted(id, salt, len) {
    return hashIndex(String(salt) + ':' + String(id == null ? '' : id), len);
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // Haptic tick + a brief scale press on the tapped element. Preserves any
  // existing inline transform (e.g. a deterministic tilt) and restores it.
  // Idempotent and safe off-device; skips the visual press under reduced motion.
  function tapFeedback(el) {
    try { if (window.JPShared.haptics) window.JPShared.haptics.light(); } catch (e) {}
    if (!el || prefersReducedMotion()) return;
    if (el.dataset.skPressing) return;          // don't stack on rapid taps
    var base = el.style.transform || '';
    el.dataset.skBaseTransform = base;
    el.dataset.skPressing = '1';
    el.style.transition = 'transform 0.12s ease';
    el.style.transform = (base ? base + ' ' : '') + 'scale(0.97)';
    setTimeout(function () {
      el.style.transform = el.dataset.skBaseTransform || '';
      delete el.dataset.skPressing;
      delete el.dataset.skBaseTransform;
    }, 120);
  }

  // Wrap an inline-SVG string in a span for DOM insertion. Keeps SVG markup
  // out of innerHTML concatenation sites; theme via currentColor on the host.
  function svg(markup, className) {
    var span = document.createElement('span');
    if (className) span.className = className;
    span.innerHTML = markup;
    return span;
  }

  // Illustrated-art layer with graceful fallback. Returns an <img> to drop into
  // a scene element that ALSO contains a `.sk-fallback` (the code-drawn version).
  //   • on load  → parent gets `.has-art` (CSS hides .sk-fallback)
  //   • on error → parent gets `.no-art`, the <img> removes itself (fallback shows)
  // So scenes look right before any PNG exists, and auto-upgrade once it does.
  function artLayer(url, className) {
    var img = document.createElement('img');
    img.className = 'sk-art' + (className ? ' ' + className : '');
    img.alt = '';
    img.decoding = 'async';
    img.onload = function () {
      var p = img.parentElement;
      if (p) { p.classList.add('has-art'); p.classList.remove('no-art'); }
    };
    img.onerror = function () {
      var p = img.parentElement;
      if (p) p.classList.add('no-art');
      if (img.parentElement) img.parentElement.removeChild(img);
    };
    img.src = url;
    return img;
  }

  window.JPShared.sceneKit = {
    hashIndex: hashIndex,
    pick: pick,
    hashIndexSalted: hashIndexSalted,
    prefersReducedMotion: prefersReducedMotion,
    tapFeedback: tapFeedback,
    svg: svg,
    artLayer: artLayer
  };
})();

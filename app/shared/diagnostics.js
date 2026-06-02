/**
 * app/shared/diagnostics.js
 * Lightweight, always-on diagnostics for the beta:
 *   • captures the last N JS errors / unhandled rejections in a ring buffer
 *   • snapshots device + app context for bug reports
 *
 * No dependencies, no network. Pure local capture — the bug-report module
 * (app/shared/bug-report.js) reads from here when the user files a report.
 *
 * Registers window.JPShared.diagnostics. installErrorCapture() is called as
 * early as possible in boot so errors during module load are still caught.
 */
(function () {
  'use strict';
  window.JPShared = window.JPShared || {};
  if (window.JPShared.diagnostics) return;

  var MAX_ERRORS = 20;
  var errors = [];      // ring buffer of { t, kind, message, source, line, col, stack }
  var installed = false;

  function nowIso() {
    // Date is allowed at runtime in the app (this is not a workflow script).
    try { return new Date().toISOString(); } catch (e) { return ''; }
  }

  function pushError(rec) {
    rec.t = nowIso();
    errors.push(rec);
    if (errors.length > MAX_ERRORS) errors.shift();
  }

  function installErrorCapture() {
    if (installed) return;
    installed = true;
    try {
      window.addEventListener('error', function (e) {
        // Resource load errors (img/script) have no .error; still useful to log.
        pushError({
          kind: 'error',
          message: (e && e.message) || String(e && e.type || 'error'),
          source: (e && e.filename) || '',
          line: (e && e.lineno) || 0,
          col: (e && e.colno) || 0,
          stack: (e && e.error && e.error.stack) ? String(e.error.stack).slice(0, 1200) : '',
        });
      }, true);
      window.addEventListener('unhandledrejection', function (e) {
        var r = e && e.reason;
        pushError({
          kind: 'unhandledrejection',
          message: (r && r.message) ? r.message : String(r),
          source: '', line: 0, col: 0,
          stack: (r && r.stack) ? String(r.stack).slice(0, 1200) : '',
        });
      });
    } catch (e) { /* very old webview — skip */ }
  }

  // The bundled build identity (set in index.html config). Falls back gracefully.
  function version() {
    var c = (window.JPApp && window.JPApp.config) || {};
    return {
      appVersion: c.appVersion || '',
      buildNumber: typeof c.buildNumber === 'number' ? c.buildNumber : null,
    };
  }

  // Best-effort device/runtime context. All from navigator/window — no native plugin.
  function deviceInfo() {
    var nav = window.navigator || {};
    var scr = window.screen || {};
    var info = {
      userAgent: nav.userAgent || '',
      platform: nav.platform || '',
      language: nav.language || '',
      screen: (scr.width || 0) + 'x' + (scr.height || 0),
      dpr: window.devicePixelRatio || 1,
      online: ('onLine' in nav) ? nav.onLine : null,
    };
    // Capacitor native flag, if present.
    try {
      var cap = window.Capacitor;
      info.native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
      info.capPlatform = (cap && cap.getPlatform && cap.getPlatform()) || 'web';
    } catch (e) { info.native = false; info.capPlatform = 'web'; }
    return info;
  }

  // Relevant app state at report time — the toggles testers most often hit bugs in.
  function appState() {
    function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    var jp = window.JPShared && window.JPShared.jpText;
    var to = window.JPShared && window.JPShared.tutorOverlay;
    var ctx = window.JPShared && window.JPShared.tutorContext;
    var state = {
      view: (window.JPApp && window.JPApp._view) || null,
      furiganaOn: ls('k-furigana-on') === '1',
      romajiOn: ls('k-romaji-on') === '1',
      tutorEnabled: !!(to && to.isEnabled && to.isEnabled()),
      deviceId: ls('k-device-id') || null,
    };
    // Last thing the student was looking at / last tutor question, if available.
    try {
      if (ctx && ctx.get) {
        var c = ctx.get();
        state.lessonId = (c && c.lessonId) || null;
      }
    } catch (e) {}
    return state;
  }

  function recentErrors() { return errors.slice(); }

  // Full context bundle the bug-report module attaches to a submission.
  function snapshot() {
    return {
      version: version(),
      device: deviceInfo(),
      app: appState(),
      errors: recentErrors(),
      capturedAt: nowIso(),
    };
  }

  window.JPShared.diagnostics = {
    installErrorCapture: installErrorCapture,
    version: version,
    deviceInfo: deviceInfo,
    appState: appState,
    recentErrors: recentErrors,
    snapshot: snapshot,
    // Test helper — lets us verify the ring buffer without throwing for real.
    _pushError: pushError,
  };

  // Install immediately on load (this file is loaded first in boot).
  installErrorCapture();
})();

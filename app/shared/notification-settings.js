/**
 * app/shared/notification-settings.js
 * On-device local study reminders for Rikizo (replaces the old email reminder
 * system). Two namespaces:
 *
 *   window.JPShared.notifications        — headless scheduling engine. Safe to call
 *     even when the modal has never been opened (streak.js calls reschedule()).
 *   window.JPShared.notificationSettings — the settings modal (open/close), loaded
 *     on demand from the bell icon in index.html.
 *
 * Reminders are scheduled as a rolling block of HORIZON dated one-off notifications
 * (one per upcoming day, at the user's chosen time). One-offs — not a single repeating
 * notification — because the copy must escalate with how many days the user has been
 * away. The block is cancelled and rebuilt on every reschedule (on study, on app
 * resume/startup, and on settings change) so it always reflects current streak state.
 *
 * Copy is drawn from data/shared/rikizo-messages.json (same pool the companion uses),
 * bracketed by projected days-away: streakAlive → streakAtRisk → streakBroken →
 * streakGone → streakDesperate → streakAbsurd.
 *
 * localStorage keys:
 *   k-notif-enabled  — '1' | '0'  (unset = off)
 *   k-notif-hour     — 0-23        (default 19)
 *   k-notif-minute   — 0-59        (default 0)
 *
 * Depends on: window.JPShared.streak (for daysAway); Capacitor LocalNotifications
 * plugin on native (no-op in a plain browser).
 */

(function () {
  'use strict';

  window.JPShared = window.JPShared || {};

  var HORIZON = 7;     // schedule the next 7 days
  var ID_BASE = 4200;  // reserved id block 4200..4206
  var TEST_ID = 4299;  // one-off "send a test" id

  var DEFAULT_HOUR = 19;
  var DEFAULT_MIN = 0;

  // ── Capacitor access (null in a plain browser → engine methods no-op) ──
  function LN() {
    var C = window.Capacitor;
    return (C && C.Plugins && C.Plugins.LocalNotifications) || null;
  }

  // ── Preferences ──
  function isEnabled() {
    return localStorage.getItem('k-notif-enabled') === '1';
  }

  function getPrefs() {
    return {
      enabled: isEnabled(),
      hour: parseInt(localStorage.getItem('k-notif-hour') || DEFAULT_HOUR, 10),
      minute: parseInt(localStorage.getItem('k-notif-minute') || DEFAULT_MIN, 10)
    };
  }

  // ── Messages (lazy-load the shared pool if not already cached) ──
  async function ensureMessages() {
    if (window.JPShared._rikizo_messages) return;
    try {
      var res = await fetch('data/shared/rikizo-messages.json');
      window.JPShared._rikizo_messages = await res.json();
    } catch (e) { /* leave undefined; pickCopy falls back */ }
  }

  function pickCopy(daysAway) {
    var p = window.JPShared._rikizo_messages || {};
    var b;
    if (daysAway <= 1)       b = p.streakAlive;
    else if (daysAway === 2) b = p.streakAtRisk;
    else if (daysAway <= 4)  b = p.streakBroken;
    else if (daysAway <= 7)  b = p.streakGone;
    else if (daysAway <= 14) b = p.streakDesperate;
    else                     b = p.streakAbsurd;
    if (!b || !b.length) b = p.encouragement || [{ text: 'Time to train!', jp: '' }];
    return b[Math.floor(Math.random() * b.length)];
  }

  // ── Permissions (request lazily, only on user action) ──
  async function ensurePermission() {
    var ln = LN();
    if (!ln) return false;
    var s = await ln.checkPermissions();
    if (s.display === 'granted') return true;
    if (s.display === 'denied') return false; // unrecoverable except via iOS Settings
    var r = await ln.requestPermissions();
    return r.display === 'granted';
  }

  async function checkPermissionState() {
    var ln = LN();
    if (!ln) return 'unsupported';
    try {
      var s = await ln.checkPermissions();
      return s.display; // 'granted' | 'denied' | 'prompt'
    } catch (e) { return 'unsupported'; }
  }

  // ── Scheduling ──
  async function cancelAll() {
    var ln = LN();
    if (!ln) return;
    var ids = [];
    for (var i = 0; i < HORIZON; i++) ids.push({ id: ID_BASE + i });
    try { await ln.cancel({ notifications: ids }); } catch (e) { /* ignore */ }
  }

  /**
   * Rebuild the rolling reminder block. No-ops in a browser; cancels everything if
   * reminders are disabled; otherwise schedules HORIZON dated one-offs with escalating
   * copy based on projected days-away.
   */
  async function reschedule() {
    var ln = LN();
    if (!ln) return;
    if (!isEnabled()) { return cancelAll(); }
    await cancelAll();
    if (!(await ensurePermission())) {
      localStorage.setItem('k-notif-enabled', '0');
      return;
    }
    await ensureMessages();

    var prefs = getPrefs();
    var st = window.JPShared.streak ? window.JPShared.streak.getState() : { daysAway: -1 };
    var base = st.daysAway < 0 ? 0 : st.daysAway;

    var notifs = [];
    for (var i = 0; i < HORIZON; i++) {
      var at = new Date();
      at.setDate(at.getDate() + (i + 1)); // tomorrow .. +HORIZON
      at.setHours(prefs.hour, prefs.minute, 0, 0);
      var copy = pickCopy(base + (i + 1));
      notifs.push({
        id: ID_BASE + i,
        title: 'Rikizo 🦝',
        body: copy.text + (copy.jp ? '  ' + copy.jp : ''),
        schedule: { at: at, allowWhileIdle: true }
      });
    }
    try { await ln.schedule({ notifications: notifs }); } catch (e) { /* ignore */ }
  }

  async function sendTest() {
    var ln = LN();
    if (!ln) return false;
    if (!(await ensurePermission())) return false;
    await ensureMessages();
    var copy = pickCopy(1);
    try {
      await ln.schedule({
        notifications: [{
          id: TEST_ID,
          title: 'Rikizo 🦝',
          body: copy.text + (copy.jp ? '  ' + copy.jp : ''),
          schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true }
        }]
      });
      return true;
    } catch (e) { return false; }
  }

  // ── Headless engine API ──
  window.JPShared.notifications = {
    isEnabled: isEnabled,
    getPrefs: getPrefs,
    requestPermission: ensurePermission,
    reschedule: reschedule,
    cancelAll: cancelAll,
    sendTest: sendTest
  };

  // ===========================================================================
  //  Settings modal
  // ===========================================================================

  var overlay = null;
  var isOpen = false;
  var styleInjected = false;

  // Styled to match the app's redesign (washi card / ink overlay / vermilion accents,
  // mirroring .jp-return-card and .jp-rankup-* in index.html). Uses the global design
  // tokens defined on :root there (--washi, --ink, --vermilion, --font-*, --r-*).
  function injectStyles() {
    if (styleInjected) return;
    styleInjected = true;
    var style = document.createElement('style');
    style.textContent =
      '.jp-notif-overlay{position:fixed;inset:0;background:oklch(0.22 0.012 60 / 0.5);z-index:9999;' +
      'display:flex;align-items:center;justify-content:center;padding:24px;animation:jpNotifFade 0.25s ease;}' +
      '@keyframes jpNotifFade{from{opacity:0}to{opacity:1}}' +
      '@keyframes jpNotifRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}' +
      '.jp-notif-card{position:relative;background:var(--washi);border-radius:var(--r-xl);' +
      'width:100%;max-width:360px;padding:28px 24px 24px;box-shadow:0 20px 60px rgba(0,0,0,0.25);' +
      'font-family:var(--font-ui);color:var(--ink);animation:jpNotifRise 0.35s ease;}' +
      '.jp-notif-close{position:absolute;top:16px;right:16px;width:30px;height:30px;border-radius:50%;' +
      'border:1px solid var(--hairline);background:transparent;color:var(--ink-3);font-size:1.1rem;' +
      'line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;}' +
      '.jp-notif-eyebrow{font-family:var(--font-mono);font-size:0.66rem;text-transform:uppercase;' +
      'letter-spacing:0.2em;color:var(--vermilion);margin-bottom:6px;}' +
      '.jp-notif-title{font-family:var(--font-jp-display);font-size:1.5rem;font-weight:600;' +
      'line-height:1.1;margin-bottom:10px;color:var(--ink);}' +
      '.jp-notif-sub{font-size:0.88rem;color:var(--ink-2);line-height:1.55;margin:0 0 18px;}' +
      '.jp-notif-row{display:flex;align-items:center;justify-content:space-between;gap:14px;' +
      'padding:15px 0;border-bottom:1px solid var(--hairline);}' +
      '.jp-notif-row:last-of-type{border-bottom:none;}' +
      '.jp-notif-row .jp-notif-label{font-size:0.95rem;color:var(--ink);font-weight:600;}' +
      '.jp-notif-toggle{position:relative;display:inline-block;width:50px;height:30px;flex:0 0 auto;cursor:pointer;}' +
      '.jp-notif-toggle input{position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer;}' +
      '.jp-notif-slider{position:absolute;inset:0;background:var(--washi-3);border-radius:999px;' +
      'transition:0.2s;pointer-events:none;}' +
      '.jp-notif-slider:before{content:"";position:absolute;height:24px;width:24px;left:3px;top:3px;' +
      'background:#fff;border-radius:50%;transition:0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2);}' +
      '.jp-notif-toggle input:checked + .jp-notif-slider{background:var(--vermilion);}' +
      '.jp-notif-toggle input:checked + .jp-notif-slider:before{transform:translateX(20px);}' +
      '.jp-notif-time{font-family:var(--font-mono);font-size:1rem;padding:8px 12px;color:var(--ink);' +
      'background:var(--washi-2);border:1px solid var(--hairline);border-radius:var(--r-sm);outline:none;}' +
      '.jp-notif-time:focus{border-color:var(--vermilion);}' +
      '.jp-notif-test{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;' +
      'margin:20px 0 0;padding:13px;border-radius:999px;border:1px solid var(--hairline);' +
      'background:transparent;color:var(--vermilion-ink);font-size:0.92rem;font-weight:600;cursor:pointer;}' +
      '.jp-notif-test:active{background:var(--washi-2);}' +
      '.jp-notif-status{text-align:center;padding:9px 10px;border-radius:var(--r-sm);margin:14px 0 0;' +
      'font-size:0.85rem;line-height:1.4;}' +
      '.jp-notif-success{background:oklch(0.58 0.09 140 / 0.14);color:var(--moss);}' +
      '.jp-notif-error{background:oklch(0.60 0.18 30 / 0.12);color:var(--vermilion-ink);}';
    document.head.appendChild(style);
  }

  function showMsg(text, isError) {
    var el = document.getElementById('jp-notif-msg');
    if (!el) return;
    el.className = 'jp-notif-status ' + (isError ? 'jp-notif-error' : 'jp-notif-success');
    el.textContent = text;
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function buildBody() {
    var p = getPrefs();
    var timeVal = pad2(p.hour) + ':' + pad2(p.minute);
    return '<button class="jp-notif-close" id="jp-notif-close-btn" aria-label="Close">&times;</button>' +
      '<div class="jp-notif-eyebrow">リマインダー · Reminders</div>' +
      '<div class="jp-notif-title">Daily Reminders</div>' +
      '<div class="jp-notif-sub">' +
        'Rikizo will nudge you to train each day. Miss a day and his messages get ' +
        '… more dramatic. It all runs on your phone — no account needed.' +
      '</div>' +
      '<div class="jp-notif-row">' +
        '<span class="jp-notif-label">Daily reminders</span>' +
        '<label class="jp-notif-toggle">' +
          '<input type="checkbox" id="jp-notif-enabled"' + (p.enabled ? ' checked' : '') + '>' +
          '<span class="jp-notif-slider"></span>' +
        '</label>' +
      '</div>' +
      '<div class="jp-notif-row">' +
        '<label class="jp-notif-label" for="jp-notif-time">Remind me at</label>' +
        '<input type="time" id="jp-notif-time" class="jp-notif-time" value="' + timeVal + '">' +
      '</div>' +
      '<button class="jp-notif-test" id="jp-notif-test">Send a test 🔔</button>' +
      '<div id="jp-notif-msg"></div>';
  }

  function wire() {
    var toggle = document.getElementById('jp-notif-enabled');
    var time = document.getElementById('jp-notif-time');
    var testBtn = document.getElementById('jp-notif-test');
    var closeBtn = document.getElementById('jp-notif-close-btn');

    if (closeBtn) closeBtn.addEventListener('click', close);

    if (toggle) {
      toggle.addEventListener('change', async function () {
        if (toggle.checked) {
          var ok = await ensurePermission();
          if (!ok) {
            toggle.checked = false;
            var state = await checkPermissionState();
            if (state === 'unsupported') {
              showMsg('Notifications only work in the installed app.', true);
            } else {
              showMsg('Notifications are blocked. Enable them in iOS Settings → Rikizo.', true);
            }
            return;
          }
          localStorage.setItem('k-notif-enabled', '1');
          await reschedule();
          showMsg('Reminders on. Rikizo is watching. 🦝');
        } else {
          localStorage.setItem('k-notif-enabled', '0');
          await cancelAll();
          showMsg('Reminders off.');
        }
      });
    }

    if (time) {
      time.addEventListener('change', async function () {
        var parts = (time.value || '').split(':');
        if (parts.length !== 2) return;
        localStorage.setItem('k-notif-hour', parseInt(parts[0], 10) || 0);
        localStorage.setItem('k-notif-minute', parseInt(parts[1], 10) || 0);
        if (isEnabled()) {
          await reschedule();
          showMsg('Reminder time updated.');
        }
      });
    }

    if (testBtn) {
      testBtn.addEventListener('click', async function () {
        testBtn.disabled = true;
        var ok = await sendTest();
        testBtn.disabled = false;
        if (ok) showMsg('Test scheduled — leave the app and watch for it in ~5s.');
        else showMsg('Could not send a test (check notification permission).', true);
      });
    }
  }

  function open() {
    injectStyles();
    if (isOpen) return;
    isOpen = true;

    overlay = document.createElement('div');
    overlay.className = 'jp-notif-overlay';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });

    overlay.innerHTML = '<div class="jp-notif-card">' + buildBody() + '</div>';

    document.body.appendChild(overlay);
    wire();
  }

  function close() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
    isOpen = false;
  }

  window.JPShared.notificationSettings = {
    open: open,
    close: close,
    isEnabled: isEnabled
  };

})();

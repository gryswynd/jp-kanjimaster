/**
 * app/shared/bug-report.js
 * Beta "Report a bug" sheet. Opens from Settings; collects a category + optional
 * note, attaches an automatic diagnostics snapshot (build, device, screen, recent
 * JS errors, toggle states — see app/shared/diagnostics.js), and POSTs it to the
 * Cloud Run server (/v1/bug-report → Firestore bug-reports/{id}).
 *
 * No Firestore client SDK — goes through our server like every other write. Needs
 * a device id + a server base URL; if either is missing it tells the user instead
 * of failing silently. Registers window.JPShared.bugReport with open().
 */
(function () {
  'use strict';
  window.JPShared = window.JPShared || {};
  if (window.JPShared.bugReport) return;

  var CATEGORIES = [
    { id: 'chipping', label: 'Audio chipping / cutting out' },
    { id: 'audio',    label: 'Audio (wrong / missing / won’t play)' },
    { id: 'romaji',   label: 'Romaji looks wrong' },
    { id: 'furigana', label: 'Furigana looks wrong' },
    { id: 'tutor',    label: 'Rikizo AI tutor' },
    { id: 'other',    label: 'Something else' },
  ];

  function deviceId() {
    var d = window.JPShared.deviceId;
    return (d && d.get && d.get()) || null;
  }

  // Same base-url precedence as sync.js: ?tutor= / k-tutor-base-url override, then
  // config.apiBaseUrl, then tutorBaseUrl.
  function baseUrl() {
    try { var qp = new URLSearchParams(location.search).get('tutor'); if (qp) return qp; } catch (e) {}
    try { var ls = localStorage.getItem('k-tutor-base-url'); if (ls) return ls; } catch (e) {}
    var c = (window.JPApp && window.JPApp.config) || {};
    return (c.apiBaseUrl || c.tutorBaseUrl || '').replace(/\/+$/, '');
  }

  async function authHeader() {
    // Include the Firebase token if signed in, so reports can be tied to an account.
    try {
      var a = window.JPShared.auth;
      if (a && a.getIdToken) {
        var t = await a.getIdToken();
        if (t) return { Authorization: 'Bearer ' + t };
      }
    } catch (e) {}
    return {};
  }

  function injectStyles() {
    if (document.getElementById('jp-bug-style')) return;
    var s = document.createElement('style');
    s.id = 'jp-bug-style';
    s.textContent = [
      '.jp-bug-ov{position:fixed;inset:0;z-index:9999;background:rgba(20,16,12,0.42);display:flex;align-items:flex-end;justify-content:center;}',
      '.jp-bug-sheet{width:100%;max-width:460px;background:var(--washi,#f5f3f0);color:var(--ink,#2a2520);border-radius:18px 18px 0 0;padding:18px 18px calc(20px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(0,0,0,0.25);font-family:"Schibsted Grotesk","Work Sans",system-ui,sans-serif;max-height:88vh;overflow-y:auto;}',
      '.jp-bug-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;}',
      '.jp-bug-title{font-family:"Noto Serif JP",serif;font-size:1.1rem;font-weight:700;}',
      '.jp-bug-x{background:none;border:none;font-size:1.3rem;line-height:1;cursor:pointer;color:var(--ink-3,#8a8178);}',
      '.jp-bug-sub{font-size:0.82rem;color:var(--ink-3,#8a8178);margin:0 0 12px;line-height:1.45;}',
      '.jp-bug-label{font-size:0.7rem;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--ink-3,#8a8178);margin:12px 0 6px;}',
      '.jp-bug-cats{display:flex;flex-direction:column;gap:6px;}',
      '.jp-bug-cat{display:flex;align-items:center;gap:10px;padding:11px 13px;border:1.5px solid var(--hairline,rgba(40,35,30,0.14));border-radius:12px;background:#fff;cursor:pointer;font-size:0.92rem;text-align:left;color:var(--ink,#2a2520);}',
      '.jp-bug-cat.sel{border-color:var(--vermilion,#c2410c);background:oklch(0.60 0.18 30 / 0.06);}',
      '.jp-bug-cat-dot{width:14px;height:14px;border-radius:50%;border:2px solid var(--hairline,rgba(40,35,30,0.3));flex-shrink:0;}',
      '.jp-bug-cat.sel .jp-bug-cat-dot{border-color:var(--vermilion,#c2410c);background:var(--vermilion,#c2410c);}',
      '.jp-bug-note{width:100%;box-sizing:border-box;resize:vertical;min-height:70px;padding:11px 12px;border:1.5px solid var(--hairline,rgba(40,35,30,0.14));border-radius:12px;font-size:0.95rem;font-family:inherit;background:#fff;color:var(--ink,#2a2520);}',
      '.jp-bug-note:focus{outline:none;border-color:var(--vermilion,#c2410c);}',
      '.jp-bug-priv{font-size:0.72rem;color:var(--ink-3,#8a8178);margin:10px 0 0;line-height:1.45;font-style:italic;}',
      '.jp-bug-send{width:100%;margin-top:14px;padding:13px;border:none;border-radius:999px;background:var(--ink,#2a2520);color:var(--washi,#f5f3f0);font-weight:700;font-size:0.95rem;cursor:pointer;}',
      '.jp-bug-send:disabled{opacity:0.55;cursor:default;}',
      '.jp-bug-status{min-height:1.2em;margin-top:10px;font-size:0.85rem;text-align:center;}',
    ].join('');
    document.head.appendChild(s);
  }

  function open() {
    injectStyles();
    var selected = null;

    var ov = document.createElement('div');
    ov.className = 'jp-bug-ov';

    var cats = CATEGORIES.map(function (c) {
      return '<button class="jp-bug-cat" data-cat="' + c.id + '" type="button">' +
        '<span class="jp-bug-cat-dot"></span>' + c.label + '</button>';
    }).join('');

    var ver = window.JPShared.diagnostics && window.JPShared.diagnostics.version();
    var buildLabel = ver && ver.buildNumber != null ? ('Build ' + ver.buildNumber) : '';

    ov.innerHTML =
      '<div class="jp-bug-sheet" role="dialog" aria-label="Report a bug">' +
        '<div class="jp-bug-head">' +
          '<div class="jp-bug-title">Report a bug</div>' +
          '<button class="jp-bug-x" aria-label="Close">×</button>' +
        '</div>' +
        '<p class="jp-bug-sub">Tell us what went wrong. ' + (buildLabel ? buildLabel + '. ' : '') +
          'We attach a little technical info to help us fix it.</p>' +
        '<div class="jp-bug-label">What kind of problem?</div>' +
        '<div class="jp-bug-cats">' + cats + '</div>' +
        '<div class="jp-bug-label">Anything to add? (optional)</div>' +
        '<textarea class="jp-bug-note" maxlength="2000" placeholder="What were you doing when it happened?"></textarea>' +
        '<p class="jp-bug-priv">We include your app build, device type, the screen you were on, and recent error logs. No lesson content or personal messages.</p>' +
        '<button class="jp-bug-send" type="button" disabled>Send report</button>' +
        '<div class="jp-bug-status"></div>' +
      '</div>';
    document.body.appendChild(ov);

    var sheet = ov.querySelector('.jp-bug-sheet');
    var sendBtn = ov.querySelector('.jp-bug-send');
    var noteEl = ov.querySelector('.jp-bug-note');
    var statusEl = ov.querySelector('.jp-bug-status');

    function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
    function say(msg, color) { statusEl.textContent = msg; statusEl.style.color = color || ''; }

    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('.jp-bug-x').addEventListener('click', close);

    sheet.querySelectorAll('.jp-bug-cat').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selected = btn.getAttribute('data-cat');
        sheet.querySelectorAll('.jp-bug-cat').forEach(function (b) { b.classList.remove('sel'); });
        btn.classList.add('sel');
        sendBtn.disabled = false;
      });
    });

    sendBtn.addEventListener('click', function () {
      if (!selected) return;
      var url = baseUrl();
      var dev = deviceId();
      if (!url) { say('Can’t reach the server from this build.', 'var(--vermilion,#c2410c)'); return; }
      if (!dev) { say('No device id — restart the app and try again.', 'var(--vermilion,#c2410c)'); return; }

      sendBtn.disabled = true;
      say('Sending…');

      var context = window.JPShared.diagnostics ? window.JPShared.diagnostics.snapshot() : {};
      var payload = { category: selected, note: (noteEl.value || '').trim(), context: context };

      authHeader().then(function (extra) {
        var headers = Object.assign({ 'Content-Type': 'application/json', 'X-Device-Id': dev }, extra);
        return fetch(url + '/v1/bug-report', {
          method: 'POST', headers: headers, body: JSON.stringify(payload),
        });
      }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        say('✓ Thank you — report sent.', 'var(--moss,#5f8a4e)');
        setTimeout(close, 1100);
      }).catch(function (e) {
        sendBtn.disabled = false;
        say('Couldn’t send (' + (e && e.message ? e.message : 'offline') + '). Try again on wifi.', 'var(--vermilion,#c2410c)');
      });
    });
  }

  window.JPShared.bugReport = { open: open };
})();

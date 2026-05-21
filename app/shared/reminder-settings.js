/**
 * app/shared/reminder-settings.js
 * Self-service opt-in for Rikizo's daily email reminders.
 * Loaded on demand from webflow-embed.html (same pattern as tts-settings.js).
 *
 * localStorage keys:
 *   k-reminder-student-id  — string  server-assigned student ID
 *   k-reminder-token       — string  HMAC token for settings/unsubscribe
 *   k-reminder-email       — string  registered email (display only)
 *   k-reminder-name        — string  registered name (display only)
 *
 * Depends on: nothing (standalone module)
 */

(function () {
  'use strict';

  window.JPShared = window.JPShared || {};

  // ── Worker URL — replace after deploying ──
  var WORKER_URL = 'https://rikizo-reminders.gryswynd.workers.dev';

  var overlay = null;
  var isOpen = false;

  // --- Inject styles once ---
  var styleInjected = false;
  function injectStyles() {
    if (styleInjected) return;
    styleInjected = true;
    var style = document.createElement('style');
    style.textContent =
      '.jp-remind-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;' +
      'display:flex;align-items:center;justify-content:center;animation:jpRemindFade 0.2s ease;}' +
      '@keyframes jpRemindFade{from{opacity:0}to{opacity:1}}' +
      '.jp-remind-modal{background:white;border-radius:16px;width:90%;max-width:400px;' +
      'box-shadow:0 20px 60px rgba(0,0,0,0.3);font-family:"Poppins",system-ui,sans-serif;overflow:hidden;}' +
      '.jp-remind-header{background:linear-gradient(135deg,#4e54c8,#8f94fb);color:white;' +
      'padding:18px 20px;display:flex;align-items:center;justify-content:space-between;}' +
      '.jp-remind-header h3{margin:0;font-size:1.05rem;font-weight:800;}' +
      '.jp-remind-close{background:rgba(255,255,255,0.2);border:none;color:white;' +
      'width:32px;height:32px;border-radius:50%;font-size:1.1rem;cursor:pointer;}' +
      '.jp-remind-body{padding:20px;}' +
      '.jp-remind-field{margin:0 0 14px;}' +
      '.jp-remind-field label{display:block;font-size:0.85rem;color:#555;font-weight:600;margin:0 0 4px;}' +
      '.jp-remind-field input{width:100%;padding:10px 12px;border:2px solid #e0e0e0;border-radius:10px;' +
      'font-size:0.95rem;box-sizing:border-box;outline:none;transition:border-color 0.2s;}' +
      '.jp-remind-field input:focus{border-color:#4e54c8;}' +
      '.jp-remind-btn{display:block;width:100%;padding:12px;border:none;border-radius:10px;' +
      'font-size:1rem;font-weight:700;cursor:pointer;margin:6px 0;}' +
      '.jp-remind-btn-primary{background:#4e54c8;color:white;}' +
      '.jp-remind-btn-danger{background:#f5f5f5;color:#e53935;font-weight:600;font-size:0.9rem;}' +
      '.jp-remind-status{text-align:center;padding:8px;border-radius:8px;margin:10px 0;font-size:0.9rem;}' +
      '.jp-remind-success{background:#e8f5e9;color:#2e7d32;}' +
      '.jp-remind-error{background:#ffebee;color:#c62828;}' +
      '.jp-remind-info{background:#f3f0ff;border-radius:12px;padding:14px;margin:0 0 16px;' +
      'font-size:0.85rem;color:#555;line-height:1.5;}';
    document.head.appendChild(style);
  }

  // --- Check registration state ---
  function isRegistered() {
    return !!localStorage.getItem('k-reminder-student-id');
  }

  function getStoredInfo() {
    return {
      studentId: localStorage.getItem('k-reminder-student-id'),
      token: localStorage.getItem('k-reminder-token'),
      email: localStorage.getItem('k-reminder-email'),
      name: localStorage.getItem('k-reminder-name')
    };
  }

  function clearStored() {
    localStorage.removeItem('k-reminder-student-id');
    localStorage.removeItem('k-reminder-token');
    localStorage.removeItem('k-reminder-email');
    localStorage.removeItem('k-reminder-name');
  }

  // --- Build the modal HTML ---
  function buildRegistrationForm() {
    return '<div class="jp-remind-info">' +
      '<strong>🦝 Rikizo\'s Daily Reminders</strong><br>' +
      'Get a daily email from Rikizo if you miss a day of training. ' +
      'Messages escalate the longer you\'re away — anime-style drama guaranteed.' +
      '</div>' +
      '<div class="jp-remind-field">' +
        '<label>Your Name</label>' +
        '<input type="text" id="jp-remind-name" placeholder="e.g. Yuki" autocomplete="given-name">' +
      '</div>' +
      '<div class="jp-remind-field">' +
        '<label>Email Address</label>' +
        '<input type="email" id="jp-remind-email" placeholder="you@example.com" autocomplete="email">' +
      '</div>' +
      '<button class="jp-remind-btn jp-remind-btn-primary" id="jp-remind-submit">Sign Me Up 🔥</button>' +
      '<div id="jp-remind-msg"></div>';
  }

  function buildSettingsView(info) {
    return '<div class="jp-remind-info">' +
      '✅ You\'re signed up for daily reminders!<br>' +
      'If you miss a day, Rikizo will email you at <strong>' + escapeHtml(info.email) + '</strong>.' +
      '</div>' +
      '<div class="jp-remind-field">' +
        '<label>Name</label>' +
        '<input type="text" id="jp-remind-name" value="' + escapeHtml(info.name) + '">' +
      '</div>' +
      '<div class="jp-remind-field">' +
        '<label>Email</label>' +
        '<input type="email" id="jp-remind-email" value="' + escapeHtml(info.email) + '">' +
      '</div>' +
      '<button class="jp-remind-btn jp-remind-btn-primary" id="jp-remind-update">Update Details</button>' +
      '<button class="jp-remind-btn jp-remind-btn-danger" id="jp-remind-unsub">Stop Reminders</button>' +
      '<div id="jp-remind-msg"></div>';
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function showMsg(text, isError) {
    var el = document.getElementById('jp-remind-msg');
    if (!el) return;
    el.className = 'jp-remind-status ' + (isError ? 'jp-remind-error' : 'jp-remind-success');
    el.textContent = text;
  }

  // --- API calls ---
  async function registerStudent(name, email) {
    var info = getStoredInfo();
    var res = await fetch(WORKER_URL + '/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        email: email,
        studentId: info.studentId || undefined
      })
    });

    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      throw new Error(err.error || 'Registration failed');
    }

    var data = await res.json();
    localStorage.setItem('k-reminder-student-id', data.studentId);
    localStorage.setItem('k-reminder-token', data.token);
    localStorage.setItem('k-reminder-email', email);
    localStorage.setItem('k-reminder-name', name);
    return data;
  }

  // --- Event wiring ---
  function wireRegistration() {
    var btn = document.getElementById('jp-remind-submit');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      var name = (document.getElementById('jp-remind-name').value || '').trim();
      var email = (document.getElementById('jp-remind-email').value || '').trim();
      if (!name) { showMsg('Please enter your name.', true); return; }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showMsg('Please enter a valid email.', true); return; }

      btn.disabled = true;
      btn.textContent = 'Signing up...';
      try {
        await registerStudent(name, email);
        showMsg('You\'re in! Rikizo will keep an eye on you. 🦝');
        // Refresh to settings view after a moment
        setTimeout(function () { refreshBody(); }, 1500);
      } catch (e) {
        showMsg(e.message || 'Something went wrong. Try again.', true);
        btn.disabled = false;
        btn.textContent = 'Sign Me Up 🔥';
      }
    });
  }

  function wireSettings() {
    var updateBtn = document.getElementById('jp-remind-update');
    var unsubBtn = document.getElementById('jp-remind-unsub');

    if (updateBtn) {
      updateBtn.addEventListener('click', async function () {
        var name = (document.getElementById('jp-remind-name').value || '').trim();
        var email = (document.getElementById('jp-remind-email').value || '').trim();
        if (!name) { showMsg('Please enter your name.', true); return; }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showMsg('Please enter a valid email.', true); return; }

        updateBtn.disabled = true;
        updateBtn.textContent = 'Updating...';
        try {
          await registerStudent(name, email);
          showMsg('Details updated!');
          updateBtn.disabled = false;
          updateBtn.textContent = 'Update Details';
        } catch (e) {
          showMsg(e.message || 'Update failed. Try again.', true);
          updateBtn.disabled = false;
          updateBtn.textContent = 'Update Details';
        }
      });
    }

    if (unsubBtn) {
      unsubBtn.addEventListener('click', function () {
        if (!confirm('Stop receiving daily reminders from Rikizo?')) return;
        clearStored();
        showMsg('Reminders stopped. You can sign up again anytime.');
        setTimeout(function () { refreshBody(); }, 1500);
      });
    }
  }

  function refreshBody() {
    var body = overlay && overlay.querySelector('.jp-remind-body');
    if (!body) return;
    if (isRegistered()) {
      body.innerHTML = buildSettingsView(getStoredInfo());
      wireSettings();
    } else {
      body.innerHTML = buildRegistrationForm();
      wireRegistration();
    }
  }

  // --- Open / close ---
  function open() {
    injectStyles();
    if (isOpen) return;
    isOpen = true;

    overlay = document.createElement('div');
    overlay.className = 'jp-remind-overlay';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });

    var bodyHtml = isRegistered()
      ? buildSettingsView(getStoredInfo())
      : buildRegistrationForm();

    overlay.innerHTML =
      '<div class="jp-remind-modal">' +
        '<div class="jp-remind-header">' +
          '<h3>📧 Daily Reminders</h3>' +
          '<button class="jp-remind-close" id="jp-remind-close-btn">&times;</button>' +
        '</div>' +
        '<div class="jp-remind-body">' + bodyHtml + '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    document.getElementById('jp-remind-close-btn').addEventListener('click', close);

    if (isRegistered()) wireSettings();
    else wireRegistration();
  }

  function close() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
    isOpen = false;
  }

  // --- Public API ---
  window.JPShared.reminderSettings = {
    open: open,
    close: close,
    isRegistered: isRegistered,
    getStudentId: function () { return localStorage.getItem('k-reminder-student-id'); },
    WORKER_URL: WORKER_URL
  };

})();

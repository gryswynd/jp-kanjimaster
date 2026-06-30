/**
 * Friends.js
 * Friends screen (launch key 'friends'): shows your shareable friend code, lets
 * you add a friend by their code, and lists your friends with a coarse progress
 * summary (level / lessons done / streak). Codes only — mutual, minor-safe.
 * Registers window.FriendsModule.
 */
window.FriendsModule = (function () {
  'use strict';

  var container, config, onExit;

  function sg() { return window.JPShared && window.JPShared.storyGen; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fmtCode(c) { c = String(c || ''); return c.length === 6 ? c.slice(0, 3) + '-' + c.slice(3) : c; }

  function styles() {
    if (document.getElementById('fr-style')) return;
    var s = document.createElement('style'); s.id = 'fr-style';
    s.textContent = [
      '.fr{max-width:560px;margin:0 auto;padding:18px 16px calc(28px + env(safe-area-inset-bottom));font-family:"Schibsted Grotesk","Work Sans",system-ui,sans-serif;color:var(--ink,#323029);}',
      '.fr h1{font-family:"Noto Serif JP",serif;font-size:1.4rem;margin:6px 0 2px;}',
      '.fr .sub{color:var(--ink-3,#8b8480);font-size:.85rem;margin:0 0 16px;}',
      '.fr .sec{font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3,#8b8480);margin:20px 0 8px;}',
      '.fr-card{background:#fff;border:1px solid var(--hairline,rgba(0,0,0,.14));border-radius:14px;padding:16px;}',
      '.fr-code{font-family:"Noto Serif JP",serif;font-size:1.8rem;font-weight:700;letter-spacing:.12em;text-align:center;margin:4px 0;}',
      '.fr-row{display:flex;gap:8px;align-items:center;}',
      '.fr-input{flex:1;box-sizing:border-box;padding:11px 12px;border:1px solid var(--hairline,rgba(0,0,0,.16));border-radius:10px;font-size:1rem;text-transform:uppercase;background:#fff;color:var(--ink,#323029);}',
      '.fr-btn{padding:11px 16px;border-radius:999px;border:none;background:var(--ink,#323029);color:var(--washi,#f5f3f0);font:inherit;font-weight:700;cursor:pointer;}',
      '.fr-btn.ghost{background:transparent;border:1px solid var(--hairline,rgba(0,0,0,.16));color:var(--ink-2,#5d5852);}',
      '.fr-friend{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border:1px solid var(--hairline,rgba(0,0,0,.1));border-radius:12px;margin-bottom:8px;background:#fff;}',
      '.fr-fname{font-weight:700;}',
      '.fr-fstats{font-size:.8rem;color:var(--ink-3,#8b8480);}',
      '.fr-x{background:none;border:none;color:var(--ink-3,#8b8480);font-size:1.1rem;cursor:pointer;padding:4px 8px;}',
      '.fr-back{background:none;border:none;font:inherit;color:var(--ink-3,#8b8480);cursor:pointer;padding:0;margin-bottom:8px;}',
      '.fr-err{color:var(--vermilion,#c0392b);font-size:.85rem;min-height:1em;margin-top:8px;}',
      '.fr-muted{color:var(--ink-3,#8b8480);font-size:.9rem;}',
    ].join('');
    document.head.appendChild(s);
  }

  function err(m) { var e = container.querySelector('#fr-err'); if (e) e.textContent = m || ''; }

  function friendRow(f) {
    return '<div class="fr-friend"><div><div class="fr-fname">' + esc(f.name || 'Friend') + '</div>' +
      '<div class="fr-fstats">' + esc(f.level || '') + ' · ' + (f.lessonsCompleted || 0) + ' lessons · 🔥 ' + (f.streak || 0) + '</div></div>' +
      '<button class="fr-x" data-uid="' + esc(f.uid) + '" aria-label="Remove">×</button></div>';
  }

  async function render() {
    container.innerHTML = '<div class="fr"><button class="fr-back">← Back</button><h1>Friends</h1>' +
      '<p class="sub">Add friends by code and cheer each other on.</p><div class="fr-muted">Loading…</div></div>';
    container.querySelector('.fr-back').onclick = function () { if (onExit) onExit(); };

    var s = sg();
    if (!s || !s.isConfigured() || !s.isSignedIn()) {
      container.querySelector('.fr-muted').outerHTML = '<div class="fr-card">Sign in to use friends.</div>';
      var a = window.JPShared && window.JPShared.auth;
      if (a && a.openAccountUI) a.openAccountUI();
      return;
    }

    var code = '', friends = [];
    try { code = (await s.myFriendCode()).code || ''; } catch (e) {}
    try { friends = (await s.listFriends()).friends || []; } catch (e) {}

    var html = '<div class="fr"><button class="fr-back">← Back</button><h1>Friends</h1>' +
      '<p class="sub">Add friends by code and cheer each other on.</p>' +
      '<div class="sec">Your code</div>' +
      '<div class="fr-card"><div class="fr-code">' + esc(fmtCode(code)) + '</div>' +
      '<div class="fr-row" style="margin-top:8px"><button class="fr-btn ghost" id="fr-share" style="flex:1">Share my code</button></div></div>' +
      '<div class="sec">Add a friend</div>' +
      '<div class="fr-row"><input class="fr-input" id="fr-code-in" maxlength="7" placeholder="ABC-123" autocapitalize="characters"><button class="fr-btn" id="fr-add">Add</button></div>' +
      '<div class="fr-err" id="fr-err"></div>' +
      '<div class="sec">Your friends' + (friends.length ? ' (' + friends.length + ')' : '') + '</div>' +
      (friends.length ? friends.map(friendRow).join('') : '<div class="fr-muted">No friends yet — share your code above.</div>') +
      '</div>';
    container.innerHTML = html;

    container.querySelector('.fr-back').onclick = function () { if (onExit) onExit(); };
    container.querySelector('#fr-share').onclick = function () { shareCode(code); };
    container.querySelector('#fr-add').onclick = onAdd;
    container.querySelectorAll('.fr-x').forEach(function (b) {
      b.onclick = function () { onRemove(b.getAttribute('data-uid')); };
    });
  }

  function shareCode(code) {
    var text = 'Add me on Rikizo! My friend code is ' + fmtCode(code);
    try {
      var Share = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
      if (Share && Share.share) { Share.share({ text: text }); return; }
      if (navigator.share) { navigator.share({ text: text }); return; }
      if (navigator.clipboard) { navigator.clipboard.writeText(fmtCode(code)); err('Code copied!'); }
    } catch (e) {}
  }

  async function onAdd() {
    err('');
    var raw = (container.querySelector('#fr-code-in') || {}).value || '';
    var code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 4) { err('Enter your friend’s code.'); return; }
    try {
      await sg().addFriend(code);
      render();
    } catch (e) {
      if (e && e.code === 'code_not_found') err('No one found with that code.');
      else if (e && e.code === 'cannot_friend_self') err('That’s your own code!');
      else err('Could not add friend: ' + ((e && e.message) || 'error'));
    }
  }

  async function onRemove(uid) {
    try { await sg().removeFriend(uid); render(); } catch (e) { err('Could not remove.'); }
  }

  function start(containerElement, repoConfig, exitCallback) {
    container = containerElement; config = repoConfig; onExit = exitCallback;
    styles();
    render();
  }

  return { start: start };
})();

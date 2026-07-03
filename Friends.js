/**
 * Friends.js
 * Friends screen (launch key 'friends'): your shareable friend code, add-by-code,
 * and the DOJO ROSTER — you + your friends ranked by keiko earned this week,
 * with belts, streaks, lessons, and stamp counts. Tap a row for the detail
 * card (belt, streaks, path progress, this-week activity; remove lives there).
 * Codes only — mutual, minor-safe. Registers window.FriendsModule.
 *
 * Friend stats come from the enriched story-gen friendSummary (which reads the
 * synced users/{uid} progress doc); the self row is built from localStorage so
 * it needs no network. Ranking metric = weekKeiko.earned when its weekStart
 * matches the VIEWER's current week (stale/missing → 0, shown as —).
 */
window.FriendsModule = (function () {
  'use strict';

  var container, config, onExit;

  function sg() { return window.JPShared && window.JPShared.storyGen; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fmtCode(c) { c = String(c || ''); return c.length === 6 ? c.slice(0, 3) + '-' + c.slice(3) : c; }
  function readMap(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { return {}; }
  }

  var BELT_FILES = {
    beginner: 'belt-white.png', daily: 'belt-yellow.png', week: 'belt-green.png',
    fortnight: 'belt-blue.png', month: 'belt-purple.png', season: 'belt-brown.png', legend: 'belt-black.png'
  };

  function beltImg(streakDays, px) {
    var stApi = window.JPShared && window.JPShared.streak;
    if (!stApi) return '';
    var stage = stApi.getStage(streakDays || 0);
    var file = BELT_FILES[stage.key] || 'belt-white.png';
    var url = window.getAssetUrl ? window.getAssetUrl(config, 'assets/ui/' + file) : 'assets/ui/' + file;
    return '<img src="' + esc(url) + '" alt="' + esc(stage.en) + '" style="width:' + px + 'px;height:auto;flex-shrink:0;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.18));">';
  }

  function stageOf(streakDays) {
    var stApi = window.JPShared && window.JPShared.streak;
    return stApi ? stApi.getStage(streakDays || 0) : { en: '', jp: '' };
  }

  function styles() {
    if (document.getElementById('fr-style-v2')) return;
    var old = document.getElementById('fr-style'); if (old) old.remove();
    var s = document.createElement('style'); s.id = 'fr-style-v2';
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
      '.fr-back{background:none;border:none;font:inherit;color:var(--ink-3,#8b8480);cursor:pointer;padding:0;margin-bottom:8px;}',
      '.fr-err{color:var(--vermilion,#c0392b);font-size:.85rem;min-height:1em;margin-top:8px;}',
      '.fr-muted{color:var(--ink-3,#8b8480);font-size:.9rem;}',
      // roster
      '.fr-roster{border:1px solid var(--hairline,rgba(0,0,0,.1));border-radius:14px;background:#fff;overflow:hidden;}',
      '.fr-rrow{display:flex;align-items:center;gap:12px;width:100%;padding:12px 14px;background:transparent;border:none;border-top:1px solid var(--hairline,rgba(0,0,0,.07));font:inherit;color:inherit;text-align:left;cursor:pointer;}',
      '.fr-rrow:first-child{border-top:none;}',
      '.fr-rrow:active{background:var(--washi-2,#f2ecde);}',
      '.fr-rank{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:.8rem;color:var(--ink-3,#8b8480);width:18px;text-align:center;flex-shrink:0;}',
      '.fr-rname{font-weight:700;display:flex;align-items:center;gap:6px;min-width:0;}',
      '.fr-you{font-size:.62rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:var(--washi-2,#f2ecde);border:1px solid var(--hairline,rgba(0,0,0,.12));border-radius:999px;padding:1px 7px;color:var(--ink-3,#8b8480);}',
      '.fr-fstats{font-size:.76rem;color:var(--ink-3,#8b8480);margin-top:2px;}',
      '.fr-week{font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:700;font-size:.95rem;text-align:right;flex-shrink:0;}',
      '.fr-week .u{display:block;font-size:.58rem;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3,#8b8480);}',
    ].join('');
    document.head.appendChild(s);
  }

  function err(m) { var e = container.querySelector('#fr-err'); if (e) e.textContent = m || ''; }

  // ── Roster data ───────────────────────────────────────────────────────────

  function currentWeekStart() {
    var k = window.JPShared && window.JPShared.keiko;
    if (k && k.getWeekly) return k.getWeekly().weekStart;
    var d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toLocaleDateString('en-CA');
  }

  // The viewer's own entry, built purely from localStorage (same fields the
  // server derives for friends from the synced doc).
  function selfEntry() {
    var S = window.JPShared || {};
    var st = S.streak ? S.streak.getState() : { current: 0, best: 0, lastActive: '' };
    var completed = readMap('k-lesson-completed');
    var lessonIds = Object.keys(completed).filter(function (id) { return completed[id]; });
    var rank = function (id) { var m = /^N([345])\.(\d+)$/.exec(id); return m ? (5 - +m[1]) * 1000 + +m[2] : -1; };
    var furthest = '', best = -1;
    lessonIds.forEach(function (id) { if (rank(id) > best) { best = rank(id); furthest = id; } });
    var srsItems = readMap('k-srs-items');
    var weekly = S.keiko && S.keiko.getWeekly ? S.keiko.getWeekly() : { weekStart: currentWeekStart(), earned: 0 };
    return {
      uid: '__self__',
      isSelf: true,
      name: (S.userProfile && S.userProfile.getFirst()) || 'You',
      level: /^N4\./.test(furthest) ? 'N4' : 'N5',
      lessonsCompleted: lessonIds.length,
      streak: st.current || 0,
      streakBest: st.best || 0,
      lastActive: st.lastActive || '',
      weekKeiko: { weekStart: weekly.weekStart, earned: weekly.earned },
      achievementCount: S.achievements ? S.achievements.earnedCount() : 0,
      masteredCount: Object.keys(srsItems).filter(function (k) { return srsItems[k] && srsItems[k].r === 5; }).length
    };
  }

  function effectiveWeek(entry, weekStart) {
    var w = entry.weekKeiko;
    return (w && w.weekStart === weekStart) ? (+w.earned || 0) : 0;
  }

  function rosterRow(entry, rank, weekStart) {
    var week = effectiveWeek(entry, weekStart);
    return '<button class="fr-rrow" data-uid="' + esc(entry.uid) + '">' +
      '<div class="fr-rank">' + rank + '</div>' +
      beltImg(entry.streak, 22) +
      '<div style="flex:1;min-width:0;">' +
        '<div class="fr-rname">' + esc(entry.name || 'Friend') + (entry.isSelf ? '<span class="fr-you">you</span>' : '') + '</div>' +
        '<div class="fr-fstats">🔥 ' + (entry.streak || 0) + ' · ' + (entry.lessonsCompleted || 0) + ' lessons · 🏆 ' + (entry.achievementCount || 0) + '</div>' +
      '</div>' +
      '<div class="fr-week">' + (week > 0 ? week : '—') + '<span class="u">文 this week</span></div>' +
    '</button>';
  }

  function showDetail(entry, weekStart) {
    var week = effectiveWeek(entry, weekStart);
    var stage = stageOf(entry.streak);
    var activity = week > 0
      ? '<div style="font-size:0.95rem;font-weight:700;color:var(--vermilion,#c0392b);">' + week + ' 文 earned this week</div>'
      : '<div style="font-size:0.9rem;color:var(--ink-3,#8b8480);">No training yet this week' +
        (entry.lastActive ? '<br><span style="font-size:0.78rem;">Last trained ' + esc(entry.lastActive) + '</span>' : '') + '</div>';
    var removeBtn = entry.isSelf ? '' :
      '<button id="fr-detail-remove" style="background:none;border:none;color:var(--ink-3,#8b8480);font-size:0.8rem;cursor:pointer;margin-top:12px;text-decoration:underline;">Remove friend</button>';

    var overlay = document.createElement('div');
    overlay.className = 'jp-return-overlay';
    overlay.innerHTML =
      '<div class="jp-return-card">' +
        beltImg(entry.streak, 90) +
        '<div style="font-size:1.15rem;font-weight:700;margin-top:8px;">' + esc(entry.name || 'Friend') + (entry.isSelf ? ' <span class="fr-you">you</span>' : '') + '</div>' +
        '<div style="font-size:0.8rem;color:var(--ink-3,#8b8480);margin-bottom:12px;">' + esc(stage.en) + ' · ' + esc(stage.jp) + '</div>' +
        '<div style="display:flex;justify-content:center;gap:18px;margin-bottom:12px;">' +
          '<div><div style="font-size:1.1rem;font-weight:700;">🔥 ' + (entry.streak || 0) + '</div><div style="font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--ink-3,#8b8480);">streak</div></div>' +
          '<div><div style="font-size:1.1rem;font-weight:700;">' + (entry.streakBest || 0) + '</div><div style="font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--ink-3,#8b8480);">best</div></div>' +
          '<div><div style="font-size:1.1rem;font-weight:700;">' + (entry.masteredCount || 0) + '</div><div style="font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--ink-3,#8b8480);">mastered</div></div>' +
        '</div>' +
        '<div style="font-size:0.88rem;color:var(--ink-2,#5d5852);margin-bottom:10px;">' + esc(entry.level || 'N5') + ' path · ' + (entry.lessonsCompleted || 0) + ' lessons done · 🏆 ' + (entry.achievementCount || 0) + ' stamps</div>' +
        activity +
        removeBtn +
        '<div><button onclick="this.closest(\'.jp-return-overlay\').remove()" style="margin-top:14px;background:var(--ink,#323029);color:var(--washi,#f5f3f0);border:none;padding:9px 26px;border-radius:999px;font-size:0.95rem;font-weight:600;cursor:pointer;">Close</button></div>' +
      '</div>';
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    var rm = overlay.querySelector('#fr-detail-remove');
    if (rm) rm.onclick = function () {
      if (rm.dataset.confirm !== '1') { rm.dataset.confirm = '1'; rm.textContent = 'Tap again to confirm removal'; return; }
      overlay.remove();
      onRemove(entry.uid);
    };
  }

  // ── Screens ───────────────────────────────────────────────────────────────

  async function render() {
    container.innerHTML = '<div class="fr"><button class="fr-back">← Back</button><h1>Friends</h1>' +
      '<p class="sub">Add friends by code and train together.</p><div class="fr-muted">Loading…</div></div>';
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

    var weekStart = currentWeekStart();
    var roster = [selfEntry()].concat(friends);
    roster.sort(function (a, b) {
      var wa = effectiveWeek(a, weekStart), wb = effectiveWeek(b, weekStart);
      if (wb !== wa) return wb - wa;
      if ((b.streak || 0) !== (a.streak || 0)) return (b.streak || 0) - (a.streak || 0);
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

    var html = '<div class="fr"><button class="fr-back">← Back</button><h1>Friends</h1>' +
      '<p class="sub">Add friends by code and train together.</p>' +
      '<div class="sec">どうじょう · Dojo roster' + (friends.length ? '' : '') + '</div>' +
      '<div class="fr-roster">' + roster.map(function (e, i) { return rosterRow(e, i + 1, weekStart); }).join('') + '</div>' +
      (friends.length ? '' : '<div class="fr-muted" style="margin-top:8px;">Just you so far — share your code below to fill the roster.</div>') +
      '<div class="sec">Your code</div>' +
      '<div class="fr-card"><div class="fr-code">' + esc(fmtCode(code)) + '</div>' +
      '<div class="fr-row" style="margin-top:8px"><button class="fr-btn ghost" id="fr-share" style="flex:1">Share my code</button></div></div>' +
      '<div class="sec">Add a friend</div>' +
      '<div class="fr-row"><input class="fr-input" id="fr-code-in" maxlength="7" placeholder="ABC-123" autocapitalize="characters"><button class="fr-btn" id="fr-add">Add</button></div>' +
      '<div class="fr-err" id="fr-err"></div>' +
      '</div>';
    container.innerHTML = html;

    container.querySelector('.fr-back').onclick = function () { if (onExit) onExit(); };
    container.querySelector('#fr-share').onclick = function () { shareCode(code); };
    container.querySelector('#fr-add').onclick = onAdd;
    container.querySelectorAll('.fr-rrow').forEach(function (b) {
      b.onclick = function () {
        var uid = b.getAttribute('data-uid');
        var entry = roster.find(function (e) { return e.uid === uid; });
        if (entry) showDetail(entry, weekStart);
      };
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

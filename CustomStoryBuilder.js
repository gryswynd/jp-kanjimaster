/**
 * CustomStoryBuilder.js
 * The custom-story builder: pick cast / theme(s) / focus / length, submit to the
 * rikizo-story-gen service with the learner's gates, show a "still building"
 * state while it polls, then cache the finished story locally and open it in the
 * Stories reader. Registers window.CustomStoryBuilderModule (launch key 'build').
 */
window.CustomStoryBuilderModule = (function () {
  'use strict';

  var THEMES = ['Mystery', 'Comedy', 'Slice of life', 'Adventure', 'Friendship', 'Fantasy', 'School', 'Food', 'Travel'];
  var LENGTHS = [{ label: 'Short', n: 6 }, { label: 'Medium', n: 9 }, { label: 'Long', n: 12 }];

  var container, config, onExit;
  var selCast = {}, selThemes = {}, selLen = 6, useFlags = true;
  var pollTimer = null;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function parseObj(k) { try { return JSON.parse(lsGet(k) || '{}') || {}; } catch (e) { return {}; } }
  function sg() { return window.JPShared && window.JPShared.storyGen; }

  // Derive the learner's current gates from local progress.
  function deriveGates() {
    var completed = parseObj('k-lesson-completed');
    var rank = function (id) { var m = /^N([345])\.(\d+)$/.exec(id); return m ? (5 - +m[1]) * 1000 + +m[2] : -1; };
    var furthest = '', best = -1;
    Object.keys(completed).forEach(function (id) { if (completed[id] && rank(id) > best) { best = rank(id); furthest = id; } });
    var level = furthest ? (/^N4\./.test(furthest) ? 'N4' : 'N5') : (lsGet('k-n4-unlocked') === 'true' ? 'N4' : 'N5');
    // Furthest grammar point completed (G1..Gn).
    var gnum = 0;
    Object.keys(completed).forEach(function (id) { var m = /^G(\d+)$/.exec(id); if (m && completed[id]) gnum = Math.max(gnum, +m[1]); });
    return { level: level, furthestLesson: furthest || null, grammarGate: gnum ? ('G' + gnum) : 'G1' };
  }

  // Flagged surfaces the learner is practicing (skip term-ids; keep Japanese).
  function flaggedSurfaces() {
    var active = parseObj('k-active-flags');
    var out = [];
    Object.keys(active).forEach(function (k) {
      if (!active[k]) return;
      if (/^(v_|g_|p_|char_|count_)/.test(k)) return;      // a term-id, not a surface
      if (/[぀-ヿ一-鿿ー]/.test(k)) out.push(k);
    });
    return out.slice(0, 40);
  }

  function chip(label, on) {
    return '<button class="csb-chip' + (on ? ' on' : '') + '">' + esc(label) + '</button>';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function styles() {
    if (document.getElementById('csb-style')) return;
    var s = document.createElement('style'); s.id = 'csb-style';
    s.textContent = [
      '.csb{max-width:560px;margin:0 auto;padding:18px 16px calc(24px + env(safe-area-inset-bottom));font-family:"Schibsted Grotesk","Work Sans",system-ui,sans-serif;color:var(--ink,#323029);}',
      '.csb h1{font-family:"Noto Serif JP",serif;font-size:1.4rem;margin:6px 0 2px;}',
      '.csb .sub{color:var(--ink-3,#8b8480);font-size:.85rem;margin:0 0 16px;}',
      '.csb .sec{font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3,#8b8480);margin:18px 0 8px;}',
      '.csb-chips{display:flex;flex-wrap:wrap;gap:8px;}',
      '.csb-chip{padding:9px 13px;border-radius:999px;border:1px solid var(--hairline,rgba(0,0,0,.16));background:#fff;color:var(--ink-2,#5d5852);font:inherit;font-size:.9rem;cursor:pointer;}',
      '.csb-chip.on{background:var(--ink,#323029);color:var(--washi,#f5f3f0);border-color:var(--ink,#323029);}',
      '.csb-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;}',
      '.csb-btn{display:block;width:100%;margin-top:22px;padding:14px;border-radius:999px;border:none;background:var(--ink,#323029);color:var(--washi,#f5f3f0);font:inherit;font-weight:700;font-size:1rem;cursor:pointer;}',
      '.csb-btn:disabled{opacity:.5;}',
      '.csb-back{background:none;border:none;font:inherit;color:var(--ink-3,#8b8480);cursor:pointer;padding:0;margin-bottom:8px;}',
      '.csb-toggle{width:46px;height:28px;border-radius:999px;border:none;background:var(--hairline-2,#d8d2cc);position:relative;cursor:pointer;}',
      '.csb-toggle.on{background:var(--ink,#323029);}',
      '.csb-toggle::after{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;transition:transform .15s;}',
      '.csb-toggle.on::after{transform:translateX(18px);}',
      '.csb-build{text-align:center;padding:48px 16px;}',
      '.csb-spin{width:38px;height:38px;border:3px solid var(--hairline,rgba(0,0,0,.15));border-top-color:var(--ink,#323029);border-radius:50%;margin:0 auto 18px;animation:csb-spin 1s linear infinite;}',
      '@keyframes csb-spin{to{transform:rotate(360deg);}}',
      '.csb-err{color:var(--vermilion,#c0392b);font-size:.9rem;margin-top:12px;}',
    ].join('');
    document.head.appendChild(s);
  }

  function render() {
    var gates = deriveGates();
    var flags = flaggedSurfaces();
    var castList = (CustomStoryBuilderModule._chars || []).filter(function (c) { return c.id && c.surface; });
    var html = '<div class="csb">';
    html += '<button class="csb-back">← Back</button>';
    html += '<h1>Make a story</h1>';
    html += '<p class="sub">Built just for you at your level (' + esc(gates.level) + ', up to ' + esc(gates.grammarGate) + ').</p>';

    html += '<div class="sec">Characters</div><div class="csb-chips" id="csb-cast">';
    castList.forEach(function (c) { html += '<button class="csb-chip" data-id="' + esc(c.id) + '">' + esc(c.meaning || c.surface) + '</button>'; });
    html += '</div>';

    html += '<div class="sec">Theme</div><div class="csb-chips" id="csb-themes">';
    THEMES.forEach(function (t) { html += '<button class="csb-chip" data-theme="' + esc(t) + '">' + esc(t) + '</button>'; });
    html += '</div>';

    html += '<div class="sec">Length</div><div class="csb-chips" id="csb-len">';
    LENGTHS.forEach(function (l) { html += '<button class="csb-chip' + (l.n === selLen ? ' on' : '') + '" data-len="' + l.n + '">' + esc(l.label) + '</button>'; });
    html += '</div>';

    html += '<div class="sec">Practice</div>';
    html += '<div class="csb-row"><div>Focus on my flagged words' + (flags.length ? ' (' + flags.length + ')' : '') + '</div>' +
            '<button class="csb-toggle' + (useFlags ? ' on' : '') + '" id="csb-flags"></button></div>';

    html += '<button class="csb-btn" id="csb-go">Generate story</button>';
    html += '<div class="csb-err" id="csb-err"></div>';
    html += '</div>';
    container.innerHTML = html;

    container.querySelector('.csb-back').onclick = function () { if (onExit) onExit(); };
    container.querySelector('#csb-cast').onclick = function (e) {
      var b = e.target.closest('[data-id]'); if (!b) return;
      var id = b.getAttribute('data-id');
      var n = Object.keys(selCast).filter(function (k) { return selCast[k]; }).length;
      if (!selCast[id] && n >= 5) return;             // cap 5
      selCast[id] = !selCast[id]; b.classList.toggle('on', selCast[id]);
    };
    container.querySelector('#csb-themes').onclick = function (e) {
      var b = e.target.closest('[data-theme]'); if (!b) return;
      var t = b.getAttribute('data-theme');
      var n = Object.keys(selThemes).filter(function (k) { return selThemes[k]; }).length;
      if (!selThemes[t] && n >= 3) return;            // cap 3
      selThemes[t] = !selThemes[t]; b.classList.toggle('on', selThemes[t]);
    };
    container.querySelector('#csb-len').onclick = function (e) {
      var b = e.target.closest('[data-len]'); if (!b) return;
      selLen = +b.getAttribute('data-len');
      container.querySelectorAll('#csb-len .csb-chip').forEach(function (x) { x.classList.toggle('on', +x.getAttribute('data-len') === selLen); });
    };
    container.querySelector('#csb-flags').onclick = function () { useFlags = !useFlags; this.classList.toggle('on', useFlags); };
    container.querySelector('#csb-go').onclick = onGenerate;
  }

  function err(msg) { var e = container.querySelector('#csb-err'); if (e) e.textContent = msg || ''; }

  function buildState(text) {
    container.innerHTML = '<div class="csb"><div class="csb-build"><div class="csb-spin"></div>' +
      '<div id="csb-bstat">' + esc(text || 'Building your story…') + '</div>' +
      '<p class="sub" style="margin-top:10px">This can take a couple of minutes. You can leave — we\'ll save it to your stories when it\'s ready.</p>' +
      '<button class="csb-back" id="csb-leave" style="margin-top:18px">← Back to home</button></div></div>';
    container.querySelector('#csb-leave').onclick = function () { if (onExit) onExit(); };
  }

  async function onGenerate() {
    var s = sg();
    if (!s || !s.isConfigured()) { err('The story generator isn\'t available yet.'); return; }
    if (!s.isSignedIn()) {
      var a = window.JPShared && window.JPShared.auth;
      if (a && a.openAccountUI) a.openAccountUI();
      err('Sign in to generate a story (so it\'s saved to your account).');
      return;
    }
    var cast = Object.keys(selCast).filter(function (k) { return selCast[k]; });
    var themes = Object.keys(selThemes).filter(function (k) { return selThemes[k]; });
    if (!themes.length) { err('Pick at least one theme.'); return; }
    var gates = deriveGates();
    var params = {
      castIds: cast,
      themes: themes,
      gates: gates,
      grammarGate: gates.grammarGate,
      focusWords: useFlags ? flaggedSurfaces() : [],
      targetParagraphs: selLen,
      numQuestions: 3,
      includeComprehension: true,
    };
    buildState('Asking Rikizo to write your story…');
    try {
      var gen = await s.generate(params);
      pollJob(gen.jobId);
    } catch (e) {
      if (e && e.code === 'user_daily_cap') return fail('You\'ve reached today\'s story limit. Try again tomorrow!');
      if (e && (e.code === 'kill_switch' || e.code === 'daily_cost_cap')) return fail('Story generation is paused right now. Please try again later.');
      if (e && e.code === 'login_required') return fail('Please sign in and try again.');
      fail('Could not start generation: ' + ((e && e.message) || 'error'));
    }
  }

  function fail(msg) {
    render();
    err(msg);
  }

  function pollJob(jobId) {
    var s = sg();
    var tries = 0;
    var stat = container.querySelector('#csb-bstat');
    var tick = async function () {
      tries++;
      try {
        var j = await s.pollJob(jobId);
        if (j.status === 'done' && j.storyId) { clearTimeout(pollTimer); return openGenerated(j.storyId); }
        if (j.status === 'failed') { clearTimeout(pollTimer); return fail('The story didn\'t come out right — please try again (maybe simpler choices).'); }
        if (stat) stat.textContent = j.status === 'running' ? 'Writing and checking your story…' : 'Starting…';
      } catch (e) { /* transient — keep polling */ }
      if (tries > 90) { clearTimeout(pollTimer); return fail('This is taking unusually long — it may still finish; check your stories shortly.'); }
      pollTimer = setTimeout(tick, 2500);
    };
    tick();
  }

  async function openGenerated(storyId) {
    var s = sg();
    try {
      var r = await s.getStory(storyId);
      var story = r.story;
      // cache full body + index entry so Stories shows it (offline) and can reopen it
      try { localStorage.setItem('k-user-story-' + storyId, JSON.stringify(story)); } catch (e) {}
      var idx = [];
      try { idx = JSON.parse(localStorage.getItem('k-user-stories') || '[]'); } catch (e) {}
      idx = (Array.isArray(idx) ? idx : []).filter(function (m) { return m && m.id !== storyId; });
      idx.unshift({ id: storyId, title: story.title, englishTitle: story.englishTitle, createdAt: Date.now() });
      try { localStorage.setItem('k-user-stories', JSON.stringify(idx)); } catch (e) {}
      // hand off to the Stories reader
      if (window.JPApp && window.JPApp.launch) window.JPApp.launch('story', storyId, { category: 'custom' });
    } catch (e) {
      fail('Story was created but could not be opened — find it under Stories → Custom.');
    }
  }

  async function start(containerElement, repoConfig, exitCallback) {
    container = containerElement; config = repoConfig; onExit = exitCallback;
    selCast = {}; selThemes = {}; selLen = 6; useFlags = true;
    styles();
    // Load the cast roster (once).
    if (!CustomStoryBuilderModule._chars) {
      try {
        var url = (window.getAssetUrl ? window.getAssetUrl(config, 'shared/characters.json') : 'shared/characters.json') + '?t=' + Date.now();
        var res = await fetch(url);
        CustomStoryBuilderModule._chars = (await res.json()).characters || [];
      } catch (e) { CustomStoryBuilderModule._chars = []; }
    }
    render();
  }

  return { start: start };
})();

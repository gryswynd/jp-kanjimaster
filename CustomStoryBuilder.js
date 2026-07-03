/**
 * CustomStoryBuilder.js
 * The custom-story builder (launch key 'build', reached from Settings → Custom
 * Content → "Make a story"). Pick cast (face icons) / theme(s) / length / which
 * lessons + grammar to focus on / flagged-word focus, submit to rikizo-story-gen
 * with the learner's gates, show a "still building" state while polling, then
 * cache the finished story locally and open it in the Stories reader.
 */
window.CustomStoryBuilderModule = (function () {
  'use strict';

  // Ordered by unlock (earliest first) so a learner's available chips cluster at
  // the top. Gate lesson per theme lives in shared/story-gen-gates.json.
  var THEMES = [
    'Slice of life', 'Animals', 'Comedy', 'School', 'Food',
    'Adventure', 'Travel', 'Sports', 'Mystery', 'Sci-Fi', 'Fantasy',
    'Horror', 'Period Piece', 'Folktale'
  ];
  // n = target paragraphs. Pages depend on the reader (≈3 paras/page); the
  // service enforces ~85% of n as a floor so the page count is reliable.
  // Short 2-3pp · Medium 4-5pp · Long 7-8pp · Extra long 9-10pp (first-pass; tune from real page counts).
  var LENGTHS = [
    { label: 'Short', n: 8 }, { label: 'Medium', n: 14 }, { label: 'Long', n: 22 },
    { label: 'Extra long', n: 28 }
  ];

  var container, config, onExit;
  var selCast = {}, selThemes = {}, selLen = 14, useFlags = true;
  var selLessons = {}, selGrammar = {};
  var pollTimer = null;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function parseObj(k) { try { return JSON.parse(lsGet(k) || '{}') || {}; } catch (e) { return {}; } }
  function sg() { return window.JPShared && window.JPShared.storyGen; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function deriveGates() {
    var completed = parseObj('k-lesson-completed');
    var rank = function (id) { var m = /^N([345])\.(\d+)$/.exec(id); return m ? (5 - +m[1]) * 1000 + +m[2] : -1; };
    var furthest = '', best = -1;
    Object.keys(completed).forEach(function (id) { if (completed[id] && rank(id) > best) { best = rank(id); furthest = id; } });
    var level = furthest ? (/^N4\./.test(furthest) ? 'N4' : 'N5') : (lsGet('k-n4-unlocked') === 'true' ? 'N4' : 'N5');
    var gnum = 0;
    Object.keys(completed).forEach(function (id) { var m = /^G(\d+)$/.exec(id); if (m && completed[id]) gnum = Math.max(gnum, +m[1]); });
    return { level: level, furthestLesson: furthest || null, grammarGate: gnum ? ('G' + gnum) : 'G1' };
  }

  // ── Theme/length gating (mirrors story-gen/lib/story-gen-gates.js) ──────────
  // rank = (5 - Nlevel)*1000 + index → N5.1=1, N4.1=1001, N3.1=2001 (monotonic).
  function lessonRank(id) { var m = /^N([345])\.(\d+)$/.exec(id || ''); return m ? (5 - +m[1]) * 1000 + (+m[2]) : 0; }
  function learnerRank() { return Math.max(lessonRank(deriveGates().furthestLesson), 1); }  // floor N5.1
  function gatesData() { return CustomStoryBuilderModule._gates || { themes: {}, lengths: {} }; }
  // Return the unlock lesson id if locked, else null.
  function themeLocked(t) { var need = gatesData().themes[t]; return (need && lessonRank(need) > learnerRank()) ? need : null; }
  function lenLocked(n) { var need = gatesData().lengths[String(n)]; return (need && lessonRank(need) > learnerRank()) ? need : null; }
  function defaultLen() { return lenLocked(14) ? 8 : 14; }  // 8 (N5.1) is never locked

  function flaggedSurfaces() {
    var active = parseObj('k-active-flags'), out = [];
    Object.keys(active).forEach(function (k) {
      if (!active[k]) return;
      if (/^(v_|g_|p_|char_|count_)/.test(k)) return;
      if (/[぀-ヿ一-鿿ー]/.test(k)) out.push(k);
    });
    return out.slice(0, 40);
  }

  // Completed lessons + grammar (what the learner can choose to reinforce),
  // pulled from the manifest in curriculum order; falls back to everything for
  // the learner's level if nothing is marked complete yet.
  function focusCatalog() {
    var m = CustomStoryBuilderModule._manifest;
    var completed = parseObj('k-lesson-completed');
    var lessons = [], grammar = [];
    if (m && m.data) {
      ['N5', 'N4'].forEach(function (lvl) {
        var d = m.data[lvl]; if (!d) return;
        (d.lessons || []).forEach(function (l) { lessons.push({ id: l.id, title: l.title || l.titleJp || l.id }); });
        (d.grammar || []).forEach(function (g) { grammar.push({ id: g.id, title: g.title || g.titleJp || g.id }); });
      });
    }
    var anyDone = Object.keys(completed).some(function (k) { return completed[k]; });
    if (anyDone) {
      lessons = lessons.filter(function (l) { return completed[l.id]; });
      grammar = grammar.filter(function (g) { return completed[g.id]; });
    }
    return { lessons: lessons, grammar: grammar };
  }

  function styles() {
    if (document.getElementById('csb-style')) return;
    var s = document.createElement('style'); s.id = 'csb-style';
    s.textContent = [
      '.csb{max-width:600px;margin:0 auto;padding:18px 16px calc(28px + env(safe-area-inset-bottom));font-family:"Schibsted Grotesk","Work Sans",system-ui,sans-serif;color:var(--ink,#323029);}',
      '.csb h1{font-family:"Noto Serif JP",serif;font-size:1.4rem;margin:6px 0 2px;}',
      '.csb .sub{color:var(--ink-3,#8b8480);font-size:.85rem;margin:0 0 8px;}',
      '.csb .sec{font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3,#8b8480);margin:20px 0 10px;}',
      '.csb-faces{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:12px 8px;}',
      '.csb-face{display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;}',
      '.csb-face-img{width:58px;height:58px;border-radius:50%;object-fit:cover;background:var(--washi-2,#ece7e1);border:3px solid transparent;}',
      '.csb-face-fallback{width:58px;height:58px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:700;color:var(--ink-2,#5d5852);background:var(--washi-2,#ece7e1);border:3px solid transparent;}',
      '.csb-face.on .csb-face-img,.csb-face.on .csb-face-fallback{border-color:var(--ink,#323029);}',
      '.csb-face-name{font-size:.7rem;text-align:center;color:var(--ink-2,#5d5852);line-height:1.1;}',
      '.csb-face.on .csb-face-name{color:var(--ink,#323029);font-weight:700;}',
      '.csb-chips{display:flex;flex-wrap:wrap;gap:8px;}',
      '.csb-chip{padding:9px 13px;border-radius:999px;border:1px solid var(--hairline,rgba(0,0,0,.16));background:#fff;color:var(--ink-2,#5d5852);font:inherit;font-size:.9rem;cursor:pointer;}',
      '.csb-chip.on{background:var(--ink,#323029);color:var(--washi,#f5f3f0);border-color:var(--ink,#323029);}',
      '.csb-chip.locked{opacity:.45;cursor:not-allowed;border-style:dashed;}',
      '.csb-lock{font-size:.68rem;opacity:.85;margin-left:2px;white-space:nowrap;}',
      '.csb-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;}',
      '.csb-btn{display:block;width:100%;margin-top:24px;padding:14px;border-radius:999px;border:none;background:var(--ink,#323029);color:var(--washi,#f5f3f0);font:inherit;font-weight:700;font-size:1rem;cursor:pointer;}',
      '.csb-back{background:none;border:none;font:inherit;color:var(--ink-3,#8b8480);cursor:pointer;padding:0;margin-bottom:8px;}',
      '.csb-toggle{width:46px;height:28px;border-radius:999px;border:none;background:var(--hairline-2,#d8d2cc);position:relative;cursor:pointer;flex:none;}',
      '.csb-toggle.on{background:var(--ink,#323029);}',
      '.csb-toggle::after{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;transition:transform .15s;}',
      '.csb-toggle.on::after{transform:translateX(18px);}',
      '.csb-exp{border:1px solid var(--hairline,rgba(0,0,0,.14));border-radius:12px;overflow:hidden;margin-top:8px;}',
      '.csb-exp-hd{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;cursor:pointer;background:#fff;font-size:.92rem;}',
      '.csb-exp-bd{display:none;padding:6px 14px 12px;max-height:240px;overflow-y:auto;border-top:1px solid var(--hairline,rgba(0,0,0,.1));}',
      '.csb-exp.open .csb-exp-bd{display:block;}',
      '.csb-exp-grp{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-3,#8b8480);margin:10px 0 4px;}',
      '.csb-check{display:flex;align-items:center;gap:9px;padding:6px 2px;font-size:.88rem;cursor:pointer;}',
      '.csb-check input{width:17px;height:17px;}',
      '.csb-build{text-align:center;padding:48px 16px;}',
      '.csb-spin{width:38px;height:38px;border:3px solid var(--hairline,rgba(0,0,0,.15));border-top-color:var(--ink,#323029);border-radius:50%;margin:0 auto 18px;animation:csb-spin 1s linear infinite;}',
      '@keyframes csb-spin{to{transform:rotate(360deg);}}',
      '.csb-err{color:var(--vermilion,#c0392b);font-size:.9rem;margin-top:12px;min-height:1em;}',
    ].join('');
    document.head.appendChild(s);
  }

  function faceHtml(c) {
    var name = esc(c.meaning || c.surface);
    var initial = esc((c.meaning || c.surface || '?').charAt(0));
    var portrait = c.portrait ? (window.getAssetUrl ? window.getAssetUrl(config, c.portrait) : c.portrait) : '';
    var face = portrait
      ? '<img class="csb-face-img" src="' + esc(portrait) + '" alt="" ' +
        'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
        '<div class="csb-face-fallback" style="display:none">' + initial + '</div>'
      : '<div class="csb-face-fallback">' + initial + '</div>';
    return '<div class="csb-face" data-id="' + esc(c.id) + '">' + face + '<div class="csb-face-name">' + name + '</div></div>';
  }

  function render() {
    var gates = deriveGates();
    var flags = flaggedSurfaces();
    var cat = focusCatalog();
    var castList = (CustomStoryBuilderModule._chars || []).filter(function (c) { return c.id && c.surface; });

    var html = '<div class="csb"><button class="csb-back">← Back</button>';
    html += '<h1>Make a story</h1>';
    html += '<p class="sub">Built for you at your level (' + esc(gates.level) + ', up to ' + esc(gates.grammarGate) + ').</p>';

    html += '<div class="sec">Characters</div><div class="csb-faces" id="csb-cast">';
    castList.forEach(function (c) { html += faceHtml(c); });
    html += '</div>';

    html += '<div class="sec">Theme</div><div class="csb-chips" id="csb-themes">';
    THEMES.forEach(function (t) {
      var lock = themeLocked(t);
      html += '<button class="csb-chip' + (lock ? ' locked' : (selThemes[t] ? ' on' : '')) + '" data-theme="' + esc(t) + '"' +
        (lock ? ' data-lock="' + esc(lock) + '"' : '') + '>' + esc(t) +
        (lock ? ' <span class="csb-lock">🔒 ' + esc(lock) + '</span>' : '') + '</button>';
    });
    html += '</div>';

    html += '<div class="sec">Length</div><div class="csb-chips" id="csb-len">';
    LENGTHS.forEach(function (l) {
      var lock = lenLocked(l.n);
      html += '<button class="csb-chip' + (lock ? ' locked' : (l.n === selLen ? ' on' : '')) + '" data-len="' + l.n + '"' +
        (lock ? ' data-lock="' + esc(lock) + '"' : '') + '>' + esc(l.label) +
        (lock ? ' <span class="csb-lock">🔒 ' + esc(lock) + '</span>' : '') + '</button>';
    });
    html += '</div>';

    html += '<div class="sec">Focus</div>';
    html += '<div class="csb-row"><div>Use my flagged words' + (flags.length ? ' (' + flags.length + ')' : '') + '</div>' +
            '<button class="csb-toggle' + (useFlags ? ' on' : '') + '" id="csb-flags"></button></div>';

    // Expandable lesson + grammar focus.
    var lessonChecks = cat.lessons.map(function (l) {
      return '<label class="csb-check"><input type="checkbox" data-lesson="' + esc(l.id) + '"> ' + esc(l.id) + ' · ' + esc(l.title) + '</label>';
    }).join('');
    var grammarChecks = cat.grammar.map(function (g) {
      return '<label class="csb-check"><input type="checkbox" data-grammar="' + esc(g.id) + '"> ' + esc(g.id) + ' · ' + esc(g.title) + '</label>';
    }).join('');
    html += '<div class="csb-exp" id="csb-exp"><div class="csb-exp-hd" id="csb-exp-hd"><span>Focus on specific lessons &amp; grammar</span><span id="csb-exp-cnt">optional ▾</span></div>' +
            '<div class="csb-exp-bd">' +
              (grammarChecks ? '<div class="csb-exp-grp">Grammar</div>' + grammarChecks : '') +
              (lessonChecks ? '<div class="csb-exp-grp">Lessons</div>' + lessonChecks : '') +
              (!grammarChecks && !lessonChecks ? '<div class="sub">Complete some lessons first to focus on them.</div>' : '') +
            '</div></div>';

    html += '<button class="csb-btn" id="csb-go">Generate story</button>';
    html += '<div class="csb-err" id="csb-err"></div></div>';
    container.innerHTML = html;
    wire();
  }

  function updateFocusCount() {
    var n = Object.keys(selLessons).filter(function (k) { return selLessons[k]; }).length +
            Object.keys(selGrammar).filter(function (k) { return selGrammar[k]; }).length;
    var el = container.querySelector('#csb-exp-cnt');
    if (el) el.textContent = n ? (n + ' selected ▾') : 'optional ▾';
  }

  function wire() {
    container.querySelector('.csb-back').onclick = function () { if (onExit) onExit(); };
    container.querySelector('#csb-cast').onclick = function (e) {
      var f = e.target.closest('[data-id]'); if (!f) return;
      var id = f.getAttribute('data-id');
      var n = Object.keys(selCast).filter(function (k) { return selCast[k]; }).length;
      if (!selCast[id] && n >= 5) return;
      selCast[id] = !selCast[id]; f.classList.toggle('on', selCast[id]);
    };
    container.querySelector('#csb-themes').onclick = function (e) {
      var b = e.target.closest('[data-theme]'); if (!b) return;
      var t = b.getAttribute('data-theme');
      if (b.classList.contains('locked')) { err('🔒 "' + t + '" unlocks at ' + b.getAttribute('data-lock') + '.'); return; }
      var n = Object.keys(selThemes).filter(function (k) { return selThemes[k]; }).length;
      if (!selThemes[t] && n >= 3) return;
      selThemes[t] = !selThemes[t]; b.classList.toggle('on', selThemes[t]); err('');
    };
    container.querySelector('#csb-len').onclick = function (e) {
      var b = e.target.closest('[data-len]'); if (!b) return;
      if (b.classList.contains('locked')) { err('🔒 That length unlocks at ' + b.getAttribute('data-lock') + '.'); return; }
      selLen = +b.getAttribute('data-len'); err('');
      container.querySelectorAll('#csb-len .csb-chip').forEach(function (x) { x.classList.toggle('on', +x.getAttribute('data-len') === selLen); });
    };
    container.querySelector('#csb-flags').onclick = function () { useFlags = !useFlags; this.classList.toggle('on', useFlags); };
    var hd = container.querySelector('#csb-exp-hd');
    if (hd) hd.onclick = function () { container.querySelector('#csb-exp').classList.toggle('open'); };
    var exp = container.querySelector('#csb-exp');
    if (exp) exp.addEventListener('change', function (e) {
      var t = e.target;
      if (t.getAttribute && t.getAttribute('data-lesson')) selLessons[t.getAttribute('data-lesson')] = t.checked;
      if (t.getAttribute && t.getAttribute('data-grammar')) selGrammar[t.getAttribute('data-grammar')] = t.checked;
      updateFocusCount();
    });
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
    var themes = Object.keys(selThemes).filter(function (k) { return selThemes[k]; });
    if (!themes.length) { err('Pick at least one theme.'); return; }
    var gates = deriveGates();
    var params = {
      castIds: Object.keys(selCast).filter(function (k) { return selCast[k]; }),
      themes: themes,
      gates: gates,
      grammarGate: gates.grammarGate,
      focusWords: useFlags ? flaggedSurfaces() : [],
      focusLessons: Object.keys(selLessons).filter(function (k) { return selLessons[k]; }),
      focusGrammar: Object.keys(selGrammar).filter(function (k) { return selGrammar[k]; }),
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
      if (e && e.code === 'theme_locked') return fail('That theme isn\'t unlocked yet — keep going in your lessons to reach it!');
      if (e && e.code === 'length_locked') return fail('That story length unlocks a bit further along — try a shorter one for now.');
      if (e && (e.code === 'kill_switch' || e.code === 'daily_cost_cap')) return fail('Story generation is paused right now. Please try again later.');
      if (e && e.code === 'login_required') return fail('Please sign in and try again.');
      fail('Could not start generation: ' + ((e && e.message) || 'error'));
    }
  }

  function fail(msg) { render(); err(msg); }

  function pollJob(jobId) {
    var s = sg(), tries = 0;
    var tick = async function () {
      tries++;
      try {
        var j = await s.pollJob(jobId);
        var stat = container.querySelector('#csb-bstat');
        if (j.status === 'done' && j.storyId) { clearTimeout(pollTimer); return openGenerated(j.storyId); }
        if (j.status === 'failed') { clearTimeout(pollTimer); return fail('The story didn\'t come out right — please try again (maybe simpler choices).'); }
        if (stat) stat.textContent = j.status === 'running' ? 'Writing and checking your story…' : 'Starting…';
      } catch (e) { /* transient — keep polling */ }
      if (tries > 120) { clearTimeout(pollTimer); return fail('This is taking unusually long — it may still finish; check your stories shortly.'); }
      pollTimer = setTimeout(tick, 2500);
    };
    tick();
  }

  async function openGenerated(storyId) {
    var s = sg();
    try {
      var story = (await s.getStory(storyId)).story;
      try { localStorage.setItem('k-user-story-' + storyId, JSON.stringify(story)); } catch (e) {}
      var idx = [];
      try { idx = JSON.parse(localStorage.getItem('k-user-stories') || '[]'); } catch (e) {}
      idx = (Array.isArray(idx) ? idx : []).filter(function (m) { return m && m.id !== storyId; });
      idx.unshift({ id: storyId, title: story.title, englishTitle: story.englishTitle, createdAt: Date.now() });
      try { localStorage.setItem('k-user-stories', JSON.stringify(idx)); } catch (e) {}
      // Only auto-open if the user is still on the builder; if they navigated
      // away, just leave it cached (it'll appear under Stories → Custom).
      if (document.body.contains(container) && window.JPApp && window.JPApp.launch) {
        window.JPApp.launch('story', storyId, { category: 'custom' });
      }
    } catch (e) {
      fail('Story was created but could not be opened — find it under Stories → Custom.');
    }
  }

  async function start(containerElement, repoConfig, exitCallback) {
    container = containerElement; config = repoConfig; onExit = exitCallback;
    selCast = {}; selThemes = {}; selLen = 14; useFlags = true; selLessons = {}; selGrammar = {};
    styles();
    if (!CustomStoryBuilderModule._chars) {
      try {
        var url = (window.getAssetUrl ? window.getAssetUrl(config, 'shared/characters.json') : 'shared/characters.json') + '?t=' + Date.now();
        CustomStoryBuilderModule._chars = ((await (await fetch(url)).json()).characters) || [];
      } catch (e) { CustomStoryBuilderModule._chars = []; }
    }
    if (!CustomStoryBuilderModule._manifest && window.getManifest) {
      try { CustomStoryBuilderModule._manifest = await window.getManifest(config); } catch (e) { CustomStoryBuilderModule._manifest = null; }
    }
    if (!CustomStoryBuilderModule._gates) {
      try {
        var gurl = (window.getAssetUrl ? window.getAssetUrl(config, 'shared/story-gen-gates.json') : 'shared/story-gen-gates.json') + '?t=' + Date.now();
        CustomStoryBuilderModule._gates = await (await fetch(gurl)).json();
      } catch (e) { CustomStoryBuilderModule._gates = { themes: {}, lengths: {} }; }
    }
    selLen = defaultLen();   // don't default to a length the learner hasn't unlocked
    render();
  }

  return { start: start };
})();

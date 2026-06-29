/**
 * app/games/loanword-dojo.js
 * Gairaigo Gauntlet ⚡ — endless type-in-kana loanword (gairaigo) drill.
 *
 * Plugin under the Practice.js hybrid architecture:
 *   Practice.js owns chrome (streak counter, hanabi, best-score).
 *   This module owns everything inside its container div.
 *   ctx: { container, loanwords[], origins{}, onCorrect, onWrong, onExit,
 *          onProgress, getStreakInfo }.
 *
 * Mixed direction per card:
 *   A (meaning → reading): show the English meaning → type the Japanese in hiragana
 *   B (surface → reading):  show the katakana surface → type its hiragana
 * Both graded on the hiragana reading (device IME; no romaji converter exists).
 *
 * Filters: All · Common (tier) · Theme▾ · Origin▾  — combine (AND).
 */
(function () {
  'use strict';

  window.JPShared = window.JPShared || {};

  // Genre keys → display labels (mirrors the custom-story themes).
  var THEME_LABELS = {
    'slice-of-life': 'Slice of Life', 'sci-fi': 'Sci-Fi', 'fantasy': 'Fantasy',
    'horror': 'Horror', 'mystery': 'Mystery', 'adventure': 'Adventure',
    'humor': 'Humor', 'period-piece': 'Period Piece', 'food': 'Food',
    'countries': 'Countries', 'travel': 'Travel', 'measurement': 'Measurement',
    'technology': 'Technology', 'sports': 'Sports', 'music': 'Music',
    'business': 'Business', 'health': 'Health', 'science': 'Science',
    'cooking': 'Cooking', 'entertainment': 'Entertainment', 'romance': 'Romance',
    'fashion': 'Fashion', 'emotions': 'Emotions', 'drinks': 'Drinks',
    'mythology': 'Mythology', 'animals': 'Animals', 'household': 'Household',
    'vehicles': 'Vehicles', 'events': 'Events', 'colors': 'Colors',
    'school': 'School', 'shopping': 'Shopping', 'stationery': 'Stationery',
    'games': 'Games'
  };

  // ---- CSS (injected once) ----
  function injectStyles() {
    if (document.getElementById('jp-gg-style')) return;
    var s = document.createElement('style');
    s.id = 'jp-gg-style';
    s.textContent =
      '.gg-wrap { font-family:"Poppins","Noto Sans JP",sans-serif; }' +
      '.gg-setup { padding:8px 4px 4px; }' +
      '.gg-setup-title { text-align:center; font-weight:800; font-size:1.15rem; color:#0e7490; margin-bottom:2px; }' +
      '.gg-setup-sub { text-align:center; font-size:0.82rem; color:#64748b; margin-bottom:14px; }' +
      '.gg-lbl { font-size:0.72rem; font-weight:800; text-transform:uppercase; letter-spacing:0.04em; color:#0e7490; margin:14px 0 6px; }' +
      '.gg-chips { display:flex; flex-wrap:wrap; gap:6px; }' +
      '.gg-chip { font-size:0.85rem; padding:6px 12px; border:2px solid #cbd5e1; background:#fff; border-radius:999px; cursor:pointer; color:#334155; }' +
      '.gg-chip.on { border-color:#0e7490; background:#0e7490; color:#fff; }' +
      '.gg-count { text-align:center; font-size:0.85rem; color:#64748b; margin:14px 0 6px; }' +
      '.gg-start { width:100%; padding:14px; border:none; border-radius:12px; font-weight:800; font-size:1rem; color:#fff; background:linear-gradient(135deg,#0e7490 0%,#0c5e74 100%); cursor:pointer; }' +
      '.gg-start:disabled { opacity:0.4; cursor:default; }' +
      // Drill
      '.gg-prompt { text-align:center; padding:22px 16px 8px; }' +
      '.gg-dir { font-size:0.72rem; font-weight:800; text-transform:uppercase; letter-spacing:0.04em; color:#0e7490; }' +
      '.gg-cue { font-size:2.1rem; font-weight:900; line-height:1.2; color:#1e293b; margin-top:6px; word-break:break-word; }' +
      '.gg-cue-en { font-size:1.7rem; }' +
      '.gg-input-wrap { display:flex; gap:8px; margin-top:14px; }' +
      '.gg-input { flex:1; font-size:1.3rem; font-family:"Noto Sans JP",sans-serif; padding:12px 16px; border:2px solid #cbd5e1; border-radius:12px; outline:none; }' +
      '.gg-input:focus { border-color:#0e7490; }' +
      '.gg-go { padding:12px 20px; border:none; border-radius:12px; font-weight:700; font-size:1rem; color:#fff; background:#0e7490; cursor:pointer; }' +
      '.gg-row { display:flex; justify-content:center; gap:8px; margin-top:10px; }' +
      '.gg-hint-btn { font-size:0.82rem; color:#0e7490; background:#ecfeff; border:1px solid #67e8f9; border-radius:8px; padding:5px 12px; cursor:pointer; }' +
      '.gg-end-btn { font-size:0.82rem; color:#64748b; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; padding:5px 12px; cursor:pointer; }' +
      '.gg-feedback { margin-top:14px; text-align:center; min-height:60px; }' +
      '.gg-correct { font-size:1.3rem; font-weight:800; color:#16a34a; }' +
      '.gg-wrong { font-size:1rem; font-weight:700; color:#ef4444; margin-bottom:6px; }' +
      '.gg-diff { display:flex; justify-content:center; gap:2px; flex-wrap:wrap; margin:8px 0; }' +
      '.gg-char { display:inline-flex; align-items:center; justify-content:center; width:30px; height:34px; font-size:1.15rem; font-family:"Noto Sans JP",sans-serif; border-radius:6px; font-weight:600; }' +
      '.gg-char-ok { background:#dcfce7; color:#166534; }' +
      '.gg-char-wrong { background:#fee2e2; color:#991b1b; text-decoration:line-through; }' +
      '.gg-char-missing { background:#fef9c3; color:#854d0e; border-bottom:2px dashed #854d0e; }' +
      '.gg-reveal { font-size:1.1rem; font-weight:700; color:#1e293b; margin:8px 0; }' +
      '.gg-ans { margin:8px auto; }' +
      '.gg-ans-surface { font-size:1.7rem; font-weight:900; color:#0f172a; line-height:1.2; }' +
      '.gg-ans-reading { font-size:1rem; font-weight:600; color:#0e7490; }' +
      '.gg-ans-meaning { font-size:1.1rem; font-weight:700; color:#1e293b; margin-top:3px; }' +
      '.gg-note { font-size:0.82rem; color:#64748b; margin:5px auto 0; max-width:320px; line-height:1.4; }' +
      '.gg-next-sm { margin-top:10px; padding:8px 22px; font-size:0.9rem; background:#16a34a; }' +
      '.gg-origin { font-size:0.92rem; font-weight:600; color:#0e7490; margin:6px auto; }' +
      '.gg-wasei { font-size:0.85rem; font-weight:700; color:#b45309; background:#fffbeb; border:1px solid #fcd34d; border-radius:8px; padding:4px 10px; display:inline-block; margin:4px auto; }' +
      '.gg-next { padding:10px 28px; border:none; border-radius:10px; font-weight:700; color:#fff; background:#0e7490; cursor:pointer; margin-top:8px; }' +
      // Summary
      '.gg-summary { text-align:center; padding:18px 0; }' +
      '.gg-score { font-size:2rem; font-weight:900; color:#1e293b; }' +
      '.gg-score-pct { font-size:1.05rem; color:#64748b; }' +
      '.gg-breakdown { margin:16px 0; text-align:left; font-size:0.85rem; }' +
      '.gg-breakdown-row { display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #f1f5f9; }' +
      '.gg-sum-btns { display:flex; flex-direction:column; gap:8px; margin-top:16px; }' +
      '.gg-sum-btns button { padding:12px; border:none; border-radius:10px; font-weight:700; font-size:0.95rem; cursor:pointer; }' +
      '.gg-btn-primary { color:#fff; background:linear-gradient(135deg,#0e7490 0%,#0c5e74 100%); }' +
      '.gg-btn-secondary { color:#0e7490; background:#ecfeff; }' +
      '@keyframes ggFlash { 0%{background:#dcfce7} 100%{background:transparent} }' +
      '@keyframes ggShake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-4px)} 40%,80%{transform:translateX(4px)} }' +
      '.gg-flash-correct { animation:ggFlash 0.6s ease; }' +
      '.gg-flash-wrong { animation:ggShake 0.4s ease; }';
    document.head.appendChild(s);
  }

  // ---- State ----
  var cfg = {};
  var container = null;
  var pool = [];
  var origins = {};
  var filters = { tier: 'all', theme: '', origin: '', wasei: '' };
  var sessionLength = loadSessionLength();   // 0 = endless (Gauntlet)
  var queue = [];
  var qIdx = 0;
  var sessionCorrect = 0;
  var sessionTotal = 0;
  var mistakes = [];
  var isComposing = false;

  function loadSessionLength() {
    var v = parseInt(localStorage.getItem('k-gg-session-len'), 10);
    return isNaN(v) ? 0 : v;
  }
  function saveSessionLength(n) {
    sessionLength = n;
    try { localStorage.setItem('k-gg-session-len', String(n)); } catch (e) {}
  }

  // ---- Helpers ----
  function esc(str) { var d = document.createElement('div'); d.textContent = str == null ? '' : str; return d.innerHTML; }
  function norm(s) { return (s || '').trim().replace(/\s+/g, ''); }
  function kataToHira(s) { return norm(s).replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); }); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function uniq(a) { var seen = {}, out = []; a.forEach(function (x) { if (x && !seen[x]) { seen[x] = 1; out.push(x); } }); return out; }

  function allThemes() {
    var t = []; pool.forEach(function (w) { (w.themes || []).forEach(function (x) { t.push(x); }); });
    return uniq(t);
  }
  function allOrigins() {
    return uniq(pool.map(function (w) { return w.origin; }));
  }
  function filteredPool() {
    return pool.filter(function (w) {
      if (filters.tier === 'common' && w.tier !== 'common') return false;
      if (filters.theme && (w.themes || []).indexOf(filters.theme) < 0) return false;
      if (filters.origin && w.origin !== filters.origin) return false;
      if (filters.wasei === 'only' && !w.wasei) return false;
      return true;
    });
  }

  // ---- Setup screen ----
  function renderSetup() {
    var fp = filteredPool();
    var themes = allThemes();
    var origs = allOrigins();

    var html = '<div class="gg-wrap"><div class="gg-setup">';
    html += '<div class="gg-setup-title">⚡ Gairaigo Gauntlet</div>';
    html += '<div class="gg-setup-sub">Loan-words from around the world. Type each one in <b>hiragana</b>.</div>';

    html += '<div class="gg-lbl">Set</div><div class="gg-chips">';
    html += chip('tier', 'all', 'All');
    html += chip('tier', 'common', 'Common');
    if (pool.some(function (w) { return w.wasei; })) html += chip('wasei', 'only', '🗾 Wasei');
    html += '</div>';

    if (themes.length) {
      html += '<div class="gg-lbl">Theme</div><div class="gg-chips">';
      html += chip('theme', '', 'Any');
      themes.forEach(function (t) { html += chip('theme', t, THEME_LABELS[t] || t); });
      html += '</div>';
    }

    if (origs.length > 1) {
      html += '<div class="gg-lbl">Origin</div><div class="gg-chips">';
      html += chip('origin', '', 'Any');
      origs.forEach(function (o) {
        var oi = origins[o]; var label = (oi ? (oi.flag || '') + ' ' : '') + (oi ? oi.displayName : o);
        html += chip('origin', o, label);
      });
      html += '</div>';
    }

    html += '<div class="gg-lbl">Length</div><div class="gg-chips">';
    [['10', 10], ['20', 20], ['30', 30], ['Endless ∞', 0]].forEach(function (p) {
      html += '<button class="gg-chip' + (sessionLength === p[1] ? ' on' : '') + '" data-len="' + p[1] + '">' + p[0] + '</button>';
    });
    html += '</div>';

    html += '<div class="gg-count">' + fp.length + ' word' + (fp.length === 1 ? '' : 's') + ' match</div>';
    html += '<button class="gg-start" id="gg-start"' + (fp.length ? '' : ' disabled') + '>Start ⚡</button>';
    html += '</div></div>';
    container.innerHTML = html;

    // Wire filter chips
    Array.prototype.forEach.call(container.querySelectorAll('.gg-chip[data-group]'), function (b) {
      b.addEventListener('click', function () {
        var g = b.getAttribute('data-group'), v = b.getAttribute('data-value');
        // Wasei is an orthogonal toggle (click again to clear); others are radios.
        filters[g] = (g === 'wasei' && filters[g] === v) ? '' : v;
        renderSetup();
      });
    });
    Array.prototype.forEach.call(container.querySelectorAll('.gg-chip[data-len]'), function (b) {
      b.addEventListener('click', function () { saveSessionLength(parseInt(b.getAttribute('data-len'), 10)); renderSetup(); });
    });
    var startBtn = document.getElementById('gg-start');
    if (startBtn) startBtn.addEventListener('click', startSession);
  }

  function chip(group, value, label) {
    var on = filters[group] === value;
    return '<button class="gg-chip' + (on ? ' on' : '') + '" data-group="' + group + '" data-value="' + esc(value) + '">' + esc(label) + '</button>';
  }

  // ---- Session ----
  function buildQueue() {
    var fp = shuffle(filteredPool().slice());
    var cards = fp.map(function (w) { return { word: w, dir: Math.random() < 0.5 ? 'A' : 'B' }; });
    if (sessionLength > 0) cards = cards.slice(0, sessionLength);
    return cards;
  }

  function startSession() {
    queue = buildQueue();
    if (!queue.length) { renderSetup(); return; }
    qIdx = 0; sessionCorrect = 0; sessionTotal = 0; mistakes = [];
    renderDrill();
  }

  function renderDrill() {
    if (qIdx >= queue.length) {
      if (sessionLength === 0) { queue = buildQueue(); qIdx = 0; } // endless: reshuffle, keep going
      else { renderSummary(); return; }
    }
    var card = queue[qIdx];
    var w = card.word;
    cfg.onProgress && cfg.onProgress(sessionLength === 0 ? sessionTotal + 1 : qIdx + 1, sessionLength === 0 ? '∞' : queue.length);

    var html = '<div class="gg-wrap"><div class="gg-prompt">';
    if (card.dir === 'A') {
      html += '<div class="gg-dir">Type in hiragana</div>';
      html += '<div class="gg-cue gg-cue-en">' + esc(w.meaning) + '</div>';
    } else {
      html += '<div class="gg-dir">Read it · type in hiragana</div>';
      html += '<div class="gg-cue">' + esc(w.surface) + '</div>';
    }
    html += '</div>';

    html += '<div class="gg-input-wrap">';
    html += '<input type="text" class="gg-input" id="gg-input" lang="ja" inputmode="text" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="ひらがな…">';
    html += '<button class="gg-go" id="gg-go">Go</button>';
    html += '</div>';

    html += '<div class="gg-row">';
    html += '<button class="gg-hint-btn" id="gg-hint">🌐 Hint</button>';
    if (sessionLength === 0) html += '<button class="gg-end-btn" id="gg-end">End ⏹</button>';
    html += '</div>';
    html += '<div class="gg-feedback" id="gg-feedback"></div>';
    html += '</div>';
    container.innerHTML = html;

    var inp = document.getElementById('gg-input');
    var submitted = false;
    isComposing = false;
    inp.addEventListener('compositionstart', function () { isComposing = true; });
    inp.addEventListener('compositionend', function () { isComposing = false; });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !isComposing && !submitted) { e.preventDefault(); submitted = true; submitAnswer(card, inp.value); }
    });
    document.getElementById('gg-go').addEventListener('click', function () {
      if (!submitted) { submitted = true; submitAnswer(card, inp.value); }
    });
    document.getElementById('gg-hint').addEventListener('click', function () {
      var oi = origins[w.origin];
      var parts = [];
      // Direction A (meaning→type) can't be guessed cold — reveal the katakana so
      // the learner can transliterate it. Direction B already shows the katakana.
      if (card.dir === 'A') parts.push(w.surface);
      if (oi) parts.push((oi.flag || '') + ' ' + oi.displayName);
      this.textContent = '💡 ' + (parts.join('  ·  ') || 'Loan-word');
      this.disabled = true;
    });
    var endBtn = document.getElementById('gg-end');
    if (endBtn) endBtn.addEventListener('click', function () { renderSummary(); });
    inp.focus();
  }

  function gradeOk(w, input) {
    var typed = kataToHira(input);
    if (!typed) return false;
    return typed === kataToHira(w.reading) || typed === kataToHira(w.surface);
  }

  function submitAnswer(card, input) {
    if (!norm(input)) return;
    var w = card.word;
    sessionTotal++;
    var ok = gradeOk(w, input);
    var fb = document.getElementById('gg-feedback');
    var inp = document.getElementById('gg-input');
    if (inp) inp.disabled = true;
    var answer = answerCardHtml(w);   // full teaching card: surface·reading·meaning·origin

    if (ok) {
      cfg.onCorrect && cfg.onCorrect();
      sessionCorrect++;
      if (fb) { fb.innerHTML = '<div class="gg-correct">正解！</div>' + answer + '<button class="gg-next gg-next-sm" id="gg-next">Next ➡</button>'; fb.classList.add('gg-flash-correct'); }
      var autoAdv = setTimeout(function () { qIdx++; renderDrill(); }, 2200);
      var nbc = document.getElementById('gg-next');
      if (nbc) nbc.addEventListener('click', function () { clearTimeout(autoAdv); qIdx++; renderDrill(); });
    } else {
      cfg.onWrong && cfg.onWrong();
      mistakes.push(card);
      var expected = kataToHira(w.reading);
      var diff = buildCharDiff(kataToHira(input), expected);
      var h = '<div class="gg-wrong">残念！</div>';
      h += '<div class="gg-diff">' + diff.map(function (d) { return '<span class="gg-char gg-char-' + d.status + '">' + esc(d.char) + '</span>'; }).join('') + '</div>';
      h += answer;
      h += '<button class="gg-next" id="gg-next">Next ➡</button>';
      if (fb) { fb.innerHTML = h; fb.classList.add('gg-flash-wrong'); }
      var nb = document.getElementById('gg-next');
      if (nb) nb.addEventListener('click', function () { qIdx++; renderDrill(); });
    }
  }

  // Full teaching card shown after every answer (correct OR wrong) so the drill
  // always reinforces katakana ↔ reading ↔ MEANING ↔ origin.
  function answerCardHtml(w) {
    var oi = origins[w.origin];
    var h = '<div class="gg-ans">';
    h += '<div class="gg-ans-surface">' + esc(w.surface) + '</div>';
    h += '<div class="gg-ans-reading">' + esc(w.reading) + '</div>';
    h += '<div class="gg-ans-meaning">' + esc(w.meaning) + '</div>';
    h += '<div class="gg-origin">' + (oi ? esc(oi.flag || '') + ' ' + esc(oi.displayName) : 'Loan-word') + '</div>';
    if (w.wasei) h += '<div class="gg-wasei">🗾 wasei-eigo — coined in Japan</div>';
    if (w.notes) h += '<div class="gg-note">' + esc(w.notes) + '</div>';
    h += '</div>';
    return h;
  }

  function buildCharDiff(userInput, expected) {
    var result = [];
    var p = 0;
    while (p < userInput.length && p < expected.length && userInput[p] === expected[p]) p++;
    for (var i = 0; i < p; i++) result.push({ char: userInput[i], status: 'ok' });
    for (var i = p; i < userInput.length; i++) result.push({ char: userInput[i], status: 'wrong' });
    for (var i = p; i < expected.length; i++) result.push({ char: expected[i], status: 'missing' });
    return result;
  }

  function renderSummary() {
    var pct = sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : 0;
    var html = '<div class="gg-wrap"><div class="gg-summary">';
    html += '<div class="gg-score">' + sessionCorrect + ' / ' + sessionTotal + '</div>';
    html += '<div class="gg-score-pct">' + pct + '% correct</div>';

    if (sessionTotal > 0) {
      html += '<div class="gg-breakdown"><div style="font-weight:700;margin-bottom:4px;">This run</div>';
      html += '<div class="gg-breakdown-row"><span>Correct</span><span>' + sessionCorrect + '</span></div>';
      html += '<div class="gg-breakdown-row"><span>Missed</span><span>' + mistakes.length + '</span></div>';
      html += '</div>';
    }

    html += '<div class="gg-sum-btns">';
    if (mistakes.length > 0) html += '<button class="gg-btn-primary" id="gg-retry">🔁 Retry Missed (' + mistakes.length + ')</button>';
    html += '<button class="gg-btn-secondary" id="gg-new">New Session</button>';
    html += '<button class="gg-btn-secondary" id="gg-exit">Back to Menu</button>';
    html += '</div></div></div>';
    container.innerHTML = html;

    if (mistakes.length > 0) {
      document.getElementById('gg-retry').addEventListener('click', function () {
        queue = shuffle(mistakes.map(function (c) { return { word: c.word, dir: c.dir }; }));
        qIdx = 0; sessionCorrect = 0; sessionTotal = 0; mistakes = [];
        renderDrill();
      });
    }
    document.getElementById('gg-new').addEventListener('click', renderSetup);
    document.getElementById('gg-exit').addEventListener('click', function () { cfg.onExit && cfg.onExit(); });
  }

  // ---- Public API ----
  window.JPShared.loanwordDojo = {
    init: function (containerEl, ctx) {
      injectStyles();
      cfg = ctx || {};
      container = containerEl;
      pool = (cfg.loanwords || []).filter(function (w) { return w && w.surface && w.reading; });
      origins = cfg.origins || {};
      filters = { tier: 'all', theme: '', origin: '', wasei: '' };
      container.innerHTML = '';
      if (!pool.length) {
        container.innerHTML = '<div class="gg-wrap" style="text-align:center;padding:32px 16px;">' +
          '<div style="font-size:2.2rem;margin-bottom:10px;">⚡</div>' +
          '<div style="font-weight:800;color:#0e7490;margin-bottom:6px;">Gairaigo Gauntlet</div>' +
          '<div style="color:#ef4444;font-weight:600;">No loan-words available.</div></div>';
        return;
      }
      renderSetup();
    },
    destroy: function () { if (container) container.innerHTML = ''; }
  };
})();

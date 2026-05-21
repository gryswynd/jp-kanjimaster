// ============================================================
//  KanjiBingoGenerator.js — Teacher's Kanji Bingo Caller
//  A standalone random kanji generator for teachers to use
//  during bingo games. Shows kanji on animated "bingo balls"
//  with a dramatic dice-roll style spinning animation.
// ============================================================
window.KanjiBingoGeneratorModule = (function () {
  'use strict';

  let container = null;
  let config = null;
  let onExit = null;
  let kanjiPool = [];
  let callHistory = [];
  let remainingPool = [];
  let currentKanji = null;
  let isSpinning = false;

  // ── Ball colors for bingo-style variety ──
  const BALL_COLORS = [
    { bg: '#E91E63', glow: 'rgba(233,30,99,0.4)' },   // pink
    { bg: '#FF5722', glow: 'rgba(255,87,34,0.4)' },    // deep orange
    { bg: '#4CAF50', glow: 'rgba(76,175,80,0.4)' },    // green
    { bg: '#2196F3', glow: 'rgba(33,150,243,0.4)' },   // blue
    { bg: '#9C27B0', glow: 'rgba(156,39,176,0.4)' },   // purple
    { bg: '#FF9800', glow: 'rgba(255,152,0,0.4)' },    // orange
    { bg: '#00BCD4', glow: 'rgba(0,188,212,0.4)' },    // cyan
    { bg: '#F44336', glow: 'rgba(244,67,54,0.4)' },    // red
  ];

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function randomBallColor() {
    return BALL_COLORS[Math.floor(Math.random() * BALL_COLORS.length)];
  }

  // ══════════════════════════════════════════════════════════════
  //  INJECT STYLES
  // ══════════════════════════════════════════════════════════════
  function injectStyles() {
    if (document.getElementById('kbg-styles')) return;
    const s = document.createElement('style');
    s.id = 'kbg-styles';
    s.textContent = `
      :root {
        --kbg-primary: #E91E63;
        --kbg-bg: #1a1a2e;
        --kbg-surface: #16213e;
        --kbg-text: #eee;
        --kbg-text-sub: #aaa;
        --kbg-gold: #FFD700;
      }

      .kbg-container {
        width: 100%;
        max-width: 600px;
        margin: 0 auto;
        font-family: "Poppins", sans-serif;
        color: var(--kbg-text);
        background: var(--kbg-bg);
        min-height: 100vh;
        padding: 20px;
        box-sizing: border-box;
      }

      .kbg-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
      }
      .kbg-back-btn {
        background: none;
        border: none;
        color: var(--kbg-text-sub);
        font-size: 1.5rem;
        cursor: pointer;
        padding: 8px;
        border-radius: 8px;
        transition: background 0.2s;
      }
      @media (hover: hover) { .kbg-back-btn:hover { background: rgba(255,255,255,0.1); } }
      .kbg-title {
        font-size: 1.3rem;
        font-weight: 900;
        text-align: center;
        flex: 1;
      }
      .kbg-teacher-badge {
        background: linear-gradient(135deg, #FF9800, #F44336);
        color: white;
        font-size: 0.6rem;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 12px;
        letter-spacing: 0.3px;
        white-space: nowrap;
      }

      /* ── Level Selector ── */
      .kbg-level-select {
        display: flex;
        gap: 10px;
        justify-content: center;
        margin-bottom: 24px;
      }
      .kbg-level-btn {
        padding: 10px 24px;
        border-radius: 12px;
        border: 2px solid rgba(255,255,255,0.15);
        background: var(--kbg-surface);
        color: var(--kbg-text);
        font-weight: 700;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.2s;
      }
      @media (hover: hover) { .kbg-level-btn:hover { border-color: var(--kbg-primary); } }
      .kbg-level-btn.active {
        background: var(--kbg-primary);
        border-color: var(--kbg-primary);
        color: white;
      }

      /* ── The Bingo Ball ── */
      .kbg-ball-stage {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin: 30px 0;
        perspective: 800px;
      }
      .kbg-ball {
        width: 180px;
        height: 180px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 5rem;
        font-weight: 900;
        color: white;
        position: relative;
        box-shadow:
          inset -8px -8px 20px rgba(0,0,0,0.3),
          inset 6px 6px 15px rgba(255,255,255,0.15),
          0 8px 30px rgba(0,0,0,0.4);
        transition: transform 0.3s ease, box-shadow 0.3s ease;
        cursor: default;
        text-shadow: 2px 2px 6px rgba(0,0,0,0.4);
      }
      .kbg-ball::before {
        content: '';
        position: absolute;
        top: 12px;
        left: 20px;
        width: 40px;
        height: 25px;
        background: radial-gradient(ellipse, rgba(255,255,255,0.45) 0%, transparent 70%);
        border-radius: 50%;
        pointer-events: none;
      }
      /* White stripe band across the ball */
      .kbg-ball::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 80%;
        height: 36px;
        background: rgba(255,255,255,0.92);
        border-radius: 4px;
        pointer-events: none;
        z-index: 0;
      }
      .kbg-ball-kanji {
        position: relative;
        z-index: 1;
        color: #222;
        text-shadow: none;
      }

      /* Spinning animation */
      .kbg-ball.spinning {
        animation: kbgSpin 0.12s linear infinite;
      }
      @keyframes kbgSpin {
        0%   { transform: rotateY(0deg)   scale(1); }
        25%  { transform: rotateY(90deg)  scale(0.95); }
        50%  { transform: rotateY(180deg) scale(1); }
        75%  { transform: rotateY(270deg) scale(0.95); }
        100% { transform: rotateY(360deg) scale(1); }
      }

      /* Reveal pop */
      .kbg-ball.reveal {
        animation: kbgReveal 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      }
      @keyframes kbgReveal {
        0%   { transform: rotateY(180deg) scale(0.8); }
        50%  { transform: rotateY(360deg) scale(1.15); }
        100% { transform: rotateY(360deg) scale(1); }
      }

      /* ── Info beneath ball ── */
      .kbg-ball-info {
        text-align: center;
        margin-top: 20px;
        opacity: 0;
        transform: translateY(10px);
        transition: all 0.4s ease;
      }
      .kbg-ball-info.visible {
        opacity: 1;
        transform: translateY(0);
      }
      .kbg-ball-reading {
        font-size: 1.8rem;
        font-weight: 900;
        color: var(--kbg-gold);
        margin-bottom: 4px;
      }
      .kbg-ball-meaning {
        font-size: 1rem;
        color: var(--kbg-text-sub);
      }

      /* ── Roll Button ── */
      .kbg-roll-btn {
        display: block;
        width: 100%;
        max-width: 300px;
        margin: 24px auto;
        padding: 16px 32px;
        border-radius: 16px;
        border: none;
        background: linear-gradient(135deg, #E91E63, #FF5722);
        color: white;
        font-size: 1.2rem;
        font-weight: 900;
        cursor: pointer;
        transition: all 0.2s;
        text-transform: uppercase;
        letter-spacing: 1px;
        box-shadow: 0 4px 15px rgba(233,30,99,0.4);
      }
      @media (hover: hover) { .kbg-roll-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(233,30,99,0.5); } }
      .kbg-roll-btn:active { transform: scale(0.97); }
      .kbg-roll-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      /* ── History Rail (called balls stay on screen) ── */
      .kbg-history-label {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--kbg-text-sub);
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 8px;
        text-align: center;
      }
      .kbg-history-rail {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: center;
        padding: 12px;
        background: var(--kbg-surface);
        border-radius: 16px;
        min-height: 60px;
        max-height: 300px;
        overflow-y: auto;
      }
      .kbg-history-ball {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.2rem;
        font-weight: 900;
        position: relative;
        box-shadow:
          inset -3px -3px 8px rgba(0,0,0,0.3),
          inset 2px 2px 5px rgba(255,255,255,0.15),
          0 2px 8px rgba(0,0,0,0.3);
        animation: kbgHistoryPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .kbg-history-ball::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 75%;
        height: 14px;
        background: rgba(255,255,255,0.88);
        border-radius: 2px;
        z-index: 0;
      }
      .kbg-history-ball span {
        position: relative;
        z-index: 1;
        color: #222;
        font-size: 1.1rem;
        text-shadow: none;
      }
      @keyframes kbgHistoryPop {
        0% { transform: scale(0); opacity: 0; }
        60% { transform: scale(1.2); }
        100% { transform: scale(1); opacity: 1; }
      }

      /* ── Counter ── */
      .kbg-counter {
        text-align: center;
        font-size: 0.85rem;
        color: var(--kbg-text-sub);
        margin: 16px 0 8px;
      }

      /* ── Reset button ── */
      .kbg-reset-btn {
        display: block;
        margin: 12px auto;
        padding: 8px 20px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.15);
        background: transparent;
        color: var(--kbg-text-sub);
        font-size: 0.85rem;
        cursor: pointer;
        transition: all 0.2s;
      }
      @media (hover: hover) { .kbg-reset-btn:hover { border-color: var(--kbg-primary); color: var(--kbg-text); } }

      /* ── Responsive ── */
      @media (max-width: 600px) {
        .kbg-ball { width: 150px; height: 150px; font-size: 4rem; }
        .kbg-ball::after { height: 30px; }
      }
    `;
    document.head.appendChild(s);
  }

  // ══════════════════════════════════════════════════════════════
  //  LOAD KANJI DATA
  // ══════════════════════════════════════════════════════════════
  async function loadKanjiData() {
    // Load manifest to get all available kanji across lessons
    try {
      // Always compute base URL as fallback
      var base = 'https://cdn.jsdelivr.net/gh/' + config.owner + '/' + config.repo + '@' + config.branch;

      // Use shared asset loader if available, else fall back to CDN fetch
      var manifest;
      var fetchJSON;
      if (window.getManifest && window.JPShared && window.JPShared.assets) {
        manifest = await window.getManifest(config);
        fetchJSON = window.JPShared.assets.fetchJSON;
      } else {
        fetchJSON = function (url) { return fetch(url).then(function (r) { return r.json(); }); };
        manifest = await fetchJSON(base + '/manifest.json');
      }

      // Helper to resolve data file paths — use same pattern as FinalReview.js
      function getUrl(filePath) {
        if (window.getAssetUrl) {
          return window.getAssetUrl(config, filePath);
        }
        return base + '/' + filePath;
      }

      // Build kanji list from manifest
      var allKanji = [];
      var levels = ['N5', 'N4'];

      for (var li = 0; li < levels.length; li++) {
        var level = levels[li];
        var lessons = manifest.data && manifest.data[level] && manifest.data[level].lessons;
        if (!lessons) continue;
        for (var j = 0; j < lessons.length; j++) {
          var lesson = lessons[j];
          if (lesson.kanji && lesson.kanji.length > 0) {
            for (var ki = 0; ki < lesson.kanji.length; ki++) {
              allKanji.push({ kanji: lesson.kanji[ki], lessonId: lesson.id });
            }
          }
        }
      }

      // Load BOTH glossaries to get reading/meaning for ALL kanji
      var glossaryFiles = [
        manifest.data.N5 && manifest.data.N5.glossary,
        manifest.data.N4 && manifest.data.N4.glossary
      ].filter(Boolean);

      var kanjiLookup = {};
      var glossaryResults = await Promise.all(glossaryFiles.map(function (f) {
        return fetchJSON(getUrl(f)).catch(function () { return []; });
      }));

      for (var gi = 0; gi < glossaryResults.length; gi++) {
        var raw = glossaryResults[gi];
        // Glossary JSON is { entries: [...] }, not a bare array
        var glossary = Array.isArray(raw) ? raw : (raw && raw.entries ? raw.entries : []);
        for (var ei = 0; ei < glossary.length; ei++) {
          var entry = glossary[ei];
          if (entry.type === 'kanji' && entry.surface) {
            kanjiLookup[entry.surface] = entry;
          }
        }
      }

      // Enrich all kanji with reading/meaning from glossary
      for (var ai = 0; ai < allKanji.length; ai++) {
        var item = allKanji[ai];
        var gEntry = kanjiLookup[item.kanji];
        if (gEntry) {
          item.reading = gEntry.reading || gEntry.kun || '';
          item.meaning = gEntry.meaning || '';
        }
      }

      // Deduplicate by kanji character, preferring entries WITH reading data
      var seen = {};
      kanjiPool = [];
      for (var di = 0; di < allKanji.length; di++) {
        var k = allKanji[di];
        if (!seen[k.kanji]) {
          seen[k.kanji] = true;
          kanjiPool.push(k);
        } else if (k.reading && !kanjiPool.find(function (p) { return p.kanji === k.kanji && p.reading; })) {
          // Replace the entry without reading with this one that has reading
          for (var ri = 0; ri < kanjiPool.length; ri++) {
            if (kanjiPool[ri].kanji === k.kanji && !kanjiPool[ri].reading) {
              kanjiPool[ri] = k;
              break;
            }
          }
        }
      }

      if (kanjiPool.length > 0) {
        // Log any kanji missing reading data for debugging
        var missing = kanjiPool.filter(function (p) { return !p.reading; });
        if (missing.length > 0) {
          console.warn('[KanjiBingoGenerator] Kanji missing reading data:', missing.map(function (m) { return m.kanji; }));
        }
      }

      return kanjiPool.length > 0;
    } catch (e) {
      console.error('KanjiBingoGenerator: Failed to load kanji data', e);
      return false;
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  ROLL / SPIN LOGIC
  // ══════════════════════════════════════════════════════════════
  function startNewGame() {
    callHistory = [];
    remainingPool = shuffle(kanjiPool.slice());
    currentKanji = null;
    render();
  }

  function rollNext() {
    if (isSpinning || remainingPool.length === 0) return;
    isSpinning = true;

    const ball = document.getElementById('kbg-main-ball');
    const ballKanji = document.getElementById('kbg-ball-kanji');
    const info = document.getElementById('kbg-ball-info');
    const rollBtn = document.getElementById('kbg-roll-btn');

    if (rollBtn) rollBtn.disabled = true;
    if (info) info.classList.remove('visible');

    // Start spinning with random kanji flashing
    if (ball) ball.classList.add('spinning');

    let flashInterval = setInterval(() => {
      if (ballKanji) {
        const randomIdx = Math.floor(Math.random() * kanjiPool.length);
        ballKanji.textContent = kanjiPool[randomIdx].kanji;
      }
    }, 80);

    // Spin duration: 1.2–2 seconds for drama
    const spinDuration = 1200 + Math.random() * 800;

    setTimeout(() => {
      clearInterval(flashInterval);

      // Pick the actual kanji
      currentKanji = remainingPool.pop();
      currentKanji.color = randomBallColor();
      callHistory.push(currentKanji);

      // Reveal
      if (ballKanji) ballKanji.textContent = currentKanji.kanji;
      if (ball) {
        ball.classList.remove('spinning');
        ball.classList.add('reveal');
        ball.style.background = currentKanji.color.bg;
        ball.style.boxShadow =
          'inset -8px -8px 20px rgba(0,0,0,0.3), ' +
          'inset 6px 6px 15px rgba(255,255,255,0.15), ' +
          '0 8px 30px ' + currentKanji.color.glow + ', ' +
          '0 0 60px ' + currentKanji.color.glow;

        setTimeout(() => ball.classList.remove('reveal'), 500);
      }

      // Show info
      setTimeout(() => {
        if (info) {
          const readingEl = info.querySelector('.kbg-ball-reading');
          const meaningEl = info.querySelector('.kbg-ball-meaning');
          if (readingEl) readingEl.textContent = currentKanji.reading || '';
          if (meaningEl) meaningEl.textContent = currentKanji.meaning || '';
          info.classList.add('visible');
        }

        // Add to history rail
        addToHistoryRail(currentKanji);

        // Update counter
        const counter = document.getElementById('kbg-counter');
        if (counter) counter.textContent = 'Called: ' + callHistory.length + ' / ' + kanjiPool.length;

        isSpinning = false;
        if (rollBtn) rollBtn.disabled = remainingPool.length === 0;
        if (remainingPool.length === 0 && rollBtn) {
          rollBtn.textContent = 'All kanji called!';
        }
      }, 300);

    }, spinDuration);
  }

  function addToHistoryRail(item) {
    const rail = document.getElementById('kbg-history-rail');
    if (!rail) return;

    const ball = document.createElement('div');
    ball.className = 'kbg-history-ball';
    ball.style.background = item.color.bg;
    ball.innerHTML = '<span>' + item.kanji + '</span>';
    ball.title = (item.reading || '') + ' — ' + (item.meaning || '');
    rail.appendChild(ball);

    // Auto-scroll to bottom
    rail.scrollTop = rail.scrollHeight;
  }

  // ══════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════
  function render() {
    const initialColor = BALL_COLORS[0];

    container.innerHTML = `
      <div class="kbg-container">
        <div class="kbg-header">
          <button class="kbg-back-btn" id="kbg-back">\u2190</button>
          <div class="kbg-title">\uD83C\uDFB2 Kanji Bingo Caller</div>
          <div class="kbg-teacher-badge">TEACHER'S TOOL</div>
        </div>

        <div class="kbg-ball-stage">
          <div class="kbg-ball" id="kbg-main-ball"
               style="background: ${initialColor.bg}; box-shadow:
                 inset -8px -8px 20px rgba(0,0,0,0.3),
                 inset 6px 6px 15px rgba(255,255,255,0.15),
                 0 8px 30px ${initialColor.glow};">
            <span class="kbg-ball-kanji" id="kbg-ball-kanji">?</span>
          </div>

          <div class="kbg-ball-info" id="kbg-ball-info">
            <div class="kbg-ball-reading"></div>
            <div class="kbg-ball-meaning"></div>
          </div>
        </div>

        <button class="kbg-roll-btn" id="kbg-roll-btn">
          \uD83C\uDFB2 Roll Next Kanji
        </button>

        <div class="kbg-counter" id="kbg-counter">
          Called: 0 / ${kanjiPool.length}
        </div>

        <div class="kbg-history-label">Called Kanji</div>
        <div class="kbg-history-rail" id="kbg-history-rail"></div>

        <button class="kbg-reset-btn" id="kbg-reset-btn">
          \u21BB Reset &amp; Reshuffle
        </button>
      </div>
    `;

    // Wire events
    document.getElementById('kbg-back').onclick = function () {
      if (onExit) onExit();
    };

    document.getElementById('kbg-roll-btn').onclick = rollNext;
    document.getElementById('kbg-reset-btn').onclick = startNewGame;
  }

  // ══════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ══════════════════════════════════════════════════════════════
  return {
    start: async function (c, cfg, exitCb) {
      container = c;
      config = cfg;
      onExit = exitCb;

      injectStyles();

      container.innerHTML =
        '<div style="padding:40px;text-align:center;color:#888;">Loading kanji data...</div>';

      const loaded = await loadKanjiData();
      if (!loaded) {
        container.innerHTML =
          '<div style="padding:40px;text-align:center;color:#f44;">' +
          'Failed to load kanji data. Please try again.</div>';
        return;
      }

      startNewGame();
    }
  };
})();

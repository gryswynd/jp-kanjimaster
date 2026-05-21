/**
 * app/games/scramble.js
 * Sentence Builder — drag-and-drop sentence scramble game.
 *
 * Shell contract:
 *   Practice.js owns chrome (progress counter, hanabi, session tracking).
 *   This module owns everything inside its container div.
 *   Shell passes: container, level ('N5'), activeLessons, config,
 *                 onComplete, onExit, onProgress.
 *
 * Data format (scramble.N5.json):
 *   { sets: [{ id, title, requires[], items: [{ q, segments[], distractors[], explanation, alts? }] }] }
 *
 * Game rules:
 *   - Shuffled word tiles; tap to move between bank/slot, drag to reposition.
 *   - Build the correct Japanese sentence from the English prompt.
 *   - All items in a set solved → onComplete (shell triggers hanabi).
 *   - Abandoned mid-set → saved as failed.
 */
(function () {
  'use strict';

  window.JPShared = window.JPShared || {};

  // ── CSS (injected once) ───────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('jp-scr-style')) return;
    var s = document.createElement('style');
    s.id = 'jp-scr-style';
    s.textContent =
      '.scr-wrap{font-family:"Poppins","Noto Sans JP",sans-serif;' +
        'max-width:480px;margin:0 auto;}' +

      // Picker
      '.scr-pick-hdr{font-size:1.05rem;font-weight:800;color:#3a3a3a;' +
        'text-align:center;margin:16px 0 12px;letter-spacing:0.02em;}' +
      '.scr-pick-list{display:grid;grid-template-columns:1fr;gap:7px;}' +
      '.scr-pick-item{display:flex;align-items:center;gap:10px;padding:12px 14px;' +
        'border-radius:12px;background:#fff;border:1.5px solid #e8d8e8;cursor:pointer;' +
        'transition:transform 0.15s,box-shadow 0.15s,border-color 0.15s;}' +
      '.scr-pick-item:hover{transform:translateY(-2px);' +
        'box-shadow:0 6px 16px rgba(212,114,154,0.18);border-color:#d4729a;}' +
      '.scr-pick-num{font-weight:900;font-size:0.88rem;color:#d4729a;' +
        'min-width:20px;flex-shrink:0;}' +
      '.scr-pick-info{flex:1;min-width:0;}' +
      '.scr-pick-title{font-weight:700;font-size:0.88rem;color:#2f3542;}' +
      '.scr-pick-sub{font-size:0.75rem;color:#747d8c;margin-top:2px;}' +
      '.scr-pick-badge{width:44px;height:44px;flex-shrink:0;' +
        'display:flex;align-items:center;justify-content:center;}' +
      '.scr-pick-badge img{width:100%;height:100%;object-fit:contain;opacity:0.85;' +
        'animation:scrPickPop 0.3s ease;}' +
      '.scr-pick-go{font-size:0.82rem;font-weight:700;color:#d4729a;flex-shrink:0;}' +
      '@keyframes scrPickPop{0%{transform:scale(2) rotate(0deg);opacity:0}' +
        '60%{transform:scale(0.9)}100%{transform:scale(1);opacity:0.85}}' +

      // Game header
      '.scr-game{max-width:480px;margin:0 auto;padding:8px 0 0;}' +
      '.scr-game-hdr{display:flex;align-items:center;gap:8px;margin-bottom:12px;}' +
      '.scr-btn-back-sm{background:none;border:none;color:#888;font-weight:700;' +
        'font-size:0.82rem;cursor:pointer;padding:4px 0;flex-shrink:0;}' +
      '.scr-btn-back-sm:hover{color:#d4729a;}' +
      '.scr-progress-dots{display:flex;gap:5px;flex:1;justify-content:center;}' +
      '.scr-dot{width:8px;height:8px;border-radius:50%;background:#ddd;' +
        'transition:background 0.25s,transform 0.25s;}' +
      '.scr-dot-done{background:#27ae60;}' +
      '.scr-dot-active{background:#d4729a;transform:scale(1.25);}' +
      '.scr-progress-text{font-size:0.75rem;color:#888;font-weight:700;' +
        'flex-shrink:0;min-width:36px;text-align:right;}' +

      // Prompt
      '.scr-prompt{text-align:center;font-size:1rem;color:#2f3542;' +
        'font-weight:600;margin-bottom:14px;line-height:1.4;padding:0 8px;}' +

      // Slot area
      '.scr-slot-area{background:#fdf2f6;' +
        'border:2px dashed #e0c0d0;border-radius:16px;min-height:64px;' +
        'padding:12px;margin:0 4px 14px;transition:border-color 0.2s,background 0.2s;}' +
      '.scr-slot-area.scr-drop-active{border-color:#d4729a;' +
        'background:rgba(212,114,154,0.1);}' +
      '.scr-slot-empty{text-align:center;color:#b8a0b0;font-size:0.78rem;' +
        'font-weight:600;padding:12px 0;user-select:none;}' +
      '.scr-slot{display:flex;flex-wrap:wrap;gap:8px;min-height:10px;' +
        'justify-content:center;}' +

      // Word bank
      '.scr-bank{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;' +
        'padding:4px 8px;margin-bottom:14px;min-height:48px;}' +

      // Tiles
      '.scr-tile{display:inline-flex;align-items:center;justify-content:center;' +
        'padding:10px 16px;background:#fff;border:2px solid #e0d0e0;' +
        'border-radius:10px;font-family:"Noto Sans JP",sans-serif;' +
        'font-size:1.05rem;font-weight:600;color:#2f3542;cursor:grab;' +
        'user-select:none;-webkit-user-select:none;touch-action:none;' +
        'transition:transform 0.18s,box-shadow 0.18s,opacity 0.18s,' +
        'border-color 0.18s,background 0.18s;' +
        'box-shadow:0 2px 6px rgba(0,0,0,0.08);}' +
      '.scr-tile:hover{border-color:#d4729a;transform:translateY(-2px);}' +
      '.scr-tile:active{cursor:grabbing;}' +
      '.scr-tile.scr-dragging{opacity:0.25;transform:scale(0.95);}' +
      '.scr-tile.scr-correct{border-color:#27ae60;background:#e8f8e8;color:#1a6e3a;}' +
      '.scr-tile.scr-misplaced{border-color:#e6a817;background:#fff8e0;color:#6b4500;}' +
      '.scr-tile.scr-wrong{border-color:#c0392b;background:#fde8e8;' +
        'animation:scrShake 0.45s ease;}' +

      // Ghost (dragging clone)
      '.scr-tile-ghost{position:fixed;z-index:10000;pointer-events:none;' +
        'padding:10px 16px;background:#fff;border:2px solid #d4729a;' +
        'border-radius:10px;font-family:"Noto Sans JP",sans-serif;' +
        'font-size:1.05rem;font-weight:600;color:#2f3542;' +
        'box-shadow:0 10px 28px rgba(0,0,0,0.18);transform:scale(1.06);}' +

      // Action buttons
      '.scr-actions{padding:0 4px;}' +
      '.scr-btn-check{display:block;width:100%;padding:13px;border:none;' +
        'border-radius:12px;font-weight:700;font-size:0.93rem;cursor:pointer;' +
        'color:#fff;background:linear-gradient(135deg,#d4729a 0%,#b8527e 100%);' +
        'box-shadow:0 4px 12px rgba(212,114,154,0.3);' +
        'transition:opacity 0.15s,transform 0.1s;}' +
      '.scr-btn-check:active:not(:disabled){transform:scale(0.97);}' +
      '.scr-btn-check:disabled{opacity:0.3;cursor:default;box-shadow:none;}' +

      // Explanation
      '.scr-explain{margin-top:12px;padding:14px;background:#e8f8e8;' +
        'border-radius:12px;border:1px solid #c0e0c0;}' +
      '.scr-explain-text{color:#2a6e3a;font-size:0.82rem;line-height:1.55;}' +

      // Next button
      '.scr-btn-next{display:block;width:100%;padding:13px;margin-top:10px;' +
        'border:none;border-radius:12px;font-weight:700;font-size:0.93rem;' +
        'cursor:pointer;color:#fff;' +
        'background:linear-gradient(135deg,#27ae60 0%,#1e8c4c 100%);' +
        'box-shadow:0 4px 12px rgba(39,174,96,0.3);}' +
      '.scr-btn-next:active{transform:scale(0.97);}' +

      // Result screen
      '.scr-result{text-align:center;padding:40px 16px;}' +
      '.scr-result-stamp img{width:80px;height:80px;margin-bottom:8px;}' +
      '.scr-result-msg{font-size:1.1rem;font-weight:800;color:#2f3542;margin:12px 0 20px;}' +
      '.scr-btn-full{display:block;width:100%;padding:13px;border:none;' +
        'border-radius:12px;font-weight:700;font-size:0.93rem;cursor:pointer;margin-top:8px;}' +
      '.scr-btn-full:active{transform:scale(0.97);}' +
      '.scr-btn-full-primary{color:#fff;' +
        'background:linear-gradient(135deg,#d4729a 0%,#b8527e 100%);}' +
      '.scr-btn-full-sec{color:#d4729a;background:#fdf2f6;' +
        'border:1.5px solid #e8c0d4;}' +
      '.scr-btn-full-warn{color:#fff;' +
        'background:linear-gradient(135deg,#e67e22 0%,#c0392b 100%);}' +

      // Empty state
      '.scr-empty{text-align:center;padding:40px 16px;}' +
      '.scr-empty-icon{font-size:2.4rem;margin-bottom:12px;}' +
      '.scr-empty-msg{font-size:0.92rem;color:#747d8c;line-height:1.6;margin-bottom:20px;}' +

      // Animations
      '@keyframes scrShake{0%,100%{transform:translateX(0)}' +
        '15%,45%,75%{transform:translateX(-5px)}' +
        '30%,60%,90%{transform:translateX(5px)}}' +
      '@keyframes scrSlideIn{0%{opacity:0;transform:translateY(-8px)}' +
        '100%{opacity:1;transform:translateY(0)}}' +
      '.scr-game{animation:scrSlideIn 0.25s ease;}';

    document.head.appendChild(s);
  }

  // ── Helpers ───────────────────────────────────────────────────────
  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) { if (a[i] !== b[i]) return false; }
    return true;
  }

  // Returns array of 'correct'|'misplaced'|'wrong' for each placed tile vs the correct answer.
  function getTileColors(placed, correct) {
    var colors = [];
    var correctCopy = correct.slice();
    var placedUsed = [];
    var i, j;
    for (i = 0; i < placed.length; i++) { colors.push('wrong'); placedUsed.push(false); }
    // Pass 1: exact matches
    for (i = 0; i < placed.length; i++) {
      if (i < correctCopy.length && placed[i] === correctCopy[i]) {
        colors[i] = 'correct';
        correctCopy[i] = null;
        placedUsed[i] = true;
      }
    }
    // Pass 2: misplaced (right word, wrong spot)
    for (i = 0; i < placed.length; i++) {
      if (placedUsed[i]) continue;
      for (j = 0; j < correctCopy.length; j++) {
        if (correctCopy[j] === placed[i]) {
          colors[i] = 'misplaced';
          correctCopy[j] = null;
          break;
        }
      }
    }
    return colors;
  }

  // ── Per-puzzle persistence ────────────────────────────────────────
  var RESULT_KEY = 'k-scr-';

  function savePuzzleResult(id, status) {
    var existing = getPuzzleResult(id);
    if (status === 'failed' && existing && existing.status === 'complete') return;
    var tilt = existing && existing.tilt !== undefined
      ? existing.tilt
      : (Math.floor(Math.random() * 41) - 20);
    try {
      localStorage.setItem(RESULT_KEY + id,
        JSON.stringify({ status: status, ts: Date.now(), tilt: tilt }));
    } catch (e) {}
  }

  function getPuzzleResult(id) {
    try {
      var raw = localStorage.getItem(RESULT_KEY + id);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  // ── Module-level state ────────────────────────────────────────────
  var cfg       = {};
  var container = null;
  var allSets   = [];
  var dataCache = null;

  // Per-set session state
  var currentSet   = null;
  var currentIndex = 0;
  var slotTiles    = [];
  var bankTiles    = [];
  var locked       = false;
  var lastColors   = null; // persisted tile colors from last wrong check

  // Drag state
  var drag    = null;
  var ghostEl = null;

  // ── Data loading ──────────────────────────────────────────────────
  function loadData(level, cb) {
    if (dataCache) { cb(null, dataCache); return; }
    var path = 'data/' + level + '/scramble/scramble.' + level + '.json';
    var url  = window.getAssetUrl(cfg.config, path) + '?t=' + Date.now();
    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) { dataCache = data; cb(null, data); })
      .catch(function (e)   { cb(e); });
  }

  // ── Init ──────────────────────────────────────────────────────────
  function init(containerEl, ctx) {
    injectStyles();
    cfg       = ctx;
    container = containerEl;
    container.innerHTML = '';
    allSets      = [];
    locked       = false;
    lastColors   = null;
    slotTiles    = [];
    bankTiles    = [];
    currentSet   = null;
    currentIndex = 0;
    cleanupDrag();

    // Ensure character stamps are loaded before picker renders
    var stampApi = window.JPShared && window.JPShared.stampSettings;
    if (stampApi && stampApi.loadCharacters) stampApi.loadCharacters();

    var level = cfg.level || 'N5';
    container.innerHTML =
      '<div class="scr-wrap" style="text-align:center;padding:32px;' +
      'color:#a89cc8;font-size:0.9rem;">Loading\u2026</div>';

    loadData(level, function (err, data) {
      if (err) {
        container.innerHTML =
          '<div class="scr-wrap"><div class="scr-empty">' +
          '<div class="scr-empty-icon">\u26A0\uFE0F</div>' +
          '<div class="scr-empty-msg">Could not load sentences.<br>' +
          'Please check your connection.</div>' +
          '<button class="scr-btn-full scr-btn-full-sec" id="scr-err-exit">Exit</button>' +
          '</div></div>';
        document.getElementById('scr-err-exit').onclick = function () {
          if (cfg.onExit) cfg.onExit();
        };
        return;
      }

      var sets = (data.sets || []).filter(function (s) {
        if (!s.requires || !cfg.activeLessons) return true;
        return s.requires.every(function (r) {
          return cfg.activeLessons.has(r);
        });
      });

      if (sets.length === 0) {
        container.innerHTML =
          '<div class="scr-wrap"><div class="scr-empty">' +
          '<div class="scr-empty-icon">\uD83D\uDCDD</div>' +
          '<div class="scr-empty-msg">No sentence sets unlocked yet!<br>' +
          'Complete more lessons to unlock.</div>' +
          '<button class="scr-btn-full scr-btn-full-sec" id="scr-nopuz-exit">' +
          'Back to Menu</button>' +
          '</div></div>';
        document.getElementById('scr-nopuz-exit').onclick = function () {
          if (cfg.onExit) cfg.onExit();
        };
        return;
      }

      allSets = sets;
      renderPicker();
    });
  }

  // ── Picker ────────────────────────────────────────────────────────
  function renderPicker() {
    if (window.JPShared && window.JPShared.streak) {
      window.JPShared.streak.recordActivity();
    }

    var stampApi = window.JPShared && window.JPShared.stampSettings;
    var stampUrl = stampApi && stampApi.getStampUrl ? stampApi.getStampUrl() : '';
    var pooUrl   = stampApi && stampApi.getPooUrl   ? stampApi.getPooUrl()   : '';

    var completedCount = 0;
    allSets.forEach(function (s) {
      var r = getPuzzleResult(s.id);
      if (r && r.status === 'complete') completedCount++;
    });
    if (cfg.onProgress) cfg.onProgress(completedCount, allSets.length);

    var html = '<div class="scr-wrap">';
    html += '<div class="scr-pick-hdr">Sentence Builder</div>';
    html += '<div class="scr-pick-list">';

    allSets.forEach(function (s, i) {
      var result = getPuzzleResult(s.id);
      var tilt   = result ? result.tilt : 0;

      html += '<div class="scr-pick-item" data-idx="' + i + '">';
      html += '<div class="scr-pick-num">' + (i + 1) + '</div>';
      html += '<div class="scr-pick-info">';
      html += '<div class="scr-pick-title">' + esc(s.title) + '</div>';
      html += '<div class="scr-pick-sub">' + s.items.length + ' sentences</div>';
      html += '</div>';

      if (result && result.status === 'complete' && stampUrl) {
        html += '<div class="scr-pick-badge">' +
          '<img src="' + esc(stampUrl) + '" alt="\u2713"' +
          ' style="transform:rotate(' + tilt + 'deg);">' +
          '</div>';
      } else if (result && result.status === 'failed' && pooUrl) {
        html += '<div class="scr-pick-badge">' +
          '<img src="' + esc(pooUrl) + '" alt="\u2717"' +
          ' style="transform:rotate(' + tilt + 'deg);">' +
          '</div>';
      } else {
        html += '<span class="scr-pick-go">Go \u2192</span>';
      }

      html += '</div>';
    });

    html += '</div></div>';
    container.innerHTML = html;

    container.querySelectorAll('.scr-pick-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var idx = parseInt(item.dataset.idx, 10);
        startSet(allSets[idx]);
      });
    });
  }

  // ── Start a set ───────────────────────────────────────────────────
  function startSet(set) {
    currentSet   = set;
    currentIndex = 0;
    prepareItem();
  }

  function prepareItem() {
    var item     = currentSet.items[currentIndex];
    locked       = false;
    lastColors   = null;
    cleanupDrag();

    var allWords = item.segments.concat(item.distractors || []);
    bankTiles    = shuffle(allWords.slice());
    slotTiles    = [];
    renderGame();
  }

  // ── Render game view ──────────────────────────────────────────────
  function renderGame() {
    var item  = currentSet.items[currentIndex];
    var total = currentSet.items.length;

    var html = '<div class="scr-game">';

    // Header
    html += '<div class="scr-game-hdr">';
    html += '<button class="scr-btn-back-sm" id="scr-back">\u2190 Sets</button>';
    html += '<div class="scr-progress-dots">';
    for (var d = 0; d < total; d++) {
      var cls = d < currentIndex ? ' scr-dot-done'
              : d === currentIndex ? ' scr-dot-active' : '';
      html += '<span class="scr-dot' + cls + '"></span>';
    }
    html += '</div>';
    html += '<div class="scr-progress-text">' + (currentIndex + 1) + '/' + total + '</div>';
    html += '</div>';

    // Prompt
    html += '<div class="scr-prompt">' + esc(item.q) + '</div>';

    // Slot area
    html += '<div class="scr-slot-area" id="scr-slot-area">';
    if (slotTiles.length === 0) {
      html += '<div class="scr-slot-empty">Tap or drag words to build the sentence</div>';
    }
    html += '<div class="scr-slot" id="scr-slot">';
    slotTiles.forEach(function (t, i) {
      var colorCls = (lastColors && lastColors[i]) ? (' scr-' + lastColors[i]) : '';
      html += '<div class="scr-tile' + colorCls + '" data-zone="slot" data-idx="' + i + '">' +
        esc(t) + '</div>';
    });
    html += '</div></div>';

    // Bank
    html += '<div class="scr-bank" id="scr-bank">';
    bankTiles.forEach(function (t, i) {
      html += '<div class="scr-tile" data-zone="bank" data-idx="' + i + '">' +
        esc(t) + '</div>';
    });
    html += '</div>';

    // Actions
    html += '<div class="scr-actions">';
    html += '<button class="scr-btn-check" id="scr-check"' +
      (slotTiles.length === 0 ? ' disabled' : '') + '>Check</button>';
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;

    // Wire events
    wireEvents();
  }

  // ── Event wiring ──────────────────────────────────────────────────
  function wireEvents() {
    container.querySelectorAll('.scr-tile').forEach(function (tile) {
      tile.addEventListener('pointerdown', onPointerDown);
    });

    var backBtn = document.getElementById('scr-back');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        savePuzzleResult(currentSet.id, 'failed');
        currentSet = null;
        renderPicker();
      });
    }

    var checkBtn = document.getElementById('scr-check');
    if (checkBtn) {
      checkBtn.addEventListener('click', checkAnswer);
    }
  }

  // ── Drag / tap system ─────────────────────────────────────────────
  function onPointerDown(e) {
    if (locked) return;
    var tile = e.target.closest('.scr-tile');
    if (!tile) return;

    e.preventDefault();
    tile.setPointerCapture(e.pointerId);

    var zone = tile.dataset.zone;
    var idx  = parseInt(tile.dataset.idx, 10);

    drag = {
      active:  false,
      el:      tile,
      zone:    zone,
      idx:     idx,
      text:    zone === 'bank' ? bankTiles[idx] : slotTiles[idx],
      startX:  e.clientX,
      startY:  e.clientY,
      offsetX: 0,
      offsetY: 0
    };

    tile.addEventListener('pointermove', onPointerMove);
    tile.addEventListener('pointerup', onPointerUp);
    tile.addEventListener('pointercancel', onPointerCancel);
  }

  function onPointerMove(e) {
    if (!drag) return;

    var dx = e.clientX - drag.startX;
    var dy = e.clientY - drag.startY;

    if (!drag.active && (dx * dx + dy * dy) > 36) {
      drag.active = true;
      var rect = drag.el.getBoundingClientRect();
      drag.offsetX = e.clientX - rect.left;
      drag.offsetY = e.clientY - rect.top;
      drag.el.classList.add('scr-dragging');

      var ghost = document.createElement('div');
      ghost.className = 'scr-tile-ghost';
      ghost.textContent = drag.text;
      ghost.style.width = rect.width + 'px';
      ghost.style.left = (e.clientX - drag.offsetX) + 'px';
      ghost.style.top  = (e.clientY - drag.offsetY) + 'px';
      document.body.appendChild(ghost);
      ghostEl = ghost;
    }

    if (drag.active && ghostEl) {
      ghostEl.style.left = (e.clientX - drag.offsetX) + 'px';
      ghostEl.style.top  = (e.clientY - drag.offsetY) + 'px';

      // Highlight slot area when dragging over it
      var slotArea = container.querySelector('#scr-slot-area');
      if (slotArea) {
        var sr = slotArea.getBoundingClientRect();
        var over = e.clientY >= sr.top - 30 && e.clientY <= sr.bottom + 30 &&
                   e.clientX >= sr.left - 30 && e.clientX <= sr.right + 30;
        slotArea.classList.toggle('scr-drop-active', over);
      }
    }
  }

  function onPointerUp(e) {
    if (!drag) return;
    finishDrag(e);
  }

  function onPointerCancel(e) {
    if (!drag) return;
    finishDrag(e);
  }

  function finishDrag(e) {
    var d = drag;
    drag = null;

    d.el.removeEventListener('pointermove', onPointerMove);
    d.el.removeEventListener('pointerup', onPointerUp);
    d.el.removeEventListener('pointercancel', onPointerCancel);

    if (d.active) {
      d.el.classList.remove('scr-dragging');
      if (ghostEl) { ghostEl.remove(); ghostEl = null; }

      var slotArea = container.querySelector('#scr-slot-area');
      if (slotArea) slotArea.classList.remove('scr-drop-active');

      var sr = slotArea ? slotArea.getBoundingClientRect()
             : { top: 0, bottom: 0, left: 0, right: 0 };
      var inSlot = e.clientY >= sr.top - 30 && e.clientY <= sr.bottom + 30 &&
                   e.clientX >= sr.left - 30 && e.clientX <= sr.right + 30;

      lastColors = null;
      if (d.zone === 'bank') {
        if (inSlot) {
          bankTiles.splice(d.idx, 1);
          var ins = getSlotInsertIdx(e.clientX, -1);
          slotTiles.splice(ins, 0, d.text);
        }
        // else stays in bank
      } else {
        // From slot
        slotTiles.splice(d.idx, 1);
        if (inSlot) {
          var ins = getSlotInsertIdx(e.clientX, d.idx);
          slotTiles.splice(ins, 0, d.text);
        } else {
          bankTiles.push(d.text);
        }
      }
      renderGame();
    } else {
      // Tap: toggle between zones
      lastColors = null;
      if (d.zone === 'bank') {
        bankTiles.splice(d.idx, 1);
        slotTiles.push(d.text);
      } else {
        slotTiles.splice(d.idx, 1);
        bankTiles.push(d.text);
      }
      renderGame();
    }
  }

  function getSlotInsertIdx(clientX, skipIdx) {
    var slotEl = container.querySelector('#scr-slot');
    if (!slotEl) return 0;
    var tiles = slotEl.querySelectorAll('.scr-tile');
    var pos = 0;
    for (var i = 0; i < tiles.length; i++) {
      if (i === skipIdx) continue;
      var rect = tiles[i].getBoundingClientRect();
      if (clientX < rect.left + rect.width / 2) return pos;
      pos++;
    }
    return pos;
  }

  function cleanupDrag() {
    if (ghostEl) { ghostEl.remove(); ghostEl = null; }
    drag = null;
  }

  // ── Answer checking ───────────────────────────────────────────────
  function checkAnswer() {
    if (locked || slotTiles.length === 0) return;
    locked = true;

    var item    = currentSet.items[currentIndex];
    var correct = arraysEqual(slotTiles, item.segments);
    if (!correct && item.alts) {
      for (var a = 0; a < item.alts.length; a++) {
        if (arraysEqual(slotTiles, item.alts[a])) { correct = true; break; }
      }
    }

    var tiles = container.querySelectorAll('#scr-slot .scr-tile');
    if (correct) {
      tiles.forEach(function (t) { t.classList.add('scr-correct'); });
      showExplanation(item);
    } else {
      lastColors = getTileColors(slotTiles, item.segments);
      tiles.forEach(function (t, i) {
        var cls = lastColors[i] === 'correct' ? 'scr-correct'
                : lastColors[i] === 'misplaced' ? 'scr-misplaced'
                : 'scr-wrong';
        t.classList.add(cls);
      });
      setTimeout(function () { locked = false; }, 550);
    }
  }

  function showExplanation(item) {
    var actionsEl = container.querySelector('.scr-actions');
    if (!actionsEl) return;

    var isLast = currentIndex >= currentSet.items.length - 1;

    actionsEl.innerHTML =
      '<div class="scr-explain"><div class="scr-explain-text">' +
      esc(item.explanation) + '</div></div>' +
      '<button class="scr-btn-next" id="scr-next">' +
      (isLast ? 'Finish \u2713' : 'Next \u2192') + '</button>';

    document.getElementById('scr-next').addEventListener('click', function () {
      currentIndex++;
      if (currentIndex < currentSet.items.length) {
        prepareItem();
      } else {
        savePuzzleResult(currentSet.id, 'complete');
        if (cfg.onComplete) cfg.onComplete();
        showResult(true);
      }
    });
  }

  // ── Result screen ─────────────────────────────────────────────────
  function showResult(completed) {
    var stampApi = window.JPShared && window.JPShared.stampSettings;
    var stampUrl = stampApi && stampApi.getStampUrl ? stampApi.getStampUrl() : '';
    var pooUrl   = stampApi && stampApi.getPooUrl   ? stampApi.getPooUrl()   : '';

    var html = '<div class="scr-wrap"><div class="scr-result">';

    if (completed) {
      if (stampUrl) {
        html += '<div class="scr-result-stamp">' +
          '<img src="' + esc(stampUrl) + '" alt="\u2605"></div>';
      }
      html += '<div class="scr-result-msg">Set Complete!</div>';
      html += '<button class="scr-btn-full scr-btn-full-primary" id="scr-res-back">' +
        'Back to Sets</button>';
    } else {
      if (pooUrl) {
        html += '<div class="scr-result-stamp">' +
          '<img src="' + esc(pooUrl) + '" alt="\u2717"></div>';
      }
      html += '<div class="scr-result-msg">Set Incomplete</div>';
      html += '<button class="scr-btn-full scr-btn-full-warn" id="scr-res-retry">' +
        'Retry</button>';
      html += '<button class="scr-btn-full scr-btn-full-sec" id="scr-res-back">' +
        'Back to Sets</button>';
    }

    html += '</div></div>';
    container.innerHTML = html;

    var retry = document.getElementById('scr-res-retry');
    if (retry) {
      retry.addEventListener('click', function () { startSet(currentSet); });
    }
    document.getElementById('scr-res-back').addEventListener('click', function () {
      currentSet = null;
      renderPicker();
    });
  }

  // ── Destroy ───────────────────────────────────────────────────────
  function destroy() {
    cleanupDrag();
    if (container) container.innerHTML = '';
    container  = null;
    cfg        = {};
    allSets    = [];
    currentSet = null;
    locked     = false;
    // dataCache intentionally preserved across init/destroy cycles
  }

  window.JPShared.scramble = { init: init, destroy: destroy };
})();

/**
 * app/games/connections.js
 * Link Up: Sorted — drag-and-drop vocabulary sorting game.
 * Second game module under the Practice.js plugin architecture.
 *
 * Shell contract:
 *   Practice.js owns chrome (progress counter, hanabi, session tracking).
 *   This module owns everything inside its container div.
 *   Shell passes: container, level ('N5'|'N4'), activeLessons, config,
 *                 onComplete, onExit, onProgress.
 *
 * Data format (connections.N5.json / connections.N4.json):
 *   { puzzles: [{ id, requires, groups: [{ label, words[] }] }] }
 *   N5 puzzles have 3 groups; N4 puzzles have 4 groups.
 */
(function () {
  'use strict';

  window.JPShared = window.JPShared || {};

  // ── CSS (injected once) ────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('jp-conn-style')) return;
    var s = document.createElement('style');
    s.id = 'jp-conn-style';
    s.textContent =
      '.conn-wrap{font-family:"Poppins","Noto Sans JP",sans-serif;}' +

      // Columns grid — column count set inline per puzzle
      '.conn-columns{display:grid;gap:8px;margin-bottom:14px;}' +
      '@media (max-width:500px){.conn-columns{grid-template-columns:1fr!important;}}' +

      '.conn-col{border:2px dashed #dfe4ea;border-radius:14px;padding:10px;min-height:110px;' +
        'background:#fafafa;display:flex;flex-direction:column;transition:border-color 0.2s,background 0.2s;}' +
      '.conn-col.drag-over{border-color:#d4729a;border-style:solid;background:#fff5f5;}' +
      '.conn-col.correct{border-color:#2ed573;border-style:solid;background:#f0fff4;}' +
      '.conn-col.wrong{border-color:#ff4757;border-style:solid;background:#fff5f5;animation:connShake 0.45s ease;}' +
      '.conn-col-label{font-weight:800;font-size:0.82rem;text-align:center;padding-bottom:6px;' +
        'border-bottom:2px solid #eee;margin-bottom:8px;line-height:1.4;color:#2f3542;}' +
      '.conn-col.correct .conn-col-label{border-bottom-color:#2ed573;color:#155724;}' +
      '.conn-col.wrong .conn-col-label{border-bottom-color:#ff4757;color:#721c24;}' +
      '.conn-col-body{flex:1;display:flex;flex-direction:column;gap:5px;}' +

      // Placed word chips (inside columns)
      '.conn-placed{display:flex;align-items:center;justify-content:space-between;' +
        'padding:7px 10px;border-radius:9px;background:white;border:1.5px solid #e0e0e0;' +
        'font-size:0.97rem;font-family:"Noto Sans JP",sans-serif;cursor:grab;user-select:none;' +
        'animation:connPop 0.22s ease;touch-action:none;}' +
      '.conn-placed:hover{border-color:#d4729a;background:#fff5f5;}' +
      '.conn-placed .conn-remove{font-size:0.72rem;color:#bbb;margin-left:8px;flex-shrink:0;' +
        'cursor:pointer;line-height:1;padding:2px 4px;border-radius:3px;}' +
      '.conn-placed .conn-remove:hover{color:#d4729a;background:#ffe0e0;}' +
      '.conn-placed.is-dragging{opacity:0.2;}' +

      // Word bank
      '.conn-bank-hdr{text-align:center;font-size:0.7rem;font-weight:700;text-transform:uppercase;' +
        'color:#aaa;letter-spacing:0.08em;margin-bottom:6px;}' +
      '.conn-bank{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;min-height:54px;' +
        'padding:10px;border:2px dashed #e0e0e0;border-radius:12px;background:#f8f8f8;' +
        'transition:border-color 0.2s,background 0.2s;}' +
      '.conn-bank.drag-over{border-color:#d4729a;border-style:solid;background:#fff5f5;}' +
      '.conn-bank-empty{width:100%;text-align:center;font-size:0.82rem;color:#bbb;' +
        'font-weight:600;padding:8px 0;pointer-events:none;}' +

      // Bank chips (available to drag)
      '.conn-chip{display:inline-flex;align-items:center;padding:9px 14px;border-radius:10px;' +
        'background:white;border:2px solid #dfe4ea;font-size:1rem;' +
        'font-family:"Noto Sans JP",sans-serif;font-weight:600;cursor:grab;user-select:none;' +
        'box-shadow:0 2px 6px rgba(0,0,0,0.06);transition:border-color 0.15s,box-shadow 0.15s;' +
        'touch-action:none;}' +
      '.conn-chip:hover{border-color:#d4729a;box-shadow:0 4px 12px rgba(212,114,154,0.12);}' +
      '.conn-chip.is-dragging{opacity:0.2;}' +
      '.conn-chip.placed{display:none;}' +

      // Floating ghost that follows the pointer during drag
      '.conn-ghost{position:fixed;pointer-events:none;z-index:9999;padding:9px 14px;' +
        'border-radius:10px;background:white;border:2px solid #d4729a;font-size:1rem;' +
        'font-family:"Noto Sans JP",sans-serif;font-weight:600;' +
        'box-shadow:0 8px 24px rgba(212,114,154,0.22);' +
        'transform:translate(-50%,-50%) rotate(2deg);opacity:0.93;white-space:nowrap;}' +

      // Check button
      '.conn-check-wrap{text-align:center;margin-top:12px;}' +
      '.conn-check-btn{padding:12px 36px;border:none;border-radius:12px;font-weight:700;' +
        'font-size:0.97rem;color:#fff;' +
        'background:linear-gradient(135deg,#d4729a 0%,#b8527e 100%);cursor:pointer;' +
        'box-shadow:0 4px 12px rgba(212,114,154,0.2);transition:opacity 0.15s,transform 0.1s;}' +
      '.conn-check-btn:disabled{opacity:0.3;cursor:default;box-shadow:none;}' +
      '.conn-check-btn:not(:disabled):hover{box-shadow:0 6px 18px rgba(212,114,154,0.28);}' +
      '.conn-check-btn:not(:disabled):active{transform:scale(0.97);}' +

      // Result panel (shown after checking)
      '.conn-result{text-align:center;margin-top:16px;padding:12px 0;}' +
      '.conn-result-msg{font-size:1rem;font-weight:700;margin-bottom:12px;}' +
      '.conn-result-ok{color:#2ed573;}' +
      '.conn-result-err{color:#ff4757;}' +

      // Animations
      '@keyframes connShake{0%,100%{transform:translateX(0)}' +
        '20%,60%{transform:translateX(-5px)}40%,80%{transform:translateX(5px)}}' +
      '@keyframes connPop{0%{transform:scale(0.75);opacity:0}' +
        '60%{transform:scale(1.06)}100%{transform:scale(1);opacity:1}}' +

      // Picker
      '.conn-pick-hdr{font-size:0.72rem;font-weight:700;text-transform:uppercase;' +
        'letter-spacing:0.08em;color:#aaa;margin-bottom:12px;}' +
      '.conn-pick-list{display:grid;grid-template-columns:1fr;gap:9px;}' +
      '.conn-pick-item{display:flex;align-items:center;gap:12px;padding:13px 15px;' +
        'border-radius:14px;background:white;border:1.5px solid #e0e0e0;cursor:pointer;' +
        'transition:transform 0.15s,box-shadow 0.15s,border-color 0.15s;}' +
      '.conn-pick-item:hover{transform:translateY(-3px);' +
        'box-shadow:0 8px 20px rgba(212,114,154,0.1);border-color:#d4729a;}' +
      '.conn-pick-num{font-weight:900;font-size:0.9rem;color:#d4729a;min-width:22px;' +
        'flex-shrink:0;}' +
      '.conn-pick-info{flex:1;min-width:0;}' +
      '.conn-pick-title{font-weight:700;font-size:0.88rem;color:#2f3542;}' +
      '.conn-pick-sub{font-size:0.72rem;color:#747d8c;margin-top:2px;' +
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.conn-pick-badge{width:44px;height:44px;flex-shrink:0;' +
        'display:flex;align-items:center;justify-content:center;}' +
      '.conn-pick-badge img{width:100%;height:100%;object-fit:contain;opacity:0.85;}' +
      '.conn-pick-go{font-size:0.82rem;font-weight:700;color:#d4729a;flex-shrink:0;}' +
      '@keyframes connPickPop{0%{transform:scale(2) rotate(0deg);opacity:0}' +
        '60%{transform:scale(0.9)}100%{transform:scale(1);opacity:0.85}}' +
      '.conn-pick-badge img{animation:connPickPop 0.3s ease;}' +

      // Shared action buttons
      '.conn-btn-primary{display:block;width:100%;max-width:240px;margin:6px auto;padding:12px;' +
        'border:none;border-radius:10px;font-weight:700;font-size:0.95rem;cursor:pointer;' +
        'color:#fff;background:linear-gradient(135deg,#d4729a 0%,#b8527e 100%);}' +
      '.conn-btn-secondary{display:block;width:100%;max-width:240px;margin:6px auto;padding:12px;' +
        'border:none;border-radius:10px;font-weight:700;font-size:0.95rem;cursor:pointer;' +
        'color:#d4729a;background:#fff0f5;}' +

      // No puzzles / error states
      '.conn-no-puzzles{text-align:center;padding:36px 16px;}' +
      '.conn-no-puzzles-icon{font-size:2.4rem;margin-bottom:12px;}' +
      '.conn-no-puzzles-msg{font-size:0.95rem;color:#747d8c;line-height:1.6;margin-bottom:20px;}' +
      '';
    document.head.appendChild(s);
  }

  // ── Helpers ────────────────────────────────────────────────────────
  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function findChip(word) {
    var els = container.querySelectorAll('.conn-chip');
    for (var i = 0; i < els.length; i++) {
      if (els[i].dataset.word === word) return els[i];
    }
    return null;
  }

  function findPlaced(word) {
    var els = container.querySelectorAll('.conn-placed');
    for (var i = 0; i < els.length; i++) {
      if (els[i].dataset.word === word) return els[i];
    }
    return null;
  }

  // ── Per-puzzle persistence ─────────────────────────────────────────
  var RESULT_KEY = 'k-conn-';

  function savePuzzleResult(puzzleId, status) {
    // status: 'complete' | 'failed'
    // tilt: random -20..+20 deg, stored once so it's stable on re-render
    var existing = getPuzzleResult(puzzleId);
    var tilt = existing && existing.tilt !== undefined
      ? existing.tilt
      : (Math.floor(Math.random() * 41) - 20);
    try {
      localStorage.setItem(RESULT_KEY + puzzleId,
        JSON.stringify({ status: status, ts: Date.now(), tilt: tilt }));
    } catch (e) {}
  }

  function getPuzzleResult(puzzleId) {
    try {
      var raw = localStorage.getItem(RESULT_KEY + puzzleId);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  // ── Module-level state ─────────────────────────────────────────────
  var cfg         = {};
  var container   = null;
  var allAvailable = [];   // all unlocked puzzles (ordered, unshuffled)
  var dataCaches  = {};    // { 'N5': data, 'N4': data }

  // Per-puzzle state (reset on each playSinglePuzzle call)
  var currentPuzzle = null;
  var allWords    = [];
  var placements  = {};    // word → groupIdx (number)
  var checking    = false;
  var advanceTimer = null;

  // Drag state
  var dragWord = null;
  var dragFrom = null;
  var ghostEl  = null;
  var sourceEl = null;

  // ── Data loading ───────────────────────────────────────────────────
  function loadData(level, cb) {
    if (dataCaches[level]) { cb(null, dataCaches[level]); return; }
    var path = 'data/' + level + '/connections/connections.' + level + '.json';
    var url  = window.getAssetUrl(cfg.config, path) + '?t=' + Date.now();
    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        dataCaches[level] = data;
        cb(null, data);
      })
      .catch(function (e) { cb(e); });
  }

  // ── Initialization ─────────────────────────────────────────────────
  function init(containerEl, ctx) {
    if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null; }
    if (ghostEl) { ghostEl.remove(); ghostEl = null; }

    injectStyles();
    cfg           = ctx;
    container     = containerEl;
    container.innerHTML = '';
    allAvailable  = [];
    checking      = false;
    dragWord      = null;
    dragFrom      = null;
    sourceEl      = null;

    var stampApi = window.JPShared && window.JPShared.stampSettings;
    if (stampApi && stampApi.loadCharacters) stampApi.loadCharacters();

    var level = cfg.level || 'N5';
    container.innerHTML =
      '<div class="conn-wrap" style="text-align:center;padding:32px;color:#aaa;font-size:0.9rem;">Loading…</div>';

    loadData(level, function (err, data) {
      if (err) {
        container.innerHTML =
          '<div class="conn-wrap"><div class="conn-no-puzzles">' +
          '<div class="conn-no-puzzles-icon">⚠️</div>' +
          '<div class="conn-no-puzzles-msg">Could not load puzzles.<br>Please check your connection.</div>' +
          '<button class="conn-btn-secondary" id="conn-err-exit">Exit</button>' +
          '</div></div>';
        document.getElementById('conn-err-exit').onclick = function () {
          if (cfg.onExit) cfg.onExit();
        };
        return;
      }

      var available = (data.puzzles || []).filter(function (p) {
        if (!p.requires || !cfg.activeLessons) return true;
        return p.requires.every(function (req) { return cfg.activeLessons.has(req); });
      });

      if (available.length === 0) {
        renderNoLessons(level);
        return;
      }

      allAvailable = available.slice();
      renderPicker();
    });
  }

  function renderNoLessons(level) {
    container.innerHTML =
      '<div class="conn-wrap"><div class="conn-no-puzzles">' +
      '<div class="conn-no-puzzles-icon">🔗</div>' +
      '<div class="conn-no-puzzles-msg">No Link Up puzzles available yet!<br>' +
      (level === 'N4'
        ? 'Complete more N4 lessons to unlock these puzzles.'
        : 'Select more lessons to unlock puzzles.<br>' +
          '<small style="color:#bbb;">Puzzles start unlocking around N5.5–N5.8.</small>') +
      '</div>' +
      '<button class="conn-btn-secondary" id="conn-nopuz-exit">Back to Menu</button>' +
      '</div></div>';
    document.getElementById('conn-nopuz-exit').onclick = function () {
      if (cfg.onExit) cfg.onExit();
    };
  }

  // ── Picker ─────────────────────────────────────────────────────────
  function renderPicker() {
    if (window.JPShared && window.JPShared.streak) {
      window.JPShared.streak.recordActivity();
    }

    var stampApi = window.JPShared && window.JPShared.stampSettings;
    var stampUrl = stampApi && stampApi.getStampUrl ? stampApi.getStampUrl() : '';
    var pooUrl   = stampApi && stampApi.getPooUrl   ? stampApi.getPooUrl()   : '';

    // Count completions for progress callback
    var completedCount = 0;
    allAvailable.forEach(function (p) {
      var r = getPuzzleResult(p.id);
      if (r && r.status === 'complete') completedCount++;
    });
    if (cfg.onProgress) cfg.onProgress(completedCount, allAvailable.length);

    var html = '<div class="conn-wrap">';
    html += '<div class="conn-pick-hdr">Select a puzzle</div>';
    html += '<div class="conn-pick-list">';

    allAvailable.forEach(function (p, i) {
      var result = getPuzzleResult(p.id);
      var labels = p.groups.map(function (g) { return g.label; }).join(' · ');
      var tilt   = result ? result.tilt : 0;

      html += '<div class="conn-pick-item" data-idx="' + i + '">';
      html += '<div class="conn-pick-num">' + (i + 1) + '</div>';
      html += '<div class="conn-pick-info">';
      html += '<div class="conn-pick-title">Puzzle ' + (i + 1) + '</div>';
      html += '<div class="conn-pick-sub">' + esc(labels) + '</div>';
      html += '</div>';

      if (result && result.status === 'complete' && stampUrl) {
        html += '<div class="conn-pick-badge">' +
          '<img src="' + esc(stampUrl) + '" alt="✓" style="transform:rotate(' + tilt + 'deg);">' +
          '</div>';
      } else if (result && result.status === 'failed' && pooUrl) {
        html += '<div class="conn-pick-badge">' +
          '<img src="' + esc(pooUrl) + '" alt="✗" style="transform:rotate(' + tilt + 'deg);">' +
          '</div>';
      } else {
        html += '<span class="conn-pick-go">Go →</span>';
      }

      html += '</div>';
    });

    html += '</div></div>';
    container.innerHTML = html;

    container.querySelectorAll('.conn-pick-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var idx = parseInt(item.dataset.idx, 10);
        playSinglePuzzle(allAvailable[idx]);
      });
    });
  }

  function playSinglePuzzle(puzzle) {
    currentPuzzle = puzzle;

    allWords = [];
    puzzle.groups.forEach(function (g) {
      g.words.forEach(function (w) { allWords.push(w); });
    });
    allWords = allWords.slice().sort(function () { return Math.random() - 0.5; });

    placements = {};
    checking   = false;

    var numGroups  = puzzle.groups.length;
    var colsStyle  = (numGroups <= 3)
      ? 'grid-template-columns:repeat(' + numGroups + ',1fr)'
      : 'grid-template-columns:1fr 1fr';

    var html = '<div class="conn-wrap">';
    html += '<div class="conn-columns" id="conn-cols" style="' + colsStyle + '">';
    puzzle.groups.forEach(function (g, i) {
      html += '<div class="conn-col" id="conn-col-' + i + '" data-group="' + i + '">';
      html += '<div class="conn-col-label">' + esc(g.label) + '</div>';
      html += '<div class="conn-col-body" id="conn-body-' + i + '"></div>';
      html += '</div>';
    });
    html += '</div>';

    html += '<div class="conn-bank-hdr">Drag words into the correct category</div>';
    html += '<div class="conn-bank" id="conn-bank">';
    allWords.forEach(function (w) {
      html += '<div class="conn-chip" data-word="' + esc(w) + '">' + esc(w) + '</div>';
    });
    html += '</div>';

    html += '<div class="conn-check-wrap">';
    html += '<button class="conn-check-btn" id="conn-check-btn" disabled>Check Answers</button>';
    html += '</div>';
    html += '</div>';

    container.innerHTML = html;
    setupInteraction();
  }

  // ── Interaction wiring ─────────────────────────────────────────────
  function setupInteraction() {
    container.querySelectorAll('.conn-chip').forEach(function (chip) {
      chip.addEventListener('pointerdown', onChipDown);
    });
    var btn = document.getElementById('conn-check-btn');
    if (btn) btn.addEventListener('click', checkAnswers);
  }

  function onChipDown(e) {
    if (checking) return;
    var chip = e.currentTarget;
    if (chip.classList.contains('placed')) return;
    startDrag(e, chip.dataset.word, 'bank', chip);
  }

  function makePlacedEl(word, gIdx) {
    var el = document.createElement('div');
    el.className = 'conn-placed';
    el.dataset.word  = word;
    el.dataset.group = gIdx;
    el.innerHTML = esc(word) + '<span class="conn-remove" title="Return to bank">✕</span>';

    el.addEventListener('pointerdown', function (e) {
      if (checking) return;
      if (e.target.classList.contains('conn-remove')) return;
      startDrag(e, word, parseInt(el.dataset.group), el);
    });

    el.querySelector('.conn-remove').addEventListener('click', function (e) {
      e.stopPropagation();
      if (checking) return;
      returnToBank(word, parseInt(el.dataset.group));
    });

    return el;
  }

  // ── Drag & Drop (Pointer Events API) ──────────────────────────────
  function startDrag(e, word, from, el) {
    e.preventDefault();
    dragWord = word;
    dragFrom = from;
    sourceEl = el;

    el.classList.add('is-dragging');
    try { el.setPointerCapture(e.pointerId); } catch (_) {}

    ghostEl = document.createElement('div');
    ghostEl.className = 'conn-ghost';
    ghostEl.textContent = word;
    ghostEl.style.left = e.clientX + 'px';
    ghostEl.style.top  = e.clientY + 'px';
    document.body.appendChild(ghostEl);

    el.addEventListener('pointermove',   onPointerMove);
    el.addEventListener('pointerup',     onPointerUp);
    el.addEventListener('pointercancel', onPointerCancel);
  }

  function onPointerMove(e) {
    if (!ghostEl) return;
    ghostEl.style.left = e.clientX + 'px';
    ghostEl.style.top  = e.clientY + 'px';

    ghostEl.style.display = 'none';
    var under = document.elementFromPoint(e.clientX, e.clientY);
    ghostEl.style.display = '';

    container.querySelectorAll('.conn-col.drag-over').forEach(function (c) {
      c.classList.remove('drag-over');
    });
    var bankEl = document.getElementById('conn-bank');
    if (bankEl) bankEl.classList.remove('drag-over');

    if (under) {
      var col  = under.closest('.conn-col');
      var bank = under.closest('#conn-bank');
      if (col)       col.classList.add('drag-over');
      else if (bank) bank.classList.add('drag-over');
    }
  }

  function onPointerUp(e) {
    if (!sourceEl) return;

    var word = dragWord;
    var from = dragFrom;

    ghostEl.style.display = 'none';
    var under = document.elementFromPoint(e.clientX, e.clientY);
    ghostEl.style.display = '';

    cleanupDragVisuals();
    dragWord = null; dragFrom = null; sourceEl = null;

    var col = under && under.closest('.conn-col');
    if (col) {
      var gIdx = parseInt(col.dataset.group);
      if (from !== gIdx) placeWord(word, from, gIdx);
    } else {
      if (from !== 'bank') returnToBank(word, from);
    }

    updateCheckBtn();
  }

  function onPointerCancel() {
    cleanupDragVisuals();
    dragWord = null; dragFrom = null; sourceEl = null;
  }

  function cleanupDragVisuals() {
    if (sourceEl) {
      sourceEl.classList.remove('is-dragging');
      sourceEl.removeEventListener('pointermove',   onPointerMove);
      sourceEl.removeEventListener('pointerup',     onPointerUp);
      sourceEl.removeEventListener('pointercancel', onPointerCancel);
    }
    if (ghostEl) { ghostEl.remove(); ghostEl = null; }
    container.querySelectorAll('.conn-col.drag-over').forEach(function (c) {
      c.classList.remove('drag-over');
    });
    var bankEl = document.getElementById('conn-bank');
    if (bankEl) bankEl.classList.remove('drag-over');
  }

  // ── Placement logic ────────────────────────────────────────────────
  function placeWord(word, fromSlot, toGroupIdx) {
    if (fromSlot === 'bank') {
      var chip = findChip(word);
      if (chip) chip.classList.add('placed');
    } else {
      var oldEl = findPlaced(word);
      if (oldEl) oldEl.remove();
    }

    placements[word] = toGroupIdx;
    var body = document.getElementById('conn-body-' + toGroupIdx);
    if (body) body.appendChild(makePlacedEl(word, toGroupIdx));

    syncBankEmpty();
  }

  function returnToBank(word, fromGroupIdx) {
    var el = findPlaced(word);
    if (el) el.remove();
    delete placements[word];

    var chip = findChip(word);
    if (chip) chip.classList.remove('placed');

    syncBankEmpty();
    updateCheckBtn();
  }

  function syncBankEmpty() {
    var bank = document.getElementById('conn-bank');
    if (!bank) return;
    var empty    = bank.querySelector('.conn-bank-empty');
    var allPlaced = Object.keys(placements).length === allWords.length;
    if (allPlaced && !empty) {
      var d = document.createElement('div');
      d.className  = 'conn-bank-empty';
      d.textContent = 'All words placed!';
      bank.appendChild(d);
    } else if (!allPlaced && empty) {
      empty.remove();
    }
  }

  function updateCheckBtn() {
    var btn = document.getElementById('conn-check-btn');
    if (btn) btn.disabled = Object.keys(placements).length < allWords.length;
  }

  // ── Checking answers ───────────────────────────────────────────────
  function checkAnswers() {
    if (checking) return;
    checking = true;

    var roundScore = 0;
    var allCorrect = true;

    currentPuzzle.groups.forEach(function (g, gIdx) {
      var groupCorrect = g.words.every(function (w) { return placements[w] === gIdx; });
      g.words.forEach(function (w) { if (placements[w] === gIdx) roundScore++; });

      var colEl = document.getElementById('conn-col-' + gIdx);
      if (colEl) colEl.classList.add(groupCorrect ? 'correct' : 'wrong');
      if (!groupCorrect) allCorrect = false;
    });

    // Freeze all interaction
    container.querySelectorAll('.conn-chip,.conn-placed').forEach(function (el) {
      el.style.pointerEvents = 'none';
      el.style.cursor = 'default';
    });
    var btn = document.getElementById('conn-check-btn');
    if (btn) btn.style.display = 'none';

    // Persist result
    savePuzzleResult(currentPuzzle.id, allCorrect ? 'complete' : 'failed');

    // Notify shell
    if (allCorrect && cfg.onComplete) cfg.onComplete();

    // Show result panel with action buttons
    var wrap = container.querySelector('.conn-wrap');
    if (wrap) {
      var panel = document.createElement('div');
      panel.className = 'conn-result';

      if (allCorrect) {
        panel.innerHTML =
          '<div class="conn-result-msg conn-result-ok">🎉 All correct!</div>' +
          '<button class="conn-btn-primary" id="conn-back">Back to Puzzles</button>';
      } else {
        panel.innerHTML =
          '<div class="conn-result-msg conn-result-err">' +
            roundScore + ' / ' + allWords.length + ' words in the right place' +
          '</div>' +
          '<button class="conn-btn-primary" id="conn-retry">Try Again</button>' +
          '<button class="conn-btn-secondary" id="conn-back">Back to Puzzles</button>';
      }
      wrap.appendChild(panel);

      var retryBtn = document.getElementById('conn-retry');
      if (retryBtn) {
        retryBtn.addEventListener('click', function () {
          playSinglePuzzle(currentPuzzle);
        });
      }
      var backBtn = document.getElementById('conn-back');
      if (backBtn) {
        backBtn.addEventListener('click', function () { renderPicker(); });
      }
    }
  }

  // ── Public API ─────────────────────────────────────────────────────
  window.JPShared.connectionsGame = {
    /**
     * Start (or restart) the game; lands on the puzzle picker.
     * @param {HTMLElement} containerEl  The shell-owned stage div to write into.
     * @param {Object}      ctx
     *   ctx.level          - 'N5' | 'N4'  (defaults to 'N5')
     *   ctx.activeLessons  - Set<string> of completed lesson IDs
     *   ctx.config         - REPO_CONFIG passed to window.getAssetUrl()
     *   ctx.onComplete()   - called when a puzzle is fully solved
     *   ctx.onExit()       - called when the player returns to the main menu
     *   ctx.onProgress(completedCount, total) - called when picker renders
     */
    init: function (containerEl, ctx) {
      init(containerEl, ctx);
    },

    /** Tear down — clean up DOM and any dangling timers. */
    destroy: function () {
      if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null; }
      if (ghostEl)      { ghostEl.remove(); ghostEl = null; }
      if (container)    { container.innerHTML = ''; }
      container    = null;
      cfg          = {};
      allAvailable = [];
      currentPuzzle = null;
      dragWord     = null;
      dragFrom     = null;
      sourceEl     = null;
      // dataCaches intentionally preserved for re-use across init/destroy cycles
    }
  };

})();

/**
 * app/games/connections4.js
 * Link Up: Hidden — word-grouping puzzle with festival/lantern theme.
 * Third game module under the Practice.js plugin architecture.
 *
 * Shell contract:
 *   Practice.js owns chrome (progress counter, hanabi, session tracking).
 *   This module owns everything inside its container div.
 *   Shell passes: container, level ('N4'), activeLessons, config,
 *                 onComplete, onExit, onProgress.
 *
 * Data format (connections.N4.json):
 *   { puzzles: [{ id, requires, groups: [{ label, words[] }] }] }
 *   N4 puzzles have 4 groups of 4 words each.
 *
 * Game rules:
 *   - 4×4 grid of word tiles; tap to select, submit groups of 4.
 *   - 4 lives (lanterns); lose one per wrong guess.
 *   - "One away" hint when guess overlaps a group by exactly 3.
 *   - Full puzzle solved → onComplete (shell triggers hanabi).
 *   - Out of lives → result screen with Retry + Back to Puzzles.
 */
(function () {
  'use strict';

  window.JPShared = window.JPShared || {};

  // ── Festival palette — lantern colors per group ────────────────────
  var LANTERN_BG   = ['#c0392b', '#d35400', '#1a6e3c', '#5b3a9e'];
  var LANTERN_TEXT = ['#fff',    '#fff',    '#fff',    '#fff'   ];

  // ── CSS (injected once) ───────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('jp-c4-style')) return;
    var s = document.createElement('style');
    s.id = 'jp-c4-style';
    s.textContent =
      '.c4-wrap{font-family:"Poppins","Noto Sans JP",sans-serif;}' +

      // Hint bar
      '.c4-hint{text-align:center;font-size:0.85rem;font-weight:600;color:#888;' +
        'margin-bottom:10px;min-height:20px;transition:color 0.25s;}' +
      '.c4-hint.c4-one-away{color:#d4729a;}' +
      '.c4-hint.c4-err{color:#c0392b;}' +
      '.c4-hint.c4-ok{color:#27ae60;}' +

      // Solved rows (animate in from above)
      '.c4-solved-zone{display:flex;flex-direction:column;gap:6px;margin-bottom:8px;}' +
      '.c4-solved-row{border-radius:12px;padding:10px 14px;' +
        'animation:c4SlideIn 0.4s cubic-bezier(0.34,1.56,0.64,1);}' +
      '.c4-solved-label{font-weight:800;font-size:0.72rem;text-transform:uppercase;' +
        'letter-spacing:0.07em;opacity:0.82;margin-bottom:2px;}' +
      '.c4-solved-words{font-size:0.93rem;font-weight:600;' +
        'font-family:"Noto Sans JP",sans-serif;}' +

      // Tile grid
      '.c4-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;' +
        'margin-bottom:10px;background:#fdf2f6;border-radius:14px;padding:10px;}' +
      '.c4-tile{background:#fff;border:2px solid #e0d0e0;color:#2f3542;' +
        'border-radius:10px;font-size:0.9rem;font-weight:700;' +
        'font-family:"Noto Sans JP",sans-serif;padding:0 5px;cursor:pointer;' +
        'transition:border-color 0.15s,background 0.15s,transform 0.12s,box-shadow 0.15s;' +
        'text-align:center;min-height:52px;display:flex;align-items:center;' +
        'justify-content:center;line-height:1.3;user-select:none;-webkit-user-select:none;}' +
      '.c4-tile:hover{background:#fff5f8;border-color:#d4729a;transform:translateY(-2px);}' +
      '.c4-tile.c4-sel{background:#fdf2f6;border-color:#d4729a;color:#b8527e;' +
        'box-shadow:0 0 12px rgba(212,114,154,0.3);transform:translateY(-3px);}' +

      // Lives (lanterns)
      '.c4-lives{display:flex;align-items:center;justify-content:center;' +
        'gap:8px;margin:8px 0 10px;}' +
      '.c4-lantern{font-size:1.45rem;transition:filter 0.5s,opacity 0.5s,transform 0.4s;}' +
      '.c4-lantern.c4-dim{filter:grayscale(1) brightness(0.45);opacity:0.35;' +
        'transform:scale(0.82);}' +
      '.c4-lives-lbl{font-size:0.78rem;font-weight:700;color:#888;margin-left:2px;}' +

      // Action buttons (in-game)
      '.c4-actions{display:flex;gap:8px;margin-top:6px;}' +
      '.c4-btn{flex:1;padding:12px;border:none;border-radius:12px;font-weight:700;' +
        'font-size:0.93rem;cursor:pointer;transition:opacity 0.15s,transform 0.1s;}' +
      '.c4-btn:active:not(:disabled){transform:scale(0.97);}' +
      '.c4-btn-primary{color:#fff;' +
        'background:linear-gradient(135deg,#d4729a 0%,#b8527e 100%);' +
        'box-shadow:0 4px 12px rgba(212,114,154,0.32);}' +
      '.c4-btn-sec{color:#d4729a;background:#fdf2f6;' +
        'border:1.5px solid #e8c0d4;}' +
      '.c4-btn:disabled{opacity:0.32;cursor:default;box-shadow:none;}' +

      // Stamp overlay (completion / poo)
      '.c4-stamp{text-align:center;margin:10px 0;}' +
      '.c4-stamp img{height:68px;display:block;margin:0 auto 4px;}' +
      '.c4-stamp-lbl{font-size:0.85rem;font-weight:700;}' +

      // Picker
      '.c4-pick-hdr{font-size:0.72rem;font-weight:700;text-transform:uppercase;' +
        'letter-spacing:0.08em;color:#888;margin-bottom:12px;}' +
      '.c4-pick-list{display:grid;grid-template-columns:1fr;gap:7px;}' +
      '.c4-pick-item{display:flex;align-items:center;gap:10px;padding:10px 13px;' +
        'border-radius:12px;background:#fff;border:1.5px solid #e8d8e8;cursor:pointer;' +
        'transition:transform 0.15s,box-shadow 0.15s,border-color 0.15s;}' +
      '.c4-pick-item:hover{transform:translateY(-2px);' +
        'box-shadow:0 6px 16px rgba(212,114,154,0.15);border-color:#d4729a;}' +
      '.c4-pick-num{font-weight:900;font-size:0.88rem;color:#d4729a;min-width:20px;' +
        'flex-shrink:0;}' +
      '.c4-pick-info{flex:1;min-width:0;}' +
      '.c4-pick-title{font-weight:700;font-size:0.88rem;color:#2f3542;}' +
      '.c4-pick-badge{width:44px;height:44px;flex-shrink:0;' +
        'display:flex;align-items:center;justify-content:center;}' +
      '.c4-pick-badge img{width:100%;height:100%;object-fit:contain;opacity:0.85;}' +
      '.c4-pick-go{font-size:0.82rem;font-weight:700;color:#d4729a;flex-shrink:0;}' +
      '@keyframes c4PickPop{0%{transform:scale(2) rotate(0deg);opacity:0}' +
        '60%{transform:scale(0.9)}100%{transform:scale(1);opacity:0.85}}' +
      '.c4-pick-badge img{animation:c4PickPop 0.3s ease;}' +

      // Shared action buttons (full-width)
      '.c4-btn-full{display:block;width:100%;padding:12px;border:none;border-radius:12px;' +
        'font-weight:700;font-size:0.93rem;cursor:pointer;margin-top:8px;}' +
      '.c4-btn-full-primary{color:#fff;' +
        'background:linear-gradient(135deg,#d4729a 0%,#b8527e 100%);}' +
      '.c4-btn-full-sec{color:#d4729a;background:#fdf2f6;' +
        'border:1.5px solid #e8c0d4;}' +

      // Empty / error
      '.c4-empty{text-align:center;padding:40px 16px;}' +
      '.c4-empty-icon{font-size:2.4rem;margin-bottom:12px;}' +
      '.c4-empty-msg{font-size:0.92rem;color:#747d8c;line-height:1.6;margin-bottom:20px;}' +

      // Keyframes
      '@keyframes c4SlideIn{' +
        '0%{opacity:0;transform:translateY(-10px) scale(0.96)}' +
        '100%{opacity:1;transform:translateY(0) scale(1)}}' +
      '@keyframes c4Shake{' +
        '0%,100%{transform:translateX(0)}' +
        '15%,45%,75%{transform:translateX(-5px)}' +
        '30%,60%,90%{transform:translateX(5px)}}' +
      '.c4-grid.c4-shaking{animation:c4Shake 0.45s ease;}';

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

  // ── Per-puzzle persistence ────────────────────────────────────────
  var RESULT_KEY = 'k-conn4-';

  function savePuzzleResult(puzzleId, status) {
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

  // ── Module-level state ────────────────────────────────────────────
  var cfg          = {};
  var container    = null;
  var allAvailable = [];
  var dataCache    = null;      // preserved across init/destroy cycles
  var advanceTimer = null;

  // Per-puzzle state (reset in playSinglePuzzle)
  var puzzle    = null;
  var remaining = [];
  var solved    = [];
  var selected  = [];
  var lives     = 4;
  var locked    = false;

  // ── Data loading ──────────────────────────────────────────────────
  function loadData(level, cb) {
    if (dataCache) { cb(null, dataCache); return; }
    var path = 'data/' + level + '/connections/connections.' + level + '.json';
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
    if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null; }

    injectStyles();
    cfg          = ctx;
    container    = containerEl;
    container.innerHTML = '';
    allAvailable = [];
    locked       = false;

    var stampApi = window.JPShared && window.JPShared.stampSettings;
    if (stampApi && stampApi.loadCharacters) stampApi.loadCharacters();

    var level = cfg.level || 'N4';
    container.innerHTML =
      '<div class="c4-wrap" style="text-align:center;padding:32px;' +
      'color:#a89cc8;font-size:0.9rem;">Loading…</div>';

    loadData(level, function (err, data) {
      if (err) {
        container.innerHTML =
          '<div class="c4-wrap"><div class="c4-empty">' +
          '<div class="c4-empty-icon">⚠️</div>' +
          '<div class="c4-empty-msg">Could not load puzzles.<br>' +
          'Please check your connection.</div>' +
          '<button class="c4-btn-full c4-btn-full-sec" id="c4-err-exit">Exit</button>' +
          '</div></div>';
        document.getElementById('c4-err-exit').onclick = function () {
          if (cfg.onExit) cfg.onExit();
        };
        return;
      }

      var available = (data.puzzles || []).filter(function (p) {
        if (!p.requires || !cfg.activeLessons) return true;
        return p.requires.every(function (req) {
          return cfg.activeLessons.has(req);
        });
      });

      if (available.length === 0) {
        container.innerHTML =
          '<div class="c4-wrap"><div class="c4-empty">' +
          '<div class="c4-empty-icon">🏮</div>' +
          '<div class="c4-empty-msg">No puzzles unlocked yet!<br>' +
          'Complete more N4 lessons to light up these lanterns.</div>' +
          '<button class="c4-btn-full c4-btn-full-sec" id="c4-nopuz-exit">Back to Menu</button>' +
          '</div></div>';
        document.getElementById('c4-nopuz-exit').onclick = function () {
          if (cfg.onExit) cfg.onExit();
        };
        return;
      }

      allAvailable = available.slice();
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
    allAvailable.forEach(function (p) {
      var r = getPuzzleResult(p.id);
      if (r && r.status === 'complete') completedCount++;
    });
    if (cfg.onProgress) cfg.onProgress(completedCount, allAvailable.length);

    var html = '<div class="c4-wrap">';
    html += '<div class="c4-pick-hdr">Select a puzzle</div>';
    html += '<div class="c4-pick-list">';

    allAvailable.forEach(function (p, i) {
      var result = getPuzzleResult(p.id);
      var tilt   = result ? result.tilt : 0;

      html += '<div class="c4-pick-item" data-idx="' + i + '">';
      html += '<div class="c4-pick-num">' + (i + 1) + '</div>';
      html += '<div class="c4-pick-info">';
      html += '<div class="c4-pick-title">Puzzle ' + (i + 1) + '</div>';
      html += '</div>';

      if (result && result.status === 'complete' && stampUrl) {
        html += '<div class="c4-pick-badge">' +
          '<img src="' + esc(stampUrl) + '" alt="✓" style="transform:rotate(' + tilt + 'deg);">' +
          '</div>';
      } else if (result && result.status === 'failed' && pooUrl) {
        html += '<div class="c4-pick-badge">' +
          '<img src="' + esc(pooUrl) + '" alt="✗" style="transform:rotate(' + tilt + 'deg);">' +
          '</div>';
      } else {
        html += '<span class="c4-pick-go">Go →</span>';
      }

      html += '</div>';
    });

    html += '</div></div>';
    container.innerHTML = html;

    container.querySelectorAll('.c4-pick-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var idx = parseInt(item.dataset.idx, 10);
        playSinglePuzzle(allAvailable[idx]);
      });
    });
  }

  // ── Single puzzle play ────────────────────────────────────────────
  function playSinglePuzzle(p) {
    puzzle   = p;
    solved   = [];
    selected = [];
    lives    = 4;
    locked   = false;

    var allWords = [];
    puzzle.groups.forEach(function (g) {
      g.words.forEach(function (w) { allWords.push(w); });
    });
    remaining = shuffle(allWords);

    render();
  }

  // ── Pure DOM render ───────────────────────────────────────────────
  function render() {
    var isPuzzleComplete = solved.length === puzzle.groups.length;

    var solvedHtml = solved.map(function (si) {
      var g   = puzzle.groups[si];
      var bg  = LANTERN_BG[si];
      var txt = LANTERN_TEXT[si];
      return '<div class="c4-solved-row" style="background:' + bg + ';color:' + txt + ';">' +
        '<div class="c4-solved-label">' + esc(g.label) + '</div>' +
        '<div class="c4-solved-words">' + g.words.map(esc).join('　·　') + '</div>' +
        '</div>';
    }).join('');

    var unsolvedWords = remaining.filter(function (w) {
      return !solved.some(function (si) {
        return puzzle.groups[si].words.indexOf(w) !== -1;
      });
    });

    var gridHtml = '';
    if (!isPuzzleComplete) {
      gridHtml = unsolvedWords.map(function (w) {
        var sel = selected.indexOf(w) !== -1;
        return '<div class="c4-tile' + (sel ? ' c4-sel' : '') +
          '" data-word="' + esc(w) + '">' + esc(w) + '</div>';
      }).join('');
    }

    var livesHtml = '';
    for (var i = 0; i < 4; i++) {
      livesHtml += '<span class="c4-lantern' + (i >= lives ? ' c4-dim' : '') + '">🏮</span>';
    }

    // Completion stamp
    var stampHtml = '';
    if (isPuzzleComplete) {
      var stampApi = window.JPShared && window.JPShared.stampSettings;
      var stampUrl = stampApi && stampApi.getStampUrl ? stampApi.getStampUrl() : '';
      if (stampUrl) {
        stampHtml =
          '<div class="c4-stamp">' +
          '<img src="' + esc(stampUrl) + '" alt="">' +
          '<span class="c4-stamp-lbl" style="color:#27ae60;">Complete!</span>' +
          '</div>';
      }
    }

    var disableDesel  = locked || selected.length === 0;
    var disableSubmit = locked || selected.length !== 4 || isPuzzleComplete;

    var html = '<div class="c4-wrap">' +
      '<div class="c4-hint" id="c4-hint">' +
        (isPuzzleComplete ? '🎇 Puzzle solved!' : 'Find 4 words that belong together') +
      '</div>' +
      '<div class="c4-solved-zone">' + solvedHtml + '</div>';

    if (isPuzzleComplete) {
      html += stampHtml +
        '<button class="c4-btn-full c4-btn-full-primary" id="c4-back">Back to Puzzles</button>';
    } else {
      html +=
        '<div class="c4-grid" id="c4-grid">' + gridHtml + '</div>' +
        '<div class="c4-lives">' + livesHtml +
          '<span class="c4-lives-lbl">' + lives + ' left</span>' +
        '</div>' +
        '<div class="c4-actions">' +
          '<button class="c4-btn c4-btn-sec" id="c4-desel"' +
            (disableDesel ? ' disabled' : '') + '>Clear</button>' +
          '<button class="c4-btn c4-btn-primary" id="c4-submit"' +
            (disableSubmit ? ' disabled' : '') + '>Submit</button>' +
        '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
    wireInteraction();
  }

  function wireInteraction() {
    container.querySelectorAll('.c4-tile').forEach(function (tile) {
      tile.addEventListener('click', function () {
        if (locked) return;
        var w = tile.dataset.word;
        var idx = selected.indexOf(w);
        if (idx !== -1) {
          selected.splice(idx, 1);
        } else if (selected.length < 4) {
          selected.push(w);
        }
        render();
      });
    });

    var deselBtn = document.getElementById('c4-desel');
    if (deselBtn) {
      deselBtn.addEventListener('click', function () {
        if (locked) return;
        selected = [];
        render();
      });
    }

    var subBtn = document.getElementById('c4-submit');
    if (subBtn) {
      subBtn.addEventListener('click', function () { trySubmit(); });
    }

    var backBtn = document.getElementById('c4-back');
    if (backBtn) {
      backBtn.addEventListener('click', function () { renderPicker(); });
    }
  }

  // ── Submit / guess logic ──────────────────────────────────────────
  function trySubmit() {
    if (locked || selected.length !== 4) return;
    locked = true;

    var guess = selected.slice();

    // Check for exact match
    var correctIdx = -1;
    puzzle.groups.forEach(function (g, gi) {
      if (solved.indexOf(gi) !== -1) return;
      var allIn = g.words.every(function (w) { return guess.indexOf(w) !== -1; });
      if (allIn) correctIdx = gi;
    });

    if (correctIdx !== -1) {
      solved.push(correctIdx);
      selected = [];
      locked   = false;

      if (solved.length === puzzle.groups.length) {
        // Full puzzle complete
        savePuzzleResult(puzzle.id, 'complete');
        render();
        if (cfg.onComplete) cfg.onComplete();
      } else {
        render();
        setHint('✓ That group is correct!', 'c4-ok');
      }
      return;
    }

    // Check "one away"
    var oneAway = false;
    puzzle.groups.forEach(function (g, gi) {
      if (solved.indexOf(gi) !== -1) return;
      var overlap = guess.filter(function (w) {
        return g.words.indexOf(w) !== -1;
      }).length;
      if (overlap === 3) oneAway = true;
    });

    lives--;
    selected = [];

    if (lives <= 0) {
      render();
      shakeGrid();
      setHint(oneAway ? 'So close — one away! No lanterns left.' : 'No lanterns left!', 'c4-err');
      setTimeout(function () { gameOver(); }, 1300);
    } else {
      locked = false;
      render();
      shakeGrid();
      setHint(oneAway ? 'So close — one away!' : 'Not quite — try another group',
        oneAway ? 'c4-one-away' : 'c4-err');
    }
  }

  function setHint(msg, cls) {
    var el = document.getElementById('c4-hint');
    if (!el) return;
    el.className = 'c4-hint' + (cls ? ' ' + cls : '');
    el.textContent = msg;
  }

  function shakeGrid() {
    var grid = document.getElementById('c4-grid');
    if (!grid) return;
    grid.classList.add('c4-shaking');
    setTimeout(function () {
      if (grid.parentNode) grid.classList.remove('c4-shaking');
    }, 500);
  }

  // ── Game over ─────────────────────────────────────────────────────
  function gameOver() {
    if (window.JPShared && window.JPShared.streak) {
      window.JPShared.streak.recordActivity();
    }

    savePuzzleResult(puzzle.id, 'failed');

    // Reveal all unsolved groups in original order
    puzzle.groups.forEach(function (_, gi) {
      if (solved.indexOf(gi) === -1) solved.push(gi);
    });

    var solvedHtml = solved.map(function (si) {
      var g   = puzzle.groups[si];
      var bg  = LANTERN_BG[si];
      var txt = LANTERN_TEXT[si];
      return '<div class="c4-solved-row" style="background:' + bg + ';color:' + txt + ';">' +
        '<div class="c4-solved-label">' + esc(g.label) + '</div>' +
        '<div class="c4-solved-words">' + g.words.map(esc).join('　·　') + '</div>' +
        '</div>';
    }).join('');

    var pooHtml = '';
    var stampApi = window.JPShared && window.JPShared.stampSettings;
    if (stampApi && stampApi.getPooUrl) {
      var pooUrl = stampApi.getPooUrl();
      if (pooUrl) {
        pooHtml =
          '<div class="c4-stamp">' +
          '<img src="' + esc(pooUrl) + '" alt="">' +
          '<span class="c4-stamp-lbl" style="color:#c0392b;">All lanterns out!</span>' +
          '</div>';
      }
    }

    var savedPuzzle = puzzle;   // capture before any re-render
    container.innerHTML =
      '<div class="c4-wrap">' +
      '<div class="c4-hint c4-err">No more lanterns — here\'s the answer</div>' +
      '<div class="c4-solved-zone">' + solvedHtml + '</div>' +
      pooHtml +
      '<button class="c4-btn-full c4-btn-full-primary" id="c4-retry">Try Again</button>' +
      '<button class="c4-btn-full c4-btn-full-sec" id="c4-back">Back to Puzzles</button>' +
      '</div>';

    document.getElementById('c4-retry').addEventListener('click', function () {
      playSinglePuzzle(savedPuzzle);
    });
    document.getElementById('c4-back').addEventListener('click', function () {
      renderPicker();
    });
  }

  // ── Public API ────────────────────────────────────────────────────
  window.JPShared.connections4Game = {
    /**
     * Start (or restart) the game; lands on the puzzle picker.
     * @param {HTMLElement} containerEl  Shell-owned stage div to write into.
     * @param {Object}      ctx
     *   ctx.level          - 'N4' (default)
     *   ctx.activeLessons  - Set<string> of completed lesson IDs
     *   ctx.config         - REPO_CONFIG passed to window.getAssetUrl()
     *   ctx.onComplete()   - called when a full puzzle is solved
     *   ctx.onExit()       - called when the player exits to menu
     *   ctx.onProgress(completedCount, total)
     */
    init: function (containerEl, ctx) {
      init(containerEl, ctx);
    },

    /** Tear down — clean up DOM and any dangling timers. */
    destroy: function () {
      if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null; }
      if (container)    { container.innerHTML = ''; }
      container    = null;
      cfg          = {};
      allAvailable = [];
      puzzle       = null;
      locked       = false;
      // dataCache intentionally preserved for re-use across init/destroy cycles
    }
  };

})();

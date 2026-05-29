// WritingKanji.js
// Top-level "Practice writing kanji" module. Replaces the Coming-soon stub in
// the Dojo. Loads stroke data from data/strokes/kanji.json (built by
// scripts/build-strokes.mjs from KanjiVG) and runs each drill through
// app/shared/stroke-canvas.js.
//
// On a perfect-on-first-try completion of a kanji that has a morph asset pair
// (see data/morph-keys.json + assets/morph/), the Ink-Dissolve reward plays.
// Otherwise a generic gold-flash celebration fires so every perfect still
// feels rewarding.

window.WritingKanjiModule = (function () {
  'use strict';

  function injectStyles() {
    if (document.getElementById('jp-wk-style')) return;
    var style = document.createElement('style');
    style.id = 'jp-wk-style';
    style.textContent = ''
      + '#jp-wk-root{'
      +   '--washi:oklch(0.97 0.008 80);--washi-2:oklch(0.94 0.012 75);--washi-3:oklch(0.90 0.015 75);'
      +   '--ink:oklch(0.22 0.012 60);--ink-2:oklch(0.38 0.012 60);--ink-3:oklch(0.55 0.012 60);'
      +   '--hairline:oklch(0.22 0.012 60 / 0.12);--hairline-2:oklch(0.22 0.012 60 / 0.06);'
      +   '--vermilion:oklch(0.60 0.18 30);--moss:oklch(0.58 0.09 140);--gold:oklch(0.78 0.10 85);'
      +   '--font-ui:"Schibsted Grotesk","Work Sans",system-ui,sans-serif;'
      +   '--font-jp-display:"Noto Serif JP","Shippori Mincho",serif;'
      +   '--font-mono:"JetBrains Mono",ui-monospace,Menlo,monospace;'
      +   'font-family:var(--font-ui);color:var(--ink);background:'
      +   'radial-gradient(1200px 800px at 20% 10%,oklch(0.99 0.01 80 / 0.6),transparent 50%),'
      +   'radial-gradient(900px 600px at 90% 90%,oklch(0.94 0.015 40 / 0.35),transparent 55%),'
      +   'var(--washi);display:flex;flex-direction:column;width:100%;min-height:100vh;min-height:100dvh;'
      + '}'
      + '#jp-wk-root *{box-sizing:border-box}'
      + '.wk-head{padding:max(28px,env(safe-area-inset-top)) 18px 14px;background:var(--washi);'
      +   'border-bottom:1px solid var(--hairline);position:sticky;top:0;z-index:5;'
      +   'display:flex;align-items:center;gap:12px}'
      + '.wk-x{width:32px;height:32px;border-radius:999px;border:1px solid var(--hairline);background:transparent;cursor:pointer;'
      +   'display:flex;align-items:center;justify-content:center;color:var(--ink-2);flex-shrink:0}'
      + '.wk-code{font-family:var(--font-mono);font-size:10px;color:var(--vermilion);letter-spacing:0.18em;font-weight:600}'
      + '.wk-title{font-family:var(--font-jp-display);font-weight:600;font-size:17px;letter-spacing:-0.01em;margin-top:1px;color:var(--ink)}'
      + '.wk-body{flex:1;overflow-y:auto;overflow-x:hidden;padding:14px 16px max(60px,env(safe-area-inset-bottom));'
      +   'animation:wkFade 0.3s ease}'
      + '@keyframes wkFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}'
      + '.wk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px;margin-top:8px}'
      + '.wk-cell{aspect-ratio:1;border:1px solid var(--hairline);border-radius:16px;background:#fff;'
      +   'cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;'
      +   'font-family:var(--font-jp-display);font-size:38px;line-height:1;position:relative;'
      +   'transition:transform 0.12s,border-color 0.18s,box-shadow 0.18s}'
      + '@media (hover:hover){.wk-cell:hover{border-color:var(--gold);box-shadow:0 6px 16px rgba(0,0,0,0.07)}}'
      + '.wk-cell:active{transform:scale(0.96)}'
      + '.wk-cell .meaning{font-family:var(--font-mono);font-size:9px;letter-spacing:0.08em;'
      +   'color:var(--ink-3);text-transform:uppercase;margin-top:6px;font-weight:600;max-width:88%;text-align:center;'
      +   'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '.wk-cell.mastered{border-color:var(--gold);background:oklch(0.78 0.10 85 / 0.12);'
      +   'box-shadow:0 0 0 1px var(--gold) inset}'
      + '.wk-cell .seal{position:absolute;top:6px;right:6px;width:18px;height:18px;border-radius:50%;'
      +   'background:var(--gold);color:#fff;font-size:11px;display:flex;align-items:center;justify-content:center;'
      +   'font-weight:700}'
      + '.wk-level-row{display:flex;gap:10px;margin:14px 0 18px}'
      + '.wk-level{flex:1;padding:14px 16px;border:1px solid var(--hairline);border-radius:18px;background:#fff;'
      +   'cursor:pointer;text-align:left;font-family:inherit;color:var(--ink);transition:border-color 0.18s,transform 0.12s}'
      + '@media (hover:hover){.wk-level:hover{border-color:var(--vermilion)}}'
      + '.wk-level:active{transform:scale(0.98)}'
      + '.wk-level.is-active{border-color:var(--vermilion);background:oklch(0.60 0.18 30 / 0.06)}'
      + '.wk-level .lbl{font-family:var(--font-mono);font-size:10px;color:var(--vermilion);letter-spacing:0.16em;font-weight:600}'
      + '.wk-level .name{font-size:18px;font-weight:700;margin-top:4px;letter-spacing:-0.01em}'
      + '.wk-lesson-row{display:flex;align-items:center;gap:12px;padding:14px 12px;border:1px solid var(--hairline);'
      +   'border-radius:14px;background:#fff;margin-bottom:8px;cursor:pointer;transition:border-color 0.18s,transform 0.1s}'
      + '@media (hover:hover){.wk-lesson-row:hover{border-color:var(--gold)}}'
      + '.wk-lesson-row:active{transform:scale(0.99)}'
      + '.wk-lesson-id{font-family:var(--font-mono);font-size:10.5px;color:var(--vermilion);letter-spacing:0.12em;'
      +   'font-weight:600;min-width:44px;flex-shrink:0}'
      + '.wk-lesson-name{flex:1;font-size:14.5px;font-weight:600;color:var(--ink)}'
      + '.wk-lesson-count{font-family:var(--font-mono);font-size:10px;color:var(--ink-3);letter-spacing:0.08em;'
      +   'border:1px solid var(--hairline);border-radius:6px;padding:3px 7px;flex-shrink:0}'
      + '.wk-section-label{font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:0.16em;'
      +   'color:var(--ink-3);margin:20px 4px 8px;font-weight:600}'
      + '/* Drill screen */'
      + '.wk-drill{display:flex;flex-direction:column;align-items:center;gap:14px;padding-top:8px}'
      + '.wk-meta{text-align:center}'
      + '.wk-meta .glyph{font-family:var(--font-jp-display);font-size:42px;line-height:1;font-weight:600}'
      + '.wk-meta .read{font-size:13px;color:var(--ink-3);margin-top:6px;font-weight:600;letter-spacing:0.04em}'
      + '.wk-meta .meaning{font-family:var(--font-mono);font-size:11px;text-transform:uppercase;letter-spacing:0.12em;'
      +   'color:var(--vermilion);font-weight:700;margin-top:4px}'
      + '.wk-stage{width:min(360px,84vw);aspect-ratio:1;background:transparent;border-radius:24px;overflow:hidden;'
      +   'position:relative;box-shadow:0 8px 28px rgba(0,0,0,0.10),0 0 0 1px var(--hairline)}'
      + '.wk-counter{font-family:var(--font-mono);font-size:11px;letter-spacing:0.16em;color:var(--ink-2);'
      +   'font-weight:600;text-transform:uppercase}'
      + '.wk-counter .num{color:var(--vermilion);font-size:13px}'
      + '.wk-actions{display:flex;gap:10px;margin-top:6px}'
      + '.wk-btn{padding:10px 18px;border-radius:999px;border:1px solid var(--hairline);background:#fff;'
      +   'color:var(--ink);font-family:inherit;font-weight:600;font-size:13px;cursor:pointer;'
      +   'transition:border-color 0.15s,background 0.15s,transform 0.1s}'
      + '@media (hover:hover){.wk-btn:hover{border-color:var(--vermilion)}}'
      + '.wk-btn:active{transform:scale(0.97)}'
      + '.wk-btn--ink{background:var(--ink);color:var(--washi);border-color:var(--ink)}'
      + '.wk-feedback{font-family:var(--font-mono);font-size:11px;letter-spacing:0.08em;color:var(--ink-3);'
      +   'min-height:14px;text-align:center}'
      + '.wk-feedback.is-warn{color:var(--vermilion)}'
      + '.wk-feedback.is-ok{color:var(--moss)}'
      + '/* Reward overlay */'
      + '.wk-reward{position:fixed;inset:0;background:oklch(0.22 0.012 60 / 0.72);z-index:1000;'
      +   'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;'
      +   'animation:wkFade 0.25s ease}'
      + '.wk-reward canvas{width:min(80vw,520px);height:min(80vw,520px);background:#000;border-radius:18px;'
      +   'box-shadow:0 22px 60px rgba(0,0,0,0.45)}'
      + '.wk-reward .label{font-family:var(--font-jp-display);color:var(--washi);font-size:22px;font-weight:600;'
      +   'letter-spacing:0.02em;text-shadow:0 2px 12px rgba(0,0,0,0.4)}'
      + '.wk-reward .sub{font-family:var(--font-mono);color:oklch(0.78 0.10 85);font-size:11px;letter-spacing:0.2em;'
      +   'text-transform:uppercase;font-weight:600}'
      + '.wk-reward .close{margin-top:8px;padding:8px 18px;border-radius:999px;background:oklch(1 0 0 / 0.10);'
      +   'border:1px solid oklch(1 0 0 / 0.20);color:var(--washi);cursor:pointer;font:inherit;font-size:13px}';
    document.head.appendChild(style);
  }

  function chevronLeft() {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
         + 'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
  }

  // Persistent mastered map, keyed by kanji. Value: { perfect: bool, ts: ms }
  function loadMastered() {
    try { return JSON.parse(localStorage.getItem('k-writing-mastered') || '{}'); }
    catch (e) { return {}; }
  }
  function saveMastered(map) {
    try { localStorage.setItem('k-writing-mastered', JSON.stringify(map)); } catch (e) {}
  }

  function start(container, sharedConfig, exitCallback) {
    injectStyles();
    container.innerHTML = '';
    var root = document.createElement('div');
    root.id = 'jp-wk-root';
    container.appendChild(root);

    var REPO_CONFIG = sharedConfig;
    var assetUrl = function (p) {
      return window.getAssetUrl ? window.getAssetUrl(REPO_CONFIG, p) : p;
    };

    var state = {
      view: 'level',           // 'level' | 'lessons' | 'grid' | 'drill'
      manifest: null,
      strokes: null,           // data/strokes/kanji.json
      morphKeys: null,         // data/morph-keys.json
      level: null,             // 'N5' | 'N4'
      lessons: null,
      lesson: null,            // current lesson object
      lessonData: null,        // parsed lesson JSON (for newKanji metadata)
      kanjiList: null,         // [{ kanji, kun, on, meaning }]
      drillIdx: 0,             // index into kanjiList for current drill
      mastered: loadMastered(),
      activeCanvas: null       // current strokeCanvas instance, for cleanup
    };

    function header(opts) {
      var title = opts.title || '';
      var code = opts.code || '';
      var onBack = opts.onBack || function () { exitCallback && exitCallback(); };
      var div = document.createElement('div');
      div.className = 'wk-head';
      div.innerHTML =
        '<button class="wk-x" aria-label="Back">' + chevronLeft() + '</button>' +
        '<div style="flex:1;min-width:0">' +
          (code ? '<div class="wk-code">' + code + '</div>' : '') +
          '<div class="wk-title">' + title + '</div>' +
        '</div>';
      div.querySelector('.wk-x').onclick = onBack;
      return div;
    }

    function destroyActiveCanvas() {
      if (state.activeCanvas && state.activeCanvas.destroy) {
        try { state.activeCanvas.destroy(); } catch (e) {}
      }
      state.activeCanvas = null;
    }

    // ---------- Level picker ----------
    function renderLevels() {
      destroyActiveCanvas();
      state.view = 'level';
      root.innerHTML = '';
      root.appendChild(header({ code: 'DOJO · WRITING', title: 'Kanji Writing' }));
      var body = document.createElement('div');
      body.className = 'wk-body';
      body.innerHTML =
        '<div class="wk-section-label">Pick a level</div>' +
        '<div class="wk-level-row">' +
          '<button class="wk-level" data-lvl="N5">' +
            '<div class="lbl">JLPT</div>' +
            '<div class="name">N5</div>' +
          '</button>' +
          '<button class="wk-level" data-lvl="N4">' +
            '<div class="lbl">JLPT</div>' +
            '<div class="name">N4</div>' +
          '</button>' +
        '</div>';
      root.appendChild(body);
      body.querySelectorAll('.wk-level').forEach(function (b) {
        b.onclick = function () {
          state.level = b.dataset.lvl;
          renderLessons();
        };
      });
    }

    // ---------- Lesson list ----------
    async function renderLessons() {
      destroyActiveCanvas();
      state.view = 'lessons';
      root.innerHTML = '';
      root.appendChild(header({
        code: 'JLPT ' + state.level,
        title: 'Choose a lesson',
        onBack: renderLevels
      }));
      var body = document.createElement('div');
      body.className = 'wk-body';
      body.innerHTML = '<div style="color:var(--ink-3);padding-top:30px;text-align:center;">Loading…</div>';
      root.appendChild(body);

      try {
        if (!state.manifest) state.manifest = await window.getManifest(REPO_CONFIG);
        var levelData = state.manifest.data && state.manifest.data[state.level];
        if (!levelData || !levelData.lessons) throw new Error('Level not found');
        var lessons = levelData.lessons.slice().sort(function (a, b) {
          var na = parseInt(a.id.replace('N','').split('.')[1] || 0);
          var nb = parseInt(b.id.replace('N','').split('.')[1] || 0);
          return na - nb;
        });
        state.lessons = lessons;
        body.innerHTML = '<div class="wk-section-label">' + lessons.length + ' lessons</div>';
        var listWrap = document.createElement('div');
        lessons.forEach(function (lesson) {
          var row = document.createElement('div');
          row.className = 'wk-lesson-row';
          var n = (lesson.meta && lesson.meta.kanji && lesson.meta.kanji.length) || '–';
          row.innerHTML =
            '<div class="wk-lesson-id">' + lesson.id + '</div>' +
            '<div class="wk-lesson-name">' + (lesson.title || '') + '</div>' +
            '<div class="wk-lesson-count">' + n + ' kanji</div>';
          row.onclick = function () { openLesson(lesson); };
          listWrap.appendChild(row);
        });
        body.appendChild(listWrap);
      } catch (err) {
        body.innerHTML = '<div style="color:var(--vermilion);padding-top:30px;text-align:center;">'
          + 'Could not load lessons: ' + (err.message || err) + '</div>';
      }
    }

    // ---------- Kanji grid for one lesson ----------
    async function openLesson(lesson) {
      destroyActiveCanvas();
      state.view = 'grid';
      state.lesson = lesson;
      root.innerHTML = '';
      root.appendChild(header({
        code: lesson.id,
        title: lesson.title || 'Kanji',
        onBack: renderLessons
      }));
      var body = document.createElement('div');
      body.className = 'wk-body';
      body.innerHTML = '<div style="color:var(--ink-3);padding-top:30px;text-align:center;">Loading…</div>';
      root.appendChild(body);

      try {
        // Ensure stroke data is loaded.
        if (!state.strokes) {
          var r = await fetch(assetUrl('data/strokes/kanji.json'));
          state.strokes = await r.json();
        }
        if (!state.morphKeys) {
          try {
            var rm = await fetch(assetUrl('data/morph-keys.json'));
            state.morphKeys = await rm.json();
          } catch (e) { state.morphKeys = {}; }
        }
        // Lesson JSON for metadata (newKanji[].kun/on/meaning).
        var lr = await fetch(assetUrl(lesson.file));
        var lj = await lr.json();
        state.lessonData = lj;

        var newKanji = lj.newKanji || [];
        var metaByCh = {};
        newKanji.forEach(function (k) { if (k && k.kanji) metaByCh[k.kanji] = k; });
        var listSrc = (lj.meta && lj.meta.kanji) || [];
        var kanjiList = listSrc
          .filter(function (ch) { return state.strokes[ch]; })
          .map(function (ch) {
            var m = metaByCh[ch] || {};
            return { kanji: ch, kun: m.kun || '', on: m.on || '', meaning: m.meaning || '' };
          });
        state.kanjiList = kanjiList;

        body.innerHTML =
          '<div class="wk-section-label">' + kanjiList.length + ' kanji · stroke order</div>' +
          '<div class="wk-grid" id="wk-grid"></div>';
        var grid = body.querySelector('#wk-grid');
        kanjiList.forEach(function (item, idx) {
          var cell = document.createElement('div');
          cell.className = 'wk-cell' + (state.mastered[item.kanji] && state.mastered[item.kanji].perfect ? ' mastered' : '');
          cell.innerHTML = item.kanji +
            (item.meaning ? '<div class="meaning">' + escapeHtml(item.meaning) + '</div>' : '') +
            (state.mastered[item.kanji] && state.mastered[item.kanji].perfect ? '<div class="seal">✓</div>' : '');
          cell.onclick = function () { openDrill(idx); };
          grid.appendChild(cell);
        });
        var missing = listSrc.length - kanjiList.length;
        if (missing > 0) {
          var note = document.createElement('div');
          note.style.cssText = 'font-family:var(--font-mono);font-size:10px;color:var(--ink-3);'
                             + 'margin-top:16px;text-align:center;letter-spacing:0.05em';
          note.textContent = missing + ' kanji in this lesson have no stroke data yet.';
          body.appendChild(note);
        }
      } catch (err) {
        body.innerHTML = '<div style="color:var(--vermilion);padding-top:30px;text-align:center;">'
          + 'Could not load kanji: ' + (err.message || err) + '</div>';
      }
    }

    // ---------- Drill (single kanji) ----------
    function openDrill(idx) {
      destroyActiveCanvas();
      state.view = 'drill';
      state.drillIdx = idx;
      var item = state.kanjiList[idx];
      root.innerHTML = '';
      root.appendChild(header({
        code: state.lesson.id,
        title: 'Write · ' + item.kanji,
        onBack: function () { openLesson(state.lesson); }
      }));
      var body = document.createElement('div');
      body.className = 'wk-body';
      body.innerHTML =
        '<div class="wk-drill">' +
          '<div class="wk-meta">' +
            '<div class="glyph">' + item.kanji + '</div>' +
            (item.kun || item.on
              ? '<div class="read">' + escapeHtml([item.kun, item.on].filter(Boolean).join(' · ')) + '</div>'
              : '') +
            (item.meaning ? '<div class="meaning">' + escapeHtml(item.meaning) + '</div>' : '') +
          '</div>' +
          '<div class="wk-stage" id="wk-stage"></div>' +
          '<div class="wk-counter">stroke <span class="num" id="wk-cur">1</span> / <span id="wk-tot">?</span></div>' +
          '<div class="wk-feedback" id="wk-fb">&nbsp;</div>' +
          '<div class="wk-actions">' +
            '<button class="wk-btn" id="wk-show">Show me</button>' +
            '<button class="wk-btn" id="wk-reset">Reset</button>' +
            (idx < state.kanjiList.length - 1
              ? '<button class="wk-btn wk-btn--ink" id="wk-next">Next →</button>'
              : '') +
          '</div>' +
        '</div>';
      root.appendChild(body);

      var glyphData = state.strokes[item.kanji];
      var stage = body.querySelector('#wk-stage');
      var cur = body.querySelector('#wk-cur');
      var tot = body.querySelector('#wk-tot');
      var fb = body.querySelector('#wk-fb');
      tot.textContent = glyphData.strokes.length;

      function feedback(msg, kind) {
        fb.textContent = msg || ' ';
        fb.classList.remove('is-warn', 'is-ok');
        if (kind === 'warn') fb.classList.add('is-warn');
        if (kind === 'ok') fb.classList.add('is-ok');
      }

      state.activeCanvas = window.JPShared.strokeCanvas.create({
        mount: stage,
        glyph: glyphData,
        onStrokeResult: function (ok, strokeIdx, info) {
          if (ok) {
            cur.textContent = Math.min(strokeIdx + 2, glyphData.strokes.length);
            feedback('', 'ok');
          } else {
            var reason = info && info.reason;
            var msg = 'Try that stroke again';
            if (reason === 'direction') msg = 'Wrong direction — start from the other end';
            else if (reason === 'shape') msg = 'Not quite the shape — follow the watermark';
            else if (reason === 'too-short') msg = 'A bit too short';
            else if (reason === 'dot-misplaced') msg = 'Dot is off';
            feedback(msg, 'warn');
          }
        },
        onComplete: function (info) {
          var wasPerfect = !!info.perfectFirstTry;
          var prev = state.mastered[item.kanji];
          state.mastered[item.kanji] = {
            perfect: wasPerfect || (prev && prev.perfect) || false,
            ts: Date.now()
          };
          saveMastered(state.mastered);
          if (window.JPShared && window.JPShared.haptics) window.JPShared.haptics.success();
          if (window.JPShared && window.JPShared.progress && window.JPShared.progress.recordActivity) {
            try { window.JPShared.progress.recordActivity(); } catch (e) {}
          }
          if (wasPerfect) playPerfectReward(item.kanji);
          else playGoldFlash();
        }
      });

      body.querySelector('#wk-show').onclick = function () {
        if (state.activeCanvas) state.activeCanvas.showOrderDemo();
        feedback('Showing stroke order (counts as a hint)', 'warn');
      };
      body.querySelector('#wk-reset').onclick = function () {
        if (state.activeCanvas) state.activeCanvas.reset();
        cur.textContent = 1;
        feedback('');
      };
      var nextBtn = body.querySelector('#wk-next');
      if (nextBtn) nextBtn.onclick = function () { openDrill(idx + 1); };
    }

    // ---------- Reward animations ----------
    function playPerfectReward(kanji) {
      var key = state.morphKeys && state.morphKeys[kanji];
      if (!key || !window.JPShared || !window.JPShared.inkMorph) {
        playGoldFlash();
        return;
      }
      var overlay = document.createElement('div');
      overlay.className = 'wk-reward';
      overlay.innerHTML =
        '<canvas id="wk-morph-canvas" width="512" height="512"></canvas>' +
        '<div class="label">Perfect.</div>' +
        '<div class="sub">' + key.toUpperCase() + ' · ' + kanji + '</div>' +
        '<button class="close">Continue</button>';
      document.body.appendChild(overlay);
      var canvas = overlay.querySelector('canvas');
      var morph = new window.JPShared.inkMorph.InkMorph(canvas, { size: 512 });
      var closer = function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      };
      overlay.querySelector('.close').onclick = closer;
      morph.preload([{
        key: key,
        kanji:   assetUrl('assets/morph/kanji_' + key + '.png'),
        meaning: assetUrl('assets/morph/meaning_' + key + '.png')
      }]).then(function () {
        morph.showKanji(key);
        // Settle, then play.
        setTimeout(function () {
          morph.play(key, { duration: 1400, holdAfter: 1800 }).then(function () {
            // Auto-close after the hold; tap to continue is also available.
            setTimeout(function () { closer(); }, 100);
          });
        }, 450);
      }).catch(function () {
        // Asset missing despite a morph-keys entry — fall back gracefully.
        closer();
        playGoldFlash();
      });
    }

    function playGoldFlash() {
      var overlay = document.createElement('div');
      overlay.className = 'wk-reward';
      overlay.style.background = 'oklch(0.22 0.012 60 / 0.55)';
      overlay.innerHTML =
        '<div style="width:min(80vw,420px);aspect-ratio:1;border-radius:50%;' +
          'background:radial-gradient(circle at center,oklch(0.78 0.10 85 / 0.85),oklch(0.78 0.10 85 / 0) 65%);' +
          'display:flex;align-items:center;justify-content:center;animation:wkBloom 1.2s ease-out forwards">' +
          '<div style="font-family:var(--font-jp-display);font-size:80px;color:var(--washi);text-shadow:0 4px 24px rgba(0,0,0,0.4)">✓</div>' +
        '</div>' +
        '<div class="label">Well drawn.</div>';
      // Inject keyframes once.
      if (!document.getElementById('wk-bloom-kf')) {
        var kf = document.createElement('style');
        kf.id = 'wk-bloom-kf';
        kf.textContent = '@keyframes wkBloom{0%{transform:scale(0.6);opacity:0}30%{opacity:1}'
          + '100%{transform:scale(1.05);opacity:1}}';
        document.head.appendChild(kf);
      }
      document.body.appendChild(overlay);
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 1500);
    }

    // ---------- utils ----------
    function escapeHtml(s) {
      return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    renderLevels();
  }

  return { start: start };
})();

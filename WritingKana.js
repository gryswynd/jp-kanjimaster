// WritingKana.js
// Opt-in helper: hiragana + katakana stroke-by-stroke writing practice.
// Visibility is gated by window.JPShared.practiceHelpers.getKanaWriting(); the
// Dojo Writing hub only surfaces the entry button when that toggle is on.
//
// Uses app/shared/stroke-canvas.js for drawing + validation and the same
// gold-flash reward as WritingKanji's non-morph success path (kana have no
// morph asset pairs by design — only kanji-meaning maps to a meaning pair).

window.WritingKanaModule = (function () {
  'use strict';

  // Curated row layouts — gojuuon order is more learner-friendly than raw
  // Unicode order. Each row is a tuple [label, [chars]]. Empty slots are
  // rendered as a faint placeholder so the table grid stays aligned.
  var HIRA_ROWS = [
    ['a-row',   ['あ','い','う','え','お']],
    ['ka-row',  ['か','き','く','け','こ']],
    ['sa-row',  ['さ','し','す','せ','そ']],
    ['ta-row',  ['た','ち','つ','て','と']],
    ['na-row',  ['な','に','ぬ','ね','の']],
    ['ha-row',  ['は','ひ','ふ','へ','ほ']],
    ['ma-row',  ['ま','み','む','め','も']],
    ['ya-row',  ['や','',  'ゆ','',  'よ']],
    ['ra-row',  ['ら','り','る','れ','ろ']],
    ['wa-row',  ['わ','',  '',  '',  'を']],
    ['n-row',   ['ん','',  '',  '',  '']]
  ];
  var KATA_ROWS = [
    ['a-row',   ['ア','イ','ウ','エ','オ']],
    ['ka-row',  ['カ','キ','ク','ケ','コ']],
    ['sa-row',  ['サ','シ','ス','セ','ソ']],
    ['ta-row',  ['タ','チ','ツ','テ','ト']],
    ['na-row',  ['ナ','ニ','ヌ','ネ','ノ']],
    ['ha-row',  ['ハ','ヒ','フ','ヘ','ホ']],
    ['ma-row',  ['マ','ミ','ム','メ','モ']],
    ['ya-row',  ['ヤ','',  'ユ','',  'ヨ']],
    ['ra-row',  ['ラ','リ','ル','レ','ロ']],
    ['wa-row',  ['ワ','',  '',  '',  'ヲ']],
    ['n-row',   ['ン','',  '',  '',  '']]
  ];
  var HIRA_DAKUTEN = ['が','ぎ','ぐ','げ','ご','ざ','じ','ず','ぜ','ぞ','だ','ぢ','づ','で','ど','ば','び','ぶ','べ','ぼ'];
  var HIRA_HANDAKU = ['ぱ','ぴ','ぷ','ぺ','ぽ'];
  var KATA_DAKUTEN = ['ガ','ギ','グ','ゲ','ゴ','ザ','ジ','ズ','ゼ','ゾ','ダ','ヂ','ヅ','デ','ド','バ','ビ','ブ','ベ','ボ'];
  var KATA_HANDAKU = ['パ','ピ','プ','ペ','ポ'];

  function injectStyles() {
    if (document.getElementById('jp-wkana-style')) return;
    var style = document.createElement('style');
    style.id = 'jp-wkana-style';
    style.textContent = ''
      + '#jp-wkana-root{'
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
      + '#jp-wkana-root *{box-sizing:border-box}'
      + '.wka-head{padding:max(28px,env(safe-area-inset-top)) 18px 14px;background:var(--washi);'
      +   'border-bottom:1px solid var(--hairline);position:sticky;top:0;z-index:5;'
      +   'display:flex;align-items:center;gap:12px}'
      + '.wka-x{width:32px;height:32px;border-radius:999px;border:1px solid var(--hairline);background:transparent;'
      +   'cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--ink-2);flex-shrink:0}'
      + '.wka-code{font-family:var(--font-mono);font-size:10px;color:var(--vermilion);letter-spacing:0.18em;font-weight:600}'
      + '.wka-title{font-family:var(--font-jp-display);font-weight:600;font-size:17px;letter-spacing:-0.01em;margin-top:1px;color:var(--ink)}'
      + '.wka-tabs{display:flex;gap:6px;padding:8px 16px 0}'
      + '.wka-tab{flex:1;padding:9px 12px;border:1px solid var(--hairline);background:#fff;color:var(--ink-2);'
      +   'border-radius:999px;font:inherit;font-size:12px;font-weight:600;cursor:pointer;letter-spacing:0.04em}'
      + '.wka-tab.is-active{background:var(--ink);color:var(--washi);border-color:var(--ink)}'
      + '.wka-body{flex:1;overflow-y:auto;overflow-x:hidden;padding:14px 16px max(60px,env(safe-area-inset-bottom));'
      +   'animation:wkaFade 0.25s ease}'
      + '@keyframes wkaFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}'
      + '.wka-section-label{font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:0.16em;'
      +   'color:var(--ink-3);margin:18px 4px 8px;font-weight:600}'
      + '.wka-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;max-width:480px}'
      + '.wka-grid--free{grid-template-columns:repeat(auto-fill,minmax(60px,1fr));max-width:none}'
      + '.wka-cell{aspect-ratio:1;border:1px solid var(--hairline);border-radius:14px;background:#fff;'
      +   'cursor:pointer;display:flex;align-items:center;justify-content:center;'
      +   'font-family:var(--font-jp-display);font-size:28px;line-height:1;position:relative;'
      +   'transition:transform 0.12s,border-color 0.18s,box-shadow 0.18s}'
      + '.wka-cell.is-empty{background:transparent;border-color:transparent;cursor:default;pointer-events:none}'
      + '@media (hover:hover){.wka-cell:not(.is-empty):hover{border-color:var(--gold);box-shadow:0 6px 16px rgba(0,0,0,0.07)}}'
      + '.wka-cell:active{transform:scale(0.95)}'
      + '.wka-cell.mastered{border-color:var(--gold);background:oklch(0.78 0.10 85 / 0.12);box-shadow:0 0 0 1px var(--gold) inset}'
      + '.wka-cell .seal{position:absolute;top:4px;right:4px;width:14px;height:14px;border-radius:50%;background:var(--gold);color:#fff;font-size:9px;display:flex;align-items:center;justify-content:center;font-weight:700}'
      + '/* Drill */'
      + '.wka-drill{display:flex;flex-direction:column;align-items:center;gap:14px;padding-top:8px}'
      + '.wka-stage{width:min(360px,84vw);aspect-ratio:1;background:transparent;border-radius:24px;overflow:hidden;'
      +   'position:relative;box-shadow:0 8px 28px rgba(0,0,0,0.10),0 0 0 1px var(--hairline)}'
      + '.wka-glyph{font-family:var(--font-jp-display);font-size:42px;line-height:1;font-weight:600;text-align:center}'
      + '.wka-counter{font-family:var(--font-mono);font-size:11px;letter-spacing:0.16em;color:var(--ink-2);font-weight:600;text-transform:uppercase}'
      + '.wka-counter .num{color:var(--vermilion);font-size:13px}'
      + '.wka-feedback{font-family:var(--font-mono);font-size:11px;letter-spacing:0.08em;color:var(--ink-3);min-height:14px;text-align:center}'
      + '.wka-feedback.is-warn{color:var(--vermilion)}'
      + '.wka-actions{display:flex;gap:10px;margin-top:6px}'
      + '.wka-btn{padding:10px 18px;border-radius:999px;border:1px solid var(--hairline);background:#fff;color:var(--ink);'
      +   'font:inherit;font-weight:600;font-size:13px;cursor:pointer;transition:border-color 0.15s,transform 0.1s}'
      + '@media (hover:hover){.wka-btn:hover{border-color:var(--vermilion)}}'
      + '.wka-btn:active{transform:scale(0.97)}'
      + '.wka-btn--ink{background:var(--ink);color:var(--washi);border-color:var(--ink)}'
      + '/* Reward */'
      + '.wka-reward{position:fixed;inset:0;background:oklch(0.22 0.012 60 / 0.55);z-index:1000;'
      +   'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;animation:wkaFade 0.25s ease}';
    document.head.appendChild(style);
  }

  function chevronLeft() {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
         + 'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
  }

  function loadMastered() {
    try { return JSON.parse(localStorage.getItem('k-kana-mastered') || '{}'); }
    catch (e) { return {}; }
  }
  function saveMastered(m) {
    try { localStorage.setItem('k-kana-mastered', JSON.stringify(m)); } catch (e) {}
  }

  function start(container, sharedConfig, exitCallback) {
    injectStyles();
    container.innerHTML = '';
    var root = document.createElement('div');
    root.id = 'jp-wkana-root';
    container.appendChild(root);

    var REPO_CONFIG = sharedConfig;
    var assetUrl = function (p) { return window.getAssetUrl ? window.getAssetUrl(REPO_CONFIG, p) : p; };

    var state = {
      view: 'grid',
      tab: 'hira',           // 'hira' | 'kata'
      data: null,
      mastered: loadMastered(),
      activeCanvas: null
    };

    function destroyActiveCanvas() {
      if (state.activeCanvas && state.activeCanvas.destroy) {
        try { state.activeCanvas.destroy(); } catch (e) {}
      }
      state.activeCanvas = null;
    }

    function header(opts) {
      var title = opts.title || '';
      var code = opts.code || '';
      var onBack = opts.onBack || function () { exitCallback && exitCallback(); };
      var div = document.createElement('div');
      div.className = 'wka-head';
      div.innerHTML =
        '<button class="wka-x" aria-label="Back">' + chevronLeft() + '</button>' +
        '<div style="flex:1;min-width:0">' +
          (code ? '<div class="wka-code">' + code + '</div>' : '') +
          '<div class="wka-title">' + title + '</div>' +
        '</div>';
      div.querySelector('.wka-x').onclick = onBack;
      return div;
    }

    function tabs(active) {
      var d = document.createElement('div');
      d.className = 'wka-tabs';
      d.innerHTML =
        '<button class="wka-tab' + (active === 'hira' ? ' is-active' : '') + '" data-tab="hira">Hiragana</button>' +
        '<button class="wka-tab' + (active === 'kata' ? ' is-active' : '') + '" data-tab="kata">Katakana</button>';
      d.querySelectorAll('.wka-tab').forEach(function (b) {
        b.onclick = function () { state.tab = b.dataset.tab; renderGrid(); };
      });
      return d;
    }

    async function renderGrid() {
      if (window.JPApp) window.JPApp.showTabBar();
      destroyActiveCanvas();
      state.view = 'grid';
      root.innerHTML = '';
      root.appendChild(header({ code: 'DOJO · HELPER', title: 'Kana Writing' }));
      root.appendChild(tabs(state.tab));
      var body = document.createElement('div');
      body.className = 'wka-body';
      body.innerHTML = '<div style="color:var(--ink-3);padding-top:30px;text-align:center;">Loading…</div>';
      root.appendChild(body);

      if (!state.data) {
        try {
          var r = await fetch(assetUrl('data/strokes/kana.json'));
          state.data = await r.json();
        } catch (err) {
          body.innerHTML = '<div style="color:var(--vermilion);padding-top:30px;text-align:center;">'
            + 'Could not load kana stroke data.</div>';
          return;
        }
      }

      var isHira = state.tab === 'hira';
      var rows = isHira ? HIRA_ROWS : KATA_ROWS;
      var dakuten = isHira ? HIRA_DAKUTEN : KATA_DAKUTEN;
      var handaku = isHira ? HIRA_HANDAKU : KATA_HANDAKU;

      var html = '<div class="wka-section-label">Gojūon</div><div class="wka-grid">';
      rows.forEach(function (row) {
        row[1].forEach(function (ch) { html += renderCell(ch); });
      });
      html += '</div>';
      html += '<div class="wka-section-label">Dakuten</div><div class="wka-grid wka-grid--free">';
      dakuten.forEach(function (ch) { html += renderCell(ch); });
      html += '</div>';
      html += '<div class="wka-section-label">Handakuten</div><div class="wka-grid wka-grid--free">';
      handaku.forEach(function (ch) { html += renderCell(ch); });
      html += '</div>';
      body.innerHTML = html;
      body.querySelectorAll('.wka-cell[data-ch]').forEach(function (c) {
        c.onclick = function () { openDrill(c.dataset.ch); };
      });
    }

    function renderCell(ch) {
      if (!ch) return '<div class="wka-cell is-empty"></div>';
      var have = state.data && state.data[ch];
      if (!have) return '<div class="wka-cell is-empty" style="color:var(--ink-3);font-size:18px">' + ch + '</div>';
      var mastered = state.mastered[ch];
      return '<div class="wka-cell' + (mastered ? ' mastered' : '') + '" data-ch="' + ch + '">'
        + ch + (mastered ? '<div class="seal">✓</div>' : '') + '</div>';
    }

    function openDrill(ch) {
      if (window.JPApp) window.JPApp.hideTabBar();
      destroyActiveCanvas();
      state.view = 'drill';
      var glyph = state.data[ch];
      if (!glyph) { renderGrid(); return; }
      root.innerHTML = '';
      root.appendChild(header({
        code: state.tab === 'hira' ? 'HIRAGANA' : 'KATAKANA',
        title: 'Write · ' + ch,
        onBack: renderGrid
      }));
      var body = document.createElement('div');
      body.className = 'wka-body';
      body.innerHTML =
        '<div class="wka-drill">' +
          '<div class="wka-glyph">' + ch + '</div>' +
          '<div class="wka-stage" id="wka-stage"></div>' +
          '<div class="wka-counter">stroke <span class="num" id="wka-cur">1</span> / <span id="wka-tot">?</span></div>' +
          '<div class="wka-feedback" id="wka-fb">&nbsp;</div>' +
          '<div class="wka-actions">' +
            '<button class="wka-btn" id="wka-show">Show me</button>' +
            '<button class="wka-btn" id="wka-reset">Reset</button>' +
            '<button class="wka-btn wka-btn--ink" id="wka-back">Back</button>' +
          '</div>' +
        '</div>';
      root.appendChild(body);

      var cur = body.querySelector('#wka-cur');
      var tot = body.querySelector('#wka-tot');
      var fb = body.querySelector('#wka-fb');
      tot.textContent = glyph.strokes.length;

      function feedback(msg, kind) {
        fb.textContent = msg || ' ';
        fb.classList.remove('is-warn');
        if (kind === 'warn') fb.classList.add('is-warn');
      }

      state.activeCanvas = window.JPShared.strokeCanvas.create({
        mount: body.querySelector('#wka-stage'),
        glyph: glyph,
        onStrokeResult: function (ok, idx, info) {
          if (ok) { cur.textContent = Math.min(idx + 2, glyph.strokes.length); feedback(''); }
          else {
            var reason = info && info.reason;
            var msg = 'Try that stroke again';
            if (reason === 'direction') msg = 'Wrong direction';
            else if (reason === 'shape') msg = 'Follow the watermark';
            else if (reason === 'too-short') msg = 'A bit too short';
            feedback(msg, 'warn');
          }
        },
        onComplete: function (info) {
          state.mastered[ch] = { perfect: !!info.perfectFirstTry, ts: Date.now() };
          saveMastered(state.mastered);
          if (window.JPShared && window.JPShared.haptics) window.JPShared.haptics.success();
          if (window.JPShared && window.JPShared.progress && window.JPShared.progress.recordActivity) {
            try { window.JPShared.progress.recordActivity(); } catch (e) {}
          }
          playGoldFlash();
        }
      });

      body.querySelector('#wka-show').onclick = function () {
        if (state.activeCanvas) state.activeCanvas.showOrderDemo();
        feedback('Showing stroke order', 'warn');
      };
      body.querySelector('#wka-reset').onclick = function () {
        if (state.activeCanvas) state.activeCanvas.reset();
        cur.textContent = 1;
        feedback('');
      };
      body.querySelector('#wka-back').onclick = renderGrid;
    }

    function playGoldFlash() {
      if (!document.getElementById('wka-bloom-kf')) {
        var kf = document.createElement('style');
        kf.id = 'wka-bloom-kf';
        kf.textContent = '@keyframes wkaBloom{0%{transform:scale(0.6);opacity:0}30%{opacity:1}100%{transform:scale(1.05);opacity:1}}';
        document.head.appendChild(kf);
      }
      var overlay = document.createElement('div');
      overlay.className = 'wka-reward';
      overlay.innerHTML =
        '<div style="width:min(70vw,360px);aspect-ratio:1;border-radius:50%;' +
          'background:radial-gradient(circle at center,oklch(0.78 0.10 85 / 0.85),oklch(0.78 0.10 85 / 0) 65%);' +
          'display:flex;align-items:center;justify-content:center;animation:wkaBloom 1.1s ease-out forwards">' +
          '<div style="font-family:var(--font-jp-display);font-size:64px;color:#fff;text-shadow:0 4px 24px rgba(0,0,0,0.4)">✓</div>' +
        '</div>';
      document.body.appendChild(overlay);
      setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 1300);
    }

    renderGrid();
  }

  return { start: start };
})();

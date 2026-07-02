/**
 * app/games/kotd-dojo.js — Kanji of the Day drill (Dojo → Daily hub).
 *
 * One kanji per calendar day (picked from the student's KNOWN pool by
 * JPShared.quests.kanjiOfDay), mastered in three steps:
 *   1. MEANING  — type the English meaning (lenient grading, 3 tries → reveal)
 *   2. READINGS — pick the on / kun reading among distractors (skips a phase
 *                 the kanji doesn't have)
 *   3. WRITE    — one guided write via JPShared.strokeCanvas (skipped if the
 *                 glyph is missing, which never happens for taught kanji)
 *
 * Practice.js owns chrome + data: it passes the kanji, its glossary info,
 * distractor reading pools, and the KanjiVG glyph. On finish this emits
 * 'kotd-complete' (ticks the daily quest) plus per-answer 'drill-answer'
 * events (module:'kotd') so Dojo-question goals tick too.
 */

(function () {
  'use strict';

  window.JPShared = window.JPShared || {};
  if (window.JPShared.kotdDojo) return;

  var STYLE_ID = 'jp-kotd-style';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '.kotd-wrap { max-width: 460px; margin: 0 auto; text-align: center; }' +
      '.kotd-step { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-3); margin-bottom: 10px; }' +
      '.kotd-glyph { font-family: var(--font-jp-display); font-size: 96px; line-height: 1.15; color: var(--ink); margin: 4px 0 14px; }' +
      '.kotd-glyph--small { font-size: 56px; margin: 0 0 8px; }' +
      '.kotd-ask { font-size: 15px; font-weight: 600; color: var(--ink); margin-bottom: 14px; }' +
      '.kotd-input { width: 100%; box-sizing: border-box; padding: 13px 16px; font-size: 16px; border: 1.5px solid var(--hairline); border-radius: var(--r-md); background: var(--washi); color: var(--ink); text-align: center; outline: none; font-family: var(--font-ui); }' +
      '.kotd-input:focus { border-color: var(--vermilion); }' +
      '.kotd-opts { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 6px; }' +
      '.kotd-opt { min-width: 96px; padding: 13px 18px; font-size: 18px; font-family: var(--font-jp); border: 1.5px solid var(--hairline); border-radius: var(--r-md); background: var(--washi); color: var(--ink); cursor: pointer; transition: transform 0.1s ease; }' +
      '.kotd-opt:active { transform: scale(0.96); }' +
      '.kotd-opt.wrong { opacity: 0.35; border-color: var(--vermilion); pointer-events: none; }' +
      '.kotd-opt.right { background: var(--moss); border-color: var(--moss); color: var(--washi); }' +
      '.kotd-fb { min-height: 22px; font-size: 13.5px; margin-top: 12px; color: var(--ink-3); }' +
      '.kotd-fb.ok { color: var(--moss); font-weight: 600; }' +
      '.kotd-fb.warn { color: var(--vermilion); font-weight: 600; }' +
      '.kotd-btn { margin-top: 16px; padding: 12px 26px; border-radius: 999px; border: none; background: var(--ink); color: var(--washi); font-size: 14.5px; font-weight: 600; cursor: pointer; }' +
      '.kotd-btn--vermilion { background: var(--vermilion); }' +
      '.kotd-stage { margin: 8px auto 0; width: min(320px, 84vw); aspect-ratio: 1; position: relative; overflow: hidden; border-radius: 24px; box-shadow: 0 8px 28px rgba(0,0,0,0.10), 0 0 0 1px var(--hairline); }' +
      '.kotd-write-tools { display: flex; gap: 10px; justify-content: center; margin-top: 12px; }' +
      '.kotd-write-tools button { padding: 8px 16px; border-radius: 999px; border: 1px solid var(--hairline); background: var(--washi); color: var(--ink-2); font-size: 13px; cursor: pointer; }' +
      '.kotd-done { animation: kotdPop 0.5s ease; }' +
      '.kotd-meta { font-size: 13px; color: var(--ink-2); line-height: 1.7; margin-top: 10px; }' +
      '@keyframes kotdPop { 0% { transform: scale(0.85); opacity: 0; } 60% { transform: scale(1.05); } 100% { transform: scale(1); opacity: 1; } }';
    document.head.appendChild(style);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function emitAnswer(correct) {
    try {
      if (window.JPShared.events) {
        window.JPShared.events.emit('drill-answer', { module: 'kotd', correct: !!correct, streak: 0 });
      }
    } catch (e) {}
  }

  function sfx(name) { try { var s = window.JPShared.sfx; s && s[name] && s[name](); } catch (e) {} }
  function haptic(name) { try { var h = window.JPShared.haptics; h && h[name] && h[name](); } catch (e) {} }

  // Lenient meaning grading: lowercase, strip punctuation/articles; accept any
  // comma/slash/"or"-separated variant, with "to "-prefix tolerance for verbs.
  function meaningVariants(meaning) {
    var out = [];
    String(meaning || '').toLowerCase()
      .split(/[,;/]|\bor\b/)
      .forEach(function (part) {
        var p = part.replace(/\(.*?\)/g, '').replace(/[^a-z0-9' -]/g, '').trim();
        if (!p) return;
        out.push(p);
        if (p.indexOf('to ') === 0) out.push(p.slice(3));
        if (p.indexOf('a ') === 0) out.push(p.slice(2));
        if (p.indexOf('the ') === 0) out.push(p.slice(4));
      });
    return out;
  }

  function normalizeGuess(s) {
    var g = String(s || '').toLowerCase().replace(/[^a-z0-9' -]/g, '').trim();
    if (g.indexOf('to ') === 0) g = g.slice(3);
    return g;
  }

  // Glossary reading fields can hold variants ("にち/じつ/に") — quiz on the
  // primary one so the answer chip isn't a multi-reading giveaway next to
  // single-reading distractors.
  function primaryReading(r) {
    return String(r || '').split(/[\/・,、\s]+/)[0];
  }

  function shuffleInPlace(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  window.JPShared.kotdDojo = {

    /**
     * @param stage   mount element (inside #kanji-app-root for CSS vars)
     * @param opts    { kanji, info:{on,kun,meaning}, distractors:{on:[],kun:[]},
     *                  glyph, onComplete, onExit }
     */
    init: function (stage, opts) {
      injectStyles();
      var kanji = opts.kanji;
      var info = opts.info || {};
      var canvas = null;

      function cleanup() {
        if (canvas && canvas.destroy) { try { canvas.destroy(); } catch (e) {} }
        canvas = null;
      }

      // ---------------- step 1: meaning ----------------
      function stepMeaning() {
        var tries = 0;
        stage.innerHTML =
          '<div class="kotd-wrap">' +
            '<div class="kotd-step">Step 1 of 3 · いみ · Meaning</div>' +
            '<div class="kotd-glyph">' + esc(kanji) + '</div>' +
            '<div class="kotd-ask">What does this kanji mean?</div>' +
            '<input class="kotd-input" id="kotd-in" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="Type the English meaning…">' +
            '<div class="kotd-fb" id="kotd-fb"></div>' +
            '<button class="kotd-btn kotd-btn--vermilion" id="kotd-check">Check</button>' +
          '</div>';
        var input = stage.querySelector('#kotd-in');
        var fb = stage.querySelector('#kotd-fb');
        var accepted = meaningVariants(info.meaning);

        function check() {
          var guess = normalizeGuess(input.value);
          if (!guess) return;
          var hit = accepted.indexOf(guess) >= 0;
          emitAnswer(hit);
          if (hit) {
            fb.textContent = '正解！ ' + (info.meaning || '');
            fb.className = 'kotd-fb ok';
            sfx('success'); haptic('success');
            setTimeout(stepReadings, 900);
          } else {
            tries++;
            sfx('error'); haptic('warning');
            if (tries >= 3) {
              fb.textContent = 'It means: ' + (info.meaning || '?') + ' — remember it for tomorrow!';
              fb.className = 'kotd-fb warn';
              setTimeout(stepReadings, 1800);
            } else {
              fb.textContent = 'Not quite — try again (' + (3 - tries) + ' left)';
              fb.className = 'kotd-fb warn';
              input.select();
            }
          }
        }
        stage.querySelector('#kotd-check').onclick = check;
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(); });
        setTimeout(function () { input.focus(); }, 150);
      }

      // ---------------- step 2: readings (on → kun, skipping absent) ----------------
      function stepReadings() {
        var phases = [];
        if (info.on) phases.push({ label: 'ON reading (おんよみ)', answer: primaryReading(info.on), pool: ((opts.distractors && opts.distractors.on) || []).map(primaryReading) });
        if (info.kun) phases.push({ label: 'KUN reading (くんよみ)', answer: primaryReading(info.kun), pool: ((opts.distractors && opts.distractors.kun) || []).map(primaryReading) });
        if (!phases.length) return stepWrite();

        var pi = 0;
        function renderPhase() {
          var ph = phases[pi];
          var options = [ph.answer];
          var pool = ph.pool.filter(function (r) { return r && r !== ph.answer && options.indexOf(r) < 0; });
          shuffleInPlace(pool);
          while (options.length < 4 && pool.length) options.push(pool.pop());
          shuffleInPlace(options);

          stage.innerHTML =
            '<div class="kotd-wrap">' +
              '<div class="kotd-step">Step 2 of 3 · よみかた · Readings' + (phases.length > 1 ? ' (' + (pi + 1) + '/' + phases.length + ')' : '') + '</div>' +
              '<div class="kotd-glyph kotd-glyph--small">' + esc(kanji) + '</div>' +
              '<div class="kotd-ask">Pick the ' + esc(ph.label) + '</div>' +
              '<div class="kotd-opts">' + options.map(function (o) {
                return '<button class="kotd-opt" data-r="' + esc(o) + '">' + esc(o) + '</button>';
              }).join('') + '</div>' +
              '<div class="kotd-fb" id="kotd-fb"></div>' +
            '</div>';
          var fb = stage.querySelector('#kotd-fb');
          var first = true;
          stage.querySelectorAll('.kotd-opt').forEach(function (btn) {
            btn.onclick = function () {
              var right = btn.getAttribute('data-r') === ph.answer;
              emitAnswer(right && first);
              if (right) {
                btn.classList.add('right');
                fb.textContent = '正解！';
                fb.className = 'kotd-fb ok';
                sfx('success'); haptic('success');
                pi++;
                setTimeout(pi < phases.length ? renderPhase : stepWrite, 800);
              } else {
                first = false;
                btn.classList.add('wrong');
                fb.textContent = 'Not that one — try again';
                fb.className = 'kotd-fb warn';
                sfx('error'); haptic('warning');
              }
            };
          });
        }
        renderPhase();
      }

      // ---------------- step 3: write once ----------------
      function stepWrite() {
        if (!opts.glyph || !window.JPShared.strokeCanvas) return finish();
        stage.innerHTML =
          '<div class="kotd-wrap">' +
            '<div class="kotd-step">Step 3 of 3 · かきかた · Writing</div>' +
            '<div class="kotd-ask">Write ' + esc(kanji) + ' — stroke <span id="kotd-cur">1</span> of ' + opts.glyph.strokes.length + '</div>' +
            '<div class="kotd-stage" id="kotd-stage"></div>' +
            '<div class="kotd-fb" id="kotd-fb"></div>' +
            '<div class="kotd-write-tools">' +
              '<button id="kotd-show">Show me</button>' +
              '<button id="kotd-reset">Reset</button>' +
            '</div>' +
          '</div>';
        var fb = stage.querySelector('#kotd-fb');
        var cur = stage.querySelector('#kotd-cur');
        canvas = window.JPShared.strokeCanvas.create({
          mount: stage.querySelector('#kotd-stage'),
          glyph: opts.glyph,
          onStrokeResult: function (ok, strokeIdx, res) {
            if (ok) {
              cur.textContent = Math.min(strokeIdx + 2, opts.glyph.strokes.length);
              fb.textContent = '';
            } else {
              var reason = res && res.reason;
              fb.textContent =
                reason === 'direction' ? 'Wrong direction — start from the other end' :
                reason === 'shape' ? 'Follow the watermark shape' :
                reason === 'too-short' ? 'A bit too short' : 'Try that stroke again';
              fb.className = 'kotd-fb warn';
            }
          },
          onComplete: function () {
            haptic('success');
            cleanup();
            finish();
          }
        });
        stage.querySelector('#kotd-show').onclick = function () { if (canvas) canvas.showOrderDemo(); };
        stage.querySelector('#kotd-reset').onclick = function () { if (canvas) { canvas.reset(); cur.textContent = 1; fb.textContent = ''; } };
      }

      // ---------------- done ----------------
      function finish() {
        sfx('unlock'); haptic('success');
        try {
          if (window.JPShared.events) window.JPShared.events.emit('kotd-complete', { kanji: kanji, srsKey: opts.srsKey || null });
        } catch (e) {}
        try {
          if (window.JPShared.streak) window.JPShared.streak.recordActivity();
        } catch (e) {}
        stage.innerHTML =
          '<div class="kotd-wrap kotd-done">' +
            '<div class="kotd-step">今日の漢字 · Complete</div>' +
            '<div class="kotd-glyph">' + esc(kanji) + '</div>' +
            '<div class="kotd-meta">' +
              (info.meaning ? '<strong>' + esc(info.meaning) + '</strong><br>' : '') +
              (info.on ? 'おん: ' + esc(info.on) + '　' : '') + (info.kun ? 'くん: ' + esc(info.kun) : '') +
            '</div>' +
            '<div class="kotd-fb ok" style="margin-top:14px;">よくできました — mastered for today!</div>' +
            '<button class="kotd-btn" id="kotd-exit">Back to Dojo</button>' +
          '</div>';
        stage.querySelector('#kotd-exit').onclick = function () { cleanup(); if (opts.onExit) opts.onExit(); };
        if (opts.onComplete) opts.onComplete();
      }

      stepMeaning();
      return { destroy: cleanup };
    }
  };

})();

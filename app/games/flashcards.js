/**
 * app/games/flashcards.js
 * Flashcards — study mode for kanji, vocab, and verbs.
 * Extracted from Practice.js kRenderFC() and surrounding machinery.
 *
 * Shell contract (hybrid):
 *   Practice.js owns chrome (progress/best/streak top bar, hanabi, progress API).
 *   This module owns everything inside its stage div: card HTML, flip, nav,
 *   card rendering, flag management, re-queue logic.
 *   Shell passes: container, type, mode, activeLessons, DB, onCorrect, onWrong,
 *                 onExit, getBest, setBest, recordActivity.
 */
(function () {
  'use strict';

  window.JPShared = window.JPShared || {};

  var cfg = null;
  var container = null;
  var curSet = [];
  var curIdx = 0;
  var curMode = '';
  var curType = '';
  var skipNextStreak = false;
  var flagCounts = {};
  var activeFlags = {};
  var kanjiBySurface = {};
  var hintKanjiUsed = false;
  var hintMeaningUsed = false;

  // Color palette for kanji ↔ reading span pairing.  Cycles modulo length
  // for vocab with more kanji than colors.  Soft pastel backgrounds; the
  // text itself stays the default dark color so the surface and reading
  // remain easy to read.
  var COLOR_PALETTE = ['#ffcdd2', '#bbdefb', '#c8e6c9', '#e1bee7', '#ffe0b2'];

  function injectStyles() {
    if (document.getElementById('jp-flashcards-style')) return;
    var s = document.createElement('style');
    s.id = 'jp-flashcards-style';
    s.textContent =
      '.vfc-kanji-meanings { display:flex; justify-content:center; gap:4px; margin-bottom:2px; }' +
      '.vfc-km { min-width:2.4rem; font-size:0.7rem; color:#888; text-align:center; line-height:1.1; padding:0 4px; border-radius:4px; }' +
      '.vfc-surface { display:flex; justify-content:center; gap:4px; font-family:"Noto Sans JP",sans-serif; font-size:2.4rem; font-weight:800; line-height:1.1; margin-bottom:4px; }' +
      '.vfc-surface .vfc-ch { min-width:2.4rem; text-align:center; padding:0 4px; border-radius:6px; color:#2f3542; }' +
      '.vfc-reading { text-align:center; font-size:1.4rem; color:#555; font-family:"Noto Sans JP",sans-serif; margin-bottom:10px; font-weight:600; }' +
      '.vfc-reading .vfc-r { font-weight:700; padding:0 4px; border-radius:6px; color:#2f3542; }' +
      '.vfc-juku-note { text-align:center; font-size:0.72rem; color:#8e44ad; font-style:italic; margin-bottom:12px; margin-top:-4px; }' +
      '.vfc-meaning { text-align:center; font-weight:700; font-size:1.8rem; color:var(--primary); line-height:1.2; margin-bottom:10px; }' +
      '.vfc-example { margin-top:12px; padding:10px 12px; background:#eaf4fb; border-left:4px solid #4a90d9; border-radius:4px; text-align:left; line-height:1.4; }' +
      '.vfc-example-label { font-size:0.68rem; font-weight:700; color:#4a6a85; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px; }' +
      '.vfc-example-jp { font-family:"Noto Sans JP",sans-serif; font-size:1rem; color:#2f3542; margin-bottom:3px; }' +
      '.vfc-example-en { font-size:0.85rem; color:#5d6670; font-style:italic; }' +
      '.vfc-front-surface { display:inline-flex; justify-content:center; gap:0; vertical-align:middle; }' +
      '.vfc-front-ch { min-width:5rem; text-align:center; }' +
      '.vfc-front-hint-row { text-align:center; margin-bottom:0.2rem; min-height:1.1rem; }' +
      '.vfc-front-hint-inner { display:inline-flex; justify-content:center; gap:0; }' +
      '.vfc-front-hint-cell { min-width:5rem; text-align:center; font-size:0.82rem; color:#6b7580; font-weight:600; line-height:1.1; }' +
      '.vfc-hint-btn-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px; }' +
      '.vfc-hint-btn-used { opacity:0.55; }';
    document.head.appendChild(s);
  }

  function isKanjiChar(ch) {
    if (!ch) return false;
    var c = ch.charCodeAt(0);
    return c >= 0x4E00 && c <= 0x9FFF;
  }

  function getKanjiMeaning(ch) {
    var k = kanjiBySurface[ch];
    if (!k || !k.meaning) return '';
    var first = String(k.meaning).split(/[\/,]/)[0];
    return first ? first.trim() : '';
  }

  // ---- readingAlign parser ----
  // Returns null if input is missing or malformed; otherwise an array of
  // segments:
  //   { type: 'kanji', surface: '注', reading: 'ちゅう', colorIdx: 0 }
  //   { type: 'juku',  surface: '今日', reading: 'きょう',  colorIdx: 0 }
  //   { type: 'kana',  surface: 'ち' }
  // Format:
  //   "X(abc)"   single kanji X with reading abc
  //   "XYZ{abc}" kanji run XYZ with a single reading abc (jukujikun)
  //   any other kana char passes through as a kana segment
  function parseReadingAlign(readingAlign) {
    if (!readingAlign || typeof readingAlign !== 'string') return null;
    var chars = Array.from(readingAlign);
    var segments = [];
    var colorIdx = 0;
    var i = 0;
    while (i < chars.length) {
      var ch = chars[i];
      if (isKanjiChar(ch) || ch === '々') {
        // Gather kanji run
        var runStart = i;
        while (i < chars.length && (isKanjiChar(chars[i]) || chars[i] === '々')) i++;
        var kanjiRun = chars.slice(runStart, i).join('');
        // Check what follows
        if (i < chars.length && chars[i] === '(') {
          var end = -1;
          for (var j = i + 1; j < chars.length; j++) { if (chars[j] === ')') { end = j; break; } }
          if (end < 0) return null;
          var reading = chars.slice(i + 1, end).join('');
          if (Array.from(kanjiRun).length === 1) {
            segments.push({ type: 'kanji', surface: kanjiRun, reading: reading, colorIdx: colorIdx++ });
          } else {
            segments.push({ type: 'juku', surface: kanjiRun, reading: reading, colorIdx: colorIdx++ });
          }
          i = end + 1;
        } else if (i < chars.length && chars[i] === '{') {
          var end2 = -1;
          for (var k = i + 1; k < chars.length; k++) { if (chars[k] === '}') { end2 = k; break; } }
          if (end2 < 0) return null;
          var reading2 = chars.slice(i + 1, end2).join('');
          segments.push({ type: 'juku', surface: kanjiRun, reading: reading2, colorIdx: colorIdx++ });
          i = end2 + 1;
        } else {
          // Kanji run with no reading annotation — malformed.
          return null;
        }
      } else {
        segments.push({ type: 'kana', surface: ch });
        i++;
      }
    }
    return segments;
  }

  function setTxt(id, txt) {
    var el = document.getElementById(id);
    if (el) el.innerText = txt;
  }

  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  // ---- Build curSet from type/mode ----
  function buildSet(type, mode, activeLessons, DB) {
    if (type === 'kanji') {
      return DB.kanji.filter(function (k) { return activeLessons.has(k.lesson); });
    }
    if (type === 'verb') {
      return DB.verb.slice();
    }
    if (type === 'vocab') {
      var tempMap = new Map();
      var activeK = DB.kanji.filter(function (k) { return activeLessons.has(k.lesson); });
      activeK.forEach(function (k) {
        var cs = (k.compounds || '').split(';');
        cs.forEach(function (c) {
          var vObj = DB.vocabMap.get(c);
          if (vObj && !tempMap.has(c)) {
            tempMap.set(c, {
              word: c,
              reading: vObj.reading,
              meaning: vObj.meaning,
              lesson: k.lesson,
              gtype: vObj.gtype,
              notes: vObj.notes,
              id: vObj.id,
              surface: vObj.surface,
              lesson_ids: vObj.lesson_ids,
              readingAlign: vObj.readingAlign,
              kanjiMeanings: vObj.kanjiMeanings,
              example: vObj.example
            });
          }
        });
      });
      return Array.from(tempMap.values());
    }
    if (type === 'mixed' && mode === 'flag-review') {
      var set = [];
      Object.keys(activeFlags).forEach(function (key) {
        if (!activeFlags[key]) return;
        var item = DB.kanji.find(function (k) { return k.kanji === key; });
        if (item) { set.push(Object.assign({}, item, { _type: 'kanji' })); return; }
        item = DB.vocabMap.get(key);
        if (item) {
          set.push(Object.assign({}, item, { word: item.surface, _type: 'vocab' }));
          return;
        }
        item = DB.verb.find(function (v) { return v.kanji === key || v.dict === key; });
        if (item) { set.push(Object.assign({}, item, { _type: 'verb' })); return; }
      });
      return set;
    }
    return [];
  }

  // ---- Dynamic compounds for kanji cards ----
  function getDynamicCompounds(kanjiChar, activeLessons, DB) {
    var activeKanji = new Set();
    DB.kanji.forEach(function (k) {
      if (activeLessons.has(k.lesson)) activeKanji.add(k.kanji);
    });
    var results = [];
    (DB.allVocab || []).forEach(function (v) {
      if (!v.surface.includes(kanjiChar)) return;
      var allKnown = Array.from(v.surface).every(function (ch) {
        if (ch.charCodeAt(0) >= 0x4E00 && ch.charCodeAt(0) <= 0x9FFF) {
          return activeKanji.has(ch);
        }
        return true;
      });
      if (allKnown) results.push(v);
    });
    return results;
  }

  // ---- Stage markup ----
  function renderStage() {
    container.innerHTML =
      '<div class="k-scene" id="k-fc-scene">' +
        '<div class="k-card-obj" id="k-fc-card-obj">' +
          '<div class="k-face k-face-front">' +
            '<div class="k-flag-stamp k-hidden" id="k-fc-flagged-icon">AGAIN</div>' +
            '<div class="k-lbl" id="k-fc-lbl" style="color:var(--primary)"></div>' +
            '<div id="k-fc-hint-kanji" class="k-hidden vfc-front-hint-row"></div>' +
            '<div class="k-big" id="k-fc-main"></div>' +
            '<div class="k-sub" id="k-fc-sub"></div>' +
            '<div class="k-tap-hint">Tap to Flip</div>' +
          '</div>' +
          '<div class="k-face k-face-back" id="k-fc-back-content"></div>' +
        '</div>' +
      '</div>' +
      '<div id="k-fc-nav-container" style="width:100%; margin-top:15px;"></div>';

    var scene = document.getElementById('k-fc-scene');
    if (scene) scene.addEventListener('click', flipCard);
  }

  function flipCard() {
    var c = document.getElementById('k-fc-card-obj');
    if (c) c.classList.toggle('is-flipped');
  }

  // ---- Render the current card ----
  function renderCard() {
    if (!curSet.length) return;
    var d = curSet[curIdx];
    setTxt('k-fc-progress', 'Card ' + (curIdx + 1) + ' / ' + curSet.length);

    var cardObj = document.getElementById('k-fc-card-obj');
    if (cardObj) cardObj.classList.remove('is-flipped');

    // Reset per-card hint state and clear hint DOM
    hintKanjiUsed = false;
    hintMeaningUsed = false;
    var hintKanjiEl = document.getElementById('k-fc-hint-kanji');
    if (hintKanjiEl) {
      hintKanjiEl.innerHTML = '';
      hintKanjiEl.classList.add('k-hidden');
    }

    var stamp = document.getElementById('k-fc-flagged-icon');
    if (stamp) {
      var kKey = d.kanji || d.word || d.dict;
      if ((d.isRequeued || activeFlags[kKey]) && curMode !== 'flag-review') stamp.classList.remove('k-hidden');
      else stamp.classList.add('k-hidden');
    }

    renderNav();

    var backEl = document.getElementById('k-fc-back-content');
    var renderType = curType;
    if (curType === 'mixed' && d._type) renderType = d._type;

    var speakText = d.reading || d.kanji || d.word || d.surface;
    var escapedText = String(speakText).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    var speakBtnHtml = '<span class="jp-speak-btn" data-speak-text="' + escapedText + '" style="cursor:pointer; font-size:0.6em; margin-left:10px; opacity:0.7;">🔊</span>';

    if (renderType === 'kanji') renderKanjiCard(d, backEl, speakText, speakBtnHtml);
    else if (renderType === 'vocab') renderVocabCard(d, backEl, speakText, speakBtnHtml);
    else renderVerbCard(d, backEl, speakText, speakBtnHtml);
  }

  function renderNav() {
    var navContainer = document.getElementById('k-fc-nav-container');
    if (!navContainer) return;
    navContainer.innerHTML = '';

    var html = '';

    // Hint row for vocab cards (front-side reveal buttons)
    var d = curSet[curIdx];
    var renderType = curType;
    if (curType === 'mixed' && d && d._type) renderType = d._type;
    if (renderType === 'vocab' && curMode !== 'flag-review') {
      var hasKanjiChars = false;
      if (d && d.word) {
        var chars = Array.from(String(d.word));
        for (var i = 0; i < chars.length; i++) {
          if (isKanjiChar(chars[i])) { hasKanjiChars = true; break; }
        }
      }
      var kDisabled = hintKanjiUsed || !hasKanjiChars;
      var mDisabled = hintMeaningUsed;
      html +=
        '<div class="vfc-hint-btn-row">' +
          '<button class="k-btn k-btn-sec' + (kDisabled ? ' vfc-hint-btn-used' : '') + '" id="k-fc-btn-hint-kanji"' + (kDisabled ? ' disabled' : '') + ' style="font-size:0.85rem; padding:8px;">💡 Kanji Meanings' + (hintKanjiUsed ? ' ✓' : '') + '</button>' +
          '<button class="k-btn k-btn-sec' + (mDisabled ? ' vfc-hint-btn-used' : '') + '" id="k-fc-btn-hint-meaning"' + (mDisabled ? ' disabled' : '') + ' style="font-size:0.85rem; padding:8px;">💡 English' + (hintMeaningUsed ? ' ✓' : '') + '</button>' +
        '</div>';
    }

    if (curMode === 'flag-review') {
      html +=
        '<div style="display: flex; gap: 10px;">' +
          '<div style="flex: 1; display: flex; flex-direction: column; gap: 10px;">' +
            '<button class="k-btn k-btn-sec" id="k-fc-btn-keepflag" style="color:#f39c12; border-color:#f39c12; font-weight:900; min-height: 70px; padding: 10px;">Keep Flag (+1)</button>' +
            '<button class="k-btn k-btn-sec" id="k-fc-btn-clearflag" style="color:#2ed573; border-color:#2ed573; font-weight:900; min-height: 70px; padding: 10px;">Clear Flag</button>' +
          '</div>' +
          '<div style="flex: 1; display: flex; flex-direction: column; gap: 10px;">' +
            '<button class="k-btn k-btn-sec" id="k-fc-btn-prev" style="min-height: 70px; padding: 10px;">Prev</button>' +
            '<button class="k-btn k-btn-sec" id="k-fc-btn-next" style="min-height: 70px; padding: 10px;">Next</button>' +
          '</div>' +
        '</div>';
    } else {
      html +=
        '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">' +
          '<button class="k-btn k-btn-sec" id="k-fc-btn-prev">Prev</button>' +
          '<button class="k-btn k-btn-sec" id="k-fc-btn-flag" style="color:#f39c12; border-color:#f39c12;">Flag 🚩</button>' +
          '<button class="k-btn k-btn-sec" id="k-fc-btn-next">Next</button>' +
        '</div>';
    }

    navContainer.innerHTML = html;

    if (curMode === 'flag-review') {
      wire('k-fc-btn-keepflag', function (e) { flag(e.currentTarget); });
      wire('k-fc-btn-clearflag', function (e) { clearFlag(e.currentTarget); });
    } else {
      wire('k-fc-btn-flag', function (e) { flag(e.currentTarget); });
    }
    wire('k-fc-btn-hint-kanji', function () { revealHintKanji(); });
    wire('k-fc-btn-hint-meaning', function () { revealHintMeaning(); });
    wire('k-fc-btn-prev', function () { move(-1); });
    wire('k-fc-btn-next', function () { move(1); });
  }

  function revealHintKanji() {
    if (hintKanjiUsed) return;
    var d = curSet[curIdx];
    if (!d || !d.word) return;
    var chars = Array.from(String(d.word));
    var hasK = chars.some(isKanjiChar);
    if (!hasK) return;

    var resolveD = { kanjiMeanings: Array.isArray(d.kanjiMeanings) ? d.kanjiMeanings : null };

    var speakText = d.reading || d.word || d.surface;
    var escText = String(speakText).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    var speakBtn = '<span class="jp-speak-btn" data-speak-text="' + escText + '" style="cursor:pointer; font-size:0.6em; margin-left:10px; opacity:0.7;">🔊</span>';

    var surfaceHtml = '<span class="vfc-front-surface">';
    chars.forEach(function (ch) {
      surfaceHtml += '<span class="vfc-front-ch">' + esc(ch) + '</span>';
    });
    surfaceHtml += '</span>';
    var mainEl = document.getElementById('k-fc-main');
    if (mainEl) mainEl.innerHTML = surfaceHtml + speakBtn;
    attachSpeakBtn('#k-fc-main .jp-speak-btn', speakText);

    var hintHtml = '<span class="vfc-front-hint-inner">';
    chars.forEach(function (ch, i) {
      var m = resolveKanjiMeaning(resolveD, chars, i);
      var slot = m ? esc(m) : '&nbsp;';
      hintHtml += '<span class="vfc-front-hint-cell">' + slot + '</span>';
    });
    hintHtml += '</span>';
    var hintEl = document.getElementById('k-fc-hint-kanji');
    if (hintEl) {
      hintEl.innerHTML = hintHtml;
      hintEl.classList.remove('k-hidden');
    }

    hintKanjiUsed = true;
    renderNav();
  }

  function revealHintMeaning() {
    if (hintMeaningUsed) return;
    var d = curSet[curIdx];
    if (!d) return;
    setTxt('k-fc-sub', d.meaning || '');
    hintMeaningUsed = true;
    renderNav();
  }

  function wire(id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', function (ev) { ev.stopPropagation(); fn(ev); });
  }

  function attachSpeakBtn(selector, speakText) {
    var btn = document.querySelector(selector);
    if (!btn) return;
    btn.onclick = function (e) {
      e.stopPropagation();
      if (window.JPShared && window.JPShared.tts) window.JPShared.tts.speak(speakText);
    };
  }

  // ---- Card renderers ----
  function renderKanjiCard(d, backEl, speakText, speakBtnHtml) {
    setTxt('k-fc-lbl', d.lesson);
    if (curMode === 'flag-review') setTxt('k-fc-lbl', '🚩 Flags: ' + (flagCounts[d.kanji] || 0));

    var mainEl = document.getElementById('k-fc-main');
    if (mainEl) mainEl.innerHTML = esc(d.kanji) + speakBtnHtml;
    attachSpeakBtn('#k-fc-main .jp-speak-btn', speakText);
    setTxt('k-fc-sub', '');

    var h = '<div style="text-align:center; font-weight:700; font-size:2rem; margin-bottom:15px; color:var(--primary); line-height:1.2;">' + esc(d.meaning) + '</div>';
    var flags = flagCounts[d.kanji] || 0;
    if (flags > 0) h += '<div style="text-align:center; color:#ff4757; font-weight:700; margin-bottom:15px; font-size:0.8rem;">🚩 Flagged: ' + flags + ' times</div>';
    h += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:15px; width:100%">' +
           '<div style="background:#f8f9fa; padding:10px; border-radius:8px; text-align:center"><div style="font-size:0.7rem; color:#aaa; font-weight:700;">ON-YOMI</div><div style="font-size:1.2rem; font-weight:600;">' + esc(d.on || '-') + '</div></div>' +
           '<div style="background:#f8f9fa; padding:10px; border-radius:8px; text-align:center"><div style="font-size:0.7rem; color:#aaa; font-weight:700;">KUN-YOMI</div><div style="font-size:1.2rem; font-weight:600;">' + esc(d.kun || '-') + '</div></div>' +
         '</div>';
    var dynCompounds = getDynamicCompounds(d.kanji, cfg.activeLessons, cfg.DB);
    function compoundRow(v, cls, hide) {
      return '<tr' + (cls ? ' class="' + cls + '"' : '') + (hide ? ' style="display:none"' : '') + '>' +
        '<td style="font-weight:bold; font-size:1.2rem">' + esc(v.surface) + '</td>' +
        '<td><div style="font-size:1rem">' + esc(v.reading || '') + '</div><div style="color:#747d8c; font-size:0.9rem">' + esc(v.meaning || '') + '</div></td></tr>';
    }
    h += '<div class="k-lbl" style="text-align:left;margin-top:10px;border-bottom:1px solid #eee;">Compounds' + (dynCompounds.length ? ' (' + dynCompounds.length + ')' : '') + '</div><table class="k-tbl">';
    if (dynCompounds.length === 0) {
      h += '<tr><td colspan="2" style="color:#aaa; font-size:0.9rem; padding:8px; text-align:center;">No compounds unlocked yet</td></tr>';
    } else {
      dynCompounds.slice(0, 5).forEach(function (v) { h += compoundRow(v); });
      if (dynCompounds.length > 5) {
        var extraId = 'k-extra-' + Date.now();
        h += '<tr class="k-show-more-row" data-extra-id="' + extraId + '"><td colspan="2" style="text-align:center; color:var(--primary); cursor:pointer; font-size:0.9rem; padding:8px; font-weight:600;">Show ' + (dynCompounds.length - 5) + ' more</td></tr>';
        dynCompounds.slice(5).forEach(function (v) { h += compoundRow(v, extraId, true); });
      }
    }
    if (backEl) {
      backEl.innerHTML = h + '</table>';
      var more = backEl.querySelector('.k-show-more-row');
      if (more) {
        more.addEventListener('click', function () {
          var id = more.dataset.extraId;
          more.style.display = 'none';
          backEl.querySelectorAll('.' + id).forEach(function (r) { r.style.display = ''; });
        });
      }
    }
  }

  function resolveKanjiMeaning(d, surfaceChars, charIdx) {
    var override = Array.isArray(d.kanjiMeanings) ? d.kanjiMeanings[charIdx] : null;
    if (override && String(override).trim()) return String(override).trim();
    var ch = surfaceChars[charIdx];
    if (!isKanjiChar(ch)) return '';
    return getKanjiMeaning(ch);
  }

  function renderVocabCard(d, backEl, speakText, speakBtnHtml) {
    setTxt('k-fc-lbl', 'Vocabulary');
    if (curMode === 'flag-review') setTxt('k-fc-lbl', '🚩 Flags: ' + (flagCounts[d.word] || 0));

    var mainEl = document.getElementById('k-fc-main');
    if (mainEl) mainEl.innerHTML = esc(d.word) + speakBtnHtml;
    attachSpeakBtn('#k-fc-main .jp-speak-btn', speakText);
    setTxt('k-fc-sub', '');

    var surface = d.word || '';
    var surfaceChars = Array.from(surface);
    var hasKanji = surfaceChars.some(isKanjiChar);

    // readingAlign and kanjiMeanings live directly on the curSet item
    // (populated from the glossary vocab entry in buildSet).
    var segments = parseReadingAlign(d.readingAlign);
    var resolveD = { kanjiMeanings: Array.isArray(d.kanjiMeanings) ? d.kanjiMeanings : null };

    var h = '';
    if (hasKanji && segments) {
      // Color-mapped path: surface chars highlighted by segment membership;
      // reading rendered inline with matching highlights per segment.
      // Text color stays dark; background provides the visual pairing.
      var surfaceColorByIdx = {};
      var hasJuku = false;
      var charIdx = 0;
      segments.forEach(function (seg) {
        if (seg.type === 'kanji') {
          surfaceColorByIdx[charIdx] = COLOR_PALETTE[seg.colorIdx % COLOR_PALETTE.length];
          charIdx += 1;
        } else if (seg.type === 'juku') {
          hasJuku = true;
          var runChars = Array.from(seg.surface);
          for (var r = 0; r < runChars.length; r++) {
            surfaceColorByIdx[charIdx + r] = COLOR_PALETTE[seg.colorIdx % COLOR_PALETTE.length];
          }
          charIdx += runChars.length;
        } else { // kana
          charIdx += 1;
        }
      });

      var meaningRow = '<div class="vfc-kanji-meanings">';
      var surfaceRow = '<div class="vfc-surface">';
      surfaceChars.forEach(function (ch, i) {
        var color = surfaceColorByIdx[i];
        var meaning = resolveKanjiMeaning(resolveD, surfaceChars, i);
        var slot = meaning ? esc(meaning) : '&nbsp;';
        if (color) {
          meaningRow += '<span class="vfc-km" style="background:' + color + ';">' + slot + '</span>';
          surfaceRow += '<span class="vfc-ch" style="background:' + color + ';">' + esc(ch) + '</span>';
        } else {
          meaningRow += '<span class="vfc-km">' + slot + '</span>';
          surfaceRow += '<span class="vfc-ch">' + esc(ch) + '</span>';
        }
      });
      meaningRow += '</div>';
      surfaceRow += '</div>';
      h += meaningRow + surfaceRow;

      // Reading row: walk segments, emitting highlighted runs for kanji/juku
      // and literal kana between.
      var readingRow = '<div class="vfc-reading">';
      segments.forEach(function (seg) {
        if (seg.type === 'kana') {
          readingRow += '<span>' + esc(seg.surface) + '</span>';
        } else {
          var color = COLOR_PALETTE[seg.colorIdx % COLOR_PALETTE.length];
          readingRow += '<span class="vfc-r" style="background:' + color + ';">' + esc(seg.reading) + '</span>';
        }
      });
      readingRow += '</div>';
      h += readingRow;

      // Jukujikun annotation: make clear that a highlighted kanji run
      // reads as a single unit (no per-kanji split).
      if (hasJuku) {
        h += '<div class="vfc-juku-note">※ jukujikun — the highlighted kanji read as a single unit</div>';
      }
    } else if (hasKanji) {
      // Fallback path: no readingAlign (or malformed).  Show per-kanji
      // meaning row and uncolored surface row; plain reading below.
      var meaningRowB = '<div class="vfc-kanji-meanings">';
      var surfaceRowB = '<div class="vfc-surface">';
      surfaceChars.forEach(function (ch, i) {
        var meaning = resolveKanjiMeaning(resolveD, surfaceChars, i);
        var slot = meaning ? esc(meaning) : '&nbsp;';
        meaningRowB += '<span class="vfc-km">' + slot + '</span>';
        surfaceRowB += '<span class="vfc-ch">' + esc(ch) + '</span>';
      });
      meaningRowB += '</div>';
      surfaceRowB += '</div>';
      h += meaningRowB + surfaceRowB;
      h += '<div class="vfc-reading">' + esc(d.reading) + '</div>';
    } else {
      // Pure kana: no meaning row, reading = surface, centered normally.
      h += '<div class="vfc-reading">' + esc(d.reading) + '</div>';
    }

    h += '<div class="vfc-meaning">' + esc(d.meaning) + '</div>';
    if (d.gtype) h += '<div style="display:inline-block; background:#eee; color:#555; font-size:0.8rem; font-weight:700; padding:4px 12px; border-radius:12px; text-transform:uppercase; margin-bottom:15px;">' + esc(d.gtype) + '</div>';
    if (d.example && d.example.jp) {
      var exLabel = 'From ' + (d.example.lessonId || 'lesson') + (d.example.sectionType ? ' ' + d.example.sectionType : '');
      h += '<div class="vfc-example">' +
             '<div class="vfc-example-label">' + esc(exLabel) + '</div>' +
             '<div class="vfc-example-jp">' + esc(d.example.jp) + '</div>' +
             (d.example.en ? '<div class="vfc-example-en">' + esc(d.example.en) + '</div>' : '') +
           '</div>';
    }
    if (d.notes) h += '<div style="margin-top:10px; padding:12px; background:#fff8e1; border-left:4px solid #ffca28; color:#5d4037; font-size:0.9rem; text-align:left; border-radius:4px; line-height:1.4;"><strong>Note:</strong> ' + esc(d.notes) + '</div>';
    var flags = flagCounts[d.word] || 0;
    if (flags > 0) h += '<div style="text-align:center; color:#ff4757; font-weight:700; margin-top:15px; font-size:0.8rem;">🚩 Flagged: ' + flags + ' times</div>';
    if (backEl) backEl.innerHTML = h;
  }

  function renderVerbCard(d, backEl, speakText, speakBtnHtml) {
    setTxt('k-fc-lbl', 'Verb');
    if (curMode === 'flag-review') setTxt('k-fc-lbl', '🚩 Flags: ' + (flagCounts[d.kanji || d.dict] || 0));

    var vText = d.kanji === '-' ? d.dict : d.kanji;
    var mainEl = document.getElementById('k-fc-main');
    if (mainEl) mainEl.innerHTML = esc(vText) + speakBtnHtml;
    attachSpeakBtn('#k-fc-main .jp-speak-btn', speakText);
    setTxt('k-fc-sub', '');

    var h = '<div style="text-align:center; font-weight:700; font-size:2rem; margin-bottom:15px; color:var(--primary);">' + esc(d.meaning) + '</div>';
    h += '<div style="text-align:center; margin-bottom:10px; color:#555;">' + esc(d.reading) + '</div>';
    h += '<table class="k-tbl">' +
      '<tr><th>Masu</th><td>' + esc(d.masu) + '</td></tr>' +
      '<tr><th>Te</th><td>' + esc(d.te) + '</td></tr>' +
      '<tr><th>Nai</th><td>' + esc(d.nai) + '</td></tr>' +
      '<tr><th>Ta</th><td>' + esc(d.ta) + '</td></tr>' +
      '<tr><th>Potential</th><td>' + esc(d.potential) + '</td></tr>' +
      '</table>';
    if (backEl) backEl.innerHTML = h;
  }

  // ---- Navigation ----
  function move(n) {
    var c = document.getElementById('k-fc-card-obj');
    var wasFlipped = c && c.classList.contains('is-flipped');

    if (curMode === 'flash' && n === 1) {
      if (skipNextStreak) {
        skipNextStreak = false;
      } else {
        if (cfg.onCorrect) cfg.onCorrect();
      }
    }

    if (wasFlipped) {
      c.classList.remove('is-flipped');
      setTimeout(function () {
        curIdx = (curIdx + n + curSet.length) % curSet.length;
        renderCard();
      }, 300);
    } else {
      curIdx = (curIdx + n + curSet.length) % curSet.length;
      renderCard();
    }
  }

  function flag(btn) {
    var currentItem = curSet[curIdx];
    var kKey = currentItem.kanji || currentItem.word || currentItem.dict;

    if (curMode === 'flash') {
      skipNextStreak = true;
      if (cfg.onWrong) cfg.onWrong();
    }

    flagCounts[kKey] = (flagCounts[kKey] || 0) + 1;
    activeFlags[kKey] = true;
    if (window.JPShared.progress) window.JPShared.progress.flagTerm(kKey);

    curSet.push(Object.assign({}, currentItem, { isRequeued: true }));

    var originalText = btn.innerText;
    btn.innerText = 'Marked & Re-queued! ↺';
    btn.style.backgroundColor = '#fff3cd';
    setTimeout(function () {
      btn.innerText = originalText;
      btn.style.backgroundColor = '';
      move(1);
    }, 800);
  }

  function clearFlag(btn) {
    var currentItem = curSet[curIdx];
    var kKey = currentItem.kanji || currentItem.word || currentItem.dict;

    delete activeFlags[kKey];
    if (window.JPShared.progress) window.JPShared.progress.clearFlag(kKey);

    btn.innerText = 'Cleared! ✨';

    setTimeout(function () {
      if (curSet.length > 1) {
        curSet.splice(curIdx, 1);
        if (curIdx >= curSet.length) curIdx = 0;
        renderCard();
      } else {
        alert('All active flags cleared! Returning to menu.');
        if (cfg.onExit) cfg.onExit();
      }
    }, 600);
  }

  // ---- Public API ----
  window.JPShared.flashcards = {
    init: function (containerEl, ctx) {
      injectStyles();
      cfg = ctx;
      container = containerEl;
      curType = ctx.type;
      curMode = ctx.mode;
      curIdx = 0;
      skipNextStreak = false;

      flagCounts = (window.JPShared.progress && window.JPShared.progress.getAllFlags()) || {};
      activeFlags = (window.JPShared.progress && window.JPShared.progress.getAllActiveFlags()) || {};

      kanjiBySurface = {};
      (cfg.DB.kanji || []).forEach(function (k) {
        if (k && k.kanji) kanjiBySurface[k.kanji] = k;
      });

      curSet = buildSet(curType, curMode, cfg.activeLessons, cfg.DB);
      if (curSet.length === 0) {
        alert(curMode === 'flag-review' ? 'No active flagged items found!' : 'Please select at least one lesson.');
        if (cfg.onExit) cfg.onExit();
        return;
      }
      curSet.sort(function () { return Math.random() - 0.5; });

      renderStage();
      renderCard();
    },
    destroy: function () {
      if (container) container.innerHTML = '';
      cfg = null;
      container = null;
      curSet = [];
    }
  };
})();

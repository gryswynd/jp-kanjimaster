/**
 * Glossary.js — the learner's growing personal dictionary.
 *
 * A single book that gets visually "fatter" as the learner clears lessons.
 * It collects every glossary term taught in a COMPLETED lesson (gated by
 * k-lesson-completed via JPShared.unlock; free mode shows everything). Terms
 * can be browsed two ways — gojūon (あいうえお) order or by the lesson that
 * taught them — and tapping a term raises a sticky-note popup with its
 * definition, notes, example, and a jump back to its lesson.
 *
 * Public API:
 *   window.GlossaryModule.start(container, config, exit, deepLinkTermId)
 *
 * Reuses existing JPShared helpers — no new runtime deps beyond kana-collate:
 *   - JPShared.kanaCollate : gojūon key/compare/rowOf (loaded as a dep)
 *   - JPShared.jpText.render({tokens}) : furigana / romaji renderer
 *   - JPShared.unlock.isCompleted / isFree : lesson gating
 *   - window.getManifest / window.getAssetUrl : data loading (shared/asset-url.js)
 *   - window.JPApp.launch('lesson'|'grammar', id) : "Go to lesson"
 */

window.GlossaryModule = (function () {
  'use strict';

  // Levels whose glossaries this dictionary draws from. Decoupled from
  // manifest.levels (which lists only N5/N4) so N3 — and future N2/N1 — load
  // here without changing Stories/Compose/Lesson/audit behavior. Missing files
  // are skipped gracefully.
  var GLOSSARY_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
  var LEVEL_ORDER = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 };

  var TYPE_BADGE = {
    kanji:    { label: '漢字',  cls: 'k' },
    vocab:    { label: '語',    cls: 'v' },
    grammar:  { label: '文法',  cls: 'g' },
    phrase:   { label: '表現',  cls: 'p' },
    particle: { label: '助詞',  cls: 'pt' }
  };

  // ── State ──────────────────────────────────────────────────────────────────
  var container = null;
  var config = null;
  var onExit = null;
  var byId = {};            // id → entry (deduped canonical set)
  var lessonTitle = {};     // "N5.1" → "People & Family" (N5/N4 from manifest)
  var learned = [];         // kept entries, decorated with sort keys
  var sortMode = 'kana';    // 'kana' | 'lesson'
  var searchQuery = '';     // live search box text
  var totalLearnable = 0;   // entries across loaded levels (for thickness scale)

  var SORT_KEY = 'k-glossary-sort';

  // ── Boot ─────────────────────────────────────────────────────────────────
  function getUrl(p) { return window.getAssetUrl ? window.getAssetUrl(config, p) : p; }

  function start(containerEl, repoConfig, exitCallback, deepLinkTermId) {
    container = containerEl;
    config = repoConfig;
    onExit = exitCallback;
    try { var s = localStorage.getItem(SORT_KEY); if (s === 'kana' || s === 'lesson') sortMode = s; } catch (e) {}
    injectStyles();
    initialize(deepLinkTermId);
  }

  async function initialize(deepLinkTermId) {
    container.innerHTML =
      '<div class="jp-gl-root"><div class="jp-gl-loading"><div class="jp-gl-spinner"></div>Opening your dictionary…</div></div>';
    try {
      var manifest = await window.getManifest(config);
      await loadGlossaries(manifest);
      buildLessonMeta(manifest);
      buildLearnedView();
      if (deepLinkTermId && byId[deepLinkTermId]) { renderIndex(); openTerm(deepLinkTermId); return; }
      renderBook();
    } catch (err) {
      console.error('[Glossary] init error:', err);
      container.innerHTML =
        '<div class="jp-gl-root"><div class="jp-gl-error"><strong>Couldn’t open the dictionary</strong><br>' +
        esc((err && err.message) || String(err)) + '</div></div>';
    }
  }

  // ── Data loading ───────────────────────────────────────────────────────────
  async function loadGlossaries(manifest) {
    var bust = '?t=' + Date.now();
    var urls = GLOSSARY_LEVELS.map(function (lvl) {
      // Prefer the manifest-declared path; fall back to the conventional path.
      var fromManifest = manifest && manifest.data && manifest.data[lvl] && manifest.data[lvl].glossary;
      var path = fromManifest || ('data/' + lvl + '/glossary.' + lvl + '.json');
      return getUrl(path);
    });
    var results = await Promise.all(urls.map(function (u) {
      return fetch(u + bust).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    }));
    byId = {};
    totalLearnable = 0;
    results.forEach(function (g) {
      if (!g || !Array.isArray(g.entries)) return;
      g.entries.forEach(function (e) {
        if (!e || !e.id || byId[e.id]) return; // first occurrence (lowest level) wins
        byId[e.id] = e;
        totalLearnable++;
      });
    });
  }

  function buildLessonMeta(manifest) {
    lessonTitle = {};
    var d = (manifest && manifest.data) || {};
    Object.keys(d).forEach(function (lvl) {
      (d[lvl].lessons || []).forEach(function (l) { if (l && l.id) lessonTitle[l.id] = l.title || ''; });
    });
  }

  // ── Gating / sort decoration ────────────────────────────────────────────────
  // A usable "where taught" is a real lesson id (N4.1), grammar id (G31) or
  // review (N5.Review.2) — NOT a bare level tag like "N5" (mistagged entries
  // point nowhere). Mirrors tutor-curriculum's isValidWhere.
  function isValidWhere(w) { return /^N\d\.\d/.test(w) || /^G\d+$/.test(w) || /Review/i.test(w); }

  function firstValidLesson(entry) {
    var raw = entry.lesson || entry.lesson_ids || '';
    var parts = String(raw).split(/[,\s]+/).filter(Boolean);
    for (var i = 0; i < parts.length; i++) { if (isValidWhere(parts[i])) return parts[i]; }
    return null;
  }

  function lessonRank(lid) {
    var m = /^N(\d)\.(\d+)/.exec(lid || '');
    if (m) {
      var lvl = 'N' + m[1];
      var base = (LEVEL_ORDER[lvl] != null ? LEVEL_ORDER[lvl] : 9) * 100000;
      return base + parseInt(m[2], 10) * 100; // ×100 leaves room for Review/G after a lesson
    }
    // Grammar / review / anything else sorts after numbered lessons of its hint
    // level (best-effort), else at the very end.
    return 9 * 100000 + 99999;
  }

  function buildLearnedView() {
    var unlock = window.JPShared && window.JPShared.unlock;
    var free = unlock ? unlock.isFree() : false;
    var kc = window.JPShared.kanaCollate;
    var jt = window.JPShared && window.JPShared.jpText;
    learned = [];
    Object.keys(byId).forEach(function (id) {
      var e = byId[id];
      var lid = firstValidLesson(e);
      if (!lid) return; // defensive: skip bare-level/untagged
      if (!free) {
        if (!unlock || !unlock.isCompleted(lid)) return;
      }
      var reading = e.reading || e.surface || '';
      e._lessonId = lid;
      e._lessonRank = lessonRank(lid);
      e._kanaKey = kc ? kc.key(reading) : reading;
      e._row = kc ? kc.rowOf(reading) : { row: '他', label: 'その他' };
      // Search haystack: surface + reading + rōmaji + English meaning, lowercased.
      var romaji = (jt && jt.kanaToRomaji) ? jt.kanaToRomaji(reading) : '';
      e._hay = ((e.surface || '') + '' + reading + '' + romaji + '' + (e.meaning || '')).toLowerCase();
      learned.push(e);
    });
  }

  // ── Closed book (gets fatter with progress) ─────────────────────────────────
  function bookThickness() {
    // Sub-linear so early progress visibly thickens the book while leaving
    // headroom toward the full set. MIN..MAX in px of page-block width.
    var MIN = 12, MAX = 116;
    if (!totalLearnable) return MIN;
    var frac = Math.min(1, learned.length / totalLearnable);
    return Math.round(MIN + (MAX - MIN) * Math.sqrt(frac));
  }

  function renderBook() {
    var thickness = bookThickness();
    var count = learned.length;
    container.innerHTML =
      '<div class="jp-gl-root">' +
        topBar(false) +
        '<div class="jp-gl-shelf">' +
          '<div class="jp-gl-stage">' +
            '<div class="jp-gl-book" id="jp-gl-book" style="--thick:' + thickness + 'px;" role="button" tabindex="0" aria-label="Open dictionary">' +
              '<div class="jp-gl-pages"></div>' +
              '<div class="jp-gl-cover">' +
                '<div class="jp-gl-cover-spine"></div>' +
                '<div class="jp-gl-cover-inner">' +
                  '<div class="jp-gl-cover-kanji">辞書</div>' +
                  '<div class="jp-gl-cover-title">My Dictionary</div>' +
                  '<div class="jp-gl-cover-sub">じぶんの じしょ</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="jp-gl-caption">' +
            '<strong>' + count + '</strong> ' + (count === 1 ? 'word' : 'words') + ' learned' +
            (count ? '<span class="jp-gl-caption-hint">Tap the book to open</span>'
                   : '<span class="jp-gl-caption-hint">Clear lessons to fill these pages</span>') +
          '</div>' +
        '</div>' +
      '</div>';

    bindTopBar();
    refreshTabBar();
    var book = document.getElementById('jp-gl-book');
    var open = function () {
      if (!count) { return; } // nothing to read yet
      if (book.classList.contains('jp-opening')) return;
      var sk = window.JPShared && window.JPShared.sceneKit;
      if (sk && sk.tapFeedback) sk.tapFeedback(book);
      book.classList.add('jp-opening');
      setTimeout(renderIndex, 540);
    };
    book.addEventListener('click', open);
    book.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); } });
  }

  // ── Index (open book) ───────────────────────────────────────────────────────
  function buildSections() {
    var kc = window.JPShared.kanaCollate;
    var sections = [];
    if (sortMode === 'lesson') {
      var groups = {};
      learned.forEach(function (e) { (groups[e._lessonId] = groups[e._lessonId] || []).push(e); });
      Object.keys(groups)
        .sort(function (a, b) { return lessonRank(a) - lessonRank(b) || (a < b ? -1 : 1); })
        .forEach(function (lid) {
          var items = groups[lid].sort(function (a, b) { return a._kanaKey < b._kanaKey ? -1 : a._kanaKey > b._kanaKey ? 1 : 0; });
          var t = lessonTitle[lid];
          sections.push({ label: lid, sub: t || '', items: items });
        });
    } else {
      var byRow = {};
      learned.forEach(function (e) { (byRow[e._row.row] = byRow[e._row.row] || []).push(e); });
      var order = (kc && kc.ROW_ORDER) || [];
      order.forEach(function (r) {
        var items = byRow[r.row];
        if (!items || !items.length) return;
        items.sort(function (a, b) { return a._kanaKey < b._kanaKey ? -1 : a._kanaKey > b._kanaKey ? 1 : 0; });
        sections.push({ label: r.row, sub: r.label, items: items, anchor: r.row });
      });
    }
    return sections;
  }

  function renderIndex() {
    container.innerHTML =
      '<div class="jp-gl-root">' +
        topBar(true) +
        '<div class="jp-gl-toggle">' +
          '<button class="jp-gl-seg' + (sortMode === 'kana' ? ' on' : '') + '" data-sort="kana">あ Kana</button>' +
          '<button class="jp-gl-seg' + (sortMode === 'lesson' ? ' on' : '') + '" data-sort="lesson">📖 By Lesson</button>' +
        '</div>' +
        '<div class="jp-gl-search">' +
          '<input id="jp-gl-q" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" ' +
            'placeholder="Search word, reading, rōmaji, or meaning…" value="' + esc(searchQuery) + '">' +
          '<button class="jp-gl-q-clear" id="jp-gl-q-clear" aria-label="Clear search">✕</button>' +
        '</div>' +
        '<div class="jp-gl-index">' +
          '<div class="jp-gl-rail" id="jp-gl-rail"></div>' +
          '<div class="jp-gl-list" id="jp-gl-list"></div>' +
        '</div>' +
      '</div>';

    bindTopBar();
    refreshTabBar();

    // Sort toggle (full re-render; searchQuery persists via module state)
    Array.prototype.forEach.call(container.querySelectorAll('.jp-gl-seg'), function (b) {
      b.addEventListener('click', function () {
        var next = b.getAttribute('data-sort');
        if (next === sortMode) return;
        sortMode = next;
        try { localStorage.setItem(SORT_KEY, sortMode); } catch (e) {}
        renderIndex();
      });
    });

    // Search — update list only so input keeps focus while typing.
    var q = document.getElementById('jp-gl-q');
    var clear = document.getElementById('jp-gl-q-clear');
    if (q) q.addEventListener('input', function () { searchQuery = q.value; renderListBody(); });
    if (clear) clear.addEventListener('click', function () { searchQuery = ''; if (q) { q.value = ''; q.focus(); } renderListBody(); });

    // Term taps (delegated; survives list innerHTML swaps)
    var list = document.getElementById('jp-gl-list');
    if (list) {
      list.addEventListener('click', function (ev) {
        var t = ev.target.closest && ev.target.closest('.jp-gl-term');
        if (t && t.getAttribute('data-id')) openTerm(t.getAttribute('data-id'));
      });
    }

    renderListBody();
  }

  // Renders the scrollable body: a flat result list when searching, otherwise
  // the sectioned (lazy) index for the current sort.
  function renderListBody() {
    var list = document.getElementById('jp-gl-list');
    var rail = document.getElementById('jp-gl-rail');
    var clear = document.getElementById('jp-gl-q-clear');
    if (!list) return;
    var qy = (searchQuery || '').trim().toLowerCase();
    if (clear) clear.style.display = qy ? 'flex' : 'none';

    if (qy) {
      if (rail) { rail.style.display = 'none'; rail.innerHTML = ''; }
      var matches = learned
        .filter(function (e) { return e._hay && e._hay.indexOf(qy) >= 0; })
        .sort(function (a, b) { return a._kanaKey < b._kanaKey ? -1 : a._kanaKey > b._kanaKey ? 1 : 0; });
      list.innerHTML = matches.length
        ? '<div class="jp-gl-results-head">' + matches.length + ' result' + (matches.length === 1 ? '' : 's') + '</div>' +
            matches.map(rowHtml).join('')
        : '<div class="jp-gl-empty">No matches for “' + esc(searchQuery.trim()) + '”</div>';
      return;
    }

    var sections = buildSections();
    if (rail) {
      if (sortMode === 'kana' && sections.length) {
        rail.style.display = '';
        rail.innerHTML = sections.map(function (s) {
          return '<button class="jp-gl-rail-btn" data-anchor="' + esc(s.anchor) + '">' + esc(s.label) + '</button>';
        }).join('');
        Array.prototype.forEach.call(rail.querySelectorAll('.jp-gl-rail-btn'), function (b) {
          b.addEventListener('click', function () {
            var el = document.getElementById('jp-gl-sec-' + b.getAttribute('data-anchor'));
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        });
      } else { rail.style.display = 'none'; rail.innerHTML = ''; }
    }

    list.innerHTML = sections.length
      ? sections.map(function (s, i) {
          return '<section class="jp-gl-sec" data-sec="' + i + '" id="jp-gl-sec-' + esc(s.anchor || s.label) + '">' +
            '<div class="jp-gl-sec-head"><span class="jp-gl-sec-label">' + esc(s.label) + '</span>' +
              (s.sub ? '<span class="jp-gl-sec-sub">' + esc(s.sub) + '</span>' : '') +
              '<span class="jp-gl-sec-count">' + s.items.length + '</span></div>' +
            '<div class="jp-gl-sec-body" data-body="' + i + '"></div>' +
          '</section>';
        }).join('')
      : '<div class="jp-gl-empty">No words learned yet.</div>';

    fillSectionsLazily(sections);
  }

  function refreshTabBar() {
    if (window.JPApp && typeof window.JPApp.renderTabBar === 'function') {
      try { window.JPApp.renderTabBar(); } catch (e) {}
    }
  }

  function fillSectionsLazily(sections) {
    var bodies = container.querySelectorAll('.jp-gl-sec-body');
    var fill = function (el) {
      var i = parseInt(el.getAttribute('data-body'), 10);
      if (el._filled || !sections[i]) return;
      el._filled = true;
      el.innerHTML = sections[i].items.map(rowHtml).join('');
    };
    if (typeof IntersectionObserver === 'function') {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { fill(en.target); io.unobserve(en.target); } });
      }, { root: null, rootMargin: '400px 0px' });
      Array.prototype.forEach.call(bodies, function (el) { io.observe(el); });
    } else {
      Array.prototype.forEach.call(bodies, fill);
    }
  }

  function rowHtml(e) {
    return '<button class="jp-gl-term" data-id="' + esc(e.id) + '">' +
      '<span class="jp-gl-term-jp">' + renderJp(e) + '</span>' +
      '<span class="jp-gl-term-en">' + esc(e.meaning || '') + '</span>' +
    '</button>';
  }

  function renderJp(e) {
    var jt = window.JPShared && window.JPShared.jpText;
    if (jt) {
      if (e.tokens && e.tokens.length) return jt.render({ tokens: e.tokens });
      return jt.render({ surface: e.surface, reading: e.reading });
    }
    return esc(e.surface || '');
  }

  // ── Sticky-note term popup ──────────────────────────────────────────────────
  function openTerm(id) {
    var e = byId[id];
    if (!e) return;
    closeNote();

    // Tell Ask-Rikizo exactly which glossary term is open (no fixed lesson page).
    try {
      var tc = window.JPShared && window.JPShared.tutorContext;
      if (tc) tc.patch({ view: 'glossary', lessonId: e._lessonId || null, page: null, item: e.surface || null });
    } catch (err) {}

    var badge = TYPE_BADGE[e.type] || null;
    var lid = e._lessonId || firstValidLesson(e);
    var gotoLabel = '', gotoMode = null, gotoId = lid;
    if (lid && /^G\d+$/.test(lid)) { gotoMode = 'grammar'; gotoLabel = 'Go to grammar ' + lid; }
    else if (lid && /Review/i.test(lid)) { gotoMode = null; gotoLabel = 'Taught in ' + lid; }
    else if (lid) { gotoMode = 'lesson'; gotoLabel = 'Go to lesson ' + lid + (lessonTitle[lid] ? ' · ' + lessonTitle[lid] : ''); }

    var ex = e.example && (e.example.jp || e.example.en) ? e.example : null;

    var overlay = document.createElement('div');
    overlay.className = 'jp-gl-note-overlay';
    overlay.innerHTML =
      '<div class="jp-gl-note" role="dialog" aria-modal="true">' +
        '<div class="jp-gl-note-tape"></div>' +
        '<button class="jp-gl-note-close" aria-label="Close">✕</button>' +
        '<div class="jp-gl-note-head">' +
          '<span class="jp-gl-note-surface">' + renderJp(e) + '</span>' +
          (badge ? '<span class="jp-gl-note-badge b-' + badge.cls + '">' + badge.label + '</span>' : '') +
        '</div>' +
        (e.reading ? '<div class="jp-gl-note-reading">' + esc(e.reading) + '</div>' : '') +
        '<div class="jp-gl-note-meaning">' + esc(e.meaning || '') + '</div>' +
        (e.notes ? '<div class="jp-gl-note-notes">' + esc(e.notes) + '</div>' : '') +
        (ex ? '<div class="jp-gl-note-ex">' +
                (ex.jp ? '<div class="jp-gl-note-ex-jp">' + renderJp({ tokens: ex.tokens, surface: ex.jp }) + '</div>' : '') +
                (ex.en ? '<div class="jp-gl-note-ex-en">' + esc(ex.en) + '</div>' : '') +
              '</div>' : '') +
        '<div class="jp-gl-note-foot">' +
          (gotoMode
            ? '<button class="jp-gl-note-goto" data-mode="' + gotoMode + '" data-id="' + esc(gotoId) + '">' + esc(gotoLabel) + ' →</button>'
            : (gotoLabel ? '<span class="jp-gl-note-tag">' + esc(gotoLabel) + '</span>' : '')) +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('show'); });

    overlay.addEventListener('click', function (ev) { if (ev.target === overlay) closeNote(); });
    overlay.querySelector('.jp-gl-note-close').addEventListener('click', closeNote);
    var go = overlay.querySelector('.jp-gl-note-goto');
    if (go) go.addEventListener('click', function () {
      var mode = go.getAttribute('data-mode');
      var targetId = go.getAttribute('data-id');
      closeNote();
      if (window.JPApp && window.JPApp.launch) window.JPApp.launch(mode, targetId);
    });
  }

  function closeNote() {
    var o = document.querySelector('.jp-gl-note-overlay');
    if (o && o.parentNode) o.parentNode.removeChild(o);
  }

  // ── Top bar ─────────────────────────────────────────────────────────────────
  function topBar(inIndex) {
    return '<div class="jp-gl-topbar">' +
      '<button class="jp-gl-back" id="jp-gl-back">← ' + (inIndex ? 'Cover' : 'Home') + '</button>' +
      '<div class="jp-gl-topbar-title">Dictionary</div>' +
      '<div class="jp-gl-topbar-spacer"></div>' +
    '</div>';
  }

  function bindTopBar() {
    var back = document.getElementById('jp-gl-back');
    if (!back) return;
    back.addEventListener('click', function () {
      // From the index, "Cover" returns to the closed book; from the cover, Home.
      if (back.textContent.indexOf('Cover') >= 0) renderBook();
      else if (typeof onExit === 'function') onExit();
    });
  }

  // ── Utils ────────────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── Styles ───────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('jp-glossary-styles')) return;
    var st = document.createElement('style');
    st.id = 'jp-glossary-styles';
    st.textContent = [
      '.jp-gl-root{max-width:560px;margin:0 auto;padding:0 0 40px;font-family:var(--font-ui);color:var(--ink);}',
      '.jp-gl-loading,.jp-gl-error{padding:60px 24px;text-align:center;color:var(--ink-3);}',
      '.jp-gl-error{color:var(--vermilion);}',
      '.jp-gl-spinner{width:26px;height:26px;border:3px solid var(--hairline);border-top-color:var(--indigo);border-radius:50%;margin:0 auto 14px;animation:jpGlSpin .8s linear infinite;}',
      '@keyframes jpGlSpin{to{transform:rotate(360deg);}}',
      // top bar
      '.jp-gl-topbar{display:flex;align-items:center;gap:10px;padding:14px 16px;position:sticky;top:0;background:var(--washi);z-index:5;border-bottom:1px solid var(--hairline);}',
      '.jp-gl-back{border:1px solid var(--hairline);background:var(--washi);color:var(--ink-2);font-size:13px;padding:7px 13px;border-radius:999px;cursor:pointer;}',
      '.jp-gl-topbar-title{font-weight:600;font-size:15px;}',
      '.jp-gl-topbar-spacer{flex:1;}',
      // closed book
      '.jp-gl-shelf{padding:46px 16px 24px;text-align:center;}',
      '.jp-gl-stage{perspective:1100px;display:flex;justify-content:center;padding:10px 0 6px;}',
      '.jp-gl-book{position:relative;width:218px;height:300px;transform:rotateY(-22deg);transform-style:preserve-3d;transition:transform .5s ease;cursor:pointer;}',
      '.jp-gl-book:hover{transform:rotateY(-16deg);}',
      '.jp-gl-book .jp-gl-cover{position:absolute;inset:0;border-radius:5px 9px 9px 5px;background:linear-gradient(135deg,var(--indigo),oklch(0.36 0.10 260));box-shadow:0 20px 40px -12px rgba(0,0,0,.45);transform-origin:left center;transition:transform .55s cubic-bezier(.4,.1,.2,1);overflow:hidden;backface-visibility:hidden;}',
      '.jp-gl-cover-spine{position:absolute;left:0;top:0;bottom:0;width:12px;background:rgba(0,0,0,.22);box-shadow:inset -2px 0 4px rgba(0,0,0,.25);}',
      '.jp-gl-cover-inner{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:rgba(255,255,255,.95);padding:24px;border:1px solid rgba(255,255,255,.12);margin:10px 10px 10px 18px;border-radius:4px;}',
      '.jp-gl-cover-kanji{font-family:var(--font-jp-display);font-size:62px;line-height:1;letter-spacing:4px;}',
      '.jp-gl-cover-title{font-size:17px;font-weight:600;letter-spacing:.01em;}',
      '.jp-gl-cover-sub{font-size:11px;opacity:.75;}',
      // page block = the "fat" right edge; width scales with progress (--thick)
      '.jp-gl-pages{position:absolute;top:5px;bottom:5px;right:0;width:var(--thick,16px);transform:translateX(calc(var(--thick,16px) * 0.5)) rotateY(90deg);transform-origin:right center;background:repeating-linear-gradient(to right,#f4efe2 0,#f4efe2 1px,#e6dfca 1px,#e6dfca 3px);border-radius:0 2px 2px 0;box-shadow:inset 0 0 6px rgba(0,0,0,.12);}',
      '.jp-gl-book.jp-opening .jp-gl-cover{transform:rotateY(-152deg);}',
      '.jp-gl-caption{margin-top:30px;color:var(--ink-2);font-size:14px;}',
      '.jp-gl-caption strong{font-size:22px;color:var(--ink);font-weight:700;}',
      '.jp-gl-caption-hint{display:block;margin-top:6px;font-size:11.5px;color:var(--ink-3);letter-spacing:.02em;}',
      // toggle
      '.jp-gl-toggle{display:flex;gap:6px;margin:14px 16px 6px;background:var(--washi-2);padding:4px;border-radius:999px;border:1px solid var(--hairline);}',
      '.jp-gl-seg{flex:1;border:none;background:transparent;color:var(--ink-3);font-size:13px;font-weight:600;padding:8px 10px;border-radius:999px;cursor:pointer;}',
      '.jp-gl-seg.on{background:var(--washi);color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.12);}',
      // search
      '.jp-gl-search{position:relative;margin:8px 16px 2px;}',
      '.jp-gl-search input{width:100%;box-sizing:border-box;border:1px solid var(--hairline);background:var(--washi-2);border-radius:10px;padding:10px 34px 10px 14px;font-size:14px;color:var(--ink);font-family:var(--font-ui);-webkit-appearance:none;}',
      '.jp-gl-search input:focus{outline:none;border-color:var(--indigo);background:var(--washi);}',
      '.jp-gl-search input::-webkit-search-decoration,.jp-gl-search input::-webkit-search-cancel-button{-webkit-appearance:none;}',
      '.jp-gl-q-clear{display:none;position:absolute;right:8px;top:50%;transform:translateY(-50%);width:22px;height:22px;align-items:center;justify-content:center;border:none;background:var(--hairline);color:var(--ink-2);border-radius:50%;font-size:11px;cursor:pointer;}',
      '.jp-gl-results-head{padding:10px 12px 6px;font-size:11px;color:var(--ink-3);font-family:var(--font-mono,monospace);letter-spacing:.04em;text-transform:uppercase;}',
      // index
      '.jp-gl-index{display:flex;gap:6px;align-items:flex-start;padding:4px 8px 0 0;}',
      '.jp-gl-rail{position:sticky;top:60px;display:flex;flex-direction:column;gap:1px;padding:4px 2px;flex:0 0 auto;}',
      '.jp-gl-rail-btn{border:none;background:transparent;color:var(--indigo);font-size:11px;font-weight:600;padding:2px 5px;cursor:pointer;border-radius:5px;line-height:1.2;}',
      '.jp-gl-rail-btn:active{background:var(--washi-2);}',
      '.jp-gl-list{flex:1;min-width:0;padding-left:8px;}',
      '.jp-gl-sec{margin-bottom:8px;}',
      '.jp-gl-sec-head{display:flex;align-items:baseline;gap:8px;padding:10px 12px 6px;position:sticky;top:48px;background:var(--washi);z-index:2;}',
      '.jp-gl-sec-label{font-family:var(--font-jp-display);font-size:18px;font-weight:600;color:var(--indigo);}',
      '.jp-gl-sec-sub{font-size:11px;color:var(--ink-3);}',
      '.jp-gl-sec-count{margin-left:auto;font-size:10px;color:var(--ink-3);font-family:var(--font-mono,monospace);}',
      '.jp-gl-sec-body{min-height:8px;}',
      '.jp-gl-term{display:flex;align-items:baseline;gap:12px;width:100%;text-align:left;border:none;border-bottom:1px solid var(--hairline);background:transparent;padding:11px 12px;cursor:pointer;}',
      '.jp-gl-term:active{background:var(--washi-2);}',
      '.jp-gl-term-jp{font-size:18px;color:var(--ink);flex:0 0 auto;min-width:84px;}',
      '.jp-gl-term-en{font-size:13px;color:var(--ink-2);flex:1;min-width:0;}',
      '.jp-gl-empty{padding:40px 20px;text-align:center;color:var(--ink-3);}',
      // sticky note
      '.jp-gl-note-overlay{position:fixed;inset:0;background:rgba(20,16,10,.42);backdrop-filter:blur(3px);z-index:999999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .18s ease;padding:24px;}',
      '.jp-gl-note-overlay.show{opacity:1;}',
      '.jp-gl-note{position:relative;background:linear-gradient(170deg,#fffdf3,#fff7df);width:100%;max-width:360px;border-radius:4px;padding:26px 24px 22px;box-shadow:0 18px 44px rgba(0,0,0,.32);transform:rotate(-1.4deg);border:1px solid rgba(0,0,0,.05);}',
      '.jp-gl-note-tape{position:absolute;top:-12px;left:50%;width:96px;height:24px;transform:translateX(-50%) rotate(-2deg);background:rgba(212,180,120,.45);box-shadow:0 1px 3px rgba(0,0,0,.12);}',
      '.jp-gl-note-close{position:absolute;top:8px;right:10px;border:none;background:transparent;font-size:18px;color:var(--ink-3);cursor:pointer;line-height:1;}',
      '.jp-gl-note-head{display:flex;align-items:center;gap:10px;margin-bottom:4px;}',
      '.jp-gl-note-surface{font-size:30px;color:var(--ink);}',
      '.jp-gl-note-badge{font-size:11px;font-weight:700;color:#fff;padding:2px 8px;border-radius:999px;background:var(--ink-3);}',
      '.jp-gl-note-badge.b-k{background:var(--vermilion);}.jp-gl-note-badge.b-v{background:var(--indigo);}.jp-gl-note-badge.b-g{background:var(--moss);}.jp-gl-note-badge.b-p{background:var(--gold);}.jp-gl-note-badge.b-pt{background:#8a6d3b;}',
      '.jp-gl-note-reading{font-size:13px;color:var(--ink-3);margin-bottom:8px;}',
      '.jp-gl-note-meaning{font-size:16px;font-weight:600;color:var(--ink);margin-bottom:8px;}',
      '.jp-gl-note-notes{font-size:13px;line-height:1.55;color:var(--ink-2);white-space:pre-wrap;border-top:1px dashed rgba(0,0,0,.12);padding-top:10px;margin-top:4px;}',
      '.jp-gl-note-ex{margin-top:12px;padding-top:10px;border-top:1px dashed rgba(0,0,0,.12);}',
      '.jp-gl-note-ex-jp{font-size:15px;color:var(--ink);margin-bottom:3px;}',
      '.jp-gl-note-ex-en{font-size:12px;color:var(--ink-3);}',
      '.jp-gl-note-foot{margin-top:16px;}',
      '.jp-gl-note-goto{width:100%;border:none;background:var(--indigo);color:#fff;font-size:13.5px;font-weight:600;padding:11px;border-radius:10px;cursor:pointer;}',
      '.jp-gl-note-goto:active{filter:brightness(.92);}',
      '.jp-gl-note-tag{display:block;text-align:center;font-size:12px;color:var(--ink-3);}'
    ].join('\n');
    document.head.appendChild(st);
  }

  return { start: start };
})();

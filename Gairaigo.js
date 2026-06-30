/**
 * Gairaigo.js — 外来語 the dedicated loan-word glossary.
 *
 * A standalone reference for every gairaigo in shared/loanwords.json (the
 * always-available katakana pool — not lesson-gated). Browse four ways:
 *   • 🌍 Origin — a flag landing grid (English, French, Greek…) → drill into a
 *                 nation's words. Country/language aliases are normalised into
 *                 one canonical source group (see ORIGIN_GROUP below).
 *   • 🏷 Theme  — chips (food, tech, sports…) → that theme's words.
 *   • ⭐ Tier   — Common vs Extended.
 *   • あ Kana   — flat gojūon list of all loan-words.
 * Tapping a word raises a sticky-note popup (reading, source + flag, meaning,
 * theme tags, a 和製 wasei badge for Japanese-made pseudo-loans, notes).
 *
 * Public API (matches the launch contract in index.html):
 *   window.GairaigoModule.start(container, config, onExit)
 *
 * Reuses JPShared helpers only (no new runtime deps beyond kana-collate):
 *   - JPShared.kanaCollate : gojūon key / rowOf / ROW_ORDER
 *   - JPShared.jpText.render({tokens}) : furigana / romaji renderer
 *   - window.getManifest / window.getAssetUrl : data loading (shared/asset-url.js)
 */

window.GairaigoModule = (function () {
  'use strict';

  // ── Origin normalisation ─────────────────────────────────────────────────
  // Raw `origin` strings in loanwords.json mix languages and country names
  // (e.g. "American English" + "United States", "French" + "France"). Collapse
  // them into one canonical SOURCE group for the grid/grouping. Editable — the
  // curriculum owner can re-map freely; the popup always shows the raw origin.
  var ORIGIN_GROUP = {
    'American English': 'english', 'British English': 'english',
    'United States': 'english', 'United Kingdom': 'english',
    'Canada': 'english', 'Australia': 'english',
    'French': 'french', 'France': 'french',
    'German': 'german', 'Germany': 'german',
    'Greek': 'greek', 'Greece': 'greek',
    'Italian': 'italian', 'Italy': 'italian',
    'Spanish': 'spanish', 'Spain': 'spanish', 'Mexico': 'spanish',
    'Portuguese': 'portuguese', 'Brazil': 'portuguese',
    'Dutch': 'dutch', 'Netherlands': 'dutch',
    'Russian': 'russian', 'Russia': 'russian',
    'Latin': 'latin',
    'Norwegian': 'norse',
    'Arabic': 'arabic', 'Egypt': 'arabic',
    'Sanskrit': 'sanskrit', 'India': 'sanskrit',
    'Chinese': 'chinese',
    'Korean': 'korean',
    'Turkey': 'turkish',
    'Switzerland': 'swiss'
  };
  var GROUP_META = {
    english:    { name: 'English',    flag: '🇺🇸' },
    french:     { name: 'French',     flag: '🇫🇷' },
    german:     { name: 'German',     flag: '🇩🇪' },
    greek:      { name: 'Greek',      flag: '🇬🇷' },
    italian:    { name: 'Italian',    flag: '🇮🇹' },
    spanish:    { name: 'Spanish',    flag: '🇪🇸' },
    portuguese: { name: 'Portuguese', flag: '🇵🇹' },
    dutch:      { name: 'Dutch',      flag: '🇳🇱' },
    russian:    { name: 'Russian',    flag: '🇷🇺' },
    latin:      { name: 'Latin',      flag: '🏛️' },
    norse:      { name: 'Norse / Norwegian', flag: '🇳🇴' },
    arabic:     { name: 'Arabic',     flag: '🇸🇦' },
    sanskrit:   { name: 'Sanskrit',   flag: '🕉️' },
    chinese:    { name: 'Chinese',    flag: '🇨🇳' },
    korean:     { name: 'Korean',     flag: '🇰🇷' },
    turkish:    { name: 'Turkish',    flag: '🇹🇷' },
    swiss:      { name: 'Swiss',      flag: '🇨🇭' },
    other:      { name: 'Other',      flag: '🏳️' }
  };
  function groupOf(rawOrigin) { return (rawOrigin && ORIGIN_GROUP[rawOrigin]) || 'other'; }

  // Theme display labels (pretty-print the kebab keys; unknown → titleised).
  var THEME_LABEL = {
    'slice-of-life': 'Slice of Life', 'sci-fi': 'Sci-Fi', 'period-piece': 'Period Piece'
  };
  function themeLabel(t) {
    if (THEME_LABEL[t]) return THEME_LABEL[t];
    return t.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  // ── State ──────────────────────────────────────────────────────────────────
  var container = null, config = null, onExit = null;
  var words = [];                 // all loan-words, decorated
  var rawOrigins = {};            // raw origin → { displayName, flag } (from file)
  var groups = [];                // [{ key, name, flag, items[] }] sorted by count
  var themes = [];                // [{ key, label, count }] sorted by count
  var mode = 'origin';            // 'origin' | 'theme' | 'tier' | 'kana'
  var selOrigin = null;           // selected group key (origin mode drill-down)
  var selTheme = null;            // selected theme key (theme mode)
  var searchQuery = '';
  var MODE_KEY = 'k-gairaigo-mode';

  // ── Boot ─────────────────────────────────────────────────────────────────
  function getUrl(p) { return window.getAssetUrl ? window.getAssetUrl(config, p) : p; }

  function start(containerEl, repoConfig, exitCallback) {
    container = containerEl;
    config = repoConfig;
    onExit = exitCallback;
    try { var m = localStorage.getItem(MODE_KEY); if (['origin', 'theme', 'tier', 'kana'].indexOf(m) >= 0) mode = m; } catch (e) {}
    selOrigin = null; selTheme = null; searchQuery = '';
    injectStyles();
    initialize();
  }

  async function initialize() {
    container.innerHTML =
      '<div class="jp-ga-root"><div class="jp-ga-loading"><div class="jp-ga-spinner"></div>Opening 外来語…</div></div>';
    try {
      var manifest = await window.getManifest(config);
      await loadData(manifest);
      buildIndex();
      render();
    } catch (err) {
      console.error('[Gairaigo] init error:', err);
      container.innerHTML =
        '<div class="jp-ga-root"><div class="jp-ga-error"><strong>Couldn’t open 外来語</strong><br>' +
        esc((err && err.message) || String(err)) + '</div></div>';
    }
  }

  async function loadData(manifest) {
    var bust = '?t=' + Date.now();
    var lwPath = (manifest && manifest.shared && manifest.shared.loanwords) || 'shared/loanwords.json';
    var orPath = (manifest && manifest.shared && manifest.shared.loanwordOrigins) || 'shared/loanword-origins.json';
    var res = await Promise.all([
      fetch(getUrl(lwPath) + bust).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      fetch(getUrl(orPath) + bust).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
    ]);
    rawOrigins = (res[1] && res[1].origins) || {};
    var kc = window.JPShared && window.JPShared.kanaCollate;
    var jt = window.JPShared && window.JPShared.jpText;
    words = [];
    var list = (res[0] && Array.isArray(res[0].loanwords)) ? res[0].loanwords : [];
    list.forEach(function (w) {
      if (!w || !w.id) return;
      var reading = w.reading || w.surface || '';
      w._group = groupOf(w.origin);
      w._kanaKey = kc ? kc.key(reading) : reading;
      w._row = kc ? kc.rowOf(reading) : { row: '他', label: 'その他' };
      var romaji = (jt && jt.kanaToRomaji) ? jt.kanaToRomaji(reading) : '';
      w._hay = ((w.surface || '') + reading + romaji + (w.meaning || '')).toLowerCase();
      words.push(w);
    });
  }

  function buildIndex() {
    // Origin groups
    var byGroup = {};
    words.forEach(function (w) { (byGroup[w._group] = byGroup[w._group] || []).push(w); });
    groups = Object.keys(byGroup).map(function (k) {
      var meta = GROUP_META[k] || GROUP_META.other;
      return { key: k, name: meta.name, flag: meta.flag, items: byGroup[k].sort(kanaSort) };
    }).sort(function (a, b) { return b.items.length - a.items.length || (a.name < b.name ? -1 : 1); });

    // Themes
    var byTheme = {};
    words.forEach(function (w) { (w.themes || []).forEach(function (t) { byTheme[t] = (byTheme[t] || 0) + 1; }); });
    themes = Object.keys(byTheme).map(function (t) { return { key: t, label: themeLabel(t), count: byTheme[t] }; })
      .sort(function (a, b) { return b.count - a.count || (a.label < b.label ? -1 : 1); });
  }

  function kanaSort(a, b) { return a._kanaKey < b._kanaKey ? -1 : a._kanaKey > b._kanaKey ? 1 : 0; }

  // ── Render ──────────────────────────────────────────────────────────────────
  function render() {
    container.innerHTML =
      '<div class="jp-ga-root">' +
        topBar() +
        '<div class="jp-ga-modes">' +
          seg('origin', '🌍 Origin') + seg('theme', '🏷 Theme') +
          seg('tier', '⭐ Tier') + seg('kana', 'あ Kana') +
        '</div>' +
        '<div class="jp-ga-search">' +
          '<input id="jp-ga-q" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" ' +
            'placeholder="Search word, reading, rōmaji, or meaning…" value="' + esc(searchQuery) + '">' +
          '<button class="jp-ga-q-clear" id="jp-ga-q-clear" aria-label="Clear search">✕</button>' +
        '</div>' +
        '<div class="jp-ga-body" id="jp-ga-body"></div>' +
      '</div>';
    bindChrome();
    renderBody();
    refreshTabBar();
  }

  function seg(m, label) {
    return '<button class="jp-ga-seg' + (mode === m ? ' on' : '') + '" data-mode="' + m + '">' + label + '</button>';
  }

  function topBar() {
    var title = (mode === 'origin' && selOrigin)
      ? ((GROUP_META[selOrigin] || GROUP_META.other).flag + ' ' + (GROUP_META[selOrigin] || GROUP_META.other).name)
      : '外来語 Gairaigo';
    var back = (mode === 'origin' && selOrigin) ? '‹ Origins' : '← Dictionary';
    return '<div class="jp-ga-topbar">' +
      '<button class="jp-ga-back" id="jp-ga-back">' + esc(back) + '</button>' +
      '<div class="jp-ga-topbar-title">' + esc(title) + '</div>' +
      '<div class="jp-ga-count">' + words.length + ' 語</div>' +
    '</div>';
  }

  function renderBody() {
    var body = document.getElementById('jp-ga-body');
    if (!body) return;
    var q = searchQuery.trim().toLowerCase();

    // A live search collapses every mode into one flat kana-sorted hit list.
    if (q) {
      var hits = words.filter(function (w) { return w._hay.indexOf(q) >= 0; }).sort(kanaSort);
      body.innerHTML = '<div class="jp-ga-searchhdr">' + hits.length + ' result' + (hits.length === 1 ? '' : 's') + '</div>' +
        (hits.length ? listHtml(hits) : '<div class="jp-ga-empty">No loan-words match “' + esc(searchQuery) + '”.</div>');
      wireRows(body);
      return;
    }

    if (mode === 'origin') return renderOrigin(body);
    if (mode === 'theme') return renderTheme(body);
    if (mode === 'tier') return renderTier(body);
    return renderKana(body);
  }

  function renderOrigin(body) {
    if (!selOrigin) {
      // Flag landing grid
      body.innerHTML = '<div class="jp-ga-grid">' + groups.map(function (g) {
        return '<button class="jp-ga-flag" data-origin="' + esc(g.key) + '">' +
          '<span class="jp-ga-flag-emoji">' + g.flag + '</span>' +
          '<span class="jp-ga-flag-name">' + esc(g.name) + '</span>' +
          '<span class="jp-ga-flag-count">' + g.items.length + '</span>' +
        '</button>';
      }).join('') + '</div>';
      Array.prototype.forEach.call(body.querySelectorAll('.jp-ga-flag'), function (b) {
        b.addEventListener('click', function () {
          selOrigin = b.getAttribute('data-origin');
          render();
        });
      });
      return;
    }
    var g = groups.filter(function (x) { return x.key === selOrigin; })[0];
    body.innerHTML = g && g.items.length ? listHtml(g.items) : '<div class="jp-ga-empty">No words.</div>';
    wireRows(body);
  }

  function renderTheme(body) {
    var chips = '<div class="jp-ga-chips">' +
      '<button class="jp-ga-chip' + (!selTheme ? ' on' : '') + '" data-theme="">All</button>' +
      themes.map(function (t) {
        return '<button class="jp-ga-chip' + (selTheme === t.key ? ' on' : '') + '" data-theme="' + esc(t.key) + '">' +
          esc(t.label) + ' <span class="jp-ga-chip-n">' + t.count + '</span></button>';
      }).join('') + '</div>';
    var items;
    if (selTheme) items = words.filter(function (w) { return (w.themes || []).indexOf(selTheme) >= 0; }).sort(kanaSort);
    else items = words.slice().sort(kanaSort);
    body.innerHTML = chips + listHtml(items);
    Array.prototype.forEach.call(body.querySelectorAll('.jp-ga-chip'), function (b) {
      b.addEventListener('click', function () {
        selTheme = b.getAttribute('data-theme') || null;
        renderBody();
      });
    });
    wireRows(body);
  }

  function renderTier(body) {
    var common = words.filter(function (w) { return w.tier === 'common'; }).sort(kanaSort);
    var ext = words.filter(function (w) { return w.tier !== 'common'; }).sort(kanaSort);
    body.innerHTML =
      sectionHtml('⭐ Common', 'Everyday loan-words', common) +
      sectionHtml('◦ Extended', 'Wider / specialised vocabulary', ext);
    wireRows(body);
  }

  function renderKana(body) {
    var kc = window.JPShared.kanaCollate;
    var byRow = {};
    words.forEach(function (w) { (byRow[w._row.row] = byRow[w._row.row] || []).push(w); });
    var order = (kc && kc.ROW_ORDER) || [];
    var html = '';
    order.forEach(function (r) {
      var items = byRow[r.row];
      if (!items || !items.length) return;
      html += sectionHtml(r.row, r.label, items.sort(kanaSort));
    });
    body.innerHTML = html || '<div class="jp-ga-empty">No loan-words.</div>';
    wireRows(body);
  }

  function sectionHtml(label, sub, items) {
    return '<section class="jp-ga-sec">' +
      '<div class="jp-ga-sec-head"><span class="jp-ga-sec-label">' + esc(label) + '</span>' +
        (sub ? '<span class="jp-ga-sec-sub">' + esc(sub) + '</span>' : '') +
        '<span class="jp-ga-sec-count">' + items.length + '</span></div>' +
      listHtml(items) +
    '</section>';
  }

  function listHtml(items) {
    return '<div class="jp-ga-list">' + items.map(rowHtml).join('') + '</div>';
  }

  function rowHtml(w) {
    var meta = GROUP_META[w._group] || GROUP_META.other;
    return '<button class="jp-ga-term" data-id="' + esc(w.id) + '">' +
      '<span class="jp-ga-term-jp">' + renderJp(w) + '</span>' +
      '<span class="jp-ga-term-en">' + esc(w.meaning || '') + '</span>' +
      '<span class="jp-ga-term-flag" title="' + esc(meta.name) + '">' + meta.flag + '</span>' +
    '</button>';
  }

  function renderJp(w) {
    var jt = window.JPShared && window.JPShared.jpText;
    if (jt) {
      if (w.tokens && w.tokens.length) return jt.render({ tokens: w.tokens });
      return jt.render({ surface: w.surface, reading: w.reading });
    }
    return esc(w.surface || '');
  }

  function wireRows(scope) {
    Array.prototype.forEach.call(scope.querySelectorAll('.jp-ga-term'), function (b) {
      b.addEventListener('click', function () { openTerm(b.getAttribute('data-id')); });
    });
  }

  // ── Sticky-note popup ────────────────────────────────────────────────────────
  function openTerm(id) {
    var w = words.filter(function (x) { return x.id === id; })[0];
    if (!w) return;
    closeNote();
    var meta = GROUP_META[w._group] || GROUP_META.other;
    var rawName = (w.origin && rawOrigins[w.origin] && rawOrigins[w.origin].displayName) || w.origin || meta.name;
    var rawFlag = (w.origin && rawOrigins[w.origin] && rawOrigins[w.origin].flag) || meta.flag;
    var themeChips = (w.themes || []).map(function (t) { return '<span class="jp-ga-note-theme">' + esc(themeLabel(t)) + '</span>'; }).join('');

    var overlay = document.createElement('div');
    overlay.className = 'jp-ga-note-overlay';
    overlay.innerHTML =
      '<div class="jp-ga-note" role="dialog" aria-modal="true">' +
        '<div class="jp-ga-note-tape"></div>' +
        '<button class="jp-ga-note-close" aria-label="Close">✕</button>' +
        '<div class="jp-ga-note-head">' +
          '<span class="jp-ga-note-surface">' + renderJp(w) + '</span>' +
          (w.wasei ? '<span class="jp-ga-note-wasei" title="Japanese-made pseudo-loanword">和製</span>' : '') +
        '</div>' +
        (w.reading ? '<div class="jp-ga-note-reading">' + esc(w.reading) + '</div>' : '') +
        '<div class="jp-ga-note-origin">' + esc(rawFlag) + ' from ' + esc(rawName) +
          (w.tier === 'common' ? ' · ⭐ common' : '') + '</div>' +
        '<div class="jp-ga-note-meaning">' + esc(w.meaning || '') + '</div>' +
        (w.notes ? '<div class="jp-ga-note-notes">' + esc(w.notes) + '</div>' : '') +
        (themeChips ? '<div class="jp-ga-note-themes">' + themeChips + '</div>' : '') +
      '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('show'); });
    overlay.addEventListener('click', function (ev) { if (ev.target === overlay) closeNote(); });
    overlay.querySelector('.jp-ga-note-close').addEventListener('click', closeNote);
  }

  function closeNote() {
    var o = document.querySelector('.jp-ga-note-overlay');
    if (o && o.parentNode) o.parentNode.removeChild(o);
  }

  // ── Chrome wiring ────────────────────────────────────────────────────────────
  function bindChrome() {
    var back = document.getElementById('jp-ga-back');
    if (back) back.addEventListener('click', function () {
      if (mode === 'origin' && selOrigin) { selOrigin = null; render(); return; }
      closeNote();
      // Return to the main Dictionary cover (this dictionary lives under it).
      if (window.JPApp && window.JPApp.launch) window.JPApp.launch('glossary');
      else if (typeof onExit === 'function') onExit();
    });
    Array.prototype.forEach.call(container.querySelectorAll('.jp-ga-seg'), function (b) {
      b.addEventListener('click', function () {
        var next = b.getAttribute('data-mode');
        if (next === mode) return;
        mode = next; selOrigin = null;
        try { localStorage.setItem(MODE_KEY, mode); } catch (e) {}
        render();
      });
    });
    var q = document.getElementById('jp-ga-q');
    var clr = document.getElementById('jp-ga-q-clear');
    if (q) {
      var sync = function () { searchQuery = q.value || ''; if (clr) clr.style.display = searchQuery ? 'block' : 'none'; renderBody(); };
      q.addEventListener('input', sync);
      if (clr) { clr.style.display = searchQuery ? 'block' : 'none'; clr.addEventListener('click', function () { q.value = ''; searchQuery = ''; clr.style.display = 'none'; renderBody(); q.focus(); }); }
    }
  }

  function refreshTabBar() {
    if (window.JPApp && typeof window.JPApp.renderTabBar === 'function') {
      try { window.JPApp.renderTabBar(); } catch (e) {}
    }
  }

  // ── Utils ──────────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('jp-ga-style')) return;
    var s = document.createElement('style');
    s.id = 'jp-ga-style';
    s.textContent = [
      '.jp-ga-root{font-family:"Poppins","Noto Sans JP",sans-serif;max-width:680px;margin:0 auto;padding:0 14px 96px;color:#2f3542;}',
      '.jp-ga-loading,.jp-ga-error{text-align:center;padding:48px 16px;color:#747d8c;}',
      '.jp-ga-spinner{width:28px;height:28px;border:3px solid #e6dff5;border-top-color:#8e44ad;border-radius:50%;margin:0 auto 12px;animation:jpgaSpin .8s linear infinite;}',
      '@keyframes jpgaSpin{to{transform:rotate(360deg);}}',
      // topbar
      '.jp-ga-topbar{display:flex;align-items:center;gap:8px;padding:12px 0 8px;position:sticky;top:0;background:linear-gradient(#fff 70%,rgba(255,255,255,0));z-index:5;}',
      '.jp-ga-back{border:none;background:#f0e6f6;color:#8e44ad;font-weight:700;font-size:0.9rem;padding:8px 14px;border-radius:20px;cursor:pointer;}',
      '.jp-ga-topbar-title{flex:1;text-align:center;font-weight:800;font-size:1.05rem;}',
      '.jp-ga-count{font-size:0.8rem;color:#a78bbf;font-weight:700;min-width:46px;text-align:right;}',
      // mode segmented
      '.jp-ga-modes{display:flex;gap:6px;margin:4px 0 10px;}',
      '.jp-ga-seg{flex:1;border:1.5px solid #e6dff5;background:#fff;color:#8e44ad;font-weight:700;font-size:0.82rem;padding:9px 4px;border-radius:12px;cursor:pointer;transition:.15s;white-space:nowrap;}',
      '.jp-ga-seg.on{background:linear-gradient(135deg,#8e44ad,#6c3483);color:#fff;border-color:transparent;}',
      // search
      '.jp-ga-search{position:relative;margin-bottom:12px;}',
      '.jp-ga-search input{width:100%;box-sizing:border-box;padding:11px 38px 11px 14px;border:1.5px solid #e0e0e0;border-radius:12px;font-size:1rem;outline:none;}',
      '.jp-ga-search input:focus{border-color:#8e44ad;}',
      '.jp-ga-q-clear{display:none;position:absolute;right:8px;top:50%;transform:translateY(-50%);border:none;background:#eee;color:#888;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:0.8rem;}',
      // flag grid
      '.jp-ga-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:10px;}',
      '.jp-ga-flag{display:flex;flex-direction:column;align-items:center;gap:3px;border:1.5px solid #eee;background:#fff;border-radius:16px;padding:16px 8px 12px;cursor:pointer;transition:.15s;}',
      '.jp-ga-flag:active{transform:scale(.96);}',
      '.jp-ga-flag:hover{border-color:#d8c4ea;box-shadow:0 6px 16px -8px rgba(142,68,173,.4);}',
      '.jp-ga-flag-emoji{font-size:2rem;line-height:1;}',
      '.jp-ga-flag-name{font-weight:700;font-size:0.82rem;text-align:center;}',
      '.jp-ga-flag-count{font-size:0.72rem;color:#a78bbf;font-weight:700;background:#f4eefa;padding:1px 8px;border-radius:10px;}',
      // chips
      '.jp-ga-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;}',
      '.jp-ga-chip{border:1.5px solid #e6dff5;background:#fff;color:#6c3483;font-weight:600;font-size:0.78rem;padding:6px 11px;border-radius:16px;cursor:pointer;}',
      '.jp-ga-chip.on{background:#8e44ad;color:#fff;border-color:transparent;}',
      '.jp-ga-chip-n{opacity:.6;font-size:0.72rem;}',
      // sections + list
      '.jp-ga-sec{margin-bottom:18px;}',
      '.jp-ga-sec-head{display:flex;align-items:baseline;gap:8px;padding:0 2px 6px;border-bottom:2px solid #f0e6f6;margin-bottom:8px;}',
      '.jp-ga-sec-label{font-weight:800;font-size:1rem;color:#8e44ad;}',
      '.jp-ga-sec-sub{font-size:0.78rem;color:#999;flex:1;}',
      '.jp-ga-sec-count{font-size:0.75rem;color:#a78bbf;font-weight:700;}',
      '.jp-ga-searchhdr{font-size:0.8rem;color:#999;font-weight:700;margin-bottom:8px;}',
      '.jp-ga-list{display:flex;flex-direction:column;gap:6px;}',
      '.jp-ga-term{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:1px solid #f0f0f0;background:#fff;border-radius:12px;padding:11px 14px;cursor:pointer;transition:.12s;}',
      '.jp-ga-term:active{transform:scale(.99);}',
      '.jp-ga-term:hover{border-color:#e0cef0;background:#fcfaff;}',
      '.jp-ga-term-jp{font-size:1.25rem;font-weight:700;font-family:"Noto Sans JP",sans-serif;min-width:0;}',
      '.jp-ga-term-en{flex:1;font-size:0.86rem;color:#747d8c;min-width:0;}',
      '.jp-ga-term-flag{font-size:1.1rem;}',
      '.jp-ga-empty{text-align:center;color:#999;padding:32px 16px;}',
      // popup
      '.jp-ga-note-overlay{position:fixed;inset:0;background:rgba(20,12,30,.45);display:flex;align-items:center;justify-content:center;padding:24px;z-index:1000;opacity:0;transition:opacity .2s;}',
      '.jp-ga-note-overlay.show{opacity:1;}',
      '.jp-ga-note{position:relative;background:#fffdf6;border-radius:6px;max-width:340px;width:100%;padding:22px 22px 20px;box-shadow:0 24px 60px -16px rgba(0,0,0,.5);transform:translateY(8px) rotate(-.5deg);transition:transform .2s;}',
      '.jp-ga-note-overlay.show .jp-ga-note{transform:none;}',
      '.jp-ga-note-tape{position:absolute;top:-10px;left:50%;transform:translateX(-50%) rotate(-2deg);width:80px;height:20px;background:rgba(142,68,173,.18);border-radius:2px;}',
      '.jp-ga-note-close{position:absolute;top:8px;right:10px;border:none;background:none;color:#bbb;font-size:1.1rem;cursor:pointer;}',
      '.jp-ga-note-head{display:flex;align-items:center;gap:10px;margin-bottom:2px;}',
      '.jp-ga-note-surface{font-size:1.9rem;font-weight:800;font-family:"Noto Sans JP",sans-serif;}',
      '.jp-ga-note-wasei{font-size:0.7rem;font-weight:800;color:#fff;background:#e67e22;padding:2px 7px;border-radius:10px;}',
      '.jp-ga-note-reading{font-size:0.95rem;color:#8e44ad;font-weight:600;}',
      '.jp-ga-note-origin{font-size:0.82rem;font-weight:600;color:#0e7490;margin-top:6px;}',
      '.jp-ga-note-meaning{font-size:1rem;margin-top:8px;}',
      '.jp-ga-note-notes{font-size:0.84rem;color:#666;margin-top:8px;line-height:1.5;}',
      '.jp-ga-note-themes{display:flex;flex-wrap:wrap;gap:5px;margin-top:12px;}',
      '.jp-ga-note-theme{font-size:0.7rem;font-weight:600;color:#8e44ad;background:#f4eefa;padding:2px 9px;border-radius:12px;}'
    ].join('');
    document.head.appendChild(s);
  }

  return { start: start };
})();

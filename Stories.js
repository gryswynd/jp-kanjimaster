/**
 * Stories.js — Consolidated story renderer
 *
 * Replaces Story.js + CustomStories.js. Reads `story.json` files (v2.0.0
 * schema documented in /Users/joel/.claude/plans/we-are-building-the-melodic-reddy.md).
 *
 * Public API:
 *   window.StoriesModule.start(container, config, exit, deepLinkId, opts)
 *     opts.category = 'curriculum' | 'custom' | undefined (undefined = both)
 *
 * Backwards-compatible aliases (one transition release):
 *   window.StoryModule.start(...)         → curriculum
 *   window.CustomStoriesModule.start(...) → custom
 *
 * Per-story features beyond the old MD path:
 *   - Per-paragraph English toggle (tap "EN" chip)
 *   - Global "Show all English" toggle in sticky header
 *   - End-of-story comprehension card (rendered when `questions[]` non-empty)
 *
 * Reuses existing JPShared helpers — no new dependencies:
 *   - JPShared.jpText.render({tokens})  : furigana / romaji renderer
 *   - JPShared.tts.speak / speakLines   : TTS
 *   - JPShared.termModal + window.JP_OPEN_TERM : term modal
 *   - JPShared.unlock.isStoryUnlocked   : story gating
 *   - JPShared.textProcessor (legacy)   : not used; tokens replace it
 */

window.StoriesModule = (function () {
  'use strict';

  // ── State ────────────────────────────────────────────────────────────────
  let container = null;
  let config = null;
  let onExit = null;
  let storyList = [];           // all known stories (filtered by `opts.category`)
  let currentStory = null;      // currently loaded story.json
  let currentIndex = 0;         // position in storyList
  let categoryOpt = null;       // 'curriculum' | 'custom' | null (both)
  let termMapData = {};         // id → term entry, for modal lookups
  let surfaceIdx = null;        // surface → entry, for runtime fallback
  let CONJUGATION_RULES = null; // loaded with glossaries; used by JP_OPEN_TERM

  // ── Boot ─────────────────────────────────────────────────────────────────
  function getCdnUrl(filepath) { return window.getAssetUrl(config, filepath); }

  function start(containerElement, repoConfig, exitCallback, deepLinkStoryId, opts) {
    container = containerElement;
    config = repoConfig;
    onExit = exitCallback;
    categoryOpt = (opts && opts.category) || null;
    injectStyles();
    initialize(deepLinkStoryId);
  }

  // ── Styles (lifted from Story.js, story-renderer-relevant subset) ───────
  function injectStyles() {
    if (document.getElementById('jp-stories-styles')) return;
    const style = document.createElement('style');
    style.id = 'jp-stories-styles';
    style.textContent = `
      .jp-story-container {
        font-family: 'Schibsted Grotesk','Work Sans',system-ui,sans-serif;
        background:
          radial-gradient(1200px 800px at 20% 10%, oklch(0.99 0.01 80 / 0.6), transparent 50%),
          radial-gradient(900px 600px at 90% 90%, oklch(0.94 0.015 40 / 0.35), transparent 55%),
          oklch(0.97 0.008 80);
        overflow: hidden; width: 100%; margin: 0 auto; position: relative;
        min-height: 100vh; min-height: 100dvh;
        color: oklch(0.22 0.012 60);
      }
      .jp-story-header {
        background: oklch(0.22 0.012 60); color: white;
        padding: max(28px,env(safe-area-inset-top)) 18px 14px;
        display: flex; justify-content: space-between; align-items: center;
        flex-wrap: wrap; gap: 10px;
        position: sticky; top: 0; z-index: 10;
        border-bottom: 1px solid oklch(1 0 0 / 0.1);
      }
      .jp-story-title { color: white; font-weight: 700; font-size: 1.1rem; flex: 1; min-width: 0; }
      .jp-story-nav { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .jp-story-nav-btn, .jp-story-back-btn {
        background: rgba(255,255,255,0.1); color: white; border: none;
        padding: 8px 14px; border-radius: 6px; cursor: pointer;
        font-weight: 600; font-size: 14px; transition: background 0.2s;
      }
      @media (hover: hover) {
        .jp-story-nav-btn:hover, .jp-story-back-btn:hover { background: rgba(255,255,255,0.2); }
      }
      .jp-story-nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
      .jp-story-content {
        background: oklch(0.97 0.008 80);
        padding: 24px 18px 60px; margin: 0; border-radius: 0; overflow-y: auto;
      }
      .jp-story-content h1 { color: #9A7B1F; font-size: 2rem; margin: 0 0 0.5rem; font-weight: 700; }
      .jp-story-content h2 { color: #6E5A18; font-size: 1.4rem; margin: 0 0 2rem; font-weight: 600; }
      .jp-story-content hr { border: none; border-top: 2px solid oklch(0.22 0.012 60 / 0.12); margin: 2rem 0; }

      .jp-story-paragraph {
        font-size: 1.15rem; line-height: 2.2;
        color: oklch(0.22 0.012 60);
        font-family: 'Noto Sans JP', sans-serif;
        margin: 0 0 1.4rem; padding: 0;
        position: relative;
      }
      .jp-story-en-section {
        margin-top: 36px; padding-top: 24px;
        border-top: 2px solid oklch(0.22 0.012 60 / 0.12);
      }
      .jp-story-en-section h3 {
        color: #9A7B1F; font-size: 1.05rem; font-weight: 700;
        letter-spacing: -0.01em; margin: 0 0 18px;
      }
      .jp-story-en-section p {
        font-family: 'Schibsted Grotesk','Work Sans',system-ui,sans-serif;
        font-size: 1rem; line-height: 1.7; margin: 0 0 1rem;
        color: oklch(0.32 0.012 60);
      }

      .jp-term {
        color: #C2410C; font-weight: 700; cursor: pointer;
        border-bottom: 2px solid rgba(78,84,200,0.2);
        margin-right: 1px; transition: 0.2s;
      }
      @media (hover: hover) {
        .jp-term:hover { background: oklch(0.60 0.18 30 / 0.10); border-bottom-color: #C2410C; }
      }
      .jp-speak-sentence {
        background: none; border: none; color: oklch(0.45 0.012 60);
        cursor: pointer; padding: 2px 4px; opacity: 0.7; font-size: 0.95em;
        vertical-align: middle; margin-left: 4px;
      }
      @media (hover: hover) { .jp-speak-sentence:hover { opacity: 1; } }

      .jp-speak-all-btn {
        background: oklch(0.60 0.18 30 / 0.08);
        border: 1px solid oklch(0.60 0.18 30 / 0.22);
        color: oklch(0.52 0.18 30);
        padding: 8px 16px; border-radius: 20px; cursor: pointer;
        font-size: 0.85rem; font-weight: 600; transition: all 0.18s;
        display: inline-flex; align-items: center; gap: 6px;
        margin-bottom: 18px;
      }
      .jp-speak-all-btn.jp-speak-all-active {
        background: oklch(0.55 0.18 30 / 0.14); border-color: oklch(0.55 0.18 30 / 0.36);
      }

      .jp-story-end-card {
        margin-top: 28px; padding: 22px 20px;
        background: white;
        border: 1px solid oklch(0.22 0.012 60 / 0.10);
        border-radius: 16px;
        box-shadow: 0 4px 14px rgba(0,0,0,0.05);
      }
      .jp-story-end-card h3 {
        margin: 0 0 16px; font-size: 1.05rem; color: #6E5A18;
        font-weight: 700; letter-spacing: -0.01em;
      }
      .jp-story-q {
        margin-bottom: 18px; padding-bottom: 18px;
        border-bottom: 1px solid oklch(0.22 0.012 60 / 0.08);
      }
      .jp-story-q:last-of-type { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
      .jp-story-q-text { font-weight: 600; font-size: 0.98rem; margin-bottom: 10px; }
      .jp-story-q-opt {
        display: block; width: 100%; text-align: left;
        background: oklch(0.94 0.012 75); border: 1px solid oklch(0.22 0.012 60 / 0.08);
        padding: 10px 14px; border-radius: 10px; cursor: pointer;
        font: inherit; color: inherit; margin-bottom: 6px;
        transition: background 0.15s, border-color 0.15s;
      }
      @media (hover: hover) { .jp-story-q-opt:hover { background: oklch(0.94 0.012 75 / 0.7); } }
      .jp-story-q-opt.correct { background: oklch(0.58 0.09 140 / 0.14); border-color: #5E8C5F; color: #3A5A3C; }
      .jp-story-q-opt.wrong   { background: oklch(0.60 0.18 30 / 0.10); border-color: #C2410C; color: #9A3412; }
      .jp-story-q-opt:disabled { cursor: default; }
      .jp-story-q-explain {
        margin-top: 8px; font-size: 0.85rem; font-style: italic;
        color: oklch(0.32 0.012 60); padding-left: 4px;
      }
      .jp-story-end-cta {
        margin-top: 18px; padding: 12px 20px;
        background: oklch(0.22 0.012 60); color: white;
        border: none; border-radius: 999px; font: inherit; font-weight: 700;
        cursor: pointer; width: 100%;
      }

      .jp-story-loading { text-align: center; padding: 60px 20px; color: oklch(0.55 0.012 60); }
      .jp-story-loading-spinner {
        display: inline-block; width: 40px; height: 40px;
        border: 4px solid oklch(0.22 0.012 60 / 0.15);
        border-top-color: oklch(0.60 0.18 30);
        border-radius: 50%; animation: jpStoriesSpin 1s linear infinite;
        margin-bottom: 20px;
      }
      @keyframes jpStoriesSpin { to { transform: rotate(360deg); } }
      .jp-story-error {
        background: oklch(0.97 0.008 80); border: 1px solid oklch(0.60 0.18 30 / 0.4);
        color: oklch(0.52 0.18 30); padding: 20px; margin: 18px;
        border-radius: 14px; text-align: center;
      }

      .jp-story-selector { background: white; padding: 30px; margin: 20px;
        border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
      .jp-story-selector h2 { color: #9A7B1F; font-size: 1.3rem; font-weight: 700; margin: 0 0 5px; }
      .jp-story-selector > p { color: #888; font-size: 0.9rem; margin: 0 0 20px; }
      .jp-story-level-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
      .jp-story-level-card {
        background: oklch(0.94 0.012 75); border-radius: 12px;
        padding: 28px 16px; cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        border: 2px solid transparent; text-align: center;
      }
      @media (hover: hover) {
        .jp-story-level-card:hover {
          transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,0.15);
          border-color: #9A7B1F;
        }
      }
      .jp-story-level-name { font-size: 1.4rem; font-weight: 900; color: #9A7B1F; margin-bottom: 6px; }
      .jp-story-level-count { font-size: 0.85rem; color: #6E5A18; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.05em; }
      .jp-story-level-back-btn {
        background: transparent; border: none; color: #9A7B1F; font-weight: 700;
        cursor: pointer; padding: 0 0 12px; font-size: 0.9rem; display: block; font-family: inherit;
      }
      @media (hover: hover) { .jp-story-level-back-btn:hover { text-decoration: underline; } }
      .jp-story-selector-grid {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px;
      }
      .jp-story-card {
        background: oklch(0.94 0.012 75); border-radius: 12px; padding: 24px 16px;
        cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;
        border: 2px solid transparent; text-align: center;
      }
      @media (hover: hover) {
        .jp-story-card:hover {
          transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,0.15); border-color: #9A7B1F;
        }
      }
      .jp-story-level-badge {
        display: inline-block; background: #9A7B1F; color: white;
        font-size: 0.7rem; font-weight: 700; padding: 3px 10px; border-radius: 10px;
        margin-bottom: 12px; letter-spacing: 0.05em;
      }
      .jp-story-card-jp {
        font-size: 1.3rem; font-weight: 700; color: oklch(0.22 0.012 60);
        margin-bottom: 6px; font-family: 'Noto Sans JP', sans-serif;
      }
      .jp-story-card-en { font-size: 0.85rem; color: #666; margin-bottom: 16px; }
      .jp-story-card-read-btn {
        background: #9A7B1F; color: white; border: none;
        padding: 8px 20px; border-radius: 20px; font-weight: 600;
        font-size: 0.85rem; cursor: pointer; pointer-events: none;
      }

      @media (max-width: 600px) {
        .jp-story-header { flex-direction: column; align-items: stretch; }
        .jp-story-nav { justify-content: center; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Resource loading ─────────────────────────────────────────────────────
  async function initialize(deepLinkStoryId) {
    container.innerHTML = '<div class="jp-story-container"><div class="jp-story-loading"><div class="jp-story-loading-spinner"></div>Loading stories…</div></div>';
    try {
      const manifest = await window.getManifest(config);
      await loadGlossariesAndCharacters(manifest);
      buildStoryList(manifest);
      if (deepLinkStoryId) {
        const idx = storyList.findIndex(s => s.id === deepLinkStoryId);
        if (idx >= 0) { currentIndex = idx; return loadStory(storyList[idx]); }
      }
      renderSelector();
    } catch (err) {
      console.error('[Stories] init error:', err);
      container.innerHTML = `<div class="jp-story-container"><div class="jp-story-error"><strong>Failed to load stories</strong><br>${(err && err.message) || err}</div></div>`;
    }
  }

  async function loadGlossariesAndCharacters(manifest) {
    const bust = '?t=' + Date.now();
    const particleUrl = getCdnUrl(manifest.shared.particles);
    const characterUrl = getCdnUrl(manifest.shared.characters);
    const conjUrl = getCdnUrl(manifest.globalFiles.conjugationRules);
    const levelGlossaryUrls = (manifest.levels || []).map(lvl => getCdnUrl(manifest.data[lvl].glossary));

    const [conjRules, particles, characters, ...glossaries] = await Promise.all([
      fetch(conjUrl + bust).then(r => r.json()),
      fetch(particleUrl + bust).then(r => r.json()),
      fetch(characterUrl + bust).then(r => r.json()),
      ...levelGlossaryUrls.map(u => fetch(u + bust).then(r => r.json()))
    ]);
    CONJUGATION_RULES = conjRules;

    termMapData = {};
    surfaceIdx = new Map();
    for (const g of glossaries) {
      for (const e of (g.entries || [])) {
        if (e.id) termMapData[e.id] = e;
        if (e.surface && !surfaceIdx.has(e.surface)) surfaceIdx.set(e.surface, e);
        // ALSO index by reading so kana-form spellings of kanji words (わたし
        // for 私, かぞく for 家族) get tagged via the renderer.
        if (e.reading && e.reading !== e.surface && !surfaceIdx.has(e.reading)) {
          surfaceIdx.set(e.reading, e);
        }
      }
    }
    for (const p of (particles.particles || [])) {
      termMapData[p.id] = { id: p.id, surface: p.particle, reading: p.reading, meaning: p.role, notes: p.explanation, type: 'particle', tokens: p.tokens };
      if (p.particle && !surfaceIdx.has(p.particle)) surfaceIdx.set(p.particle, termMapData[p.id]);
    }
    for (const c of (characters.characters || [])) {
      termMapData[c.id] = Object.assign({}, c, { portraitUrl: getCdnUrl(c.portrait) });
      // Index every kana spelling variant so prose mentions get tagged (e.g.
      // char_ken has surface=けん plus matches=['ケン']).
      const variants = new Set();
      if (c.surface) variants.add(c.surface);
      if (c.name) variants.add(c.name);
      if (Array.isArray(c.matches)) for (const m of c.matches) variants.add(m);
      for (const k of variants) {
        if (k && !surfaceIdx.has(k)) surfaceIdx.set(k, termMapData[c.id]);
      }
    }
    if (window.JPShared && window.JPShared.termModal) {
      window.JPShared.termModal.setTermMap(termMapData);
      window.JPShared.termModal.inject();
      // Custom JP_OPEN_TERM that supports flagging (port of old Story.js).
      window.JP_OPEN_TERM = function (id, form, enableFlag) {
        if (typeof form === 'boolean') { enableFlag = form; form = null; }
        let termId = id;
        if (form && CONJUGATION_RULES) {
          const conjugatedId = id + '_' + form;
          if (!termMapData[conjugatedId]) {
            const rootTerm = termMapData[id];
            if (rootTerm && window.JPShared.textProcessor) {
              const conj = window.JPShared.textProcessor.conjugate(rootTerm, form, CONJUGATION_RULES);
              if (conj) termMapData[conj.id] = conj;
            }
          }
          termId = termMapData[conjugatedId] ? conjugatedId : id;
        }
        window.JPShared.termModal.open(termId, {
          enableFlag: !!enableFlag,
          onFlag: function (flaggedId, msgBox) {
            if (window.JPShared.progress && !window.JPShared.progress.getFlagCount(id)) {
              window.JPShared.progress.flagTerm(id);
              if (msgBox) {
                msgBox.style.display = 'block';
                setTimeout(function () { msgBox.style.display = 'none'; }, 2000);
              }
            } else if (msgBox) {
              msgBox.style.display = 'none';
            }
          }
        });
      };
    }
  }

  // ── Story list (curriculum + custom, filtered by categoryOpt) ───────────
  function buildStoryList(manifest) {
    const sortKeys = buildCurriculumSortKeys(manifest);
    storyList = [];
    for (const level of Object.keys(manifest.data || {})) {
      const category = level === 'custom' ? 'custom' : 'curriculum';
      if (categoryOpt && categoryOpt !== category) continue;
      for (const s of (manifest.data[level].stories || [])) {
        storyList.push({
          id: s.id, dir: s.dir,
          file: s.file || 'story.json',
          title: s.titleJp || s.title,
          subtitle: s.title,
          level: category === 'custom' ? null : level,
          category,
          unlocksAfter: s.unlocksAfter
        });
      }
    }
    storyList.sort((a, b) => {
      // Curriculum first, sorted by unlocksAfter; then custom.
      if (a.category !== b.category) return a.category === 'curriculum' ? -1 : 1;
      const ka = sortKeys[a.unlocksAfter] || 0;
      const kb = sortKeys[b.unlocksAfter] || 0;
      return ka - kb;
    });
  }

  function buildCurriculumSortKeys(manifest) {
    // Mirrors Story.js — give every lesson/review/grammar a numeric position so
    // stories sort in curriculum order via `unlocksAfter`.
    const keys = {};
    const levels = manifest.levels || [];
    levels.forEach((lvl, lvlIdx) => {
      const base = (lvl === 'N5' ? 1000 : 10000) + lvlIdx * 100;
      const lessons = (manifest.data[lvl] && manifest.data[lvl].lessons) || [];
      lessons.forEach((les, i) => { keys[les.id] = base + i * 10; });
      const reviews = (manifest.data[lvl] && manifest.data[lvl].reviews) || [];
      reviews.forEach((rv, i) => { keys[rv.id] = base + 900 + i * 10; });
    });
    // Grammar resolves transitively via dependency chain — repeatedly walk.
    const grams = [];
    for (const lvl of levels) {
      const gs = (manifest.data[lvl] && manifest.data[lvl].grammar) || [];
      for (const g of gs) grams.push(g);
    }
    let changed = true;
    let iters = 0;
    while (changed && iters++ < 50) {
      changed = false;
      for (const g of grams) {
        if (keys[g.id] != null) continue;
        const prereq = g.unlocksAfter;
        if (prereq && keys[prereq] != null) { keys[g.id] = keys[prereq] + 1; changed = true; }
      }
    }
    return keys;
  }

  // ── Selector UI ──────────────────────────────────────────────────────────

  // Show category > level selector, or just stories if only one category/level.
  let selectorView = 'levels';  // 'levels' or 'stories'
  let selectorLevel = null;

  function renderSelector() {
    selectorView = 'levels';
    selectorLevel = null;
    const unlockApi = window.JPShared && window.JPShared.unlock;
    const visibleStories = storyList.filter(s => !unlockApi || unlockApi.isFree() || unlockApi.isStoryUnlocked(s));
    const grouped = {};
    for (const s of visibleStories) {
      const grp = s.category === 'custom' ? 'custom' : s.level;
      if (!grouped[grp]) grouped[grp] = [];
      grouped[grp].push(s);
    }

    const groupKeys = Object.keys(grouped).sort((a, b) => {
      // N5, N4, N3, custom order
      const ord = { N5: 0, N4: 1, N3: 2, custom: 9 };
      return (ord[a] != null ? ord[a] : 5) - (ord[b] != null ? ord[b] : 5);
    });

    let html = '<div class="jp-story-container">' +
      '<div class="jp-story-header"><div class="jp-story-title">📖 Stories</div>' +
      '<div class="jp-story-nav"><button class="jp-story-back-btn" id="jp-stories-exit">← Back</button></div></div>';

    if (groupKeys.length === 0) {
      html += '<div class="jp-story-error">No stories unlocked yet — finish more lessons to unlock them.</div>';
    } else {
      html += '<div class="jp-story-selector">' +
        '<h2>Choose a Level</h2>' +
        '<p>Read short stories with vocabulary and reading aids.</p>' +
        '<div class="jp-story-level-grid">';
      for (const k of groupKeys) {
        const name = k === 'custom' ? 'Custom Stories' : `JLPT ${k}`;
        const count = grouped[k].length;
        html += `<div class="jp-story-level-card" data-group="${escAttr(k)}">
          <div class="jp-story-level-name">${escHtml(name)}</div>
          <div class="jp-story-level-count">${count} stor${count === 1 ? 'y' : 'ies'}</div>
        </div>`;
      }
      html += '</div></div>';
    }
    html += '</div>';
    container.innerHTML = html;

    document.getElementById('jp-stories-exit').onclick = onExit;
    container.querySelectorAll('.jp-story-level-card').forEach(card => {
      card.onclick = () => renderStoriesInGroup(card.dataset.group, grouped[card.dataset.group]);
    });
  }

  function renderStoriesInGroup(groupKey, stories) {
    selectorView = 'stories';
    selectorLevel = groupKey;
    const groupName = groupKey === 'custom' ? 'Custom Stories' : `JLPT ${groupKey} Stories`;
    let html = '<div class="jp-story-container">' +
      '<div class="jp-story-header"><div class="jp-story-title">📖 ' + escHtml(groupName) + '</div>' +
      '<div class="jp-story-nav"><button class="jp-story-back-btn" id="jp-stories-exit">← Back</button></div></div>' +
      '<div class="jp-story-selector">' +
      '<button class="jp-story-level-back-btn" id="jp-stories-back-to-levels">← Levels</button>' +
      '<div class="jp-story-selector-grid">';
    for (const s of stories) {
      const badge = s.category === 'custom' ? 'CUSTOM' : (s.level || 'STORY');
      html += `<div class="jp-story-card" data-id="${escAttr(s.id)}">
        <div class="jp-story-level-badge">${escHtml(badge)}</div>
        <div class="jp-story-card-jp">${escHtml(s.title || s.subtitle || s.id)}</div>
        <div class="jp-story-card-en">${escHtml(s.subtitle || '')}</div>
        <button class="jp-story-card-read-btn">Read →</button>
      </div>`;
    }
    html += '</div></div></div>';
    container.innerHTML = html;
    document.getElementById('jp-stories-exit').onclick = onExit;
    document.getElementById('jp-stories-back-to-levels').onclick = renderSelector;
    container.querySelectorAll('.jp-story-card').forEach(card => {
      card.onclick = () => {
        const id = card.dataset.id;
        const idx = storyList.findIndex(s => s.id === id);
        if (idx < 0) return;
        currentIndex = idx;
        loadStory(storyList[idx]);
      };
    });
  }

  // ── Story load + render ──────────────────────────────────────────────────
  async function loadStory(storyInfo) {
    container.innerHTML = '<div class="jp-story-container"><div class="jp-story-loading"><div class="jp-story-loading-spinner"></div>Loading story…</div></div>';
    try {
      const url = getCdnUrl(storyInfo.dir + '/' + (storyInfo.file || 'story.json')) + '?t=' + Date.now();
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load story: ' + res.status);
      const data = await res.json();
      if (!data.schemaVersion || data.schemaVersion !== '2.0.0') {
        throw new Error('Unsupported story schema: ' + data.schemaVersion);
      }
      currentStory = data;
      renderStory(data);
    } catch (err) {
      console.error('[Stories] story load error:', err);
      container.innerHTML = '<div class="jp-story-container"><div class="jp-story-error"><strong>Could not load story</strong><br>' + escHtml(err.message || String(err)) + '</div></div>';
    }
  }

  function renderStory(data) {
    const prevDisabled = currentIndex <= 0 ? 'disabled' : '';
    const nextDisabled = currentIndex >= storyList.length - 1 ? 'disabled' : '';

    let html = '<div class="jp-story-container">' +
      '<div class="jp-story-header">' +
        '<div class="jp-story-title">' + escHtml(data.title || '') + '</div>' +
        '<div class="jp-story-nav">' +
          '<button class="jp-story-nav-btn" id="jp-stories-prev" ' + prevDisabled + '>← Prev</button>' +
          '<button class="jp-story-nav-btn" id="jp-stories-next" ' + nextDisabled + '>Next →</button>' +
          '<button class="jp-story-back-btn" id="jp-stories-list">≡ List</button>' +
          '<button class="jp-story-back-btn" id="jp-stories-exit">Exit</button>' +
        '</div>' +
      '</div>' +
      '<div class="jp-story-content">' +
        '<h1>' + escHtml(data.title || '') + '</h1>' +
        '<h2>' + escHtml(data.englishTitle || '') + '</h2>' +
        '<button class="jp-speak-all-btn" id="jp-stories-play-all" data-tts-play-all="story">🔊 Play Story</button>' +
        '<article id="jp-stories-prose">';

    data.paragraphs.forEach((p, idx) => {
      const tokensHtml = renderTokens(p.tokens);
      html += '<p class="jp-story-paragraph" data-para="' + idx + '">' +
        '<span class="jp-story-jp">' + tokensHtml + '</span>' +
        '<button class="jp-speak-sentence" data-speak-idx="' + idx + '" aria-label="Speak this paragraph">🔊</button>' +
      '</p>';
    });

    html += '</article>';

    // English translation block — full text, mirroring old MD path's
    // "### English Translation" section. Authors keep per-paragraph `en` in
    // the data; the renderer concats them here in story order.
    const enParas = data.paragraphs.map(p => p.en).filter(Boolean);
    if (enParas.length) {
      html += '<section class="jp-story-en-section">' +
        '<h3>English Translation</h3>' +
        enParas.map(en => '<p>' + escHtml(en) + '</p>').join('') +
      '</section>';
    }

    // Comprehension card (only if questions present)
    if (data.comprehension && Array.isArray(data.comprehension.questions) && data.comprehension.questions.length > 0) {
      html += renderComprehensionCard(data.comprehension);
    }
    html += '</div></div>';

    container.innerHTML = html;
    wireStoryEvents(data);
    // Reset scroll to top
    const content = container.querySelector('.jp-story-content');
    if (content) content.scrollTop = 0;
  }

  function wireStoryEvents(data) {
    document.getElementById('jp-stories-exit').onclick = onExit;
    document.getElementById('jp-stories-list').onclick = renderSelector;
    document.getElementById('jp-stories-prev').onclick = () => {
      if (currentIndex > 0) { currentIndex--; loadStory(storyList[currentIndex]); }
    };
    document.getElementById('jp-stories-next').onclick = () => {
      if (currentIndex < storyList.length - 1) { currentIndex++; loadStory(storyList[currentIndex]); }
    };
    // Per-paragraph speak
    container.querySelectorAll('.jp-speak-sentence').forEach(btn => {
      btn.onclick = function () {
        const idx = parseInt(this.dataset.speakIdx, 10);
        const p = data.paragraphs[idx];
        if (p && window.JPShared.tts) window.JPShared.tts.speak(p.jp);
      };
    });
    // Play-all
    const playBtn = document.getElementById('jp-stories-play-all');
    if (playBtn) {
      const lines = data.paragraphs.map(p => p.jp);
      let playing = false;
      function setPlaying(p) {
        playing = p;
        playBtn.textContent = playing ? '⏹ Stop' : '🔊 Play Story';
        playBtn.classList.toggle('jp-speak-all-active', playing);
      }
      playBtn.onclick = function () {
        if (window.JPShared.tts.isSpeaking && window.JPShared.tts.isSpeaking()) {
          window.JPShared.tts.cancel(); setPlaying(false);
        } else {
          setPlaying(true);
          window.JPShared.tts.speakLines(lines, { onFinish: () => setPlaying(false) });
        }
      };
    }
    // Term click handlers (inline tokens that match glossary surfaces).
    // If the term-id is a synthetic conjugation form (id = "<root>_<ruleKey>"
    // where ruleKey is a known entry in CONJUGATION_RULES), split it back
    // into (rootId, ruleKey) so the modal generates the inflected entry
    // on-demand via the existing JPShared.textProcessor.conjugate path.
    container.querySelectorAll('[data-term-id]').forEach(el => {
      el.onclick = function () {
        const id = this.dataset.termId;
        if (!id || !window.JP_OPEN_TERM) return;
        const split = splitConjugatedId(id);
        if (split) window.JP_OPEN_TERM(split.rootId, split.form, true);
        else window.JP_OPEN_TERM(id, null, true);
      };
    });
    // Comprehension Q answer wiring
    wireComprehensionCard();
  }

  // ── Token + term rendering ───────────────────────────────────────────────

  // Render paragraph tokens. Consecutive tokens with the same `g` (group id)
  // came from a single multi-piece glossary entry (e.g. 友だち → 友[とも]+だち)
  // and render as ONE clickable .jp-term wrapping all the pieces. Tokens
  // without a group are looked up individually via surfaceIdx.
  function renderTokens(tokens) {
    const rk = window.JPShared && window.JPShared.jpText;
    if (!Array.isArray(tokens) || !tokens.length) return '';
    let html = '';
    let i = 0;
    while (i < tokens.length) {
      const t = tokens[i];
      // Group run: consecutive tokens sharing the same `g`.
      if (t.g) {
        const g = t.g;
        const groupTokens = [];
        let inner = '';
        let j = i;
        while (j < tokens.length && tokens[j].g === g) {
          groupTokens.push(tokens[j]);
          // Suppress per-token romaji INSIDE a group — emit one combined
          // romaji line under the whole group instead. Prevents the
          // "ki [big gap] masu" effect where each token's romaji centers
          // under its own width.
          inner += rk ? rk.renderToken(tokens[j], { noRomaji: true }) : escHtml(tokens[j].k || '');
          j++;
        }
        // Append a single combined romaji span at the group level. CSS
        // positions it absolutely centered under the whole chip.
        if (rk && rk.tokensToRomaji) {
          inner += '<span class="rt-romaji rt-romaji-group">' + escHtml(rk.tokensToRomaji(groupTokens)) + '</span>';
        }
        const entry = termMapData && termMapData[g];
        const cls = entry && entry.type === 'character' ? 'jp-term jp-term-name' : 'jp-term';
        html += '<span class="jp-token-group ' + cls + '" data-term-id="' + escAttr(g) + '">' + inner + '</span>';
        i = j;
        continue;
      }
      const single = rk ? rk.renderToken(t) : escHtml(t.k || '');
      const entry = surfaceIdx && surfaceIdx.get(t.k);
      if (entry && entry.id) {
        const cls = entry.type === 'character' ? 'jp-term jp-term-name' : 'jp-term';
        html += '<span class="' + cls + '" data-term-id="' + escAttr(entry.id) + '">' + single + '</span>';
      } else {
        html += single;
      }
      i++;
    }
    return html;
  }

  // ── Comprehension card ──────────────────────────────────────────────────
  function renderComprehensionCard(comprehension) {
    let html = '<div class="jp-story-end-card" id="jp-stories-end-card">' +
      '<h3>' + escHtml(comprehension.intro || 'Did you follow the story?') + '</h3>';
    comprehension.questions.forEach((q, qi) => {
      html += '<div class="jp-story-q" data-qi="' + qi + '">' +
        '<div class="jp-story-q-text">' + escHtml(q.q) + '</div>';
      (q.options || []).forEach((opt, oi) => {
        html += '<button class="jp-story-q-opt" data-qi="' + qi + '" data-oi="' + oi + '">' + escHtml(opt) + '</button>';
      });
      if (q.explanation) {
        html += '<div class="jp-story-q-explain" hidden data-explain-for="' + qi + '">' + escHtml(q.explanation) + '</div>';
      }
      html += '</div>';
    });
    html += '<button class="jp-story-end-cta" id="jp-stories-end-cta" hidden></button>';
    html += '</div>';
    return html;
  }

  function wireComprehensionCard() {
    const card = document.getElementById('jp-stories-end-card');
    if (!card) return;
    const data = currentStory;
    if (!data || !data.comprehension) return;
    const totalQs = data.comprehension.questions.length;
    let answered = 0, correct = 0;

    card.querySelectorAll('.jp-story-q-opt').forEach(btn => {
      btn.onclick = function () {
        const qi = parseInt(this.dataset.qi, 10);
        const oi = parseInt(this.dataset.oi, 10);
        const q = data.comprehension.questions[qi];
        const wrapper = card.querySelector('.jp-story-q[data-qi="' + qi + '"]');
        if (!wrapper || wrapper.dataset.answered) return;
        wrapper.dataset.answered = '1';
        answered++;
        const isRight = oi === q.correct;
        if (isRight) correct++;
        wrapper.querySelectorAll('.jp-story-q-opt').forEach((b, idx) => {
          b.disabled = true;
          if (idx === q.correct) b.classList.add('correct');
          else if (idx === oi) b.classList.add('wrong');
        });
        const ex = wrapper.querySelector('.jp-story-q-explain');
        if (ex) ex.hidden = false;
        if (answered === totalQs) showCta(correct, totalQs);
      };
    });

    function showCta(score, total) {
      const cta = document.getElementById('jp-stories-end-cta');
      if (!cta) return;
      const pct = total ? Math.round(score / total * 100) : 0;
      cta.hidden = false;
      if (pct >= 60) {
        const hasNext = currentIndex < storyList.length - 1;
        cta.textContent = hasNext
          ? `${score}/${total} correct — try the next story →`
          : `${score}/${total} correct — nice!`;
        cta.onclick = () => {
          if (hasNext) { currentIndex++; loadStory(storyList[currentIndex]); }
          else renderSelector();
        };
      } else {
        cta.textContent = `${score}/${total} — give it another read`;
        cta.onclick = () => {
          const c = container.querySelector('.jp-story-content');
          if (c) c.scrollTo({ top: 0, behavior: 'smooth' });
        };
      }
    }
  }

  // ── Split a synthetic conjugated id (e.g. "v_ureshii_plain_past_adj") into
  //    {rootId, form}. Returns null when id doesn't end in a known rule key.
  function splitConjugatedId(id) {
    if (!id || !CONJUGATION_RULES) return null;
    const rules = Object.keys(CONJUGATION_RULES);
    // Try longest rule key first to avoid mis-matching prefixes (e.g.
    // "polite_past_negative" vs "polite_past").
    const sorted = rules.slice().sort((a, b) => b.length - a.length);
    for (const ruleKey of sorted) {
      const suffix = '_' + ruleKey;
      if (id.endsWith(suffix)) {
        const rootId = id.slice(0, -suffix.length);
        if (rootId) return { rootId, form: ruleKey };
      }
    }
    return null;
  }

  // ── HTML escape ──────────────────────────────────────────────────────────
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escAttr(s) { return escHtml(s); }

  // ── Public API ───────────────────────────────────────────────────────────
  return { start: start };
})();

// Backwards-compat shims: the existing launcher buttons call StoryModule and
// CustomStoriesModule. Route both through the new StoriesModule with the
// right category. Remove these shims after one production release.
window.StoryModule = window.StoryModule || {
  start: function (container, config, exit, deepLinkId) {
    window.StoriesModule.start(container, config, exit, deepLinkId, { category: 'curriculum' });
  }
};
window.CustomStoriesModule = window.CustomStoriesModule || {
  start: function (container, config, exit, deepLinkId) {
    window.StoriesModule.start(container, config, exit, deepLinkId, { category: 'custom' });
  }
};

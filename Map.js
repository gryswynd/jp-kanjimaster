/**
 * Map.js — N5 curriculum map.
 *
 * Visualizes the student's path through all 50 N5 nodes (lessons, grammar,
 * reviews, stories) as a vertical scenery scroll. Completed nodes are
 * stamped with the user's chosen character. The current unlocked-not-yet-
 * passed node gets a pulsing ring. Tapping deep-links into the content;
 * locked nodes toast the unlock reason.
 *
 * Conventions: window.MapModule.start(container, config, onExit).
 * Required globals: JPApp, JPShared.unlock, JPShared.stampSettings,
 * window.getManifest.
 */
window.MapModule = (function () {
  'use strict';

  // ── Region metadata ─────────────────────────────────────────────────────
  // Bands break the scroll into themed sections. A band is emitted just
  // before the node whose id matches `startId`. Order matters.
  var REGIONS_BY_LEVEL = {
    N5: [
      { startId: 'N5.1',  emoji: '🌱', titleJp: 'はじまり',   titleEn: 'Foundations' },
      { startId: 'N5.5',  emoji: '🏮', titleJp: 'たびだち',   titleEn: 'Going Places' },
      { startId: 'G9',    emoji: '🌸', titleJp: 'いろどり',   titleEn: 'Adjectives & Position' },
      { startId: 'N5.13', emoji: '🗣️', titleJp: 'はなしあい', titleEn: 'Communication' },
      { startId: 'N5.15', emoji: '🧭', titleJp: 'ほうがく',   titleEn: 'Directions' },
      { startId: 'N5.17', emoji: '🏯', titleJp: 'しゃかい',   titleEn: 'Society' }
    ],
    N4: [
      { startId: 'N4.1',  emoji: '🌅', titleJp: 'もどり',       titleEn: 'Returning' },
      { startId: 'N4.7',  emoji: '🏡', titleJp: 'かぞくと家',   titleEn: 'Family & Home' },
      { startId: 'N4.13', emoji: '💪', titleJp: 'からだと仕事', titleEn: 'Body & Work' },
      { startId: 'N4.19', emoji: '🌾', titleJp: 'くらし',       titleEn: 'Living & Trade' },
      { startId: 'N4.25', emoji: '📚', titleJp: 'けんきゅう',   titleEn: 'Research & Thought' },
      { startId: 'N4.31', emoji: '🏯', titleJp: 'みやこ',       titleEn: 'City & Industry' }
    ]
  };

  var LEVEL_META = {
    N5: { code: 'N5', fujiCap: 'ふじさん · the path ahead' },
    N4: { code: 'N4', fujiCap: 'つぎのみち · the road forward' }
  };

  var TYPE_ICON = {
    lesson:  '📘',
    grammar: '🌿',
    review:  '📝',
    story:   '📖'
  };

  var TYPE_LABEL = {
    lesson:  'Lesson',
    grammar: 'Grammar',
    review:  'Review',
    story:   'Story'
  };

  // ── Module state ────────────────────────────────────────────────────────
  var _container = null;
  var _config = null;
  var _onExit = null;
  var _level = 'N5';

  // ── Public entry ────────────────────────────────────────────────────────
  async function start(container, config, onExit, level) {
    _container = container;
    _config = config;
    _onExit = onExit;

    _injectStyles();
    _container.innerHTML = '<div class="rk-loading">loading map</div>';

    var manifest = null;
    try {
      manifest = (window.JPApp && window.JPApp._manifest) || null;
      if (!manifest && window.getManifest) manifest = await window.getManifest(_config);
    } catch (e) {
      console.warn('[Map] manifest unavailable:', e);
    }

    // Preload character cache so chosen stamps resolve correctly (otherwise
    // getStampUrl falls back to Rikizo while characters.json is loading).
    if (window.JPShared && window.JPShared.stampSettings
        && typeof window.JPShared.stampSettings.loadCharacters === 'function') {
      try { await window.JPShared.stampSettings.loadCharacters(); } catch (e) {}
    }

    // Resolve which level to display. Explicit arg wins; otherwise route to
    // the user's current frontier (N4 if they've unlocked it, else N5).
    if (level !== 'N5' && level !== 'N4') {
      var unlock = window.JPShared && window.JPShared.unlock;
      level = (unlock && unlock.isN4Unlocked()) ? 'N4' : 'N5';
    }
    _level = level;

    if (!manifest || !manifest.data || !manifest.data[level]) {
      _container.innerHTML = '<div class="jp-map-loading">Map unavailable. <button class="jp-map-textbtn" onclick="JPApp.renderMenu()">Back home</button></div>';
      return;
    }

    var seq   = _buildSequence(manifest, level);
    var state = _computeState(seq);
    _renderScene(state, level);
  }

  // ── Sequence ────────────────────────────────────────────────────────────
  // Walks lessons/grammar/reviews as a chain (DFS by `unlocksAfter`), then
  // splices stories in after their parent.
  //
  // N5 forms a single linear chain via unlocksAfter, so the DFS yields the
  // expected order. N4 is mostly orphan-rooted (only N4.1 chains off N5's
  // Final Review; N4.2…N4.36 have no explicit prereq) so we sort the root
  // entries by lesson number to recover the natural numerical sequence,
  // then DFS picks up each lesson's grammar/review children.
  function _buildSequence(manifest, level) {
    var lvl = manifest.data[level] || {};
    var lessons  = (lvl.lessons || []).map(function (e) { return _tag(e, 'lesson'); });
    var grammars = (lvl.grammar || []).map(function (e) { return _tag(e, 'grammar'); });
    var reviews  = (lvl.reviews || []).map(function (e) { return _tag(e, 'review'); });
    var stories  = (lvl.stories || []).map(function (e) { return _tag(e, 'story'); });

    var mainChain = lessons.concat(grammars).concat(reviews);
    var byId = new Map();
    mainChain.forEach(function (n) { byId.set(n.id, n); });

    // A node whose `unlocksAfter` points outside this level's chain (e.g.
    // N4.1 → N5.Final.Review) is treated as a level-root so DFS starts there.
    var children = new Map();
    mainChain.forEach(function (n) {
      var p = (n.unlocksAfter && byId.has(n.unlocksAfter)) ? n.unlocksAfter : '__root__';
      if (!children.has(p)) children.set(p, []);
      children.get(p).push(n);
    });

    // Determinism for sibling ordering. Lessons come first at each level so
    // that orphan-heavy N4 lays out in numerical order; within ties grammar
    // < review.
    var priority = { lesson: 0, grammar: 1, review: 2 };
    children.forEach(function (arr) {
      arr.sort(function (a, b) {
        if (a.type !== b.type) return priority[a.type] - priority[b.type];
        return _orderKey(a) - _orderKey(b);
      });
    });

    var result = [];
    function visit(node) {
      result.push(node);
      (children.get(node.id) || []).forEach(visit);
    }
    (children.get('__root__') || []).forEach(visit);

    // Stories slot in right after their unlocksAfter parent.
    stories.forEach(function (story) {
      var idx = result.findIndex(function (n) { return n.id === story.unlocksAfter; });
      if (idx >= 0) result.splice(idx + 1, 0, story);
      else result.push(story);
    });

    return result;
  }

  // Sortable numeric key from an id. Examples:
  //   N5.1   → 100001, N5.Review.1 → 100501, N5.Final.Review → 100999
  //   G1     → 1,      G13         → 13
  //   N4.10  → 200010, N4.Review.2 → 200502, N4.Final.Review → 200999
  function _orderKey(node) {
    var id = node.id || '';
    var m = /^N([45])\.(\d+)$/.exec(id);
    if (m) return parseInt(m[1], 10) * 100000 + parseInt(m[2], 10);
    m = /^N([45])\.Review\.(\d+)$/.exec(id);
    if (m) return parseInt(m[1], 10) * 100000 + 500 + parseInt(m[2], 10);
    if (/^N[45]\.(Final\.Review|.*Half.*Review)/i.test(id)) {
      return (/^N5/.test(id) ? 100000 : 200000) + 999;
    }
    m = /^G(\d+)$/.exec(id);
    if (m) return parseInt(m[1], 10);
    return 999999;
  }

  function _tag(entry, type) {
    return {
      id: entry.id,
      type: type,
      mode: type,
      title: entry.title || entry.id,
      unlocksAfter: entry.unlocksAfter || null,
      extraRequirePass: entry.extraRequirePass || null,
      entry: entry
    };
  }

  // ── State annotation ────────────────────────────────────────────────────
  function _computeState(seq) {
    var unlock = window.JPShared && window.JPShared.unlock;
    if (!unlock) return seq.map(function (n) { return _assign(n, { status: 'locked' }); });

    var isFree = unlock.isFree();
    var currentSet = false;

    return seq.map(function (node) {
      var done = unlock.isPassed(node.id) || unlock.isCompleted(node.id);
      var isUnlocked;
      switch (node.type) {
        case 'lesson':  isUnlocked = unlock.isLessonUnlocked(node.entry);  break;
        case 'grammar': isUnlocked = unlock.isGrammarUnlocked(node.entry); break;
        case 'review':  isUnlocked = unlock.isReviewUnlocked(node.entry);  break;
        case 'story':   isUnlocked = unlock.isStoryUnlocked(node.entry);   break;
        default:        isUnlocked = false;
      }

      var status;
      if (done) status = 'completed';
      else if (!isUnlocked) status = 'locked';
      // Stories don't gate downstream progress, so the "current" ring should
      // prefer a graded node (lesson/grammar/review). A story can still be
      // unlocked and tappable — just without the ring.
      else if (!isFree && !currentSet && node.type !== 'story') {
        status = 'current';
        currentSet = true;
      }
      else status = 'unlocked';

      return _assign(node, { status: status });
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────
  function _renderScene(state, level) {
    if (window.JPApp) window.JPApp.showTabBar();
    var stampUrl = '';
    if (window.JPShared && window.JPShared.stampSettings) {
      try { stampUrl = window.JPShared.stampSettings.getStampUrl(); } catch (e) {}
    }

    var regions = REGIONS_BY_LEVEL[level] || [];
    var regionByStartId = {};
    regions.forEach(function (r) { regionByStartId[r.startId] = r; });

    var totalNodes = state.length;
    var doneCount  = state.filter(function (n) { return n.status === 'completed'; }).length;

    var parts = [];
    parts.push(_headerHtml(level, doneCount, totalNodes));
    parts.push('<div class="jp-map-scroll">');
    if (level === 'N4') parts.push(_levelTeaserHtml('N5', 'top'));
    parts.push(_fujiHtml(level));

    state.forEach(function (node, idx) {
      var region = regionByStartId[node.id];
      if (region) parts.push(_regionHtml(region));
      var side = (idx % 2 === 0) ? 'left' : 'right';
      parts.push(_nodeHtml(node, side, stampUrl));
    });

    if (level === 'N5') parts.push(_levelTeaserHtml('N4', 'bottom'));
    parts.push('</div>');

    _container.innerHTML = parts.join('');

    // Wire node clicks.
    var nodes = _container.querySelectorAll('[data-map-node]');
    nodes.forEach(function (el) {
      el.addEventListener('click', function () {
        var id     = el.getAttribute('data-id');
        var mode   = el.getAttribute('data-mode');
        var status = el.getAttribute('data-status');
        if (status === 'locked') {
          var reason = el.getAttribute('data-reason') || 'Locked.';
          if (window.JPApp && window.JPApp._toast) window.JPApp._toast(reason);
          return;
        }
        if (window.JPApp && window.JPApp.launch) window.JPApp.launch(mode, id);
      });
    });

    var back = _container.querySelector('[data-map-back]');
    if (back) back.addEventListener('click', function () { if (_onExit) _onExit(); });

    // Bottom (N5→N4) and top (N4→N5) level-switch teasers. Locked taps toast.
    _container.querySelectorAll('[data-map-level]').forEach(function (el) {
      el.addEventListener('click', function () {
        var target = el.getAttribute('data-map-level');
        var locked = el.getAttribute('data-locked') === '1';
        if (locked) {
          var reason = el.getAttribute('data-reason') || 'Locked.';
          if (window.JPApp && window.JPApp._toast) window.JPApp._toast(reason);
          return;
        }
        if (window.JPApp && window.JPApp.launch) window.JPApp.launch('map', target);
      });
    });
  }

  function _headerHtml(level, done, total) {
    var pct = total ? Math.round((done / total) * 100) : 0;
    return ''
      + '<div class="jp-map-header">'
      +   '<button class="jp-map-back" data-map-back aria-label="Back">←</button>'
      +   '<div class="jp-map-titlewrap">'
      +     '<div class="jp-map-title">じゅんろ · Your Path</div>'
      +     '<div class="jp-map-sub">' + level + ' · ' + done + ' / ' + total + ' · ' + pct + '%</div>'
      +   '</div>'
      +   '<div class="jp-map-headerpad"></div>'
      + '</div>';
  }

  function _fujiHtml(level) {
    // Decorative Mt. Fuji silhouette banner — pure SVG, no asset download.
    return ''
      + '<div class="jp-map-fuji">'
      +   '<svg viewBox="0 0 320 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">'
      +     '<defs>'
      +       '<linearGradient id="jp-map-sky" x1="0" y1="0" x2="0" y2="1">'
      +         '<stop offset="0%" stop-color="oklch(0.92 0.04 230)"/>'
      +         '<stop offset="100%" stop-color="oklch(0.96 0.02 80)"/>'
      +       '</linearGradient>'
      +     '</defs>'
      +     '<rect x="0" y="0" width="320" height="100" fill="url(#jp-map-sky)"/>'
      +     '<circle cx="252" cy="28" r="14" fill="oklch(0.88 0.13 60 / 0.9)"/>'
      +     '<path d="M0 100 L110 38 L132 58 L150 46 L180 70 L210 40 L240 62 L320 100 Z" fill="oklch(0.45 0.05 250)"/>'
      +     '<path d="M150 46 L160 38 L180 70 Z" fill="oklch(0.96 0.01 230)"/>'
      +     '<path d="M0 100 L60 78 L120 92 L210 80 L320 100 Z" fill="oklch(0.55 0.06 220 / 0.8)"/>'
      +   '</svg>'
      +   '<div class="jp-map-fujicap mono">' + ((LEVEL_META[level] && LEVEL_META[level].fujiCap) || 'ふじさん · the path ahead') + '</div>'
      + '</div>';
  }

  function _regionHtml(region) {
    return ''
      + '<div class="jp-map-region">'
      +   '<div class="jp-map-regionline"></div>'
      +   '<div class="jp-map-regionchip">'
      +     '<span class="jp-map-regionemoji">' + region.emoji + '</span>'
      +     '<span class="jp-serif jp-map-regionjp">' + region.titleJp + '</span>'
      +     '<span class="jp-map-regionen">' + region.titleEn + '</span>'
      +   '</div>'
      +   '<div class="jp-map-regionline"></div>'
      + '</div>';
  }

  function _nodeHtml(node, side, stampUrl) {
    var icon  = TYPE_ICON[node.type] || '◯';
    var label = TYPE_LABEL[node.type] || '';
    var locked   = node.status === 'locked';
    var current  = node.status === 'current';
    var complete = node.status === 'completed';

    var classes = ['jp-map-node', 'side-' + side, 'status-' + node.status];
    var reason  = locked ? _unlockReason(node) : '';
    var attrs = ''
      + ' data-map-node="1"'
      + ' data-id="'     + _esc(node.id)   + '"'
      + ' data-mode="'   + _esc(node.mode) + '"'
      + ' data-status="' + node.status     + '"'
      + (locked ? ' data-reason="' + _esc(reason) + '"' : '');

    var stamp = (complete && stampUrl)
      ? '<img class="jp-map-stamp" src="' + _esc(stampUrl) + '" alt="" loading="lazy"/>'
      : '';
    var ring = current ? '<span class="jp-map-ring" aria-hidden="true"></span>' : '';
    var lockBadge = locked ? '<span class="jp-map-lock" aria-hidden="true">🔒</span>' : '';

    return ''
      + '<div class="' + classes.join(' ') + '"' + attrs + '>'
      +   '<div class="jp-map-tile">'
      +     ring
      +     '<div class="jp-map-icon">' + icon + '</div>'
      +     stamp
      +     lockBadge
      +   '</div>'
      +   '<div class="jp-map-meta">'
      +     '<div class="jp-map-nodeid mono">' + _esc(node.id) + '</div>'
      +     '<div class="jp-map-nodetitle">' + _esc(node.title) + '</div>'
      +     '<div class="jp-map-nodetype">' + label + '</div>'
      +   '</div>'
      + '</div>';
  }

  // Level-switch teaser. `position` is 'top' (above Mt. Fuji) or 'bottom'
  // (after the final node). The N5→N4 teaser is locked until isN4Unlocked().
  function _levelTeaserHtml(targetLevel, position) {
    var unlock = window.JPShared && window.JPShared.unlock;
    var locked = false;
    var reason = '';
    var head, title, sub;

    if (targetLevel === 'N4') {
      locked = !!(unlock && !unlock.isN4Unlocked());
      reason = 'Pass the N5 Final Review to begin N4.';
      head   = 'つぎ · UP NEXT';
      title  = 'N4 · 次の旅 →';
      sub    = locked
        ? 'Pass the N5 Final Review to unlock the N4 path.'
        : 'Continue your journey through N4 — 36 lessons await.';
    } else {
      head  = 'もどる · BACK';
      title = '← N5 · もとの道';
      sub   = 'Revisit the N5 foundations any time.';
    }

    var cls = 'jp-map-leveljump jp-map-leveljump--' + position
            + (locked ? ' jp-map-leveljump--locked' : '');
    var attrs = ''
      + ' data-map-level="' + targetLevel + '"'
      + (locked ? ' data-locked="1" data-reason="' + _esc(reason) + '"' : '');

    return ''
      + '<div class="' + cls + '" role="button" tabindex="0"' + attrs + '>'
      +   '<div class="jp-map-leveljump-inner">'
      +     '<div class="jp-map-leveljump-head mono">' + head + '</div>'
      +     '<div class="jp-map-leveljump-title">' + title + '</div>'
      +     '<div class="jp-map-leveljump-sub">' + sub + '</div>'
      +   '</div>'
      + '</div>';
  }

  // ── Unlock reason ───────────────────────────────────────────────────────
  function _unlockReason(node) {
    var unlock = window.JPShared && window.JPShared.unlock;
    if (!unlock) return 'Locked.';
    if (node.type === 'lesson' && /^N4\./.test(node.id) && !unlock.isN4Unlocked()) {
      return 'Pass the N5 Final Review to begin N4.';
    }
    if (node.extraRequirePass && !unlock.isPassed(node.extraRequirePass)) {
      return 'Pass ' + node.extraRequirePass + ' with ≥60% to unlock ' + node.id + '.';
    }
    if (node.unlocksAfter) {
      // Grammar prereqs use any-completion semantics; lessons/reviews/stories use ≥60% pass.
      var isGrammarPrereq = /^G\d+$/.test(node.unlocksAfter);
      if (isGrammarPrereq) {
        return 'Finish ' + node.unlocksAfter + ' to unlock ' + node.id + '.';
      }
      return 'Pass ' + node.unlocksAfter + ' with ≥60% to unlock ' + node.id + '.';
    }
    return 'Locked.';
  }

  // ── Styles (scoped under .jp-map-*) ─────────────────────────────────────
  function _injectStyles() {
    if (document.getElementById('jp-map-styles')) return;
    var css = ''
      + '.jp-map-loading{font-family:var(--font-ui);padding:60px 20px;text-align:center;color:var(--ink-3);}'
      + '.jp-map-textbtn{margin-left:8px;background:none;border:none;color:var(--vermilion);font-weight:600;cursor:pointer;}'

      + '.jp-map-header{position:sticky;top:0;z-index:10;display:flex;align-items:center;'
      +   'padding:12px 16px calc(12px) 16px;padding-top:max(12px,env(safe-area-inset-top));'
      +   'background:var(--washi);border-bottom:1px solid var(--hairline);}'
      + '.jp-map-back{width:36px;height:36px;border-radius:999px;border:1px solid var(--hairline);'
      +   'background:var(--washi-2);color:var(--ink);font-size:16px;font-weight:600;cursor:pointer;'
      +   'display:flex;align-items:center;justify-content:center;flex-shrink:0;}'
      + '.jp-map-titlewrap{flex:1;text-align:center;}'
      + '.jp-map-title{font-family:var(--font-jp-display);font-size:15px;font-weight:600;color:var(--ink);}'
      + '.jp-map-sub{font-family:var(--font-mono);font-size:10px;color:var(--ink-3);letter-spacing:0.12em;text-transform:uppercase;margin-top:2px;}'
      + '.jp-map-headerpad{width:36px;flex-shrink:0;}'

      + '.jp-map-scroll{position:relative;padding:0 0 60px 0;background:var(--washi);'
      +   'background-image:radial-gradient(circle at 20% 10%,oklch(0.96 0.03 100 / 0.6),transparent 40%),'
      +   'radial-gradient(circle at 80% 70%,oklch(0.95 0.02 200 / 0.4),transparent 50%);}'

      + '.jp-map-fuji{position:relative;margin:0 0 12px 0;}'
      + '.jp-map-fuji svg{display:block;width:100%;height:auto;max-height:120px;}'
      + '.jp-map-fujicap{position:absolute;left:0;right:0;bottom:6px;text-align:center;'
      +   'font-size:9px;color:oklch(1 0 0 / 0.7);letter-spacing:0.22em;text-transform:uppercase;}'

      + '.jp-map-region{display:flex;align-items:center;gap:10px;margin:20px 16px 14px 16px;}'
      + '.jp-map-regionline{flex:1;height:1px;background:var(--hairline);}'
      + '.jp-map-regionchip{display:flex;align-items:center;gap:8px;padding:6px 12px;'
      +   'border:1px solid var(--hairline);border-radius:999px;background:var(--washi-2);}'
      + '.jp-map-regionemoji{font-size:14px;}'
      + '.jp-map-regionjp{font-size:13px;color:var(--ink);}'
      + '.jp-map-regionen{font-family:var(--font-mono);font-size:9.5px;letter-spacing:0.14em;text-transform:uppercase;color:var(--ink-3);}'

      // Vertical spine line behind the alternating nodes.
      + '.jp-map-scroll::before{content:"";position:absolute;left:50%;top:128px;bottom:120px;'
      +   'width:2px;margin-left:-1px;background:repeating-linear-gradient(to bottom,'
      +   'var(--hairline) 0,var(--hairline) 6px,transparent 6px,transparent 12px);pointer-events:none;}'

      + '.jp-map-node{position:relative;display:flex;align-items:center;gap:10px;padding:6px 16px;'
      +   'width:62%;cursor:pointer;-webkit-tap-highlight-color:transparent;}'
      + '.jp-map-node.side-left{margin-right:auto;}'
      + '.jp-map-node.side-right{margin-left:auto;flex-direction:row-reverse;text-align:right;}'

      + '.jp-map-tile{position:relative;width:56px;height:56px;flex-shrink:0;border-radius:50%;'
      +   'background:var(--washi-2);border:1.5px solid var(--hairline);display:flex;'
      +   'align-items:center;justify-content:center;font-size:24px;'
      +   'box-shadow:0 2px 6px oklch(0.22 0.012 60 / 0.06);transition:transform 0.18s ease;}'
      + '.jp-map-node:active .jp-map-tile{transform:scale(0.94);}'

      + '.jp-map-node.status-locked .jp-map-tile{background:var(--hairline-2);opacity:0.5;}'
      + '.jp-map-node.status-locked .jp-map-meta{opacity:0.5;}'
      + '.jp-map-node.status-completed .jp-map-tile{background:var(--washi);border-color:var(--moss);}'
      + '.jp-map-node.status-current .jp-map-tile{background:var(--washi);border-color:var(--vermilion);}'

      + '.jp-map-icon{filter:saturate(0.9);}'
      + '.jp-map-stamp{position:absolute;right:-4px;bottom:-4px;width:26px;height:26px;'
      +   'border-radius:50%;border:2px solid var(--washi);object-fit:cover;background:var(--washi);'
      +   'box-shadow:0 1px 3px oklch(0.22 0.012 60 / 0.18);}'
      + '.jp-map-lock{position:absolute;right:-2px;bottom:-2px;font-size:11px;background:var(--washi);'
      +   'border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;'
      +   'border:1px solid var(--hairline);}'

      // Pulsing ring on the current node.
      + '.jp-map-ring{position:absolute;inset:-6px;border-radius:50%;border:2px solid var(--vermilion);'
      +   'animation:jpMapPulse 1.6s ease-in-out infinite;pointer-events:none;}'
      + '@keyframes jpMapPulse{0%,100%{opacity:0.9;transform:scale(1);}50%{opacity:0.35;transform:scale(1.08);}}'

      + '.jp-map-meta{min-width:0;}'
      + '.jp-map-nodeid{font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:var(--ink-3);}'
      + '.jp-map-nodetitle{font-size:13px;font-weight:600;color:var(--ink);line-height:1.25;'
      +   'overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}'
      + '.jp-map-nodetype{font-family:var(--font-mono);font-size:9.5px;letter-spacing:0.14em;text-transform:uppercase;color:var(--ink-3);margin-top:2px;}'

      + '.jp-map-leveljump{margin:16px 16px;padding:18px 20px;border:1px dashed var(--hairline);'
      +   'border-radius:var(--r-lg);background:var(--washi-2);text-align:center;cursor:pointer;'
      +   '-webkit-tap-highlight-color:transparent;}'
      + '.jp-map-leveljump--top{margin-top:0;margin-bottom:18px;}'
      + '.jp-map-leveljump--bottom{margin-top:40px;}'
      + '.jp-map-leveljump--locked{opacity:0.55;cursor:default;}'
      + '.jp-map-leveljump:active{transform:scale(0.99);}'
      + '.jp-map-leveljump--locked:active{transform:none;}'
      + '.jp-map-leveljump-head{font-size:10px;color:var(--ink-3);letter-spacing:0.18em;text-transform:uppercase;}'
      + '.jp-map-leveljump-title{font-family:var(--font-jp-display);font-size:18px;font-weight:600;color:var(--ink);margin-top:6px;}'
      + '.jp-map-leveljump-sub{font-size:11px;color:var(--ink-3);margin-top:6px;}'
      ;

    var el = document.createElement('style');
    el.id = 'jp-map-styles';
    el.textContent = css;
    document.head.appendChild(el);
  }

  // ── Utils ───────────────────────────────────────────────────────────────
  function _assign(target, src) {
    var out = {};
    Object.keys(target).forEach(function (k) { out[k] = target[k]; });
    Object.keys(src).forEach(function (k) { out[k] = src[k]; });
    return out;
  }
  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  return { start: start };
})();

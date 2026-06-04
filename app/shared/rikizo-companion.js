/**
 * app/shared/rikizo-companion.js
 * Living Rikizo mascot for the phone app. Brings the Godot game's walk-cycle
 * sprite into the web app as an overlay companion who:
 *   - walks around (left/right/up/down) and speaks via a speech bubble,
 *   - runs a first-launch onboarding tour with element spotlights,
 *   - gives a time-based greeting + encouragement on each subsequent open.
 *
 * Sprite sheet: assets/characters/rikizo/rikizo_sheet.png (1224x1172).
 *   6 cols x 4 rows, each cell 204x293. Row order = down/left/right/up.
 *   Col 0 = idle; cols 1..5 = walk frames. ~133ms/frame (matches the game).
 *
 * The overlay layer lives on document.body (NOT #app-main-container, which
 * renderMenu() wipes) so the companion survives full-screen re-renders.
 *
 * English-only output in the bubble — the one Japanese line we keep is the
 * comprehension test (わかる？) during onboarding.
 *
 * Registers window.JPShared.rikizoCompanion. Load after streak.js.
 */
(function () {
  'use strict';

  window.JPShared = window.JPShared || {};
  if (window.JPShared.rikizoCompanion) return; // idempotent

  // --- Sheet geometry ---
  var CELL_W = 204, CELL_H = 293;
  var SCALE = 0.5;
  var SPR_W = Math.round(CELL_W * SCALE);          // 102
  var SPR_H = Math.round(CELL_H * SCALE);          // 146
  var SHEET_W = Math.round(1224 * SCALE);          // 612
  var SHEET_H = Math.round(1172 * SCALE);          // 586
  var ROW = { down: 0, left: 1, right: 2, up: 3 };
  var WALK_COLS = [1, 2, 3, 4, 5];
  var FRAME_MS = 133;
  var WALK_SPEED = 170;                            // px / second (used as default speed)
  var SPOTLIGHT_PAD = 8;                           // px around target

  var PRESENCE_KEY = 'k-rikizo-presence';
  var ONBOARD_KEY = 'k-rikizo-onboarded';
  var SKIP_TUT_KEY = 'k-rikizo-skip-tutorials';
  var PRESENCE_LEVELS = ['contextual', 'home', 'always'];

  var cfg = null;
  var layer = null, sprite = null, bubble = null, spotlight = null, lockOverlay = null;
  var state = {
    x: -SPR_W - 40, y: 0, facing: 'down',
    loopId: null, busy: false, onboarding: false, speakResolver: null
  };
  var styleInjected = false;

  function assetUrl(path) {
    if (window.getAssetUrl) return window.getAssetUrl(cfg || {}, path);
    return path;
  }

  // ---------------------------------------------------------------- styles
  function injectStyles() {
    if (styleInjected) return;
    styleInjected = true;
    var css =
      '#rk-companion-layer{position:fixed;top:0;bottom:0;left:50%;transform:translateX(-50%);' +
        'width:100%;max-width:430px;pointer-events:none;z-index:60;overflow:hidden;}' +
      '.rk-comp-sprite{position:absolute;width:' + SPR_W + 'px;height:' + SPR_H + 'px;' +
        'background-image:url("' + assetUrl('assets/characters/rikizo/rikizo_sheet.png') + '");' +
        'background-repeat:no-repeat;background-size:' + SHEET_W + 'px ' + SHEET_H + 'px;' +
        'pointer-events:auto;cursor:pointer;display:none;' +
        'filter:drop-shadow(0 3px 5px rgba(0,0,0,0.28));' +
        'image-rendering:pixelated;image-rendering:crisp-edges;will-change:left,top;}' +
      /* Standardized: every bubble is the same width (capped to the viewport) so
         they never render skinny or run off-screen — only the height varies. */
      '.rk-comp-bubble{position:absolute;width:min(300px,calc(100vw - 28px));box-sizing:border-box;' +
        'background:var(--washi,#f7f4ee);color:var(--ink,#2a2520);' +
        'border:1px solid var(--hairline,rgba(40,35,30,0.14));border-radius:16px;' +
        'padding:12px 16px;box-shadow:0 6px 22px rgba(0,0,0,0.18);' +
        'pointer-events:auto;cursor:pointer;display:none;text-align:center;' +
        'transform:translateX(-50%);animation:jpFadeIn 0.25s ease;z-index:2;}' +
      /* Arrow at bottom (bubble sits ABOVE sprite — the default) */
      '.rk-comp-bubble::after{content:"";position:absolute;left:var(--rk-tail,50%);bottom:-9px;' +
        'transform:translateX(-50%);border-left:9px solid transparent;' +
        'border-right:9px solid transparent;border-top:9px solid var(--washi,#f7f4ee);}' +
      /* Arrow at top (bubble sits BELOW sprite — fallback when there is no room above) */
      '.rk-comp-bubble.rk-comp-bubble--up::after{top:-9px;bottom:auto;' +
        'border-top:none;border-bottom:9px solid var(--washi,#f7f4ee);}' +
      '.rk-comp-bubble-jp{font-family:var(--font-jp-display,serif);font-size:1.1rem;' +
        'font-weight:600;line-height:1.35;}' +
      '.rk-comp-bubble-en{font-size:0.9rem;color:var(--ink,#2a2520);line-height:1.45;}' +
      '.rk-comp-bubble-jp + .rk-comp-bubble-en{margin-top:6px;color:var(--ink-2,#4a4138);' +
        'font-size:0.85rem;}' +
      '.rk-comp-tap{font-family:var(--font-mono,monospace);font-size:8.5px;letter-spacing:0.12em;' +
        'text-transform:uppercase;color:var(--ink-3,#7a7167);margin-top:8px;opacity:0.8;}' +
      /* Spotlight — a transparent ring with a giant outer shadow that dims everything else. */
      /* pointer-events:auto on the ring so taps on the highlighted element are
         absorbed by the tutorial (and forwarded to the advance handler) rather
         than firing the underlying button — prevents accidental confirm()
         dialogs (e.g. Clear button) during a tour step. */
      '.rk-comp-spotlight{position:fixed;border-radius:14px;pointer-events:auto;' +
        'box-shadow:0 0 0 9999px rgba(0,0,0,0.55);border:2px solid var(--vermilion,#c8553d);' +
        'transition:left 0.35s ease,top 0.35s ease,width 0.35s ease,height 0.35s ease,opacity 0.2s;' +
        'z-index:58;opacity:0;animation:rkRingPulse 1.6s ease-in-out infinite;cursor:pointer;}' +
      '@keyframes rkRingPulse{0%,100%{box-shadow:0 0 0 9999px rgba(0,0,0,0.55),0 0 0 0 rgba(200,85,61,0.55);}' +
        '50%{box-shadow:0 0 0 9999px rgba(0,0,0,0.55),0 0 0 10px rgba(200,85,61,0);}}' +
      '@keyframes rkHop{0%{transform:translateY(0)}40%{transform:translateY(-9px)}100%{transform:translateY(0)}}' +
      '.rk-comp-hop{animation:rkHop 0.45s ease;}' +
      '.rk-comp-choices{display:flex;gap:12px;justify-content:center;margin-top:6px;}' +
      '.rk-comp-choice{flex:1;max-width:130px;padding:11px 0;border-radius:999px;border:none;' +
        'font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;}' +
      '.rk-comp-choice-yes{background:var(--vermilion,#c8553d);color:#fff;}' +
      '.rk-comp-choice-no{background:var(--washi-3,#e4ded2);color:var(--ink,#2a2520);}' +
      /* Full-screen tutorial lock — sits BELOW the spotlight ring + sprite/bubble
         in z-order (so the dim + highlight still show through) but absorbs every
         tap on the rest of the screen and forwards it to advance(). This freezes
         the underlying UI while a tutorial plays; tap anywhere to step forward. */
      '.rk-comp-lock{position:fixed;inset:0;z-index:57;background:transparent;' +
        'cursor:pointer;display:none;}';
    var el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
  }

  // ------------------------------------------------------------ layer setup
  function ensureLayer() {
    if (layer && document.body.contains(layer)) return;
    injectStyles();
    layer = document.createElement('div');
    layer.id = 'rk-companion-layer';
    sprite = document.createElement('div');
    sprite.className = 'rk-comp-sprite pixel';
    bubble = document.createElement('div');
    bubble.className = 'rk-comp-bubble';
    layer.appendChild(sprite);
    layer.appendChild(bubble);
    document.body.appendChild(layer);

    // Spotlight is a sibling on body (NOT inside the companion layer — it must
    // sit below the sprite/bubble in z-order and dim the entire viewport).
    spotlight = document.createElement('div');
    spotlight.className = 'rk-comp-spotlight';
    spotlight.style.display = 'none';
    document.body.appendChild(spotlight);

    // Full-screen lock (see .rk-comp-lock). Shown only while a tutorial runs.
    lockOverlay = document.createElement('div');
    lockOverlay.className = 'rk-comp-lock';
    document.body.appendChild(lockOverlay);

    var advance = function () {
      if (state.speakResolver) { var r = state.speakResolver; state.speakResolver = null; r(); }
    };
    sprite.addEventListener('click', advance);
    bubble.addEventListener('click', advance);
    // Spotlight also advances — and absorbs the tap so the highlighted button
    // underneath doesn't fire. Critical for buttons with confirm() prompts.
    spotlight.addEventListener('click', function (e) { e.stopPropagation(); advance(); });
    // Tap anywhere else on the locked screen also steps the tutorial forward.
    lockOverlay.addEventListener('click', function (e) { e.stopPropagation(); advance(); });

    setFrame(0, ROW.down);
    state.y = restY();
    applyPos();
  }

  function layerWidth()  { return layer ? layer.clientWidth  : 430; }
  function layerHeight() { return layer ? layer.clientHeight : window.innerHeight; }
  function tabbarH() {
    var v = getComputedStyle(document.documentElement).getPropertyValue('--tabbar-h');
    var n = parseInt(v, 10);
    return isNaN(n) ? 64 : n;
  }
  function restY() {
    // Sprite's "home" Y: feet just above the tabbar with a small breathing gap.
    return Math.max(0, layerHeight() - SPR_H - tabbarH() - 10);
  }
  function setFrame(col, row) {
    if (!sprite) return;
    sprite.style.backgroundPosition = (-(col * SPR_W)) + 'px ' + (-(row * SPR_H)) + 'px';
  }
  function applyPos() {
    if (!sprite) return;
    sprite.style.left = Math.round(state.x) + 'px';
    sprite.style.top  = Math.round(state.y) + 'px';
  }
  function cancelLoop() {
    if (state.loopId) { cancelAnimationFrame(state.loopId); state.loopId = null; }
  }
  function centerX() { return Math.round(layerWidth() / 2 - SPR_W / 2); }
  function offscreenLeft() { return -SPR_W - 30; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // Resolve once el's viewport rect stops moving (a smooth scrollIntoView has
  // actually finished), or after a hard cap. A fixed delay is unreliable: the
  // FIRST tour step in a fresh scroll context has a large scroll delta and was
  // being measured mid-flight, landing the spotlight off-target; later steps
  // scroll ~0 and settle instantly. Needs two consecutive stable reads so a
  // scroll that hasn't visibly started yet isn't mistaken for "settled".
  function waitForScrollSettle(el, capMs) {
    return new Promise(function (resolve) {
      var prev = null, stable = 0, elapsed = 0, STEP = 60, CAP = capMs || 1000;
      (function tick() {
        var r = el.getBoundingClientRect();
        if (prev && Math.abs(r.top - prev.top) < 1 && Math.abs(r.left - prev.left) < 1) stable++;
        else stable = 0;
        prev = r;
        elapsed += STEP;
        if (stable >= 2 || elapsed >= CAP) { resolve(); return; }
        setTimeout(tick, STEP);
      })();
    });
  }

  // --------------------------------------------------------------- movement
  function show() { ensureLayer(); sprite.style.display = 'block'; }
  function hide() {
    if (!sprite) return;
    cancelLoop();
    clearBubble();
    clearHighlight();
    unlockScreen();
    sprite.style.display = 'none';
  }

  // ----------------------------------------------------------- screen lock
  // While a tutorial plays, freeze the underlying UI: a transparent full-screen
  // overlay absorbs every tap and forwards it to advance() (tap anywhere to step
  // through). Engaged at the start of each tutorial sequence; released by hide()
  // / resetRuntime() / the sequence's own cleanup + error paths.
  function lockScreen()   { ensureLayer(); if (lockOverlay) lockOverlay.style.display = 'block'; }
  function unlockScreen() { if (lockOverlay) lockOverlay.style.display = 'none'; }
  function place(x, y) {
    ensureLayer();
    cancelLoop();
    state.x = x;
    if (typeof y === 'number') state.y = y;
    state.facing = 'down';
    setFrame(0, ROW.down);
    applyPos();
  }
  function idle() {
    cancelLoop();
    var row = state.facing === 'left' ? ROW.left : state.facing === 'right' ? ROW.right
      : state.facing === 'up' ? ROW.up : ROW.down;
    setFrame(0, row);
  }

  // Move along a straight line to (targetX, targetY), cycling walk frames as we go.
  // Direction picks left/right rows when horizontal motion dominates, otherwise up/down.
  function moveTo(targetX, targetY, opts) {
    opts = opts || {};
    ensureLayer(); show();
    return new Promise(function (resolve) {
      var startX = state.x, startY = state.y;
      var dx = targetX - startX, dy = targetY - startY;
      var dist = Math.hypot(dx, dy);
      if (dist < 2) { state.x = targetX; state.y = targetY; applyPos(); idle(); resolve(); return; }
      var speed = opts.speed || WALK_SPEED;
      var dur = opts.duration || Math.min(2200, (dist / speed) * 1000);
      var row;
      if (Math.abs(dx) >= Math.abs(dy)) {
        row = dx < 0 ? ROW.left : ROW.right;
        state.facing = dx < 0 ? 'left' : 'right';
      } else {
        row = dy < 0 ? ROW.up : ROW.down;
        state.facing = dy < 0 ? 'up' : 'down';
      }
      var startTs = null, frameAcc = 0, lastTs = null, ci = 0;
      cancelLoop();
      setFrame(WALK_COLS[0], row);
      function tick(now) {
        if (!layer || !document.body.contains(layer)) { resolve(); return; }
        if (startTs === null) { startTs = now; lastTs = now; }
        var t = Math.min(1, (now - startTs) / dur);
        state.x = startX + dx * t;
        state.y = startY + dy * t;
        applyPos();
        frameAcc += (now - lastTs); lastTs = now;
        if (frameAcc >= FRAME_MS) {
          frameAcc -= FRAME_MS;
          ci = (ci + 1) % WALK_COLS.length;
          setFrame(WALK_COLS[ci], row);
        }
        if (t >= 1) { setFrame(0, row); state.loopId = null; resolve(); return; }
        state.loopId = requestAnimationFrame(tick);
      }
      state.loopId = requestAnimationFrame(tick);
    });
  }
  function walkTo(targetX, opts) { return moveTo(targetX, state.y, opts); }

  // Walk to stand under a DOM element (x-axis only; sprite stays at current Y).
  function pointAt(el, opts) {
    if (!el) return Promise.resolve();
    ensureLayer();
    var lr = layer.getBoundingClientRect();
    var r = el.getBoundingClientRect();
    var targetX = (r.left + r.width / 2) - lr.left - SPR_W / 2;
    targetX = clamp(targetX, 4, layerWidth() - SPR_W - 4);
    return walkTo(targetX, opts).then(function () {
      sprite.classList.remove('rk-comp-hop');
      void sprite.offsetWidth;
      sprite.classList.add('rk-comp-hop');
      state.facing = 'down'; setFrame(0, ROW.down);
    });
  }

  // -------------------------------------------------------------- spotlight
  function highlight(el) {
    ensureLayer();
    if (!el || !spotlight) return;
    var r = el.getBoundingClientRect();
    spotlight.style.display = 'block';
    spotlight.style.left   = Math.round(r.left - SPOTLIGHT_PAD) + 'px';
    spotlight.style.top    = Math.round(r.top  - SPOTLIGHT_PAD) + 'px';
    spotlight.style.width  = Math.round(r.width  + SPOTLIGHT_PAD * 2) + 'px';
    spotlight.style.height = Math.round(r.height + SPOTLIGHT_PAD * 2) + 'px';
    // fade-in once positioned
    spotlight.style.opacity = '1';
  }
  function clearHighlight() {
    if (!spotlight) return;
    spotlight.style.opacity = '0';
    // hide after the transition so it stops capturing layout
    setTimeout(function () {
      if (spotlight && spotlight.style.opacity === '0') spotlight.style.display = 'none';
    }, 220);
  }

  // ---------------------------------------------------------------- speech
  function clearBubble() {
    if (bubble) {
      bubble.style.display = 'none';
      bubble.innerHTML = '';
      bubble.classList.remove('rk-comp-bubble--up');
    }
    state.speakResolver = null;
  }

  // Position bubble relative to the sprite — above by default, falling back to
  // below when there isn't enough room above (e.g. sprite is near the top edge).
  function positionBubble() {
    if (!bubble || bubble.style.display === 'none') return;
    var spriteCenter = state.x + SPR_W / 2;
    var bw = bubble.offsetWidth || 200;
    var bh = bubble.offsetHeight || 80;
    var half = bw / 2;
    var cx = clamp(spriteCenter, half + 6, layerWidth() - half - 6);
    bubble.style.left = Math.round(cx) + 'px';

    var aboveY = state.y - bh - 12;
    var belowY = state.y + SPR_H + 12;
    if (aboveY < 8) {
      bubble.style.top = Math.round(belowY) + 'px';
      bubble.classList.add('rk-comp-bubble--up');
    } else {
      bubble.style.top = Math.round(aboveY) + 'px';
      bubble.classList.remove('rk-comp-bubble--up');
    }

    var tailPct = ((spriteCenter - (cx - half)) / bw) * 100;
    bubble.style.setProperty('--rk-tail', clamp(tailPct, 12, 88) + '%');
  }

  // text = English line (may be ''); opts.jp = Japanese line.
  // Dialog is TAP-ONLY: each line waits indefinitely for the user to tap the
  // sprite or bubble to advance. Auto-advance is opt-in via opts.autoMs (used
  // by no production caller today; kept as an escape hatch).
  function speak(text, opts) {
    opts = opts || {};
    ensureLayer(); show();
    var jp = opts.jp || '';
    var en = text || '';
    var html = '';
    if (jp) html += '<div class="rk-comp-bubble-jp">' + esc(jp) + '</div>';
    if (en) html += '<div class="rk-comp-bubble-en">' + esc(en) + '</div>';
    html += '<div class="rk-comp-tap">tap to continue</div>';
    bubble.innerHTML = html;
    bubble.style.display = 'block';
    positionBubble();

    // Tap ANYWHERE to continue. The lock overlay spans the whole screen (below
    // the sprite/bubble in z-order) and forwards taps to advance(). If an
    // enclosing flow (onboarding / celebration / tour) already locked the
    // screen, let it own the unlock; otherwise this line owns the lock and
    // releases it when dismissed.
    var ownsLock = false;
    if (lockOverlay && lockOverlay.style.display !== 'block') { lockScreen(); ownsLock = true; }

    return new Promise(function (resolve) {
      var done = false;
      var finish = function () {
        if (done) return;
        done = true;
        state.speakResolver = null;
        if (ownsLock) unlockScreen();
        resolve();
      };
      state.speakResolver = finish;
      // Opt-in auto-advance only when explicitly requested.
      if (opts.autoMs > 0) setTimeout(finish, opts.autoMs);
    });
  }

  // ----------------------------------------------------------- yes/no popup
  function ask(question, choices) {
    ensureLayer();
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.className = 'jp-return-overlay';
      var btns = choices.map(function (c, i) {
        var cls = i === 0 ? 'rk-comp-choice-yes' : 'rk-comp-choice-no';
        return '<button class="rk-comp-choice ' + cls + '" data-i="' + i + '">' + esc(c.label) + '</button>';
      }).join('');
      overlay.innerHTML =
        '<div class="jp-return-card">' +
          (question.jp ? '<div class="jp-return-jp">' + esc(question.jp) + '</div>' : '') +
          (question.text ? '<div class="jp-return-text">' + esc(question.text) + '</div>' : '') +
          '<div class="rk-comp-choices">' + btns + '</div>' +
        '</div>';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', function (e) {
        var b = e.target.closest('.rk-comp-choice');
        if (!b) return;
        var idx = parseInt(b.getAttribute('data-i'), 10);
        overlay.remove();
        resolve(choices[idx].value);
      });
    });
  }

  // ------------------------------------------------------------- messages
  function messages() { return window.JPShared._rikizo_messages || null; }
  function loadMessages() {
    if (messages()) return Promise.resolve(messages());
    var url = assetUrl('data/shared/rikizo-messages.json') + '?t=' + Date.now();
    return fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      window.JPShared._rikizo_messages = d; return d;
    }).catch(function () { return null; });
  }
  function pick(arr) {
    if (!arr || !arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function timeBracket() {
    var h = new Date().getHours();
    if (h < 5) return 'night';
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    if (h < 22) return 'evening';
    return 'night';
  }

  // ---------------------------------------------------- tour step primitive
  // Scroll element into view → spotlight it → move Rikizo near it → speak.
  // The spotlight stays visible (so the previous element stays highlighted
  // until the next step replaces it); call clearHighlight() at the end.
  // opts.scope = CSS selector for the screen the tour belongs to. If that
  // element is gone (user navigated away mid-tour), bail. Default = '.rk-home'
  // so the home onboarding keeps its original safety; Dojo passes '#k-view-menu'.
  function tourStep(sel, line, opts) {
    opts = opts || {};
    var scopeSel = opts.scope || '.rk-home';
    if (!document.querySelector(scopeSel)) return Promise.resolve();
    var el = document.querySelector(sel);
    if (!el) return Promise.resolve(); // missing / locked — skip silently

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return waitForScrollSettle(el).then(function () {
      highlight(el);
      return wait(120);
    }).then(function () {
      var lr = layer.getBoundingClientRect();
      var r  = el.getBoundingClientRect();
      var spriteX = clamp(
        (r.left + r.width / 2) - lr.left - SPR_W / 2,
        6, layerWidth() - SPR_W - 6
      );
      // Top-strip elements (bell/gear): Rikizo moves up to stand below them.
      // Everything else: stay at rest above the tabbar.
      var spriteY = (r.bottom - lr.top < layerHeight() * 0.30)
        ? clamp(r.bottom - lr.top + 16, 8, layerHeight() - SPR_H - 8)
        : restY();
      return moveTo(spriteX, spriteY, { duration: 750 });
    }).then(function () {
      state.facing = 'down'; idle();
      return speak(line);
    });
  }

  // ------------------------------------------------------------ onboarding
  function isOnboarded() { return localStorage.getItem(ONBOARD_KEY) === '1'; }
  function markOnboarded() { try { localStorage.setItem(ONBOARD_KEY, '1'); } catch (e) {} }

  // "Skip tutorials" master switch (Settings → Tutorials). When on, the
  // onboarding tour and every contextual tutorial step no-op. Daily greetings
  // and lesson-complete celebrations are NOT tutorials and are unaffected.
  function tutorialsSkipped() {
    try { return localStorage.getItem(SKIP_TUT_KEY) === '1'; } catch (e) { return false; }
  }
  function setTutorialsSkipped(skip) {
    try { localStorage.setItem(SKIP_TUT_KEY, skip ? '1' : '0'); } catch (e) {}
  }

  // The Settings panel (.jp-set-overlay) lives at z-index 9999 — above our
  // sprite/bubble (60), spotlight (58) and lock (57). When we want to spotlight
  // toggles INSIDE the open panel, temporarily lift our layers above it; clear
  // the inline z-index afterwards to fall back to the stylesheet values.
  function _liftAboveSettings(on) {
    if (!lockOverlay || !spotlight || !layer) return;
    lockOverlay.style.zIndex = on ? '10000' : '';
    spotlight.style.zIndex   = on ? '10001' : '';
    layer.style.zIndex       = on ? '10002' : '';
  }

  // Open the Settings panel, loading it lazily if needed (it's a deferred
  // module not present during first-launch onboarding). Resolves true once the
  // overlay is in the DOM, false if Settings is unavailable.
  function _ensureSettingsOpen() {
    return new Promise(function (resolve) {
      var afterOpen = function () {
        var tries = 0;
        (function poll() {
          if (document.querySelector('.jp-set-overlay')) return resolve(true);
          if (tries++ > 40) return resolve(false); // ~2s ceiling
          setTimeout(poll, 50);
        })();
      };
      var s = window.JPShared && window.JPShared.ttsSettings;
      if (s && s.open) { Promise.resolve(s.open()).then(afterOpen, afterOpen); return; }
      // Fall back to JPApp's lazy loader (pulls in tts/stamp deps, then opens).
      if (window.JPApp && window.JPApp.openTtsSettings) {
        Promise.resolve(window.JPApp.openTtsSettings()).then(afterOpen, afterOpen);
        return;
      }
      resolve(false);
    });
  }

  // NO-branch of onboarding: open Settings and walk the user through the three
  // reading aids (furigana, romaji, kana practice). Spotlights the visible
  // toggle rows (the <input>s themselves are 0×0). Always restores z + closes.
  function _runSettingsHelp() {
    var msgs = messages();
    var ob = (msgs && msgs.onboarding) || {};
    var txt = function (k, fallback) { var m = ob[k]; return (m && m.text) || fallback; };
    var SCOPE = '.jp-set-overlay';
    var restore = function () {
      clearHighlight();
      _liftAboveSettings(false);
      var s = window.JPShared && window.JPShared.ttsSettings;
      if (s && s.close && (!s.isOpen || s.isOpen())) { try { s.close(); } catch (e) {} }
    };
    return _ensureSettingsOpen().then(function (opened) {
      if (!opened) return;
      _liftAboveSettings(true);
      return wait(400).then(function () {
        return tourStep('label[for="jp-set-furigana"]',
          txt('settingsFurigana', 'Furigana shows tiny hiragana above each kanji.'), { scope: SCOPE });
      }).then(function () {
        return tourStep('label[for="jp-set-romaji"]',
          txt('settingsRomaji', 'Romaji spells the Japanese out in the Latin alphabet.'), { scope: SCOPE });
      }).then(function () {
        return tourStep('label[for="jp-set-kana-writing"]',
          txt('settingsKana', 'Kana Writing Practice drills hiragana & katakana, stroke by stroke.'), { scope: SCOPE });
      }).then(restore);
    }).catch(restore);
  }

  // ----------------------------------------------- first-open Settings tour
  // Settings has grown into many sections; the first time the panel is opened
  // (fired by tts-settings open()), Rikizo walks through each one. Gated by a
  // seen-key + the global skip-tutorials switch. The panel is already open and
  // sits at z-9999, so we lift our layers above it (as _runSettingsHelp does)
  // and lock the screen so taps step the tour forward. Leaves Settings open.
  var SETTINGS_TUT_SEEN_KEY = 'k-rikizo-settings-tutorial-seen';
  function settingsTutorialSeen() {
    try { return localStorage.getItem(SETTINGS_TUT_SEEN_KEY) === '1'; } catch (e) { return false; }
  }
  function resetSettingsTutorial() {
    try { localStorage.removeItem(SETTINGS_TUT_SEEN_KEY); } catch (e) {}
    _tutorialSeq++;
  }

  function runSettingsTutorial() {
    var SCOPE = '.jp-set-overlay';
    if (state.busy || tutorialsSkipped() || settingsTutorialSeen()) return Promise.resolve();
    if (!document.querySelector(SCOPE)) return Promise.resolve();
    // Mark seen up front so an abort mid-tour (panel closed) still records it.
    try { localStorage.setItem(SETTINGS_TUT_SEEN_KEY, '1'); } catch (e) {}
    var mySeq = ++_tutorialSeq;
    var current = function () { return mySeq === _tutorialSeq; };
    ensureLayer(); clearBubble(); cancelLoop();

    var restore = function () {
      clearBubble(); clearHighlight();
      _liftAboveSettings(false);
      unlockScreen();
      if (current()) state.busy = false;
      applyPresence();
    };

    return loadMessages().then(function (data) {
      if (!current() || !document.querySelector(SCOPE)) { restore(); return; }
      var st = (data && data.settingsTutorial) || {};
      var txt = function (k, fb) { var m = st[k]; return (m && m.text) || fb; };

      // [messageKey, targetSelector] — null target = Rikizo speaks from center
      // (intro walks in; outro steps back to center).
      var steps = [
        { msg: 'intro',     sel: null, walkIn: true },
        { msg: 'profile',   sel: '[data-tour-set="profile"]' },
        { msg: 'account',   sel: '#jp-set-account-field' },
        { msg: 'companion', sel: '[data-tour-set="companion"]' },
        { msg: 'tutorials', sel: '[data-tour-set="tutorials"]' },
        { msg: 'voice',     sel: '[data-tour-set="voice"]' },
        { msg: 'sound',     sel: '[data-tour-set="sound"]' },
        { msg: 'aids',      sel: '[data-tour-set="aids"]' },
        { msg: 'helpers',   sel: '[data-tour-set="helpers"]' },
        { msg: 'upgrades',  sel: '[data-tour-set="upgrades"]' },
        { msg: 'about',     sel: '[data-tour-set="about"]' },
        { msg: 'outro',     sel: null }
      ];

      state.busy = true;
      lockScreen();
      _liftAboveSettings(true);

      var chain = wait(220);
      steps.forEach(function (step) {
        chain = chain.then(function () {
          if (!current() || !document.querySelector(SCOPE)) return;
          var line = txt(step.msg, '');
          if (!line) return;
          if (step.sel) {
            return tourStep(step.sel, line, { scope: SCOPE });
          }
          clearHighlight();
          if (step.walkIn) {
            place(offscreenLeft(), restY()); show();
            return walkTo(centerX(), { speed: 160 }).then(function () {
              if (!current()) return;
              state.facing = 'down'; idle();
              return speak(line);
            });
          }
          return moveTo(centerX(), restY(), { duration: 600 }).then(function () {
            if (!current()) return;
            state.facing = 'down'; idle();
            return speak(line);
          });
        });
      });
      return chain.then(restore, restore);
    }).catch(restore);
  }

  function runOnboarding() {
    if (state.onboarding) return Promise.resolve();
    // Skipped: mark onboarded so the first-launch gate stops firing, then bail.
    if (tutorialsSkipped()) { markOnboarded(); return Promise.resolve(); }
    state.onboarding = true;
    state.busy = true;
    ensureLayer();
    lockScreen();
    var ob = null;
    var understood = false;

    return loadMessages().then(function (data) {
      ob = (data && data.onboarding) || {};
      state.y = restY();
      place(offscreenLeft(), restY());
      show();
      return walkTo(centerX(), { speed: 150 });
    }).then(function () {
      state.facing = 'down'; idle();
      // Two Japanese-only lines — the "starting test" the user asked us to keep.
      return speak('', { jp: (ob.greeting && ob.greeting.jp) || 'はじめまして！' });
    }).then(function () {
      return speak('', { jp: (ob.intro && ob.intro.jp) || 'いっしょににほんごをべんきょうしよう！' });
    }).then(function () {
      clearBubble();
      // Japanese-only comprehension question — no English subtitle.
      var q = { jp: (ob.comprehendQ && ob.comprehendQ.jp) || 'わかる？' };
      return ask(q, [{ label: 'はい', value: true }, { label: 'いいえ', value: false }]);
    }).then(function (ans) {
      understood = !!ans;
      var line = understood ? (ob.praiseYes && ob.praiseYes.text) : (ob.praiseNo && ob.praiseNo.text);
      return speak(line);
    }).then(function () {
      return speak((ob.getSetUp && ob.getSetUp.text) || "Let's get you set up.");
    }).then(function () {
      return tourStep('[data-tour="notify"]',   ob.tourNotify   && ob.tourNotify.text);
    }).then(function () {
      // Settings step branches on the comprehension answer:
      //  - understood → just point out the gear and mention help is in there.
      //  - didn't     → open Settings and walk through the reading aids.
      if (understood) {
        return tourStep('[data-tour="settings"]', ob.tourSettingsYes && ob.tourSettingsYes.text);
      }
      return tourStep('[data-tour="settings"]', ob.tourSettingsNo && ob.tourSettingsNo.text)
        .then(_runSettingsHelp);
    }).then(function () {
      return tourStep('[data-tour="streak"]',   ob.tourStreak   && ob.tourStreak.text);
    }).then(function () {
      // Next Up — what to tackle next (grammar / lesson / review).
      return tourStep('[data-tour="lesson"]',   ob.tourNextUp   && ob.tourNextUp.text);
    }).then(function () {
      // All practice modules — more unlock as lessons/reviews are cleared at 60%+.
      return tourStep('[data-tour="modules"]',  ob.tourModules  && ob.tourModules.text);
    }).then(function () {
      // Progress bars.
      return tourStep('[data-tour="progress"]', ob.tourProgress && ob.tourProgress.text);
    }).then(function () {
      // Cast — unlocks as you meet friends & family in the adventure.
      return tourStep('[data-tour="cast"]',     ob.tourCast     && ob.tourCast.text);
    }).then(function () {
      // Daily challenge.
      return tourStep('[data-tour="daily"]',    ob.tourDaily    && ob.tourDaily.text);
    }).then(function () {
      // Bottom navigation bar.
      return tourStep('[data-tour="nav"]',      ob.tourNav      && ob.tourNav.text);
    }).then(function () {
      // "Phew — that was a lot." Drop the spotlight and step back to center.
      clearHighlight();
      return moveTo(centerX(), restY(), { duration: 700 });
    }).then(function () {
      state.facing = 'down'; idle();
      return speak((ob.tourPhew && ob.tourPhew.text) || 'Phew — that was a lot! 😅');
    }).then(function () {
      // Back to Next Up for the call to action.
      return tourStep('[data-tour="lesson"]',   (ob.tourDone && ob.tourDone.text) || "Let's do your first lesson!");
    }).then(finishOnboarding, finishOnboarding);
  }

  function finishOnboarding() {
    markOnboarded();
    clearBubble();
    clearHighlight();
    unlockScreen();
    state.onboarding = false;
    state.busy = false;
    applyPresence();
  }

  // Build the "what's next" hint Rikizo says at the end of a celebration.
  // Walks the manifest's lessons + grammars in chain order and surfaces the
  // FIRST item the user can do next:
  //   - prefer a grammar (G1, G2, …) so the natural chain shows up after a lesson;
  //   - else a lesson (N5.2, …);
  //   - if everything available is done, surface the next locked item + its gate
  //     (including the special "Pass N5.1 first" case via `extraRequirePass`).
  // Reads localStorage + window.JPApp._manifest directly so it works whether or
  // not JPShared.unlock has been lazy-loaded.
  function _nextUnlockHint() {
    var manifest = window.JPApp && window.JPApp._manifest;
    if (!manifest || !manifest.data) return null;

    var completed = {}, scores = {};
    try { completed = JSON.parse(localStorage.getItem('k-lesson-completed') || '{}'); } catch (e) {}
    try { scores    = JSON.parse(localStorage.getItem('k-lesson-scores')    || '{}'); } catch (e) {}
    var done = function (id) { return !!completed[id]; };
    var pass = function (id) { return (scores[id] || 0) >= 60; };

    // Grammar prereqs are any-completion regardless of prereq type.
    function grammarUnlocked(g) {
      return !g.unlocksAfter || done(g.unlocksAfter);
    }
    // Lesson prereqs are pass-based for lesson ids; any-completion for
    // grammar ids (matches unlock.js _prereqMet semantics). PLUS the optional
    // `extraRequirePass` rule (e.g. N5.2 needs N5.1 passed even if G3 is done).
    function lessonUnlocked(l) {
      if (l.extraRequirePass && !pass(l.extraRequirePass)) return false;
      if (!l.unlocksAfter) return true;
      if (/^G\d+$/.test(l.unlocksAfter)) return done(l.unlocksAfter);
      return pass(l.unlocksAfter);
    }

    var n4Unlocked = false;
    try { n4Unlocked = localStorage.getItem('k-n4-unlocked') === 'true'; } catch (e) {}

    var levels = manifest.levels || [];
    // First pass — find an UNLOCKED-BUT-NOT-DONE item, grammar first.
    for (var li = 0; li < levels.length; li++) {
      var lvl = levels[li];
      // N4 sits behind an explicit gateway (matches unlock.js). If the user
      // hasn't unlocked N4 yet, skip the whole level so its entries don't
      // leak through as "up next" simply because they have no unlocksAfter.
      if (lvl === 'N4' && !n4Unlocked) continue;
      var ld = manifest.data[lvl];
      if (!ld) continue;
      var grammars = ld.grammar || [];
      for (var i = 0; i < grammars.length; i++) {
        var g = grammars[i];
        if (grammarUnlocked(g) && !done(g.id)) {
          return 'Up next in Grammar: ' + (g.title || g.id) + '.';
        }
      }
      var lessons = ld.lessons || [];
      for (var j = 0; j < lessons.length; j++) {
        var l = lessons[j];
        if (lessonUnlocked(l) && !done(l.id)) {
          return 'Up next: ' + _lessonHeader(l) + ' — ' + (l.title || l.id) + '.';
        }
      }
    }
    // Everything available is done — point at the next LOCKED item + its gate.
    // Prefer lessons over grammars in this fallback because the main
    // progression path is lesson → lesson, and the call-out is more actionable
    // (e.g. "Pass Lesson 1 to unlock Lesson 2" beats "Finish N5.2 to unlock G4").
    for (var li2 = 0; li2 < levels.length; li2++) {
      var lvl2 = levels[li2];
      if (lvl2 === 'N4' && !n4Unlocked) continue;
      var ld2 = manifest.data[lvl2];
      if (!ld2) continue;
      var lessons2 = ld2.lessons || [];
      for (var j2 = 0; j2 < lessons2.length; j2++) {
        var l2 = lessons2[j2];
        if (!lessonUnlocked(l2)) {
          var who = _lessonHeader(l2);
          // Special "extraRequirePass" gate — surface that as the blocker.
          if (l2.extraRequirePass && !pass(l2.extraRequirePass)) {
            return 'Pass ' + _lessonHeader({ id: l2.extraRequirePass }) +
                   ' (60% or higher) to unlock ' + who + '.';
          }
          var pre = l2.unlocksAfter;
          var gate = /^G\d+$/.test(pre) ? 'Finish ' + pre : 'Pass ' + _lessonHeader({ id: pre }) + ' (60%+)';
          return gate + ' to unlock ' + who + '.';
        }
      }
      var grammars2 = ld2.grammar || [];
      for (var i2 = 0; i2 < grammars2.length; i2++) {
        var g2 = grammars2[i2];
        if (!grammarUnlocked(g2)) {
          return 'Finish ' + g2.unlocksAfter + ' to unlock ' + (g2.title || g2.id) + '.';
        }
      }
    }
    return null;
  }
  // "N5.1" → "Lesson 1" (level-relative). Falls back to the raw id otherwise.
  function _lessonHeader(entry) {
    var m = /^N\d+\.(\d+)$/.exec(entry.id || '');
    return m ? ('Lesson ' + m[1]) : (entry.id || '');
  }
  function _joinList(arr) {
    if (!arr.length) return '';
    if (arr.length === 1) return arr[0];
    if (arr.length === 2) return arr[0] + ' and ' + arr[1];
    return arr.slice(0, -1).join(', ') + ', and ' + arr[arr.length - 1];
  }

  // ---------------------------------------------- celebration dispatcher
  // Triggered by index.html `_rikizoGreet` when a pending-celebration key is
  // present on the next home render. Two sources today:
  //
  //   - source: 'lesson' — payload { lessonId, lessonTitle, score, passed, newItems }
  //     Walks the user through any newly unlocked modules on the home grid,
  //     opens with a congrats or encouragement, and (on fail) nudges to retry.
  //
  //   - source: 'dojo'   — payload { best, prevBest }
  //     Short congrats for a new personal-best streak (≥10) in the Dojo.
  //
  // The function name is kept for backwards-compat — index.html's dispatcher
  // calls it for any pending celebration regardless of source.
  function runLessonCompleteCelebration(payload) {
    if (state.busy || !payload) return Promise.resolve();
    state.busy = true;
    ensureLayer();
    if (payload.source === 'dojo') return _runDojoCelebration(payload);
    return _runLessonCelebration(payload);
  }

  function _runDojoCelebration(payload) {
    return loadMessages().then(function (data) {
      if (!data) { state.busy = false; return; }
      var pool = data.dojoHighScore || [];
      var line = pick(pool) || { text: 'Nice run in the Dojo!' };
      var text = String(line.text || '').replace('{BEST}', String(payload.best || ''));
      place(offscreenLeft(), restY());
      show();
      return walkTo(centerX(), { speed: 160 }).then(function () {
        state.facing = 'down'; idle();
        return speak(text);
      }).then(function () {
        clearBubble();
        state.busy = false;
        applyPresence();
      });
    }).catch(function () { state.busy = false; });
  }

  function _runLessonCelebration(payload) {
    return loadMessages().then(function (data) {
      if (!data) { state.busy = false; return; }
      var lc   = data.lessonComplete || {};
      var mods = data.moduleDescriptions || {};

      // Opening line — congrats vs encouragement, with {LESSON} interpolation.
      var pool = payload.passed ? (lc.passedOpening || []) : (lc.failedOpening || []);
      var opening = pick(pool) || { text: payload.passed ? 'Nice work!' : 'Good effort!' };
      var openingText = String(opening.text || '').replace('{LESSON}', payload.lessonTitle || 'that lesson');

      // Only modules show up on the Home grid; lessons/grammar items/etc. are
      // shown in their own modules. So the on-home tour focuses on modules.
      var newMods = (payload.newItems || []).filter(function (it) { return it.type === 'module'; });

      place(offscreenLeft(), restY());
      show();
      var chain = walkTo(centerX(), { speed: 160 }).then(function () {
        state.facing = 'down'; idle();
        return speak(openingText);
      });

      if (newMods.length) {
        chain = chain.then(function () {
          return speak((lc.unlockIntro && lc.unlockIntro.text) || 'And look — you unlocked some new things!');
        });
        newMods.forEach(function (mod) {
          chain = chain.then(function () {
            // Skip silently if the home isn't rendered (user navigated away).
            if (!onHomeScreen()) return;
            var desc = (mods[mod.id] && mods[mod.id].text) || ((mod.label || mod.id) + ' is now unlocked.');
            return tourStep('[data-mod="' + mod.id + '"]', desc);
          });
        });
        if (payload.passed) {
          chain = chain.then(function () {
            clearHighlight();
            var closing = lc.passedClosing && lc.passedClosing.text;
            if (closing) return speak(closing);
          });
        }
      } else if (payload.passed) {
        // Passed but nothing new opened up (mid-progression). Soft reassurance.
        chain = chain.then(function () {
          return speak((lc.noUnlocksPassed && lc.noUnlocksPassed.text) || 'Keep going — more unlocks ahead!');
        });
      }

      if (!payload.passed) {
        // Failed path: practice + try again. (Per the lock cycle, Grammar and
        // Dojo unlock on any completion, so this lands right after they appear.)
        chain = chain.then(function () {
          return speak((lc.tryAgainPrompt && lc.tryAgainPrompt.text) || 'Practice a bit, then try the lesson again — you\'ve got this.');
        });
      }

      // "What's next to unlock?" — survey still-locked modules and tell the
      // user which lesson opens them. Skipped if everything is already visible.
      chain = chain.then(function () {
        var hint = _nextUnlockHint();
        if (hint) return speak(hint);
      });

      return chain.then(function () {
        clearBubble(); clearHighlight();
        state.busy = false;
        applyPresence();
      });
    }).catch(function () { state.busy = false; });
  }

  // ------------------------------------------------ in-lesson tutorial
  // For N5.1 first-time only: Rikizo follows the user into the lesson and
  // explains each section type once. Lesson.js fires `runLessonTutorialStep`
  // on every section render with the resolved tutorial key (sec.tutorialKey
  // OR sec.type). `resetLessonTutorial` clears the per-run "seen" set so a
  // fresh run after exit-and-resume re-introduces sections from the start.
  // Tutorial memory is PER-SECTION and PERSISTED, so an exit mid-tutorial
  // resumes on re-entry: already-seen sections stay silent, unseen ones still
  // fire when the user reaches them. Each tutorial key only ever fires once
  // across all sessions.
  var TUT_SEEN_KEY        = 'k-rikizo-lesson-tutorial-seen';
  var TUT_LEGACY_DONE_KEY = 'k-rikizo-lesson-tutorial-done';
  // Used to migrate users who already had the legacy "done" flag set so they
  // don't re-see anything they previously sealed off.
  var N5_1_TUTORIAL_KEYS = [
    'intro', 'warmup', 'kanjiGrid', 'vocabList', 'vocabListAssumed',
    'conversation', 'reading', 'drillsKanji', 'drillsVocab', 'drillsSentence'
  ];
  var _tutorialSeq = 0;

  function _loadTutorialSeen() {
    try {
      var raw = localStorage.getItem(TUT_SEEN_KEY);
      if (raw) return JSON.parse(raw) || {};
    } catch (e) {}
    // Legacy migration: previous version stored a single done flag. Seed the
    // seen set with every known N5.1 tutorial key so it stays silent.
    if (localStorage.getItem(TUT_LEGACY_DONE_KEY) === '1') {
      var seeded = {};
      N5_1_TUTORIAL_KEYS.forEach(function (k) { seeded[k] = true; });
      _saveTutorialSeen(seeded);
      try { localStorage.removeItem(TUT_LEGACY_DONE_KEY); } catch (e) {}
      return seeded;
    }
    return {};
  }
  function _saveTutorialSeen(seen) {
    try { localStorage.setItem(TUT_SEEN_KEY, JSON.stringify(seen)); } catch (e) {}
  }

  function resetLessonTutorial() {
    try { localStorage.removeItem(TUT_SEEN_KEY); } catch (e) {}
    try { localStorage.removeItem(TUT_LEGACY_DONE_KEY); } catch (e) {}
    _tutorialSeq++;
  }

  // Wipe runtime state (bubble, sprite, busy flag, in-flight chains) without
  // touching persisted memory. Called by Lesson.js's loadLesson so a stale
  // bubble from an unresolved tap (the user exited mid-tutorial without
  // tapping through) doesn't carry over into the next lesson view.
  function resetRuntime() {
    _tutorialSeq++;                    // invalidate any in-flight chains
    state.speakResolver = null;
    state.busy = false;
    state.onboarding = false;
    cancelLoop();
    clearBubble();
    clearHighlight();
    unlockScreen();
    if (sprite) sprite.style.display = 'none';
  }

  function runLessonTutorialStep(tutorialKey) {
    if (!tutorialKey || tutorialsSkipped()) return Promise.resolve();
    var seen = _loadTutorialSeen();
    if (seen[tutorialKey]) return Promise.resolve();
    seen[tutorialKey] = true;
    _saveTutorialSeen(seen);
    // Sequence token — if the user advances faster than a tutorial can finish,
    // the stale chain's remaining speak/cleanup handlers no-op so they don't
    // clobber the next tutorial's bubble or reset busy mid-flight.
    var mySeq = ++_tutorialSeq;
    var current = function () { return mySeq === _tutorialSeq; };
    ensureLayer();
    clearBubble();
    cancelLoop();
    return loadMessages().then(function (data) {
      if (!current()) return;
      var lt = (data && data.lessonTutorial) || {};
      var lines = lt[tutorialKey];
      if (!lines || !lines.length) return;
      state.busy = true;
      lockScreen();
      // Position just above the lesson's footer so the Back/Next buttons stay
      // tappable. Measure the footer at fire time — its height can vary.
      var footer = document.querySelector('.lh-footer');
      var footerH = footer ? footer.offsetHeight : 80;
      var spY = Math.max(8, layerHeight() - SPR_H - footerH - 12);
      var spX = Math.round(layerWidth() * 0.18);
      place(offscreenLeft(), spY);
      show();
      var chain = moveTo(spX, spY, { speed: 220 }).then(function () {
        if (!current()) return;
        state.facing = 'down'; idle();
      });
      lines.forEach(function (line) {
        chain = chain.then(function () {
          if (!current()) return;
          return speak(line && line.text);
        });
      });
      return chain.then(function () {
        if (!current()) return;
        clearBubble();
        hide();
        state.busy = false;
      });
    }).catch(function () { unlockScreen(); if (current()) state.busy = false; });
  }

  // -------------------------------------------- in-grammar tutorial (G1 only)
  // Parallels the in-lesson tutorial but with its own seen-set so the two
  // never collide. Grammar.js fires this on each section render with
  // sec.tutorialKey || sec.type, and once more with 'complete' on the
  // completion screen.
  var GRAMMAR_TUT_SEEN_KEY = 'k-rikizo-grammar-tutorial-seen';

  function _loadGrammarTutorialSeen() {
    try {
      var raw = localStorage.getItem(GRAMMAR_TUT_SEEN_KEY);
      if (raw) return JSON.parse(raw) || {};
    } catch (e) {}
    return {};
  }
  function _saveGrammarTutorialSeen(seen) {
    try { localStorage.setItem(GRAMMAR_TUT_SEEN_KEY, JSON.stringify(seen)); } catch (e) {}
  }
  function resetGrammarTutorial() {
    try { localStorage.removeItem(GRAMMAR_TUT_SEEN_KEY); } catch (e) {}
    _tutorialSeq++;
  }

  function runGrammarTutorialStep(tutorialKey) {
    if (!tutorialKey || tutorialsSkipped()) return Promise.resolve();
    var seen = _loadGrammarTutorialSeen();
    if (seen[tutorialKey]) return Promise.resolve();
    seen[tutorialKey] = true;
    _saveGrammarTutorialSeen(seen);
    var mySeq = ++_tutorialSeq;
    var current = function () { return mySeq === _tutorialSeq; };
    ensureLayer(); clearBubble(); cancelLoop();
    return loadMessages().then(function (data) {
      if (!current()) return;
      var gt = (data && data.grammarTutorial) || {};
      var lines = gt[tutorialKey];
      if (!lines || !lines.length) return;
      state.busy = true;
      lockScreen();
      // Grammar's footer class is .gr-footer (lessons use .lh-footer).
      var footer = document.querySelector('.gr-footer');
      var footerH = footer ? footer.offsetHeight : 80;
      var spY = Math.max(8, layerHeight() - SPR_H - footerH - 12);
      var spX = Math.round(layerWidth() * 0.18);
      place(offscreenLeft(), spY);
      show();
      var chain = moveTo(spX, spY, { speed: 220 }).then(function () {
        if (!current()) return;
        state.facing = 'down'; idle();
      });
      lines.forEach(function (line) {
        chain = chain.then(function () {
          if (!current()) return;
          return speak(line && line.text);
        });
      });
      return chain.then(function () {
        if (!current()) return;
        clearBubble(); hide();
        state.busy = false;
      });
    }).catch(function () { unlockScreen(); if (current()) state.busy = false; });
  }

  // --------------------------------------------------- in-dojo tutorial
  // Mirrors the grammar/lesson tutorials but walks Rikizo through the Dojo
  // menu (one bubble per section). Uses tourStep with scope='#k-view-menu'
  // so it bails if the user navigates away mid-tour. Variant lookup for
  // verbPractice: speaks "Unlocked" copy when G1 is already done.
  var DOJO_TUT_SEEN_KEY = 'k-rikizo-dojo-tutorial-seen';

  function _loadDojoTutorialSeen() {
    try {
      var raw = localStorage.getItem(DOJO_TUT_SEEN_KEY);
      if (raw) return JSON.parse(raw) || {};
    } catch (e) {}
    return {};
  }
  function _saveDojoTutorialSeen(seen) {
    try { localStorage.setItem(DOJO_TUT_SEEN_KEY, JSON.stringify(seen)); } catch (e) {}
  }
  function resetDojoTutorial() {
    try { localStorage.removeItem(DOJO_TUT_SEEN_KEY); } catch (e) {}
    _tutorialSeq++;
  }

  function runDojoTutorial() {
    if (state.busy || tutorialsSkipped()) return Promise.resolve();
    ensureLayer(); clearBubble(); cancelLoop();
    var mySeq = ++_tutorialSeq;
    var current = function () { return mySeq === _tutorialSeq; };

    var seen = _loadDojoTutorialSeen();
    var stepOrder = ['intro','stats','kanjiPractice','vocabPractice','writingPractice','audioPractice','games','flagged'];
    if (stepOrder.every(function (k) { return seen[k]; })) return Promise.resolve();

    return loadMessages().then(function (data) {
      if (!current()) return;
      var dt = (data && data.dojoTutorial) || {};

      // [seenKey, messageKey, targetSelector] per step. null target = no spotlight,
      // Rikizo just walks to center and speaks (used for the "intro" step).
      // Mirrors the Dojo's current tiles: Kanji, Vocab (incl. Conjugation Station),
      // Writing, Audio, Games (Scramble + Link Up), and Flags.
      var steps = [
        { seen: 'intro',           msg: 'intro',           sel: null },
        { seen: 'stats',           msg: 'stats',           sel: '[data-tour-dojo="stats"]' },
        { seen: 'kanjiPractice',   msg: 'kanjiPractice',   sel: '[data-tour-dojo="kanjiPractice"]' },
        { seen: 'vocabPractice',   msg: 'vocabPractice',   sel: '[data-tour-dojo="vocabPractice"]' },
        { seen: 'writingPractice', msg: 'writingPractice', sel: '[data-tour-dojo="writingPractice"]' },
        { seen: 'audioPractice',   msg: 'audioPractice',   sel: '[data-tour-dojo="audioPractice"]' },
        { seen: 'games',           msg: 'games',           sel: '[data-tour-dojo="games"]' },
        { seen: 'flagged',         msg: 'flagged',         sel: '[data-tour-dojo="flagged"]' }
      ];

      state.busy = true;
      lockScreen();
      var chain = Promise.resolve();
      steps.forEach(function (step) {
        chain = chain.then(function () {
          if (!current()) return;
          if (seen[step.seen]) return;
          // Bail if user has left the Dojo menu (e.g. tapped a tab).
          if (!document.querySelector('#k-view-menu')) return;
          var lines = dt[step.msg];
          if (!lines || !lines.length) return;
          seen[step.seen] = true;
          _saveDojoTutorialSeen(seen);
          if (step.sel) {
            return tourStep(step.sel, lines[0].text, { scope: '#k-view-menu' });
          }
          // No target — walk Rikizo in and speak from rest.
          place(offscreenLeft(), restY());
          show();
          return walkTo(centerX(), { speed: 160 }).then(function () {
            if (!current()) return;
            state.facing = 'down'; idle();
            return speak(lines[0].text);
          });
        });
      });
      return chain.then(function () {
        if (!current()) return;
        clearBubble(); clearHighlight(); hide();
        state.busy = false;
      });
    }).catch(function () { unlockScreen(); if (current()) state.busy = false; });
  }

  // -------------------------------------------- in-compose tutorial (12 step)
  // Compose's flow has 3 distinct screens (level picker, lesson menu, in-
  // composition), so the orchestration is done by the caller — each step is
  // an independent function call that no-ops when its seenKey is already
  // marked. Compose.js sequences them through its showMenu / _showLevel /
  // startCompose hooks. opts.target = optional selector to spotlight; falls
  // back to a center-of-screen speak when omitted.
  var COMPOSE_TUT_SEEN_KEY = 'k-rikizo-compose-tutorial-seen';

  function _loadComposeTutorialSeen() {
    try {
      var raw = localStorage.getItem(COMPOSE_TUT_SEEN_KEY);
      if (raw) return JSON.parse(raw) || {};
    } catch (e) {}
    return {};
  }
  function _saveComposeTutorialSeen(seen) {
    try { localStorage.setItem(COMPOSE_TUT_SEEN_KEY, JSON.stringify(seen)); } catch (e) {}
  }
  function resetComposeTutorial() {
    try { localStorage.removeItem(COMPOSE_TUT_SEEN_KEY); } catch (e) {}
    _tutorialSeq++;
  }

  function runComposeTutorialStep(seenKey, opts) {
    opts = opts || {};
    if (!seenKey || tutorialsSkipped()) return Promise.resolve();
    var seen = _loadComposeTutorialSeen();
    if (seen[seenKey]) return Promise.resolve();
    var mySeq = ++_tutorialSeq;
    var current = function () { return mySeq === _tutorialSeq; };
    ensureLayer(); clearBubble(); cancelLoop();
    return loadMessages().then(function (data) {
      if (!current()) return;
      var ct = (data && data.composeTutorial) || {};
      var lines = ct[opts.messageKey || seenKey];
      if (!lines || !lines.length) return;
      // Mark seen now so an abort mid-chain still records the step as seen
      // (matches lesson/grammar tutorial behavior).
      seen[seenKey] = true;
      _saveComposeTutorialSeen(seen);
      state.busy = true;
      lockScreen();

      // Optional pre-step hook (e.g. type into a textarea before bubbles fire).
      var preChain = Promise.resolve();
      if (typeof opts.before === 'function') {
        try { preChain = Promise.resolve(opts.before()); } catch (e) { preChain = Promise.resolve(); }
      }

      var positionStep = preChain.then(function () { return opts.target
        ? tourStep(opts.target, lines[0].text, { scope: opts.scope || '#compose-app-root' })
            .then(function () {
              if (!current()) return;
              // tourStep already spoke lines[0] — speak any additional lines.
              var extra = Promise.resolve();
              lines.slice(1).forEach(function (line) {
                extra = extra.then(function () { if (current()) return speak(line && line.text); });
              });
              return extra;
            })
        : (function () {
            place(offscreenLeft(), restY()); show();
            return walkTo(centerX(), { speed: 160 }).then(function () {
              if (!current()) return;
              state.facing = 'down'; idle();
              var chain = Promise.resolve();
              lines.forEach(function (line) {
                chain = chain.then(function () { if (current()) return speak(line && line.text); });
              });
              return chain;
            });
          })(); });

      return positionStep.then(function () {
        if (!current()) return;
        clearBubble(); clearHighlight(); hide();
        state.busy = false;
      });
    }).catch(function () { unlockScreen(); if (current()) state.busy = false; });
  }

  // -------------------------------------------------------- daily greeting
  // English-only output (Japanese is reserved for the onboarding test).
  function greetByTime() {
    if (state.busy) return Promise.resolve();
    state.busy = true;
    ensureLayer();
    return loadMessages().then(function (data) {
      if (!data) { state.busy = false; return; }
      var streak = window.JPShared.streak;
      var s = streak ? streak.getState() : { daysAway: 0, current: 0 };

      var leadText = null;
      if (streak && s.daysAway >= 2) {
        var rm = streak.getReturnMessage(s.daysAway);
        if (rm) leadText = rm.text;
      }
      if (!leadText) {
        var tb = (data.timeBased || {})[timeBracket()];
        var lead = pick(tb);
        leadText = lead ? lead.text : 'Welcome back!';
      }
      var enc = pick(data.encouragement);

      place(offscreenLeft(), restY());
      show();
      return walkTo(centerX(), { speed: 160 }).then(function () {
        state.facing = 'down'; idle();
        return speak(leadText);
      }).then(function () {
        if (enc) return speak(enc.text);
      }).then(function () {
        clearBubble();
        state.busy = false;
        applyPresence();
      });
    }).catch(function () { state.busy = false; });
  }

  // ----------------------------------------------------------- presence
  function getPresence() {
    var v = localStorage.getItem(PRESENCE_KEY);
    return PRESENCE_LEVELS.indexOf(v) >= 0 ? v : 'contextual';
  }
  function setPresence(level) {
    if (PRESENCE_LEVELS.indexOf(level) < 0) return;
    try { localStorage.setItem(PRESENCE_KEY, level); } catch (e) {}
    applyPresence();
  }
  function onHomeScreen() { return !!document.querySelector('.rk-home'); }

  // Show/hide based on the presence level + current screen. Never interrupts
  // an active greeting/onboarding sequence (state.busy / state.onboarding).
  function applyPresence() {
    if (state.busy || state.onboarding) return;
    ensureLayer();
    var level = getPresence();
    var shouldShow =
      level === 'always' ? true :
      level === 'home' ? onHomeScreen() :
      false; // contextual: only visible during greeting/onboarding/tutor
    if (shouldShow) {
      state.y = restY();
      if (state.x < 0 || state.x > layerWidth()) place(centerX(), restY());
      else place(state.x, restY());
      show();
    } else {
      hide();
    }
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---------------------------------------------------------------- init
  function init(config) {
    cfg = config || cfg;
    ensureLayer();
    window.addEventListener('resize', positionBubble);
  }

  window.JPShared.rikizoCompanion = {
    init: init,
    show: show, hide: hide, place: place,
    walkTo: walkTo, moveTo: moveTo, pointAt: pointAt,
    idle: idle, speak: speak, clearBubble: clearBubble, ask: ask,
    highlight: highlight, clearHighlight: clearHighlight, tourStep: tourStep,
    isOnboarded: isOnboarded, markOnboarded: markOnboarded,
    tutorialsSkipped: tutorialsSkipped, setTutorialsSkipped: setTutorialsSkipped,
    runOnboarding: runOnboarding, greetByTime: greetByTime,
    runLessonCompleteCelebration: runLessonCompleteCelebration,
    runLessonTutorialStep: runLessonTutorialStep,
    resetLessonTutorial: resetLessonTutorial,
    runGrammarTutorialStep: runGrammarTutorialStep,
    resetGrammarTutorial: resetGrammarTutorial,
    runDojoTutorial: runDojoTutorial,
    resetDojoTutorial: resetDojoTutorial,
    runComposeTutorialStep: runComposeTutorialStep,
    resetComposeTutorial: resetComposeTutorial,
    runSettingsTutorial: runSettingsTutorial,
    resetSettingsTutorial: resetSettingsTutorial,
    // True while a tutorial/onboarding is mid-run — callers (JPApp.launch) use
    // this to ignore stray taps on highlighted modules so the tour can't break.
    isBusy: function () { return !!(state.busy || state.onboarding); },
    resetRuntime: resetRuntime,
    getPresence: getPresence, setPresence: setPresence, applyPresence: applyPresence,
    PRESENCE_LEVELS: PRESENCE_LEVELS
  };
})();

/**
 * app/shared/select-explain.js
 * 説明 mode — the app-wide "select text → explain" tutor interaction.
 *
 * Tapping the floating Rikizo head (tutor-overlay.js) toggles 説明 mode. While the
 * mode is ON, selecting/highlighting any text — Japanese OR English, on any screen —
 * pops a small 説明 button by the selection. Tapping it sends "explain this" to the
 * tutor backend (typed-text path; NO voice/STT — that's the cost saving) and shows
 * the persistent Rikizo answer bubble, which offers an "Ask a follow-up" affordance.
 *
 * Mode-gating means selections do nothing special outside the mode, so no buttons
 * pop up during normal reading — the head is the switch.
 *
 * Stories are special: native drag-select fights StPageFlip's page-flip gesture and
 * the atomic token layout, so the reader uses TAP-TO-BUILD instead — tap word tokens
 * to accumulate a span (Stories.js branches its token onclick on isPickActive()).
 *
 * Reuses the shared face / bubble / send pipeline exposed by tutor-overlay.js
 * (showBubble, setThinking, requireAuth, progressHint, toast) — no duplicate UI.
 *
 * Self-registers on window.JPShared.selectExplain.
 */

(function () {
  'use strict';

  window.JPShared = window.JPShared || {};
  if (window.JPShared.selectExplain) return; // idempotent

  var FACE_ID = 'rk-tutor-face';
  var MAX_SEL = 400; // don't ship a whole page to the tutor

  var cfg = null;
  var styleInjected = false;
  var listenersAttached = false;
  var modeOn = false;
  var pillEl = null;
  var bannerEl = null;
  var selTimer = null;

  // What the pill will explain when tapped, captured at show time (the live
  // selection may collapse when the pill is pressed).
  var pendingText = '';
  var pendingRect = null;

  // Stories tap-to-build: the set of picked token elements (in DOM order on send).
  var picked = [];

  function S() { return window.JPShared; }
  function overlay() { return S().tutorOverlay; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---------------------------------------------------------------- styles
  function injectStyles() {
    if (styleInjected) return;
    styleInjected = true;
    var css = [
      // 説明 pill — sits above page content (64) but below the ask sheet (71).
      // user-select:none + touch-action so tapping it doesn't extend/clear the
      // selection on iOS.
      '#rk-explain-btn{position:fixed;z-index:64;display:none;align-items:center;gap:6px;',
      '  padding:7px 13px;border-radius:999px;border:none;cursor:pointer;',
      '  background:var(--vermilion,#c8472a);color:#fff;box-shadow:0 4px 14px rgba(0,0,0,0.3);',
      '  font-family:"Schibsted Grotesk","Work Sans",system-ui,sans-serif;font-weight:700;font-size:0.92rem;',
      '  user-select:none;-webkit-user-select:none;touch-action:manipulation;animation:jpFadeIn 0.15s ease;}',
      '#rk-explain-btn .rk-explain-cap{font-size:0.72rem;font-weight:600;opacity:0.85;}',
      // hint banner shown while 説明 mode is on
      '.rk-se-banner{position:fixed;left:50%;transform:translateX(-50%);z-index:64;',
      '  top:calc(8px + env(safe-area-inset-top));max-width:92vw;',
      '  background:#2a2520;color:#f7f4ee;border-radius:999px;padding:7px 15px;',
      '  font-family:system-ui,sans-serif;font-size:0.8rem;font-weight:600;line-height:1.3;',
      '  box-shadow:0 4px 14px rgba(0,0,0,0.28);text-align:center;pointer-events:none;',
      '  animation:jpFadeIn 0.18s ease;}'
    ].join('\n');
    var st = document.createElement('style');
    st.id = 'jp-select-explain-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ---------------------------------------------------------------- pill
  function ensurePill() {
    if (pillEl) return pillEl;
    injectStyles();
    pillEl = document.createElement('button');
    pillEl.id = 'rk-explain-btn';
    pillEl.type = 'button';
    pillEl.innerHTML = '<span class="rk-explain-jp">説明</span>';
    // Use mousedown/touchstart preventDefault so pressing the pill doesn't blur
    // the selection before our click handler reads the cached text.
    pillEl.addEventListener('mousedown', function (e) { e.preventDefault(); });
    pillEl.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var text = pendingText;
      var rect = pendingRect;
      hideButton();
      try { var s = window.getSelection(); if (s) s.removeAllRanges(); } catch (err) {}
      clearPicked();
      explain(text, { anchorRect: rect, source: 'selection' });
    });
    document.body.appendChild(pillEl);
    return pillEl;
  }

  // rect: a viewport-space DOMRect-like { top,left,width,height,bottom }.
  // label: optional caption (e.g. "2 words") shown next to 説明.
  function showButtonAt(rect, text, label) {
    if (!rect || !text) return;
    pendingText = String(text);
    pendingRect = rect;
    ensurePill();
    pillEl.innerHTML = '<span class="rk-explain-jp">説明</span>' +
      (label ? '<span class="rk-explain-cap">' + esc(label) + '</span>' : '');
    pillEl.style.display = 'flex';
    // Measure after display so width is real, then clamp into the viewport.
    var pr = pillEl.getBoundingClientRect();
    var top = rect.top - pr.height - 8;
    if (top < 8) top = rect.bottom + 8;
    var left = rect.left + rect.width / 2 - pr.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - pr.width - 8));
    pillEl.style.top = top + 'px';
    pillEl.style.left = left + 'px';
  }

  function hideButton() {
    if (pillEl) pillEl.style.display = 'none';
  }

  // ---------------------------------------------------------------- mode
  function faceEl() { return document.getElementById(FACE_ID); }

  function showBanner() {
    if (!bannerEl) {
      injectStyles();
      bannerEl = document.createElement('div');
      bannerEl.className = 'rk-se-banner';
      bannerEl.textContent = '説明 mode — select or tap text to explain. Tap Rikizo again to exit.';
      document.body.appendChild(bannerEl);
    }
    bannerEl.style.display = 'block';
  }
  function hideBanner() {
    if (bannerEl) bannerEl.style.display = 'none';
  }

  // Tell the native shell to suppress the OS text-selection menu (iOS callout /
  // Android floating action bar) while 説明 mode is on, so it doesn't cover the
  // 説明 pill. No-ops in a plain browser and on platforms where the bridge isn't
  // wired. Gated on 説明 mode so normal text inputs keep their copy/paste menu.
  // Native side: ios CAPBridgeViewController subclass + android MainActivity
  // onActionModeStarted (see docs/android.md / docs/ios-native.md).
  function setNativeSelectionMenuSuppressed(on) {
    try {
      var a = window.RkSelection;            // Android @JavascriptInterface
      if (a && a.setSuppressed) a.setSuppressed(!!on);
    } catch (e) {}
    try {
      var w = window.webkit && window.webkit.messageHandlers &&
              window.webkit.messageHandlers.rkSelection; // iOS WKScriptMessageHandler
      if (w && w.postMessage) w.postMessage(!!on);
    } catch (e) {}
  }

  function enterMode() {
    if (modeOn) return;
    modeOn = true;
    injectStyles();
    var to = overlay();
    if (to && to.ensureFace) to.ensureFace();
    var f = faceEl();
    if (f) f.classList.add('rk-tutor-mode-on');
    showBanner();
    setNativeSelectionMenuSuppressed(true);
  }

  function exitMode() {
    if (!modeOn) return;
    modeOn = false;
    var f = faceEl();
    if (f) f.classList.remove('rk-tutor-mode-on');
    hideBanner();
    hideButton();
    clearPicked();
    try { var s = window.getSelection(); if (s) s.removeAllRanges(); } catch (e) {}
    setNativeSelectionMenuSuppressed(false);
  }

  function toggleMode() { if (modeOn) exitMode(); else enterMode(); }
  function isModeOn() { return modeOn; }

  // ---------------------------------------------------------------- selection watch
  // Ignore selections inside our own chrome or editable fields.
  function inOwnUi(node) {
    if (!node) return false;
    var el = (node.nodeType === 1) ? node : node.parentElement;
    while (el) {
      var id = el.id;
      if (id === 'rk-explain-btn' || id === 'rk-tutor-bubble' || id === 'rk-tutor-sheet') return true;
      if (el.classList && el.classList.contains('rk-se-banner')) return true;
      var tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable) return true;
      el = el.parentElement;
    }
    return false;
  }

  function checkSelection() {
    if (!modeOn) return;
    var sel;
    try { sel = window.getSelection(); } catch (e) { return; }
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { hideButton(); return; }
    var text = (sel.toString() || '').trim();
    if (!text || text.length > MAX_SEL) { hideButton(); return; }
    if (inOwnUi(sel.anchorNode) || inOwnUi(sel.focusNode)) return;
    var rect;
    try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch (e) { return; }
    if (!rect || (!rect.width && !rect.height)) { hideButton(); return; }
    showButtonAt(rect, text);
  }

  function scheduleCheck() {
    if (!modeOn) return;
    if (selTimer) clearTimeout(selTimer);
    selTimer = setTimeout(checkSelection, 120);
  }

  function attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;
    // selectionchange is the canonical signal on desktop; iOS fires it
    // unreliably, so also watch mouseup/touchend.
    document.addEventListener('selectionchange', scheduleCheck);
    document.addEventListener('mouseup', scheduleCheck);
    document.addEventListener('touchend', scheduleCheck);
  }

  // ---------------------------------------------------------------- Stories pick
  function isPickActive() { return modeOn; }

  function surfaceOf(el) {
    if (!el) return '';
    var bases = el.querySelectorAll ? el.querySelectorAll('.jp-base') : null;
    if (bases && bases.length) {
      var out = '';
      for (var i = 0; i < bases.length; i++) out += bases[i].textContent || '';
      if (out) return out;
    }
    return (el.textContent || '').trim();
  }

  function togglePickedToken(el) {
    if (!el) return;
    var idx = picked.indexOf(el);
    if (idx >= 0) {
      picked.splice(idx, 1);
      el.classList.remove('jp-token-picked');
    } else {
      picked.push(el);
      el.classList.add('jp-token-picked');
    }
    refreshPickUi();
  }

  function clearPicked() {
    for (var i = 0; i < picked.length; i++) {
      try { picked[i].classList.remove('jp-token-picked'); } catch (e) {}
    }
    picked = [];
  }

  // Join picked surfaces in DOM (reading) order.
  function pickedText() {
    var arr = picked.slice().sort(function (a, b) {
      var pos = a.compareDocumentPosition(b);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
    var out = '';
    for (var i = 0; i < arr.length; i++) out += surfaceOf(arr[i]);
    return out;
  }

  // Anchor the shared pill to the last-picked token with a "N word(s)" caption.
  function refreshPickUi() {
    if (!picked.length) { hideButton(); return; }
    var last = picked[picked.length - 1];
    var rect;
    try { rect = last.getBoundingClientRect(); } catch (e) { rect = null; }
    if (!rect) return;
    var n = picked.length;
    showButtonAt(rect, pickedText(), n + (n === 1 ? ' word' : ' words'));
  }

  // ---------------------------------------------------------------- explain
  function explain(text, opts) {
    opts = opts || {};
    text = (text || '').trim();
    if (!text) return;
    var to = overlay();
    if (!to) return;
    if (typeof to.requireAuth === 'function' && !to.requireAuth()) return;

    var quota = S().tutorQuota;
    var st = quota ? quota.getState() : { remaining: 5 };
    if (st.remaining <= 0) {
      if (to.toast) to.toast('Rikizo needs a rest — come back tomorrow.');
      return;
    }

    var tc = S().tutorContext;
    var payload = {
      text: 'Please explain this for me: "' + text + '"',
      ctx: tc ? tc.forRequest() : null,
      hint: (typeof to.progressHint === 'function') ? to.progressHint() : ''
    };

    if (to.setThinking) to.setThinking(true);
    if (quota) quota.recordPressAsk();

    S().tutorClient.askPressToAsk(payload).then(function (res) {
      if (res && res.quota && quota) quota.syncFromServer(res.quota);
      if (to.setThinking) to.setThinking(false);
      to.showBubble((res && res.answer) || '', '',
        { persist: true, followUp: true, followUpCtx: { text: text } },
        opts.anchorRect);
    }, function (err) {
      if (to.setThinking) to.setThinking(false);
      var reason = err && err.reason;
      if (err && err.status === 429 && (reason === 'tier_quota' || reason === 'daily_cost_cap')) {
        if (to.toast) to.toast('Rikizo needs a rest — come back tomorrow.');
      } else if (err && err.status === 401) {
        if (to.toast) to.toast('Sign in to ask Rikizo.');
      } else {
        if (to.toast) to.toast('Couldn\'t reach Rikizo. Check your connection.');
      }
    });
  }

  // ---------------------------------------------------------------- init
  function init(config) {
    cfg = config || cfg;
    injectStyles();
    attachListeners();
  }

  window.JPShared.selectExplain = {
    init: init,
    enterMode: enterMode,
    exitMode: exitMode,
    toggleMode: toggleMode,
    isModeOn: isModeOn,
    showButtonAt: showButtonAt,
    hideButton: hideButton,
    explain: explain,
    // Stories tap-to-build
    isPickActive: isPickActive,
    togglePickedToken: togglePickedToken,
    clearPicked: clearPicked,
    pickedText: pickedText
  };
})();

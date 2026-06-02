/**
 * app/shared/tutor-overlay.js
 * Ambient "Ask Rikizo" overlay. When the tutor beta is ON, Rikizo's face floats
 * over the whole app as a draggable button. Tap it to ask a question about
 * whatever you're looking at; Rikizo answers in a speech bubble in place.
 *
 * This is NOT a launched screen — it's an always-on overlay attached to
 * document.body (like rikizo-companion.js), so it survives module switches.
 *
 * Reuses:
 *   window.JPShared.tutorClient   — backend transport (mock until baseUrl set)
 *   window.JPShared.tutorQuota    — local daily-quota mirror
 *   window.JPShared.tutorContext  — what lesson/page the question is about
 *   window.JPShared.jpText        — render the answer with furigana/romaji
 *
 * localStorage keys:
 *   k-rikizo-tutor-on   — '1' when the beta is enabled (face button visible)
 *   k-rikizo-tutor-pos  — JSON { left, top } persisted drag position
 *
 * Self-registers on window.JPShared.tutorOverlay.
 */

(function () {
  'use strict';

  window.JPShared = window.JPShared || {};
  if (window.JPShared.tutorOverlay) return; // idempotent

  var ON_KEY = 'k-rikizo-tutor-on';
  var POS_KEY = 'k-rikizo-tutor-pos';
  var BTN_SIZE = 58;
  var MARGIN = 14;     // gap from screen edges
  var DRAG_THRESH = 8; // px of movement that turns a tap into a drag

  var cfg = null;
  var styleInjected = false;
  var faceBtn = null;
  var bubbleEl = null;
  var sheetEl = null;

  function S() { return window.JPShared; }
  function assetUrl(path) {
    return window.getAssetUrl ? window.getAssetUrl(cfg || {}, path) : path;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---------------------------------------------------------------- styles
  function injectStyles() {
    if (styleInjected) return;
    styleInjected = true;
    var faceUrl = assetUrl('assets/characters/rikizo/rikizo_head.png');
    var css = [
      '#rk-tutor-face{position:fixed;width:' + BTN_SIZE + 'px;height:' + BTN_SIZE + 'px;',
      '  border-radius:50%;background:var(--washi,#f7f4ee) center/86% no-repeat;',
      '  background-image:url("' + faceUrl + '");background-size:cover;',
      '  border:2px solid var(--washi,#f7f4ee);box-shadow:0 4px 14px rgba(0,0,0,0.28);',
      '  z-index:62;cursor:pointer;touch-action:none;display:none;',
      '  transition:transform 0.12s ease, box-shadow 0.12s ease;}',
      '#rk-tutor-face:active{transform:scale(0.94);}',
      '#rk-tutor-face.rk-tutor-dragging{transform:scale(1.08);box-shadow:0 8px 22px rgba(0,0,0,0.34);}',
      '#rk-tutor-face.rk-tutor-thinking{animation:rkTutorPulse 1s ease-in-out infinite;}',
      '@keyframes rkTutorPulse{0%,100%{transform:scale(1);}50%{transform:scale(1.08);}}',
      '#rk-tutor-face .rk-tutor-badge{position:absolute;right:-3px;top:-3px;width:20px;height:20px;',
      '  border-radius:50%;background:var(--vermilion,#c8472a);color:#fff;font-size:12px;font-weight:700;',
      '  display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,0.3);}',

      /* answer bubble */
      '#rk-tutor-bubble{position:fixed;max-width:300px;min-width:160px;z-index:63;display:none;',
      '  background:var(--washi,#f7f4ee);color:var(--ink,#2a2520);',
      '  border:1px solid var(--hairline,rgba(40,35,30,0.14));border-radius:16px;',
      '  padding:12px 14px 28px;box-shadow:0 8px 26px rgba(0,0,0,0.22);',
      '  font-family:"Schibsted Grotesk","Work Sans",system-ui,sans-serif;font-size:0.98rem;line-height:1.6;',
      '  cursor:pointer;animation:jpFadeIn 0.2s ease;max-height:46vh;overflow-y:auto;}',
      '#rk-tutor-bubble .rk-tutor-bubble-tap{position:absolute;left:0;right:0;bottom:8px;text-align:center;',
      '  font-size:0.68rem;color:var(--ink-3,#8a8178);font-weight:600;}',
      '#rk-tutor-bubble .rk-tutor-heard{font-size:0.8rem;color:var(--ink-3,#8a8178);font-style:italic;',
      '  margin:-2px 0 8px;padding-bottom:8px;border-bottom:1px solid var(--hairline,rgba(40,35,30,0.12));}',
      '#rk-tutor-bubble .rk-tutor-link{color:var(--vermilion,#c8472a);font-weight:700;cursor:pointer;',
      '  text-decoration:underline;text-underline-offset:2px;}',
      '#rk-tutor-bubble .rk-tutor-link-soon{color:var(--ink-3,#8a8178);text-decoration:underline dotted;}',

      /* ask sheet */
      '#rk-tutor-backdrop{position:fixed;inset:0;z-index:70;background:rgba(20,16,12,0.34);',
      '  display:none;animation:jpFadeIn 0.18s ease;}',
      '#rk-tutor-sheet{position:fixed;left:50%;transform:translateX(-50%);bottom:0;z-index:71;',
      '  width:100%;max-width:430px;background:var(--washi,#f7f4ee);',
      '  border-radius:20px 20px 0 0;box-shadow:0 -8px 30px rgba(0,0,0,0.24);display:none;',
      '  padding:14px 16px calc(16px + env(safe-area-inset-bottom));',
      '  font-family:"Schibsted Grotesk","Work Sans",system-ui,sans-serif;',
      '  animation:rkTutorSlideUp 0.22s ease;}',
      '@keyframes rkTutorSlideUp{from{transform:translate(-50%,100%);}to{transform:translate(-50%,0);}}',
      '.rk-tutor-sheet-head{display:flex;align-items:center;gap:10px;margin-bottom:10px;}',
      '.rk-tutor-sheet-face{width:34px;height:34px;border-radius:50%;background:center/cover no-repeat;',
      '  background-image:url("' + faceUrl + '");flex-shrink:0;}',
      '.rk-tutor-sheet-title{font-weight:700;font-size:1rem;color:var(--ink,#2a2520);}',
      '.rk-tutor-sheet-sub{font-size:0.74rem;color:var(--ink-3,#8a8178);margin-top:1px;}',
      '.rk-tutor-sheet-quota{margin-left:auto;font-size:0.7rem;font-weight:700;color:var(--ink-2,#5a5249);',
      '  background:var(--washi-2,#efe9df);padding:4px 9px;border-radius:999px;}',
      '.rk-tutor-sheet-quota.rk-tutor-empty{background:var(--vermilion,#c8472a);color:#fff;}',
      '#rk-tutor-input{width:100%;resize:none;border:1px solid var(--hairline,rgba(40,35,30,0.18));',
      '  border-radius:14px;padding:11px 13px;font:inherit;font-size:0.98rem;line-height:1.4;',
      '  max-height:120px;background:#fff;color:var(--ink,#2a2520);}',
      '#rk-tutor-input:focus{outline:none;border-color:var(--moss,#5f8a4e);}',
      '.rk-tutor-sheet-row{display:flex;gap:8px;align-items:center;margin-top:10px;}',
      '.rk-tutor-mic{width:44px;height:44px;border-radius:50%;border:1px solid var(--hairline,rgba(40,35,30,0.18));',
      '  background:#fff;color:var(--ink-3,#8a8178);font-size:1.2rem;cursor:pointer;flex-shrink:0;}',
      '.rk-tutor-mic:disabled{opacity:0.5;cursor:default;}',
      '.rk-tutor-mic.rk-tutor-mic-live{background:var(--vermilion,#c8472a);color:#fff;border-color:var(--vermilion,#c8472a);animation:rkTutorPulse 0.9s ease-in-out infinite;}',
      '.rk-tutor-send{flex:1;height:44px;border-radius:999px;border:none;background:var(--vermilion,#c8472a);',
      '  color:#fff;font-weight:700;font-size:0.95rem;cursor:pointer;}',
      '.rk-tutor-send:disabled{opacity:0.5;cursor:default;}',
      '.rk-tutor-thinking-line{font-size:0.9rem;color:var(--ink-3,#8a8178);font-style:italic;margin-top:10px;}'
    ].join('\n');
    var st = document.createElement('style');
    st.id = 'jp-tutor-overlay-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ---------------------------------------------------------------- position
  function clampPos(left, top) {
    var maxL = window.innerWidth - BTN_SIZE - MARGIN;
    var maxT = window.innerHeight - BTN_SIZE - MARGIN;
    return {
      left: Math.max(MARGIN, Math.min(left, maxL)),
      top: Math.max(MARGIN, Math.min(top, maxT))
    };
  }
  function defaultPos() {
    // lower-left, above the tab bar / home indicator
    return clampPos(MARGIN, window.innerHeight - BTN_SIZE - MARGIN - 72);
  }
  function loadPos() {
    try {
      var raw = localStorage.getItem(POS_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (typeof p.left === 'number' && typeof p.top === 'number') return clampPos(p.left, p.top);
      }
    } catch (e) {}
    return defaultPos();
  }
  function savePos(p) {
    try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch (e) {}
  }
  function applyPos(p) {
    faceBtn.style.left = p.left + 'px';
    faceBtn.style.top = p.top + 'px';
  }

  // ---------------------------------------------------------------- face button
  function ensureFace() {
    if (faceBtn) return;
    injectStyles();
    faceBtn = document.createElement('div');
    faceBtn.id = 'rk-tutor-face';
    faceBtn.setAttribute('role', 'button');
    faceBtn.setAttribute('aria-label', 'Ask Rikizo');
    faceBtn.innerHTML = '<span class="rk-tutor-badge">?</span>';
    document.body.appendChild(faceBtn);
    applyPos(loadPos());
    wireDrag();
    window.addEventListener('resize', function () { applyPos(clampPos(
      parseInt(faceBtn.style.left, 10) || MARGIN,
      parseInt(faceBtn.style.top, 10) || MARGIN
    )); });
  }

  function wireDrag() {
    var startX = 0, startY = 0, baseL = 0, baseT = 0, moved = false, dragging = false;

    faceBtn.addEventListener('pointerdown', function (e) {
      dragging = true; moved = false;
      startX = e.clientX; startY = e.clientY;
      baseL = parseInt(faceBtn.style.left, 10) || 0;
      baseT = parseInt(faceBtn.style.top, 10) || 0;
      try { faceBtn.setPointerCapture(e.pointerId); } catch (err) {}
    });

    faceBtn.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      if (!moved && (Math.abs(dx) > DRAG_THRESH || Math.abs(dy) > DRAG_THRESH)) {
        moved = true;
        faceBtn.classList.add('rk-tutor-dragging');
      }
      if (moved) {
        var p = clampPos(baseL + dx, baseT + dy);
        applyPos(p);
      }
    });

    function end(e) {
      if (!dragging) return;
      dragging = false;
      faceBtn.classList.remove('rk-tutor-dragging');
      try { faceBtn.releasePointerCapture(e.pointerId); } catch (err) {}
      if (moved) {
        savePos({ left: parseInt(faceBtn.style.left, 10), top: parseInt(faceBtn.style.top, 10) });
      } else {
        openAsk(); // it was a tap, not a drag
      }
    }
    faceBtn.addEventListener('pointerup', end);
    faceBtn.addEventListener('pointercancel', function () { dragging = false; faceBtn.classList.remove('rk-tutor-dragging'); });
  }

  // ---------------------------------------------------------------- quota
  function quotaState() {
    return S().tutorQuota ? S().tutorQuota.getState() : { used: 0, limit: 5, remaining: 5 };
  }

  // ---------------------------------------------------------------- ask sheet
  function openAsk() {
    clearBubble();
    injectStyles();
    var tc = S().tutorContext;
    var sub = tc ? tc.shortLabel() : '';
    var q = quotaState();

    var backdrop = document.createElement('div');
    backdrop.id = 'rk-tutor-backdrop';
    var sheet = document.createElement('div');
    sheet.id = 'rk-tutor-sheet';
    sheet.innerHTML =
      '<div class="rk-tutor-sheet-head">' +
        '<div class="rk-tutor-sheet-face"></div>' +
        '<div>' +
          '<div class="rk-tutor-sheet-title">Ask Rikizo</div>' +
          '<div class="rk-tutor-sheet-sub">' + (sub ? 'about ' + esc(sub) : 'ask me anything in Japanese') + '</div>' +
        '</div>' +
        '<div class="rk-tutor-sheet-quota' + (q.remaining <= 0 ? ' rk-tutor-empty' : '') + '">' +
          q.remaining + '/' + q.limit + '</div>' +
      '</div>' +
      '<textarea id="rk-tutor-input" rows="2" placeholder="Type your question…" enterkeyhint="send"></textarea>' +
      '<div class="rk-tutor-sheet-row">' +
        '<button class="rk-tutor-mic" id="rk-tutor-mic" title="Tap to speak, tap again to send">🎤</button>' +
        '<button class="rk-tutor-send" id="rk-tutor-send">Ask</button>' +
      '</div>' +
      '<div class="rk-tutor-thinking-line" id="rk-tutor-thinking" style="display:none;">考えています…</div>';

    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);
    sheetEl = sheet;
    backdrop.style.display = 'block';
    sheet.style.display = 'block';

    var input = sheet.querySelector('#rk-tutor-input');
    var sendBtn = sheet.querySelector('#rk-tutor-send');
    var thinking = sheet.querySelector('#rk-tutor-thinking');

    backdrop.addEventListener('click', closeAsk);
    wireMic(sheet.querySelector('#rk-tutor-mic'), input);

    // Tap-to-toggle: tap the mic to START recording, tap again to STOP and send.
    // (Hold-to-talk was too finicky — a quick press/release captured nothing.)
    // The server transcribes (Google STT) and answers. Where the recorder is
    // unavailable the mic is disabled with a clear hint.
    function wireMic(micBtn, inputEl) {
      if (!micBtn) return;
      var cap = S().audioCapture;
      if (!cap || !cap.isAvailable()) {
        micBtn.disabled = true;
        micBtn.title = 'Voice input isn\'t available here — type instead';
        micBtn.addEventListener('click', function () {
          toast('Voice input isn\'t available here — type for now.');
        });
        return;
      }

      function resetUi() {
        micBtn.classList.remove('rk-tutor-mic-live');
        inputEl.placeholder = 'Type your question…';
      }

      function startRec() {
        if (busy || cap.isRecording()) return;
        var qq = quotaState();
        if (qq.remaining <= 0) { toast('Rikizo needs a rest — come back tomorrow.'); return; }
        cap.start({
          onError: function (err) {
            resetUi();
            if (err === 'not-allowed') toast('Microphone permission is needed for voice.');
            else toast('Couldn\'t start the mic — type instead.');
          }
        }).then(function (ok) {
          if (!ok) return;
          micBtn.classList.add('rk-tutor-mic-live');
          inputEl.placeholder = '聞いています… (tap mic again to send)';
        });
      }

      function stopRec() {
        resetUi();
        cap.stop().then(function (clip) {
          // Need ~0.4s of audio to be worth transcribing.
          if (!clip || !clip.base64 || (clip.seconds || 0) < 0.4) {
            toast('Hmm, that was too short — tap the mic, speak, then tap again.');
            return;
          }
          submitAudio(clip);
        });
      }

      micBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (cap.isRecording()) stopRec();
        else startRec();
      });
    }

    function autoGrow() {
      input.style.height = 'auto';
      input.style.height = Math.min(120, input.scrollHeight) + 'px';
    }
    input.addEventListener('input', autoGrow);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    });
    sendBtn.addEventListener('click', submit);

    var busy = false;

    // Hint = where they are + what's on screen (tutorContext) PLUS what they've
    // been taught so far (tutorCurriculum) PLUS where any term in the question/
    // on-screen text was taught (glossary + grammar index). Feeds the curriculum
    // rules. `scanText` is the typed question for the where-lookup; for a voice
    // question we only have the on-screen sample until the server transcribes.
    function buildHint(scanText) {
      var parts = [];
      if (S().tutorContext) parts.push(S().tutorContext.describe());
      if (S().tutorCurriculum) {
        parts.push(S().tutorCurriculum.describe());
        var scan = scanText || '';
        var ctx = S().tutorContext && S().tutorContext.get();
        if (ctx && ctx.sample) scan += ' ' + ctx.sample;
        var where = S().tutorCurriculum.describeLookup(scan);
        if (where) parts.push(where);
      }
      return parts.filter(Boolean).join('\n\n');
    }

    // Shared send for both text and audio payloads.
    function send(payload) {
      busy = true;
      sendBtn.disabled = true;
      input.disabled = true;
      thinking.style.display = 'block';
      setThinking(true);
      if (S().tutorQuota) S().tutorQuota.recordPressAsk();

      S().tutorClient.askPressToAsk(payload).then(function (res) {
        if (res && res.quota && S().tutorQuota) S().tutorQuota.syncFromServer(res.quota);
        setThinking(false);
        closeAsk();
        // For voice questions, show what was heard above the answer so a
        // mis-transcription is obvious (and the student knows what was asked).
        var heard = payload.audio ? (res && res.transcript) : '';
        showBubble((res && res.answer) || '', heard);
      }, function (err) {
        setThinking(false);
        busy = false; sendBtn.disabled = false; input.disabled = false;
        thinking.style.display = 'none';
        var reason = err && err.reason;
        if (err && err.status === 429 && (reason === 'tier_quota' || reason === 'daily_cost_cap')) {
          toast('Rikizo needs a rest — come back tomorrow.');
        } else if (err && err.status === 413) {
          toast('That was a bit long — keep questions under 15 seconds.');
        } else {
          toast('Couldn\'t reach Rikizo. Check your connection.');
        }
      });
    }

    function submit() {
      if (busy) return;
      var text = (input.value || '').trim();
      if (!text) return;
      var qq = quotaState();
      if (qq.remaining <= 0) { toast('Rikizo needs a rest — come back tomorrow.'); return; }
      send({ text: text, hint: buildHint(text) });
    }

    // Voice question: send the recorded clip; the server transcribes + answers.
    function submitAudio(clip) {
      if (busy) return;
      var qq = quotaState();
      if (qq.remaining <= 0) { toast('Rikizo needs a rest — come back tomorrow.'); return; }
      send({ audio: clip, hint: buildHint('') });
    }

    setTimeout(function () { input.focus(); }, 60);
  }

  function closeAsk() {
    if (sheetEl && sheetEl.parentNode) sheetEl.parentNode.removeChild(sheetEl);
    var bd = document.getElementById('rk-tutor-backdrop');
    if (bd && bd.parentNode) bd.parentNode.removeChild(bd);
    sheetEl = null;
  }

  function setThinking(on) {
    if (!faceBtn) return;
    faceBtn.classList.toggle('rk-tutor-thinking', !!on);
  }

  // ---------------------------------------------------------------- answer bubble
  function showBubble(answer, heard) {
    if (!answer) return;
    ensureFace();
    clearBubble();
    var rendered = answer;
    if (S().jpText && typeof S().jpText.render === 'function') {
      try { rendered = S().jpText.render(answer); } catch (e) { rendered = esc(answer); }
    } else {
      rendered = esc(answer);
    }
    bubbleEl = document.createElement('div');
    bubbleEl.id = 'rk-tutor-bubble';
    // "I heard …" line for voice questions, so a mis-hear is visible at a glance.
    var heardLine = heard
      ? '<div class="rk-tutor-heard">🎤 I heard: "' + esc(heard) + '"</div>'
      : '';
    bubbleEl.innerHTML = heardLine + '<div class="rk-tutor-answer">' + rendered + '</div>' +
      '<div class="rk-tutor-bubble-tap">tap to dismiss</div>';
    // Turn lesson/grammar ids in the answer ("G25", "N4.1") into tappable links
    // that jump straight to that lesson. Best-effort — never break the answer.
    try { linkifyIds(bubbleEl.querySelector('.rk-tutor-answer')); } catch (e) {}
    document.body.appendChild(bubbleEl);
    bubbleEl.style.display = 'block';
    positionBubble();
    bubbleEl.addEventListener('click', clearBubble);
  }

  // Wrap real curriculum ids in the rendered answer with tappable links. Walks
  // TEXT NODES only (never innerHTML string-replace) so jpText's <ruby>/<rt>
  // furigana markup is left intact.
  function linkifyIds(root) {
    if (!root || !document.createTreeWalker) return;
    var tc = S().tutorCurriculum;
    if (!tc || typeof tc.resolveId !== 'function') return;
    var RE = /G\d+|N\d\.Review\.\d+|N\d\.\d+/g;

    // Collect matching text nodes first (mutating the tree mid-walk is unsafe).
    var nodes = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nd;
    while ((nd = walker.nextNode())) {
      RE.lastIndex = 0;
      if (RE.test(nd.nodeValue)) nodes.push(nd);
    }

    nodes.forEach(function (node) {
      var text = node.nodeValue;
      var frag = document.createDocumentFragment();
      var last = 0, m, replaced = false;
      RE.lastIndex = 0;
      while ((m = RE.exec(text))) {
        var id = m[0];
        var info = tc.resolveId(id);
        if (!info.exists) continue; // leave plain — stays in surrounding text slice
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        frag.appendChild(makeIdSpan(id, info));
        last = m.index + id.length;
        replaced = true;
      }
      if (!replaced) return;
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  }

  // Build one id span. Reachable → tappable (opens the lesson); real-but-not-yet
  // → muted "soon" style. Callers only pass exists:true ids here.
  function makeIdSpan(id, info) {
    var span = document.createElement('span');
    span.textContent = id;
    if (info.reachable) {
      span.className = 'rk-tutor-link';
      span.setAttribute('role', 'button');
      span.addEventListener('click', function (e) {
        e.stopPropagation();           // don't let the bubble's dismiss handler fire
        clearBubble();
        if (window.JPApp && typeof window.JPApp.launch === 'function') {
          window.JPApp.launch(info.mode, id);
        }
      });
    } else {
      span.className = 'rk-tutor-link-soon';
      span.title = "You'll reach this later in the path";
    }
    return span;
  }

  function positionBubble() {
    if (!bubbleEl || !faceBtn) return;
    var fr = faceBtn.getBoundingClientRect();
    var br = bubbleEl.getBoundingClientRect();
    // Prefer above the face; if not enough room, place below.
    var top = fr.top - br.height - 10;
    if (top < 10) top = fr.bottom + 10;
    // Horizontally: align bubble near the face, clamped to viewport.
    var left = fr.left + fr.width / 2 - br.width / 2;
    left = Math.max(10, Math.min(left, window.innerWidth - br.width - 10));
    bubbleEl.style.top = top + 'px';
    bubbleEl.style.left = left + 'px';
  }

  function clearBubble() {
    if (bubbleEl && bubbleEl.parentNode) bubbleEl.parentNode.removeChild(bubbleEl);
    bubbleEl = null;
  }

  // ---------------------------------------------------------------- toast
  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('rk-tutor-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'rk-tutor-toast';
      t.style.cssText = 'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:80;' +
        'background:#2a2520;color:#f7f4ee;padding:9px 16px;border-radius:999px;font-size:0.82rem;' +
        'font-weight:600;font-family:system-ui,sans-serif;opacity:0;transition:opacity 0.25s;pointer-events:none;';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '0.96';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.style.opacity = '0'; }, 2200);
  }

  // ---------------------------------------------------------------- public API
  function isEnabled() {
    try { return localStorage.getItem(ON_KEY) === '1'; } catch (e) { return false; }
  }

  function applyVisibility() {
    if (!isEnabled()) {
      if (faceBtn) faceBtn.style.display = 'none';
      clearBubble();
      closeAsk();
      return;
    }
    ensureFace();
    faceBtn.style.display = 'block';
  }

  function enable() {
    try { localStorage.setItem(ON_KEY, '1'); } catch (e) {}
    applyVisibility();
  }

  function disable() {
    try { localStorage.setItem(ON_KEY, '0'); } catch (e) {}
    applyVisibility();
  }

  function init(config) {
    cfg = config || cfg;
    // Point the transport at a real backend if one is configured. Precedence:
    //   1. ?tutor=<url> query param (easiest for the Xcode sim — no devtools;
    //      the url is persisted so it survives navigation)
    //   2. localStorage k-tutor-base-url
    //   3. sharedConfig.tutorBaseUrl
    // With none set, tutorClient stays in mock mode and answers are placeholders.
    var baseUrl = '';
    try {
      var qp = new URLSearchParams(location.search).get('tutor');
      if (qp) { baseUrl = qp; localStorage.setItem('k-tutor-base-url', qp); }
    } catch (e) {}
    try { if (!baseUrl) baseUrl = localStorage.getItem('k-tutor-base-url') || ''; } catch (e) {}
    if (!baseUrl && config && config.tutorBaseUrl) baseUrl = config.tutorBaseUrl;
    if (baseUrl && S().tutorClient) S().tutorClient.setConfig({ baseUrl: baseUrl });
    applyVisibility(); // shows the face only if the beta is already on
  }

  window.JPShared.tutorOverlay = {
    init: init,
    enable: enable,
    disable: disable,
    isEnabled: isEnabled,
    applyVisibility: applyVisibility,
    openAsk: openAsk
  };
})();

// app/shared/sfx.js
// Synthesized UI sound effects via the Web Audio API — no asset files. Registers
// window.JPShared.sfx. Pairs with window.JPShared.haptics (wired separately at
// the same call sites). Every sound is procedural (oscillators + filtered noise)
// so there's nothing to download and it stays crisp at any rate.
//
// Gated by the `k-sfx-on` pref (default on). The AudioContext is created lazily
// and resumed on the first user gesture (autoplay policy); on iOS it follows the
// ring/silent switch via the app's audio session, which is the behaviour we want
// for incidental UI sound.
(function () {
  window.JPShared = window.JPShared || {};
  if (window.JPShared.sfx) return;

  var SFX_KEY = 'k-sfx-on';
  function enabled() { try { return localStorage.getItem(SFX_KEY) !== '0'; } catch (e) { return true; } }
  function setEnabled(b) { try { localStorage.setItem(SFX_KEY, b ? '1' : '0'); } catch (e) {} }

  var ctx = null, master = null, noiseBuf = null;

  function actx() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }
  function resume() { if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} } }

  // Unlock/resume audio on the first user gesture (required by autoplay policy).
  function onGesture() { actx(); resume(); }
  ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) {
    window.addEventListener(ev, onGesture, { passive: true });
  });

  function noise() {
    if (noiseBuf) return noiseBuf;
    var c = actx(); if (!c) return null;
    var n = Math.floor(c.sampleRate * 0.4);
    noiseBuf = c.createBuffer(1, n, c.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  // A single enveloped oscillator note.
  function tone(t0, freq, dur, type, peak, opts) {
    opts = opts || {};
    var o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (opts.glideTo) o.frequency.linearRampToValueAtTime(opts.glideTo, t0 + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }

  // Band-passed noise burst sweeping f0→f1 — a paper/air "whoosh".
  function whoosh(t0, dur, f0, f1, peak) {
    var nb = noise(); if (!nb) return;
    var src = ctx.createBufferSource(); src.buffer = nb;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7;
    bp.frequency.setValueAtTime(f0, t0);
    bp.frequency.exponentialRampToValueAtTime(Math.max(60, f1), t0 + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.03);
  }

  function play(fn) {
    if (!enabled()) return;
    var c = actx(); if (!c) return;
    resume();
    if (c.state !== 'running') return; // not yet unlocked — skip silently
    try { fn(c.currentTime); } catch (e) {}
  }

  var S = {
    enabled: enabled,
    setEnabled: setEnabled,
    // soft tick for taps on cards/tiles/lanterns (wired via scene-kit.tapFeedback)
    tap:      function () { play(function (t) { tone(t, 880, 0.055, 'triangle', 0.08); }); },
    select:   function () { play(function (t) { tone(t, 1200, 0.05, 'triangle', 0.08); }); },
    // rising two-note chime for a correct answer
    success:  function () { play(function (t) { tone(t, 660, 0.12, 'sine', 0.16); tone(t + 0.09, 990, 0.2, 'sine', 0.15); }); },
    // soft low descending blip for a wrong answer (not harsh)
    error:    function () { play(function (t) { tone(t, 233, 0.2, 'sine', 0.16, { glideTo: 165 }); }); },
    // paper whoosh for a page flip
    pageTurn: function () { play(function (t) { whoosh(t, 0.22, 1700, 480, 0.13); }); },
    // longer airy whoosh + a soft settle for opening a book/folder cover
    open:     function () { play(function (t) { whoosh(t, 0.34, 800, 1600, 0.12); tone(t + 0.2, 175, 0.18, 'sine', 0.09); }); },
    // low thunk + ink press for a stamp landing
    stamp:    function () { play(function (t) { tone(t, 92, 0.15, 'sine', 0.30, { attack: 0.002 }); whoosh(t, 0.06, 2200, 1100, 0.07); }); },
    // bright ascending triad for an unlock / celebration
    unlock:   function () { play(function (t) { tone(t, 523, 0.12, 'sine', 0.15); tone(t + 0.1, 659, 0.12, 'sine', 0.15); tone(t + 0.2, 784, 0.24, 'sine', 0.17); }); }
  };

  window.JPShared.sfx = S;
})();

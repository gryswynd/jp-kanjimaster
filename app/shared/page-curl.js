// app/shared/page-curl.js
// Hand-rolled WebGL page-curl effect. Registers window.JPShared.pageCurl.
//
// The turning leaf is a paper plane tinted to the page color that rolls around a
// cylinder whose curl-line sweeps across the page; the canvas is transparent
// where the paper has rolled away, so the DOM page beneath shows through. We do
// NOT texture the real text (WKWebView can't cheaply snapshot ruby/furigana) —
// Stories.js fades the DOM text under the curl. If WebGL is unavailable or the
// context is lost, isSupported() goes false and callers fall back to the CSS flip.
(function () {
  'use strict';
  window.JPShared = window.JPShared || {};

  var COLS = 60, ROWS = 2;          // grid resolution (fine in x for a smooth bend)
  var DEFAULT_COLOR = [0.98, 0.965, 0.925]; // warm off-white (the page bg)

  var canvas = null, gl = null, program = null;
  var loc = {}, posBuf = null, idxBuf = null, idxCount = 0;
  var supported = null;             // null = unprobed
  var animating = false;
  var contextLost = false;

  var VERT = [
    'attribute vec2 aPos;',                 // page coords, x,y in [0,1]
    'uniform float uProgress;',             // 0..1
    'uniform float uForward;',              // +1 forward, -1 backward
    'varying float vShade;',
    'uniform float uMode;',                 // 0 = paper, 1 = cast shadow
    'varying float vShade;',
    'varying float vScreenX;',
    'const float PI = 3.14159265;',
    'void main(){',
    '  float R = 0.13;',                    // roll radius (page units)
    '  float c = mix(1.0, -0.40, uProgress);', // curl line sweeps right->left
    '  float x = aPos.x;',
    '  float z = 0.0;',
    '  float shade = 1.0;',
    '  if (uMode < 0.5) {',
    '    float d = x - c;',
    '    if (d > 0.0) {',
    '      float a = min(d / R, PI);',      // clamp so it tucks at a half-roll
    '      x = c + R * sin(a);',
    '      z = R * (1.0 - cos(a));',
    // Paper stays light (never blackens); a soft sheen crest catches the light.
    '      float lit = 0.80 + 0.20 * cos(a);',
    '      float crest = exp(-pow((a - 1.2) / 0.5, 2.0)) * 0.18;',
    '      shade = clamp(lit + crest, 0.55, 1.12);',
    '    }',
    '  }',
    '  float mx = (uForward > 0.0) ? x : (1.0 - x);', // mirror sweep for backward
    '  vScreenX = mx;',
    '  float clipX = mx * 2.0 - 1.0;',
    '  float clipY = 1.0 - aPos.y * 2.0;',
    '  float lift = (uMode < 0.5) ? (1.0 - z * 0.10) : 1.0;', // perspective shrink on lift
    '  gl_Position = vec4(clipX * lift, clipY * lift, 0.0, 1.0);',
    '  vShade = shade;',
    '}'
  ].join('\n');

  var FRAG = [
    'precision mediump float;',
    'varying float vShade;',
    'varying float vScreenX;',
    'uniform vec3 uColor;',
    'uniform float uMode;',
    'uniform float uProgress;',
    'uniform float uForward;',
    'void main(){',
    '  if (uMode < 0.5) {',
    '    gl_FragColor = vec4(uColor * vShade, 1.0);',  // opaque paper
    '  } else {',
    // Soft shadow the lifting page casts on the sheet just past the curl line.
    '    float c = mix(1.0, -0.40, uProgress);',
    '    float scl = (uForward > 0.0) ? c : (1.0 - c);',
    '    float dd = (uForward > 0.0) ? (vScreenX - scl) : (scl - vScreenX);',
    '    float al = (dd > 0.0) ? (1.0 - smoothstep(0.0, 0.26, dd)) * 0.32 : 0.0;',
    '    gl_FragColor = vec4(0.0, 0.0, 0.0, al);',      // premultiplied black
    '  }',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('[pageCurl] shader error:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  function buildGrid() {
    var pos = [], idx = [];
    for (var r = 0; r <= ROWS; r++) {
      for (var cc = 0; cc <= COLS; cc++) {
        pos.push(cc / COLS, r / ROWS);
      }
    }
    var stride = COLS + 1;
    for (var rr = 0; rr < ROWS; rr++) {
      for (var c2 = 0; c2 < COLS; c2++) {
        var i0 = rr * stride + c2, i1 = i0 + 1, i2 = i0 + stride, i3 = i2 + 1;
        idx.push(i0, i2, i1, i1, i2, i3);
      }
    }
    idxCount = idx.length;
    posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
    idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
  }

  function ensureGL(host) {
    if (gl && !contextLost) return true;
    try {
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.className = 'jp-curl-canvas';
        canvas.addEventListener('webglcontextlost', function (e) {
          e.preventDefault(); contextLost = true; supported = false;
        }, false);
      }
      if (canvas.parentElement !== host) host.appendChild(canvas);
      var opts = { alpha: true, premultipliedAlpha: true, antialias: true, depth: false };
      gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
      if (!gl) return false;
      contextLost = false;
      var vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) return false;
      program = gl.createProgram();
      gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
      gl.useProgram(program);
      loc.aPos = gl.getAttribLocation(program, 'aPos');
      loc.uProgress = gl.getUniformLocation(program, 'uProgress');
      loc.uForward = gl.getUniformLocation(program, 'uForward');
      loc.uColor = gl.getUniformLocation(program, 'uColor');
      loc.uMode = gl.getUniformLocation(program, 'uMode');
      buildGrid();
      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied alpha
      return true;
    } catch (e) {
      return false;
    }
  }

  function isSupported() {
    if (supported !== null) return supported;
    // Cheap probe on a throwaway canvas (don't disturb the real one).
    try {
      var c = document.createElement('canvas');
      var test = c.getContext('webgl') || c.getContext('experimental-webgl');
      supported = !!test;
    } catch (e) { supported = false; }
    return supported;
  }

  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function run(opts) {
    opts = opts || {};
    var host = opts.host, onDone = opts.onDone || function () {};
    if (!host || !isSupported() || !ensureGL(host)) { onDone(); return; }
    if (animating) { onDone(); return; }
    animating = true;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(host.clientWidth * dpr));
    var h = Math.max(1, Math.round(host.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    canvas.style.display = 'block';
    gl.viewport(0, 0, w, h);

    var color = opts.pageColor && opts.pageColor.length === 3 ? opts.pageColor : DEFAULT_COLOR;
    var forward = opts.forward !== false;
    var duration = opts.duration || 560;

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.enableVertexAttribArray(loc.aPos);
    gl.vertexAttribPointer(loc.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    // forward = REVEAL (paper rolls away, dest shows beneath); the mirror flips
    // the sweep side for backward = COVER (paper rolls IN over the current page).
    gl.uniform1f(loc.uForward, forward ? 1 : -1);
    gl.uniform3f(loc.uColor, color[0], color[1], color[2]);

    // uProgress 0 = full flat paper, 1 = rolled away. forward sweeps 0→1 (reveal);
    // backward sweeps 1→0 (cover) so the incoming page wipes in.
    function draw(p) {
      gl.uniform1f(loc.uProgress, p);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(loc.uMode, 1.0); // cast shadow onto the revealed area first
      gl.drawElements(gl.TRIANGLES, idxCount, gl.UNSIGNED_SHORT, 0);
      gl.uniform1f(loc.uMode, 0.0); // opaque curling paper on top
      gl.drawElements(gl.TRIANGLES, idxCount, gl.UNSIGNED_SHORT, 0);
    }
    // Synchronous first frame so there's never a blank canvas flash before rAF.
    draw(forward ? 0 : 1);

    var start = 0;
    function frame(now) {
      if (contextLost) { finish(); return; }
      if (!start) start = now;
      var t = Math.min(1, (now - start) / duration);
      var eased = easeInOut(t);
      draw(forward ? eased : 1 - eased);
      if (t < 1) requestAnimationFrame(frame);
      else finish();
    }
    function finish() {
      animating = false;
      if (canvas) canvas.style.display = 'none';
      onDone();
    }
    requestAnimationFrame(frame);
  }

  window.JPShared.pageCurl = {
    isSupported: isSupported,
    run: run
  };
})();

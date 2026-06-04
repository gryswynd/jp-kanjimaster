// app/shared/garden-stage.js
// A tiny Canvas2D "living stage" for the Grammar Garden: ponds with koi that
// actually swim. Registers window.JPShared.gardenStage.
//
// Why Canvas2D (not WebGL/PixiJS): koi + water are decorative background motion
// over a handful of small (~120px) canvases — Canvas2D delivers the painterly
// look with none of the GL context-loss / dependency overhead. The reusable
// "stage" goal is met: one shared rAF ticker drives every visible pond, and
// ponds off-screen (IntersectionObserver) or under reduced-motion don't animate.
//
// Usage:
//   var stage = window.JPShared.gardenStage;
//   stage.reset();                 // call before (re)building the garden
//   stage.createPond(hostEl);      // hostEl is a positioned ~120px box
(function () {
  window.JPShared = window.JPShared || {};
  if (window.JPShared.gardenStage) return;

  var reduce = false;
  try { reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var DPR = Math.min(2, (window.devicePixelRatio || 1));
  var ponds = [];
  var rafId = null;
  var lastT = 0;

  // ── shared ticker ────────────────────────────────────────────────────────
  function loop(t) {
    rafId = requestAnimationFrame(loop);
    var dt = Math.min(0.05, (t - lastT) / 1000) || 0;
    lastT = t;
    for (var i = ponds.length - 1; i >= 0; i--) {
      var p = ponds[i];
      // Self-heal: if the garden was torn down (tab nav, module switch) the host
      // leaves the DOM — drop the pond so the loop can stop instead of spinning
      // on a detached canvas.
      if (!p.host.isConnected) { p.destroy(); ponds.splice(i, 1); continue; }
      if (!p.visible) continue;
      p.step(dt); p.draw();
    }
    if (!ponds.length) stop();
  }
  function start() { if (rafId == null) { lastT = performance.now(); rafId = requestAnimationFrame(loop); } }
  function stop() { if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; } }

  function reset() {
    for (var i = 0; i < ponds.length; i++) ponds[i].destroy();
    ponds = [];
    stop();
  }

  // ── koi ────────────────────────────────────────────────────────────────
  // Palette: kohaku (white+red), orange, and a darker calico.
  var KOI = [
    { body: 'rgba(243,238,230,0.96)', patch: 'rgba(214,82,45,0.95)', fin: 'rgba(243,238,230,0.55)' },
    { body: 'rgba(222,108,52,0.95)',  patch: 'rgba(247,243,236,0.9)', fin: 'rgba(222,108,52,0.5)' },
    { body: 'rgba(238,232,224,0.95)', patch: 'rgba(60,52,48,0.85)',   fin: 'rgba(238,232,224,0.5)' }
  ];

  function rand(a, b) { return a + Math.random() * (b - a); }

  function makeKoi(W, H, i) {
    var pal = KOI[i % KOI.length];
    return {
      cx: W * 0.5 + rand(-W * 0.06, W * 0.06),
      cy: H * 0.52 + rand(-H * 0.05, H * 0.05),
      rx: W * rand(0.18, 0.30),
      ry: H * rand(0.10, 0.20),
      phase: rand(0, Math.PI * 2),
      speed: rand(0.18, 0.34) * (Math.random() < 0.5 ? 1 : -1),
      wig: rand(0, Math.PI * 2),
      len: W * rand(0.26, 0.34),
      wide: W * rand(0.055, 0.075),
      pal: pal
    };
  }

  function drawKoi(ctx, k) {
    var segs = 7;
    var hx = k.cx + k.rx * Math.cos(k.phase);
    var hy = k.cy + k.ry * Math.sin(k.phase);
    var tx = -k.rx * Math.sin(k.phase) * (k.speed < 0 ? -1 : 1);
    var ty = k.ry * Math.cos(k.phase) * (k.speed < 0 ? -1 : 1);
    var ang = Math.atan2(ty, tx);
    var ca = Math.cos(ang), sa = Math.sin(ang);
    var nx = -sa, ny = ca;

    var pts = [];
    for (var s = 0; s <= segs; s++) {
      var f = s / segs;
      var along = -f * k.len;
      var lat = Math.sin(k.wig - f * 3.0) * k.len * 0.11 * f;
      pts.push([hx + ca * along + nx * lat, hy + sa * along + ny * lat, f]);
    }
    function hw(f) { return k.wide * Math.sin(Math.min(1, f * 1.18) * Math.PI) * (1 - 0.25 * f) + 0.4; }

    // soft shadow under the fish
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#1a2a22';
    ctx.beginPath();
    ctx.ellipse(hx - ca * k.len * 0.4 + 1.5, hy - sa * k.len * 0.4 + 2.5, k.len * 0.42, k.wide * 1.3, ang, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // tail fin
    var tail = pts[pts.length - 1];
    var spread = 0.5 + 0.25 * Math.sin(k.wig * 1.3);
    ctx.beginPath();
    ctx.moveTo(tail[0], tail[1]);
    ctx.lineTo(tail[0] - ca * k.len * 0.32 + nx * k.wide * 1.8 * spread, tail[1] - sa * k.len * 0.32 + ny * k.wide * 1.8 * spread);
    ctx.lineTo(tail[0] - ca * k.len * 0.32 - nx * k.wide * 1.8 * spread, tail[1] - sa * k.len * 0.32 - ny * k.wide * 1.8 * spread);
    ctx.closePath();
    ctx.fillStyle = k.pal.fin;
    ctx.fill();

    // body outline
    ctx.beginPath();
    var i;
    for (i = 0; i < pts.length; i++) {
      var p = pts[i], w = hw(p[2]);
      var lx = p[0] + nx * w, ly = p[1] + ny * w;
      if (i === 0) ctx.moveTo(lx, ly); else ctx.lineTo(lx, ly);
    }
    for (i = pts.length - 1; i >= 0; i--) {
      var q = pts[i], w2 = hw(q[2]);
      ctx.lineTo(q[0] - nx * w2, q[1] - ny * w2);
    }
    ctx.closePath();
    ctx.fillStyle = k.pal.body;
    ctx.fill();

    // patches (clipped to body)
    ctx.save();
    ctx.clip();
    ctx.fillStyle = k.pal.patch;
    var pA = pts[1], pB = pts[3];
    ctx.beginPath(); ctx.ellipse(pA[0], pA[1], k.wide * 1.05, k.wide * 0.85, ang, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(pB[0], pB[1], k.wide * 0.8, k.wide * 0.62, ang, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // eyes
    ctx.fillStyle = 'rgba(30,26,24,0.8)';
    var ex = hx - ca * k.wide * 0.6, ey = hy - sa * k.wide * 0.6;
    ctx.beginPath(); ctx.arc(ex + nx * k.wide * 0.6, ey + ny * k.wide * 0.6, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex - nx * k.wide * 0.6, ey - ny * k.wide * 0.6, 0.9, 0, Math.PI * 2); ctx.fill();
  }

  // ── pond ─────────────────────────────────────────────────────────────────
  function createPond(host) {
    if (!host) return null;
    var canvas = document.createElement('canvas');
    canvas.className = 'gr-pond-canvas';
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    host.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    var pond = {
      host: host, canvas: canvas, ctx: ctx,
      W: 0, H: 0, koi: [], lily: null, ripples: [], rTimer: rand(1.5, 4),
      visible: true, io: null, sized: false
    };

    function size() {
      var r = host.getBoundingClientRect();
      var w = Math.max(40, Math.round(r.width)), h = Math.max(40, Math.round(r.height));
      pond.W = w; pond.H = h;
      canvas.width = Math.round(w * DPR); canvas.height = Math.round(h * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      pond.koi = [makeKoi(w, h, 0), makeKoi(w, h, 1), makeKoi(w, h, 2)];
      pond.lily = { x: w * rand(0.58, 0.72), y: h * rand(0.32, 0.42), r: w * 0.12, bob: rand(0, 6) };
      pond.sized = true;
    }

    pond.step = function (dt) {
      for (var i = 0; i < pond.koi.length; i++) {
        var k = pond.koi[i];
        k.phase += k.speed * dt;
        k.wig += dt * (5 + i);
      }
      if (pond.lily) pond.lily.bob += dt;
      // ripples — occasional surface ring
      pond.rTimer -= dt;
      if (pond.rTimer <= 0) {
        pond.rTimer = rand(2.2, 5);
        pond.ripples.push({ x: pond.W * rand(0.25, 0.75), y: pond.H * rand(0.4, 0.7), t: 0 });
      }
      for (var j = pond.ripples.length - 1; j >= 0; j--) {
        pond.ripples[j].t += dt;
        if (pond.ripples[j].t > 2.4) pond.ripples.splice(j, 1);
      }
    };

    pond.draw = function () {
      if (!pond.sized) { size(); if (!pond.sized) return; }
      var W = pond.W, H = pond.H, cx = W / 2, cy = H / 2;
      ctx.clearRect(0, 0, W, H);

      // outer soft shadow
      ctx.save();
      ctx.globalAlpha = 0.22; ctx.fillStyle = '#1d241f';
      ctx.beginPath(); ctx.ellipse(cx, cy + H * 0.06, W * 0.46, H * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // water disc (layered gradients)
      var g = ctx.createRadialGradient(cx, cy * 0.85, W * 0.05, cx, cy, W * 0.46);
      g.addColorStop(0, '#4d7159');
      g.addColorStop(0.6, '#3a5e54');
      g.addColorStop(1, '#2c4750');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(cx, cy, W * 0.44, H * 0.40, 0, 0, Math.PI * 2); ctx.fill();
      // murky variation blob
      ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#6f8a4e';
      ctx.beginPath(); ctx.ellipse(cx - W * 0.1, cy + H * 0.06, W * 0.2, H * 0.16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // koi (under the surface sheen)
      ctx.save(); ctx.globalAlpha = 0.94;
      for (var i = 0; i < pond.koi.length; i++) drawKoi(ctx, pond.koi[i]);
      ctx.restore();

      // lily pad
      if (pond.lily) {
        var ly = pond.lily.y + Math.sin(pond.lily.bob) * 1.5;
        ctx.save();
        ctx.globalAlpha = 0.9; ctx.fillStyle = '#3f6b3a';
        ctx.beginPath();
        ctx.arc(pond.lily.x, ly, pond.lily.r, 0.5, Math.PI * 2 + 0.2);
        ctx.lineTo(pond.lily.x, ly);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(pond.lily.x, ly, pond.lily.r * 0.7, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }

      // ripples
      for (var r = 0; r < pond.ripples.length; r++) {
        var rp = pond.ripples[r], pr = rp.t / 2.4;
        ctx.save();
        ctx.globalAlpha = (1 - pr) * 0.4;
        ctx.strokeStyle = 'rgba(230,240,235,0.9)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(rp.x, rp.y, 2 + pr * W * 0.16, (2 + pr * W * 0.16) * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }

      // surface sheen (top-left arc)
      ctx.save(); ctx.globalAlpha = 0.12; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(cx, cy, W * 0.36, H * 0.32, 0, Math.PI * 1.05, Math.PI * 1.55); ctx.stroke();
      ctx.restore();

      // stone rim
      ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#8f9298'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(cx, cy, W * 0.44, H * 0.40, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    };

    pond.destroy = function () {
      if (pond.io) { try { pond.io.disconnect(); } catch (e) {} pond.io = null; }
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };

    // visibility gating
    if (window.IntersectionObserver) {
      pond.io = new IntersectionObserver(function (entries) {
        pond.visible = entries[0] && entries[0].isIntersecting;
        if (pond.visible && !reduce) start();
      }, { rootMargin: '80px' });
      pond.io.observe(host);
    }

    ponds.push(pond);

    if (reduce) {
      // static: size + one frame, no animation.
      requestAnimationFrame(function () { pond.draw(); });
    } else {
      start();
    }
    return { destroy: pond.destroy };
  }

  // ── falling leaves ─────────────────────────────────────────────────────
  // A few leaves drift down + sway over a scenery host (e.g. the maple). Same
  // ticker / visibility / self-heal contract as the pond.
  function drawLeaf(ctx, s, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.quadraticCurveTo(s * 0.8, -s * 0.15, 0, s);
    ctx.quadraticCurveTo(-s * 0.8, -s * 0.15, 0, -s);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,40,30,0.25)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(0, s); ctx.stroke();
  }

  function makeLeaf(W, H, colors, mid) {
    return {
      x: rand(W * 0.15, W * 0.9),
      y: mid ? rand(-H * 0.2, H) : rand(-H * 0.35, -6),
      vy: rand(H * 0.09, H * 0.18),
      sway: rand(W * 0.04, W * 0.11),
      ph: rand(0, Math.PI * 2),
      psp: rand(0.6, 1.3),
      rot: rand(0, Math.PI * 2),
      vrot: rand(-1.4, 1.4),
      size: Math.max(3.5, W * rand(0.05, 0.08)),
      color: colors[Math.floor(Math.random() * colors.length)]
    };
  }

  function createLeaves(host, opts) {
    if (!host) return null;
    opts = opts || {};
    var colors = opts.colors || ['#c0492e', '#d2691e', '#dd8a2c', '#a83b22', '#c2603a'];
    var count = opts.count || 5;
    var canvas = document.createElement('canvas');
    canvas.className = 'gr-leaf-canvas';
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    host.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var fxo = { host: host, canvas: canvas, ctx: ctx, W: 0, H: 0, leaves: [], visible: true, io: null, sized: false };

    function size() {
      var r = host.getBoundingClientRect();
      var w = Math.max(40, Math.round(r.width)), h = Math.max(40, Math.round(r.height));
      fxo.W = w; fxo.H = h;
      canvas.width = Math.round(w * DPR); canvas.height = Math.round(h * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      fxo.leaves = [];
      for (var i = 0; i < count; i++) fxo.leaves.push(makeLeaf(w, h, colors, true));
      fxo.sized = true;
    }
    fxo.step = function (dt) {
      for (var i = 0; i < fxo.leaves.length; i++) {
        var L = fxo.leaves[i];
        L.y += L.vy * dt; L.ph += L.psp * dt; L.rot += L.vrot * dt;
        if (L.y > fxo.H + 8) fxo.leaves[i] = makeLeaf(fxo.W, fxo.H, colors, false);
      }
    };
    fxo.draw = function () {
      if (!fxo.sized) { size(); if (!fxo.sized) return; }
      ctx.clearRect(0, 0, fxo.W, fxo.H);
      for (var i = 0; i < fxo.leaves.length; i++) {
        var L = fxo.leaves[i];
        ctx.save();
        ctx.translate(L.x + Math.sin(L.ph) * L.sway, L.y);
        ctx.rotate(L.rot);
        ctx.globalAlpha = 0.85;
        drawLeaf(ctx, L.size, L.color);
        ctx.restore();
      }
    };
    fxo.destroy = function () {
      if (fxo.io) { try { fxo.io.disconnect(); } catch (e) {} fxo.io = null; }
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
    if (window.IntersectionObserver) {
      fxo.io = new IntersectionObserver(function (entries) {
        fxo.visible = entries[0] && entries[0].isIntersecting;
        if (fxo.visible && !reduce) start();
      }, { rootMargin: '80px' });
      fxo.io.observe(host);
    }
    ponds.push(fxo);
    if (reduce) requestAnimationFrame(function () { fxo.draw(); }); else start();
    return { destroy: fxo.destroy };
  }

  // ── butterfly ──────────────────────────────────────────────────────────
  // A butterfly wanders the host area on an eased target-seeking path, wings
  // flapping. Reads as a creature visiting the plant.
  var BFLY = [
    { top: 'rgba(235,130,36,0.96)', bot: 'rgba(198,82,26,0.96)', edge: 'rgba(40,26,14,0.85)' }, // monarch
    { top: 'rgba(86,140,222,0.95)', bot: 'rgba(52,96,178,0.95)', edge: 'rgba(20,30,64,0.8)' },  // blue
    { top: 'rgba(244,206,70,0.96)', bot: 'rgba(214,160,40,0.96)', edge: 'rgba(70,48,12,0.85)' } // yellow
  ];
  function createButterfly(host, opts) {
    if (!host) return null;
    opts = opts || {};
    var canvas = document.createElement('canvas');
    canvas.className = 'gr-bfly-canvas';
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    host.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var pal = BFLY[Math.floor(Math.random() * BFLY.length)];
    var fxo = { host: host, canvas: canvas, ctx: ctx, W: 0, H: 0, visible: true, io: null, sized: false,
      x: 0, y: 0, tx: 0, ty: 0, flap: rand(0, 6), rest: 0, heading: 0, size: opts.size || 5.5 };

    function newTarget() { fxo.tx = rand(fxo.W * 0.15, fxo.W * 0.85); fxo.ty = rand(fxo.H * 0.12, fxo.H * 0.66); }
    function size() {
      var r = host.getBoundingClientRect();
      fxo.W = Math.max(40, Math.round(r.width)); fxo.H = Math.max(40, Math.round(r.height));
      canvas.width = Math.round(fxo.W * DPR); canvas.height = Math.round(fxo.H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      fxo.x = fxo.W * 0.5; fxo.y = fxo.H * 0.4; newTarget();
      fxo.sized = true;
    }
    fxo.step = function (dt) {
      fxo.flap += dt * (fxo.rest > 0 ? 4 : 13);
      if (fxo.rest > 0) { fxo.rest -= dt; return; }
      var dx = fxo.tx - fxo.x, dy = fxo.ty - fxo.y;
      var d = Math.hypot(dx, dy) || 1;
      var sp = Math.min(d, fxo.W * 0.6 * dt);
      fxo.x += (dx / d) * sp; fxo.y += (dy / d) * sp + Math.sin(fxo.flap * 0.5) * 0.4;
      fxo.heading = Math.atan2(dy, dx);
      if (d < 7) { if (Math.random() < 0.4) fxo.rest = rand(0.4, 1.4); newTarget(); }
    };
    fxo.draw = function () {
      if (!fxo.sized) { size(); if (!fxo.sized) return; }
      ctx.clearRect(0, 0, fxo.W, fxo.H);
      var open = Math.abs(Math.cos(fxo.flap)) * 0.8 + 0.2; // wing spread (flap)
      var s = fxo.size;
      ctx.save();
      ctx.translate(fxo.x, fxo.y);
      ctx.rotate(Math.sin(fxo.heading) * 0.25);
      ctx.lineWidth = 0.7; ctx.lineJoin = 'round';
      for (var side = -1; side <= 1; side += 2) {
        ctx.save(); ctx.scale(side * open, 1);
        // forewing (upper) — rounded triangle
        ctx.fillStyle = pal.top; ctx.strokeStyle = pal.edge;
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.1);
        ctx.quadraticCurveTo(s * 1.4, -s * 1.3, s * 1.7, -s * 0.2);
        ctx.quadraticCurveTo(s * 1.1, s * 0.05, 0, -s * 0.1);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // hindwing (lower) — smaller lobe
        ctx.fillStyle = pal.bot;
        ctx.beginPath();
        ctx.moveTo(0, s * 0.05);
        ctx.quadraticCurveTo(s * 1.15, s * 0.5, s * 0.85, s * 1.15);
        ctx.quadraticCurveTo(s * 0.3, s * 0.7, 0, s * 0.05);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      // body
      ctx.fillStyle = 'rgba(38,30,26,0.92)';
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.15, s * 0.9, 0, 0, Math.PI * 2); ctx.fill();
      // antennae
      ctx.strokeStyle = 'rgba(38,30,26,0.8)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(0, -s * 0.7); ctx.quadraticCurveTo(s * 0.5, -s * 1.5, s * 0.75, -s * 1.35);
      ctx.moveTo(0, -s * 0.7); ctx.quadraticCurveTo(-s * 0.5, -s * 1.5, -s * 0.75, -s * 1.35); ctx.stroke();
      ctx.restore();
    };
    fxo.destroy = function () { if (fxo.io) { try { fxo.io.disconnect(); } catch (e) {} fxo.io = null; } if (canvas.parentNode) canvas.parentNode.removeChild(canvas); };
    if (window.IntersectionObserver) {
      fxo.io = new IntersectionObserver(function (e) { fxo.visible = e[0] && e[0].isIntersecting; if (fxo.visible && !reduce) start(); }, { rootMargin: '80px' });
      fxo.io.observe(host);
    }
    ponds.push(fxo);
    if (reduce) requestAnimationFrame(function () { fxo.draw(); }); else start();
    return { destroy: fxo.destroy };
  }

  // ── shishi-odoshi (bamboo water clacker) ───────────────────────────────
  // The classic deer-scarer: the front cup fills with water, tips forward to
  // pour, then the back end swings down and clacks on the stone, resetting.
  function createClacker(host) {
    if (!host) return null;
    var canvas = document.createElement('canvas');
    canvas.className = 'gr-clacker-canvas';
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    host.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var REST = -0.16, POUR = 0.5, CLACK = -0.34;
    var fxo = { host: host, canvas: canvas, ctx: ctx, W: 0, H: 0, visible: true, io: null, sized: false,
      angle: REST, fill: 0, phase: 'fill', splash: 0 };

    function size() {
      var r = host.getBoundingClientRect();
      fxo.W = Math.max(40, Math.round(r.width)); fxo.H = Math.max(40, Math.round(r.height));
      canvas.width = Math.round(fxo.W * DPR); canvas.height = Math.round(fxo.H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      fxo.sized = true;
    }
    fxo.step = function (dt) {
      if (fxo.splash > 0) fxo.splash -= dt;
      if (fxo.phase === 'fill') {
        fxo.fill += dt * 0.32; fxo.angle = REST + fxo.fill * 0.10;
        if (fxo.fill >= 1) { fxo.fill = 1; fxo.phase = 'pour'; }
      } else if (fxo.phase === 'pour') {
        fxo.angle += dt * 3.2; fxo.fill = Math.max(0, fxo.fill - dt * 2.4);
        if (fxo.angle >= POUR) { fxo.angle = POUR; fxo.phase = 'back'; }
      } else if (fxo.phase === 'back') {
        fxo.angle -= dt * 4.5;
        if (fxo.angle <= CLACK) { fxo.angle = CLACK; fxo.phase = 'settle'; fxo.splash = 0.3; }
      } else { // settle — ease back up to rest
        fxo.angle += (REST - fxo.angle) * Math.min(1, dt * 8);
        if (Math.abs(fxo.angle - REST) < 0.01) { fxo.angle = REST; fxo.phase = 'fill'; fxo.fill = 0; }
      }
    };
    fxo.draw = function () {
      if (!fxo.sized) { size(); if (!fxo.sized) return; }
      var W = fxo.W, H = fxo.H;
      ctx.clearRect(0, 0, W, H);
      var pivotX = W * 0.56, pivotY = H * 0.52;

      // basin + stone
      ctx.fillStyle = 'rgba(40,70,80,0.5)';
      ctx.beginPath(); ctx.ellipse(W * 0.4, H * 0.86, W * 0.34, H * 0.09, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8a8f8c';
      ctx.beginPath(); ctx.ellipse(W * 0.34, H * 0.78, W * 0.12, H * 0.06, 0, 0, Math.PI * 2); ctx.fill();

      // water source spout (upper right) + stream while filling
      ctx.strokeStyle = '#6f8f4a'; ctx.lineWidth = Math.max(3, W * 0.04); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(W * 0.92, H * 0.06); ctx.lineTo(W * 0.74, H * 0.16); ctx.stroke();
      if (fxo.phase === 'fill') {
        ctx.strokeStyle = 'rgba(180,210,225,0.7)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(W * 0.73, H * 0.18); ctx.lineTo(W * 0.70, pivotY - H * 0.02); ctx.stroke();
      }

      // pivot fork
      ctx.strokeStyle = '#7a5a36'; ctx.lineWidth = Math.max(3, W * 0.045); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(pivotX, pivotY); ctx.lineTo(pivotX - W * 0.04, H * 0.84); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pivotX, pivotY); ctx.lineTo(pivotX + W * 0.06, H * 0.84); ctx.stroke();

      // the bamboo tube (pivoted)
      ctx.save();
      ctx.translate(pivotX, pivotY); ctx.rotate(fxo.angle);
      var tubeLen = W * 0.62, tubeR = Math.max(5, W * 0.075), frontX = -tubeLen * 0.6, backX = tubeLen * 0.4;
      // body
      ctx.fillStyle = '#9bad5e';
      roundRect(ctx, frontX, -tubeR, backX - frontX, tubeR * 2, tubeR);
      ctx.fill();
      ctx.fillStyle = 'rgba(60,80,30,0.25)'; // shade
      roundRect(ctx, frontX, tubeR * 0.1, backX - frontX, tubeR * 0.9, tubeR * 0.5); ctx.fill();
      // node rings
      ctx.strokeStyle = 'rgba(70,90,35,0.6)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(frontX + (backX - frontX) * 0.5, -tubeR); ctx.lineTo(frontX + (backX - frontX) * 0.5, tubeR); ctx.stroke();
      // open front cup + water inside (proportional to fill)
      ctx.fillStyle = '#43361f';
      ctx.beginPath(); ctx.ellipse(frontX, 0, tubeR * 0.5, tubeR, 0, 0, Math.PI * 2); ctx.fill();
      if (fxo.fill > 0.02) {
        ctx.fillStyle = 'rgba(120,175,195,0.85)';
        ctx.beginPath(); ctx.ellipse(frontX + tubeR * 0.1, tubeR * (1 - fxo.fill), tubeR * 0.42, tubeR * fxo.fill, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      // pour stream + splash
      if (fxo.phase === 'pour' && fxo.fill > 0.1) {
        ctx.strokeStyle = 'rgba(150,195,215,0.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(pivotX - tubeLen * 0.55, pivotY + tubeLen * 0.25); ctx.lineTo(W * 0.28, H * 0.8); ctx.stroke();
      }
      if (fxo.splash > 0) {
        ctx.globalAlpha = fxo.splash / 0.3; ctx.strokeStyle = 'rgba(210,225,230,0.9)'; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.arc(W * 0.34, H * 0.78, (0.3 - fxo.splash) * W * 0.5 + 3, Math.PI, 2 * Math.PI); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    };
    function roundRect(c, x, y, w, h, r) {
      c.beginPath();
      c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
    }
    fxo.destroy = function () { if (fxo.io) { try { fxo.io.disconnect(); } catch (e) {} fxo.io = null; } if (canvas.parentNode) canvas.parentNode.removeChild(canvas); };
    if (window.IntersectionObserver) {
      fxo.io = new IntersectionObserver(function (e) { fxo.visible = e[0] && e[0].isIntersecting; if (fxo.visible && !reduce) start(); }, { rootMargin: '80px' });
      fxo.io.observe(host);
    }
    ponds.push(fxo);
    if (reduce) requestAnimationFrame(function () { fxo.draw(); }); else start();
    return { destroy: fxo.destroy };
  }

  window.JPShared.gardenStage = {
    createPond: createPond, createLeaves: createLeaves,
    createButterfly: createButterfly, createClacker: createClacker, reset: reset
  };
})();

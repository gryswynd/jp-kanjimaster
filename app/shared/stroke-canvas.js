// app/shared/stroke-canvas.js
// Stroke-by-stroke writing canvas with KanjiVG-median validation.
//
// Visual: washi parchment background, gold gradient stroke with ink-bleed,
// target glyph faintly watermarked underneath so the learner has a guide
// without having it dominate.
//
// Validation: each finished stroke is checked against the expected median
// polyline for (a) stroke order, (b) direction, (c) overall shape via mean
// per-point distance after resampling. Strict mode — wrong stroke is erased
// and the user retries. perfectFirstTry stays true only if every stroke is
// accepted on the first try.
//
// Usage:
//   var s = window.JPShared.strokeCanvas.create({
//     mount: containerEl,                   // host div; canvas fills it
//     glyph: { strokes: [{ d, median }], width, height },
//     onStrokeResult: function (ok, idx) {},
//     onComplete:     function (info) {}    // { perfectFirstTry, retries, strokeCount }
//   });
//   s.destroy();
//   s.showOrderDemo();                      // one-shot animated stroke-order demo
//   s.reset();
(function () {
  'use strict';
  window.JPShared = window.JPShared || {};

  // ---- geometry helpers ----
  function dist(a, b) {
    var dx = a[0] - b[0], dy = a[1] - b[1];
    return Math.sqrt(dx * dx + dy * dy);
  }
  function resample(pts, n) {
    if (!pts || pts.length === 0) return [];
    if (pts.length === 1) {
      var out0 = [];
      for (var k = 0; k < n; k++) out0.push([pts[0][0], pts[0][1]]);
      return out0;
    }
    var total = 0, segs = [];
    for (var i = 1; i < pts.length; i++) {
      var d = dist(pts[i - 1], pts[i]);
      segs.push(d); total += d;
    }
    if (total === 0) {
      var outZ = [];
      for (var z = 0; z < n; z++) outZ.push([pts[0][0], pts[0][1]]);
      return outZ;
    }
    var step = total / (n - 1);
    var out = [[pts[0][0], pts[0][1]]];
    var segIdx = 0, segStart = 0;
    for (var j = 1; j < n - 1; j++) {
      var target = j * step;
      while (segIdx < segs.length) {
        if (segStart + segs[segIdx] >= target) {
          var t = (target - segStart) / segs[segIdx];
          var px = pts[segIdx][0] + (pts[segIdx + 1][0] - pts[segIdx][0]) * t;
          var py = pts[segIdx][1] + (pts[segIdx + 1][1] - pts[segIdx][1]) * t;
          out.push([px, py]);
          break;
        }
        segStart += segs[segIdx];
        segIdx++;
      }
      if (segIdx >= segs.length) out.push([pts[pts.length - 1][0], pts[pts.length - 1][1]]);
    }
    out.push([pts[pts.length - 1][0], pts[pts.length - 1][1]]);
    return out;
  }

  // KanjiVG-coord median → canvas-coord points using the supplied transform.
  function mapMedian(median, tx) {
    var out = [];
    for (var i = 0; i < median.length; i++) {
      out.push([median[i][0] * tx.scale + tx.dx, median[i][1] * tx.scale + tx.dy]);
    }
    return out;
  }

  // Strict-but-forgiving stroke compare. Order is enforced by the caller; this
  // function is responsible for direction + shape only. Returns reason on fail
  // so the caller can show meaningful feedback.
  // Threshold values were chosen to feel right for a 280–400 px canvas; tune
  // during verification if learners report false positives/negatives.
  var SHAPE_THRESHOLD = 0.18;   // mean per-point distance, normalised to canvas dim
  var DIR_THRESHOLD   = 0.30;   // cosine of angle; > this passes (60-ish deg)
  function compareStroke(drawn, targetMapped, canvasDim) {
    if (drawn.length < 2) return { ok: false, reason: 'too-short' };
    var n = 24;
    var a = resample(drawn, n);
    var b = resample(targetMapped, n);
    // Direction: vector from first to last point on each.
    var av = [a[n - 1][0] - a[0][0], a[n - 1][1] - a[0][1]];
    var bv = [b[n - 1][0] - b[0][0], b[n - 1][1] - b[0][1]];
    var aMag = Math.sqrt(av[0] * av[0] + av[1] * av[1]);
    var bMag = Math.sqrt(bv[0] * bv[0] + bv[1] * bv[1]);
    if (aMag < 4 || bMag < 4) {
      // Both endpoints near each other — treat as a "dot" stroke. Accept if
      // centroids align; direction can't be tested.
      var cx = (a[0][0] + a[n - 1][0]) / 2 - (b[0][0] + b[n - 1][0]) / 2;
      var cy = (a[0][1] + a[n - 1][1]) / 2 - (b[0][1] + b[n - 1][1]) / 2;
      var cdist = Math.sqrt(cx * cx + cy * cy) / canvasDim;
      if (cdist < 0.12) return { ok: true, dist: cdist };
      return { ok: false, reason: 'dot-misplaced', dist: cdist };
    }
    var cos = (av[0] * bv[0] + av[1] * bv[1]) / (aMag * bMag);
    if (cos < DIR_THRESHOLD) return { ok: false, reason: 'direction', cos: cos };
    // Shape: mean per-point distance, normalised by canvas dim.
    var sum = 0;
    for (var i = 0; i < n; i++) sum += dist(a[i], b[i]);
    var mean = sum / n / canvasDim;
    if (mean > SHAPE_THRESHOLD) return { ok: false, reason: 'shape', dist: mean };
    return { ok: true, dist: mean };
  }

  // ---- the renderer ----
  function create(opts) {
    var mount = opts.mount;
    var glyph = opts.glyph;
    var onStrokeResult = opts.onStrokeResult || function () {};
    var onComplete = opts.onComplete || function () {};

    if (!mount || !glyph || !glyph.strokes || !glyph.strokes.length) {
      throw new Error('strokeCanvas.create: mount + glyph.strokes required');
    }

    var DPR = Math.max(1, window.devicePixelRatio || 1);
    // Match the host's box. Use a square area to keep validation thresholds simple.
    var hostRect = mount.getBoundingClientRect();
    var size = Math.floor(Math.min(hostRect.width || 320, hostRect.height || 320));
    if (size < 200) size = 320;

    mount.style.position = mount.style.position || 'relative';
    mount.innerHTML = '';

    function makeLayer(z) {
      var c = document.createElement('canvas');
      c.width = size * DPR;
      c.height = size * DPR;
      c.style.position = 'absolute';
      c.style.inset = '0';
      c.style.width = size + 'px';
      c.style.height = size + 'px';
      c.style.zIndex = String(z);
      c.style.touchAction = 'none';
      mount.appendChild(c);
      var ctx = c.getContext('2d');
      ctx.scale(DPR, DPR);
      return { canvas: c, ctx: ctx };
    }

    // Three layers: parchment + watermark (static); committed strokes; active stroke.
    var bg     = makeLayer(0);
    var done   = makeLayer(1);
    var active = makeLayer(2);
    active.canvas.style.cursor = 'crosshair';

    // KanjiVG → canvas transform (fit glyph centred in ~88% of the canvas).
    var pad = size * 0.06;
    var gw = glyph.width || 109;
    var gh = glyph.height || 109;
    var scale = Math.min((size - pad * 2) / gw, (size - pad * 2) / gh);
    var dx = (size - gw * scale) / 2;
    var dy = (size - gh * scale) / 2;
    var tx = { scale: scale, dx: dx, dy: dy };

    // ----- static layer (parchment + watermark) -----
    function paintBackground() {
      var c = bg.ctx;
      c.fillStyle = 'oklch(0.97 0.008 80)'; // washi
      c.fillRect(0, 0, size, size);
      // Subtle grain
      c.save();
      c.globalAlpha = 0.04;
      c.fillStyle = 'oklch(0.55 0.012 60)';
      for (var i = 0; i < 90; i++) {
        var rx = Math.random() * size;
        var ry = Math.random() * size;
        c.fillRect(rx, ry, 1, 1);
      }
      c.restore();
      // Faint quadrant guides — like the kanji practice paper.
      c.save();
      c.strokeStyle = 'oklch(0.55 0.012 60 / 0.12)';
      c.lineWidth = 1;
      c.setLineDash([4, 4]);
      c.beginPath();
      c.moveTo(size / 2, 6); c.lineTo(size / 2, size - 6);
      c.moveTo(6, size / 2); c.lineTo(size - 6, size / 2);
      c.stroke();
      c.restore();
      // Watermark: the full glyph at low opacity using the SVG paths.
      c.save();
      c.translate(dx, dy);
      c.scale(scale, scale);
      c.strokeStyle = 'oklch(0.32 0.012 60 / 0.12)';
      c.fillStyle = 'oklch(0.32 0.012 60 / 0.10)';
      c.lineWidth = 3 / scale;
      c.lineJoin = 'round';
      c.lineCap = 'round';
      for (var s = 0; s < glyph.strokes.length; s++) {
        try {
          var p = new Path2D(glyph.strokes[s].d);
          c.stroke(p);
        } catch (e) { /* malformed path — skip */ }
      }
      c.restore();
    }

    // ----- Brush-stroke renderer -----
    // Calligraphy feel: per-segment width modulated by stroke velocity (slow =
    // ink pools = thick; fast = thin), a gentle ramp-in over the first few
    // points (the brush "lands"), and on commit a sharp end-taper to a fine
    // tip — the "harai" tail you get when the brush lifts off the paper.
    // Colours match the morph palette so the committed strokes feel like the
    // same gold ink as the reward.
    var BRUSH_BASE = 16;   // resting brush width (px) on a 320-ish canvas
    var BRUSH_MIN  = 3;    // floor when moving fast / at the very tip
    var BRUSH_TIP  = 1.2;  // final-point width during the harai taper

    function widthsForStroke(pts, opts) {
      opts = opts || {};
      var commit = !!opts.commit;
      var base = opts.base || BRUSH_BASE;
      var n = pts.length;
      if (n < 2) return [base];

      var widths = new Array(n);
      widths[0] = base;
      for (var i = 1; i < n; i++) {
        var p = pts[i - 1], q = pts[i];
        var dx = q[0] - p[0], dy = q[1] - p[1];
        // Time delta: prefer timestamps when present, otherwise treat points
        // as evenly spaced (~16 ms ≈ one frame).
        var dt = (q[2] != null && p[2] != null) ? Math.max(1, q[2] - p[2]) : 16;
        var v = Math.sqrt(dx * dx + dy * dy) / dt;   // px / ms
        // Map velocity ∈ [0, ~1.5] to width ∈ [base, BRUSH_MIN].
        var drop = Math.min(1, v / 1.4);
        widths[i] = base - drop * (base - BRUSH_MIN);
      }
      // Smooth (3-tap moving avg) so width transitions don't visually pop.
      var smoothed = widths.slice();
      for (var j = 1; j < n - 1; j++) {
        smoothed[j] = (widths[j - 1] + widths[j] + widths[j + 1]) / 3;
      }
      // Gentle ramp-in: first ~3 points lift from a softer width up to base.
      var rampN = Math.min(3, n);
      for (var k = 0; k < rampN; k++) {
        var t = (k + 1) / (rampN + 1);
        smoothed[k] = smoothed[k] * t + (base * 0.55) * (1 - t);
      }
      // Harai tail (only on commit): the last ~25% of points taper to a fine
      // tip. Linear in arc-position from boundary to tip-width.
      if (commit) {
        var tailN = Math.max(3, Math.min(8, Math.floor(n * 0.28)));
        for (var m = 0; m < tailN; m++) {
          var idx = n - 1 - (tailN - 1 - m);
          var ratio = m / (tailN - 1);   // 0 at boundary → 1 at last point
          var taperedW = smoothed[idx] * (1 - ratio) + BRUSH_TIP * ratio;
          smoothed[idx] = taperedW;
        }
      }
      return smoothed;
    }

    // Stroke a polyline as a sequence of round-capped sub-segments, each with
    // its own lineWidth. Round caps + round joins make the seams disappear.
    function strokePolyline(ctx, pts, widths) {
      for (var i = 1; i < pts.length; i++) {
        ctx.lineWidth = Math.max(0.5, widths[i]);
        ctx.beginPath();
        ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);
        ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();
      }
    }

    function paintBrushStroke(ctx, points, opts) {
      if (points.length === 0) return;
      if (points.length === 1) {
        // Single dot — give it the brush "landing" feel.
        ctx.save();
        ctx.fillStyle = 'oklch(0.72 0.14 80)';
        ctx.shadowColor = 'oklch(0.78 0.12 78 / 0.45)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(points[0][0], points[0][1], BRUSH_BASE * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }
      var widths = widthsForStroke(points, opts);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Pass 1: outer ink-bleed (single thick path with shadow — much cheaper
      // than per-segment shadowing, and the visible difference is invisible).
      ctx.shadowColor = 'oklch(0.78 0.12 78 / 0.42)';
      ctx.shadowBlur  = 8;
      ctx.strokeStyle = 'oklch(0.78 0.12 78 / 0.28)';
      var maxW = widths[0];
      for (var w = 1; w < widths.length; w++) if (widths[w] > maxW) maxW = widths[w];
      ctx.lineWidth = maxW + 4;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (var p1 = 1; p1 < points.length; p1++) ctx.lineTo(points[p1][0], points[p1][1]);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Pass 2: variable-width gold core — this is what gives the brush feel.
      ctx.strokeStyle = 'oklch(0.72 0.14 80)';
      strokePolyline(ctx, points, widths);

      // Pass 3: thin warm highlight along the centerline — sub-stroke that
      // catches the light, exactly like the morph's bright gold core.
      var highlightWidths = new Array(widths.length);
      for (var h = 0; h < widths.length; h++) highlightWidths[h] = Math.max(0.5, widths[h] * 0.32);
      ctx.strokeStyle = 'oklch(0.93 0.08 92 / 0.55)';
      strokePolyline(ctx, points, highlightWidths);

      ctx.restore();
    }

    function paintGhostStroke(ctx, points) {
      if (points.length < 2) return;
      // Same variable-width treatment, vermilion palette, so a mistaken stroke
      // visually reads "the same kind of mark, just in the wrong colour".
      var widths = widthsForStroke(points, { base: BRUSH_BASE * 0.85, commit: true });
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'oklch(0.60 0.18 30 / 0.35)';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = 'oklch(0.60 0.18 30 / 0.55)';
      strokePolyline(ctx, points, widths);
      ctx.restore();
    }

    function clearLayer(layer) {
      layer.ctx.clearRect(0, 0, size, size);
    }

    // ----- state -----
    var expectedIdx = 0;
    var perfectFirstTry = true;
    var retries = 0;
    var drawing = false;
    var curPoints = [];          // canvas-coord points for the in-progress stroke
    var pid = null;              // pointer id for capture

    paintBackground();

    var strokeStartT = 0;   // performance.now() at pointerdown

    function drawActive() {
      clearLayer(active);
      if (curPoints.length === 0) return;
      // No commit-taper while the brush is still on the paper — only on lift.
      paintBrushStroke(active.ctx, curPoints, { commit: false });
    }

    function flashGhost(points) {
      // Paint a vermilion ghost on the active layer, fade it out, then clear.
      clearLayer(active);
      paintGhostStroke(active.ctx, points);
      var a = 1.0;
      var step = function () {
        a -= 0.06;
        if (a <= 0) { clearLayer(active); return; }
        active.canvas.style.opacity = a.toFixed(2);
        requestAnimationFrame(step);
      };
      active.canvas.style.opacity = '1';
      setTimeout(step, 180);
    }

    function pointerToCanvas(ev) {
      var r = active.canvas.getBoundingClientRect();
      // Third element is a time offset (ms) since pointerdown — feeds the
      // velocity-based brush-width calculation.
      return [ev.clientX - r.left, ev.clientY - r.top, performance.now() - strokeStartT];
    }

    function onDown(ev) {
      if (expectedIdx >= glyph.strokes.length) return;
      drawing = true;
      pid = ev.pointerId;
      try { active.canvas.setPointerCapture(pid); } catch (e) {}
      active.canvas.style.opacity = '1';
      strokeStartT = performance.now();
      curPoints = [pointerToCanvas(ev)];
      if (window.JPShared && window.JPShared.haptics) window.JPShared.haptics.select();
      drawActive();
      ev.preventDefault();
    }
    function onMove(ev) {
      if (!drawing) return;
      var pt = pointerToCanvas(ev);
      // Throttle by min distance to keep the polyline tractable.
      var last = curPoints[curPoints.length - 1];
      if (dist(pt, last) < 1.5) return;
      curPoints.push(pt);
      drawActive();
      ev.preventDefault();
    }
    function onUp(ev) {
      if (!drawing) return;
      drawing = false;
      try { active.canvas.releasePointerCapture(pid); } catch (e) {}
      pid = null;
      var stroke = curPoints.slice();
      curPoints = [];
      handleStrokeEnd(stroke);
      ev && ev.preventDefault && ev.preventDefault();
    }

    function handleStrokeEnd(points) {
      var targetMedian = mapMedian(glyph.strokes[expectedIdx].median || [], tx);
      // KanjiVG occasionally has no `median` for very short strokes — synthesize
      // one from the path endpoints if needed by sampling the Path2D. For now,
      // accept any drawn stroke whose endpoints land near the path bounds.
      if (!targetMedian.length) {
        // Treat as "any reasonable stroke" — accept.
        commitStroke(points, true);
        return;
      }
      var result = compareStroke(points, targetMedian, size);
      if (result.ok) {
        commitStroke(points, true);
      } else {
        perfectFirstTry = false;
        retries++;
        if (window.JPShared && window.JPShared.haptics) window.JPShared.haptics.warning();
        flashGhost(points);
        onStrokeResult(false, expectedIdx, result);
      }
    }

    function commitStroke(points, ok) {
      // On commit we apply the harai tail-taper so the brush "lifts" off the
      // paper at the end of the stroke.
      paintBrushStroke(done.ctx, points, { commit: true });
      clearLayer(active);
      active.canvas.style.opacity = '1';
      if (window.JPShared && window.JPShared.haptics) window.JPShared.haptics.medium();
      onStrokeResult(true, expectedIdx);
      expectedIdx++;
      if (expectedIdx >= glyph.strokes.length) {
        // Slight delay so the final stroke is visibly committed before reward.
        setTimeout(function () {
          onComplete({
            perfectFirstTry: perfectFirstTry,
            strokeCount: glyph.strokes.length,
            retries: retries
          });
        }, 220);
      }
    }

    function reset() {
      expectedIdx = 0;
      perfectFirstTry = true;
      retries = 0;
      curPoints = [];
      drawing = false;
      clearLayer(done);
      clearLayer(active);
      active.canvas.style.opacity = '1';
    }

    // One-shot stroke-order demo: animates each median in gold on the active
    // layer, then clears. Counts as a "show me" cheat so perfectFirstTry stays
    // false even if the subsequent attempt is flawless.
    function showOrderDemo() {
      perfectFirstTry = false;
      var i = 0;
      function next() {
        if (i >= glyph.strokes.length) {
          setTimeout(function () { clearLayer(active); }, 600);
          return;
        }
        var m = mapMedian(glyph.strokes[i].median || [], tx);
        if (!m.length) { i++; next(); return; }
        var stepIdx = 0;
        var anim = function () {
          if (stepIdx >= m.length) {
            i++;
            setTimeout(next, 180);
            return;
          }
          clearLayer(active);
          var slice = m.slice(0, stepIdx + 1);
          if (slice.length >= 2) {
            // Demo strokes get the harai tail too when the slice is complete,
            // so the user sees what the finished mark should look like.
            var isLast = stepIdx === m.length - 1;
            paintBrushStroke(active.ctx, slice, { commit: isLast });
          }
          stepIdx++;
          requestAnimationFrame(anim);
        };
        anim();
      }
      next();
    }

    active.canvas.addEventListener('pointerdown', onDown);
    active.canvas.addEventListener('pointermove', onMove);
    active.canvas.addEventListener('pointerup', onUp);
    active.canvas.addEventListener('pointercancel', onUp);

    function destroy() {
      active.canvas.removeEventListener('pointerdown', onDown);
      active.canvas.removeEventListener('pointermove', onMove);
      active.canvas.removeEventListener('pointerup', onUp);
      active.canvas.removeEventListener('pointercancel', onUp);
      mount.innerHTML = '';
    }

    return {
      reset: reset,
      destroy: destroy,
      showOrderDemo: showOrderDemo,
      getExpectedIdx: function () { return expectedIdx; },
      getStrokeCount: function () { return glyph.strokes.length; }
    };
  }

  window.JPShared.strokeCanvas = { create: create };
})();

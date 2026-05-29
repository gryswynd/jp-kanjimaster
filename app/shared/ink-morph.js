// app/shared/ink-morph.js
// Kanji → meaning ink-dissolve morph, used as the perfect-writing reward.
// Snapshot of _poc/kanji_morph/morph.js, adapted to the IIFE / window.JPShared
// pattern used by every other shared module. Re-sync from the POC when the
// morph design changes — the algorithm itself is intentionally kept identical.
//
// Usage:
//   const morph = new window.JPShared.inkMorph.InkMorph(canvasEl, { size: 512 });
//   await morph.preload([{ key: 'yama', kanji: 'assets/morph/kanji_yama.png',
//                          meaning: 'assets/morph/meaning_yama.png' }]);
//   await morph.play('yama', { duration: 1400, holdAfter: 1800 });
(function () {
  'use strict';
  window.JPShared = window.JPShared || {};

  var clamp = function (x, lo, hi) { return Math.max(lo, Math.min(hi, x)); };
  var smoothstep = function (a, b, x) {
    var t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  function mulberry32(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Multi-octave value noise, normalised to 0..1.
  function makeNoiseField(size, seed) {
    var rng = mulberry32(seed || 1);
    var octaves = [
      { cells: 6,  weight: 1.0  },
      { cells: 14, weight: 0.55 },
      { cells: 28, weight: 0.30 }
    ];
    var grids = octaves.map(function (o) {
      var c = o.cells + 1;
      var g = new Float32Array(c * c);
      for (var i = 0; i < g.length; i++) g[i] = rng();
      return { cells: o.cells, weight: o.weight, c: c, g: g };
    });
    var field = new Float32Array(size * size);
    var min = Infinity, max = -Infinity;
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var v = 0;
        for (var k = 0; k < grids.length; k++) {
          var o = grids[k];
          var fx = (x / size) * o.cells;
          var fy = (y / size) * o.cells;
          var x0 = Math.floor(fx), y0 = Math.floor(fy);
          var sx = fx - x0, sy = fy - y0;
          var a = o.g[y0 * o.c + x0];
          var b = o.g[y0 * o.c + (x0 + 1)];
          var cc = o.g[(y0 + 1) * o.c + x0];
          var d = o.g[(y0 + 1) * o.c + (x0 + 1)];
          var u = sx * sx * (3 - 2 * sx);
          var vv = sy * sy * (3 - 2 * sy);
          var top = a + (b - a) * u;
          var bot = cc + (d - cc) * u;
          v += (top + (bot - top) * vv) * o.weight;
        }
        field[y * size + x] = v;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    for (var i = 0; i < field.length; i++) field[i] = (field[i] - min) / (max - min);
    return field;
  }

  // alpha = max(r,g,b) — gold strokes stay opaque, the black background goes transparent.
  function preprocessGoldOnBlack(img, size) {
    var c = document.createElement('canvas');
    c.width = size; c.height = size;
    var ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, size, size);
    var data = ctx.getImageData(0, 0, size, size);
    var d = data.data;
    for (var i = 0; i < d.length; i += 4) {
      var lum = Math.max(d[i], d[i + 1], d[i + 2]);
      d[i + 3] = lum;
    }
    ctx.putImageData(data, 0, 0);
    return c;
  }

  function InkMorph(canvas, opts) {
    opts = opts || {};
    var size = opts.size || 512;
    this.canvas = canvas;
    this.size = size;
    canvas.width = size;
    canvas.height = size;
    this.ctx = canvas.getContext('2d');
    this.pairs = new Map();
    this.noise = makeNoiseField(size, 1337);
  }

  InkMorph.prototype.preload = function (entries) {
    var self = this;
    var load = function (url) {
      return new Promise(function (res, rej) {
        var im = new Image();
        im.onload = function () { res(im); };
        im.onerror = rej;
        im.src = url;
      });
    };
    var jobs = entries.map(function (e) {
      return Promise.all([load(e.kanji), load(e.meaning)]).then(function (imgs) {
        var kCanvas = preprocessGoldOnBlack(imgs[0], self.size);
        var mCanvas = preprocessGoldOnBlack(imgs[1], self.size);
        self.pairs.set(e.key, {
          kanji:   kCanvas.getContext('2d').getImageData(0, 0, self.size, self.size),
          meaning: mCanvas.getContext('2d').getImageData(0, 0, self.size, self.size)
        });
      });
    });
    return Promise.all(jobs);
  };

  InkMorph.prototype.showKanji = function (key) {
    var pair = this.pairs.get(key);
    if (!pair) return;
    this.ctx.clearRect(0, 0, this.size, this.size);
    this.ctx.putImageData(pair.kanji, 0, 0);
  };

  InkMorph.prototype.showMeaning = function (key) {
    var pair = this.pairs.get(key);
    if (!pair) return;
    this.ctx.clearRect(0, 0, this.size, this.size);
    this.ctx.putImageData(pair.meaning, 0, 0);
  };

  InkMorph.prototype.play = function (key, opts) {
    opts = opts || {};
    var duration = opts.duration || 1400;
    var holdAfter = opts.holdAfter || 0;
    var pair = this.pairs.get(key);
    if (!pair) return Promise.resolve();
    var size = this.size;
    var noise = this.noise;
    var ctx = this.ctx;
    var kData = pair.kanji.data;
    var mData = pair.meaning.data;
    var out = ctx.createImageData(size, size);
    var oData = out.data;
    var FEATHER = 0.10;

    return new Promise(function (resolve) {
      var start = performance.now();
      var frame = function (now) {
        var tRaw = clamp((now - start) / duration, 0, 1);
        var t = smoothstep(0.0, 1.0, tRaw);
        var thresh = -FEATHER + t * (1 + 2 * FEATHER);

        for (var i = 0, p = 0; i < size * size; i++, p += 4) {
          var n = noise[i];
          var kMask = smoothstep(thresh - FEATHER, thresh + FEATHER, n);
          var mMask = 1 - kMask;
          var ka = (kData[p + 3] / 255) * kMask;
          var ma = (mData[p + 3] / 255) * mMask;
          var sum = ka + ma;
          if (sum <= 0) {
            oData[p] = 0; oData[p + 1] = 0; oData[p + 2] = 0; oData[p + 3] = 0;
            continue;
          }
          var capped = Math.min(1, sum);
          oData[p]     = (kData[p]     * ka + mData[p]     * ma) / sum * capped | 0;
          oData[p + 1] = (kData[p + 1] * ka + mData[p + 1] * ma) / sum * capped | 0;
          oData[p + 2] = (kData[p + 2] * ka + mData[p + 2] * ma) / sum * capped | 0;
          oData[p + 3] = Math.min(255, (ka + ma) * 255) | 0;
        }
        ctx.putImageData(out, 0, 0);

        // Gold mid-flash: radial glow peaking at t≈0.45.
        var flash = Math.pow(Math.max(0, 1 - Math.abs(tRaw - 0.45) / 0.30), 1.6);
        if (flash > 0.01) {
          var cx = size / 2, cy = size / 2;
          var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.65);
          var a = (flash * 0.55).toFixed(3);
          grad.addColorStop(0,    'rgba(255, 234, 160, ' + a + ')');
          grad.addColorStop(0.35, 'rgba(242, 212, 121, ' + (a * 0.6).toFixed(3) + ')');
          grad.addColorStop(1,    'rgba(212, 175,  55, 0)');
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, size, size);
          ctx.globalCompositeOperation = 'source-over';
        }

        if (tRaw < 1) requestAnimationFrame(frame);
        else if (holdAfter > 0) setTimeout(resolve, holdAfter);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
  };

  window.JPShared.inkMorph = { InkMorph: InkMorph };
})();

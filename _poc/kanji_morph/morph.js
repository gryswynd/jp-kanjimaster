// Kanji → meaning ink-dissolve morph.
// Two layers, masked by a value-noise field whose threshold sweeps from 0 to 1.
// Around the midpoint, a soft gold radial flash blooms and fades.
//
// Usage:
//   const morph = new InkMorph(canvasEl, { size: 512 });
//   await morph.preload([{kanji: 'kanji_yama.png', meaning: 'meaning_yama.png'}, ...]);
//   await morph.play('yama', { duration: 1400 });

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Build a multi-octave value-noise field, normalized to 0..1, organic-feeling.
function makeNoiseField(size, seed = 1) {
  const rng = mulberry32(seed);
  const octaves = [
    { cells: 6,  weight: 1.0  },
    { cells: 14, weight: 0.55 },
    { cells: 28, weight: 0.30 },
  ];
  // Pre-generate a value grid per octave.
  const grids = octaves.map(o => {
    const c = o.cells + 1;
    const g = new Float32Array(c * c);
    for (let i = 0; i < g.length; i++) g[i] = rng();
    return { ...o, c, g };
  });
  const field = new Float32Array(size * size);
  let min = Infinity, max = -Infinity;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      for (const o of grids) {
        const fx = (x / size) * o.cells;
        const fy = (y / size) * o.cells;
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const sx = fx - x0, sy = fy - y0;
        const a = o.g[y0 * o.c + x0];
        const b = o.g[y0 * o.c + (x0 + 1)];
        const c = o.g[(y0 + 1) * o.c + x0];
        const d = o.g[(y0 + 1) * o.c + (x0 + 1)];
        const u = sx * sx * (3 - 2 * sx);
        const v_ = sy * sy * (3 - 2 * sy);
        const top = a + (b - a) * u;
        const bot = c + (d - c) * u;
        v += (top + (bot - top) * v_) * o.weight;
      }
      field[y * size + x] = v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  for (let i = 0; i < field.length; i++) field[i] = (field[i] - min) / (max - min);
  return field;
}

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Draw an image to a same-size offscreen canvas, converting black bg to alpha.
// alpha = max(r,g,b) — so pure black becomes transparent, gold keeps its color.
function preprocessGoldOnBlack(img, size) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = Math.max(d[i], d[i + 1], d[i + 2]);
    d[i + 3] = lum;
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

export class InkMorph {
  constructor(canvas, { size = 512 } = {}) {
    this.canvas = canvas;
    this.size = size;
    canvas.width = size;
    canvas.height = size;
    this.ctx = canvas.getContext('2d');
    this.pairs = new Map(); // key → { kanji: ImageData, meaning: ImageData }
    this.noise = makeNoiseField(size, 1337);
  }

  async preload(entries) {
    const load = url => new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = url;
    });
    for (const e of entries) {
      const [kImg, mImg] = await Promise.all([load(e.kanji), load(e.meaning)]);
      const kCanvas = preprocessGoldOnBlack(kImg, this.size);
      const mCanvas = preprocessGoldOnBlack(mImg, this.size);
      const kCtx = kCanvas.getContext('2d');
      const mCtx = mCanvas.getContext('2d');
      this.pairs.set(e.key, {
        kanji: kCtx.getImageData(0, 0, this.size, this.size),
        meaning: mCtx.getImageData(0, 0, this.size, this.size),
      });
    }
  }

  // Quick non-morph paint: just show the kanji.
  showKanji(key) {
    const pair = this.pairs.get(key);
    if (!pair) return;
    this.ctx.clearRect(0, 0, this.size, this.size);
    this.ctx.putImageData(pair.kanji, 0, 0);
  }

  // Quick non-morph paint: just show the meaning.
  showMeaning(key) {
    const pair = this.pairs.get(key);
    if (!pair) return;
    this.ctx.clearRect(0, 0, this.size, this.size);
    this.ctx.putImageData(pair.meaning, 0, 0);
  }

  // Animate the morph from kanji to meaning over `duration` ms.
  play(key, { duration = 1400, holdAfter = 0 } = {}) {
    const pair = this.pairs.get(key);
    if (!pair) return Promise.resolve();
    const { size, noise, ctx } = this;
    const kData = pair.kanji.data;
    const mData = pair.meaning.data;
    const out = ctx.createImageData(size, size);
    const oData = out.data;
    const FEATHER = 0.10;

    return new Promise(resolve => {
      const start = performance.now();
      const frame = now => {
        const tRaw = clamp((now - start) / duration, 0, 1);
        // Ease the dissolve threshold so the midpoint dwells slightly (more dramatic).
        const t = smoothstep(0.0, 1.0, tRaw);
        // Map t to a threshold that sweeps past the [-feather, 1+feather] range
        // so the start really starts at 100% kanji and the end is 100% meaning.
        const thresh = -FEATHER + t * (1 + 2 * FEATHER);

        for (let i = 0, p = 0; i < size * size; i++, p += 4) {
          const n = noise[i];
          // kanji visible where noise > thresh (with feather)
          const kMask = smoothstep(thresh - FEATHER, thresh + FEATHER, n);
          // meaning visible where noise < thresh (with feather)
          const mMask = 1 - kMask;
          const ka = (kData[p + 3] / 255) * kMask;
          const ma = (mData[p + 3] / 255) * mMask;
          const sum = ka + ma;
          if (sum <= 0) {
            oData[p] = 0; oData[p + 1] = 0; oData[p + 2] = 0; oData[p + 3] = 0;
            continue;
          }
          // Pre-multiplied composite that preserves color identity per layer.
          oData[p]     = (kData[p]     * ka + mData[p]     * ma) / sum * Math.min(1, sum) | 0 ;
          oData[p + 1] = (kData[p + 1] * ka + mData[p + 1] * ma) / sum * Math.min(1, sum) | 0;
          oData[p + 2] = (kData[p + 2] * ka + mData[p + 2] * ma) / sum * Math.min(1, sum) | 0;
          // Cap alpha at original (we don't manufacture density).
          oData[p + 3] = Math.min(255, (ka + ma) * 255) | 0;
        }
        ctx.putImageData(out, 0, 0);

        // Gold mid-flash: radial glow blooming at t≈0.5.
        // Envelope: peaks at 0.45, falls to 0 by 0.15 and 0.8.
        const flash =
          Math.max(0, 1 - Math.abs(tRaw - 0.45) / 0.30) ** 1.6;
        if (flash > 0.01) {
          const cx = size / 2, cy = size / 2;
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.65);
          const a = (flash * 0.55).toFixed(3);
          grad.addColorStop(0,    `rgba(255, 234, 160, ${a})`);
          grad.addColorStop(0.35, `rgba(242, 212, 121, ${a * 0.6})`);
          grad.addColorStop(1,    `rgba(212, 175,  55, 0)`);
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, size, size);
          ctx.globalCompositeOperation = 'source-over';
        }

        if (tRaw < 1) {
          requestAnimationFrame(frame);
        } else if (holdAfter > 0) {
          setTimeout(resolve, holdAfter);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(frame);
    });
  }
}

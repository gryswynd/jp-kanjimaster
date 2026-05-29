#!/usr/bin/env node
// scripts/build-strokes.mjs
//
// One-time build step: produce data/strokes/{kanji,kana}.json from KanjiVG.
//
// Inputs:
//   - The union of every kanji listed in data/N5/lessons/*.json and
//     data/N4/lessons/*.json under `meta.kanji[]`.
//   - All hiragana (U+3041–U+3096) and katakana (U+30A1–U+30FA), plus the kana
//     small/voicing variants in those ranges.
//
// Source data:
//   We pull the single-file KanjiVG XML release (kanjivg-YYYYMMDD.xml.gz). If
//   a local copy already exists under tools/kanjivg-source.xml(.gz), that
//   wins — avoids hitting the network on every rebuild and lets offline
//   developers point at a checked-out KanjiVG repo's all.xml.
//
// Output JSON shape (compact, runtime-friendly):
//   {
//     "山": {
//       w: 109, h: 109,
//       strokes: [
//         { d: "M22.5,21.25...", median: [[55,18],[55,90],...] }, ...
//       ]
//     }, ...
//   }
//
// Median paths are sampled directly from the stroke's d attribute. KanjiVG
// itself ships median data only in its separately-published "kanjivg-median"
// repo; rather than couple to two release streams, we approximate it by
// resampling the path at a fixed step. The drawing-validator threshold was
// tuned against these resampled medians, not the canonical ones — keep that
// in mind if you ever swap the source.

import { readFile, writeFile, readdir, mkdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import https from 'node:https';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = join(ROOT, 'data', 'strokes');
const SOURCE_LOCAL = [
  join(ROOT, 'tools', 'kanjivg-source.xml'),
  join(ROOT, 'tools', 'kanjivg-source.xml.gz')
];
// We pin to a specific KanjiVG release for build reproducibility. Update both
// constants together if you bump the source.
const KANJIVG_VERSION = '20240807';
const KANJIVG_URL = `https://github.com/KanjiVG/kanjivg/releases/download/r${KANJIVG_VERSION}/kanjivg-${KANJIVG_VERSION}.xml.gz`;

// ---------- Path sampling (minimal SVG-path → polyline) ----------
// KanjiVG only uses M, L, C, S, Q, T, Z (and their lower-case relatives) in
// its stroke paths. We implement enough to sample any curve uniformly.
function sampleCubic(p0, p1, p2, p3, steps) {
  const out = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
    const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
    out.push([x, y]);
  }
  return out;
}
function sampleQuad(p0, p1, p2, steps) {
  const out = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0];
    const y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
    out.push([x, y]);
  }
  return out;
}

function pathToPolyline(d) {
  // Tokenise into (cmd, [numbers])* pairs.
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
  const pts = [];
  let cx = 0, cy = 0, sx = 0, sy = 0; // current + sub-path start
  let prevCtrlX = null, prevCtrlY = null;
  let cmd = null;
  let i = 0;
  const isCmd = (t) => /^[a-zA-Z]$/.test(t);
  const num = () => parseFloat(tokens[i++]);

  function moveTo(x, y, rel) {
    cx = rel ? cx + x : x;
    cy = rel ? cy + y : y;
    sx = cx; sy = cy;
    pts.push([cx, cy]);
    prevCtrlX = null; prevCtrlY = null;
  }
  function lineTo(x, y, rel) {
    const nx = rel ? cx + x : x;
    const ny = rel ? cy + y : y;
    // Sample line in ~6 steps for consistent median density
    const steps = 6;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      pts.push([cx + (nx - cx) * t, cy + (ny - cy) * t]);
    }
    cx = nx; cy = ny;
    prevCtrlX = null; prevCtrlY = null;
  }
  function cubicTo(x1, y1, x2, y2, x, y, rel) {
    const p0 = [cx, cy];
    const p1 = rel ? [cx + x1, cy + y1] : [x1, y1];
    const p2 = rel ? [cx + x2, cy + y2] : [x2, y2];
    const p3 = rel ? [cx + x, cy + y] : [x, y];
    pts.push(...sampleCubic(p0, p1, p2, p3, 10));
    cx = p3[0]; cy = p3[1];
    prevCtrlX = p2[0]; prevCtrlY = p2[1];
  }
  function smoothCubicTo(x2, y2, x, y, rel) {
    const p0 = [cx, cy];
    const reflectedX = prevCtrlX != null ? 2 * cx - prevCtrlX : cx;
    const reflectedY = prevCtrlY != null ? 2 * cy - prevCtrlY : cy;
    const p1 = [reflectedX, reflectedY];
    const p2 = rel ? [cx + x2, cy + y2] : [x2, y2];
    const p3 = rel ? [cx + x, cy + y] : [x, y];
    pts.push(...sampleCubic(p0, p1, p2, p3, 10));
    cx = p3[0]; cy = p3[1];
    prevCtrlX = p2[0]; prevCtrlY = p2[1];
  }
  function quadTo(x1, y1, x, y, rel) {
    const p0 = [cx, cy];
    const p1 = rel ? [cx + x1, cy + y1] : [x1, y1];
    const p2 = rel ? [cx + x, cy + y] : [x, y];
    pts.push(...sampleQuad(p0, p1, p2, 8));
    cx = p2[0]; cy = p2[1];
    prevCtrlX = p1[0]; prevCtrlY = p1[1];
  }

  while (i < tokens.length) {
    const t = tokens[i];
    if (isCmd(t)) { cmd = t; i++; }
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case 'M':
        moveTo(num(), num(), rel);
        // Subsequent pairs after M are implicit L
        cmd = rel ? 'l' : 'L';
        break;
      case 'L':
        lineTo(num(), num(), rel);
        break;
      case 'H': {
        const x = num();
        const nx = rel ? cx + x : x;
        const steps = 6;
        for (let s = 1; s <= steps; s++) pts.push([cx + (nx - cx) * (s / steps), cy]);
        cx = nx;
        prevCtrlX = null; prevCtrlY = null;
        break;
      }
      case 'V': {
        const y = num();
        const ny = rel ? cy + y : y;
        const steps = 6;
        for (let s = 1; s <= steps; s++) pts.push([cx, cy + (ny - cy) * (s / steps)]);
        cy = ny;
        prevCtrlX = null; prevCtrlY = null;
        break;
      }
      case 'C': {
        const x1 = num(), y1 = num(), x2 = num(), y2 = num(), x = num(), y = num();
        cubicTo(x1, y1, x2, y2, x, y, rel);
        break;
      }
      case 'S': {
        const x2 = num(), y2 = num(), x = num(), y = num();
        smoothCubicTo(x2, y2, x, y, rel);
        break;
      }
      case 'Q': {
        const x1 = num(), y1 = num(), x = num(), y = num();
        quadTo(x1, y1, x, y, rel);
        break;
      }
      case 'T': {
        const reflectedX = prevCtrlX != null ? 2 * cx - prevCtrlX : cx;
        const reflectedY = prevCtrlY != null ? 2 * cy - prevCtrlY : cy;
        const x = num(), y = num();
        const p0 = [cx, cy];
        const p1 = [reflectedX, reflectedY];
        const p2 = rel ? [cx + x, cy + y] : [x, y];
        pts.push(...sampleQuad(p0, p1, p2, 8));
        cx = p2[0]; cy = p2[1];
        prevCtrlX = p1[0]; prevCtrlY = p1[1];
        break;
      }
      case 'Z':
      case 'z':
        if (cx !== sx || cy !== sy) pts.push([sx, sy]);
        cx = sx; cy = sy;
        prevCtrlX = null; prevCtrlY = null;
        break;
      default:
        // Unsupported (A/arc) — drop a single point so we don't hang.
        if (cmd.toUpperCase() === 'A') {
          num(); num(); num(); num(); num(); num(); num(); // 7 args, ignored
        } else {
          i++;
        }
    }
  }
  return pts;
}

// Resample a polyline to fixed N points spaced by arc length.
function resampleMedian(pts, n = 14) {
  if (pts.length < 2) return pts.length ? [pts[0], pts[0]] : [[0,0],[0,0]];
  let total = 0;
  const segs = [];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i-1][0];
    const dy = pts[i][1] - pts[i-1][1];
    const d = Math.sqrt(dx*dx + dy*dy);
    segs.push(d); total += d;
  }
  if (total === 0) return [pts[0], pts[0]];
  const step = total / (n - 1);
  const out = [[+pts[0][0].toFixed(2), +pts[0][1].toFixed(2)]];
  let segIdx = 0, segStart = 0;
  for (let i = 1; i < n - 1; i++) {
    const target = i * step;
    while (segIdx < segs.length) {
      if (segStart + segs[segIdx] >= target) {
        const t = (target - segStart) / segs[segIdx];
        const x = pts[segIdx][0] + (pts[segIdx+1][0] - pts[segIdx][0]) * t;
        const y = pts[segIdx][1] + (pts[segIdx+1][1] - pts[segIdx][1]) * t;
        out.push([+x.toFixed(2), +y.toFixed(2)]);
        break;
      }
      segStart += segs[segIdx];
      segIdx++;
    }
    if (segIdx >= segs.length) out.push([+pts[pts.length-1][0].toFixed(2), +pts[pts.length-1][1].toFixed(2)]);
  }
  out.push([+pts[pts.length-1][0].toFixed(2), +pts[pts.length-1][1].toFixed(2)]);
  return out;
}

// ---------- KanjiVG source acquisition ----------
async function fetchKanjivg() {
  for (const path of SOURCE_LOCAL) {
    try {
      await stat(path);
      console.log(`Using local KanjiVG source: ${path}`);
      const buf = await readFile(path);
      if (path.endsWith('.gz')) {
        return await gunzipBuffer(buf);
      }
      return buf.toString('utf8');
    } catch { /* not found, fall through */ }
  }
  console.log(`Downloading KanjiVG ${KANJIVG_VERSION} from ${KANJIVG_URL}`);
  const gz = await httpGetFollowing(KANJIVG_URL);
  const xml = await gunzipBuffer(gz);
  // Cache for next run
  try {
    await mkdir(join(ROOT, 'tools'), { recursive: true });
    await writeFile(join(ROOT, 'tools', 'kanjivg-source.xml'), xml);
    console.log('  cached at tools/kanjivg-source.xml');
  } catch (e) { /* best-effort */ }
  return xml;
}
function httpGetFollowing(url, hops = 0) {
  return new Promise((resolve, reject) => {
    if (hops > 5) return reject(new Error('Too many redirects'));
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return httpGetFollowing(res.headers.location, hops + 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}
function gunzipBuffer(buf) {
  return new Promise((resolve, reject) => {
    const gun = createGunzip();
    const chunks = [];
    gun.on('data', (c) => chunks.push(c));
    gun.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    gun.on('error', reject);
    Readable.from([buf]).pipe(gun);
  });
}

// ---------- XML parsing (regex-driven; KanjiVG XML is mechanical) ----------
// Each kanji entry looks like:
//   <kanji id="kvg:05f71">
//     <g id="kvg:05f71" kvg:element="...">
//       <path id="kvg:05f71-s1" kvg:type="..." d="..."/>
//       ...
//     </g>
//   </kanji>
// We only need: the codepoint and the stroke paths in document order.
function extractGlyphs(xml) {
  const out = new Map(); // codepoint hex → [{ d }]
  // KanjiVG's id format is `kvg:kanji_NNNNN` (5-hex-digit codepoint). Older
  // notes refer to a bare `kvg:NNNNN` form, but the current release uses the
  // prefixed form for the top-level <kanji> element.
  const kanjiRe = /<kanji\s+id="kvg:kanji_([0-9a-fA-F]+)"\s*>([\s\S]*?)<\/kanji>/g;
  let m;
  while ((m = kanjiRe.exec(xml)) !== null) {
    const cp = m[1];
    const body = m[2];
    // Take only top-level path elements (i.e., d="..."). KanjiVG nests
    // <g><path/>...<g><path/></g></g>; document order is what we want, so the
    // flat regex over all <path d="..."> inside this kanji block is correct.
    const paths = [];
    // Important: require whitespace before `d=` so we don't match the `d` in
    // `id="kvg:..."`. KanjiVG always places attributes whitespace-separated.
    const pathRe = /<path\s[^>]*?\sd="([^"]+)"[^>]*\/>/g;
    let pm;
    while ((pm = pathRe.exec(body)) !== null) {
      paths.push({ d: pm[1] });
    }
    if (paths.length) out.set(cp.toLowerCase(), paths);
  }
  return out;
}

// ---------- Inputs: which glyphs to ship ----------
async function collectTargetKanji() {
  const set = new Set();
  for (const level of ['N5', 'N4']) {
    const dir = join(ROOT, 'data', level, 'lessons');
    let entries;
    try { entries = await readdir(dir); } catch { continue; }
    for (const name of entries) {
      if (!name.endsWith('.json')) continue;
      try {
        const raw = await readFile(join(dir, name), 'utf8');
        const j = JSON.parse(raw);
        const arr = (j.meta && j.meta.kanji) || [];
        for (const k of arr) if (typeof k === 'string' && k.length) {
          // Skip anything that isn't a single CJK character
          for (const ch of k) {
            const c = ch.codePointAt(0);
            if (c >= 0x3400 && c <= 0x9FFF) set.add(ch);
          }
        }
      } catch (e) {
        console.warn(`  skipping ${name}: ${e.message}`);
      }
    }
  }
  return [...set];
}
function collectTargetKana() {
  const out = [];
  // Hiragana block (skip combining marks)
  for (let cp = 0x3041; cp <= 0x3096; cp++) out.push(String.fromCodePoint(cp));
  // Katakana block
  for (let cp = 0x30A1; cp <= 0x30FA; cp++) out.push(String.fromCodePoint(cp));
  return out;
}

// ---------- Main ----------
async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const xml = await fetchKanjivg();
  console.log(`Parsing KanjiVG (${(xml.length / 1024 / 1024).toFixed(1)} MB)…`);
  const glyphs = extractGlyphs(xml);
  console.log(`  ${glyphs.size} glyphs in source`);

  const targetKanji = await collectTargetKanji();
  console.log(`Curriculum kanji: ${targetKanji.length}`);
  const targetKana = collectTargetKana();
  console.log(`Kana glyphs: ${targetKana.length}`);

  const buildOne = (ch) => {
    const cp = ch.codePointAt(0).toString(16).padStart(5, '0');
    const paths = glyphs.get(cp);
    if (!paths) return null;
    const strokes = paths.map(({ d }) => {
      const poly = pathToPolyline(d);
      const median = resampleMedian(poly, 14);
      return { d, median };
    });
    return { w: 109, h: 109, strokes };
  };

  const kanjiOut = {};
  let kMiss = 0;
  for (const ch of targetKanji) {
    const g = buildOne(ch);
    if (g) kanjiOut[ch] = g; else { kMiss++; console.warn(`  missing kanji in KanjiVG: ${ch}`); }
  }
  const kanaOut = {};
  let nMiss = 0;
  for (const ch of targetKana) {
    const g = buildOne(ch);
    if (g) kanaOut[ch] = g; else { nMiss++; }
  }

  await writeFile(join(OUT_DIR, 'kanji.json'), JSON.stringify(kanjiOut));
  await writeFile(join(OUT_DIR, 'kana.json'),  JSON.stringify(kanaOut));
  const ks = (await stat(join(OUT_DIR, 'kanji.json'))).size;
  const ns = (await stat(join(OUT_DIR, 'kana.json'))).size;
  console.log(`\nWrote data/strokes/kanji.json  ${Object.keys(kanjiOut).length} glyphs (${(ks/1024).toFixed(1)} KB, ${kMiss} missing)`);
  console.log(  `Wrote data/strokes/kana.json   ${Object.keys(kanaOut).length} glyphs (${(ns/1024).toFixed(1)} KB, ${nMiss} missing)`);
  console.log('\nAttribution: KanjiVG (https://kanjivg.tagaini.net), CC-BY-SA 4.0.');
}

main().catch((e) => { console.error(e); process.exit(1); });

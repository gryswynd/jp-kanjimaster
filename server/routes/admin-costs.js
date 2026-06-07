/**
 * server/routes/admin-costs.js
 * Admin-only cost dashboard for the tutor backend.
 *   GET /v1/admin/costs?days=N  → aggregated cost JSON (per-service, per-device,
 *                                 per-question, today-vs-cap, intra-day hourly).
 *   GET /v1/admin/dashboard     → a self-contained HTML page (inline SVG charts)
 *                                 that renders the JSON. No static assets, no deps.
 *
 * Gated by adminGate (ADMIN_UIDS Firebase-uid allowlist OR ADMIN_TOKEN shared
 * secret). In local memory-store mode with NO creds configured, access is open
 * (dev convenience) and a warning is logged; production always fails closed.
 */

import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getCostRollups, getPricingFlags, getGlobalSpendCents, httpError,
} from '../lib/store.js';
import { authMiddleware } from '../middleware/auth.js';
import { env } from '../lib/config.js';
import { SERVICES } from '../lib/rollup-shape.js';

export const adminCostsRouter = Router();

// This router is mounted BEFORE the global identity/auth chain (it's a browser
// surface, not the iOS app), so run soft auth here to populate req.uid for the
// ADMIN_UIDS allowlist path. authMiddleware never blocks — it just attaches uid
// when a valid Firebase token is present.
adminCostsRouter.use(authMiddleware);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// server/routes → repo root is two levels up; the TTS ledger is a committed repo
// file (NOT shipped to the Cloud Run image), so this read returns null in prod.
const TTS_LEDGER_PATH = path.resolve(__dirname, '../../data/audio/cost-ledger.json');

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function adminGate(req, res, next) {
  const uids = (process.env.ADMIN_UIDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const token = process.env.ADMIN_TOKEN || '';
  const noCreds = uids.length === 0 && !token;
  if (noCreds) {
    if (env.useMemoryStore) {
      console.log(JSON.stringify({ severity: 'WARNING', kind: 'admin_open', msg: 'admin cost dashboard is UNGATED (memory mode, no ADMIN_UIDS/ADMIN_TOKEN set)' }));
      return next();
    }
    return next(httpError(403, 'admin_unconfigured')); // fail closed in production
  }
  const okUid = req.uid && uids.includes(req.uid);
  const presented = req.get('X-Admin-Token') || req.query.token || '';
  const okToken = token && presented && safeEqual(presented, token);
  if (okUid || okToken) return next();
  return next(httpError(403, 'admin_forbidden'));
}

adminCostsRouter.use('/v1/admin', adminGate);

function round2(n) { return Math.round((n || 0) * 100) / 100; }

function readTtsLedger() {
  try {
    const raw = JSON.parse(fs.readFileSync(TTS_LEDGER_PATH, 'utf8'));
    const runs = Array.isArray(raw.runs) ? raw.runs : [];
    const totalChars = runs.reduce((a, r) => a + (r.chars || 0), 0);
    const totalUSD = runs.reduce((a, r) => a + (r.estUSD || 0), 0);
    return {
      pricePerMillionChars: raw.pricePerMillionChars || 30,
      runs: runs.slice(-30),
      totalChars,
      totalUSD: round2(totalUSD),
    };
  } catch {
    return null; // file absent (prod) or unreadable
  }
}

adminCostsRouter.get('/v1/admin/costs', async (req, res, next) => {
  try {
    const days = Math.max(1, Math.min(90, parseInt(req.query.days, 10) || 14));
    const [series, flags, globalSpendCents] = await Promise.all([
      getCostRollups(days),
      getPricingFlags(),
      getGlobalSpendCents(),
    ]);

    const capCents = Math.round((flags.maxDailyTotalUSD || 0) * 100);
    const today = series[series.length - 1] || null;

    // Aggregate per-device across the whole window.
    const devAgg = {};
    let windowReqs = 0;
    let windowCost = 0;
    let worst = { day: null, total: 0 };
    let maxRequest = 0;
    for (const d of series) {
      windowReqs += d.requests;
      windowCost += d.costSumCents;
      maxRequest = Math.max(maxRequest, d.maxRequestCents);
      if (d.total > worst.total) worst = { day: d.day, total: d.total };
      for (const [id, dev] of Object.entries(d.byDevice)) {
        const a = devAgg[id] || (devAgg[id] = { deviceId: id, email: '', requests: 0, total: 0, svc: { claudeInput: 0, claudeOutput: 0, stt: 0, firestore: 0 } });
        a.requests += dev.requests;
        a.total += dev.total;
        if (dev.email) a.email = dev.email; // latest non-empty wins across the window
        for (const s of SERVICES) a.svc[s] += dev.svc[s] || 0;
      }
    }
    const byDevice = Object.values(devAgg)
      .map((a) => ({ ...a, total: round2(a.total), avgPerRequest: a.requests ? round2(a.total / a.requests) : 0 }))
      .sort((x, y) => y.total - x.total);

    res.json({
      generatedAt: new Date().toISOString(),
      days,
      memoryMode: !!env.useMemoryStore,
      cap: { globalDailyUSD: flags.maxDailyTotalUSD || 0, killSwitch: !!flags.killSwitch },
      today: today ? {
        day: today.day,
        totalCents: round2(today.total),
        byService: Object.fromEntries(SERVICES.map((s) => [s, round2(today.svc[s])])),
        requests: today.requests,
        globalSpendCents: round2(globalSpendCents),
        capCents,
        pctOfCap: capCents ? round2((globalSpendCents / capCents) * 100) : 0,
      } : null,
      series: series.map((d) => ({
        day: d.day,
        byService: Object.fromEntries(SERVICES.map((s) => [s, round2(d.svc[s])])),
        total: round2(d.total),
        requests: d.requests,
        avgPerRequest: round2(d.avgPerRequest),
        maxRequest: round2(d.maxRequestCents),
        hourly: d.hourly.map((h) => ({ total: round2(h.total), requests: h.requests })),
      })),
      byDevice,
      perQuestion: {
        avgCents: windowReqs ? round2(windowCost / windowReqs) : 0,
        maxCents: round2(maxRequest),
        worstDay: worst.day,
      },
      ttsLedger: readTtsLedger(),
    });
  } catch (e) {
    next(e);
  }
});

adminCostsRouter.get('/v1/admin/dashboard', (req, res) => {
  res.type('html').send(DASHBOARD_HTML);
});

// ── Self-contained dashboard page ───────────────────────────────────────────
// Embedded JS uses string concatenation (NOT template literals) so it doesn't
// collide with this outer template literal. It re-forwards ?token= to the API.
const DASHBOARD_HTML = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rikizo Cost Monitor</title>
<style>
  :root { --bg:#1a1714; --card:#26211c; --ink:#f3ece2; --muted:#a99e8e; --line:#3a332b;
          --ci:#6ab0ff; --co:#3d7fd6; --stt:#ffcf5c; --fs:#8a8175; --warn:#ffb020; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.5 -apple-system,system-ui,sans-serif; padding:18px; }
  h1 { font-size:18px; margin:0 0 4px; } h2 { font-size:14px; color:var(--muted); margin:0 0 10px; text-transform:uppercase; letter-spacing:.05em; }
  .sub { color:var(--muted); font-size:12px; margin-bottom:16px; }
  .grid { display:grid; gap:14px; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px; }
  .card.full { grid-column:1/-1; }
  .big { font-size:28px; font-weight:600; }
  .legend span { display:inline-flex; align-items:center; gap:5px; margin-right:14px; font-size:12px; color:var(--muted); }
  .sw { width:11px; height:11px; border-radius:3px; display:inline-block; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th,td { text-align:left; padding:6px 8px; border-bottom:1px solid var(--line); }
  th { color:var(--muted); font-weight:500; } td.n { text-align:right; font-variant-numeric:tabular-nums; }
  .banner { background:rgba(255,176,32,.14); border:1px solid var(--warn); color:#ffd98a; border-radius:10px; padding:10px 12px; margin-bottom:14px; display:none; }
  .gauge-track { height:10px; background:#0f0d0b; border-radius:6px; overflow:hidden; }
  .gauge-fill { height:100%; background:var(--stt); }
  .tts { border-style:dashed; }
  .err { color:#ff8a8a; }
  .pill { font-size:11px; background:#0f0d0b; border:1px solid var(--line); color:var(--muted); padding:2px 8px; border-radius:999px; }
  svg text { fill:var(--muted); font-size:10px; }
</style></head>
<body>
<h1>Rikizo Cost Monitor <span id="memPill" class="pill" style="display:none">memory mode</span></h1>
<div class="sub" id="sub">loading…</div>
<div class="banner" id="banner"></div>

<div class="grid">
  <div class="card">
    <h2>Today</h2>
    <div class="big" id="todayTotal">—</div>
    <div class="sub" id="todayReqs"></div>
    <div style="margin-top:10px">
      <div class="sub" id="capLabel"></div>
      <div class="gauge-track"><div class="gauge-fill" id="gauge" style="width:0%"></div></div>
    </div>
  </div>
  <div class="card">
    <h2>Per question</h2>
    <div class="big" id="avgQ">—</div>
    <div class="sub">avg / Press-to-Ask</div>
    <div class="sub" id="maxQ" style="margin-top:8px"></div>
  </div>
  <div class="card tts" id="ttsCard" style="display:none">
    <h2>Build-time TTS (one-time)</h2>
    <div class="big" id="ttsTotal">—</div>
    <div class="sub" id="ttsChars"></div>
    <div class="sub">developer-side Chirp 3 HD synthesis — NOT runtime cost</div>
  </div>
</div>

<div class="card full" style="margin-top:14px">
  <h2>Cost by service over time</h2>
  <div class="legend" id="legend"></div>
  <div id="areaChart"></div>
</div>

<div class="grid" style="margin-top:14px">
  <div class="card">
    <h2>Today by hour (UTC)</h2>
    <div id="hourChart"></div>
  </div>
  <div class="card">
    <h2>By tester (device)</h2>
    <table><thead><tr><th>tester</th><th class="n">asks</th><th class="n">cost ¢</th><th class="n">avg ¢</th></tr></thead>
    <tbody id="devBody"></tbody></table>
  </div>
</div>

<script>
var SVC = ['claudeInput','claudeOutput','stt','firestore'];
var SVC_LABEL = { claudeInput:'Claude in', claudeOutput:'Claude out', stt:'Groq STT', firestore:'Firestore' };
var SVC_COLOR = { claudeInput:'#6ab0ff', claudeOutput:'#3d7fd6', stt:'#ffcf5c', firestore:'#8a8175' };
var SPIKE_FACTOR = 2.5, SPIKE_FLOOR_CENTS = 5;

function tok() { var m = location.search.match(/[?&]token=([^&]+)/); return m ? m[1] : ''; }
function c(n) { return '$' + (n/100).toFixed(2); }
function el(id) { return document.getElementById(id); }
function escH(s) { return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function median(a) { if (!a.length) return 0; var s = a.slice().sort(function(x,y){return x-y;}); var m = s.length>>1; return s.length%2 ? s[m] : (s[m-1]+s[m])/2; }

function svg(w,h,inner) { return '<svg viewBox="0 0 '+w+' '+h+'" width="100%" height="'+h+'" preserveAspectRatio="none">'+inner+'</svg>'; }

function stackedArea(series) {
  var W=860, H=240, PADL=44, PADB=22, PADT=10, PADR=10;
  var n = series.length; if (!n) return '';
  var iw = W-PADL-PADR, ih = H-PADT-PADB;
  var totals = series.map(function(d){ var t=0; SVC.forEach(function(s){t+=d.byService[s]||0;}); return t; });
  var max = Math.max.apply(null, totals.concat([1]));
  var x = function(i){ return PADL + (n<=1?0:(i/(n-1))*iw); };
  var y = function(v){ return PADT + ih - (v/max)*ih; };
  var base = series.map(function(){return 0;});
  var layers = '';
  SVC.forEach(function(s){
    var top = series.map(function(d,i){ return base[i] + (d.byService[s]||0); });
    var path = '';
    for (var i=0;i<n;i++) path += (i?'L':'M') + x(i).toFixed(1) + ',' + y(top[i]).toFixed(1) + ' ';
    for (var j=n-1;j>=0;j--) path += 'L' + x(j).toFixed(1) + ',' + y(base[j]).toFixed(1) + ' ';
    layers += '<path d="'+path+'Z" fill="'+SVC_COLOR[s]+'" fill-opacity="0.85"/>';
    base = top;
  });
  // y axis labels (0, max)
  var axis = '<line x1="'+PADL+'" y1="'+(PADT+ih)+'" x2="'+(W-PADR)+'" y2="'+(PADT+ih)+'" stroke="#3a332b"/>';
  axis += '<text x="4" y="'+(PADT+6)+'">'+c(max)+'</text><text x="4" y="'+(PADT+ih)+'">$0</text>';
  // x labels: first + last day
  if (n) { axis += '<text x="'+PADL+'" y="'+(H-6)+'">'+series[0].day.slice(5)+'</text>'; axis += '<text x="'+(W-PADR-28)+'" y="'+(H-6)+'">'+series[n-1].day.slice(5)+'</text>'; }
  return svg(W,H,layers+axis);
}

function hourBars(today) {
  var W=420, H=170, PADL=30, PADB=18, PADT=8, PADR=8;
  var hrs = (today && today.hourly) || [];
  var iw=W-PADL-PADR, ih=H-PADT-PADB;
  var max = Math.max.apply(null, hrs.map(function(h){return h.total;}).concat([1]));
  var bw = iw/24;
  var bars='';
  for (var i=0;i<24;i++){ var v=(hrs[i]&&hrs[i].total)||0; var bh=(v/max)*ih; bars += '<rect x="'+(PADL+i*bw+0.5).toFixed(1)+'" y="'+(PADT+ih-bh).toFixed(1)+'" width="'+(bw-1).toFixed(1)+'" height="'+bh.toFixed(1)+'" fill="#6ab0ff" fill-opacity="0.8"/>'; }
  var axis='<line x1="'+PADL+'" y1="'+(PADT+ih)+'" x2="'+(W-PADR)+'" y2="'+(PADT+ih)+'" stroke="#3a332b"/>';
  axis+='<text x="2" y="'+(PADT+6)+'">'+c(max)+'</text><text x="'+PADL+'" y="'+(H-4)+'">0h</text><text x="'+(W-PADR-14)+'" y="'+(H-4)+'">23h</text>';
  return svg(W,H,bars+axis);
}

function spikeBanner(series) {
  if (series.length < 3) return '';
  var today = series[series.length-1];
  var prior = series.slice(0,-1);
  var hits = [];
  SVC.forEach(function(s){
    var base = median(prior.map(function(d){return d.byService[s]||0;}));
    var now = today.byService[s]||0;
    if (now > SPIKE_FLOOR_CENTS && base > 0 && now > base*SPIKE_FACTOR) hits.push(SVC_LABEL[s]+' '+(now/base).toFixed(1)+'× its '+prior.length+'-day median');
  });
  return hits.length ? ('⚠ Spike today — ' + hits.join('; ')) : '';
}

fetch('/v1/admin/costs?days=14' + (tok()?('&token='+encodeURIComponent(tok())):''), { headers: tok()?{}:{} })
  .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status+(r.status===403?' — set ?token= or ADMIN creds':'')); return r.json(); })
  .then(function(d){
    el('sub').textContent = 'window: ' + d.days + ' days · generated ' + new Date(d.generatedAt).toLocaleString();
    if (d.memoryMode) el('memPill').style.display='inline-block';

    if (d.today) {
      el('todayTotal').textContent = c(d.today.totalCents);
      el('todayReqs').textContent = d.today.requests + ' asks today';
      el('capLabel').textContent = 'global spend vs cap: ' + c(d.today.globalSpendCents) + ' / ' + c(d.today.capCents) + ' (' + d.today.pctOfCap.toFixed(0) + '%)';
      var pct = Math.min(100, d.today.pctOfCap);
      var g = el('gauge'); g.style.width = pct + '%'; if (pct >= 80) g.style.background = '#ff6b6b';
    }
    el('avgQ').textContent = c(d.perQuestion.avgCents);
    el('maxQ').textContent = 'worst single ask: ' + c(d.perQuestion.maxCents) + (d.perQuestion.worstDay?(' · priciest day '+d.perQuestion.worstDay):'');

    // legend
    el('legend').innerHTML = SVC.map(function(s){ var t=d.today?d.today.byService[s]:0; return '<span><i class="sw" style="background:'+SVC_COLOR[s]+'"></i>'+SVC_LABEL[s]+' '+c(t||0)+'</span>'; }).join('');
    el('areaChart').innerHTML = stackedArea(d.series);
    el('hourChart').innerHTML = hourBars(d.today);

    el('devBody').innerHTML = d.byDevice.length ? d.byDevice.map(function(x){
      var who = x.email ? escH(x.email) : (escH(x.deviceId.slice(0,10))+'… <span class="sub">(not signed in)</span>');
      return '<tr><td title="'+escH(x.deviceId)+'">'+who+'</td><td class="n">'+x.requests+'</td><td class="n">'+x.total.toFixed(2)+'</td><td class="n">'+x.avgPerRequest.toFixed(2)+'</td></tr>';
    }).join('') : '<tr><td colspan="4" class="sub">no activity yet</td></tr>';

    if (d.ttsLedger) {
      el('ttsCard').style.display='block';
      el('ttsTotal').textContent = '$' + d.ttsLedger.totalUSD.toFixed(2);
      el('ttsChars').textContent = d.ttsLedger.totalChars.toLocaleString() + ' chars across ' + d.ttsLedger.runs.length + ' runs';
    }

    var b = spikeBanner(d.series);
    if (b) { el('banner').textContent = b; el('banner').style.display='block'; }
  })
  .catch(function(e){ el('sub').innerHTML = '<span class="err">'+e.message+'</span>'; });
</script>
</body></html>`;

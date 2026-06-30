/**
 * story-gen/routes/admin.js
 * Report + cost tracker for the generator (mirrors the tutor's dashboard). Browser
 * surface, so it runs its own gate (ADMIN_TOKEN via ?token / X-Admin-Token, OR a
 * uid in ADMIN_UIDS) and never requires the app's auth headers.
 *   GET /v1/admin/storygen-costs        JSON cost rollups
 *   GET /v1/admin/storygen-generations  JSON recent per-generation log
 *   GET /v1/admin/storygen-dashboard    inline HTML report (no deps)
 */
import express from 'express';
import { env } from '../lib/config.js';
import { getCostRollups, getPricingFlags, getRecentGenerations } from '../lib/store.js';

export const adminRouter = express.Router();

function gated(req) {
  const tok = req.get('X-Admin-Token') || req.query.token || '';
  if (env.adminToken && tok && tok === env.adminToken) return true;
  if (req.uid && env.adminUids.includes(req.uid)) return true;
  // Local memory mode with no token configured → open (logs nothing sensitive).
  if (env.useMemoryStore && !env.adminToken) return true;
  return false;
}
const cents = (c) => '$' + ((c || 0) / 100).toFixed(2);
const esc = (s) => String(s == null ? '' : s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
const pct = (n, d) => (d ? Math.round((100 * n) / d) : 0) + '%';
const stars = (n) => (n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '—');
function percentile(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

// Aggregate the recent per-generation log into report stats.
function summarize(gens, threshold) {
  const done = gens.filter((g) => g.status === 'done');
  const failed = gens.filter((g) => g.status === 'failed');
  const withQ = done.filter((g) => g.quality && typeof g.quality.overall === 'number');
  const avgQ = withQ.length ? (withQ.reduce((s, g) => s + g.quality.overall, 0) / withQ.length) : null;
  const low = withQ.filter((g) => g.quality.overall < threshold).length;
  const failReasons = {};
  failed.forEach((g) => { const k = g.error || 'error'; failReasons[k] = (failReasons[k] || 0) + 1; });
  const themePop = {}, castPop = {};
  gens.forEach((g) => {
    (g.themes || []).forEach((t) => { themePop[t] = (themePop[t] || 0) + 1; });
    (g.castIds || []).forEach((c) => { castPop[c] = (castPop[c] || 0) + 1; });
  });
  const lenAcc = done.filter((g) => g.targetParagraphs).map((g) => g.actualParagraphs / g.targetParagraphs);
  const avgLenAcc = lenAcc.length ? lenAcc.reduce((s, x) => s + x, 0) / lenAcc.length : null;
  const lat = done.map((g) => g.latencyMs || 0).filter(Boolean);
  const regen = done.filter((g) => g.regenerated).length;
  return {
    total: gens.length, done: done.length, failed: failed.length,
    avgQ, low, withQ: withQ.length, failReasons, themePop, castPop,
    avgLenAcc, regen,
    latP50: percentile(lat, 50), latP95: percentile(lat, 95),
  };
}
const topList = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${esc(k)} ${v}`).join(' · ') || '—';

adminRouter.get('/v1/admin/storygen-costs', async (req, res, next) => {
  try {
    if (!gated(req)) return res.status(403).json({ reason: 'forbidden' });
    const days = Math.max(1, Math.min(31, parseInt(req.query.days, 10) || 7));
    const rollups = await getCostRollups(days);
    const flags = await getPricingFlags();
    res.json({ rollups, flags });
  } catch (e) { next(e); }
});

adminRouter.get('/v1/admin/storygen-generations', async (req, res, next) => {
  try {
    if (!gated(req)) return res.status(403).json({ reason: 'forbidden' });
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit, 10) || 50));
    res.json({ generations: await getRecentGenerations(limit) });
  } catch (e) { next(e); }
});

adminRouter.get('/v1/admin/storygen-dashboard', async (req, res, next) => {
  try {
    if (!gated(req)) return res.status(403).send('forbidden');
    const rollups = await getCostRollups(14);
    const flags = await getPricingFlags();
    const gens = await getRecentGenerations(100);
    const threshold = flags.qualityThreshold || 3;
    const s = summarize(gens, threshold);

    const totalCents = rollups.reduce((a, r) => a + (r.costSumCents || 0), 0);
    const totalGens = rollups.reduce((a, r) => a + (r.generations || 0), 0);

    const genRows = gens.slice(0, 40).map((g) => {
      const d = new Date(g.createdAt || 0);
      const t = isNaN(d) ? '' : d.toISOString().slice(5, 16).replace('T', ' ');
      const q = g.quality && typeof g.quality.overall === 'number'
        ? `<span class="q q${g.quality.overall}" title="${esc((g.quality.note || '') + '  [coh ' + g.quality.coherence + ' nat ' + g.quality.naturalness + ' scope ' + g.quality.inScope + ' theme ' + g.quality.themeFit + ' cast ' + g.quality.castUsage + ']')}">${stars(g.quality.overall)}</span>`
        : '—';
      const len = g.targetParagraphs ? `${g.actualParagraphs}/${g.targetParagraphs}` : (g.actualParagraphs || '—');
      const resid = (g.residualMessages && g.residualMessages.length) ? esc(g.residualMessages.join(' | ')) : '';
      const st = g.status === 'done' ? '<span class="ok">done</span>' : `<span class="bad"${resid ? ` title="${resid}"` : ''}>${esc(g.error || 'failed')}${g.residualViolations ? ' (' + g.residualViolations + ')' : ''}</span>`;
      return `<tr>
        <td>${t}</td>
        <td>${esc((g.email || g.uid || '').slice(0, 22))}</td>
        <td>${esc((g.title || '').slice(0, 28))}</td>
        <td>${esc((g.themes || []).join(', ').slice(0, 18))}</td>
        <td>${esc(g.level || '')}</td>
        <td>${len}</td>
        <td>${g.rounds || 0}${g.regenerated ? ' <span class="rg">↻</span>' : ''}</td>
        <td>${q}</td>
        <td>${cents(g.costCents)}</td>
        <td>${st}</td></tr>`;
    }).join('');

    const dayRows = rollups.map((r) => {
      const users = Object.entries(r.byUser || {}).map(([uid, u]) =>
        `<tr><td>${esc((u.email || uid))}</td><td>${u.generations || 0}</td><td>${cents(u.costCents)}</td></tr>`).join('');
      return `<div class="day"><h3>${esc(r.day)} — ${r.generations || 0} stories · ${cents(r.costSumCents)}</h3>
        <div class="svc">Claude in ${cents(r.svc?.claudeInputCents)} · out ${cents(r.svc?.claudeOutputCents)}</div>
        <table><tr><th>user</th><th>stories</th><th>cost</th></tr>${users || '<tr><td colspan=3>—</td></tr>'}</table></div>`;
    }).join('');

    res.set('Content-Type', 'text/html').send(`<!doctype html><meta charset=utf8>
<title>Story-gen report</title>
<style>body{font:14px system-ui;margin:24px;max-width:1000px;color:#222}h1{font-size:20px}h2{font-size:15px;margin:22px 0 8px;color:#444}
.tot{font-size:28px;font-weight:700}.sub{color:#666;font-size:14px;font-weight:400}
.cards{display:flex;flex-wrap:wrap;gap:10px;margin:10px 0}
.card{border:1px solid #eee;border-radius:10px;padding:10px 14px;min-width:120px}
.card b{display:block;font-size:20px}.card span{color:#888;font-size:12px}
.flags{background:#f7f7f7;border-radius:8px;padding:10px 14px;font-size:13px;margin:8px 0}
table{border-collapse:collapse;width:100%;font-size:13px}td,th{text-align:left;padding:4px 8px;border-bottom:1px solid #f0f0f0;white-space:nowrap}
th{color:#888;font-weight:600}
.q{letter-spacing:-1px}.q1,.q2{color:#d33}.q3{color:#e69500}.q4,.q5{color:#2a9d2a}
.ok{color:#2a9d2a}.bad{color:#d33}.rg{color:#7a5af0}
.day{border:1px solid #eee;border-radius:10px;padding:10px 14px;margin:8px 0}.svc{color:#666;font-size:12px;margin-bottom:4px}
.pop{color:#555;font-size:13px}</style>
<h1>Custom Story Generator — report</h1>
<div class="tot">${cents(totalCents)}<span class="sub"> over ${rollups.length} day(s) · ${totalGens} stories</span></div>
<div class="flags">guardrails: kill-switch <b>${flags.killSwitch ? 'ON' : 'off'}</b> · global cap <b>$${flags.maxDailyTotalUSD}/day</b> · per-user <b>${flags.perUserPerDay}/day</b> · judge <b>${flags.qualityJudge === false ? 'off' : 'on'}</b> · auto-regen <b>${flags.autoRegen === false ? 'off' : 'on'}</b> (&lt;${threshold})</div>

<h2>Quality &amp; reliability <span class="sub">(last ${s.total} generations)</span></h2>
<div class="cards">
  <div class="card"><b>${s.avgQ != null ? s.avgQ.toFixed(2) : '—'}</b><span>avg quality (of 5)</span></div>
  <div class="card"><b>${s.withQ ? pct(s.low, s.withQ) : '—'}</b><span>below threshold (&lt;${threshold})</span></div>
  <div class="card"><b>${s.total ? pct(s.failed, s.total) : '—'}</b><span>failure rate</span></div>
  <div class="card"><b>${s.done ? pct(s.regen, s.done) : '—'}</b><span>auto-regenerated</span></div>
  <div class="card"><b>${s.avgLenAcc != null ? Math.round(s.avgLenAcc * 100) + '%' : '—'}</b><span>length delivered</span></div>
  <div class="card"><b>${(s.latP50 / 1000).toFixed(0)}s</b><span>latency p50 (p95 ${(s.latP95 / 1000).toFixed(0)}s)</span></div>
</div>
<div class="pop"><b>themes:</b> ${topList(s.themePop)}</div>
<div class="pop"><b>cast:</b> ${topList(s.castPop)}</div>
<div class="pop"><b>failures:</b> ${topList(s.failReasons)}</div>

<h2>Recent generations</h2>
<table><tr><th>time</th><th>user</th><th>title</th><th>theme</th><th>level</th><th>len</th><th>rnds</th><th>quality</th><th>cost</th><th>status</th></tr>
${genRows || '<tr><td colspan=10>No generations yet.</td></tr>'}</table>

<h2>Daily cost</h2>
${dayRows || '<p>No generations yet.</p>'}`);
  } catch (e) { next(e); }
});

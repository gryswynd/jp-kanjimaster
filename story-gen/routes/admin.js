/**
 * story-gen/routes/admin.js
 * Cost tracker for the generator (mirrors the tutor's dashboard). Browser surface,
 * so it runs its own gate (ADMIN_TOKEN via ?token / X-Admin-Token, OR a uid in
 * ADMIN_UIDS) and never requires the app's auth headers.
 *   GET /v1/admin/storygen-costs       JSON rollups
 *   GET /v1/admin/storygen-dashboard   inline HTML (no deps)
 */
import express from 'express';
import { env } from '../lib/config.js';
import { getCostRollups, getPricingFlags } from '../lib/store.js';

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

adminRouter.get('/v1/admin/storygen-costs', async (req, res, next) => {
  try {
    if (!gated(req)) return res.status(403).json({ reason: 'forbidden' });
    const days = Math.max(1, Math.min(31, parseInt(req.query.days, 10) || 7));
    const rollups = await getCostRollups(days);
    const flags = await getPricingFlags();
    res.json({ rollups, flags });
  } catch (e) { next(e); }
});

adminRouter.get('/v1/admin/storygen-dashboard', async (req, res, next) => {
  try {
    if (!gated(req)) return res.status(403).send('forbidden');
    const rollups = await getCostRollups(14);
    const flags = await getPricingFlags();
    const totalCents = rollups.reduce((s, r) => s + (r.costSumCents || 0), 0);
    const totalGens = rollups.reduce((s, r) => s + (r.generations || 0), 0);
    const rows = rollups.map(r => {
      const users = Object.entries(r.byUser || {}).map(([uid, u]) =>
        `<tr><td>${(u.email || uid).replace(/[<>&]/g, '')}</td><td>${u.generations || 0}</td><td>${cents(u.costCents)}</td></tr>`).join('');
      return `<div class="day"><h3>${r.day} — ${r.generations || 0} stories · ${cents(r.costSumCents)}</h3>
        <div class="svc">Claude in ${cents(r.svc?.claudeInputCents)} · out ${cents(r.svc?.claudeOutputCents)}</div>
        <table><tr><th>user</th><th>stories</th><th>cost</th></tr>${users || '<tr><td colspan=3>—</td></tr>'}</table></div>`;
    }).join('');
    res.set('Content-Type', 'text/html').send(`<!doctype html><meta charset=utf8>
<title>Story-gen costs</title>
<style>body{font:14px system-ui;margin:24px;max-width:720px;color:#222}h1{font-size:20px}
.tot{font-size:28px;font-weight:700}.sub{color:#666}.day{border:1px solid #eee;border-radius:10px;padding:12px 16px;margin:10px 0}
.svc{color:#666;font-size:12px;margin-bottom:6px}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:3px 8px;border-bottom:1px solid #f0f0f0}
.flags{background:#f7f7f7;border-radius:8px;padding:10px 14px;font-size:13px}</style>
<h1>Custom Story Generator — cost</h1>
<div class="tot">${cents(totalCents)}<span class="sub"> over ${rollups.length} day(s) · ${totalGens} stories</span></div>
<div class="flags">guardrails: kill-switch <b>${flags.killSwitch ? 'ON' : 'off'}</b> · global cap <b>$${flags.maxDailyTotalUSD}/day</b> · per-user <b>${flags.perUserPerDay}/day</b></div>
${rows || '<p>No generations yet.</p>'}`);
  } catch (e) { next(e); }
});

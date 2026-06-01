/**
 * server/index.js
 * Cloud Run entry for the Rikizo tutor backend (V1: Press-to-Ask).
 *
 * Middleware chain: identity (device id) → rate limit → attest → route.
 * Errors are normalized to { reason } with the right status so the client can
 * branch on tier_quota / daily_cost_cap / kill_switch.
 */

import express from 'express';
import { env } from './lib/config.js';
import { identityMiddleware } from './middleware/identity.js';
import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';
import { attestMiddleware } from './lib/attest.js';
import { pressToAskRouter } from './routes/press-to-ask.js';
import { quotaRouter } from './routes/quota.js';
import { progressRouter } from './routes/progress.js';
import { initCurriculum } from './lib/curriculum.js';

const app = express();
app.set('trust proxy', true);

// CORS — the app runs on a different origin than this server (browser localhost
// on another port, or the Capacitor webview), so the browser blocks requests
// unless we opt in. We allow any origin (the device-id + App Attest are the real
// access control, not origin) and the custom headers the client sends. Browsers
// send a preflight OPTIONS for requests with custom headers — answer it 204.
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', req.get('Origin') || '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Id, X-Attest-Key-Id, X-Attest-Assertion');
  res.set('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.use(express.json({ limit: '6mb' })); // base64 audio for a ≤15s clip fits well under this

// Health check (no identity required) — Cloud Run uses this.
app.get('/healthz', (req, res) => res.json({ ok: true }));

// Authenticated API surface.
app.use(identityMiddleware);
app.use(authMiddleware);
// Account progress sync (Firebase uid) — mounted before rate-limit/attest, which
// gate the cost-bearing tutor endpoints; progress is authed by the verified token.
app.use(progressRouter);
app.use(rateLimitMiddleware);
app.use(attestMiddleware);
app.use(pressToAskRouter);
app.use(quotaRouter);

// Centralized error handler.
app.use((err, req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500 && !err.reason) console.error(err);
  res.status(status).json({ reason: err.reason || 'server_error' });
});

app.listen(env.port, () => {
  console.log(JSON.stringify({
    severity: 'NOTICE', kind: 'startup',
    port: env.port, model: env.anthropicModel,
    attestBypass: env.attestBypass,
    anthropicConfigured: !!env.anthropicKey,
    sttConfigured: !!env.groqApiKey,
    sttModel: env.sttModel,
  }));
  // Warm the curriculum index so the first lookup_curriculum call isn't slow.
  initCurriculum();
});

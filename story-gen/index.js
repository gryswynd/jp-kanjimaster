/**
 * story-gen/index.js
 * Cloud Run entry for the custom-story generator. Account-only (Firebase token);
 * no device-id/attest. Separate service from the tutor, same Firebase project.
 */
import express from 'express';
import { env } from './lib/config.js';
import { authMiddleware } from './lib/auth.js';
import { storiesRouter } from './routes/stories.js';
import { friendsRouter } from './routes/friends.js';
import { adminRouter } from './routes/admin.js';
import { warm } from './lib/generate-runner.js';

const app = express();
app.set('trust proxy', true);

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', req.get('Origin') || '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');
  res.set('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});
app.use(express.json({ limit: '1mb' }));

app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Admin dashboard (browser) — soft auth, own gate; mounted before nothing else needed.
app.use(authMiddleware);
app.use(adminRouter);
app.use(storiesRouter);
app.use(friendsRouter);

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500 && !err.reason) console.error(err);
  res.status(status).json({ reason: err.reason || 'server_error' });
});

app.listen(env.port, () => {
  console.log(JSON.stringify({
    severity: 'NOTICE', kind: 'startup', service: 'rikizo-story-gen',
    port: env.port, model: env.model,
    anthropicConfigured: !!env.anthropicKey, memoryStore: env.useMemoryStore,
  }));
  // Warm the gate context + author prompt so the first generation isn't slow.
  warm().catch(e => console.error('warm failed', e));
});

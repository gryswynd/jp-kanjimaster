/**
 * server/middleware/rate-limit.js
 * Coarse per-IP + per-device rate limit at the edge (anti-abuse backstop layered
 * under Firestore quota). In-memory sliding window — fine for a single Cloud Run
 * instance / small beta. For multi-instance scale, move this to Firestore or a
 * memorystore; documented so it isn't mistaken for a distributed limiter.
 */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30; // requests/min per key

const hits = new Map(); // key -> number[] (timestamps)

function allow(key, now) {
  const arr = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(key, arr);
  return arr.length <= MAX_PER_WINDOW;
}

export function rateLimitMiddleware(req, res, next) {
  // Date.now() is fine in server code (the no-Date rule is workflow-script-only).
  const now = Date.now();
  const ip = req.ip || req.get('X-Forwarded-For') || 'unknown';
  const dev = req.deviceId || 'nodevice';
  if (!allow('ip:' + ip, now) || !allow('dev:' + dev, now)) {
    res.status(429).json({ reason: 'rate_limited' });
    return;
  }
  next();
}

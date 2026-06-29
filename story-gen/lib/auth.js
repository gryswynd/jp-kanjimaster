/**
 * story-gen/lib/auth.js
 * Soft Firebase-Auth middleware → req.uid / req.userEmail. Never blocks; routes
 * that require an account enforce req.uid themselves.
 */
import { verifyIdToken } from './firebase.js';
import { env } from './config.js';

export async function authMiddleware(req, _res, next) {
  try {
    const m = /^Bearer\s+(.+)$/i.exec(req.get('Authorization') || '');
    if (m) {
      const decoded = await verifyIdToken(m[1]);
      if (decoded && decoded.uid) {
        req.uid = decoded.uid;
        req.userEmail = decoded.email || null;
      }
    }
  } catch { /* soft */ }
  next();
}

/** Guard for account-only routes. */
export function requireUid(req, _res, next) {
  if (!req.uid) {
    // Local dev (memory store, no real auth): use a fixed test uid so the
    // endpoints are exercisable without a Firebase token. Prod requires auth.
    if (env.useMemoryStore) { req.uid = 'local-dev'; req.userEmail = 'local@dev'; return next(); }
    const e = new Error('login_required'); e.status = 401; e.reason = 'login_required'; throw e;
  }
  next();
}

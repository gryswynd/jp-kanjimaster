/**
 * server/middleware/auth.js
 * Soft Firebase-Auth middleware. Runs AFTER identity (device id). If an
 * `Authorization: Bearer <idToken>` header is present and valid, attaches
 * req.uid (+ req.userEmail). If absent or invalid, it does NOTHING — the tutor
 * endpoints keep working device-only. Routes that REQUIRE an account (progress)
 * enforce req.uid themselves.
 */

import { verifyIdToken } from '../lib/firebase.js';

export async function authMiddleware(req, _res, next) {
  try {
    const hdr = req.get('Authorization') || '';
    const m = /^Bearer\s+(.+)$/i.exec(hdr);
    if (m) {
      const decoded = await verifyIdToken(m[1]);
      if (decoded && decoded.uid) {
        req.uid = decoded.uid;
        req.userEmail = decoded.email || null;
      }
    }
  } catch {
    // soft: never block on auth errors
  }
  next();
}

/**
 * server/routes/progress.js
 * Account-scoped progress sync. Requires a verified Firebase account (req.uid,
 * set by the auth middleware); device-id alone is not enough.
 *   GET /v1/progress        → { progress }            (null if nothing stored yet)
 *   PUT /v1/progress {progress} → { progress: merged } (server merges + returns)
 * The same endpoints back the Godot client in Phase 2.
 */

import { Router } from 'express';
import { getProgress, saveProgress, httpError } from '../lib/store.js';

export const progressRouter = Router();

function requireUid(req) {
  if (!req.uid) throw httpError(401, 'auth_required');
  return req.uid;
}

progressRouter.get('/v1/progress', async (req, res, next) => {
  try {
    const uid = requireUid(req);
    res.json({ progress: await getProgress(uid) });
  } catch (e) {
    next(e);
  }
});

progressRouter.put('/v1/progress', async (req, res, next) => {
  try {
    const uid = requireUid(req);
    const incoming = (req.body && req.body.progress) || {};
    const merged = await saveProgress(uid, incoming);
    res.json({ progress: merged });
  } catch (e) {
    next(e);
  }
});

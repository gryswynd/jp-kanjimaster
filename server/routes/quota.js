/**
 * server/routes/quota.js
 * GET /v1/quota — current daily quota for the calling device.
 */

import { Router } from 'express';
import { getEntitlement, getQuotaState } from '../lib/store.js';

export const quotaRouter = Router();

quotaRouter.get('/v1/quota', async (req, res, next) => {
  try {
    const tier = await getEntitlement(req.deviceId);
    const q = await getQuotaState(req.deviceId, tier);
    res.json({ tier, used: q.used, limit: q.limit, remaining: q.remaining });
  } catch (e) {
    next(e);
  }
});

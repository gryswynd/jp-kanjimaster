/**
 * server/middleware/identity.js
 * Extracts the anonymous device id from X-Device-Id and ensures the device doc
 * exists. Must run before attest + route handlers.
 */

import { ensureDevice, httpError } from '../lib/store.js';

export async function identityMiddleware(req, res, next) {
  const deviceId = req.get('X-Device-Id');
  if (!deviceId || deviceId.length < 8 || deviceId.length > 128) {
    return next(httpError(400, 'missing_device_id'));
  }
  req.deviceId = deviceId;
  try {
    await ensureDevice(deviceId, req.get('X-Attest-Key-Id') || null);
    next();
  } catch (e) {
    next(e);
  }
}

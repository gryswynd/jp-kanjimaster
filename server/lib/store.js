/**
 * server/lib/store.js
 * Store facade. Routes + middleware import from here, not from a concrete store,
 * so we can run on Firestore (production) or an in-memory store (local / no-GCP)
 * by flipping one env flag. Selection: env.useMemoryStore (TUTOR_STORE=memory or
 * empty GCLOUD_PROJECT) → memory; otherwise Firestore.
 */

import { env } from './config.js';
import * as firestore from './firestore.js';
import * as memory from './store-memory.js';

const impl = env.useMemoryStore ? memory : firestore;

if (env.useMemoryStore) {
  console.log(JSON.stringify({ severity: 'NOTICE', kind: 'store', backend: 'memory' }));
}

export const todayStr = impl.todayStr;
export const getEntitlement = impl.getEntitlement;
export const ensureDevice = impl.ensureDevice;
export const getPricingFlags = impl.getPricingFlags;
export const getQuotaState = impl.getQuotaState;
export const reservePressAsk = impl.reservePressAsk;
export const settleCost = impl.settleCost;
export const refundPressAsk = impl.refundPressAsk;
export const getGlobalSpendCents = impl.getGlobalSpendCents;
export const getProfile = impl.getProfile;
export const saveProfile = impl.saveProfile;
export const getProgress = impl.getProgress;
export const saveProgress = impl.saveProgress;

export { httpError } from './errors.js';

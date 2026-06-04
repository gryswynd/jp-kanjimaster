/**
 * server/scripts/seed-pricing-flags.mjs
 * One-time (idempotent) seed of the Firestore `pricing-flags/global` doc — the
 * live cost-safety knob the server reads each request (kill switch + caps), see
 * lib/firestore.js getPricingFlags(). Re-running overwrites with these values.
 *
 * Run locally with ADC:  GCLOUD_PROJECT=<proj> node scripts/seed-pricing-flags.mjs
 * Change the cap later either by re-running this or editing the doc in the console.
 */

import { Firestore } from '@google-cloud/firestore';

const projectId = process.env.GCLOUD_PROJECT;
if (!projectId) { console.error('Set GCLOUD_PROJECT'); process.exit(1); }

const db = new Firestore({ projectId });

const flags = {
  killSwitch: false,
  maxDailyTotalUSD: 3,        // global hard stop — all requests 503 past this/day
  liveProvider: 'stackA',
  pressAsk: {
    maxAudioSeconds: 15,
    maxOutputTokens: 400,
    sttConfidenceFloor: 0.5,
  },
};

await db.doc('pricing-flags/global').set(flags, { merge: true });
console.log('seeded pricing-flags/global on', projectId, '→', JSON.stringify(flags));
process.exit(0);

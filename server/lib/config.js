/**
 * server/lib/config.js
 * Central config + the pricing/quota table. In production the per-tier numbers and
 * kill switch live in Firestore (pricing-flags/global) so they can be tuned without
 * redeploy — see lib/firestore.js getPricingFlags(). This file holds the defaults
 * and the static env-derived config.
 */

export const env = {
  port: parseInt(process.env.PORT || '8080', 10),
  anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
  // Speech-to-Text via Groq (hosted Whisper). Chosen 2026-05-31 after Google STT
  // proved unable to code-switch English+Japanese in one sentence. Groq = simple
  // API key (no OAuth/service-account/org-policy mess), runs off-device (this Mac
  // is dying), cheap, and Whisper auto-detect handles mixed speech far better than
  // Google's pick-one-language. Default to the turbo model: ~3x cheaper, fast.
  groqApiKey: process.env.GROQ_API_KEY || '',
  sttModel: process.env.STT_MODEL || 'whisper-large-v3-turbo',
  appleTeamId: process.env.APPLE_TEAM_ID || '',
  appBundleId: process.env.APP_BUNDLE_ID || '',
  attestBypass: String(process.env.ATTEST_BYPASS || '').toLowerCase() === 'true',
  betaEntitlements: parseEntitlements(process.env.BETA_ENTITLEMENTS || ''),
  // Use the in-memory store when explicitly asked (TUTOR_STORE=memory) or when no
  // GCP project is configured — lets the server run locally with only an
  // Anthropic key. See lib/store.js.
  useMemoryStore:
    String(process.env.TUTOR_STORE || '').toLowerCase() === 'memory' ||
    !process.env.GCLOUD_PROJECT,
};

function parseEntitlements(raw) {
  const map = {};
  raw.split(',').map((s) => s.trim()).filter(Boolean).forEach((pair) => {
    const [id, tier] = pair.split(':').map((x) => x.trim());
    if (id && tier) map[id] = tier;
  });
  return map;
}

/**
 * Default tier table. Numbers mirror the agreed pricing model. Daily cost caps are
 * the hard backstop (USD); pressAsksPerDay is the soft quota. liveSessions fields
 * are present for V2 — V1 enforces only the P2A + cost-cap columns.
 */
export const DEFAULT_TIERS = {
  free:    { pressAsksPerDay: 5,  liveSessionsPerDay: 0, liveSessionsPerWeek: 0, dailyCostCapUSD: 0.10 },
  lite:    { pressAsksPerDay: 25, liveSessionsPerDay: 0, liveSessionsPerWeek: 0, dailyCostCapUSD: 0.30 },
  mid:     { pressAsksPerDay: 50, liveSessionsPerDay: 0, liveSessionsPerWeek: 2, dailyCostCapUSD: 2.00 },
  premium: { pressAsksPerDay: 75, liveSessionsPerDay: 1, liveSessionsPerWeek: 7, dailyCostCapUSD: 2.00 },
};

/** Global defaults overlaid by pricing-flags/global at runtime. */
export const DEFAULT_FLAGS = {
  killSwitch: false,
  maxDailyTotalUSD: 50,      // global circuit breaker across ALL devices
  liveProvider: 'stackA',    // future flexibility; V1 ignores
  pressAsk: {
    maxAudioSeconds: 15,
    maxOutputTokens: 400,
    sttConfidenceFloor: 0.5, // below this, return "say again" without calling Claude
  },
};

/** Per-request cost model (USD), Stack A. Used by the cost meter. */
export const COSTS = {
  sttPerSecond: 0.016 / 60,        // Google streaming STT ~ $0.016/min
  claudeInputPerToken: 0.80 / 1e6, // Haiku input  ~$0.80/M  (adjust to live pricing)
  claudeOutputPerToken: 4.0 / 1e6, // Haiku output ~$4.0/M
  firestoreReadPer: 0.06 / 1e5,    // Firestore doc read  ~$0.06 / 100k (us-west1)
  firestoreWritePer: 0.18 / 1e5,   // Firestore doc write ~$0.18 / 100k
};

/**
 * Fixed Firestore op count per Press-to-Ask. We don't live-meter Firestore reads/
 * writes (not worth it at beta scale) — we ESTIMATE from the known op count in the
 * request path: reserve (txn read+write), quota/flags/profile reads, settle +
 * rollup writes. The dashboard labels firestoreCents as an estimate. Tune if the
 * request path's op count changes.
 */
export const FIRESTORE_OPS_PER_PRESSASK = { reads: 4, writes: 5 };

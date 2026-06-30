/**
 * story-gen/lib/config.js
 * Env-derived config + cost/quota defaults for the custom-story generator.
 * Per-user + global caps live in Firestore (pricing-flags/storygen) so they can
 * be tuned without redeploy; this holds the static defaults.
 */
export const env = {
  port: parseInt(process.env.PORT || '8080', 10),
  anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  // Authoring is a constrained-vocab task — Sonnet converges in fewer repair
  // rounds than Haiku. Configurable so we can tune cost/quality.
  model: process.env.STORYGEN_MODEL || 'claude-sonnet-4-6',
  // Where the staged curriculum/content lives in the container (see scripts/stage.mjs).
  contentRoot: process.env.CONTENT_ROOT || new URL('../content', import.meta.url).pathname,
  gcloudProject: process.env.GCLOUD_PROJECT || '',
  useMemoryStore:
    String(process.env.STORYGEN_STORE || '').toLowerCase() === 'memory' ||
    !process.env.GCLOUD_PROJECT,
  // Admin dashboard gate (mirrors the tutor): ADMIN_TOKEN (?token / X-Admin-Token)
  // OR a uid in ADMIN_UIDS.
  adminToken: process.env.ADMIN_TOKEN || '',
  adminUids: (process.env.ADMIN_UIDS || '').split(',').map(s => s.trim()).filter(Boolean),
};

/** Global generation guardrails, overlaid by Firestore pricing-flags/storygen. */
export const DEFAULT_FLAGS = {
  killSwitch: false,
  maxDailyTotalUSD: 10,    // global circuit breaker across ALL users
  perUserPerDay: 5,        // soft per-user daily generation cap
  maxParagraphs: 32,       // clamp the requested length ("Extra long" ≈ 28)
  qualityJudge: true,      // run the silent post-gate quality judge on each story
  autoRegen: true,         // regenerate once if the judge scores below threshold
  qualityThreshold: 3,     // overall (1–5) below this triggers one regeneration
};

/** Per-token cost (USD) for the authoring model. Sonnet 4.6 list pricing. */
export const COSTS = {
  claudeInputPerToken: 3.0 / 1e6,
  claudeOutputPerToken: 15.0 / 1e6,
};

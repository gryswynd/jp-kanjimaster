# Rikizo Tutor Server (V1 — Press-to-Ask)

Cloud Run + Firestore backend for the app's first network-backed feature. V1 ships
**Press-to-Ask** only (voice/text question → typed Claude answer). Live Mode is V2.

## Status
- ✅ Routes: `POST /v1/press-to-ask`, `GET /v1/quota`, `GET /healthz`
- ✅ Firestore device/quota model with atomic reserve → settle → refund
- ✅ Per-tier daily quota + daily cost caps, global kill switch + global cost breaker
- ✅ Cost meter (STT seconds + Claude tokens → cents) with structured cost logs
- ✅ Claude Haiku with prompt-cached persona; Google STT (single-chunk)
- ✅ Per-IP / per-device edge rate limit
- ⚠️ **App Attest crypto is stubbed** — structure + dev bypass are in place, but the
  CBOR parse + Apple cert-chain verification in `lib/attest.js` MUST be completed
  before the beta accepts real (non-bypass) devices. See `TODO(attest)` comments.

## Run locally
```bash
cd server
cp .env.example .env     # fill in keys; leave ATTEST_BYPASS=true for local dev
npm install
npm run dev
```

Smoke test (bypass mode, text question — no STT/GCP needed for the request shape,
but Claude + Firestore must be configured to get a real answer):
```bash
curl -s localhost:8080/healthz

curl -s localhost:8080/v1/press-to-ask \
  -H 'Content-Type: application/json' \
  -H 'X-Device-Id: dev-test-device-0001' \
  -d '{"text":"How do I say \"I want to eat sushi\"?"}' | jq
```

## Tiers (server-enforced; tune in Firestore `pricing-flags/global` without redeploy)
| tier | P2A/day | live/day | live/wk | daily $ cap |
|---|---|---|---|---|
| free | 5 | 0 | 0 | $0.10 |
| lite | 25 | 0 | 0 | $0.30 |
| mid | 50 | 0 | 2 | $2.00 |
| premium | 75 | 1 | 7 | $2.00 |

Family-beta entitlements without IAP: set `BETA_ENTITLEMENTS=deviceId:premium,…`
in env (overrides Firestore). Find a device's id in the app via `k-device-id`.

## Deploy (GCP)
1. `gcloud firestore databases create --location=…`
2. Put `ANTHROPIC_API_KEY` in Secret Manager; grant the Cloud Run SA access; also
   grant it Firestore + Speech-to-Text roles.
3. Create `pricing-flags/global` (optional — defaults apply if absent).
4. `gcloud run deploy rikizo-tutor --source . --set-secrets ANTHROPIC_API_KEY=…
   --set-env-vars APPLE_TEAM_ID=…,APP_BUNDLE_ID=com.rikizo.app,ATTEST_BYPASS=false`
5. Point the client at the service URL via `sharedConfig.tutorBaseUrl`.

## Client contract
`app/shared/tutor-client.js` posts `{text|audio, hint}` with `X-Device-Id` (and,
once attest lands, `X-Attest-Key-Id` / `X-Attest-Assertion`). Errors come back as
`{ reason }` with status — the client branches on `tier_quota` / `daily_cost_cap`.

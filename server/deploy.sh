#!/usr/bin/env bash
# One-shot Cloud Run deploy for the Rikizo tutor server.
# Run from the server/ dir:  ./deploy.sh
# Idempotent: re-running redeploys with the same settings.
set -euo pipefail
cd "$(dirname "$0")"

PROJ=project-9c65f87c-e8c8-409b-843
REGION=us-west1
SA=979574126888-compute@developer.gserviceaccount.com
# Admin cost dashboard: Firebase uids allowed to view /v1/admin/dashboard.
# (The shared-secret ADMIN_TOKEN is sourced from Secret Manager below, IF created —
#  `printf '%s' "$ADMIN_TOKEN" | gcloud secrets create ADMIN_TOKEN --data-file=-`.)
ADMIN_UIDS="${ADMIN_UIDS:-}"

echo "==> [1/4] Seeding pricing-flags/global (cost cap + kill switch)…"
GCLOUD_PROJECT="$PROJ" node scripts/seed-pricing-flags.mjs

echo "==> [2/4] Staging curriculum into the image…"
npm run --silent predeploy

echo "==> [3/4] Granting Cloud Run service account Firestore + Secret access…"
gcloud projects add-iam-policy-binding "$PROJ" \
  --member="serviceAccount:${SA}" --role="roles/datastore.user" \
  --condition=None --quiet >/dev/null
gcloud projects add-iam-policy-binding "$PROJ" \
  --member="serviceAccount:${SA}" --role="roles/secretmanager.secretAccessor" \
  --condition=None --quiet >/dev/null
echo "    IAM bindings applied."

echo "==> [4/4] Deploying to Cloud Run (region ${REGION}; ~3-5 min)…"
# Mount ADMIN_TOKEN from Secret Manager only if the secret exists (so the dashboard
# secret is optional — uid-allowlist access still works without it).
SECRETS="ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,GROQ_API_KEY=GROQ_API_KEY:latest"
if gcloud secrets describe ADMIN_TOKEN --project "$PROJ" >/dev/null 2>&1; then
  SECRETS="${SECRETS},ADMIN_TOKEN=ADMIN_TOKEN:latest"
  echo "    ADMIN_TOKEN secret found — mounting it."
else
  echo "    (no ADMIN_TOKEN secret — dashboard will rely on ADMIN_UIDS only)"
fi
gcloud run deploy rikizo-tutor \
  --source . \
  --region "$REGION" \
  --project "$PROJ" \
  --allow-unauthenticated \
  --min-instances 1 --max-instances 1 \
  --set-env-vars "GCLOUD_PROJECT=${PROJ},CURRICULUM_ROOT=/app/curriculum,ATTEST_BYPASS=true,ADMIN_UIDS=${ADMIN_UIDS}" \
  --set-secrets "$SECRETS"

URL=$(gcloud run services describe rikizo-tutor --region "$REGION" --project "$PROJ" --format="value(status.url)")
echo ""
echo "================================================================"
echo " DEPLOYED. Service URL:"
echo "   $URL"
echo " Smoke test:"
echo "   curl -s $URL/healthz"
echo "================================================================"

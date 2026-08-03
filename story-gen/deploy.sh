#!/usr/bin/env bash
# One-shot Cloud Run deploy for the custom-story generator.
# Run from the story-gen/ dir:  ./deploy.sh
# Same GCP/Firebase project as the tutor → shares Auth + Firestore + the
# ANTHROPIC_API_KEY secret. Idempotent.
set -euo pipefail
cd "$(dirname "$0")"

PROJ=project-9c65f87c-e8c8-409b-843
REGION=us-west1
SA=979574126888-compute@developer.gserviceaccount.com
ADMIN_UIDS="${ADMIN_UIDS:-}"

echo "==> [1/3] Staging pipeline libs + curriculum into the image…"
npm run --silent predeploy

echo "==> [2/3] Granting Cloud Run service account Firestore + Secret access…"
gcloud projects add-iam-policy-binding "$PROJ" \
  --member="serviceAccount:${SA}" --role="roles/datastore.user" \
  --condition=None --quiet >/dev/null
gcloud projects add-iam-policy-binding "$PROJ" \
  --member="serviceAccount:${SA}" --role="roles/secretmanager.secretAccessor" \
  --condition=None --quiet >/dev/null
echo "    IAM bindings applied."

echo "==> [3/3] Deploying rikizo-story-gen to Cloud Run (region ${REGION}; ~3-5 min)…"
# Reuses the EXISTING ANTHROPIC_API_KEY secret (no new secret needed for text-only).
SECRETS="ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest"
if gcloud secrets describe ADMIN_TOKEN --project "$PROJ" >/dev/null 2>&1; then
  SECRETS="${SECRETS},ADMIN_TOKEN=ADMIN_TOKEN:latest"
  echo "    ADMIN_TOKEN secret found — mounting it for the cost dashboard."
fi
# COST: scale-to-zero + default CPU throttling (Aug 2026). This service now
# exists for the Friends API (both apps); custom-story GENERATION is mothballed —
# its post-response background work needs an always-on unthrottled instance
# (~$50/mo idle, the July 2026 bill). Rearchitect first (generate inside the
# request window, or a Cloud Run Job) before re-adding --min-instances 1 /
# --no-cpu-throttling.
gcloud run deploy rikizo-story-gen \
  --source . \
  --region "$REGION" \
  --project "$PROJ" \
  --allow-unauthenticated \
  --min-instances 0 --max-instances 1 \
  --memory 1Gi --cpu 1 --timeout 600 \
  --cpu-throttling \
  --set-env-vars "GCLOUD_PROJECT=${PROJ},CONTENT_ROOT=/app/content,ADMIN_UIDS=${ADMIN_UIDS}" \
  --set-secrets "$SECRETS"

URL=$(gcloud run services describe rikizo-story-gen --region "$REGION" --project "$PROJ" --format="value(status.url)")
echo ""
echo "================================================================"
echo " DEPLOYED. Service URL:"
echo "   $URL"
echo "   curl -s $URL/healthz"
echo " Set this as storyGenBaseUrl in index.html, then build:www + cap sync."
echo "================================================================"

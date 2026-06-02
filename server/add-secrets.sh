#!/usr/bin/env bash
# Adds the actual key bytes as a new version to each (already-created) secret,
# reading them from .env so nothing is typed/pasted. Run from server/:  ./add-secrets.sh
set -euo pipefail
cd "$(dirname "$0")"

PROJ=project-9c65f87c-e8c8-409b-843

# Load keys from .env (gitignored)
set -a; . ./.env; set +a

# Sanity: keys must be present and non-empty before we push them.
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then echo "ERROR: ANTHROPIC_API_KEY empty in .env"; exit 1; fi
if [ -z "${GROQ_API_KEY:-}" ]; then echo "ERROR: GROQ_API_KEY empty in .env"; exit 1; fi
echo "Key lengths — anthropic: ${#ANTHROPIC_API_KEY}, groq: ${#GROQ_API_KEY}"

echo "==> adding ANTHROPIC_API_KEY version…"
printf '%s' "$ANTHROPIC_API_KEY" | gcloud secrets versions add ANTHROPIC_API_KEY --data-file=- --project="$PROJ"

echo "==> adding GROQ_API_KEY version…"
printf '%s' "$GROQ_API_KEY" | gcloud secrets versions add GROQ_API_KEY --data-file=- --project="$PROJ"

echo ""
echo "==> versions now present (want one ENABLED each):"
echo "-- ANTHROPIC_API_KEY --"
gcloud secrets versions list ANTHROPIC_API_KEY --project="$PROJ" --format="value(name,state)"
echo "-- GROQ_API_KEY --"
gcloud secrets versions list GROQ_API_KEY --project="$PROJ" --format="value(name,state)"

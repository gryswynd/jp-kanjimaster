#!/usr/bin/env bash
# Run the Rikizo tutor server locally with the in-memory store (no GCP needed).
# Requires only an Anthropic API key for real answers.
#
# Usage:
#   ANTHROPIC_API_KEY=sk-ant-... ./run-local.sh            # localhost only
#   ANTHROPIC_API_KEY=sk-ant-... ./run-local.sh --lan      # also reachable from a device on your wifi
#
# Then point the app at it by opening it with a ?tutor= query param:
#   - Browser / iOS simulator:  ?tutor=http://localhost:8788
#   - Real iPhone on wifi:      ?tutor=http://<your-mac-LAN-ip>:8788   (use --lan to print the ip)
# The url is persisted (k-tutor-base-url), so you only need the param once.
set -euo pipefail

cd "$(dirname "$0")"
PORT="${PORT:-8788}"

# Load .env (gitignored) if present, so keys live in one file you don't paste.
# Lines like  ANTHROPIC_API_KEY=sk-ant-...  and  GOOGLE_APPLICATION_CREDENTIALS=./sa.json
if [[ -f .env ]]; then
  set -a; . ./.env; set +a
  echo "Loaded .env"
fi

if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  echo "⚠️  ANTHROPIC_API_KEY is not set — the server runs but /v1/press-to-ask"
  echo "    returns 503 anthropic_not_configured. Export the key for real answers."
fi

# STT = Groq (hosted Whisper). Just needs GROQ_API_KEY in .env.
if [[ -z "${GROQ_API_KEY:-}" ]]; then
  echo "ℹ️  GROQ_API_KEY not set — VOICE returns 503 until you add it to .env."
  echo "    Get one (free) at https://console.groq.com → API Keys. Typed Q&A works."
fi

if [[ "${1:-}" == "--lan" ]]; then
  IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
  echo "LAN mode — open the app on a wifi device with:  ?tutor=http://${IP:-<your-mac-ip>}:${PORT}"
fi

echo "Starting tutor server on :${PORT} (memory store, attest bypass)…"
TUTOR_STORE=memory ATTEST_BYPASS=true PORT="${PORT}" exec node index.js

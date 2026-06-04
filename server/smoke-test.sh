#!/usr/bin/env bash
# One-shot smoke test for the local (memory-store) tutor server.
# Usage:  ./smoke-test.sh           # tests quota + error shapes (no key needed)
#         ANTHROPIC_API_KEY=sk-... ./smoke-test.sh   # also tests a real answer
set -uo pipefail
PORT="${PORT:-8788}"
DEV="smoke-$(date +%s)"

echo "Starting server on :$PORT (memory store, attest bypass)…"
TUTOR_STORE=memory ATTEST_BYPASS=true PORT="$PORT" node index.js > /tmp/tutor-smoke.log 2>&1 &
SRV=$!
sleep 2.5

pass=0; fail=0
check() { # name  expected-substring  actual
  if [[ "$3" == *"$2"* ]]; then echo "  ✓ $1"; pass=$((pass+1));
  else echo "  ✗ $1 — expected '$2', got: $3"; fail=$((fail+1)); fi
}

echo "health:";  check "health ok"        '"ok":true'         "$(curl -s localhost:$PORT/healthz)"
echo "quota:";   check "free tier = 5"    '"remaining":5'     "$(curl -s localhost:$PORT/v1/quota -H "X-Device-Id: $DEV")"
echo "errors:";  check "no device → 400"  'missing_device_id' "$(curl -s localhost:$PORT/v1/quota)"
                 check "empty body → 400" 'missing_input'     "$(curl -s localhost:$PORT/v1/press-to-ask -H 'Content-Type: application/json' -H "X-Device-Id: $DEV" -d '{}')"

if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
  echo "live answer:"
  R=$(curl -s localhost:$PORT/v1/press-to-ask -H 'Content-Type: application/json' -H "X-Device-Id: $DEV" -d '{"text":"How do I say I want to eat sushi?"}')
  check "got an answer" '"answer"' "$R"
  echo "    → $R"
else
  echo "live answer: (skipped — set ANTHROPIC_API_KEY to test a real reply)"
fi

kill -9 $SRV 2>/dev/null
echo ""
echo "RESULT: $pass passed, $fail failed"
[[ $fail -eq 0 ]] && echo "✅ server works in memory mode" || { echo "❌ see /tmp/tutor-smoke.log"; tail -20 /tmp/tutor-smoke.log; }

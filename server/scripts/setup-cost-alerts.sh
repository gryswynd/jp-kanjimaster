#!/usr/bin/env bash
# Cloud Monitoring email alerts for tutor cost — the "email half" of the hybrid
# cost monitor (the custom dashboard is the visual half: GET /v1/admin/dashboard).
#
# These read the structured `cost_meter` log line that the server emits per billable
# request (server/lib/cost-meter.js), which now carries a per-service split
# (claudeInputCents / claudeOutputCents / sttCents / firestoreCents) plus the
# combined costCents.
#
# What this creates (idempotent-ish — it skips objects that already exist by name):
#   1. an Email notification channel → gryswynd@gmail.com
#   2. a distribution log-based metric `cost_request_cents` (per-request costCents)
#   3. a distribution log-based metric `cost_stt_cents`     (per-request sttCents)
#   4. alert policy: a SINGLE request is abnormally expensive  (the user's
#      "alert if a single one is super expensive")
#
# These are ADVISORY emails. The hard stop is unchanged: pricing-flags/global
# {killSwitch, maxDailyTotalUSD} enforced in routes/press-to-ask.js.
#
# Run (needs `gcloud auth login` + Monitoring/Logging Admin):  ./setup-cost-alerts.sh
set -euo pipefail
cd "$(dirname "$0")"

PROJ=project-9c65f87c-e8c8-409b-843
ALERT_EMAIL="${ALERT_EMAIL:-gryswynd@gmail.com}"
# Threshold (cents) for the "single super-expensive request" alert. Haiku P2A is a
# fraction of a cent; 10¢ is a wild outlier worth an email. Tune after observing p99.
OUTLIER_CENTS="${OUTLIER_CENTS:-10}"

echo "==> [1/4] Email notification channel ($ALERT_EMAIL)…"
CH=$(gcloud beta monitoring channels list --project="$PROJ" \
      --filter="type=email AND labels.email_address=$ALERT_EMAIL" \
      --format="value(name)" | head -n1 || true)
if [ -z "$CH" ]; then
  CH=$(gcloud beta monitoring channels create --project="$PROJ" \
        --display-name="Rikizo cost alerts" --type=email \
        --channel-labels="email_address=$ALERT_EMAIL" \
        --format="value(name)")
  echo "    created channel: $CH"
else
  echo "    reusing channel: $CH"
fi

echo "==> [2/4] Log-based metric cost_request_cents…"
if ! gcloud logging metrics describe cost_request_cents --project="$PROJ" >/dev/null 2>&1; then
  gcloud logging metrics create cost_request_cents --project="$PROJ" \
    --description="Per-request tutor cost in cents (combined), from cost_meter logs" \
    --log-filter='jsonPayload.kind="cost_meter"' \
    --value-extractor='EXTRACT(jsonPayload.costCents)'
else echo "    exists — skipping"; fi

echo "==> [3/4] Log-based metric cost_stt_cents…"
if ! gcloud logging metrics describe cost_stt_cents --project="$PROJ" >/dev/null 2>&1; then
  gcloud logging metrics create cost_stt_cents --project="$PROJ" \
    --description="Per-request Groq STT cost in cents, from cost_meter logs" \
    --log-filter='jsonPayload.kind="cost_meter"' \
    --value-extractor='EXTRACT(jsonPayload.sttCents)'
else echo "    exists — skipping"; fi

echo "==> [4/4] Alert policy: single super-expensive request (> ${OUTLIER_CENTS}¢)…"
POLICY_FILE="$(mktemp)"
cat > "$POLICY_FILE" <<YAML
displayName: "Tutor: a single request is super expensive (> ${OUTLIER_CENTS}¢)"
combiner: OR
conditions:
  - displayName: "p99 per-request cost > ${OUTLIER_CENTS}¢ (5m)"
    conditionThreshold:
      filter: 'metric.type="logging.googleapis.com/user/cost_request_cents" AND resource.type="cloud_run_revision"'
      comparison: COMPARISON_GT
      thresholdValue: ${OUTLIER_CENTS}
      duration: 0s
      aggregations:
        - alignmentPeriod: 300s
          perSeriesAligner: ALIGN_PERCENTILE_99
notificationChannels:
  - ${CH}
documentation:
  content: "A tutor request cost more than ${OUTLIER_CENTS}¢ — investigate (long audio, big output, or abuse). Hard stop is the kill switch / maxDailyTotalUSD; this is advisory."
  mimeType: text/markdown
YAML
gcloud alpha monitoring policies create --project="$PROJ" --policy-from-file="$POLICY_FILE"
rm -f "$POLICY_FILE"

cat <<NOTE

================================================================
 Cost alerts wired. You'll get email at $ALERT_EMAIL when a single
 tutor request exceeds ${OUTLIER_CENTS}¢.

 OPTIONAL — daily-budget email (approaching the \$/day cap):
   Summing a distribution metric over 24h is fiddler in the CLI; the
   cleanest path is the Monitoring console:
     Alerting → Create policy → metric "cost_request_cents"
       → Rolling window 1 day, function "sum"
       → threshold = 80% of pricing-flags/global.maxDailyTotalUSD (in cents)
       → same notification channel ($ALERT_EMAIL).
   (The dashboard's today-vs-cap gauge + spike banner already show this
    at a glance, and the kill switch hard-stops regardless.)
================================================================
NOTE

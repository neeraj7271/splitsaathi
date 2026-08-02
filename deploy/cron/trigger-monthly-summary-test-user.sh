#!/usr/bin/env bash
# Trigger a single-user monthly summary on the live API (real DB data, real Brevo send).
# Usage:
#   ./deploy/cron/trigger-monthly-summary-test-user.sh neerajsuman766@gmail.com
#
# Optional: CRON_SECRET=... ./deploy/cron/trigger-monthly-summary-test-user.sh email@example.com
# Optional: SPLITSAATHI_API_ENV=/path/to/env ./deploy/cron/trigger-monthly-summary-test-user.sh

set -euo pipefail

export TZ=Asia/Kolkata

EMAIL="${1:-neerajsuman766@gmail.com}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/deploy/cron/load-api-env.sh"
load_api_env "$ROOT"
require_cron_secret "$ROOT"

API_BASE="${MOBILE_API_URL:-${APP_PUBLIC_URL:-http://127.0.0.1:3000}}"
API_BASE="${API_BASE%/}"

PAYLOAD=$(printf '{"testEmail":"%s"}' "$EMAIL")

echo "$(date -Is) IST — POST $API_BASE/v1/jobs/monthly-settlement-summaries (testEmail=$EMAIL)"
HTTP_CODE=$(curl -sS -o /tmp/splitsaathi-monthly-test-user.json -w "%{http_code}" \
  -X POST "$API_BASE/v1/jobs/monthly-settlement-summaries" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $CRON_SECRET" \
  -d "$PAYLOAD")

echo "HTTP $HTTP_CODE"
cat /tmp/splitsaathi-monthly-test-user.json || true
echo

if [[ "$HTTP_CODE" != "200" && "$HTTP_CODE" != "201" && "$HTTP_CODE" != "202" ]]; then
  exit 1
fi

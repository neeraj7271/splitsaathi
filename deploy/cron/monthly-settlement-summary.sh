#!/usr/bin/env bash
# Monthly settlement summary emails for all groups.
#
# Install in crontab (1st of each month at 08:00 IST / Asia/Kolkata):
#   CRON_TZ=Asia/Kolkata
#   0 8 1 * * /path/to/splitsaathi/deploy/cron/monthly-settlement-summary.sh >> /var/log/splitsaathi-monthly-mail.log 2>&1
#
# Requires API env: CRON_SECRET, EMAIL_PROVIDER_DRIVER=brevo (or resend) with sender credentials.

set -euo pipefail

export TZ=Asia/Kolkata

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/deploy/cron/load-api-env.sh"
load_api_env "$ROOT"
require_cron_secret "$ROOT"

API_BASE="${MOBILE_API_URL:-${APP_PUBLIC_URL:-http://127.0.0.1:3000}}"
API_BASE="${API_BASE%/}"

echo "$(date -Is) IST — POST $API_BASE/v1/jobs/monthly-settlement-summaries"
HTTP_CODE=$(curl -sS -o /tmp/splitsaathi-monthly-mail.json -w "%{http_code}" \
  -X POST "$API_BASE/v1/jobs/monthly-settlement-summaries" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $CRON_SECRET")

echo "HTTP $HTTP_CODE"
cat /tmp/splitsaathi-monthly-mail.json || true
echo

if [[ "$HTTP_CODE" != "200" && "$HTTP_CODE" != "201" && "$HTTP_CODE" != "202" ]]; then
  exit 1
fi

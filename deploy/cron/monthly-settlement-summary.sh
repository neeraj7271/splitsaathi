#!/usr/bin/env bash
# Monthly settlement summary emails for all groups.
# Install (1st of each month at 08:00 IST):
#   0 8 1 * * /path/to/splitsaathi/deploy/cron/monthly-settlement-summary.sh >> /var/log/splitsaathi-monthly-mail.log 2>&1
#
# Requires API env: CRON_SECRET, and EMAIL_PROVIDER_DRIVER=resend with RESEND_API_KEY + EMAIL_FROM for real delivery.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${SPLITSATHI_API_ENV:-$ROOT/deploy/api.docker.env}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a
  # Only export simple KEY=VALUE lines
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line// }" ]] && continue
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      export "$line"
    fi
  done < "$ENV_FILE"
  set +a
fi

API_BASE="${MOBILE_API_URL:-${APP_PUBLIC_URL:-http://127.0.0.1:3000}}"
API_BASE="${API_BASE%/}"
SECRET="${CRON_SECRET:-}"

if [[ -z "$SECRET" ]]; then
  echo "CRON_SECRET is not set. Aborting." >&2
  exit 1
fi

echo "$(date -Is) POST $API_BASE/v1/jobs/monthly-settlement-summaries"
HTTP_CODE=$(curl -sS -o /tmp/splitsaathi-monthly-mail.json -w "%{http_code}" \
  -X POST "$API_BASE/v1/jobs/monthly-settlement-summaries" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $SECRET")

echo "HTTP $HTTP_CODE"
cat /tmp/splitsaathi-monthly-mail.json || true
echo

if [[ "$HTTP_CODE" != "200" && "$HTTP_CODE" != "201" && "$HTTP_CODE" != "202" ]]; then
  exit 1
fi

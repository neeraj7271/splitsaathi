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
if [[ -n "${SPLITSAATHI_API_ENV:-}" ]]; then
  ENV_FILE="$SPLITSAATHI_API_ENV"
elif [[ -f "$ROOT/deploy/api.docker.env" ]]; then
  ENV_FILE="$ROOT/deploy/api.docker.env"
elif [[ -f "$ROOT/apps/api/.env" ]]; then
  ENV_FILE="$ROOT/apps/api/.env"
else
  ENV_FILE=""
fi

if [[ -n "$ENV_FILE" && -f "$ENV_FILE" ]]; then
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
  echo "CRON_SECRET is not set. Set it in deploy/api.docker.env (production) or apps/api/.env (local)." >&2
  exit 1
fi

echo "$(date -Is) IST — POST $API_BASE/v1/jobs/monthly-settlement-summaries"
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

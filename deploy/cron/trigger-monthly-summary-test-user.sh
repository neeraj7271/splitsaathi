#!/usr/bin/env bash
# Trigger a single-user monthly summary on the live API (real DB data, real Brevo send).
# Usage:
#   ./deploy/cron/trigger-monthly-summary-test-user.sh neerajsuman766@gmail.com
#
# Run on the API host (recommended) or anywhere that can reach APP_PUBLIC_URL.
# Reads CRON_SECRET from deploy/api.docker.env or apps/api/.env.

set -euo pipefail

export TZ=Asia/Kolkata

EMAIL="${1:-neerajsuman766@gmail.com}"
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
  set -a
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
  echo "CRON_SECRET is not set. Add it to deploy/api.docker.env or apps/api/.env." >&2
  exit 1
fi

PAYLOAD=$(printf '{"testEmail":"%s"}' "$EMAIL")

echo "$(date -Is) IST — POST $API_BASE/v1/jobs/monthly-settlement-summaries (testEmail=$EMAIL)"
HTTP_CODE=$(curl -sS -o /tmp/splitsaathi-monthly-test-user.json -w "%{http_code}" \
  -X POST "$API_BASE/v1/jobs/monthly-settlement-summaries" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $SECRET" \
  -d "$PAYLOAD")

echo "HTTP $HTTP_CODE"
cat /tmp/splitsaathi-monthly-test-user.json || true
echo

if [[ "$HTTP_CODE" != "200" && "$HTTP_CODE" != "201" && "$HTTP_CODE" != "202" ]]; then
  exit 1
fi

#!/usr/bin/env bash
# Ensure CRON_SECRET exists in deploy/api.docker.env (used by API container + cron scripts).
# Usage:
#   ./deploy/cron/ensure-cron-secret.sh
#   ./deploy/cron/ensure-cron-secret.sh my-custom-secret-at-least-16-chars

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT/deploy/api.docker.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Creating $ENV_FILE from deploy/env.example"
  cp "$ROOT/deploy/env.example" "$ENV_FILE"
fi

SECRET="${1:-}"
if [[ -z "$SECRET" ]]; then
  if grep -q '^CRON_SECRET=.\+' "$ENV_FILE" 2>/dev/null; then
    echo "CRON_SECRET already set in $ENV_FILE"
    grep '^CRON_SECRET=' "$ENV_FILE"
    exit 0
  fi
  SECRET="splitsaathi-cron-$(openssl rand -hex 12)"
  echo "Generated new CRON_SECRET"
fi

if [[ ${#SECRET} -lt 16 ]]; then
  echo "CRON_SECRET must be at least 16 characters." >&2
  exit 1
fi

if grep -q '^CRON_SECRET=' "$ENV_FILE"; then
  sed -i "s|^CRON_SECRET=.*|CRON_SECRET=$SECRET|" "$ENV_FILE"
else
  printf '\n# Cron → POST /v1/jobs/* (header: x-cron-secret)\nCRON_SECRET=%s\n' "$SECRET" >> "$ENV_FILE"
fi

echo "Updated $ENV_FILE"
grep '^CRON_SECRET=' "$ENV_FILE"
echo ""
echo "Restart the API so the container picks up the secret:"
echo "  cd $ROOT && bash deploy/start.sh"

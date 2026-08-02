#!/usr/bin/env bash
# Load API env vars for cron scripts. Source from deploy/cron/*.sh — do not execute directly.
# Sets: ENV_FILE (if found), CRON_SECRET, APP_PUBLIC_URL, MOBILE_API_URL

load_api_env() {
  local root="$1"
  ENV_FILE=""

  local candidates=()
  if [[ -n "${SPLITSAATHI_API_ENV:-}" ]]; then
    candidates+=("$SPLITSAATHI_API_ENV")
  fi
  candidates+=(
    "$root/deploy/api.docker.env"
    "$root/apps/api/.env"
    "$root/deploy/.env"
  )

  for candidate in "${candidates[@]}"; do
    [[ -z "$candidate" || ! -f "$candidate" ]] && continue
    ENV_FILE="$candidate"
    set -a
    while IFS= read -r line || [[ -n "$line" ]]; do
      [[ "$line" =~ ^[[:space:]]*# ]] && continue
      [[ -z "${line// }" ]] && continue
      if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
        export "$line"
      fi
    done < "$ENV_FILE"
    set +a
    break
  done

  if [[ -z "${CRON_SECRET:-}" ]] && command -v docker >/dev/null 2>&1; then
    if [[ -f "$root/deploy/docker-compose.yml" ]]; then
      local from_container
      from_container=$(
        docker compose --env-file "$root/deploy/.env" -f "$root/deploy/docker-compose.yml" \
          exec -T api printenv CRON_SECRET 2>/dev/null || true
      )
      if [[ -n "$from_container" ]]; then
        export CRON_SECRET="$from_container"
      fi
    fi
  fi
}

require_cron_secret() {
  local root="$1"
  if [[ -n "${CRON_SECRET:-}" ]]; then
    return 0
  fi

  echo "CRON_SECRET is not set." >&2
  echo "" >&2
  echo "On the API server, add to deploy/api.docker.env (create from deploy/env.example if missing):" >&2
  echo "  CRON_SECRET=your-secret-at-least-16-chars" >&2
  echo "" >&2
  echo "Then restart the API:" >&2
  echo "  cd $root && bash deploy/start.sh" >&2
  echo "" >&2
  echo "Or run once with an inline secret:" >&2
  echo "  CRON_SECRET=your-secret ./deploy/cron/trigger-monthly-summary-test-user.sh you@example.com" >&2
  echo "" >&2
  if [[ -n "${ENV_FILE:-}" ]]; then
    echo "Checked env file: $ENV_FILE (CRON_SECRET missing or empty)" >&2
  else
    echo "No env file found. Looked for:" >&2
    echo "  $root/deploy/api.docker.env" >&2
    echo "  $root/apps/api/.env" >&2
    echo "  $root/deploy/.env" >&2
  fi
  return 1
}

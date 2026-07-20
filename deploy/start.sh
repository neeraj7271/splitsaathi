#!/usr/bin/env bash
# Start/restart infra + API on the Ubuntu VM. Run from monorepo root.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f deploy/.env ]]; then
  echo "Missing deploy/.env — copy from deploy/env.example and fill secrets."
  exit 1
fi
if [[ ! -f apps/api/.env ]]; then
  echo "Missing apps/api/.env — copy from deploy/env.example and fill secrets."
  exit 1
fi

mkdir -p deploy/logs

echo "==> Starting Postgres + MinIO"
docker compose --env-file deploy/.env -f deploy/docker-compose.yml up -d

echo "==> Waiting for Postgres"
for i in {1..30}; do
  if docker exec splitsaathi_postgres pg_isready -U splitsaathi >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "==> Running migrations"
# Prefer DATABASE_URL already in the environment; otherwise pull from apps/api/.env
if [[ -z "${DATABASE_URL:-}" ]]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' apps/api/.env | head -1 | cut -d= -f2-)"
  export DATABASE_URL
fi
npm run migration:run

echo "==> Building"
bash deploy/build.sh

echo "==> Starting / restarting API with PM2"
if pm2 describe splitsaathi-api >/dev/null 2>&1; then
  pm2 restart deploy/ecosystem.config.cjs --update-env
else
  pm2 start deploy/ecosystem.config.cjs
fi
pm2 save

echo ""
echo "API should be on 127.0.0.1:3000 (nginx fronts it on :80)."
echo "Health: curl -s http://127.0.0.1:3000/v1/health/live"
echo "Public: curl -s http://YOUR_VM_IP/v1/health/live"

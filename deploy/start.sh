#!/usr/bin/env bash
# Start/restart full stack in Docker (Postgres + MinIO + API). Run from monorepo root.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f deploy/.env ]]; then
  echo "Missing deploy/.env"
  exit 1
fi
if [[ ! -f deploy/api.docker.env ]]; then
  echo "Missing deploy/api.docker.env — copy from deploy/env.example / create with docker hostnames."
  exit 1
fi

COMPOSE=(docker compose --env-file deploy/.env -f deploy/docker-compose.yml)

echo "==> Building + starting Postgres, MinIO, API"
"${COMPOSE[@]}" up -d --build

echo "==> Waiting for API health"
ok=0
for _ in $(seq 1 60); do
  if curl -sf http://127.0.0.1:3000/v1/health/live >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 2
done

if [[ "$ok" -ne 1 ]]; then
  echo "API did not become healthy. Recent logs:"
  "${COMPOSE[@]}" logs --tail=80 api
  exit 1
fi

echo ""
"${COMPOSE[@]}" ps
echo ""
echo "API is on 127.0.0.1:3000 (nginx should proxy public :80/:443 here)."
echo "Health: curl -s http://127.0.0.1:3000/v1/health/ready"
echo "Public: curl -s http://65.20.81.44/v1/health/live"

#!/usr/bin/env bash
# Build workspace packages + API from monorepo root.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> npm ci"
npm ci

echo "==> Building packages (order matters for workspace deps)"
npm run build -w @splitsaathi/contracts
npm run build -w @splitsaathi/config
npm run build -w @splitsaathi/domain
npm run build -w @splitsaathi/db
npm run build -w @splitsaathi/api

echo "==> Build complete"
ls -la apps/api/dist/main.js

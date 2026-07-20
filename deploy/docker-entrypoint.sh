#!/bin/sh
set -eu

echo "==> Running database migrations"
npx typeorm migration:run -d packages/db/dist/data-source.js

echo "==> Starting SplitSaathi API"
exec node apps/api/dist/main.js

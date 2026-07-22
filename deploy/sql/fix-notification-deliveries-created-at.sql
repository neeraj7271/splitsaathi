-- Hotfix if you need UPI handoff working before rebuilding the API image.
-- Run against the Docker Postgres used by SplitSaathi:

-- docker compose --env-file deploy/.env -f deploy/docker-compose.yml exec -T postgres \
--   psql -U splitsaathi -d splitsaathi < deploy/sql/fix-notification-deliveries-created-at.sql

ALTER TABLE notification_deliveries
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE notification_deliveries
  ALTER COLUMN channel SET DEFAULT 'push';

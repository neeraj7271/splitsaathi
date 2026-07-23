-- Hotfix: allow provider='email' on auth_identities (required for Google sign-in).
-- Without this, inserts fail with:
--   new row for relation "auth_identities" violates check constraint "auth_identities_provider_check"
--
-- docker compose --env-file deploy/.env -f deploy/docker-compose.yml exec -T postgres \
--   psql -U splitsaathi -d splitsaathi < deploy/sql/fix-auth-identities-email-provider.sql

DO $$
DECLARE
  constr text;
BEGIN
  FOR constr IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'auth_identities'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%provider%'
  LOOP
    EXECUTE format('ALTER TABLE auth_identities DROP CONSTRAINT %I', constr);
  END LOOP;
END $$;

ALTER TABLE auth_identities
  ADD CONSTRAINT auth_identities_provider_check
  CHECK (provider IN ('phone', 'phone_otp', 'google', 'apple', 'email'));

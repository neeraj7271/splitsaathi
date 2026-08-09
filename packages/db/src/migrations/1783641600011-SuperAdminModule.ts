import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SuperAdminModule1783641600011 implements MigrationInterface {
  name = 'SuperAdminModule1783641600011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'read_only',
        status TEXT NOT NULL DEFAULT 'active',
        totp_secret TEXT,
        totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_users_email ON admin_users (email);

      CREATE TABLE IF NOT EXISTS admin_refresh_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id UUID NOT NULL,
        refresh_token_hash TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_admin_refresh_sessions_admin_id ON admin_refresh_sessions (admin_id);

      CREATE TABLE IF NOT EXISTS admin_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id UUID NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        before JSONB,
        after JSONB,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_created ON admin_audit_log (admin_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action_created ON admin_audit_log (action, created_at);
      CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON admin_audit_log (target_type, target_id);

      CREATE TABLE IF NOT EXISTS admin_support_tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_number TEXT NOT NULL,
        user_id UUID NOT NULL,
        subject TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        priority TEXT NOT NULL DEFAULT 'medium',
        assigned_admin_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_support_tickets_number ON admin_support_tickets (ticket_number);
      CREATE INDEX IF NOT EXISTS idx_admin_support_tickets_user_status ON admin_support_tickets (user_id, status);

      CREATE TABLE IF NOT EXISTS admin_support_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id UUID NOT NULL,
        sender_type TEXT NOT NULL,
        sender_id UUID NOT NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_admin_support_messages_ticket_created ON admin_support_messages (ticket_id, created_at);

      CREATE TABLE IF NOT EXISTS admin_feature_flags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key TEXT NOT NULL,
        description TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT FALSE,
        rollout_percentage INTEGER NOT NULL DEFAULT 100,
        target_platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
        min_app_version TEXT,
        updated_by_admin_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_feature_flags_key ON admin_feature_flags (key);

      CREATE TABLE IF NOT EXISTS admin_app_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        platform TEXT NOT NULL,
        min_supported_version TEXT NOT NULL DEFAULT '1.0.0',
        latest_version TEXT NOT NULL DEFAULT '1.0.0',
        force_update_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        changelog TEXT,
        updated_by_admin_id UUID,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_app_configs_platform ON admin_app_configs (platform);

      CREATE TABLE IF NOT EXISTS admin_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type TEXT NOT NULL,
        user_id UUID,
        group_id UUID,
        amount_minor BIGINT,
        currency_code CHAR(3),
        platform TEXT,
        app_version TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_admin_events_type_occurred ON admin_events (event_type, occurred_at);
      CREATE INDEX IF NOT EXISTS idx_admin_events_user_occurred ON admin_events (user_id, occurred_at);

      CREATE TABLE IF NOT EXISTS billing_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        amount_minor BIGINT NOT NULL,
        currency_code CHAR(3) NOT NULL DEFAULT 'INR',
        interval TEXT NOT NULL DEFAULT 'monthly',
        features JSONB NOT NULL DEFAULT '{}'::jsonb,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_plans_code ON billing_plans (code);

      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        plan_id UUID NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        mrr_amount_minor BIGINT NOT NULL DEFAULT 0,
        currency_code CHAR(3) NOT NULL DEFAULT 'INR',
        current_period_start TIMESTAMPTZ NOT NULL,
        current_period_end TIMESTAMPTZ NOT NULL,
        canceled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON subscriptions (user_id, status);
    `);

    // Seed default billing plans if not exist
    await queryRunner.query(`
      INSERT INTO billing_plans (id, name, code, amount_minor, currency_code, interval, features, active)
      VALUES
        (gen_random_uuid(), 'Free Core Ledger', 'free', 0, 'INR', 'monthly', '{"unlimited_groups": true, "unlimited_expenses": true}'::jsonb, true),
        (gen_random_uuid(), 'Pro Monthly', 'pro_monthly', 19900, 'INR', 'monthly', '{"smart_ocr": true, "tally_export": true}'::jsonb, true),
        (gen_random_uuid(), 'Pro Annual', 'pro_yearly', 199900, 'INR', 'yearly', '{"smart_ocr": true, "tally_export": true}'::jsonb, true)
      ON CONFLICT (code) DO NOTHING;
    `);

    // Seed initial admin app configs
    await queryRunner.query(`
      INSERT INTO admin_app_configs (id, platform, min_supported_version, latest_version, force_update_enabled, changelog)
      VALUES
        (gen_random_uuid(), 'global', '1.0.0', '1.0.0', false, 'Initial release of SplitSaathi'),
        (gen_random_uuid(), 'android', '1.0.0', '1.0.0', false, 'SplitSaathi Android Live APK'),
        (gen_random_uuid(), 'ios', '1.0.0', '1.0.0', false, 'SplitSaathi iOS TestFlight')
      ON CONFLICT (platform) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS subscriptions;
      DROP TABLE IF EXISTS billing_plans;
      DROP TABLE IF EXISTS admin_events;
      DROP TABLE IF EXISTS admin_app_configs;
      DROP TABLE IF EXISTS admin_feature_flags;
      DROP TABLE IF EXISTS admin_support_messages;
      DROP TABLE IF EXISTS admin_support_tickets;
      DROP TABLE IF EXISTS admin_audit_log;
      DROP TABLE IF EXISTS admin_refresh_sessions;
      DROP TABLE IF EXISTS admin_users;
    `);
  }
}

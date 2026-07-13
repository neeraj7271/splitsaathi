import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UserPreferences1783641600001 implements MigrationInterface {
  name = 'UserPreferences1783641600001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE user_preferences (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        biometric_auth_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        session_timeout_seconds INTEGER NOT NULL DEFAULT 5
          CHECK (session_timeout_seconds IN (0, 5, 30, 60, 300, 600)),
        appearance TEXT NOT NULL DEFAULT 'system'
          CHECK (appearance IN ('system', 'light', 'dark')),
        push_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        email_group_added BOOLEAN NOT NULL DEFAULT TRUE,
        email_friend_added BOOLEAN NOT NULL DEFAULT TRUE,
        email_expense_added BOOLEAN NOT NULL DEFAULT FALSE,
        email_expense_edited BOOLEAN NOT NULL DEFAULT FALSE,
        email_expense_comment BOOLEAN NOT NULL DEFAULT FALSE,
        email_expense_due BOOLEAN NOT NULL DEFAULT TRUE,
        email_payment_received BOOLEAN NOT NULL DEFAULT TRUE,
        email_monthly_summary BOOLEAN NOT NULL DEFAULT TRUE,
        email_news_updates BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_preferences CASCADE;`);
  }
}

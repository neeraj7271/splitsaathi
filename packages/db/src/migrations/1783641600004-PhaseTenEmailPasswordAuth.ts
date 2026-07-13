import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PhaseTenEmailPasswordAuth1783641600004 implements MigrationInterface {
  name = 'PhaseTenEmailPasswordAuth1783641600004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS email_credentials (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(254) NOT NULL UNIQUE,
        user_id UUID NOT NULL REFERENCES users(id),
        password_hash VARCHAR(255) NOT NULL,
        verified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_email_credentials_user_id ON email_credentials(user_id);

      CREATE TABLE IF NOT EXISTS email_otp_challenges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(254) NOT NULL,
        purpose VARCHAR(24) NOT NULL CHECK (purpose IN ('signup', 'password_reset')),
        code_hash VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255),
        display_name VARCHAR(80),
        status VARCHAR(24) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'verified', 'failed', 'expired')),
        attempts INTEGER NOT NULL DEFAULT 0,
        expires_at TIMESTAMPTZ NOT NULL,
        resend_available_at TIMESTAMPTZ NOT NULL,
        verified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_email_otp_challenges_email_purpose_created
        ON email_otp_challenges(email, purpose, created_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS email_otp_challenges;
      DROP TABLE IF EXISTS email_credentials;
    `);
  }
}

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PhaseNineGroupAndPaymentFields1783641600002 implements MigrationInterface {
  name = 'PhaseNineGroupAndPaymentFields1783641600002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS upi_vpa VARCHAR(120);`);
    await queryRunner.query(`ALTER TABLE groups ADD COLUMN IF NOT EXISTS category VARCHAR(120);`);
    await queryRunner.query(
      `ALTER TABLE groups ADD COLUMN IF NOT EXISTS image_attachment_id UUID REFERENCES attachments(id) ON DELETE SET NULL;`
    );
    await queryRunner.query(
      `ALTER TABLE settlement_intents ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'upi'
       CHECK (payment_method IN ('cash', 'upi'));`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE settlement_intents DROP COLUMN IF EXISTS payment_method;`);
    await queryRunner.query(`ALTER TABLE groups DROP COLUMN IF EXISTS image_attachment_id;`);
    await queryRunner.query(`ALTER TABLE groups DROP COLUMN IF EXISTS category;`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS upi_vpa;`);
  }
}

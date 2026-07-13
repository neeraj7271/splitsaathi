import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PhaseTenGroupImagePurpose1783641600005 implements MigrationInterface {
  name = 'PhaseTenGroupImagePurpose1783641600005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_purpose_check;`);
    await queryRunner.query(
      `ALTER TABLE attachments ADD CONSTRAINT attachments_purpose_check
       CHECK (purpose IN ('receipt', 'payment_proof', 'avatar', 'group_image', 'export'));`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_purpose_check;`);
    await queryRunner.query(
      `ALTER TABLE attachments ADD CONSTRAINT attachments_purpose_check
       CHECK (purpose IN ('receipt', 'payment_proof', 'avatar', 'export'));`
    );
  }
}

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PhaseTenGroupType1783641600003 implements MigrationInterface {
  name = 'PhaseTenGroupType1783641600003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE groups ADD COLUMN IF NOT EXISTS group_type VARCHAR(24) NOT NULL DEFAULT 'other'
       CHECK (group_type IN ('trip', 'couple', 'home', 'event', 'business', 'other'));`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE groups DROP COLUMN IF EXISTS group_type;`);
  }
}

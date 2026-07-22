import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Align notification_deliveries with the API entity:
 * TypeORM inserts created_at via @CreateDateColumn, but the initial table lacked it.
 * That broke settlement UPI handoff after notifySettlementConfirmationRequested.
 */
export class NotificationDeliveriesCreatedAt1783641600007 implements MigrationInterface {
  name = 'NotificationDeliveriesCreatedAt1783641600007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE notification_deliveries
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE notification_deliveries
      ALTER COLUMN channel SET DEFAULT 'push'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE notification_deliveries
      ALTER COLUMN channel SET DEFAULT 'in_app'
    `);
    await queryRunner.query(`
      ALTER TABLE notification_deliveries
      DROP COLUMN IF EXISTS created_at
    `);
  }
}

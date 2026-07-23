import type { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationExpensePrefsDefaults1783641600008 implements MigrationInterface {
  name = 'NotificationExpensePrefsDefaults1783641600008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE user_preferences
        ALTER COLUMN email_expense_added SET DEFAULT true,
        ALTER COLUMN email_expense_edited SET DEFAULT true
    `);
    await queryRunner.query(`
      UPDATE user_preferences
      SET email_expense_added = true,
          email_expense_edited = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE user_preferences
        ALTER COLUMN email_expense_added SET DEFAULT false,
        ALTER COLUMN email_expense_edited SET DEFAULT false
    `);
  }
}

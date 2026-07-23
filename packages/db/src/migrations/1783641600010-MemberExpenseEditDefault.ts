import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Members can edit/void expenses by default. Admins can revoke via group settings.
 */
export class MemberExpenseEditDefault1783641600010 implements MigrationInterface {
  name = 'MemberExpenseEditDefault1783641600010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO group_role_permissions (id, group_id, role, permission, allowed)
      SELECT gen_random_uuid(), g.id, 'member', perms.permission, TRUE
      FROM groups g
      CROSS JOIN (
        VALUES
          ('financial.expense.edit.any'),
          ('financial.expense.void')
      ) AS perms(permission)
      WHERE NOT EXISTS (
        SELECT 1
        FROM group_role_permissions grp
        WHERE grp.group_id = g.id
          AND grp.role = 'member'
          AND grp.permission = perms.permission
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM group_role_permissions
      WHERE role = 'member'
        AND permission IN ('financial.expense.edit.any', 'financial.expense.void');
    `);
  }
}

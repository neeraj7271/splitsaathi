import type { MigrationInterface, QueryRunner } from 'typeorm';

const PERMISSIONS = [
  'expense_create',
  'expense_edit_own',
  'expense_edit_any',
  'expense_void',
  'settlement_confirm',
  'member_invite',
  'member_role_change',
  'export',
  'archive',
  'group.read',
  'group.invite.create',
  'group.update',
  'participant.create',
  'membership.role.update',
  'group.archive',
  'membership.exit.lock',
  'obligation_transfer.create',
  'financial.expense.create',
  'financial.expense.edit.any',
  'financial.expense.void',
  'financial.settlement.confirm',
  'financial.export'
] as const;

const PERMISSIONS_WITHOUT_GROUP_UPDATE = PERMISSIONS.filter((permission) => permission !== 'group.update');

function permissionCheckSql(values: readonly string[]) {
  return `CHECK (permission IN (${values.map((value) => `'${value}'`).join(', ')}))`;
}

export class PhaseElevenGroupUpdatePermission1783641600006 implements MigrationInterface {
  name = 'PhaseElevenGroupUpdatePermission1783641600006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE group_role_permissions
      DROP CONSTRAINT IF EXISTS group_role_permissions_permission_check;
    `);
    await queryRunner.query(`
      ALTER TABLE group_role_permissions
      ADD CONSTRAINT group_role_permissions_permission_check
      ${permissionCheckSql(PERMISSIONS)};
    `);
    await queryRunner.query(`
      INSERT INTO group_role_permissions (id, group_id, role, permission, allowed)
      SELECT gen_random_uuid(), g.id, roles.role, 'group.update', TRUE
      FROM groups g
      CROSS JOIN (VALUES ('owner'), ('admin')) AS roles(role)
      WHERE NOT EXISTS (
        SELECT 1
        FROM group_role_permissions grp
        WHERE grp.group_id = g.id
          AND grp.role = roles.role
          AND grp.permission = 'group.update'
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM group_role_permissions WHERE permission = 'group.update';
    `);
    await queryRunner.query(`
      ALTER TABLE group_role_permissions
      DROP CONSTRAINT IF EXISTS group_role_permissions_permission_check;
    `);
    await queryRunner.query(`
      ALTER TABLE group_role_permissions
      ADD CONSTRAINT group_role_permissions_permission_check
      ${permissionCheckSql(PERMISSIONS_WITHOUT_GROUP_UPDATE)};
    `);
  }
}

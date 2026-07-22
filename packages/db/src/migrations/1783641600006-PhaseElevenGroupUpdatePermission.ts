import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PhaseElevenGroupUpdatePermission1783641600006 implements MigrationInterface {
  name = 'PhaseElevenGroupUpdatePermission1783641600006';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
  }
}

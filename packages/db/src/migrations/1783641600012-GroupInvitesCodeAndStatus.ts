import { MigrationInterface, QueryRunner } from 'typeorm';

export class GroupInvitesCodeAndStatus1783641600012 implements MigrationInterface {
  name = 'GroupInvitesCodeAndStatus1783641600012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "group_invites"
      ADD COLUMN IF NOT EXISTS "token" VARCHAR(96),
      ADD COLUMN IF NOT EXISTS "code" VARCHAR(16),
      ADD COLUMN IF NOT EXISTS "max_uses" INT,
      ADD COLUMN IF NOT EXISTS "uses" INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "status" VARCHAR(24) NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

      CREATE UNIQUE INDEX IF NOT EXISTS "uq_group_invites_token" ON "group_invites" ("token") WHERE "token" IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_group_invites_code" ON "group_invites" ("code") WHERE "code" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "uq_group_invites_code";
      DROP INDEX IF EXISTS "uq_group_invites_token";
      ALTER TABLE "group_invites"
      DROP COLUMN IF EXISTS "updated_at",
      DROP COLUMN IF EXISTS "created_at",
      DROP COLUMN IF EXISTS "status",
      DROP COLUMN IF EXISTS "uses",
      DROP COLUMN IF EXISTS "max_uses",
      DROP COLUMN IF EXISTS "code",
      DROP COLUMN IF EXISTS "token";
    `);
  }
}

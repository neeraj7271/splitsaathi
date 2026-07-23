import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Google / email auth stores provider='email' on auth_identities.
 * Initial CHECK only allowed phone | phone_otp | google | apple.
 */
export class AuthIdentitiesEmailProvider1783641600009 implements MigrationInterface {
  name = 'AuthIdentitiesEmailProvider1783641600009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        constr text;
      BEGIN
        FOR constr IN
          SELECT con.conname
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
          WHERE nsp.nspname = 'public'
            AND rel.relname = 'auth_identities'
            AND con.contype = 'c'
            AND pg_get_constraintdef(con.oid) ILIKE '%provider%'
        LOOP
          EXECUTE format('ALTER TABLE auth_identities DROP CONSTRAINT %I', constr);
        END LOOP;
      END $$;

      ALTER TABLE auth_identities
        ADD CONSTRAINT auth_identities_provider_check
        CHECK (provider IN ('phone', 'phone_otp', 'google', 'apple', 'email'));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM auth_identities WHERE provider = 'email';

      ALTER TABLE auth_identities
        DROP CONSTRAINT IF EXISTS auth_identities_provider_check;

      ALTER TABLE auth_identities
        ADD CONSTRAINT auth_identities_provider_check
        CHECK (provider IN ('phone', 'phone_otp', 'google', 'apple'));
    `);
  }
}

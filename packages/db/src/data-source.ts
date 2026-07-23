import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { dbEntities } from './entities';
import { InitialLogicalModel1783641600000 } from './migrations/1783641600000-InitialLogicalModel';
import { UserPreferences1783641600001 } from './migrations/1783641600001-UserPreferences';
import { PhaseNineGroupAndPaymentFields1783641600002 } from './migrations/1783641600002-PhaseNineGroupAndPaymentFields';
import { PhaseTenGroupType1783641600003 } from './migrations/1783641600003-PhaseTenGroupType';
import { PhaseTenEmailPasswordAuth1783641600004 } from './migrations/1783641600004-PhaseTenEmailPasswordAuth';
import { PhaseTenGroupImagePurpose1783641600005 } from './migrations/1783641600005-PhaseTenGroupImagePurpose';
import { PhaseElevenGroupUpdatePermission1783641600006 } from './migrations/1783641600006-PhaseElevenGroupUpdatePermission';
import { NotificationDeliveriesCreatedAt1783641600007 } from './migrations/1783641600007-NotificationDeliveriesCreatedAt';
import { NotificationExpensePrefsDefaults1783641600008 } from './migrations/1783641600008-NotificationExpensePrefsDefaults';
import { AuthIdentitiesEmailProvider1783641600009 } from './migrations/1783641600009-AuthIdentitiesEmailProvider';
import { MemberExpenseEditDefault1783641600010 } from './migrations/1783641600010-MemberExpenseEditDefault';

const url = process.env.NODE_ENV === 'test'
  ? process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
  : process.env.DATABASE_URL;

export function createDbDataSource(overrides: Partial<DataSourceOptions> = {}): DataSource {
  const baseOptions: DataSourceOptions = {
    type: 'postgres',
    url,
    entities: [...dbEntities],
    migrations: [
      InitialLogicalModel1783641600000,
      UserPreferences1783641600001,
      PhaseNineGroupAndPaymentFields1783641600002,
      PhaseTenGroupType1783641600003,
      PhaseTenEmailPasswordAuth1783641600004,
      PhaseTenGroupImagePurpose1783641600005,
      PhaseElevenGroupUpdatePermission1783641600006,
      NotificationDeliveriesCreatedAt1783641600007,
      NotificationExpensePrefsDefaults1783641600008,
      AuthIdentitiesEmailProvider1783641600009,
      MemberExpenseEditDefault1783641600010
    ],
    synchronize: false,
    migrationsRun: false,
    logging: process.env.TYPEORM_LOGGING === 'true',
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
  };

  return new DataSource({
    ...baseOptions,
    ...overrides
  } as DataSourceOptions);
}

export const AppDataSource = createDbDataSource();

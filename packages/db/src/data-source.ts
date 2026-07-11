import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { dbEntities } from './entities';
import { InitialLogicalModel1783641600000 } from './migrations/1783641600000-InitialLogicalModel';

const url = process.env.NODE_ENV === 'test'
  ? process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
  : process.env.DATABASE_URL;

export function createDbDataSource(overrides: Partial<DataSourceOptions> = {}): DataSource {
  const baseOptions: DataSourceOptions = {
    type: 'postgres',
    url,
    entities: [...dbEntities],
    migrations: [InitialLogicalModel1783641600000],
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

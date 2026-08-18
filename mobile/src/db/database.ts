import { OPSqliteOpenFactory } from '@powersync/op-sqlite';
import { AbstractPowerSyncDatabase, PowerSyncDatabase } from '@powersync/react-native';
import { AppSchema } from './AppSchema';

export const DATABASE_FILENAME = 'fitso.sqlite';

let instance: AbstractPowerSyncDatabase | null = null;

/**
 * Lazily opens the local PowerSync database backed by OP-SQLite.
 * Everything the tracker writes goes here first; sync to the backend happens
 * out-of-band, so logging sets never depends on connectivity.
 */
export function getPowerSyncDatabase(): AbstractPowerSyncDatabase {
  if (!instance) {
    const factory = new OPSqliteOpenFactory({ dbFilename: DATABASE_FILENAME });
    instance = new PowerSyncDatabase({ schema: AppSchema, database: factory });
  }
  return instance;
}

/** Injects a database instance (used by the provider and by tests). */
export function setPowerSyncDatabase(db: AbstractPowerSyncDatabase | null): void {
  instance = db;
}

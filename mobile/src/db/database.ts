import { AbstractPowerSyncDatabase, PowerSyncDatabase } from '@powersync/react-native';
import { AppSchema } from './AppSchema';

export const DATABASE_FILENAME = 'fitso.sqlite';

let instance: AbstractPowerSyncDatabase | null = null;

/**
 * Lazily opens the local PowerSync database.
 * In v2, OP-SQLite is the built-in default driver — no separate factory needed.
 * Everything the tracker writes goes here first; sync to the backend happens
 * out-of-band via the BackendConnector, so logging sets never depends on connectivity.
 */
export function getPowerSyncDatabase(): AbstractPowerSyncDatabase {
  if (!instance) {
    instance = new PowerSyncDatabase({
      schema: AppSchema,
      database: {
        dbFilename: DATABASE_FILENAME,
      },
    });
  }
  return instance;
}

/** Injects a database instance (used by the provider and by tests). */
export function setPowerSyncDatabase(db: AbstractPowerSyncDatabase | null): void {
  instance = db;
}

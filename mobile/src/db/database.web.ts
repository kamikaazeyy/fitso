import {
  AbstractPowerSyncDatabase,
  createConsoleLogger,
  PowerSyncDatabase,
  WASQLiteOpenFactory,
} from '@powersync/web';
import { AppSchema } from './AppSchema';

export const DATABASE_FILENAME = 'fitso.sqlite';

let instance: AbstractPowerSyncDatabase | null = null;

export function getPowerSyncDatabase(): AbstractPowerSyncDatabase {
  if (!instance) {
    instance = new PowerSyncDatabase({
      schema: AppSchema,
      factory: new WASQLiteOpenFactory({
        open: {
          dbFilename: DATABASE_FILENAME,
          worker: '/@powersync/worker.js',
        },
        logger: createConsoleLogger(),
      }),
      sync: {
        worker: '/@powersync/worker.js',
      },
    });
  }
  return instance;
}

export function setPowerSyncDatabase(db: AbstractPowerSyncDatabase | null): void {
  instance = db;
}

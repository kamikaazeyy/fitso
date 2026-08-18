import React, { useEffect, useMemo } from 'react';
import { PowerSyncContext } from '@powersync/react-native';
import { getPowerSyncDatabase } from './database';

export { getPowerSyncDatabase, setPowerSyncDatabase } from './database';

/**
 * Makes the local-first database available to the tree via `usePowerSync()`.
 * The database is opened synchronously so the workout screen can write sets
 * immediately, with no loading gate.
 */
export function PowerSyncProvider({ children }: { children: React.ReactNode }) {
  const db = useMemo(() => getPowerSyncDatabase(), []);

  useEffect(() => {
    db.init().catch((error) => {
      console.warn('[PowerSync] failed to initialise local database', error);
    });
  }, [db]);

  return <PowerSyncContext.Provider value={db}>{children}</PowerSyncContext.Provider>;
}

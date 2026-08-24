import React, { useEffect, useMemo } from 'react';
import { PowerSyncContext } from '@powersync/react-native';
import { getPowerSyncDatabase, setPowerSyncDatabase } from './database';
import { getBackendConnector, setBackendConnectorToken } from './BackendConnector';
import * as SecureStore from 'expo-secure-store';

export { getPowerSyncDatabase, setPowerSyncDatabase } from './database';

const TOKEN_KEY = 'authToken';

/**
 * Makes the local-first database available to the tree via `usePowerSync()`.
 * The database is opened synchronously so the workout screen can write sets
 * immediately, with no loading gate. Sync connects to the PowerSync server
 * using the stored JWT token.
 */
export function PowerSyncProvider({ children }: { children: React.ReactNode }) {
  const db = useMemo(() => getPowerSyncDatabase(), []);

  useEffect(() => {
    // Connect to the sync server using the stored JWT
    const connect = async () => {
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (token) {
          setBackendConnectorToken(token);
          const connector = getBackendConnector();
          await db.connect(connector);
        }
      } catch (error) {
        console.warn('[PowerSync] failed to connect to sync server', error);
      }
    };

    db.init().then(connect).catch((error) => {
      console.warn('[PowerSync] failed to initialise local database', error);
    });
  }, [db]);

  return <PowerSyncContext.Provider value={db}>{children}</PowerSyncContext.Provider>;
}

/**
 * Call this after login/signup to connect the sync engine with the new token.
 */
export async function connectPowerSync(token: string): Promise<void> {
  const db = getPowerSyncDatabase();
  setBackendConnectorToken(token);
  const connector = getBackendConnector();
  try {
    await db.disconnect();
  } catch {
    // ignore if not connected
  }
  await db.connect(connector);
}

/**
 * Call this on logout to disconnect sync and clear local data.
 */
export async function disconnectPowerSync(): Promise<void> {
  const db = getPowerSyncDatabase();
  try {
    await db.disconnect();
  } catch {
    // ignore
  }
  setBackendConnectorToken(null);
}

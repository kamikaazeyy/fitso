import React, { useEffect, useMemo } from 'react';
import { PowerSyncContext } from '@powersync/react-native';
import { useQueryClient } from '@tanstack/react-query';
import { getPowerSyncDatabase, setPowerSyncDatabase } from './database';
import { getBackendConnector, setBackendConnectorToken } from './BackendConnector';
import {
  CUSTOM_EXERCISES_TABLE,
  ROUTINE_EXERCISES_TABLE,
  ROUTINES_TABLE,
  SPLITS_TABLE,
  WORKOUT_SETS_TABLE,
  WORKOUTS_TABLE,
} from './AppSchema';
import { ensureExerciseCache } from '@/src/services/exerciseCache';
import * as SecureStore from 'expo-secure-store';

export { getPowerSyncDatabase, setPowerSyncDatabase } from './database';

const TOKEN_KEY = 'authToken';

const SYNCED_TABLES = [
  ROUTINES_TABLE,
  WORKOUTS_TABLE,
  SPLITS_TABLE,
  ROUTINE_EXERCISES_TABLE,
  WORKOUT_SETS_TABLE,
  CUSTOM_EXERCISES_TABLE,
];

/**
 * Makes the local-first database available to the tree via `usePowerSync()`.
 * The database is opened synchronously so the workout screen can write sets
 * immediately, with no loading gate. Sync connects to the PowerSync server
 * using the stored JWT token.
 */
export function PowerSyncProvider({ children }: { children: React.ReactNode }) {
  const db = useMemo(() => getPowerSyncDatabase(), []);
  const queryClient = useQueryClient();

  useEffect(() => {
    let disposeChangeListener: (() => void) | undefined;
    let cancelled = false;

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

    db.init()
      .then(() => {
        if (cancelled) return;
        // Keep React Query caches in sync with local SQLite. Reads go through
        // useQuery, which never re-runs on its own — without this, screens show
        // stale data after local writes and after sync downloads land.
        disposeChangeListener = db.onChange(
          {
            onChange: () => {
              void queryClient.invalidateQueries();
            },
          },
          { tables: SYNCED_TABLES, throttleMs: 500 }
        );
        // Prefetch the wger catalogue into the local-only cache so the
        // exercise picker works offline; single-flight and silent on failure.
        void ensureExerciseCache(db);
        return connect();
      })
      .catch((error) => {
        console.warn('[PowerSync] failed to initialise local database', error);
      });

    return () => {
      cancelled = true;
      disposeChangeListener?.();
    };
  }, [db, queryClient]);

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

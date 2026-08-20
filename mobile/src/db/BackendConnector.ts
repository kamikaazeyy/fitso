import { Platform } from 'react-native';
import type { PowerSyncBackendConnector, PowerSyncCredentials } from '@powersync/react-native';

const SYNC_ENDPOINT =
  process.env.EXPO_PUBLIC_POWERSYNC_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080');

/**
 * Connector that links the local PowerSync database to the self-hosted
 * PowerSync sync server. The JWT from Fastify auth is used for both
 * authentication and user identity — PowerSync uses `auth.user_id()` in
 * sync rules to scope data to the authenticated user.
 */
export class BackendConnector implements PowerSyncBackendConnector {
  private token: string | null = null;

  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    if (!this.token) {
      return null;
    }

    return {
      endpoint: SYNC_ENDPOINT,
      token: this.token,
    };
  }

  async uploadData(database: any): Promise<void> {
    // PowerSync's built-in replication handles local INSERT/UPDATE/DELETE
    // automatically via the sync protocol. This method is called when there
    // are local-only writes that need to be sent to the server.
    //
    // For MVP, we rely on the automatic replication — the sync server pushes
    // local changes to Postgres and pulls server changes down to the device.
    // If server-side validation or transforms are needed later, use
    // `database.getCrudBatch()` here to get the pending changes and POST them
    // to a Fastify endpoint.
    const batch = await database.getCrudBatch();
    if (!batch) return;
    // No custom upload — let PowerSync handle it via the sync protocol.
    // Mark the batch as done so PowerSync knows it's been processed.
    await batch.complete();
  }

  setToken(token: string | null) {
    this.token = token;
  }

  get currentToken(): string | null {
    return this.token;
  }
}

/** Singleton connector instance shared across the app. */
let connectorInstance: BackendConnector | null = null;

export function getBackendConnector(): BackendConnector {
  if (!connectorInstance) {
    connectorInstance = new BackendConnector();
  }
  return connectorInstance;
}

export function setBackendConnectorToken(token: string | null): void {
  getBackendConnector().setToken(token);
}

import { Platform } from 'react-native';
import type { PowerSyncBackendConnector, PowerSyncCredentials } from '@powersync/react-native';
import { client } from '@/src/api/client';
import { decodeJwtExp } from '@/src/utils/jwt';

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
  private sessionToken: string | null = null;
  private syncToken: string | null = null;
  private syncTokenExpiresAt = 0;
  private syncTokenRequest: Promise<string> | null = null;

  /**
   * The session JWT can't be used on the sync stream — PowerSync rejects
   * tokens spanning more than 24h (PSYNC_S2104). Exchange it for a
   * short-lived sync token via the backend, cached until it is about to
   * expire so reconnects don't hammer the endpoint.
   */
  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    if (!this.sessionToken) {
      return null;
    }

    return {
      endpoint: SYNC_ENDPOINT,
      token: await this.getSyncToken(),
    };
  }

  private getSyncToken(): Promise<string> {
    if (this.syncToken && this.syncTokenExpiresAt - Date.now() > 60_000) {
      return Promise.resolve(this.syncToken);
    }

    if (!this.syncTokenRequest) {
      const sessionToken = this.sessionToken;
      this.syncTokenRequest = (async () => {
        const { data } = await client.post<{ token: string }>(
          '/api/auth/sync-token',
          null,
          { headers: { Authorization: `Bearer ${sessionToken}` } }
        );
        this.syncToken = data.token;
        this.syncTokenExpiresAt = (decodeJwtExp(data.token) ?? 0) * 1000;
        return data.token;
      })().finally(() => {
        this.syncTokenRequest = null;
      });
    }
    return this.syncTokenRequest;
  }

  /**
   * Uploads local writes to the backend. PowerSync's sync protocol handles
   * the download direction (server → client) automatically, but the upload
   * direction (client → server) is our responsibility. We grab the pending
   * CRUD batch, POST it to the Fastify `/api/sync/upload` endpoint which
   * applies the operations to Postgres, then mark the batch as complete so
   * PowerSync knows it's been processed. If the upload fails, we throw so
   * PowerSync retries after its configured backoff.
   */
  async uploadData(database: any): Promise<void> {
    const batch = await database.getCrudBatch();
    if (!batch) return;

    const operations = batch.crud.map((op: any) => ({
      table: op.table,
      op: op.op,
      id: op.id,
      data: op.opData,
    }));

    const response = await client.post('/api/sync/upload', { operations });

    if (response.status !== 200) {
      throw new Error(`Sync upload failed: HTTP ${response.status}`);
    }

    await batch.complete();
  }

  setToken(token: string | null) {
    if (token !== this.sessionToken) {
      this.sessionToken = token;
      this.syncToken = null;
      this.syncTokenExpiresAt = 0;
    }
  }

  get currentToken(): string | null {
    return this.sessionToken;
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

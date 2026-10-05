import axios from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const fallbackBaseURL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3001'
    : 'http://localhost:3001';

const baseURL = process.env.EXPO_PUBLIC_API_URL || fallbackBaseURL;

export const client = axios.create({
  baseURL,
});

const TOKEN_KEY = 'authToken';
const USER_KEY = 'authUser';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

// Registered by AuthContext — invoked when the session is unrecoverable so
// React state is cleared and the app drops back to the login screen.
let onSessionExpired: (() => void) | null = null;
export function setOnSessionExpired(handler: (() => void) | null) {
  onSessionExpired = handler;
}

export interface RefreshResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    dailyCalorieGoal: number;
  };
}

let refreshPromise: Promise<RefreshResponse> | null = null;

/**
 * Exchanges the current session token for a fresh one, persists it, and
 * reconnects PowerSync with it. Single-flight: concurrent 401s share one
 * refresh request.
 */
export function refreshSession(): Promise<RefreshResponse> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const { data } = await client.post<RefreshResponse>('/api/auth/refresh');
      authToken = data.token;
      await SecureStore.setItemAsync(TOKEN_KEY, data.token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(data.user));
      const { setBackendConnectorToken } = await import('@/src/db/BackendConnector');
      const { connectPowerSync } = await import('@/src/db/PowerSyncProvider');
      setBackendConnectorToken(data.token);
      // Fire-and-forget: reconnecting triggers fetchCredentials → sync-token
      // request, which must not block (or be blocked by) this refresh.
      connectPowerSync(data.token).catch(() => undefined);
      return data;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function expireSession() {
  authToken = null;
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  } catch {
    // ignore storage errors
  }
  const { setBackendConnectorToken } = await import('@/src/db/BackendConnector');
  setBackendConnectorToken(null);
  onSessionExpired?.();
}

client.interceptors.request.use((config) => {
  if (authToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

const retriedRequests = new WeakSet<object>();

// On 401, attempt one token refresh and replay the original request. If the
// refresh itself is rejected, the session is dead — clear it so the app
// returns to the login screen.
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const original = error?.config;
    const url: string = original?.url ?? '';
    const isCredentialRequest =
      url.includes('/api/auth/login') || url.includes('/api/auth/signup');

    if (status !== 401 || !original || !authToken || isCredentialRequest) {
      return Promise.reject(error);
    }

    if (url.includes('/api/auth/refresh') || retriedRequests.has(original)) {
      await expireSession();
      return Promise.reject(error);
    }

    try {
      retriedRequests.add(original);
      const { token } = await refreshSession();
      original.headers.Authorization = `Bearer ${token}`;
      return client(original);
    } catch (refreshError: any) {
      const refreshStatus = refreshError?.response?.status;
      // Only drop the session when the server actually rejected the token —
      // a network failure shouldn't sign the user out.
      if (refreshStatus === 401 || refreshStatus === 403) {
        await expireSession();
      }
      return Promise.reject(refreshError);
    }
  }
);

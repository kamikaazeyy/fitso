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

let authToken: string | null = null;

client.interceptors.request.use((config) => {
  if (authToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// Response interceptor: on 401, clear the token and trigger re-login
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401 && authToken) {
      authToken = null;
      try {
        await SecureStore.deleteItemAsync('authToken');
        await SecureStore.deleteItemAsync('authUser');
      } catch {
        // ignore storage errors
      }
      // The AuthContext will pick up the token change on next render
      // and redirect to the login screen
    }
    return Promise.reject(error);
  }
);

export function setAuthToken(token: string | null) {
  authToken = token;
}

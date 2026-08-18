import axios from 'axios';
import { Platform } from 'react-native';

const fallbackBaseURL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000'
    : 'http://localhost:3000';

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

export function setAuthToken(token: string | null) {
  authToken = token;
}

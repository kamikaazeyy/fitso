import axios from 'axios';

export const client = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
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

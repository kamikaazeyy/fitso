import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { client, setAuthToken } from '@/src/api/client';
import { connectPowerSync, disconnectPowerSync } from '@/src/db/PowerSyncProvider';
import { useWorkoutSessionStore } from '@/src/store/useWorkoutSessionStore';
import { deleteItem, getItem, setItem } from '@/src/storage/secureStorage';

export interface User {
  id: string;
  email: string;
  name: string | null;
}

interface AuthContextValue {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (email: string, password: string, name?: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'authToken';
const USER_KEY = 'authUser';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const storedToken = await getItem(TOKEN_KEY);
        const storedUser = await getItem(USER_KEY);
        if (storedToken) {
          setToken(storedToken);
          setAuthToken(storedToken);
        }
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          useWorkoutSessionStore.getState().setUserId(parsedUser.id);
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const persist = useCallback(async (newToken: string, newUser: User) => {
    await setItem(TOKEN_KEY, newToken);
    await setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setAuthToken(newToken);
    useWorkoutSessionStore.getState().setUserId(newUser.id);
    // Connect PowerSync sync engine with the new token
    connectPowerSync(newToken).catch((err) => {
      console.warn('[Auth] Failed to connect PowerSync after login', err);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { data } = await client.post<{ token: string; user: User }>('/api/auth/login', {
        email,
        password,
      });
      await persist(data.token, data.user);
      return data.user;
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Login failed';
      throw new Error(message);
    }
  }, [persist]);

  const signup = useCallback(async (email: string, password: string, name?: string) => {
    try {
      const { data } = await client.post<{ token: string; user: User }>('/api/auth/signup', {
        email,
        password,
        name,
      });
      await persist(data.token, data.user);
      return data.user;
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Signup failed';
      throw new Error(message);
    }
  }, [persist]);

  const logout = useCallback(async () => {
    await deleteItem(TOKEN_KEY);
    await deleteItem(USER_KEY);
    setToken(null);
    setUser(null);
    setAuthToken(null);
    useWorkoutSessionStore.getState().setUserId(null);
    await disconnectPowerSync().catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({ token, user, isLoading, login, signup, logout }),
    [token, user, isLoading, login, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

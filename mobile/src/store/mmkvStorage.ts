import { MMKV } from 'react-native-mmkv';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

export const mmkv = new MMKV({ id: 'fitso.session' });

/**
 * Synchronous key/value bridge for Zustand's `persist` middleware.
 * MMKV writes are memory-mapped and synchronous, so the active session is
 * already on disk by the time the store update returns — which is what makes
 * the tracker survive an abrupt OS process kill.
 */
export const mmkvStateStorage: StateStorage = {
  getItem: (name) => mmkv.getString(name) ?? null,
  setItem: (name, value) => {
    mmkv.set(name, value);
  },
  removeItem: (name) => {
    mmkv.delete(name);
  },
};

/** JSON-serialising persist storage bound to MMKV, typed for a given state. */
export function createMMKVJSONStorage<S>() {
  return createJSONStorage<S>(() => mmkvStateStorage);
}

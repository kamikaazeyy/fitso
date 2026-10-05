/**
 * In-memory MMKV stand-in. Backed by a global map so the store survives
 * `jest.resetModules()` — that is what lets the crash-recovery test tear down
 * the JS instance and rehydrate from "disk".
 */
const store = (globalThis.__MMKV_MOCK_STORE__ = globalThis.__MMKV_MOCK_STORE__ || new Map());

class MMKV {
  getString(key) {
    return store.has(key) ? store.get(key) : undefined;
  }

  set(key, value) {
    store.set(key, String(value));
  }

  delete(key) {
    store.delete(key);
  }

  contains(key) {
    return store.has(key);
  }

  getAllKeys() {
    return [...store.keys()];
  }

  clearAll() {
    store.clear();
  }
}

module.exports = {
  MMKV,
  __mmkvStore: store,
};

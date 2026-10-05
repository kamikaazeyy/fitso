/** Native OP-SQLite boundary. Tests exercise the PowerSync adapter through
 * `__mocks__/@powersync/op-sqlite.js`, so this only needs to be importable. */
module.exports = {
  open: jest.fn(() => ({
    execute: jest.fn(() => ({ rows: { _array: [] }, rowsAffected: 0 })),
    executeAsync: jest.fn(() => Promise.resolve({ rows: { _array: [] }, rowsAffected: 0 })),
    close: jest.fn(),
    delete: jest.fn(),
  })),
  isSQLCipher: jest.fn(() => false),
  moveAssetsDatabase: jest.fn(() => Promise.resolve(true)),
};

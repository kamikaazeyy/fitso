export interface ExecutedStatement {
  sql: string;
  params: unknown[];
}

export interface FakePowerSyncDatabase {
  statements: ExecutedStatement[];
  transactionCount: number;
  /** Set to simulate a failing local write (e.g. disk full). */
  failOnExecute: boolean;
  writeTransaction: (
    callback: (tx: { execute: (sql: string, params?: unknown[]) => Promise<void> }) => Promise<void>
  ) => Promise<void>;
}

/**
 * Stand-in for the PowerSync local database. It records every statement so a
 * test can assert the batch written to SQLite, and never touches the network —
 * any accidental HTTP call in `finishWorkout()` would fail loudly instead.
 */
export function createFakePowerSyncDatabase(): FakePowerSyncDatabase {
  const db: FakePowerSyncDatabase = {
    statements: [],
    transactionCount: 0,
    failOnExecute: false,
    writeTransaction: async (callback) => {
      db.transactionCount += 1;
      await callback({
        execute: async (sql: string, params: unknown[] = []) => {
          if (db.failOnExecute) {
            throw new Error('local write failed');
          }
          db.statements.push({ sql, params });
        },
      });
    },
  };
  return db;
}

export function insertsInto(db: FakePowerSyncDatabase, table: string): ExecutedStatement[] {
  return db.statements.filter((statement) =>
    statement.sql.replace(/\s+/g, ' ').includes(`INSERT INTO ${table}`)
  );
}

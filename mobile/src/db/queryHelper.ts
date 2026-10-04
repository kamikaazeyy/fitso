/**
 * Helper to safely extract rows from any SQLite or PowerSync query result.
 * Compatible with PowerSync v2 (.array, iterable), legacy Expo SQLite (.rows._array),
 * and native OP-SQLite result objects.
 */
export function extractRows<T = any>(result: any): T[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.array)) return result.array;
  if (Array.isArray(result.rows)) return result.rows;
  if (Array.isArray(result.rows?._array)) return result.rows._array;
  if (
    result.rows &&
    typeof result.rows.item === 'function' &&
    typeof result.rows.length === 'number'
  ) {
    const list: T[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      list.push(result.rows.item(i));
    }
    return list;
  }
  if (typeof result[Symbol.iterator] === 'function') {
    try {
      return Array.from(result);
    } catch {
      // Fallback if iterator fails
    }
  }
  return [];
}

export function extractFirstRow<T = any>(result: any): T | undefined {
  const rows = extractRows<T>(result);
  return rows[0];
}

import type { PowerSyncDatabase } from '@powersync/react-native';
import { EXERCISE_CACHE_TABLE } from '@/src/db/AppSchema';
import {
  getExercises,
  getExerciseName,
  getExerciseDescription,
  getMainImage,
  type WgerExerciseInfo,
} from '@/api/wger';

const PAGE_LIMIT = 100;
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // refresh weekly

export interface CachedExercise {
  id: string;
  wgerId: number;
  name: string;
  category: string;
  equipment: string[];
  muscles: string[];
  musclesSecondary: string[];
  description: string;
  imageUrl: string | null;
  aliases: string[];
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toCachedRow(info: WgerExerciseInfo, now: string) {
  return {
    id: info.uuid,
    wger_id: info.id,
    name: getExerciseName(info),
    category: info.category?.name ?? '',
    equipment: JSON.stringify(info.equipment.map((e) => e.name)),
    muscles: JSON.stringify(info.muscles.map((m) => m.name_en || m.name)),
    muscles_secondary: JSON.stringify(info.muscles_secondary.map((m) => m.name_en || m.name)),
    description: getExerciseDescription(info),
    image_url: getMainImage(info) ?? null,
    aliases: JSON.stringify(
      info.translations.flatMap((t) => t.aliases.map((a) => a.alias))
    ),
    fetched_at: now,
  };
}

export function mapCacheRow(row: Record<string, unknown>): CachedExercise {
  return {
    id: row.id as string,
    wgerId: row.wger_id as number,
    name: row.name as string,
    category: (row.category as string) ?? '',
    equipment: parseJsonArray(row.equipment as string),
    muscles: parseJsonArray(row.muscles as string),
    musclesSecondary: parseJsonArray(row.muscles_secondary as string),
    description: (row.description as string) ?? '',
    imageUrl: (row.image_url as string) ?? null,
    aliases: parseJsonArray(row.aliases as string),
  };
}

async function isCacheStale(db: PowerSyncDatabase): Promise<boolean> {
  const result = await db.execute(
    `SELECT COUNT(*) as count, MAX(fetched_at) as latest FROM ${EXERCISE_CACHE_TABLE}`
  );
  const row = result.rows?._array?.[0] as { count: number; latest: string | null } | undefined;
  if (!row || row.count === 0 || !row.latest) return true;
  return Date.now() - new Date(row.latest).getTime() > STALE_AFTER_MS;
}

async function refreshCache(db: PowerSyncDatabase): Promise<void> {
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const page = await getExercises({ limit: PAGE_LIMIT, offset });
    total = page.count;
    if (page.results.length === 0) break;

    const now = new Date().toISOString();
    const rows = page.results.map((info) => toCachedRow(info, now));

    // Commit each page so watched queries (the open picker) fill progressively.
    await db.writeTransaction(async (tx) => {
      for (const row of rows) {
        await tx.execute(
          `INSERT OR REPLACE INTO ${EXERCISE_CACHE_TABLE}
             (id, wger_id, uuid, name, category, equipment, muscles, muscles_secondary,
              description, image_url, aliases, fetched_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.id,
            row.wger_id,
            row.id,
            row.name,
            row.category,
            row.equipment,
            row.muscles,
            row.muscles_secondary,
            row.description,
            row.image_url,
            row.aliases,
            row.fetched_at,
          ]
        );
      }
    });

    offset += PAGE_LIMIT;
  }
}

let inflight: Promise<void> | null = null;

/**
 * Fills the local wger cache in the background when empty or stale (>7d).
 * Single-flight — safe to call on every picker mount. Never throws; the
 * picker falls back to the live API when the cache is empty and offline.
 */
export function ensureExerciseCache(db: PowerSyncDatabase): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      if (await isCacheStale(db)) {
        await refreshCache(db);
      }
    } catch {
      // Offline or wger down — cache stays as-is; picker falls back to API.
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Cache freshness for the picker: 0 rows = still filling / never fetched. */
export async function exerciseCacheSize(db: PowerSyncDatabase): Promise<number> {
  const result = await db.execute(`SELECT COUNT(*) as count FROM ${EXERCISE_CACHE_TABLE}`);
  const row = result.rows?._array?.[0] as { count: number } | undefined;
  return row?.count ?? 0;
}

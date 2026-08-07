const BASE_URL = 'https://wger.de/api/v2';
const MEDIA_ORIGIN = 'https://wger.de';
const REQUEST_TIMEOUT_MS = 15000;
const MAX_PAGE_LIMIT = 100;

export interface WgerCategory {
  id: number;
  name: string;
}

export interface WgerEquipment {
  id: number;
  name: string;
}

export interface WgerMuscle {
  id: number;
  name: string;
  name_en: string;
  is_front: boolean;
  image_url_main: string;
  image_url_secondary: string;
}

export interface WgerExerciseImage {
  id: number;
  uuid: string;
  exercise: number;
  exercise_uuid: string;
  image: string;
  thumbnails: {
    small: string;
    medium: string;
  };
  is_main: boolean;
}

export interface WgerExerciseTranslation {
  id: number;
  uuid: string;
  name: string;
  description: string;
  description_source: string;
  language: number;
  aliases: { id: number; uuid: string; alias: string }[];
  notes: { id: number; note: string }[];
}

export interface WgerExerciseInfo {
  id: number;
  uuid: string;
  created: string;
  last_update: string;
  last_update_global: string;
  category: WgerCategory;
  muscles: WgerMuscle[];
  muscles_secondary: WgerMuscle[];
  equipment: WgerEquipment[];
  license: {
    id: number;
    full_name: string;
    short_name: string;
    url: string;
  };
  license_author: string;
  images: WgerExerciseImage[];
  translations: WgerExerciseTranslation[];
}

export interface WgerPaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

const ENGLISH_LANGUAGE_ID = 2;

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function getEnglishTranslation(translations: WgerExerciseTranslation[] | undefined) {
  const list = asArray(translations);
  return list.find((t) => t?.language === ENGLISH_LANGUAGE_ID) ?? list[0];
}

export function getExerciseName(info: WgerExerciseInfo): string {
  const translation = getEnglishTranslation(info?.translations);
  return typeof translation?.name === 'string' && translation.name ? translation.name : 'Unknown Exercise';
}

export function getExerciseDescription(info: WgerExerciseInfo): string {
  const translation = getEnglishTranslation(info?.translations);
  if (!translation) return '';
  if (typeof translation.description_source === 'string' && translation.description_source) {
    return translation.description_source;
  }
  return stripHtml(translation.description);
}

/** Removes markup from remote descriptions so they are never treated as HTML downstream. */
function stripHtml(html: string | null | undefined): string {
  if (typeof html !== 'string') return '';
  return html
    .replace(/<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Accepts only https media URLs and wger-relative paths; rejects data:, javascript: and http:. */
function safeMediaUrl(url: string | null | undefined): string | undefined {
  if (typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return `${MEDIA_ORIGIN}${trimmed}`;
  return undefined;
}

export function getMainImage(info: WgerExerciseInfo): string | undefined {
  const images = asArray(info?.images);
  const main = images.find((img) => img?.is_main) ?? images[0];
  return safeMediaUrl(main?.thumbnails?.small) ?? safeMediaUrl(main?.image);
}

async function fetchJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`wger API error: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('json')) {
      throw new Error('wger API error: unexpected response type');
    }

    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('wger API error: request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizePage<T>(data: WgerPaginatedResponse<T> | null | undefined): WgerPaginatedResponse<T> {
  const results = asArray(data?.results);
  return {
    count: typeof data?.count === 'number' && Number.isFinite(data.count) ? data.count : results.length,
    next: data?.next ?? null,
    previous: data?.previous ?? null,
    results,
  };
}

export async function getExerciseCategories(): Promise<WgerCategory[]> {
  const data = await fetchJson<WgerPaginatedResponse<WgerCategory>>('/exercisecategory/');
  return normalizePage(data).results.filter((c) => typeof c?.id === 'number');
}

export async function getExercises(
  options: { limit?: number; offset?: number; category?: number } = {}
): Promise<WgerPaginatedResponse<WgerExerciseInfo>> {
  const params = new URLSearchParams({
    language: String(ENGLISH_LANGUAGE_ID),
    limit: String(clampInt(options.limit, 50, 1, MAX_PAGE_LIMIT)),
    offset: String(clampInt(options.offset, 0, 0, Number.MAX_SAFE_INTEGER)),
  });

  if (options.category) {
    params.append('category', String(clampInt(options.category, 0, 0, Number.MAX_SAFE_INTEGER)));
  }

  return normalizePage(
    await fetchJson<WgerPaginatedResponse<WgerExerciseInfo>>(
      `/exerciseinfo/?${params.toString()}`
    )
  );
}

export async function searchExercises(
  query: string,
  options: { limit?: number; category?: number } = {}
): Promise<WgerExerciseInfo[]> {
  const params = new URLSearchParams({
    language: String(ENGLISH_LANGUAGE_ID),
    limit: String(clampInt(options.limit, 50, 1, MAX_PAGE_LIMIT)),
  });

  if (options.category) {
    params.append('category', String(clampInt(options.category, 0, 0, Number.MAX_SAFE_INTEGER)));
  }

  const data = normalizePage(
    await fetchJson<WgerPaginatedResponse<WgerExerciseInfo>>(
      `/exerciseinfo/?${params.toString()}`
    )
  );

  const lowerQuery = query.trim().toLowerCase();
  if (!lowerQuery) return data.results;

  return data.results.filter((info) => {
    const name = getExerciseName(info).toLowerCase();
    const aliases = asArray(info?.translations).flatMap((t) =>
      asArray(t?.aliases).map((a) => String(a?.alias ?? '').toLowerCase())
    );
    const category = info?.category?.name?.toLowerCase() ?? '';
    return (
      name.includes(lowerQuery) ||
      aliases.some((a) => a.includes(lowerQuery)) ||
      category.includes(lowerQuery)
    );
  });
}

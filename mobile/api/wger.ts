const BASE_URL = 'https://wger.de/api/v2';

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

function getEnglishTranslation(translations: WgerExerciseTranslation[]) {
  return (
    translations.find((t) => t.language === ENGLISH_LANGUAGE_ID) || translations[0]
  );
}

export function getExerciseName(info: WgerExerciseInfo): string {
  const translation = getEnglishTranslation(info.translations);
  return translation?.name ?? 'Unknown Exercise';
}

export function getExerciseDescription(info: WgerExerciseInfo): string {
  const translation = getEnglishTranslation(info.translations);
  if (!translation) return '';
  return translation.description_source || translation.description.replace(/<[^>]+>/g, '');
}

export function getMainImage(info: WgerExerciseInfo): string | undefined {
  const main = info.images.find((img) => img.is_main) ?? info.images[0];
  return main?.thumbnails?.small ?? main?.image;
}

export class WgerApiError extends Error {
  readonly status?: number;
  readonly path: string;

  constructor(message: string, path: string, options?: { status?: number; cause?: unknown }) {
    super(message);
    this.name = 'WgerApiError';
    this.path = path;
    this.status = options?.status;
    this.cause = options?.cause;
  }
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 200);
  } catch {
    return '';
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    throw new WgerApiError(
      'Network request to wger.de failed. Check your connection and try again.',
      path,
      { cause: err }
    );
  }

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new WgerApiError(
      `wger API error ${response.status} ${response.statusText}${body ? `: ${body}` : ''}`,
      path,
      { status: response.status }
    );
  }

  try {
    return (await response.json()) as T;
  } catch (err) {
    throw new WgerApiError('wger API returned a malformed JSON response.', path, {
      status: response.status,
      cause: err,
    });
  }
}

export async function getExerciseCategories(): Promise<WgerCategory[]> {
  const data = await fetchJson<WgerPaginatedResponse<WgerCategory>>('/exercisecategory/');
  return data.results;
}

export async function getExercises(
  options: { limit?: number; offset?: number; category?: number } = {}
): Promise<WgerPaginatedResponse<WgerExerciseInfo>> {
  const params = new URLSearchParams({
    language: String(ENGLISH_LANGUAGE_ID),
    limit: String(options.limit ?? 50),
    offset: String(options.offset ?? 0),
  });

  if (options.category) {
    params.append('category', String(options.category));
  }

  return fetchJson<WgerPaginatedResponse<WgerExerciseInfo>>(
    `/exerciseinfo/?${params.toString()}`
  );
}

export async function searchExercises(
  query: string,
  options: { limit?: number; category?: number } = {}
): Promise<WgerExerciseInfo[]> {
  const params = new URLSearchParams({
    language: String(ENGLISH_LANGUAGE_ID),
    limit: String(options.limit ?? 50),
  });

  if (options.category) {
    params.append('category', String(options.category));
  }

  const data = await fetchJson<WgerPaginatedResponse<WgerExerciseInfo>>(
    `/exerciseinfo/?${params.toString()}`
  );

  const lowerQuery = query.trim().toLowerCase();
  if (!lowerQuery) return data.results;

  return data.results.filter((info) => {
    const name = getExerciseName(info).toLowerCase();
    const aliases = info.translations.flatMap((t) => t.aliases.map((a) => a.alias.toLowerCase()));
    const category = info.category?.name.toLowerCase() ?? '';
    return (
      name.includes(lowerQuery) ||
      aliases.some((a) => a.includes(lowerQuery)) ||
      category.includes(lowerQuery)
    );
  });
}

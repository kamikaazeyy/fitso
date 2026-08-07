import {
  getExerciseCategories,
  getExerciseDescription,
  getExerciseName,
  getExercises,
  getMainImage,
  searchExercises,
  type WgerExerciseInfo,
  type WgerExerciseTranslation,
} from '@/api/wger';

const BASE_URL = 'https://wger.de/api/v2';

function makeTranslation(
  overrides: Partial<WgerExerciseTranslation> = {}
): WgerExerciseTranslation {
  return {
    id: 1,
    uuid: 'translation-uuid',
    name: 'Bench Press',
    description: '<p>Push the bar</p>',
    description_source: '',
    language: 2,
    aliases: [],
    notes: [],
    ...overrides,
  };
}

function makeExercise(overrides: Partial<WgerExerciseInfo> = {}): WgerExerciseInfo {
  return {
    id: 10,
    uuid: 'exercise-uuid',
    created: '2024-01-01',
    last_update: '2024-01-02',
    last_update_global: '2024-01-02',
    category: { id: 1, name: 'Chest' },
    muscles: [],
    muscles_secondary: [],
    equipment: [],
    license: { id: 1, full_name: 'CC', short_name: 'CC', url: '' },
    license_author: 'author',
    images: [],
    translations: [makeTranslation()],
    ...overrides,
  };
}

function mockFetchOnce(body: unknown, init: { ok?: boolean; status?: number; statusText?: string } = {}) {
  const { ok = true, status = 200, statusText = 'OK' } = init;
  const fetchMock = jest.fn().mockResolvedValue({
    ok,
    status,
    statusText,
    json: async () => body,
  });
  (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  return fetchMock;
}

function paginated<T>(results: T[]) {
  return { count: results.length, next: null, previous: null, results };
}

function requestedUrl(fetchMock: jest.Mock): string {
  return fetchMock.mock.calls[0][0] as string;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('getExerciseName', () => {
  it('prefers the English translation', () => {
    const info = makeExercise({
      translations: [
        makeTranslation({ id: 1, language: 1, name: 'Bankdrücken' }),
        makeTranslation({ id: 2, language: 2, name: 'Bench Press' }),
      ],
    });
    expect(getExerciseName(info)).toBe('Bench Press');
  });

  it('falls back to the first translation when English is missing', () => {
    const info = makeExercise({
      translations: [makeTranslation({ language: 1, name: 'Bankdrücken' })],
    });
    expect(getExerciseName(info)).toBe('Bankdrücken');
  });

  it('falls back to a placeholder when there are no translations', () => {
    expect(getExerciseName(makeExercise({ translations: [] }))).toBe('Unknown Exercise');
  });
});

describe('getExerciseDescription', () => {
  it('prefers description_source when present', () => {
    const info = makeExercise({
      translations: [makeTranslation({ description_source: 'From the manual' })],
    });
    expect(getExerciseDescription(info)).toBe('From the manual');
  });

  it('strips HTML tags from the description', () => {
    const info = makeExercise({
      translations: [
        makeTranslation({ description: '<p>Push <strong>the</strong> bar</p>' }),
      ],
    });
    expect(getExerciseDescription(info)).toBe('Push the bar');
  });

  it('returns an empty string when there is no translation', () => {
    expect(getExerciseDescription(makeExercise({ translations: [] }))).toBe('');
  });
});

describe('getMainImage', () => {
  const image = (overrides: Record<string, unknown>) =>
    ({
      id: 1,
      uuid: 'image-uuid',
      exercise: 10,
      exercise_uuid: 'exercise-uuid',
      image: 'https://example.com/full.png',
      thumbnails: { small: 'https://example.com/small.png', medium: '' },
      is_main: false,
      ...overrides,
    } as WgerExerciseInfo['images'][number]);

  it('returns the small thumbnail of the main image', () => {
    const info = makeExercise({
      images: [
        image({ id: 1, thumbnails: { small: 'https://example.com/other.png', medium: '' } }),
        image({ id: 2, is_main: true }),
      ],
    });
    expect(getMainImage(info)).toBe('https://example.com/small.png');
  });

  it('falls back to the first image when none is flagged as main', () => {
    const info = makeExercise({
      images: [image({ thumbnails: { small: 'https://example.com/first.png', medium: '' } })],
    });
    expect(getMainImage(info)).toBe('https://example.com/first.png');
  });

  it('falls back to the full image when no thumbnail exists', () => {
    const info = makeExercise({
      images: [image({ thumbnails: undefined as never })],
    });
    expect(getMainImage(info)).toBe('https://example.com/full.png');
  });

  it('returns undefined when there are no images', () => {
    expect(getMainImage(makeExercise({ images: [] }))).toBeUndefined();
  });
});

describe('getExerciseCategories', () => {
  it('requests the category endpoint and unwraps results', async () => {
    const categories = [{ id: 1, name: 'Chest' }];
    const fetchMock = mockFetchOnce(paginated(categories));

    await expect(getExerciseCategories()).resolves.toEqual(categories);
    expect(requestedUrl(fetchMock)).toBe(`${BASE_URL}/exercisecategory/`);
    expect(fetchMock.mock.calls[0][1]).toEqual({
      headers: { Accept: 'application/json' },
    });
  });

  it('throws a descriptive error on a failed response', async () => {
    mockFetchOnce(null, { ok: false, status: 503, statusText: 'Service Unavailable' });

    await expect(getExerciseCategories()).rejects.toThrow(
      'wger API error: 503 Service Unavailable'
    );
  });
});

describe('getExercises', () => {
  it('applies default pagination params', async () => {
    const fetchMock = mockFetchOnce(paginated([makeExercise()]));

    await getExercises();

    expect(requestedUrl(fetchMock)).toBe(
      `${BASE_URL}/exerciseinfo/?language=2&limit=50&offset=0`
    );
  });

  it('forwards limit, offset and category', async () => {
    const fetchMock = mockFetchOnce(paginated([]));

    await getExercises({ limit: 10, offset: 20, category: 3 });

    expect(requestedUrl(fetchMock)).toBe(
      `${BASE_URL}/exerciseinfo/?language=2&limit=10&offset=20&category=3`
    );
  });

  it('returns the full paginated payload', async () => {
    const payload = paginated([makeExercise()]);
    mockFetchOnce(payload);

    await expect(getExercises()).resolves.toEqual(payload);
  });
});

describe('searchExercises', () => {
  const bench = makeExercise({
    id: 1,
    category: { id: 1, name: 'Chest' },
    translations: [makeTranslation({ name: 'Bench Press' })],
  });
  const squat = makeExercise({
    id: 2,
    category: { id: 2, name: 'Legs' },
    translations: [
      makeTranslation({
        name: 'Barbell Squat',
        aliases: [{ id: 1, uuid: 'alias-uuid', alias: 'Back Squat' }],
      }),
    ],
  });

  it('returns every result for a blank query', async () => {
    mockFetchOnce(paginated([bench, squat]));

    await expect(searchExercises('   ')).resolves.toEqual([bench, squat]);
  });

  it('matches on name case-insensitively', async () => {
    mockFetchOnce(paginated([bench, squat]));

    await expect(searchExercises('bench')).resolves.toEqual([bench]);
  });

  it('matches on aliases', async () => {
    mockFetchOnce(paginated([bench, squat]));

    await expect(searchExercises('back squat')).resolves.toEqual([squat]);
  });

  it('matches on category name', async () => {
    mockFetchOnce(paginated([bench, squat]));

    await expect(searchExercises('legs')).resolves.toEqual([squat]);
  });

  it('returns an empty list when nothing matches', async () => {
    mockFetchOnce(paginated([bench, squat]));

    await expect(searchExercises('deadlift')).resolves.toEqual([]);
  });

  it('sends limit and category query params without an offset', async () => {
    const fetchMock = mockFetchOnce(paginated([]));

    await searchExercises('press', { limit: 5, category: 4 });

    expect(requestedUrl(fetchMock)).toBe(
      `${BASE_URL}/exerciseinfo/?language=2&limit=5&category=4`
    );
  });
});

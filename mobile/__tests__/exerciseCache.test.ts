import { exerciseCacheSize, mapCacheRow } from '../src/services/exerciseCache';

describe('mapCacheRow', () => {
  it('maps a raw sqlite row into a CachedExercise', () => {
    const row = {
      id: 'uuid-1',
      wger_id: 12,
      name: 'Bench Press',
      category: 'Chest',
      equipment: '["Barbell","Bench"]',
      muscles: '["Pectoralis major"]',
      muscles_secondary: '["Triceps brachii"]',
      description: 'Lie on a bench.',
      image_url: 'https://wger.de/img.png',
      aliases: '["BP"]',
      fetched_at: '2026-01-01T00:00:00.000Z',
    };

    expect(mapCacheRow(row)).toEqual({
      id: 'uuid-1',
      wgerId: 12,
      name: 'Bench Press',
      category: 'Chest',
      equipment: ['Barbell', 'Bench'],
      muscles: ['Pectoralis major'],
      musclesSecondary: ['Triceps brachii'],
      description: 'Lie on a bench.',
      imageUrl: 'https://wger.de/img.png',
      aliases: ['BP'],
    });
  });

  it('tolerates missing or malformed JSON fields', () => {
    const mapped = mapCacheRow({
      id: 'uuid-2',
      wger_id: 5,
      name: 'Mystery Lift',
      category: null,
      equipment: 'not json',
      muscles: null,
      muscles_secondary: '[]',
      description: null,
      image_url: null,
      aliases: null,
    });

    expect(mapped).toMatchObject({
      category: '',
      equipment: [],
      muscles: [],
      musclesSecondary: [],
      description: '',
      imageUrl: null,
      aliases: [],
    });
  });
});

describe('exerciseCacheSize', () => {
  const fakeDb = (rows: Record<string, unknown>[]) => ({
    execute: jest.fn(async () => ({ rows: { _array: rows } })),
  });

  it('returns the row count', async () => {
    const db = fakeDb([{ count: 312 }]);
    await expect(exerciseCacheSize(db as never)).resolves.toBe(312);
  });

  it('returns 0 when the table is empty', async () => {
    const db = fakeDb([{ count: 0 }]);
    await expect(exerciseCacheSize(db as never)).resolves.toBe(0);
  });
});

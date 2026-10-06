import { buildMuscleLoad, muscleGroup } from '@/src/utils/muscles';
import { buildStrengthProgression } from '@/src/utils/progression';
import { computeTodayStats } from '@/src/utils/todayStats';
import type { WorkoutSet, WorkoutWithSets } from '@/src/hooks/useWorkouts';

jest.mock('@powersync/react-native', () => ({ useQuery: jest.fn() }));

const DAY = 24 * 60 * 60 * 1000;

function set(exerciseName: string, weightKg: number, reps: number, setType = 'NORMAL'): WorkoutSet {
  return {
    id: `${exerciseName}-${weightKg}-${reps}-${setType}`,
    workoutId: 'w',
    exerciseName,
    wgerId: null,
    setNumber: 1,
    setType,
    weightKg,
    reps,
    rpe: null,
    completed: true,
    attachment: null,
  };
}

function workout(id: string, completedAt: Date, sets: WorkoutSet[]): WorkoutWithSets {
  return {
    id,
    userId: 'u',
    workoutType: 'STRENGTH',
    title: id,
    durationSeconds: 600,
    distanceMeters: 0,
    avgPaceSecondsPerKm: null,
    completedAt: completedAt.toISOString(),
    sets,
  };
}

describe('muscleGroup', () => {
  it('maps wger English names and Latin names to the right group', () => {
    expect(muscleGroup('Lats')).toBe('Back');
    expect(muscleGroup('Latissimus dorsi')).toBe('Back');
    expect(muscleGroup('Calves')).toBe('Legs');
    expect(muscleGroup('Biceps femoris')).toBe('Legs');
    expect(muscleGroup('Hamstrings')).toBe('Legs');
    expect(muscleGroup('Biceps')).toBe('Arms');
    expect(muscleGroup('Triceps brachii')).toBe('Arms');
    expect(muscleGroup('Chest')).toBe('Chest');
    expect(muscleGroup('Shoulders')).toBe('Shoulders');
    expect(muscleGroup('Abs')).toBe('Core');
  });
});

describe('buildMuscleLoad', () => {
  const lookup = (name: string) =>
    ({ Squat: 'Legs', Bench: 'Chest', PullUp: 'Back' } as const)[name as 'Squat'] ?? 'Other';

  it('returns no slices when there is no volume', () => {
    expect(buildMuscleLoad([], lookup, 30)).toEqual([]);
  });

  it('splits volume exactly by weight × reps and omits zero-volume groups', () => {
    const now = new Date();
    const w = workout('a', new Date(now.getTime() - DAY), [
      set('Squat', 100, 5), // 500
      set('Squat', 60, 10, 'WARMUP'), // 600
      set('Bench', 80, 5), // 400
      set('PullUp', 0, 10), // bodyweight → 0 volume
    ]);
    const slices = buildMuscleLoad([w], lookup, 30, now);
    expect(slices.map((s) => s.group)).toEqual(['Legs', 'Chest']);
    expect(slices[0].volumeKg).toBe(1100);
    expect(slices[0].share).toBeCloseTo(1100 / 1500);
    expect(slices[1].share).toBeCloseTo(400 / 1500);
  });
});

describe('buildStrengthProgression', () => {
  it('ignores warmup sets for e1RM and computes first→last trend', () => {
    const now = new Date();
    const a = workout('a', new Date(now.getTime() - 2 * DAY), [
      set('Squat', 40, 10, 'WARMUP'),
      set('Squat', 100, 5),
    ]);
    const b = workout('b', new Date(now.getTime() - DAY), [
      set('Squat', 20, 12, 'WARMUP'),
      set('Squat', 110, 5),
    ]);
    const [row] = buildStrengthProgression([b, a], 30, 6, now);
    expect(row.sessions).toBe(2);
    expect(row.points[0]).toBeCloseTo(100 * (36 / 32));
    expect(row.points[1]).toBeCloseTo(110 * (36 / 32));
    expect(row.trendPct).toBeCloseTo(10);
  });
});

describe('computeTodayStats', () => {
  it('has no baseline when every session is in the current period', () => {
    const now = new Date();
    const w = workout('a', new Date(now.getTime() - 60 * 1000), [set('Squat', 100, 5)]);
    const stats = computeTodayStats([w], 3);
    expect(stats.todayVolumeKg).toBe(500);
    expect(stats.weekVolumeKg).toBe(500);
    expect(stats.avgWeekVolumeKg).toBe(0);
    expect(stats.medianSessionVolumeKg).toBe(0);
  });

  it('does not mutate the asOf date', () => {
    const asOf = new Date(Date.now() - 3 * DAY);
    asOf.setHours(10, 0, 0, 0);
    const before = asOf.getTime();
    computeTodayStats([], 3, asOf);
    expect(asOf.getTime()).toBe(before);
  });

  it('reports zero for days with nothing logged', () => {
    const stats = computeTodayStats([], 3);
    expect(stats.todayVolumeKg).toBe(0);
    expect(stats.dailyVolumes.every((d) => d.value === 0)).toBe(true);
  });
});

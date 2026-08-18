jest.mock('@/src/db/database', () => ({
  getPowerSyncDatabase: jest.fn(),
  setPowerSyncDatabase: jest.fn(),
}));

import * as Haptics from 'expo-haptics';
import { useWorkoutSessionStore, DEFAULT_REST_SECONDS } from '@/src/store/useWorkoutSessionStore';
import { estimateOneRepMax } from '@/src/utils/oneRepMax';
import { BENCH, PUSH_DAY, SQUAT, logSet, resetSession } from './support/session';

const store = useWorkoutSessionStore;

beforeEach(() => {
  resetSession(store);
  jest.clearAllMocks();
});

describe('startWorkout', () => {
  it('starts an empty session with a client-generated workout id', () => {
    store.getState().startWorkout();
    const state = store.getState();

    expect(state.isActive).toBe(true);
    expect(state.workoutId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-/);
    expect(state.routineId).toBeNull();
    expect(state.title).toBe('Workout');
    expect(state.startTime).toBeGreaterThan(0);
    expect(state.exercises).toEqual([]);
  });

  it('seeds exercises, target sets and rest times from a routine template', () => {
    store.getState().startWorkout(PUSH_DAY);
    const { exercises, routineId, title } = store.getState();

    expect(routineId).toBe(PUSH_DAY.id);
    expect(title).toBe('Push Day');
    expect(exercises.map((exercise) => exercise.exerciseId)).toEqual([BENCH.exerciseId, SQUAT.exerciseId]);
    expect(exercises[0].restSeconds).toBe(120);
    expect(exercises[0].sets).toHaveLength(3);
    expect(exercises[0].sets.map((set) => set.setIndex)).toEqual([1, 2, 3]);
    expect(exercises[0].sets[0]).toMatchObject({
      setType: 'NORMAL',
      weight: null,
      reps: null,
      isCompleted: false,
      previousWeight: 95,
      previousReps: 8,
    });
  });
});

describe('session editing', () => {
  it('appends an exercise with a single blank set', () => {
    store.getState().startWorkout();
    store.getState().addExercise({ id: 'ex-row', name: 'Barbell Row' });

    const [exercise] = store.getState().exercises;
    expect(exercise).toMatchObject({ exerciseId: 'ex-row', orderIndex: 0, restSeconds: DEFAULT_REST_SECONDS });
    expect(exercise.sets).toHaveLength(1);
    expect(exercise.sets[0].weight).toBeNull();
  });

  it('adds sets that inherit the previous set as ghost values', () => {
    store.getState().startWorkout();
    store.getState().addExercise({ id: 'ex-row', name: 'Barbell Row' });
    logSet(store, 'ex-row', 0, 60, 10);
    store.getState().addSet('ex-row');

    const sets = store.getState().exercises[0].sets;
    expect(sets).toHaveLength(2);
    expect(sets[1]).toMatchObject({ setIndex: 2, previousWeight: 60, previousReps: 10, weight: null });
  });

  it('parses numeric input and clears emptied fields', () => {
    store.getState().startWorkout(PUSH_DAY);
    const setId = store.getState().exercises[0].sets[0].id;

    store.getState().updateSet(BENCH.exerciseId, setId, 'weight', '102.5');
    store.getState().updateSet(BENCH.exerciseId, setId, 'reps', '8');
    store.getState().updateSet(BENCH.exerciseId, setId, 'rpe', '9.5');
    expect(store.getState().exercises[0].sets[0]).toMatchObject({ weight: 102.5, reps: 8, rpe: 9.5 });

    store.getState().updateSet(BENCH.exerciseId, setId, 'weight', '');
    expect(store.getState().exercises[0].sets[0].weight).toBeNull();
  });

  it('cycles set types NORMAL -> WARMUP -> DROP -> FAILURE -> NORMAL', () => {
    store.getState().startWorkout(PUSH_DAY);
    const setId = store.getState().exercises[0].sets[0].id;
    const typeOf = () => store.getState().exercises[0].sets[0].setType;

    expect(typeOf()).toBe('NORMAL');
    store.getState().cycleSetType(BENCH.exerciseId, setId);
    expect(typeOf()).toBe('WARMUP');
    store.getState().cycleSetType(BENCH.exerciseId, setId);
    expect(typeOf()).toBe('DROP');
    store.getState().cycleSetType(BENCH.exerciseId, setId);
    expect(typeOf()).toBe('FAILURE');
    store.getState().cycleSetType(BENCH.exerciseId, setId);
    expect(typeOf()).toBe('NORMAL');
  });

  it('reorders exercises and keeps orderIndex contiguous', () => {
    store.getState().startWorkout(PUSH_DAY);
    store.getState().reorderExercises(0, 1);

    expect(store.getState().exercises.map((exercise) => [exercise.exerciseId, exercise.orderIndex])).toEqual([
      [SQUAT.exerciseId, 0],
      [BENCH.exerciseId, 1],
    ]);
  });
});

describe('toggleSetComplete', () => {
  it('propagates ghost values from a completed 100kg x 8 to the next empty set', () => {
    store.getState().startWorkout(PUSH_DAY);
    logSet(store, BENCH.exerciseId, 0, 100, 8);

    const sets = store.getState().exercises[0].sets;
    expect(sets[0]).toMatchObject({ isCompleted: true, weight: 100, reps: 8 });
    expect(sets[1]).toMatchObject({ previousWeight: 100, previousReps: 8, weight: null, reps: null });
    expect(sets[2]).toMatchObject({ previousWeight: 100, previousReps: 8 });
  });

  it('does not overwrite ghost values of sets the athlete already filled in', () => {
    store.getState().startWorkout(PUSH_DAY);
    const secondSetId = store.getState().exercises[0].sets[1].id;
    store.getState().updateSet(BENCH.exerciseId, secondSetId, 'weight', 110);

    logSet(store, BENCH.exerciseId, 0, 100, 8);

    expect(store.getState().exercises[0].sets[1]).toMatchObject({ weight: 110, previousWeight: 95 });
  });

  it('fires light haptics and starts the rest timer', () => {
    store.getState().startWorkout(PUSH_DAY);
    logSet(store, BENCH.exerciseId, 0, 100, 8);

    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    const timer = store.getState().activeRestTimer;
    expect(timer).not.toBeNull();
    expect(timer?.durationSeconds).toBe(120);
    expect(timer?.targetTimestamp).toBeGreaterThan(Date.now());
  });

  it('un-completing a set clears its PR flag and stops the rest timer', () => {
    store.getState().startWorkout(PUSH_DAY);
    const setId = store.getState().exercises[0].sets[0].id;
    logSet(store, BENCH.exerciseId, 0, 100, 8);

    store.getState().toggleSetComplete(BENCH.exerciseId, setId);

    expect(store.getState().exercises[0].sets[0]).toMatchObject({
      isCompleted: false,
      isPersonalRecord: false,
    });
    expect(store.getState().activeRestTimer).toBeNull();
  });
});

describe('Brzycki 1RM and PR detection', () => {
  it('computes weight * (36 / (37 - reps))', () => {
    expect(estimateOneRepMax(100, 8)).toBeCloseTo(124.1379, 4);
    expect(estimateOneRepMax(100, 1)).toBeCloseTo(100, 6);
    expect(estimateOneRepMax(140, 5)).toBeCloseTo(157.5, 4);
  });

  it('rejects inputs outside the formula domain', () => {
    expect(estimateOneRepMax(null, 8)).toBeNull();
    expect(estimateOneRepMax(100, null)).toBeNull();
    expect(estimateOneRepMax(100, 0)).toBeNull();
    expect(estimateOneRepMax(100, 37)).toBeNull();
    expect(estimateOneRepMax(0, 5)).toBeNull();
  });

  it('flags a PR only when the estimate beats the session best', () => {
    store.getState().startWorkout(PUSH_DAY);
    logSet(store, BENCH.exerciseId, 0, 100, 8);

    expect(store.getState().exercises[0].sets[0]).toMatchObject({ isPersonalRecord: true });
    expect(store.getState().personalRecords[BENCH.exerciseId]).toBeCloseTo(124.1379, 4);

    logSet(store, BENCH.exerciseId, 1, 90, 8);
    expect(store.getState().exercises[0].sets[1].isPersonalRecord).toBe(false);

    logSet(store, BENCH.exerciseId, 2, 110, 8);
    expect(store.getState().exercises[0].sets[2].isPersonalRecord).toBe(true);
    expect(store.getState().personalRecords[BENCH.exerciseId]).toBeCloseTo(136.5517, 4);
  });
});

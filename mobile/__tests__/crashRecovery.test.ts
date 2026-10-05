jest.mock('@/src/db/database', () => ({
  getPowerSyncDatabase: jest.fn(),
  setPowerSyncDatabase: jest.fn(),
}));

import { MMKV } from 'react-native-mmkv';
import { SESSION_STORAGE_KEY } from '@/src/store/useWorkoutSessionStore';
import type { ActiveExercise } from '@/src/types/workout';
import { BENCH, PUSH_DAY, SQUAT, logSet, resetSession } from './support/session';

type StoreModule = typeof import('@/src/store/useWorkoutSessionStore');

function loadStoreModule(): StoreModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/src/store/useWorkoutSessionStore') as StoreModule;
}

/** Drops every JS module from memory: the closest analogue of an OS process kill. */
function simulateCrash(): StoreModule {
  jest.resetModules();
  return loadStoreModule();
}

beforeEach(() => {
  new MMKV().clearAll();
  jest.resetModules();
});

describe('crash recovery', () => {
  it('rehydrates a mid-workout session with 100% data integrity', () => {
    const before = loadStoreModule().useWorkoutSessionStore;
    resetSession(before);

    before.getState().startWorkout(PUSH_DAY);
    logSet(before, BENCH.exerciseId, 0, 100, 8);
    logSet(before, BENCH.exerciseId, 1, 100, 7);
    logSet(before, SQUAT.exerciseId, 0, 140, 5);
    before.getState().updateSet(
      SQUAT.exerciseId,
      before.getState().exercises[1].sets[1].id,
      'rpe',
      8.5
    );

    const snapshot = {
      workoutId: before.getState().workoutId,
      startTime: before.getState().startTime,
      title: before.getState().title,
      routineId: before.getState().routineId,
      restTimer: before.getState().activeRestTimer,
      exercises: JSON.parse(JSON.stringify(before.getState().exercises)) as ActiveExercise[],
      personalRecords: { ...before.getState().personalRecords },
    };

    const after = simulateCrash().useWorkoutSessionStore;
    const restored = after.getState();

    expect(restored).not.toBe(before.getState());
    expect(restored.isActive).toBe(true);
    expect(restored.workoutId).toBe(snapshot.workoutId);
    expect(restored.startTime).toBe(snapshot.startTime);
    expect(restored.title).toBe(snapshot.title);
    expect(restored.routineId).toBe(snapshot.routineId);
    expect(restored.activeRestTimer).toEqual(snapshot.restTimer);
    expect(restored.personalRecords).toEqual(snapshot.personalRecords);
    expect(restored.exercises).toEqual(snapshot.exercises);
  });

  it('restores every weight, rep and completion flag of the 3 completed sets', () => {
    const before = loadStoreModule().useWorkoutSessionStore;
    resetSession(before);
    before.getState().startWorkout(PUSH_DAY);
    logSet(before, BENCH.exerciseId, 0, 100, 8);
    logSet(before, BENCH.exerciseId, 1, 100, 7);
    logSet(before, SQUAT.exerciseId, 0, 140, 5);

    const restored = simulateCrash().useWorkoutSessionStore.getState();
    const completed = restored.exercises.flatMap((exercise) =>
      exercise.sets
        .filter((set) => set.isCompleted)
        .map((set) => ({
          exerciseId: exercise.exerciseId,
          setIndex: set.setIndex,
          weight: set.weight,
          reps: set.reps,
        }))
    );

    expect(completed).toEqual([
      { exerciseId: BENCH.exerciseId, setIndex: 1, weight: 100, reps: 8 },
      { exerciseId: BENCH.exerciseId, setIndex: 2, weight: 100, reps: 7 },
      { exerciseId: SQUAT.exerciseId, setIndex: 1, weight: 140, reps: 5 },
    ]);
    expect(restored.exercises).toHaveLength(2);
  });

  it('keeps the persisted payload in MMKV under the session key', () => {
    const before = loadStoreModule().useWorkoutSessionStore;
    resetSession(before);
    before.getState().startWorkout(PUSH_DAY);
    logSet(before, BENCH.exerciseId, 0, 100, 8);

    const raw = new MMKV().getString(SESSION_STORAGE_KEY);
    expect(raw).toBeDefined();
    const persisted = JSON.parse(raw as string) as { state: Record<string, unknown> };
    expect(persisted.state).toMatchObject({ isActive: true, title: 'Push Day' });
    expect(persisted.state).not.toHaveProperty('isSaving');
  });

  it('does not rehydrate a session that was cleanly discarded', () => {
    const before = loadStoreModule().useWorkoutSessionStore;
    resetSession(before);
    before.getState().startWorkout(PUSH_DAY);
    before.getState().discardWorkout();

    const restored = simulateCrash().useWorkoutSessionStore.getState();
    expect(restored.isActive).toBe(false);
    expect(restored.exercises).toEqual([]);
    expect(restored.workoutId).toBeNull();
  });
});

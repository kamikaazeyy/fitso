jest.mock('@/src/db/database', () => ({
  getPowerSyncDatabase: jest.fn(),
  setPowerSyncDatabase: jest.fn(),
}));

import * as Haptics from 'expo-haptics';
import { MMKV } from 'react-native-mmkv';
import { getPowerSyncDatabase } from '@/src/db/database';
import { WORKOUT_SETS_TABLE, WORKOUTS_TABLE } from '@/src/db/AppSchema';
import {
  SESSION_STORAGE_KEY,
  useWorkoutSessionStore,
  type WorkoutSessionStore,
} from '@/src/store/useWorkoutSessionStore';
import {
  createFakePowerSyncDatabase,
  insertsInto,
  type FakePowerSyncDatabase,
} from './support/fakeDatabase';
import { flushPromises, logSet, resetSession } from './support/session';

const store = useWorkoutSessionStore;
const EXERCISE_IDS = ['ex-bench', 'ex-incline', 'ex-fly'];
const SETS_PER_EXERCISE = 5;

let db: FakePowerSyncDatabase;

/** Any Axios/fetch traffic while logging would be a bug: fail loudly instead. */
function forbidNetwork(): jest.SpyInstance {
  const spy = jest.spyOn(globalThis, 'fetch' as never);
  spy.mockImplementation(() => {
    throw new Error('Network request attempted while offline');
  });
  return spy;
}

function buildFifteenSetSession(): void {
  store.getState().startWorkout();
  EXERCISE_IDS.forEach((id, index) => {
    store.getState().addExercise({ id, name: `Exercise ${index + 1}` });
    for (let setNumber = 0; setNumber < SETS_PER_EXERCISE; setNumber += 1) {
      if (setNumber > 0) store.getState().addSet(id);
      logSet(store, id, setNumber, 80 + index * 5, 10 - setNumber);
    }
  });
}

beforeEach(() => {
  new MMKV().clearAll();
  resetSession(store);
  jest.clearAllMocks();
  db = createFakePowerSyncDatabase();
  jest.mocked(getPowerSyncDatabase).mockReturnValue(db as never);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('finishWorkout (offline)', () => {
  it('writes the workout and all 15 sets in a single local transaction', async () => {
    const network = forbidNetwork();
    buildFifteenSetSession();
    const workoutId = store.getState().workoutId;
    expect(
      store.getState().exercises.reduce((total, exercise) => total + exercise.sets.length, 0)
    ).toBe(15);

    await store.getState().finishWorkout();

    expect(db.transactionCount).toBe(1);
    expect(insertsInto(db, WORKOUTS_TABLE)).toHaveLength(1);

    const setInserts = insertsInto(db, WORKOUT_SETS_TABLE);
    expect(setInserts).toHaveLength(15);
    expect(setInserts.every((statement) => statement.params[1] === workoutId)).toBe(true);
    expect(network).not.toHaveBeenCalled();
  });

  it('persists set values, types and completion flags as SQLite-friendly params', async () => {
    buildFifteenSetSession();
    await store.getState().finishWorkout();

    const [first] = insertsInto(db, WORKOUT_SETS_TABLE);
    const [, , exerciseId, orderIndex, setType, weight, reps, rpe, isCompleted, createdAt] =
      first.params;

    expect(exerciseId).toBe('ex-bench');
    expect(orderIndex).toBe(1);
    expect(setType).toBe('NORMAL');
    expect(weight).toBe(80);
    expect(reps).toBe(10);
    expect(rpe).toBeNull();
    expect(isCompleted).toBe(1);
    expect(typeof createdAt).toBe('string');
    expect(Number.isNaN(Date.parse(createdAt as string))).toBe(false);
  });

  it('records the workout duration from the in-memory start time', async () => {
    buildFifteenSetSession();
    const startTime = store.getState().startTime as number;
    jest.spyOn(Date, 'now').mockReturnValue(startTime + 42_000);

    await store.getState().finishWorkout();

    const [workoutInsert] = insertsInto(db, WORKOUTS_TABLE);
    expect(workoutInsert.params[5]).toBe(42);
  });

  it('wipes the active session and its MMKV mirror after the write commits', async () => {
    buildFifteenSetSession();
    await store.getState().finishWorkout();

    const state = store.getState();
    expect(state.isActive).toBe(false);
    expect(state.workoutId).toBeNull();
    expect(state.exercises).toEqual([]);
    expect(state.activeRestTimer).toBeNull();
    expect(state.isSaving).toBe(false);

    const persisted = JSON.parse(new MMKV().getString(SESSION_STORAGE_KEY) as string) as {
      state: WorkoutSessionStore;
    };
    expect(persisted.state.isActive).toBe(false);
    expect(persisted.state.exercises).toEqual([]);
  });

  it('triggers heavy haptics on a successful save', async () => {
    buildFifteenSetSession();
    await flushPromises();
    jest.mocked(Haptics.impactAsync).mockClear();

    await store.getState().finishWorkout();

    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Heavy);
  });

  it('keeps the session intact when the local write fails', async () => {
    buildFifteenSetSession();
    db.failOnExecute = true;

    await expect(store.getState().finishWorkout()).rejects.toThrow('local write failed');

    expect(store.getState().isActive).toBe(true);
    expect(store.getState().isSaving).toBe(false);
    expect(store.getState().exercises).toHaveLength(EXERCISE_IDS.length);
  });

  it('is a no-op when no session is active', async () => {
    await store.getState().finishWorkout();
    expect(db.transactionCount).toBe(0);
  });
});

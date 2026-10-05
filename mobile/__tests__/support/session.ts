import type { Routine } from '@/src/types/workout';
import type { WorkoutSessionStore } from '@/src/store/useWorkoutSessionStore';
import type { StoreApi, UseBoundStore } from 'zustand';

export type SessionStore = UseBoundStore<StoreApi<WorkoutSessionStore>>;

export const BENCH: Routine['exercises'][number] = {
  exerciseId: 'ex-bench',
  name: 'Bench Press',
  orderIndex: 0,
  targetSets: 3,
  targetReps: 8,
  targetWeight: 95,
  restSeconds: 120,
};

export const SQUAT: Routine['exercises'][number] = {
  exerciseId: 'ex-squat',
  name: 'Back Squat',
  orderIndex: 1,
  targetSets: 3,
  targetReps: 5,
  targetWeight: 140,
  restSeconds: 180,
};

export const PUSH_DAY: Routine = {
  id: 'routine-push',
  name: 'Push Day',
  exercises: [BENCH, SQUAT],
};

/** Flushes pending microtasks (fire-and-forget haptics / notification calls). */
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export function resetSession(store: SessionStore): void {
  store.getState().discardWorkout();
  store.setState({ personalRecords: {}, userId: null, splitId: null });
}

/** Logs `weight x reps` into a set and marks it complete. */
export function logSet(
  store: SessionStore,
  exerciseId: string,
  setIndex: number,
  weight: number,
  reps: number
): void {
  const exercise = store.getState().exercises.find((entry) => entry.exerciseId === exerciseId);
  if (!exercise) throw new Error(`exercise ${exerciseId} not in session`);
  const target = exercise.sets[setIndex];
  if (!target) throw new Error(`set ${setIndex} not in ${exerciseId}`);
  store.getState().updateSet(exerciseId, target.id, 'weight', weight);
  store.getState().updateSet(exerciseId, target.id, 'reps', reps);
  store.getState().toggleSetComplete(exerciseId, target.id);
}

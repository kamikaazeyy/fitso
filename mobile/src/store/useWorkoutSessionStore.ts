import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getPowerSyncDatabase } from '@/src/db/database';
import { WORKOUT_SETS_TABLE, WORKOUTS_TABLE } from '@/src/db/AppSchema';
import { heavyFeedback, tapFeedback } from '@/src/services/haptics';
import {
  cancelRestNotification,
  scheduleRestNotification,
} from '@/src/services/restTimerNotifications';
import { createMMKVJSONStorage } from '@/src/store/mmkvStorage';
import {
  SET_TYPE_CYCLE,
  type ActiveExercise,
  type ActiveRestTimer,
  type ActiveSet,
  type Exercise,
  type Routine,
  type SetType,
} from '@/src/types/workout';
import { uuid } from '@/src/utils/id';
import { estimateOneRepMax } from '@/src/utils/oneRepMax';

export const SESSION_STORAGE_KEY = 'fitso.active-workout';
export const DEFAULT_REST_SECONDS = 90;

export type SetField = 'weight' | 'reps' | 'rpe' | 'setType';

export interface WorkoutSessionState {
  isActive: boolean;
  workoutId: string | null;
  routineId: string | null;
  title: string;
  startTime: number | null;
  exercises: ActiveExercise[];
  activeRestTimer: ActiveRestTimer | null;
  /** Best Brzycki 1RM per exercise, used to flag PRs without hitting the network. */
  personalRecords: Record<string, number>;
  isSaving: boolean;
}

export interface WorkoutSessionActions {
  startWorkout: (routine?: Routine) => void;
  addExercise: (exercise: Exercise) => void;
  removeExercise: (exerciseId: string) => void;
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  updateSet: (exerciseId: string, setId: string, field: SetField, value: unknown) => void;
  cycleSetType: (exerciseId: string, setId: string) => void;
  setAttachment: (exerciseId: string, attachment: string) => void;
  toggleSetComplete: (exerciseId: string, setId: string) => void;
  reorderExercises: (fromIndex: number, toIndex: number) => void;
  startRestTimer: (durationSeconds: number, exerciseName?: string) => void;
  stopRestTimer: () => void;
  finishWorkout: () => Promise<void>;
  discardWorkout: () => void;
}

export type WorkoutSessionStore = WorkoutSessionState & WorkoutSessionActions;

/** The slice mirrored to MMKV — actions and transient flags are not persisted. */
export type PersistedSession = Omit<WorkoutSessionState, 'isSaving'>;

const initialState: WorkoutSessionState = {
  isActive: false,
  workoutId: null,
  routineId: null,
  title: '',
  startTime: null,
  exercises: [],
  activeRestTimer: null,
  personalRecords: {},
  isSaving: false,
};

function blankSet(setIndex: number, previous?: ActiveSet): ActiveSet {
  return {
    id: uuid(),
    setIndex,
    setType: 'NORMAL',
    weight: null,
    reps: null,
    rpe: null,
    isCompleted: false,
    previousWeight: previous?.weight ?? previous?.previousWeight ?? undefined,
    previousReps: previous?.reps ?? previous?.previousReps ?? undefined,
  };
}

function reindex(sets: ActiveSet[]): ActiveSet[] {
  return sets.map((set, index) => (set.setIndex === index + 1 ? set : { ...set, setIndex: index + 1 }));
}

function mapExercise(
  exercises: ActiveExercise[],
  exerciseId: string,
  mapper: (exercise: ActiveExercise) => ActiveExercise
): ActiveExercise[] {
  return exercises.map((exercise) => (exercise.exerciseId === exerciseId ? mapper(exercise) : exercise));
}

function isSetEmpty(set: ActiveSet): boolean {
  return !set.isCompleted && set.weight === null && set.reps === null;
}

/**
 * Propagates the values of a just-completed set onto the following empty sets as
 * ghost placeholders, so the athlete can log a matching set with a single tap.
 */
function propagateGhostValues(sets: ActiveSet[], completedIndex: number): ActiveSet[] {
  const source = sets[completedIndex];
  if (!source || (source.weight === null && source.reps === null)) return sets;

  return sets.map((set, index) => {
    if (index <= completedIndex || !isSetEmpty(set)) return set;
    return {
      ...set,
      previousWeight: source.weight ?? set.previousWeight,
      previousReps: source.reps ?? set.previousReps,
    };
  });
}

export const useWorkoutSessionStore = create<WorkoutSessionStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      startWorkout: (routine) => {
        const exercises: ActiveExercise[] = (routine?.exercises ?? [])
          .slice()
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((entry, orderIndex) => {
            const targetSets = Math.max(1, entry.targetSets ?? 1);
            const sets: ActiveSet[] = Array.from({ length: targetSets }, (_, setIndex) => ({
              ...blankSet(setIndex + 1),
              previousWeight: entry.targetWeight ?? undefined,
              previousReps: entry.targetReps ?? undefined,
            }));
            return {
              exerciseId: entry.exerciseId,
              name: entry.name,
              orderIndex,
              restSeconds: entry.restSeconds ?? DEFAULT_REST_SECONDS,
              sets,
              wgerId: entry.wgerId ?? null,
              equipment: entry.equipment ?? [],
              attachment: entry.attachment,
            };
          });

        set({
          ...initialState,
          personalRecords: get().personalRecords,
          isActive: true,
          workoutId: uuid(),
          routineId: routine?.id ?? null,
          title: routine?.name ?? 'Workout',
          startTime: Date.now(),
          exercises,
        });
      },

      addExercise: (exercise) => {
        const { exercises } = get();
        if (exercises.some((entry) => entry.exerciseId === exercise.id)) return;
        set({
          exercises: [
            ...exercises,
            {
              exerciseId: exercise.id,
              name: exercise.name,
              orderIndex: exercises.length,
              restSeconds: exercise.defaultRestSeconds ?? DEFAULT_REST_SECONDS,
              sets: [blankSet(1)],
              wgerId: exercise.wgerId ?? null,
              equipment: exercise.equipment ?? [],
            },
          ],
        });
      },

      removeExercise: (exerciseId) => {
        set({
          exercises: get()
            .exercises.filter((exercise) => exercise.exerciseId !== exerciseId)
            .map((exercise, orderIndex) => ({ ...exercise, orderIndex })),
        });
      },

      addSet: (exerciseId) => {
        set({
          exercises: mapExercise(get().exercises, exerciseId, (exercise) => ({
            ...exercise,
            sets: [...exercise.sets, blankSet(exercise.sets.length + 1, exercise.sets.at(-1))],
          })),
        });
      },

      removeSet: (exerciseId, setId) => {
        set({
          exercises: mapExercise(get().exercises, exerciseId, (exercise) => ({
            ...exercise,
            sets: reindex(exercise.sets.filter((entry) => entry.id !== setId)),
          })),
        });
      },

      updateSet: (exerciseId, setId, field, value) => {
        set({
          exercises: mapExercise(get().exercises, exerciseId, (exercise) => ({
            ...exercise,
            sets: exercise.sets.map((entry) => {
              if (entry.id !== setId) return entry;
              if (field === 'setType') {
                return { ...entry, setType: value as SetType };
              }
              const numeric =
                value === null || value === undefined || value === ''
                  ? null
                  : Number.parseFloat(String(value));
              const next = numeric !== null && Number.isNaN(numeric) ? entry[field] : numeric;
              return { ...entry, [field]: next };
            }),
          })),
        });
      },

      setAttachment: (exerciseId, attachment) => {
        set({
          exercises: mapExercise(get().exercises, exerciseId, (exercise) => ({
            ...exercise,
            attachment,
          })),
        });
      },

      cycleSetType: (exerciseId, setId) => {
        const exercise = get().exercises.find((entry) => entry.exerciseId === exerciseId);
        const current = exercise?.sets.find((entry) => entry.id === setId);
        if (!current) return;
        const nextType = SET_TYPE_CYCLE[(SET_TYPE_CYCLE.indexOf(current.setType) + 1) % SET_TYPE_CYCLE.length];
        get().updateSet(exerciseId, setId, 'setType', nextType);
        tapFeedback();
      },

      toggleSetComplete: (exerciseId, setId) => {
        const { exercises, personalRecords } = get();
        const exercise = exercises.find((entry) => entry.exerciseId === exerciseId);
        const setIndex = exercise?.sets.findIndex((entry) => entry.id === setId) ?? -1;
        if (!exercise || setIndex < 0) return;

        const target = exercise.sets[setIndex];
        const isCompleting = !target.isCompleted;
        const oneRepMax = isCompleting ? estimateOneRepMax(target.weight, target.reps) : null;
        const previousBest = personalRecords[exerciseId] ?? 0;
        const isPersonalRecord = oneRepMax !== null && oneRepMax > previousBest;

        let sets = exercise.sets.map((entry, index) =>
          index === setIndex
            ? {
                ...entry,
                isCompleted: isCompleting,
                estimatedOneRepMax: oneRepMax,
                isPersonalRecord: isCompleting ? isPersonalRecord : false,
              }
            : entry
        );

        if (isCompleting) {
          sets = propagateGhostValues(sets, setIndex);
        }

        set({
          exercises: mapExercise(exercises, exerciseId, (entry) => ({ ...entry, sets })),
          personalRecords: isPersonalRecord
            ? { ...personalRecords, [exerciseId]: oneRepMax as number }
            : personalRecords,
        });

        if (isCompleting) {
          tapFeedback();
          get().startRestTimer(exercise.restSeconds, exercise.name);
        } else {
          get().stopRestTimer();
        }
      },

      reorderExercises: (fromIndex, toIndex) => {
        const exercises = [...get().exercises];
        if (
          fromIndex === toIndex ||
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= exercises.length ||
          toIndex >= exercises.length
        ) {
          return;
        }
        const [moved] = exercises.splice(fromIndex, 1);
        exercises.splice(toIndex, 0, moved);
        set({ exercises: exercises.map((exercise, orderIndex) => ({ ...exercise, orderIndex })) });
      },

      startRestTimer: (durationSeconds, exerciseName) => {
        if (durationSeconds <= 0) return;
        const targetTimestamp = Date.now() + durationSeconds * 1000;
        set({ activeRestTimer: { targetTimestamp, durationSeconds } });
        void scheduleRestNotification(targetTimestamp, exerciseName).catch(() => undefined);
      },

      stopRestTimer: () => {
        if (!get().activeRestTimer) return;
        set({ activeRestTimer: null });
        void cancelRestNotification().catch(() => undefined);
      },

      finishWorkout: async () => {
        const { isActive, workoutId, routineId, title, startTime, exercises } = get();
        if (!isActive || !workoutId) return;

        const finishedAt = Date.now();
        const createdAt = new Date(finishedAt).toISOString();
        const startedAt = new Date(startTime ?? finishedAt).toISOString();
        const durationSeconds = Math.max(0, Math.round((finishedAt - (startTime ?? finishedAt)) / 1000));

        set({ isSaving: true });

        try {
          const db = getPowerSyncDatabase();
          await db.writeTransaction(async (tx) => {
            await tx.execute(
              `INSERT INTO ${WORKOUTS_TABLE}
                 (id, routine_id, title, started_at, finished_at, duration_seconds, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                workoutId,
                routineId,
                title,
                startedAt,
                new Date(finishedAt).toISOString(),
                durationSeconds,
                createdAt,
              ]
            );

            for (const exercise of exercises) {
              for (const entry of exercise.sets) {
                await tx.execute(
                  `INSERT INTO ${WORKOUT_SETS_TABLE}
                     (id, workout_id, exercise_id, order_index, set_type, weight, reps, rpe, is_completed, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    entry.id,
                    workoutId,
                    exercise.exerciseId,
                    entry.setIndex,
                    entry.setType,
                    entry.weight,
                    entry.reps,
                    entry.rpe,
                    entry.isCompleted ? 1 : 0,
                    createdAt,
                  ]
                );
              }
            }
          });
        } catch (error) {
          set({ isSaving: false });
          throw error;
        }

        await cancelRestNotification().catch(() => undefined);
        heavyFeedback();
        set({ ...initialState, personalRecords: get().personalRecords });
      },

      discardWorkout: () => {
        void cancelRestNotification().catch(() => undefined);
        set({ ...initialState, personalRecords: get().personalRecords });
      },
    }),
    {
      name: SESSION_STORAGE_KEY,
      storage: createMMKVJSONStorage<PersistedSession>(),
      partialize: (state): PersistedSession => ({
        isActive: state.isActive,
        workoutId: state.workoutId,
        routineId: state.routineId,
        title: state.title,
        startTime: state.startTime,
        exercises: state.exercises,
        activeRestTimer: state.activeRestTimer,
        personalRecords: state.personalRecords,
      }),
    }
  )
);

export function selectTotalSets(state: WorkoutSessionStore): number {
  return state.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
}

export function selectCompletedSets(state: WorkoutSessionStore): number {
  return state.exercises.reduce(
    (total, exercise) => total + exercise.sets.filter((entry) => entry.isCompleted).length,
    0
  );
}

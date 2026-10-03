import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getPowerSyncDatabase } from '@/src/db/database';
import {
  ROUTINES_TABLE,
  ROUTINE_EXERCISES_TABLE,
  WORKOUT_SETS_TABLE,
  WORKOUTS_TABLE,
} from '@/src/db/AppSchema';
import { heavyFeedback, tapFeedback } from '@/src/services/haptics';
import {
  cancelRestNotification,
  scheduleRestNotification,
} from '@/src/services/restTimerNotifications';
import { createMMKVJSONStorage } from '@/src/store/mmkvStorage';
import { useSettingsStore } from '@/src/store/useSettingsStore';
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
import { computeRoutineUpdate } from '@/src/utils/routineSync';

export const SESSION_STORAGE_KEY = 'fitso.active-workout';
export const DEFAULT_REST_SECONDS = 90;

/** User-configurable default from Settings; falls back to 90s. */
function defaultRestSeconds(): number {
  return useSettingsStore.getState().defaultRestSeconds ?? DEFAULT_REST_SECONDS;
}

export type SetField = 'weight' | 'reps' | 'rpe' | 'setType';

export interface WorkoutSessionState {
  isActive: boolean;
  workoutId: string | null;
  routineId: string | null;
  splitId: string | null;
  title: string;
  startTime: number | null;
  exercises: ActiveExercise[];
  activeRestTimer: ActiveRestTimer | null;
  /** Epoch ms when the current pause began — null while the workout runs. */
  pausedAt: number | null;
  /** Total ms spent paused across the session (excludes an ongoing pause). */
  pausedTotalMs: number;
  /** All-time best Brzycki 1RM per exercise NAME from saved history — the
   * baseline a set must beat to earn a PR flag. Hydrated from the local
   * `workout_sets` table at session start/finish so a discarded workout never
   * leaks into it. Keyed by name because set history only stores names. */
  personalRecords: Record<string, number>;
  /** Authenticated user's id — written into the `user_id` column on save so
   * the sync rules can scope the workout to this user. Set by AuthContext. */
  userId: string | null;
  isSaving: boolean;
}

export interface WorkoutSessionActions {
  setUserId: (userId: string | null) => void;
  setSplitId: (splitId: string | null) => void;
  setPaused: (paused: boolean) => void;
  startWorkout: (routine?: Routine) => void;
  /** Reloads the PR baseline from saved set history (fire-and-forget). */
  hydratePersonalRecords: () => Promise<void>;
  /** Wipes all session state — used on logout so the next account on this
   * device doesn't inherit the previous user's PR baseline or live session. */
  resetSession: () => void;
  addExercise: (exercise: Exercise) => void;
  removeExercise: (exerciseId: string) => void;
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  updateSet: (exerciseId: string, setId: string, field: SetField, value: unknown) => void;
  cycleSetType: (exerciseId: string, setId: string) => void;
  setAttachment: (exerciseId: string, attachment: string) => void;
  toggleSetComplete: (exerciseId: string, setId: string) => void;
  reorderExercises: (fromIndex: number, toIndex: number) => void;
  setExerciseRest: (exerciseId: string, seconds: number) => void;
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
  splitId: null,
  title: '',
  startTime: null,
  exercises: [],
  activeRestTimer: null,
  pausedAt: null,
  pausedTotalMs: 0,
  personalRecords: {},
  userId: null,
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
 * Recomputes `estimatedOneRepMax` and `isPersonalRecord` for a whole exercise.
 * A completed NORMAL set earns the PR flag when its e1RM beats every NORMAL
 * set that came before it — the all-time history baseline plus the earlier
 * completed sets of this session. Warmup/drop/failure sets can never be PRs,
 * and un-completing or editing a set flips the flag back off.
 */
function computePRFlags(sets: ActiveSet[], historyBaseline: number): ActiveSet[] {
  let running = historyBaseline;
  return sets.map((set) => {
    const e1rm = set.isCompleted ? estimateOneRepMax(set.weight, set.reps) : null;
    const isPersonalRecord =
      set.isCompleted && set.setType === 'NORMAL' && e1rm !== null && e1rm > running;
    if (set.isCompleted && set.setType === 'NORMAL' && e1rm !== null) {
      running = Math.max(running, e1rm);
    }
    if (set.estimatedOneRepMax === e1rm && set.isPersonalRecord === isPersonalRecord) return set;
    return { ...set, estimatedOneRepMax: e1rm, isPersonalRecord };
  });
}

/** Active (non-paused) session time in ms, as of `now`. */
export function activeElapsedMs(
  state: Pick<WorkoutSessionState, 'startTime' | 'pausedAt' | 'pausedTotalMs'>,
  now: number
): number {
  if (!state.startTime) return 0;
  const pausedMs = state.pausedTotalMs + (state.pausedAt !== null ? now - state.pausedAt : 0);
  return Math.max(0, now - state.startTime - pausedMs);
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

      setUserId: (userId) => set({ userId }),

      setSplitId: (splitId) => set({ splitId }),

      setPaused: (paused) => {
        const { isActive, pausedAt, pausedTotalMs } = get();
        if (!isActive) return;
        if (paused && pausedAt === null) {
          set({ pausedAt: Date.now() });
        } else if (!paused && pausedAt !== null) {
          set({ pausedAt: null, pausedTotalMs: pausedTotalMs + (Date.now() - pausedAt) });
        }
      },

      hydratePersonalRecords: async () => {
        const { userId } = get();
        if (!userId) return;
        try {
          const db = getPowerSyncDatabase();
          const result = await db.execute(
            `SELECT ws.exercise_name, ws.weight, ws.reps
             FROM ${WORKOUT_SETS_TABLE} ws
             JOIN ${WORKOUTS_TABLE} w ON w.id = ws.workout_id
             WHERE w.user_id = ?
               AND ws.is_completed = 1
               AND (ws.set_type IS NULL OR ws.set_type = 'NORMAL')`,
            [userId]
          );
          const records: Record<string, number> = {};
          for (const row of (result.rows?._array ?? []) as {
            exercise_name: string;
            weight: number | null;
            reps: number | null;
          }[]) {
            const e1rm = estimateOneRepMax(row.weight, row.reps);
            if (e1rm !== null && e1rm > (records[row.exercise_name] ?? 0)) {
              records[row.exercise_name] = e1rm;
            }
          }
          // Re-flag already-completed sets against the fresh baseline —
          // hydration can resolve after the athlete has logged sets.
          set({
            personalRecords: records,
            exercises: get().exercises.map((exercise) => ({
              ...exercise,
              sets: computePRFlags(exercise.sets, records[exercise.name] ?? 0),
            })),
          });
        } catch {
          // DB not ready (or logged out mid-workout) — keep the old baseline.
        }
      },

      resetSession: () => {
        void cancelRestNotification().catch(() => undefined);
        set({ ...initialState });
      },

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
              restSeconds: entry.restSeconds ?? defaultRestSeconds(),
              sets,
              wgerId: entry.wgerId ?? null,
              equipment: entry.equipment ?? [],
              attachment: entry.attachment,
            };
          });

        set({
          ...initialState,
          personalRecords: get().personalRecords,
          userId: get().userId,
          splitId: get().splitId,
          isActive: true,
          workoutId: uuid(),
          routineId: routine?.id ?? null,
          title: routine?.name ?? 'Workout',
          startTime: Date.now(),
          exercises,
        });
        void get().hydratePersonalRecords();
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
              restSeconds: exercise.defaultRestSeconds ?? defaultRestSeconds(),
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
            sets: computePRFlags(
              reindex(exercise.sets.filter((entry) => entry.id !== setId)),
              get().personalRecords[exercise.name] ?? 0
            ),
          })),
        });
      },

      updateSet: (exerciseId, setId, field, value) => {
        set({
          exercises: mapExercise(get().exercises, exerciseId, (exercise) => ({
            ...exercise,
            sets: computePRFlags(
              exercise.sets.map((entry) => {
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
              get().personalRecords[exercise.name] ?? 0
            ),
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

        let sets = exercise.sets.map((entry, index) =>
          index === setIndex ? { ...entry, isCompleted: isCompleting } : entry
        );

        if (isCompleting) {
          sets = propagateGhostValues(sets, setIndex);
        }

        sets = computePRFlags(sets, personalRecords[exercise.name] ?? 0);

        set({
          exercises: mapExercise(exercises, exerciseId, (entry) => ({ ...entry, sets })),
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

      setExerciseRest: (exerciseId, seconds) => {
        set({
          exercises: mapExercise(get().exercises, exerciseId, (exercise) => ({
            ...exercise,
            restSeconds: Math.max(0, Math.round(seconds)),
          })),
        });
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
        const { isActive, workoutId, routineId, splitId, title, startTime, exercises, userId } = get();
        if (!isActive || !workoutId) return;
        if (!userId) {
          throw new Error('Cannot finish workout: user is not authenticated');
        }

        const finishedAt = Date.now();
        const createdAt = new Date(finishedAt).toISOString();
        const startedAt = new Date(startTime ?? finishedAt).toISOString();
        const durationSeconds = Math.round(activeElapsedMs(get(), finishedAt) / 1000);

        set({ isSaving: true });

        try {
          const db = getPowerSyncDatabase();
          await db.writeTransaction(async (tx) => {
            await tx.execute(
              `INSERT INTO ${WORKOUTS_TABLE}
                 (id, user_id, routine_id, split_id, title, started_at, finished_at, duration_seconds, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                workoutId,
                userId,
                routineId,
                splitId,
                title,
                startedAt,
                new Date(finishedAt).toISOString(),
                durationSeconds,
                createdAt,
              ]
            );

            for (const exercise of exercises) {
              for (const entry of exercise.sets) {
                // Skip sets the athlete never touched — they carry no data and
                // would just be noise rows in the history.
                if (isSetEmpty(entry)) continue;
                await tx.execute(
                  `INSERT INTO ${WORKOUT_SETS_TABLE}
                     (id, workout_id, exercise_name, wger_id, order_index, set_number, set_type, weight, reps, rpe, is_completed, attachment, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    entry.id,
                    workoutId,
                    exercise.name,
                    exercise.wgerId ?? null,
                    exercise.orderIndex,
                    entry.setIndex,
                    entry.setType,
                    entry.weight,
                    entry.reps,
                    entry.rpe,
                    entry.isCompleted ? 1 : 0,
                    exercise.attachment ?? null,
                    createdAt,
                  ]
                );
              }
            }

            // Routine write-back: fold the finished session back into the
            // template it was seeded from — Hevy-style auto-update. Adds and
            // updates only; exercises the athlete skipped stay in the routine
            // (removal happens in the routine editor, never implicitly).
            if (routineId && splitId) {
              const templateResult = await tx.execute(
                `SELECT id FROM ${ROUTINE_EXERCISES_TABLE} WHERE split_id = ?`,
                [splitId]
              );
              const templateIds = new Set<string>(
                ((templateResult.rows?._array ?? []) as { id: string }[]).map((row) => row.id)
              );
              const plan = computeRoutineUpdate(templateIds, exercises);

              for (const update of plan.updates) {
                await tx.execute(
                  `UPDATE ${ROUTINE_EXERCISES_TABLE}
                   SET order_index = ?, attachment = ?, rest_seconds = ?,
                       target_sets = COALESCE(?, target_sets),
                       target_reps = COALESCE(?, target_reps),
                       target_weight = COALESCE(?, target_weight)
                   WHERE id = ?`,
                  [
                    update.orderIndex,
                    update.attachment,
                    update.restSeconds,
                    update.targetSets,
                    update.targetReps,
                    update.targetWeight,
                    update.id,
                  ]
                );
              }

              for (const insert of plan.inserts) {
                await tx.execute(
                  `INSERT INTO ${ROUTINE_EXERCISES_TABLE}
                     (id, split_id, exercise_name, wger_id, equipment, attachment, order_index,
                      target_sets, target_reps, target_weight, rest_seconds, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    uuid(),
                    splitId,
                    insert.exerciseName,
                    insert.wgerId,
                    JSON.stringify(insert.equipment),
                    insert.attachment,
                    insert.orderIndex,
                    insert.targetSets,
                    insert.targetReps,
                    insert.targetWeight,
                    insert.restSeconds,
                    createdAt,
                  ]
                );
              }

              if (plan.updates.length > 0 || plan.inserts.length > 0) {
                await tx.execute(
                  `UPDATE ${ROUTINES_TABLE} SET updated_at = ? WHERE id = ?`,
                  [createdAt, routineId]
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
        set({ ...initialState, personalRecords: get().personalRecords, userId: get().userId, splitId: get().splitId });
        // The workout just became history — fold it into the PR baseline.
        void get().hydratePersonalRecords();
      },

      discardWorkout: () => {
        void cancelRestNotification().catch(() => undefined);
        set({ ...initialState, personalRecords: get().personalRecords, userId: get().userId, splitId: get().splitId });
        // Baseline is history-only, so a discarded session can't pollute it —
        // this refresh just re-syncs it with the local database.
        void get().hydratePersonalRecords();
      },
    }),
    {
      name: SESSION_STORAGE_KEY,
      storage: createMMKVJSONStorage<PersistedSession>(),
      partialize: (state): PersistedSession => ({
        isActive: state.isActive,
        workoutId: state.workoutId,
        routineId: state.routineId,
        splitId: state.splitId,
        title: state.title,
        startTime: state.startTime,
        exercises: state.exercises,
        activeRestTimer: state.activeRestTimer,
        pausedAt: state.pausedAt,
        pausedTotalMs: state.pausedTotalMs,
        personalRecords: state.personalRecords,
        userId: state.userId,
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

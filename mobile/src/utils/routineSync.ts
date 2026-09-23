import type { ActiveExercise } from '@/src/types/workout';

export interface RoutineExerciseUpdate {
  /** Existing routine_exercises.id */
  id: string;
  orderIndex: number;
  /** null = leave the stored value unchanged (no completed sets to derive from). */
  targetSets: number | null;
  targetReps: number | null;
  targetWeight: number | null;
  attachment: string | null;
  restSeconds: number;
}

export interface RoutineExerciseInsert {
  exerciseName: string;
  wgerId: number | null;
  equipment: string[];
  attachment: string | null;
  orderIndex: number;
  targetSets: number;
  targetReps: number | null;
  targetWeight: number | null;
  restSeconds: number;
}

export interface RoutineUpdatePlan {
  updates: RoutineExerciseUpdate[];
  inserts: RoutineExerciseInsert[];
}

/**
 * Computes the routine_exercises writes needed to make a routine template match
 * what the athlete actually did in a session. Called inside finishWorkout's
 * transaction when the session was seeded from a routine.
 *
 * Matching: session exercises seeded from the routine carry the
 * routine_exercises row id as `exerciseId`; exercises added mid-workout carry
 * the wger uuid, which never appears in `templateExerciseIds`.
 *
 * Writes back adds + updates only — exercises removed mid-workout are left in
 * the template (deletion happens in the routine editor, not implicitly).
 *
 * Targets come from the last completed NORMAL (working) set — warm-ups are
 * skipped — falling back to the last completed set of any type. When nothing
 * was completed, target fields are null and the SQL writer must preserve the
 * existing values (COALESCE).
 */
export function computeRoutineUpdate(
  templateExerciseIds: Set<string>,
  sessionExercises: ActiveExercise[]
): RoutineUpdatePlan {
  const updates: RoutineExerciseUpdate[] = [];
  const inserts: RoutineExerciseInsert[] = [];

  for (const exercise of sessionExercises) {
    const completed = exercise.sets.filter((set) => set.isCompleted);
    const working = completed.filter((set) => set.setType === 'NORMAL');
    const basis = working.at(-1) ?? completed.at(-1) ?? null;

    if (templateExerciseIds.has(exercise.exerciseId)) {
      updates.push({
        id: exercise.exerciseId,
        orderIndex: exercise.orderIndex,
        targetSets: completed.length > 0 ? completed.length : null,
        targetReps: basis?.reps ?? null,
        targetWeight: basis?.weight ?? null,
        attachment: exercise.attachment ?? null,
        restSeconds: exercise.restSeconds,
      });
    } else {
      inserts.push({
        exerciseName: exercise.name,
        wgerId: exercise.wgerId ?? null,
        equipment: exercise.equipment ?? [],
        attachment: exercise.attachment ?? null,
        orderIndex: exercise.orderIndex,
        targetSets: Math.max(1, completed.length || exercise.sets.length),
        targetReps: basis?.reps ?? null,
        targetWeight: basis?.weight ?? null,
        restSeconds: exercise.restSeconds,
      });
    }
  }

  return { updates, inserts };
}

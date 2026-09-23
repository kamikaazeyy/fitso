import { useMemo } from 'react';
import { useQuery } from '@powersync/react-native';

export interface WorkoutSet {
  id: string;
  workoutId: string;
  exerciseName: string;
  wgerId: number | null;
  setNumber: number;
  setType: string;
  weightKg: number;
  reps: number;
  rpe: number | null;
  completed: boolean;
  attachment: string | null;
}

export interface WorkoutWithSets {
  id: string;
  userId: string;
  title: string;
  durationSeconds: number;
  completedAt: string;
  sets: WorkoutSet[];
}

interface WorkoutRow {
  id: string;
  user_id: string;
  title: string;
  duration_seconds: number | null;
  finished_at: string;
}

interface WorkoutSetRow {
  id: string;
  workout_id: string;
  exercise_name: string;
  wger_id: number | null;
  set_number: number;
  set_type: string | null;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  is_completed: number;
  attachment: string | null;
}

/**
 * Reads finished workouts from local SQLite using PowerSync watched queries,
 * which re-emit whenever the underlying tables change — including writes
 * applied by the sync engine. Sets are joined client-side.
 */
export function useWorkouts(limit = 50, offset = 0) {
  const workoutsResult = useQuery<WorkoutRow>(
    `SELECT id, user_id, title, duration_seconds, finished_at
     FROM workouts
     WHERE finished_at IS NOT NULL
     ORDER BY finished_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  const setsResult = useQuery<WorkoutSetRow>(
    `SELECT id, workout_id, exercise_name, wger_id, set_number, set_type, weight, reps, rpe, is_completed, attachment
     FROM workout_sets
     ORDER BY order_index ASC, set_number ASC`
  );

  const isLoading = workoutsResult.isLoading || setsResult.isLoading;
  const error = workoutsResult.error ?? setsResult.error ?? null;

  const data = useMemo<WorkoutWithSets[] | undefined>(() => {
    if (isLoading) return undefined;

    const setsByWorkout = new Map<string, WorkoutSet[]>();
    for (const s of setsResult.data) {
      const list = setsByWorkout.get(s.workout_id) ?? [];
      list.push({
        id: s.id,
        workoutId: s.workout_id,
        exerciseName: s.exercise_name,
        wgerId: s.wger_id ?? null,
        setNumber: s.set_number,
        setType: s.set_type ?? 'NORMAL',
        weightKg: s.weight ?? 0,
        reps: s.reps ?? 0,
        rpe: s.rpe ?? null,
        completed: s.is_completed === 1,
        attachment: s.attachment ?? null,
      });
      setsByWorkout.set(s.workout_id, list);
    }

    return workoutsResult.data.map((workout) => ({
      id: workout.id,
      userId: workout.user_id,
      title: workout.title,
      durationSeconds: workout.duration_seconds ?? 0,
      completedAt: workout.finished_at,
      sets: setsByWorkout.get(workout.id) ?? [],
    }));
  }, [isLoading, workoutsResult.data, setsResult.data]);

  return { data, isLoading, error };
}

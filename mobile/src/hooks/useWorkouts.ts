import { useQuery } from '@tanstack/react-query';
import { usePowerSync } from '@powersync/react-native';

export interface WorkoutSet {
  id: string;
  workoutId: string;
  exerciseName: string;
  wgerId: number | null;
  setNumber: number;
  weightKg: number;
  reps: number;
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

export function useWorkouts(limit = 50, offset = 0) {
  const db = usePowerSync();

  return useQuery<WorkoutWithSets[]>({
    queryKey: ['workouts', limit, offset],
    queryFn: async () => {
      const workoutsResult = await db.execute(
        `SELECT id, user_id, title, duration_seconds, finished_at
         FROM workouts
         WHERE finished_at IS NOT NULL
         ORDER BY finished_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      const workoutRows = workoutsResult.rows?._array || [];

      const result: WorkoutWithSets[] = [];
      for (const workout of workoutRows) {
        const setsResult = await db.execute(
          `SELECT id, workout_id, exercise_name, wger_id, set_number, weight, reps, is_completed, attachment
           FROM workout_sets
           WHERE workout_id = ?
           ORDER BY order_index ASC, set_number ASC`,
          [workout.id]
        );
        const setRows = setsResult.rows?._array || [];

        result.push({
          id: workout.id,
          userId: workout.user_id,
          title: workout.title,
          durationSeconds: workout.duration_seconds ?? 0,
          completedAt: workout.finished_at,
          sets: setRows.map((s: any) => ({
            id: s.id,
            workoutId: s.workout_id,
            exerciseName: s.exercise_name,
            wgerId: s.wger_id ?? null,
            setNumber: s.set_number,
            weightKg: s.weight ?? 0,
            reps: s.reps ?? 0,
            completed: s.is_completed === 1,
            attachment: s.attachment ?? null,
          })),
        });
      }

      return result;
    },
  });
}

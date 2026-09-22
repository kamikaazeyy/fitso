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
      if (workoutRows.length === 0) return [];

      // One batched query for all sets instead of one query per workout —
      // order_index (exercise order) then set_number groups them per exercise.
      const placeholders = workoutRows.map(() => '?').join(', ');
      const setsResult = await db.execute(
        `SELECT id, workout_id, exercise_name, wger_id, set_number, weight, reps, is_completed, attachment
         FROM workout_sets
         WHERE workout_id IN (${placeholders})
         ORDER BY order_index ASC, set_number ASC`,
        workoutRows.map((w: any) => w.id)
      );

      const setsByWorkout = new Map<string, WorkoutSet[]>();
      for (const s of setsResult.rows?._array || []) {
        const set: WorkoutSet = {
          id: s.id,
          workoutId: s.workout_id,
          exerciseName: s.exercise_name,
          wgerId: s.wger_id ?? null,
          setNumber: s.set_number,
          weightKg: s.weight ?? 0,
          reps: s.reps ?? 0,
          completed: s.is_completed === 1,
          attachment: s.attachment ?? null,
        };
        const list = setsByWorkout.get(s.workout_id);
        if (list) list.push(set);
        else setsByWorkout.set(s.workout_id, [set]);
      }

      return workoutRows.map((workout: any) => ({
        id: workout.id,
        userId: workout.user_id,
        title: workout.title,
        durationSeconds: workout.duration_seconds ?? 0,
        completedAt: workout.finished_at,
        sets: setsByWorkout.get(workout.id) ?? [],
      }));
    },
  });
}

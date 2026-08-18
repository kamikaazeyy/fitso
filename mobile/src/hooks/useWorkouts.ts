import { useQuery } from '@tanstack/react-query';
import { client } from '@/src/api/client';

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
  return useQuery<WorkoutWithSets[]>({
    queryKey: ['workouts', limit, offset],
    queryFn: async () => {
      const { data } = await client.get('/api/workouts', {
        params: { limit, offset },
      });
      return data;
    },
  });
}

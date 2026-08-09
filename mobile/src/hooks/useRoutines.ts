import { useQuery } from '@tanstack/react-query';
import { client } from '@/src/api/client';

export interface RoutineExercise {
  id: string;
  wgerId: number | null;
  exerciseName: string;
  equipment: string[];
  attachment: string | null;
  order: number;
}

export interface Split {
  id: string;
  name: string;
  order: number;
  exercises: RoutineExercise[];
}

export interface Routine {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  splits: Split[];
}

export function useRoutines() {
  return useQuery<Routine[]>({
    queryKey: ['routines'],
    queryFn: async () => {
      const { data } = await client.get('/api/routines');
      return data;
    },
  });
}

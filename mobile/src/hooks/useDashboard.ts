import { useQuery } from '@tanstack/react-query';
import { client } from '@/src/api/client';
import { getLocalDateString } from '@/src/utils/date';

export interface Nutrition {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface Workout {
  id: string;
  title: string;
  durationSeconds: number;
  completedAt: string;
}

export interface DashboardResponse {
  nutrition: Nutrition | null;
  recentWorkouts: Workout[];
}

export function useDashboardData() {
  const today = getLocalDateString();

  return useQuery<DashboardResponse>({
    queryKey: ['dashboard', today],
    queryFn: async () => {
      const { data } = await client.get('/api/dashboard/today', {
        params: { date: today },
      });
      return data;
    },
  });
}

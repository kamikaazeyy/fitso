import { useQuery } from '@tanstack/react-query';
import { usePowerSync } from '@powersync/react-native';
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
  const db = usePowerSync();
  const today = getLocalDateString();

  return useQuery<DashboardResponse>({
    queryKey: ['dashboard', today],
    queryFn: async () => {
      // Recent workouts from local SQLite (instant, no network)
      const workoutsResult = await db.execute(
        `SELECT id, title, duration_seconds, finished_at
         FROM workouts
         WHERE finished_at IS NOT NULL
         ORDER BY finished_at DESC
         LIMIT 5`
      );
      const recentWorkouts: Workout[] = (workoutsResult.rows?._array || []).map((w: any) => ({
        id: w.id,
        title: w.title ?? 'Workout',
        durationSeconds: w.duration_seconds ?? 0,
        completedAt: w.finished_at,
      }));

      // Nutrition still comes from the server API for now — it's not
      // part of the offline-first workout sync. If the server is
      // unreachable, we just show null.
      let nutrition: Nutrition | null = null;
      try {
        // Import lazily to avoid circular dependency
        const { client } = await import('@/src/api/client');
        const { data } = await client.get('/api/dashboard/today', {
          params: { date: today },
        });
        nutrition = data?.nutrition ?? null;
      } catch {
        // Offline — nutrition data unavailable, workouts still show
      }

      return { nutrition, recentWorkouts };
    },
  });
}

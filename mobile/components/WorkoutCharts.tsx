import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LoadableContainer } from '@/components/LoadableContainer';
import { workoutVolume, workoutReps } from '@/components/WorkoutDashboard';
import type { WorkoutWithSets } from '@/src/hooks/useWorkouts';
import { colors } from '@/constants/theme';
import type { LoadableStatus } from '@/hooks/useLoadableData';

interface WorkoutChartsProps {
  data: WorkoutWithSets[] | undefined;
  status: LoadableStatus;
  error: string | null;
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function startOfLocalDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function StatTile({ icon, color, value, label }: { icon: string; color: string; value: string; label: string }) {
  return (
    <View className="w-[48%] bg-[#121212] rounded-[20px] p-4 mb-3">
      <Ionicons name={icon as any} size={20} color={color} />
      <Text className="text-white text-2xl font-extrabold mt-2">{value}</Text>
      <Text className="text-[#A0A0A0] text-xs font-medium">{label}</Text>
    </View>
  );
}

export function WorkoutCharts({ data, status, error }: WorkoutChartsProps) {
  const workouts = data ?? [];

  const stats = useMemo(() => {
    const todayStart = startOfLocalDay(new Date());
    const dayMs = 24 * 60 * 60 * 1000;

    // Per-day volume for the last 7 days (oldest first, today last)
    const days = Array.from({ length: 7 }, (_, i) => {
      const dayStart = todayStart - (6 - i) * dayMs;
      return { dayStart, label: DAY_LABELS[new Date(dayStart).getDay()], volume: 0, isToday: i === 6 };
    });
    const dayIndex = new Map(days.map((d, i) => [d.dayStart, i]));

    let weekWorkouts = 0;
    let weekReps = 0;
    let weekSeconds = 0;
    let streak = 0;
    const exerciseVolume = new Map<string, number>();

    const workoutDays = new Set<number>();
    for (const w of workouts) {
      const volume = workoutVolume(w.sets);
      const dayStart = startOfLocalDay(new Date(w.completedAt));
      workoutDays.add(dayStart);

      for (const s of w.sets) {
        if (!s.completed) continue;
        const v = (Number(s.weightKg) || 0) * (Number(s.reps) || 0);
        exerciseVolume.set(s.exerciseName, (exerciseVolume.get(s.exerciseName) ?? 0) + v);
      }

      const i = dayIndex.get(dayStart);
      if (i !== undefined) {
        weekWorkouts += 1;
        weekReps += workoutReps(w.sets);
        weekSeconds += w.durationSeconds || 0;
        days[i].volume += volume;
      }
    }

    // Consecutive-day streak ending today (or yesterday if today hasn't been trained yet)
    let cursor = workoutDays.has(todayStart) ? todayStart : todayStart - dayMs;
    while (workoutDays.has(cursor)) {
      streak += 1;
      cursor -= dayMs;
    }

    const weekVolume = days.reduce((sum, d) => sum + d.volume, 0);
    const topExercises = [...exerciseVolume.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, volume]) => ({
        name,
        volume,
        share: weekVolume > 0 ? volume / Math.max(...exerciseVolume.values()) : 0,
      }));

    return { days, weekWorkouts, weekVolume, weekReps, weekSeconds, streak, topExercises };
  }, [workouts]);

  const maxVolume = Math.max(...stats.days.map((d) => d.volume), 1);

  return (
    <LoadableContainer
      status={status}
      loadingMessage="Loading workout stats..."
      emptyIcon="barbell-outline"
      emptyTitle="No workouts yet"
      emptySubtitle="Finish a workout to see your activity."
      error={error}
    >
      {/* This Week */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-white text-lg font-bold">This week</Text>
        <View className="flex-row items-center">
          <Ionicons name="flame" size={16} color={colors.cta} />
          <Text className="text-[#A0A0A0] text-xs font-semibold ml-1">
            {stats.streak} day streak
          </Text>
        </View>
      </View>

      <View className="flex-row flex-wrap justify-between mb-1">
        <StatTile icon="barbell" color={colors.cta} value={String(stats.weekWorkouts)} label="Workouts" />
        <StatTile icon="trending-up" color={colors.cyan} value={`${formatNumber(stats.weekVolume)}`} label="Volume (kg)" />
        <StatTile icon="repeat" color={colors.yellow} value={formatNumber(stats.weekReps)} label="Reps" />
        <StatTile icon="time" color={colors.purple} value={String(Math.floor(stats.weekSeconds / 60))} label="Minutes" />
      </View>

      {/* Weekly volume chart */}
      <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
        <Text className="text-white text-base font-bold mb-4">Volume — last 7 days</Text>
        <View className="flex-row items-end justify-between" style={{ height: 120 }}>
          {stats.days.map((d) => (
            <View key={d.dayStart} className="items-center flex-1">
              <View
                style={{
                  height: Math.max(4, Math.round((d.volume / maxVolume) * 84)),
                  backgroundColor: d.volume === 0 ? '#2C2C2E' : d.isToday ? colors.cta : colors.cyan,
                  opacity: d.volume === 0 ? 0.6 : 1,
                }}
                className="w-6 rounded-md"
              />
              <Text className="text-[#A0A0A0] text-xs mt-2">{d.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Top exercises by volume */}
      {stats.topExercises.length > 0 && (
        <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
          <Text className="text-white text-base font-bold mb-3">Top exercises</Text>
          {stats.topExercises.map((ex) => (
            <View key={ex.name} className="mb-3">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-white text-sm font-semibold flex-1" numberOfLines={1}>
                  {ex.name}
                </Text>
                <Text className="text-[#A0A0A0] text-xs">{formatNumber(ex.volume)} kg</Text>
              </View>
              <View className="h-2 rounded-full bg-[#2C2C2E]">
                <View
                  style={{ width: `${Math.max(4, Math.round(ex.share * 100))}%`, backgroundColor: colors.cta }}
                  className="h-2 rounded-full"
                />
              </View>
            </View>
          ))}
        </View>
      )}
    </LoadableContainer>
  );
}

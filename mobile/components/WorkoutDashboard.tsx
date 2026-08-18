import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LoadableContainer } from '@/components/LoadableContainer';
import type { LoadableStatus } from '@/hooks/useLoadableData';
import type { WorkoutWithSets } from '@/src/hooks/useWorkouts';
import { colors } from '@/constants/theme';

interface WorkoutDashboardProps {
  data: WorkoutWithSets[] | undefined;
  status: LoadableStatus;
  error: string | null;
  onRefresh?: () => void;
}

export function workoutVolume(sets: WorkoutWithSets['sets']): number {
  return sets.reduce((sum, s) => sum + (Number(s.weightKg) || 0) * (Number(s.reps) || 0), 0);
}

export function workoutReps(sets: WorkoutWithSets['sets']): number {
  return sets.reduce((sum, s) => sum + (Number(s.reps) || 0), 0);
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}m ${s}s`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function WorkoutDashboard({ data, status, error }: WorkoutDashboardProps) {
  const router = useRouter();

  const workouts = data || [];

  const stats = useMemo(() => {
    const totalWorkouts = workouts.length;
    const totalVolume = workouts.reduce((sum, w) => sum + workoutVolume(w.sets), 0);
    const totalReps = workouts.reduce((sum, w) => sum + workoutReps(w.sets), 0);
    const totalDuration = workouts.reduce((sum, w) => sum + (w.durationSeconds || 0), 0);

    const exerciseBestSet: Record<string, { weightKg: number; reps: number; volume: number }> = {};

    for (const w of workouts) {
      for (const s of w.sets) {
        if (!s.completed) continue;
        const weightKg = Number(s.weightKg) || 0;
        const reps = Number(s.reps) || 0;
        const volume = weightKg * reps;
        const best = exerciseBestSet[s.exerciseName];
        if (!best || volume > best.volume) {
          exerciseBestSet[s.exerciseName] = { weightKg, reps, volume };
        }
      }
    }

    const personalRecords = Object.entries(exerciseBestSet)
      .map(([exerciseName, set]) => ({
        exerciseName,
        weightKg: set.weightKg,
        reps: set.reps,
        volume: set.volume,
      }))
      .sort((a, b) => b.volume - a.volume);

    return { totalWorkouts, totalVolume, totalReps, totalDuration, personalRecords };
  }, [workouts]);

  const recentWorkouts = useMemo(
    () =>
      workouts
        .slice(0, 7)
        .map((w) => ({
          ...w,
          volume: workoutVolume(w.sets),
          reps: workoutReps(w.sets),
        })),
    [workouts]
  );

  return (
    <LoadableContainer
      status={status}
      loadingMessage="Loading workout stats..."
      emptyIcon="barbell-outline"
      emptyTitle="No workouts yet"
      emptySubtitle="Start a workout from the Training tab to build your dashboard."
      error={error}
    >
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Summary Cards */}
        <View className="flex-row flex-wrap justify-between mb-4">
          <View className="w-[48%] bg-[#121212] rounded-[20px] p-4 mb-3">
            <Ionicons name="flame" size={20} color={colors.cta} />
            <Text className="text-white text-2xl font-extrabold mt-2">{stats.totalWorkouts}</Text>
            <Text className="text-[#A0A0A0] text-xs font-medium">Workouts</Text>
          </View>
          <View className="w-[48%] bg-[#121212] rounded-[20px] p-4 mb-3">
            <Ionicons name="barbell" size={20} color={colors.cyan} />
            <Text className="text-white text-2xl font-extrabold mt-2">{formatNumber(stats.totalVolume)}</Text>
            <Text className="text-[#A0A0A0] text-xs font-medium">Total Volume (kg)</Text>
          </View>
          <View className="w-[48%] bg-[#121212] rounded-[20px] p-4 mb-3">
            <Ionicons name="repeat" size={20} color={colors.yellow} />
            <Text className="text-white text-2xl font-extrabold mt-2">{formatNumber(stats.totalReps)}</Text>
            <Text className="text-[#A0A0A0] text-xs font-medium">Total Reps</Text>
          </View>
          <View className="w-[48%] bg-[#121212] rounded-[20px] p-4 mb-3">
            <Ionicons name="time" size={20} color={colors.purple} />
            <Text className="text-white text-2xl font-extrabold mt-2">{Math.floor(stats.totalDuration / 60)}</Text>
            <Text className="text-[#A0A0A0] text-xs font-medium">Minutes</Text>
          </View>
        </View>

        {/* Recent Workouts */}
        <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-white text-lg font-bold">Recent Sessions</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/(tabs)/journal')}
            >
              <Text className="text-[#E63946] text-sm font-semibold">Train</Text>
            </TouchableOpacity>
          </View>
          {recentWorkouts.length === 0 ? (
            <Text className="text-[#A0A0A0] text-sm">No sessions yet.</Text>
          ) : (
            recentWorkouts.map((w) => (
              <View key={w.id} className="flex-row items-center justify-between py-3 border-b border-[#1C1C1E] last:border-b-0">
                <View className="flex-1">
                  <Text className="text-white font-semibold" numberOfLines={1}>{w.title || 'Workout'}</Text>
                  <Text className="text-[#A0A0A0] text-xs">{formatDate(w.completedAt)} · {formatDuration(w.durationSeconds)}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-white font-bold">{formatNumber(w.volume)} kg</Text>
                  <Text className="text-[#A0A0A0] text-xs">{w.reps} reps</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Personal Records / Progressive Overload */}
        <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-white text-lg font-bold">Progressive Overload</Text>
          </View>
          {stats.personalRecords.length === 0 ? (
            <Text className="text-[#A0A0A0] text-sm">Complete sets to see your personal records.</Text>
          ) : (
            stats.personalRecords.slice(0, 10).map((pr) => (
              <View key={pr.exerciseName} className="flex-row items-center justify-between py-3 border-b border-[#1C1C1E] last:border-b-0">
                <View className="flex-1 pr-2">
                  <Text className="text-white font-semibold" numberOfLines={1}>{pr.exerciseName}</Text>
                  <Text className="text-[#A0A0A0] text-xs">Best volume {formatNumber(pr.volume)} kg</Text>
                </View>
                <View className="bg-[#E63946] rounded-xl px-3 py-1.5">
                  <Text className="text-white font-bold text-sm">{pr.weightKg} kg × {pr.reps}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </LoadableContainer>
  );
}

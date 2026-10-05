import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LoadableContainer } from '@/components/LoadableContainer';
import { OverloadLineChart, VolumeBarChart } from '@/components/ProgressCharts';
import { useQuery } from '@powersync/react-native';
import { CUSTOM_EXERCISES_TABLE, EXERCISE_CACHE_TABLE } from '@/src/db/AppSchema';
import type { LoadableStatus } from '@/hooks/useLoadableData';
import type { WorkoutWithSets } from '@/src/hooks/useWorkouts';
import { estimateOneRepMax } from '@/src/utils/oneRepMax';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { displayWeight } from '@/src/utils/units';
import { colors } from '@/constants/theme';

interface WorkoutDashboardProps {
  data: WorkoutWithSets[] | undefined;
  status: LoadableStatus;
  error: string | null;
  onRefresh?: () => void;
}

export function workoutVolume(sets: WorkoutWithSets['sets']): number {
  return sets.reduce(
    (sum, s) => (s.completed ? sum + (Number(s.weightKg) || 0) * (Number(s.reps) || 0) : sum),
    0
  );
}

export function workoutReps(sets: WorkoutWithSets['sets']): number {
  return sets.reduce((sum, s) => (s.completed ? sum + (Number(s.reps) || 0) : sum), 0);
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

function parseJsonList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function WorkoutDashboard({ data, status, error }: WorkoutDashboardProps) {
  const router = useRouter();
  const unit = useSettingsStore((s) => s.weightUnit);

  // Muscle lookup: wger catalogue rows keyed by id, custom exercises by name.
  const cacheMuscleRows = useQuery<{ wger_id: number; name: string; muscles: string }>(
    `SELECT wger_id, name, muscles FROM ${EXERCISE_CACHE_TABLE}`
  );
  const customMuscleRows = useQuery<{ name: string; muscles: string }>(
    `SELECT name, muscles FROM ${CUSTOM_EXERCISES_TABLE}`
  );

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

  // useWorkouts returns newest-first; charts read oldest → newest.
  const chronological = useMemo(() => [...workouts].reverse(), [workouts]);

  const sessionVolumes = useMemo(
    () =>
      chronological.slice(-12).map((w) => ({
        label: formatDate(w.completedAt),
        value: displayWeight(workoutVolume(w.sets.filter((s) => s.completed)), unit) ?? 0,
      })),
    [chronological, unit]
  );

  // Progressive overload: best estimated 1RM per exercise per session,
  // for the 3 most frequently trained exercises.
  const overload = useMemo(() => {
    const recent = chronological.slice(-14);
    const perWorkoutBest = recent.map((w) => {
      const best = new Map<string, number>();
      for (const s of w.sets) {
        if (!s.completed) continue;
        const e1rm = estimateOneRepMax(Number(s.weightKg) || 0, Number(s.reps) || 0);
        if (e1rm === null) continue;
        const current = best.get(s.exerciseName);
        if (current === undefined || e1rm > current) best.set(s.exerciseName, e1rm);
      }
      return best;
    });

    const counts = new Map<string, number>();
    for (const best of perWorkoutBest) {
      for (const name of best.keys()) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const topExercises = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    const palette = [colors.cta, colors.cyan, colors.yellow];
    return {
      series: topExercises.map((name, i) => ({
        name,
        color: palette[i],
        points: perWorkoutBest.map((best) => {
          const kg = best.get(name);
          return kg === undefined ? null : displayWeight(kg, unit);
        }),
      })),
      labels: recent.map((w) => formatDate(w.completedAt)),
    };
  }, [chronological, unit]);

  // Muscle-group volume over the last 30 days — sets join to the exercise
  // catalogue by wger id (or name for custom exercises) for muscle attribution.
  const muscleVolume = useMemo(() => {
    const muscleByWger = new Map<number, string>();
    const muscleByName = new Map<string, string>();
    for (const row of cacheMuscleRows.data) {
      const primary = parseJsonList(row.muscles)[0];
      if (!primary) continue;
      muscleByWger.set(row.wger_id, primary);
      if (!muscleByName.has(row.name)) muscleByName.set(row.name, primary);
    }
    for (const row of customMuscleRows.data) {
      const primary = parseJsonList(row.muscles)[0];
      if (primary && !muscleByName.has(row.name)) muscleByName.set(row.name, primary);
    }

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const totals = new Map<string, number>();
    for (const w of workouts) {
      if (new Date(w.completedAt).getTime() < cutoff) continue;
      for (const s of w.sets) {
        if (!s.completed) continue;
        const muscle =
          (s.wgerId != null ? muscleByWger.get(s.wgerId) : undefined) ??
          muscleByName.get(s.exerciseName) ??
          'Other';
        totals.set(muscle, (totals.get(muscle) ?? 0) + s.weightKg * s.reps);
      }
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [cacheMuscleRows.data, customMuscleRows.data, workouts]);

  const muscleMax = muscleVolume.length > 0 ? muscleVolume[0][1] : 1;

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
            <Text className="text-white text-2xl font-extrabold mt-2">
              {formatNumber(displayWeight(stats.totalVolume, unit) ?? 0)}
            </Text>
            <Text className="text-[#A0A0A0] text-xs font-medium">Total Volume ({unit})</Text>
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

        {/* Session volume chart */}
        <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
          <Text className="text-white text-lg font-bold mb-3">Session Volume</Text>
          <VolumeBarChart data={sessionVolumes} />
        </View>

        {/* Progressive overload chart */}
        <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
          <Text className="text-white text-lg font-bold mb-3">Est. 1RM Trend</Text>
          <OverloadLineChart series={overload.series} labels={overload.labels} />
        </View>

        {/* Muscle-group distribution — last 30 days */}
        {muscleVolume.length > 0 && (
          <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
            <Text className="text-white text-lg font-bold mb-3">Muscle Volume · 30d</Text>
            {muscleVolume.map(([muscle, volume]) => (
              <View key={muscle} className="flex-row items-center mb-2">
                <Text className="text-[#A0A0A0] text-xs font-semibold w-24" numberOfLines={1}>
                  {muscle}
                </Text>
                <View className="flex-1 h-2 rounded-full bg-[#1C1C1E] overflow-hidden mr-3">
                  <View
                    className="h-2 rounded-full bg-[#00E5FF]"
                    style={{ width: `${Math.max(4, (volume / muscleMax) * 100)}%` }}
                  />
                </View>
                <Text className="text-white text-xs font-bold w-16 text-right">
                  {formatNumber(displayWeight(volume, unit) ?? 0)}
                </Text>
              </View>
            ))}
          </View>
        )}

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
              <TouchableOpacity
                key={w.id}
                activeOpacity={0.7}
                onPress={() => router.push(`/workout-detail?workoutId=${w.id}`)}
                className="flex-row items-center justify-between py-3 border-b border-[#1C1C1E] last:border-b-0"
              >
                <View className="flex-1">
                  <Text className="text-white font-semibold" numberOfLines={1}>{w.title || 'Workout'}</Text>
                  <Text className="text-[#A0A0A0] text-xs">{formatDate(w.completedAt)} · {formatDuration(w.durationSeconds)}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-white font-bold">
                    {formatNumber(displayWeight(w.volume, unit) ?? 0)} {unit}
                  </Text>
                  <Text className="text-[#A0A0A0] text-xs">{w.reps} reps</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Personal Records / Progressive Overload */}
        <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-white text-lg font-bold">Personal Records</Text>
          </View>
          {stats.personalRecords.length === 0 ? (
            <Text className="text-[#A0A0A0] text-sm">Complete sets to see your personal records.</Text>
          ) : (
            stats.personalRecords.slice(0, 10).map((pr) => (
              <View key={pr.exerciseName} className="flex-row items-center justify-between py-3 border-b border-[#1C1C1E] last:border-b-0">
                <View className="flex-1 pr-2">
                  <Text className="text-white font-semibold" numberOfLines={1}>{pr.exerciseName}</Text>
                  <Text className="text-[#A0A0A0] text-xs">
                    Best volume {formatNumber(displayWeight(pr.volume, unit) ?? 0)} {unit}
                  </Text>
                </View>
                <View className="bg-[#E63946] rounded-xl px-3 py-1.5">
                  <Text className="text-white font-bold text-sm">
                    {displayWeight(pr.weightKg, unit)} {unit} × {pr.reps}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </LoadableContainer>
  );
}

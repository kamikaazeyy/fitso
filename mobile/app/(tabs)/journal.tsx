import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Polygon, Polyline } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/theme';
import { useRoutines } from '@/src/hooks/useRoutines';
import { useWorkouts } from '@/src/hooks/useWorkouts';
import { useRoutineMutations } from '@/src/hooks/useRoutineMutations';
import { useAuth } from '@/context/AuthContext';
import { useWorkoutSessionStore } from '@/src/store/useWorkoutSessionStore';
import { useCardioSessionStore } from '@/src/store/useCardioSessionStore';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { LoadableContainer } from '@/components/LoadableContainer';
import { MuscularLoadChart } from '@/components/MuscularLoadChart';
import { Sparkline } from '@/components/Sparkline';
import { ActivityHeatmap } from '@/components/ActivityHeatmap';
import { useMuscleLookup, buildMuscleLoad } from '@/src/utils/muscles';
import { buildStrengthProgression } from '@/src/utils/progression';
import { displayWeight } from '@/src/utils/units';
import type { WorkoutWithSets } from '@/src/hooks/useWorkouts';

const RANGES = [30, 60, 90];
type Segment = 'strength' | 'cardio';

function formatNumber(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatKm(meters: number): string {
  return (meters / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 });
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Daily totals within a range, oldest → newest (for the cardio area chart). */
function dailySeries(
  workouts: WorkoutWithSets[],
  days: number,
  pick: (w: WorkoutWithSets) => number,
  end: Date = new Date()
): number[] {
  const dayMs = 24 * 60 * 60 * 1000;
  const buckets = new Array(days).fill(0);
  const start = end.getTime() - days * dayMs;
  for (const w of workouts) {
    const t = new Date(w.completedAt).getTime();
    if (t < start || t > end.getTime()) continue;
    buckets[Math.floor((t - start) / dayMs)] += pick(w);
  }
  return buckets;
}

function AreaChart({ points, width = 300, height = 72, color = colors.cyan }: {
  points: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (points.length < 2) return null;
  const max = Math.max(1, ...points);
  const pad = 2;
  const xFor = (i: number) => pad + (i / (points.length - 1)) * (width - pad * 2);
  const yFor = (v: number) => height - pad - (v / max) * (height - pad * 2);
  const line = points.map((v, i) => `${xFor(i)},${yFor(v)}`).join(' ');
  const area = `${pad},${height - pad} ${line} ${xFor(points.length - 1)},${height - pad}`;
  return (
    <Svg width={width} height={height}>
      <Polygon points={area} fill={color} opacity={0.18} />
      <Polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function TrainingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: routines, isLoading, error } = useRoutines();
  const { data: workouts } = useWorkouts(120, 0);
  const { deleteRoutine, duplicateRoutine } = useRoutineMutations();
  const isWorkoutActive = useWorkoutSessionStore((s) => s.isActive);
  const activeTitle = useWorkoutSessionStore((s) => s.title);
  const discardWorkout = useWorkoutSessionStore((s) => s.discardWorkout);
  const isCardioActive = useCardioSessionStore((s) => s.isActive);
  const cardioTitle = useCardioSessionStore((s) => s.title);
  const unit = useSettingsStore((s) => s.weightUnit);
  const lookup = useMuscleLookup();

  const [rangeDays, setRangeDays] = useState(30);
  const [segment, setSegment] = useState<Segment>('strength');

  const list = useMemo(() => workouts ?? [], [workouts]);
  const cutoff = useMemo(() => Date.now() - rangeDays * 24 * 60 * 60 * 1000, [rangeDays]);

  const muscleLoad = useMemo(
    () => buildMuscleLoad(list, lookup, rangeDays),
    [list, lookup, rangeDays]
  );
  const progression = useMemo(
    () => buildStrengthProgression(list, rangeDays),
    [list, rangeDays]
  );

  // exercise → equipment label for progression subtitles ("Barbell · N sessions")
  const equipmentByExercise = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of routines ?? []) {
      for (const s of r.splits) {
        for (const e of s.exercises) {
          if (!map.has(e.exerciseName) && e.equipment?.length) {
            map.set(e.exerciseName, e.equipment[0]);
          }
        }
      }
    }
    return map;
  }, [routines]);

  // Cardio data for the selected range and the equal-length prior window.
  const cardio = useMemo(() => {
    const inRange = list.filter(
      (w) =>
        w.workoutType !== 'STRENGTH' &&
        new Date(w.completedAt).getTime() >= cutoff
    );
    const prior = list.filter((w) => {
      if (w.workoutType === 'STRENGTH') return false;
      const t = new Date(w.completedAt).getTime();
      return t < cutoff && t >= cutoff - rangeDays * 24 * 60 * 60 * 1000;
    });
    const dist = inRange.reduce((s, w) => s + (w.distanceMeters ?? 0), 0);
    const priorDist = prior.reduce((s, w) => s + (w.distanceMeters ?? 0), 0);
    const timeByType = new Map<string, number>();
    for (const w of inRange) {
      timeByType.set(w.workoutType, (timeByType.get(w.workoutType) ?? 0) + w.durationSeconds);
    }
    const totalSeconds = inRange.reduce((s, w) => s + w.durationSeconds, 0);
    const status =
      priorDist === 0 ? (dist > 0 ? 'Building' : 'No data') :
      dist > priorDist * 1.15 ? 'Improving' :
      dist < priorDist * 0.85 ? 'Declining' : 'Maintaining';
    return {
      sessions: inRange,
      dist,
      priorDist,
      status,
      totalSeconds,
      timeByType: [...timeByType.entries()].sort((a, b) => b[1] - a[1]),
      dailyKm: dailySeries(inRange, rangeDays, (w) => (w.distanceMeters ?? 0) / 1000),
    };
  }, [list, cutoff, rangeDays]);

  const openRoutineMenu = (routineId: string, routineName: string) => {
    Alert.alert(routineName, undefined, [
      {
        text: 'Edit',
        onPress: () => router.push(`/routine-editor?routineId=${routineId}`),
      },
      {
        text: 'Duplicate',
        onPress: async () => {
          if (!user?.id) return;
          try {
            await duplicateRoutine(routineId, user.id);
          } catch (err) {
            Alert.alert('Failed', err instanceof Error ? err.message : 'Could not duplicate routine');
          }
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete routine?', `"${routineName}" will be removed permanently.`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () =>
                deleteRoutine(routineId).catch((err) =>
                  Alert.alert('Failed', err instanceof Error ? err.message : 'Could not delete')
                ),
            },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const startWorkout = (routineId?: string, splitId?: string) => {
    const target =
      routineId && splitId ? `/workout?routineId=${routineId}&splitId=${splitId}` : '/workout';

    if (!isWorkoutActive) {
      router.push(target);
      return;
    }

    Alert.alert('Workout in progress', `"${activeTitle || 'Workout'}" is still running.`, [
      { text: 'Resume', onPress: () => router.push('/workout') },
      {
        text: 'Discard & Start New',
        style: 'destructive',
        onPress: () => {
          discardWorkout();
          router.push(target);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const routinesStatus = isLoading ? 'loading' : error ? 'empty' : 'data';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header + range pills */}
        <View className="flex-row items-center justify-between pt-6 pb-1">
          <View>
            <Text className="text-white text-3xl font-extrabold tracking-tight">Training</Text>
            <Text className="text-[#A0A0A0] text-sm mt-0.5">Last {rangeDays} days</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/routine-editor')}
            className="w-9 h-9 rounded-full bg-[#1C1C1E] border border-[#2C2C2E] items-center justify-center"
            accessibilityLabel="New routine"
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View className="flex-row mb-4 mt-3">
          {RANGES.map((d) => (
            <TouchableOpacity
              key={d}
              activeOpacity={0.8}
              onPress={() => setRangeDays(d)}
              className={`rounded-full px-4 py-1.5 mr-2 border ${
                rangeDays === d
                  ? 'bg-white border-white'
                  : 'bg-[#1C1C1E] border-[#2C2C2E]'
              }`}
            >
              <Text
                className={`text-xs font-bold ${rangeDays === d ? 'text-black' : 'text-[#A0A0A0]'}`}
              >
                {d}d
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* In-progress banners */}
        {isCardioActive && (
          <TouchableOpacity
            className="bg-[#121212] border border-[#38BDF8] rounded-[20px] p-4 mb-3 flex-row items-center justify-between"
            activeOpacity={0.8}
            onPress={() => router.push('/cardio-tracker')}
          >
            <View className="flex-row items-center flex-1">
              <View className="w-2.5 h-2.5 rounded-full bg-[#38BDF8] mr-3" />
              <View className="flex-1">
                <Text className="text-[#38BDF8] text-xs font-semibold uppercase">
                  Activity in progress
                </Text>
                <Text className="text-white font-bold" numberOfLines={1}>
                  {cardioTitle || 'Outdoor Activity'}
                </Text>
              </View>
            </View>
            <Text className="text-[#38BDF8] font-bold text-sm ml-3">Resume</Text>
          </TouchableOpacity>
        )}
        {isWorkoutActive && (
          <TouchableOpacity
            className="bg-[#121212] border border-[#E63946] rounded-[20px] p-4 mb-3 flex-row items-center justify-between"
            activeOpacity={0.8}
            onPress={() => router.push('/workout')}
          >
            <View className="flex-row items-center flex-1">
              <View className="w-2.5 h-2.5 rounded-full bg-[#4ADE80] mr-3" />
              <View className="flex-1">
                <Text className="text-[#4ADE80] text-xs font-semibold uppercase">
                  Workout in progress
                </Text>
                <Text className="text-white font-bold" numberOfLines={1}>
                  {activeTitle || 'Workout'}
                </Text>
              </View>
            </View>
            <Text className="text-[#E63946] font-bold text-sm ml-3">Resume</Text>
          </TouchableOpacity>
        )}

        {/* Segment control */}
        <View className="flex-row bg-[#1C1C1E] rounded-full p-1 mb-5">
          {(['strength', 'cardio'] as const).map((seg) => (
            <TouchableOpacity
              key={seg}
              activeOpacity={0.8}
              onPress={() => setSegment(seg)}
              className={`flex-1 rounded-full py-2 items-center ${
                segment === seg ? 'bg-[#3A3A3C]' : ''
              }`}
            >
              <Text
                className={`text-sm font-bold ${
                  segment === seg ? 'text-white' : 'text-[#8E8E93]'
                }`}
              >
                {seg === 'strength' ? 'Strength' : 'Cardio'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {segment === 'strength' ? (
          <>
            {/* Activity */}
            <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
              <Text className="text-white text-lg font-bold mb-3">Activity</Text>
              <ActivityHeatmap workouts={list} />
            </View>

            {/* Muscular Load */}
            <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-lg font-bold">Muscular Load</Text>
                <Ionicons name="options-outline" size={16} color="#8E8E93" />
              </View>
              <MuscularLoadChart slices={muscleLoad} />
            </View>

            {/* Strength Progression */}
            <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
              <Text className="text-white text-lg font-bold mb-1">Strength Progression</Text>
              <Text className="text-[#8E8E93] text-xs mb-2">Best est. 1RM per session</Text>
              {progression.length === 0 ? (
                <Text className="text-[#A0A0A0] text-sm py-3">
                  No strength sets in range — complete sets to see trends.
                </Text>
              ) : (
                progression.map((p) => (
                  <TouchableOpacity
                    key={p.exerciseName}
                    activeOpacity={0.7}
                    onPress={() =>
                      router.push(
                        `/exercise-detail?name=${encodeURIComponent(p.exerciseName)}`
                      )
                    }
                    className="flex-row items-center justify-between py-3 border-b border-[#1C1C1E] last:border-b-0"
                  >
                    <View className="flex-1 pr-3">
                      <Text className="text-white font-semibold" numberOfLines={1}>
                        {p.exerciseName}
                      </Text>
                      <Text className="text-[#8E8E93] text-xs">
                        {equipmentByExercise.get(p.exerciseName) ?? 'Exercise'} · {p.sessions}{' '}
                        session{p.sessions === 1 ? '' : 's'}
                        {p.trendPct !== null && (
                          <Text className={p.trendPct >= 0 ? 'text-[#4ADE80]' : 'text-[#FF8B94]'}>
                            {'  '}
                            {p.trendPct >= 0 ? '+' : ''}
                            {Math.round(p.trendPct)}%
                          </Text>
                        )}
                      </Text>
                    </View>
                    <Sparkline
                      points={p.points.map((kg) => displayWeight(kg, unit) ?? kg)}
                      color={p.trendPct !== null && p.trendPct < 0 ? '#FF8B94' : '#4ADE80'}
                    />
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color="#555"
                      style={{ marginLeft: 8 }}
                    />
                  </TouchableOpacity>
                ))
              )}
            </View>

            {/* Workout Templates */}
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-white text-lg font-bold">Workout Templates</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push('/routine-editor')}
                className="flex-row items-center"
              >
                <Ionicons name="add" size={18} color="#E63946" />
                <Text className="text-[#E63946] text-sm font-semibold ml-1">New</Text>
              </TouchableOpacity>
            </View>

            <LoadableContainer
              status={routinesStatus === 'empty' ? 'data' : routinesStatus}
              loadingMessage="Loading routines..."
              emptyIcon="barbell-outline"
              emptyTitle="No routines yet"
              emptySubtitle="Create a routine to see it here."
              error={error?.message}
            >
              {/* Quick workout template */}
              <TouchableOpacity
                className="bg-[#121212] rounded-[20px] p-4 mb-3 flex-row items-center justify-between"
                activeOpacity={0.8}
                onPress={() => startWorkout()}
              >
                <View>
                  <Text className="text-white font-bold">New Workout</Text>
                  <Text className="text-[#8E8E93] text-xs mt-0.5">
                    Blank session — add exercises as you go
                  </Text>
                </View>
                <View className="bg-[#E63946] rounded-xl px-4 py-2">
                  <Text className="text-white font-bold text-sm">Start</Text>
                </View>
              </TouchableOpacity>

              {routines?.map((routine) => (
                <View key={routine.id} className="bg-[#121212] rounded-[20px] p-4 mb-3">
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-1 pr-2">
                      <Text className="text-white text-lg font-bold" numberOfLines={1}>
                        {routine.name}
                      </Text>
                      <Text className="text-[#8E8E93] text-xs mt-0.5">
                        {routine.splits.length} split{routine.splits.length === 1 ? '' : 's'} ·{' '}
                        {routine.splits.reduce((n, s) => n + s.exercises.length, 0)} exercises
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => openRoutineMenu(routine.id, routine.name)}
                      activeOpacity={0.7}
                      accessibilityLabel={`routine-options-${routine.name}`}
                      className="p-1"
                    >
                      <Ionicons name="ellipsis-horizontal" size={20} color="#A0A0A0" />
                    </TouchableOpacity>
                  </View>
                  {routine.splits.map((split) => (
                    <View
                      key={split.id}
                      className="flex-row items-center justify-between py-2 border-t border-[#1C1C1E]"
                    >
                      <View className="flex-1 pr-3">
                        <Text className="text-white font-semibold">{split.name}</Text>
                        <Text className="text-[#A0A0A0] text-xs">
                          {split.exercises.length} exercise{split.exercises.length !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => startWorkout(routine.id, split.id)}
                        className="bg-[#E63946] rounded-xl px-4 py-2"
                      >
                        <Text className="text-white font-bold text-sm">Start</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ))}
            </LoadableContainer>
          </>
        ) : (
          <>
            {/* Cardio Load */}
            <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
              <View className="flex-row items-center mb-1">
                <Ionicons name="heart-outline" size={16} color={colors.cyan} />
                <Text className="text-[#A0A0A0] text-xs font-semibold ml-2 uppercase tracking-wide">
                  Cardio Load
                </Text>
              </View>
              <View className="flex-row items-end mb-3">
                <Text className="text-white text-4xl font-extrabold">{formatKm(cardio.dist)}</Text>
                <Text className="text-[#A0A0A0] text-sm ml-1.5 mb-1">km</Text>
                <Text className="text-[#00E5FF] text-sm font-bold ml-3 mb-1">{cardio.status}</Text>
              </View>
              <AreaChart points={cardio.dailyKm} />
              <Text className="text-[#555] text-[10px] mt-1">
                Daily distance · last {rangeDays} days
              </Text>
            </View>

            {/* Cardio Focus */}
            <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
              <View className="flex-row items-center mb-1">
                <Ionicons name="pulse-outline" size={16} color={colors.purple} />
                <Text className="text-[#A0A0A0] text-xs font-semibold ml-2 uppercase tracking-wide">
                  Cardio Focus
                </Text>
              </View>
              {cardio.totalSeconds <= 0 ? (
                <Text className="text-[#A0A0A0] text-sm py-2">No cardio sessions in range.</Text>
              ) : (
                <>
                  <View className="flex-row h-3 rounded-full overflow-hidden bg-[#1C1C1E] my-3">
                    {cardio.timeByType.map(([type, secs], i) => {
                      const palette = ['#00E5FF', '#B388FF', '#4ADE80', '#FFD600'];
                      return (
                        <View
                          key={type}
                          style={{
                            flex: secs / cardio.totalSeconds,
                            backgroundColor: palette[i % palette.length],
                          }}
                        />
                      );
                    })}
                  </View>
                  {cardio.timeByType.map(([type, secs], i) => {
                    const palette = ['#00E5FF', '#B388FF', '#4ADE80', '#FFD600'];
                    return (
                      <View key={type} className="flex-row items-center mb-1.5">
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: palette[i % palette.length],
                          }}
                        />
                        <Text className="text-[#A0A0A0] text-xs font-semibold ml-2 flex-1">
                          {type.charAt(0) + type.slice(1).toLowerCase()}
                        </Text>
                        <Text className="text-white text-xs font-bold">
                          {Math.round((secs / cardio.totalSeconds) * 100)}%
                        </Text>
                        <Text className="text-[#555] text-xs ml-2">{formatDuration(secs)}</Text>
                      </View>
                    );
                  })}
                </>
              )}
            </View>

            {/* Quick launchers */}
            <View className="flex-row items-center justify-between gap-x-2.5 mb-4">
              <TouchableOpacity
                activeOpacity={0.8}
                className="flex-1 bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl py-3 items-center"
                onPress={() => router.push('/cardio-tracker?type=run')}
              >
                <Ionicons name="fitness" size={22} color="#E63946" />
                <Text className="text-white font-bold text-xs mt-1">Run</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                className="flex-1 bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl py-3 items-center"
                onPress={() => router.push('/cardio-tracker?type=ride')}
              >
                <Ionicons name="bicycle" size={22} color="#38BDF8" />
                <Text className="text-white font-bold text-xs mt-1">Ride</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                className="flex-1 bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl py-3 items-center"
                onPress={() => router.push('/cardio-tracker?type=walk')}
              >
                <Ionicons name="walk" size={22} color="#4ADE80" />
                <Text className="text-white font-bold text-xs mt-1">Walk</Text>
              </TouchableOpacity>
            </View>

            {/* Recent cardio sessions */}
            <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
              <Text className="text-white text-lg font-bold mb-2">Recent activities</Text>
              {cardio.sessions.length === 0 ? (
                <Text className="text-[#A0A0A0] text-sm py-2">No activities in range.</Text>
              ) : (
                cardio.sessions.slice(0, 5).map((w) => (
                  <TouchableOpacity
                    key={w.id}
                    activeOpacity={0.7}
                    onPress={() => router.push(`/workout-detail?workoutId=${w.id}`)}
                    className="flex-row items-center justify-between py-3 border-b border-[#1C1C1E] last:border-b-0"
                  >
                    <View className="flex-1 pr-3">
                      <Text className="text-white font-semibold" numberOfLines={1}>
                        {w.title || w.workoutType}
                      </Text>
                      <Text className="text-[#A0A0A0] text-xs">
                        {new Date(w.completedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        · {formatDuration(w.durationSeconds)}
                      </Text>
                    </View>
                    <Text className="text-[#00E5FF] text-sm font-bold">
                      {formatKm(w.distanceMeters ?? 0)} km
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

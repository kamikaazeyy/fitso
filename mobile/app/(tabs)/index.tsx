import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { DatePickerStrip } from '@/components/DatePickerStrip';
import { OverloadLineChart, VolumeBarChart } from '@/components/ProgressCharts';
import { LoadableContainer } from '@/components/LoadableContainer';
import { useWorkouts } from '@/src/hooks/useWorkouts';
import { buildOverloadSeries, workoutReps, workoutVolume } from '@/src/utils/trainingStats';
import { useWorkoutSessionStore } from '@/src/store/useWorkoutSessionStore';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { displayWeight } from '@/src/utils/units';
import { useCardioSessionStore } from '@/src/store/useCardioSessionStore';
import { WorkoutSelectorModal } from '@/src/components';
import { colors } from '@/constants/theme';

function formatDuration(totalSeconds: number): string {
  return `${Math.floor(totalSeconds / 60)} min`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/** Monday 00:00 local time of the current week. */
function startOfWeek(): Date {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

export default function HomeScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showSelectorModal, setShowSelectorModal] = useState(false);
  const isWorkoutActive = useWorkoutSessionStore((s) => s.isActive);
  const unit = useSettingsStore((s) => s.weightUnit);
  const isCardioActive = useCardioSessionStore((s) => s.isActive);

  const { data: workouts, isLoading, error } = useWorkouts(50, 0);
  const status = isLoading ? 'loading' : error ? 'empty' : 'data';
  const list = useMemo(() => workouts ?? [], [workouts]);

  const weekStats = useMemo(() => {
    const start = startOfWeek();
    const thisWeek = list.filter((w) => new Date(w.completedAt) >= start);
    return {
      count: thisWeek.length,
      volume: thisWeek.reduce((sum, w) => sum + workoutVolume(w.sets), 0),
      reps: thisWeek.reduce((sum, w) => sum + workoutReps(w.sets), 0),
      minutes: thisWeek.reduce((sum, w) => sum + w.durationSeconds, 0) / 60,
    };
  }, [list]);

  // useWorkouts returns newest-first; charts read oldest → newest.
  const chronological = useMemo(() => [...list].reverse(), [list]);

  const sessionVolumes = useMemo(
    () =>
      chronological.slice(-8).map((w) => ({
        label: formatDate(w.completedAt),
        value: displayWeight(workoutVolume(w.sets), unit) ?? 0,
      })),
    [chronological, unit]
  );

  const overload = useMemo(() => {
    const recent = chronological.slice(-8);
    return {
      ...buildOverloadSeries(recent, unit),
      labels: recent.map((w) => formatDate(w.completedAt)),
    };
  }, [chronological, unit]);

  const recentWorkouts = useMemo(() => list.slice(0, 5), [list]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between pt-6 pb-4">
          <TouchableOpacity
            activeOpacity={0.85}
            className="flex-row items-center bg-[#E63946] rounded-full px-4 py-2.5"
            onPress={() => router.push('/(tabs)/journal')}
          >
            <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
            <Text className="text-white font-semibold text-sm ml-2">Explore</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            className="p-2"
            accessibilityLabel="Progress dashboard"
            onPress={() => router.push('/(tabs)/analytics')}
          >
            <Ionicons name="stats-chart" size={24} color="#E63946" />
          </TouchableOpacity>
        </View>

        {/* Date Picker Strip */}
        <View className="mb-5">
          <DatePickerStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        </View>

        <LoadableContainer
          status={status}
          loadingMessage="Loading training stats..."
          emptyIcon="barbell-outline"
          emptyTitle="No workouts yet"
          emptySubtitle="Finish your first workout to see stats here."
          error={error ? 'Failed to load workouts' : null}
        >
          {/* This week */}
          <View className="bg-[#121212] rounded-[24px] p-5 mb-4">
            <Text className="text-white text-lg font-bold mb-4">This week</Text>
            <View className="flex-row justify-between">
              <View className="items-center flex-1">
                <Ionicons name="flame" size={18} color={colors.cta} />
                <Text className="text-white text-2xl font-extrabold mt-1">{weekStats.count}</Text>
                <Text className="text-[#A0A0A0] text-xs font-medium">Workouts</Text>
              </View>
              <View className="items-center flex-1">
                <Ionicons name="barbell" size={18} color={colors.cyan} />
                <Text className="text-white text-2xl font-extrabold mt-1">
                  {formatNumber(displayWeight(weekStats.volume, unit) ?? 0)}
                </Text>
                <Text className="text-[#A0A0A0] text-xs font-medium">Volume ({unit})</Text>
              </View>
              <View className="items-center flex-1">
                <Ionicons name="time" size={18} color={colors.purple} />
                <Text className="text-white text-2xl font-extrabold mt-1">
                  {Math.round(weekStats.minutes)}
                </Text>
                <Text className="text-[#A0A0A0] text-xs font-medium">Minutes</Text>
              </View>
            </View>
          </View>

          {/* Session volume chart */}
          <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
            <Text className="text-white text-lg font-bold mb-3">Session Volume</Text>
            <VolumeBarChart data={sessionVolumes} />
          </View>

          {/* Strength trend */}
          <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
            <Text className="text-white text-lg font-bold mb-3">Est. 1RM Trend</Text>
            <OverloadLineChart series={overload.series} labels={overload.labels} />
          </View>
        </LoadableContainer>

        {/* Recent Sessions */}
        {recentWorkouts.length > 0 && (
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-white text-lg font-bold">Recent sessions</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push('/(tabs)/analytics')}
              >
                <Text className="text-[#E63946] text-sm font-semibold">Progress</Text>
              </TouchableOpacity>
            </View>
            <View className="bg-[#121212] rounded-[20px] px-4">
              {recentWorkouts.map((w) => (
                <TouchableOpacity
                  key={w.id}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/workout-detail?workoutId=${w.id}`)}
                  className="flex-row items-center justify-between py-3 border-b border-[#1C1C1E] last:border-b-0"
                >
                  <View className="flex-1 pr-3">
                    <Text className="text-white font-semibold" numberOfLines={1}>
                      {w.title || 'Workout'}
                    </Text>
                    <Text className="text-[#A0A0A0] text-xs">{formatDate(w.completedAt)}</Text>
                  </View>
                  <Text className="text-[#A0A0A0] text-sm">
                    {formatDuration(w.durationSeconds)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Start Workout / Activity CTA */}
        <TouchableOpacity
          activeOpacity={0.85}
          className="bg-[#E63946] rounded-[20px] flex-row items-center justify-center py-4 mb-4"
          onPress={() => {
            if (isCardioActive) {
              router.push('/cardio-tracker');
            } else if (isWorkoutActive) {
              router.push('/workout');
            } else {
              setShowSelectorModal(true);
            }
          }}
        >
          <Ionicons
            name={isCardioActive ? 'fitness' : 'barbell'}
            size={20}
            color="#FFFFFF"
          />
          <Text className="text-white font-bold text-base ml-2">
            {isCardioActive
              ? 'Resume Run / Activity'
              : isWorkoutActive
              ? 'Resume Workout'
              : 'Record Activity'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Workout Type Selector Modal */}
      <WorkoutSelectorModal
        visible={showSelectorModal}
        onClose={() => setShowSelectorModal(false)}
      />
    </SafeAreaView>
  );
}

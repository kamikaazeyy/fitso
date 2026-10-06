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
import { StatusRings } from '@/components/StatusRings';
import { DatePickerStrip } from '@/components/DatePickerStrip';
import { LoadableContainer } from '@/components/LoadableContainer';
import { useWorkouts } from '@/src/hooks/useWorkouts';
import { useRoutines } from '@/src/hooks/useRoutines';
import { coachMessage, computeTodayStats } from '@/src/utils/todayStats';
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

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

export default function HomeScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showSelectorModal, setShowSelectorModal] = useState(false);
  const isWorkoutActive = useWorkoutSessionStore((s) => s.isActive);
  const unit = useSettingsStore((s) => s.weightUnit);
  const isCardioActive = useCardioSessionStore((s) => s.isActive);

  const { data: workouts, isLoading, error } = useWorkouts(60, 0);
  const { data: routines } = useRoutines();
  const status = isLoading ? 'loading' : error ? 'empty' : 'data';
  const list = useMemo(() => workouts ?? [], [workouts]);

  const weeklyTarget = useMemo(
    () => Math.max(3, ...(routines ?? []).map((r) => r.splits.length)),
    [routines]
  );

  const isSelectedToday = useMemo(() => {
    const now = new Date();
    return (
      selectedDate.getFullYear() === now.getFullYear() &&
      selectedDate.getMonth() === now.getMonth() &&
      selectedDate.getDate() === now.getDate()
    );
  }, [selectedDate]);

  const today = useMemo(
    () => computeTodayStats(list, weeklyTarget, selectedDate),
    [list, weeklyTarget, selectedDate]
  );
  const coach = useMemo(() => coachMessage(today, unit), [today, unit]);

  // Day-wise view: sessions recorded on the selected day.
  const dayWorkouts = useMemo(() => {
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    return list.filter((w) => {
      const t = new Date(w.completedAt).getTime();
      return t >= dayStart.getTime() && t < dayEnd.getTime();
    });
  }, [list, selectedDate]);

  // Ring fills (0..1)
  const loadFill =
    today.avgWeekVolumeKg > 0
      ? Math.min(1, today.weekVolumeKg / today.avgWeekVolumeKg)
      : today.weekVolumeKg > 0
      ? 1
      : 0;
  const recoveryFill =
    today.hoursSinceLastWorkout === null ? 0 : Math.min(1, today.hoursSinceLastWorkout / 48);
  const consistencyFill = Math.min(1, today.sessionsThisWeek / today.weeklyTarget);

  const loadPct = Math.round(loadFill * 100);
  const recoveryPct =
    today.hoursSinceLastWorkout === null ? null : Math.round(recoveryFill * 100);
  const consistencyPct = Math.round(consistencyFill * 100);

  const maxDaily = Math.max(0, ...today.dailyVolumes.map((d) => d.value));
  const headerLabel = isSelectedToday
    ? `Today, ${selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
    : selectedDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — Bevel "Today" style */}
        <View className="flex-row items-center justify-between pt-6 pb-5">
          <Text className="text-white text-3xl font-extrabold tracking-tight">{headerLabel}</Text>
          <View className="flex-row items-center">
            {today.weekStreak > 0 && (
              <View className="flex-row items-center bg-[#1C1C1E] border border-[#2C2C2E] rounded-full px-3 py-1.5 mr-2">
                <Ionicons name="flame" size={14} color={colors.cta} />
                <Text className="text-white text-xs font-bold ml-1">
                  {today.weekStreak}w
                </Text>
              </View>
            )}
            <TouchableOpacity
              activeOpacity={0.8}
              className="w-9 h-9 rounded-full bg-[#1C1C1E] border border-[#2C2C2E] items-center justify-center"
              accessibilityLabel="Record activity"
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
              <Ionicons name="add" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Day picker — selects the day this screen reports on */}
        <View className="mb-5">
          <DatePickerStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        </View>

        <LoadableContainer
          status={status}
          loadingMessage="Loading today..."
          emptyIcon="barbell-outline"
          emptyTitle="No workouts yet"
          emptySubtitle="Finish your first workout to see your daily status here."
          error={error ? 'Failed to load workouts' : null}
        >
          {/* Status rings */}
          <View className="bg-[#121212] rounded-[24px] p-5 mb-4">
            <StatusRings
              load={loadFill}
              loadValue={`${loadPct}%`}
              loadSublabel="of typical week"
              recovery={recoveryFill}
              recoveryValue={recoveryPct === null ? '—' : `${recoveryPct}%`}
              recoverySublabel={
                today.hoursSinceLastWorkout === null
                  ? 'no sessions yet'
                  : `${formatHours(today.hoursSinceLastWorkout)} rest`
              }
              consistency={consistencyFill}
              consistencyValue={`${consistencyPct}%`}
              consistencySublabel={`${today.sessionsThisWeek} of ${today.weeklyTarget} sessions`}
            />
          </View>

          {/* Coaching */}
          <View className="mb-4">
            <Text className="text-[#8E8E93] text-[11px] font-bold tracking-widest mb-1.5">
              COACHING
            </Text>
            <Text className="text-[#A0A0A0] text-sm leading-5">{coach}</Text>
          </View>

          {/* This week's activity */}
          <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
            <View className="flex-row items-center mb-1">
              <View className="w-2 h-2 rounded-full bg-[#4ADE80] mr-2" />
              <Text className="text-white font-bold">This week's volume</Text>
            </View>
            <Text className="text-[#A0A0A0] text-xs mb-4">
              {today.trainedToday
                ? `${formatNumber(displayWeight(today.todayVolumeKg, unit) ?? 0)} ${unit} moved ${
                    isSelectedToday ? 'today' : 'that day'
                  }`
                : isSelectedToday
                ? 'Rest day so far'
                : 'Rest day'}
            </Text>
            <View className="flex-row items-end h-16">
              {today.dailyVolumes.map((d, i) => {
                const h = maxDaily > 0 ? Math.max(8, (d.value / maxDaily) * 56) : 8;
                return (
                  <View key={i} className="flex-1 items-center">
                    <View
                      style={{
                        width: 14,
                        height: h,
                        borderRadius: 4,
                        backgroundColor: d.isToday ? colors.cta : '#2C2C2E',
                      }}
                    />
                    <Text
                      className={`text-[10px] mt-1.5 font-semibold ${
                        d.isToday ? 'text-white' : 'text-[#555]'
                      }`}
                    >
                      {d.label}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View className="flex-row items-center mt-3 pt-3 border-t border-[#1C1C1E]">
              <Ionicons name="barbell" size={14} color={colors.cyan} />
              <Text className="text-white text-xs font-bold ml-1.5">
                {formatNumber(displayWeight(today.weekVolumeKg, unit) ?? 0)} {unit}
              </Text>
              <Text className="text-[#8E8E93] text-xs ml-1.5">total this week</Text>
            </View>
          </View>

          {/* Sessions on the selected day */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-white text-lg font-bold">
                {isSelectedToday ? "Today's sessions" : 'Sessions'}
              </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push('/(tabs)/analytics')}
              >
                <Text className="text-[#E63946] text-sm font-semibold">Progress</Text>
              </TouchableOpacity>
            </View>
            {dayWorkouts.length === 0 ? (
              <View className="bg-[#121212] rounded-[20px] px-4 py-5">
                <Text className="text-[#A0A0A0] text-sm">No sessions this day.</Text>
              </View>
            ) : (
              <View className="bg-[#121212] rounded-[20px] px-4">
                {dayWorkouts.map((w) => (
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
            )}
          </View>
        </LoadableContainer>

        {/* Record Activity CTA */}
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

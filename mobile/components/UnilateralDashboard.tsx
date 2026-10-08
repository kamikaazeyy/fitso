import React, { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { OverloadLineChart, SideVolumeBarChart } from '@/components/ProgressCharts';
import type { WorkoutWithSets } from '@/src/hooks/useWorkouts';
import {
  computeImbalance,
  sideVolumesInWindow,
  unilateralSessions,
} from '@/src/utils/unilateralStats';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { displayWeight } from '@/src/utils/units';
import { colors } from '@/constants/theme';

/**
 * The "Unilateral Data" subsection of the global Progress tab: reads only
 * sets logged with execution_mode = UNILATERAL and renders side-vs-side
 * analytics — an imbalance alert, a per-side volume trend (two separate
 * lines, never combined) and a per-session L/R bar matchup.
 */
export function UnilateralDashboard({ workouts }: { workouts: WorkoutWithSets[] }) {
  const unit = useSettingsStore((s) => s.weightUnit);

  const window28 = useMemo(() => sideVolumesInWindow(workouts, 28), [workouts]);
  const imbalance = useMemo(() => computeImbalance(window28), [window28]);
  const sessions = useMemo(() => unilateralSessions(workouts, 12), [workouts]);

  // Volume gap over time — two distinct lines so the gap stays visible.
  const gapSeries = useMemo(
    () => ({
      labels: sessions.map((s) => s.label),
      series: [
        {
          name: 'Left',
          color: colors.cyan,
          points: sessions.map((s) => displayWeight(s.left, unit) ?? 0),
        },
        {
          name: 'Right',
          color: colors.cta,
          points: sessions.map((s) => displayWeight(s.right, unit) ?? 0),
        },
      ],
    }),
    [sessions, unit]
  );

  const matchup = useMemo(
    () =>
      sessions.map((s) => ({
        label: s.label,
        left: displayWeight(s.left, unit) ?? 0,
        right: displayWeight(s.right, unit) ?? 0,
      })),
    [sessions, unit]
  );

  const hasData = window28.setCount > 0 || sessions.length > 0;

  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
      {!hasData ? (
        <View className="bg-[#121212] rounded-[20px] p-6 items-center">
          <Ionicons name="swap-horizontal-outline" size={28} color={colors.cyan} />
          <Text className="text-white text-base font-bold mt-3">No unilateral sets yet</Text>
          <Text className="text-[#A0A0A0] text-xs mt-1 text-center">
            Toggle an exercise to Unilateral mode during a workout to start tracking
            left-vs-right volume.
          </Text>
        </View>
      ) : (
        <>
          {/* Imbalance alert — weaker side volume gap > 5% over 4 weeks */}
          {imbalance && (
            <View className="bg-[#2A1A1B] border border-[#E63946]/40 rounded-[20px] p-4 mb-4 flex-row items-start">
              <Ionicons name="warning" size={18} color={colors.cta} />
              <View className="flex-1 ml-3">
                <Text className="text-white font-bold text-sm">Imbalance Alert</Text>
                <Text className="text-[#D0A0A3] text-xs mt-1 leading-4">
                  Your {imbalance.weakerSide} side is pushing{' '}
                  {Math.round(imbalance.gapPct)}% less total volume.
                </Text>
              </View>
            </View>
          )}

          {/* 4-week L/R totals */}
          <View className="flex-row justify-between mb-4">
            <View className="w-[48%] bg-[#121212] rounded-[20px] p-4">
              <Ionicons name="arrow-back-circle-outline" size={20} color={colors.cyan} />
              <Text className="text-white text-2xl font-extrabold mt-2">
                {Math.round(displayWeight(window28.left, unit) ?? 0).toLocaleString()}
              </Text>
              <Text className="text-[#A0A0A0] text-xs font-medium">Left Volume · 4w ({unit})</Text>
            </View>
            <View className="w-[48%] bg-[#121212] rounded-[20px] p-4">
              <Ionicons name="arrow-forward-circle-outline" size={20} color={colors.cta} />
              <Text className="text-white text-2xl font-extrabold mt-2">
                {Math.round(displayWeight(window28.right, unit) ?? 0).toLocaleString()}
              </Text>
              <Text className="text-[#A0A0A0] text-xs font-medium">Right Volume · 4w ({unit})</Text>
            </View>
          </View>

          {/* Gap chart — L and R as two lines over time */}
          <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
            <Text className="text-white text-lg font-bold mb-3">Left vs Right Gap</Text>
            <OverloadLineChart series={gapSeries.series} labels={gapSeries.labels} />
          </View>

          {/* Session matchup — paired bars per session */}
          <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
            <Text className="text-white text-lg font-bold mb-3">Session Matchup</Text>
            <SideVolumeBarChart data={matchup} />
          </View>
        </>
      )}
    </ScrollView>
  );
}

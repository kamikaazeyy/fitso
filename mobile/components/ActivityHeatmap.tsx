import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import type { WorkoutWithSets } from '@/src/hooks/useWorkouts';

const CELL = 11;
const GAP = 3;
const COLORS = ['#1C1C1E', '#14532D', '#166534', '#22C55E']; // 0, 1, 2, 3+ activities
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** GitHub-style activity grid — one column per week, Mon→Sun rows, ~10 weeks back. */
export function ActivityHeatmap({ workouts, weeks = 10 }: { workouts: WorkoutWithSets[]; weeks?: number }) {
  const columns = useMemo(() => {
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;

    // Monday of the current week
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));

    const countByDay = new Map<number, number>();
    for (const w of workouts) {
      const d = new Date(w.completedAt);
      d.setHours(0, 0, 0, 0);
      countByDay.set(d.getTime(), (countByDay.get(d.getTime()) ?? 0) + 1);
    }

    const cols: number[][] = [];
    for (let wIdx = weeks - 1; wIdx >= 0; wIdx--) {
      const col: number[] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(weekStart.getTime() - wIdx * 7 * dayMs + d * dayMs);
        col.push(day.getTime() > now.getTime() ? -1 : countByDay.get(day.getTime()) ?? 0);
      }
      cols.push(col);
    }
    return cols;
  }, [workouts, weeks]);

  return (
    <View>
      <View className="flex-row">
        <View style={{ width: 14, marginRight: 4 }}>
          {DAY_LETTERS.map((l, i) => (
            <Text
              key={i}
              className="text-[#555]"
              style={{ fontSize: 8, height: CELL + GAP, textAlign: 'center' }}
            >
              {i % 2 === 0 ? l : ''}
            </Text>
          ))}
        </View>
        {columns.map((col, ci) => (
          <View key={ci} style={{ marginRight: GAP }}>
            {col.map((count, di) => (
              <View
                key={di}
                style={{
                  width: CELL,
                  height: CELL,
                  borderRadius: 3,
                  marginBottom: GAP,
                  backgroundColor:
                    count < 0 ? 'transparent' : COLORS[Math.min(count, 3)],
                }}
              />
            ))}
          </View>
        ))}
      </View>
      <View className="flex-row items-center justify-end mt-2">
        <Text className="text-[#555] text-[9px] mr-1.5">Less</Text>
        {COLORS.map((c, i) => (
          <View
            key={i}
            style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: c, marginRight: 3 }}
          />
        ))}
        <Text className="text-[#555] text-[9px]">More</Text>
      </View>
    </View>
  );
}

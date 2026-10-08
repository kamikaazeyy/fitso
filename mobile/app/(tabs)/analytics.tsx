import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WorkoutDashboard } from '@/components/WorkoutDashboard';
import { UnilateralDashboard } from '@/components/UnilateralDashboard';
import { useWorkouts } from '@/src/hooks/useWorkouts';
import { colors } from '@/constants/theme';

type DataView = 'BILATERAL' | 'UNILATERAL';

export default function ProgressScreen() {
  const { data, isLoading, error } = useWorkouts(50, 0);
  const [view, setView] = useState<DataView>('BILATERAL');

  // Empty data still renders the dashboard — charts and stat cards handle
  // zero-state themselves so the screen isn't blank for new users.
  const status = isLoading ? 'loading' : error ? 'empty' : 'data';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View className="px-4 pt-6 pb-4">
        <Text className="text-white text-3xl font-extrabold tracking-tight">Progress</Text>
        <Text className="text-[#A0A0A0] text-sm mt-1">Volume, PRs and progressive overload.</Text>

        {/* Bilateral vs Unilateral data view switch */}
        <View
          className="flex-row self-start rounded-xl bg-[#1C1C1E] p-1 mt-4"
          accessibilityLabel="progress-view-toggle"
        >
          {(['BILATERAL', 'UNILATERAL'] as const).map((mode) => {
            const active = view === mode;
            return (
              <TouchableOpacity
                key={mode}
                activeOpacity={0.8}
                accessibilityLabel={`progress-view-${mode.toLowerCase()}`}
                onPress={() => setView(mode)}
                className={`px-4 py-2 rounded-lg ${active ? 'bg-[#E63946]' : ''}`}
              >
                <Text
                  className={
                    active
                      ? 'text-white text-xs font-bold'
                      : 'text-[#A0A0A0] text-xs font-semibold'
                  }
                >
                  {mode === 'BILATERAL' ? 'Bilateral Data' : 'Unilateral Data'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View className="flex-1 px-4 pb-4">
        {view === 'BILATERAL' ? (
          <WorkoutDashboard
            data={data}
            status={status}
            error={error?.message || null}
          />
        ) : (
          <UnilateralDashboard workouts={data ?? []} />
        )}
      </View>
    </SafeAreaView>
  );
}

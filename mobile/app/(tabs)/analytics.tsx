import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WorkoutDashboard } from '@/components/WorkoutDashboard';
import { useWorkouts } from '@/src/hooks/useWorkouts';
import { colors } from '@/constants/theme';

export default function ProgressScreen() {
  const { data, isLoading, error } = useWorkouts(50, 0);

  const status = isLoading ? 'loading' : error || !data || data.length === 0 ? 'empty' : 'data';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View className="px-4 pt-6 pb-4">
        <Text className="text-white text-3xl font-extrabold tracking-tight">Progress</Text>
        <Text className="text-[#A0A0A0] text-sm mt-1">Volume, PRs and progressive overload.</Text>
      </View>

      <View className="flex-1 px-4 pb-4">
        <WorkoutDashboard
          data={data}
          status={status}
          error={error?.message || null}
        />
      </View>
    </SafeAreaView>
  );
}

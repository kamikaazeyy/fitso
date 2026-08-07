import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/theme';
import { useLoadableData } from '@/hooks/useLoadableData';
import { LoadableContainer } from '@/components/LoadableContainer';

interface TodayPlan {
  name: string;
  duration: string;
  exercises: string[];
}

interface RecentWorkout {
  id: string;
  name: string;
  date: string;
  duration: string;
}

interface WeeklyStats {
  workouts: number;
  volume: string;
}

async function fetchTodayPlan(): Promise<TodayPlan | null> {
  return Promise.resolve({
    name: 'Late Night Legs',
    duration: '45 min',
    exercises: ['Barbell Squat', 'Leg Extension'],
  });
}

async function fetchRecentWorkouts(): Promise<RecentWorkout[]> {
  return Promise.resolve([
    {
      id: '1',
      name: 'Upper Body Power',
      date: 'Mon, May 19',
      duration: '52 min',
    },
    {
      id: '2',
      name: 'Lower Body Strength',
      date: 'Sat, May 17',
      duration: '48 min',
    },
    {
      id: '3',
      name: 'Full Body Conditioning',
      date: 'Thu, May 15',
      duration: '65 min',
    },
  ]);
}

async function fetchWeeklyStats(): Promise<WeeklyStats> {
  return Promise.resolve({
    workouts: 4,
    volume: '12,400 kg',
  });
}

export default function TrainingScreen() {
  const router = useRouter();

  const plan = useLoadableData<TodayPlan | null>(fetchTodayPlan, [], {
    loadingDelay: 600,
  });

  const workouts = useLoadableData<RecentWorkout[]>(fetchRecentWorkouts, [], {
    loadingDelay: 600,
  });

  const stats = useLoadableData<WeeklyStats>(fetchWeeklyStats, [], {
    loadingDelay: 500,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-6 pb-4">
          <Text className="text-white text-3xl font-extrabold tracking-tight">
            Training
          </Text>
          <Text className="text-[#A0A0A0] text-sm mt-1">
            Plan, log, and crush your workouts.
          </Text>
        </View>

        <TouchableOpacity
          className="bg-[#E63946] rounded-[24px] p-5 flex-row items-center justify-between"
          activeOpacity={0.8}
          onPress={() => router.push('/workout')}
        >
          <View className="flex-row items-center">
            <Ionicons name="barbell" size={28} color="#FFFFFF" />
            <Text className="text-white text-xl font-extrabold ml-3">
              Start Workout
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <Text className="text-white text-lg font-bold mt-6 mb-3">
          Today's Plan
        </Text>
        <LoadableContainer
          status={plan.status}
          loadingMessage="Loading today's plan..."
          emptyIcon="barbell-outline"
          emptyTitle="No workout planned"
          emptySubtitle="Start a workout to see today's plan."
          error={plan.error}
          onRetry={plan.retry}
        >
          {plan.data && (
            <View className="bg-[#121212] rounded-[20px] p-4">
              <View className="flex-row items-center">
                <View className="bg-[#E63946] w-2 h-2 rounded-full mr-2" />
                <Text className="text-white font-bold">{plan.data.name}</Text>
              </View>
              <Text className="text-[#A0A0A0] text-sm mt-1">
                {plan.data.duration} · {plan.data.exercises.join(', ')}
              </Text>
            </View>
          )}
        </LoadableContainer>

        <Text className="text-white text-lg font-bold mt-6 mb-3">
          Recent Workouts
        </Text>
        <LoadableContainer
          status={workouts.status}
          loadingMessage="Loading workouts..."
          emptyIcon="time-outline"
          emptyTitle="No recent workouts"
          emptySubtitle="Your completed workouts will appear here."
          error={workouts.error}
          onRetry={workouts.retry}
        >
          {workouts.data?.map((workout, index, arr) => (
            <View
              key={workout.id}
              className={`bg-[#121212] rounded-[20px] p-4 flex-row items-center justify-between ${
                index < arr.length - 1 ? 'mb-3' : ''
              }`}
            >
              <View className="flex-row items-center">
                <View className="bg-[#1C1C1E] rounded-lg w-10 h-10 items-center justify-center mr-3">
                  <Ionicons name="barbell" size={18} color="#E63946" />
                </View>
                <View>
                  <Text className="text-white font-bold">{workout.name}</Text>
                  <Text className="text-[#A0A0A0] text-xs">{workout.date}</Text>
                </View>
              </View>
              <Text className="text-[#A0A0A0] text-sm">{workout.duration}</Text>
            </View>
          ))}
        </LoadableContainer>

        <Text className="text-white text-lg font-bold mt-6 mb-3">
          Weekly Stats
        </Text>
        <LoadableContainer
          status={stats.status}
          loadingMessage="Loading stats..."
          emptyIcon="stats-chart-outline"
          emptyTitle="No stats yet"
          emptySubtitle="Complete workouts to see weekly stats."
          error={stats.error}
          onRetry={stats.retry}
        >
          {stats.data && (
            <View className="flex-row">
              <View className="flex-1 mr-3">
                <View className="bg-[#121212] rounded-[20px] p-4">
                  <Text className="text-[#A0A0A0] text-sm">Workouts</Text>
                  <Text className="text-white text-xl font-bold mt-1">
                    {stats.data.workouts}
                  </Text>
                </View>
              </View>
              <View className="flex-1">
                <View className="bg-[#121212] rounded-[20px] p-4">
                  <Text className="text-[#A0A0A0] text-sm">Volume</Text>
                  <Text className="text-white text-xl font-bold mt-1">
                    {stats.data.volume}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </LoadableContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

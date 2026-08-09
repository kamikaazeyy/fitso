import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/theme';
import { useRoutines } from '@/src/hooks/useRoutines';
import { LoadableContainer } from '@/components/LoadableContainer';

export default function TrainingScreen() {
  const router = useRouter();
  const { data: routines, isLoading, error } = useRoutines();

  const status = isLoading ? 'loading' : error || !routines || routines.length === 0 ? 'empty' : 'data';

  const startWorkout = (routineId?: string, splitId?: string) => {
    if (routineId && splitId) {
      router.push(`/workout?routineId=${routineId}&splitId=${splitId}`);
    } else {
      router.push('/workout');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-6 pb-4">
          <Text className="text-white text-3xl font-extrabold tracking-tight">Training</Text>
          <Text className="text-[#A0A0A0] text-sm mt-1">Pick a routine and start lifting.</Text>
        </View>

        <TouchableOpacity
          className="bg-[#E63946] rounded-[24px] p-5 flex-row items-center justify-between mb-5"
          activeOpacity={0.8}
          onPress={() => startWorkout()}
        >
          <View className="flex-row items-center">
            <Ionicons name="barbell" size={28} color="#FFFFFF" />
            <Text className="text-white text-xl font-extrabold ml-3">Quick Workout</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-white text-lg font-bold">Your Routines</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/create-routine')}
            className="flex-row items-center"
          >
            <Ionicons name="add" size={18} color="#E63946" />
            <Text className="text-[#E63946] text-sm font-semibold ml-1">New</Text>
          </TouchableOpacity>
        </View>

        <LoadableContainer
          status={status}
          loadingMessage="Loading routines..."
          emptyIcon="barbell-outline"
          emptyTitle="No routines yet"
          emptySubtitle="Create a routine to see it here."
          error={error?.message}
        >
          {routines &&
            routines.map((routine) => (
              <View
                key={routine.id}
                className="bg-[#121212] rounded-[20px] p-4 mb-3"
              >
                <Text className="text-white text-lg font-bold mb-3">{routine.name}</Text>
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
      </ScrollView>
    </SafeAreaView>
  );
}

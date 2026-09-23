import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/theme';
import { useRoutines } from '@/src/hooks/useRoutines';
import { useRoutineMutations } from '@/src/hooks/useRoutineMutations';
import { useAuth } from '@/context/AuthContext';
import { useWorkoutSessionStore } from '@/src/store/useWorkoutSessionStore';
import { LoadableContainer } from '@/components/LoadableContainer';

export default function TrainingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: routines, isLoading, error } = useRoutines();
  const { deleteRoutine, duplicateRoutine } = useRoutineMutations();
  const isWorkoutActive = useWorkoutSessionStore((s) => s.isActive);
  const activeTitle = useWorkoutSessionStore((s) => s.title);
  const discardWorkout = useWorkoutSessionStore((s) => s.discardWorkout);

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

  const status = isLoading ? 'loading' : error || !routines || routines.length === 0 ? 'empty' : 'data';

  const startWorkout = (routineId?: string, splitId?: string) => {
    const target =
      routineId && splitId ? `/workout?routineId=${routineId}&splitId=${splitId}` : '/workout';

    if (!isWorkoutActive) {
      router.push(target);
      return;
    }

    // A session is already running — don't silently resume it when the user
    // tapped "Start" on a different routine.
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

        {isWorkoutActive && (
          <TouchableOpacity
            className="bg-[#121212] border border-[#E63946] rounded-[20px] p-4 mb-5 flex-row items-center justify-between"
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
            onPress={() => router.push('/routine-editor')}
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
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-white text-lg font-bold flex-1" numberOfLines={1}>
                    {routine.name}
                  </Text>
                  <TouchableOpacity
                    onPress={() => openRoutineMenu(routine.id, routine.name)}
                    activeOpacity={0.7}
                    accessibilityLabel={`routine-options-${routine.name}`}
                    className="p-1 ml-2"
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
      </ScrollView>
    </SafeAreaView>
  );
}

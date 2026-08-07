import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLoadableData } from '@/hooks/useLoadableData';
import { LoadableContainer } from '@/components/LoadableContainer';
import { useWorkout } from '@/context/WorkoutContext';

interface Set {
  id: string;
  number: number;
  previous: string;
  weight: string;
  reps: string;
  isCompleted: boolean;
}

interface Exercise {
  id: string;
  name: string;
  sets: Set[];
}

interface Workout {
  title: string;
  duration: string;
  exercises: Exercise[];
}

const DUMMY_WORKOUT: Workout = {
  title: 'Late Night Legs',
  duration: '45:12',
  exercises: [
    {
      id: 'e1',
      name: 'Barbell Squat',
      sets: [
        { id: 's1', number: 1, previous: '100kg x 8', weight: '100', reps: '8', isCompleted: true },
        { id: 's2', number: 2, previous: '105kg x 6', weight: '105', reps: '6', isCompleted: false },
        { id: 's3', number: 3, previous: '105kg x 6', weight: '', reps: '', isCompleted: false },
      ],
    },
    {
      id: 'e2',
      name: 'Leg Extension',
      sets: [
        { id: 's4', number: 1, previous: '60kg x 12', weight: '65', reps: '10', isCompleted: false },
      ],
    },
  ],
};

export default function WorkoutScreen() {
  const router = useRouter();
  const { data: loadedWorkout, status, error, retry } = useLoadableData<Workout>(
    () => Promise.resolve(DUMMY_WORKOUT),
    [],
    { loadingDelay: 600 }
  );
  const [workout, setWorkout] = useState<Workout | null>(null);

  useEffect(() => {
    if (loadedWorkout) {
      setWorkout(loadedWorkout);
    }
  }, [loadedWorkout]);

  const toggleSetCompleted = (exerciseId: string, setId: string) => {
    setWorkout((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex) =>
          ex.id === exerciseId
            ? {
                ...ex,
                sets: ex.sets.map((s) =>
                  s.id === setId ? { ...s, isCompleted: !s.isCompleted } : s
                ),
              }
            : ex
        ),
      };
    });
  };

  const updateSet = (exerciseId: string, setId: string, field: 'weight' | 'reps', value: string) => {
    setWorkout((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex) =>
          ex.id === exerciseId
            ? {
                ...ex,
                sets: ex.sets.map((s) =>
                  s.id === setId ? { ...s, [field]: value } : s
                ),
              }
            : ex
        ),
      };
    });
  };

  const addSet = (exerciseId: string) => {
    setWorkout((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex) => {
          if (ex.id !== exerciseId) return ex;
          const lastSet = ex.sets[ex.sets.length - 1];
          const newSet: Set = {
            id: `s${Date.now()}`,
            number: ex.sets.length + 1,
            previous: lastSet ? `${lastSet.weight}kg x ${lastSet.reps}` : '',
            weight: '',
            reps: '',
            isCompleted: false,
          };
          return { ...ex, sets: [...ex.sets, newSet] };
        }),
      };
    });
  };

  const addExercise = useCallback((name: string) => {
    setWorkout((prev) => {
      if (!prev) return prev;
      const timestamp = Date.now();
      const newExercise: Exercise = {
        id: `e${timestamp}`,
        name,
        sets: [
          {
            id: `s${timestamp}`,
            number: 1,
            previous: '',
            weight: '',
            reps: '',
            isCompleted: false,
          },
        ],
      };
      return { ...prev, exercises: [...prev.exercises, newExercise] };
    });
  }, []);

  const { pendingExercise, consumePendingExercise } = useWorkout();
  useEffect(() => {
    const exercise = consumePendingExercise();
    if (exercise) {
      addExercise(exercise.name);
    }
  }, [pendingExercise, consumePendingExercise]);

  const headerTitle =
    status === 'loading'
      ? 'Loading...'
      : status === 'error'
      ? 'Workout unavailable'
      : status === 'empty'
      ? 'Workout'
      : workout?.title ?? 'Workout';

  const headerDuration =
    status === 'loading'
      ? '—'
      : status === 'error'
      ? 'Could not load workout'
      : status === 'empty'
      ? 'No exercises'
      : workout?.duration ?? '—';

  return (
    <SafeAreaView className="flex-1 bg-black">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
        keyboardVerticalOffset={0}
      >
        {/* Sticky Header */}
        <View className="flex-row items-center justify-between px-4 py-4 bg-black">
          <View className="flex-row items-center flex-1">
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.7}
              className="mr-3 p-2 rounded-full bg-[#1C1C1E]"
            >
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-white text-lg font-extrabold tracking-tight">
                {headerTitle}
              </Text>
              <Text className="text-[#A0A0A0] text-sm font-medium">{headerDuration}</Text>
            </View>
          </View>
          <TouchableOpacity
            activeOpacity={0.85}
            className="bg-[#E63946] rounded-xl px-5 py-2.5"
            onPress={() => router.back()}
          >
            <Text className="text-white font-bold text-sm">Finish</Text>
          </TouchableOpacity>
        </View>

        {/* Scrollable Exercise Cards */}
        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <LoadableContainer
            status={status}
            loadingMessage="Loading workout..."
            emptyIcon="barbell-outline"
            emptyTitle="No exercises yet"
            emptySubtitle="Add an exercise to start your workout."
            error={error}
            errorTitle="Couldn't load your workout"
            onRetry={retry}
          >
            {status === 'data' && workout && (
              <>
                {workout.exercises.map((exercise, exIndex) => (
                  <View
                    key={exercise.id}
                    className="bg-[#121212] rounded-[20px] p-4 mb-3"
                    style={exIndex === 0 ? { marginTop: 4 } : undefined}
                  >
                    {/* Exercise Name */}
                    <Text className="text-white text-lg font-bold mb-4">
                      {exercise.name}
                    </Text>

                    {/* Column Headers */}
                    <View className="flex-row items-center mb-3 px-1">
                      <Text className="text-[#A0A0A0] text-xs font-semibold w-10">Set</Text>
                      <Text className="text-[#A0A0A0] text-xs font-semibold flex-1">Previous</Text>
                      <Text className="text-[#A0A0A0] text-xs font-semibold w-16 text-center">kg</Text>
                      <Text className="text-[#A0A0A0] text-xs font-semibold w-16 text-center">Reps</Text>
                      <View className="w-10 items-center">
                        <Ionicons name="checkmark" size={14} color="#A0A0A0" />
                      </View>
                    </View>

                    {/* Set Rows */}
                    {exercise.sets.map((set) => (
                      <View
                        key={set.id}
                        className={`flex-row items-center mb-2 ${set.isCompleted ? 'opacity-40' : ''}`}
                      >
                        {/* Set Number */}
                        <View className="w-10 h-10 rounded-lg bg-[#1C1C1E] items-center justify-center">
                          <Text className="text-white text-sm font-bold">{set.number}</Text>
                        </View>

                        {/* Previous */}
                        <Text className="text-[#A0A0A0] text-sm font-medium flex-1 px-2">
                          {set.previous}
                        </Text>

                        {/* Weight Input */}
                        <TextInput
                          value={set.weight}
                          onChangeText={(val) => updateSet(exercise.id, set.id, 'weight', val)}
                          keyboardType="numeric"
                          placeholder="—"
                          placeholderTextColor="#555"
                          className="w-16 h-10 bg-[#1C1C1E] rounded-lg text-white text-center text-sm font-semibold mr-2 px-2"
                        />

                        {/* Reps Input */}
                        <TextInput
                          value={set.reps}
                          onChangeText={(val) => updateSet(exercise.id, set.id, 'reps', val)}
                          keyboardType="numeric"
                          placeholder="—"
                          placeholderTextColor="#555"
                          className="w-16 h-10 bg-[#1C1C1E] rounded-lg text-white text-center text-sm font-semibold mr-2 px-2"
                        />

                        {/* Checkmark Toggle */}
                        <TouchableOpacity
                          onPress={() => toggleSetCompleted(exercise.id, set.id)}
                          activeOpacity={0.7}
                          className={`w-10 h-10 rounded-lg items-center justify-center ${
                            set.isCompleted ? 'bg-[#4ADE80]' : 'bg-[#1C1C1E]'
                          }`}
                        >
                          <Ionicons
                            name="checkmark"
                            size={18}
                            color={set.isCompleted ? '#000000' : '#555'}
                          />
                        </TouchableOpacity>
                      </View>
                    ))}

                    {/* Add Set Button */}
                    <TouchableOpacity
                      onPress={() => addSet(exercise.id)}
                      activeOpacity={0.7}
                      className="flex-row items-center justify-center mt-2 py-3 rounded-xl bg-[#1C1C1E]"
                    >
                      <Ionicons name="add" size={18} color="#E63946" />
                      <Text className="text-[#E63946] font-semibold text-sm ml-2">Add Set</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </LoadableContainer>

          {/* Add Exercise Button */}
          <TouchableOpacity
            activeOpacity={0.7}
            className="flex-row items-center justify-center py-4 rounded-[20px] bg-[#121212] border border-[#2C2C2E] mb-3"
            onPress={() => router.push('/exercise-picker')}
          >
            <Ionicons name="add" size={20} color="#E63946" />
            <Text className="text-[#E63946] font-bold text-base ml-2">Add Exercise</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LoadableContainer } from '@/components/LoadableContainer';
import { AttachmentPicker } from '@/components/AttachmentPicker';
import { useWorkout, type PendingExercise } from '@/context/WorkoutContext';
import { getAttachmentsForEquipment } from '@/constants/attachments';
import { client } from '@/src/api/client';

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
  wgerId?: number;
  equipment: string[];
  attachment: string;
  sets: Set[];
}

interface Workout {
  title: string;
  durationSeconds: number;
  exercises: Exercise[];
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function WorkoutScreen() {
  const router = useRouter();
  const { splitId, routineId } = useLocalSearchParams<{ splitId?: string; routineId?: string }>();
  const { pendingExercise, consumePendingExercise } = useWorkout();

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [pickingExerciseId, setPickingExerciseId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load split or start empty
  useEffect(() => {
    if (!splitId || !routineId) {
      setWorkout({ title: 'Workout', durationSeconds: 0, exercises: [] });
      setIsLoading(false);
      return;
    }

    client
      .get(`/api/routines/${routineId}`)
      .then(({ data }) => {
        const split = data?.splits?.find((s: any) => s.id === splitId);
        if (!split) {
          setError('Split not found');
          setIsLoading(false);
          return;
        }

        const exercises: Exercise[] = (split.exercises || []).map((ex: any, idx: number) => {
          const attachments = getAttachmentsForEquipment(ex.equipment || []);
          const defaultAttachment = ex.attachment || attachments[0]?.name || 'No attachment';
          return {
            id: `e-${Date.now()}-${idx}`,
            name: ex.exerciseName,
            wgerId: ex.wgerId,
            equipment: ex.equipment || [],
            attachment: defaultAttachment,
            sets: [
              {
                id: `s-${Date.now()}-${idx}`,
                number: 1,
                previous: '',
                weight: '',
                reps: '',
                isCompleted: false,
              },
            ],
          };
        });

        setWorkout({
          title: `${data.name} - ${split.name}`,
          durationSeconds: 0,
          exercises,
        });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load split');
      })
      .finally(() => setIsLoading(false));
  }, [splitId, routineId]);

  // Timer
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);

  // Consume exercise added from picker
  const addExercise = useCallback((pending: PendingExercise) => {
    setWorkout((prev) => {
      if (!prev) return prev;
      const timestamp = Date.now();
      const attachments = getAttachmentsForEquipment(pending.equipment);
      const defaultAttachment = attachments[0]?.name || 'No attachment';
      const newExercise: Exercise = {
        id: `e-${timestamp}`,
        name: pending.name,
        wgerId: pending.wgerId,
        equipment: pending.equipment,
        attachment: defaultAttachment,
        sets: [
          {
            id: `s-${timestamp}`,
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

  useEffect(() => {
    const pending = consumePendingExercise();
    if (pending) {
      addExercise(pending);
    }
  }, [pendingExercise, consumePendingExercise, addExercise]);

  const addSet = (exerciseId: string) => {
    setWorkout((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex) => {
          if (ex.id !== exerciseId) return ex;
          const lastSet = ex.sets[ex.sets.length - 1];
          const newSet: Set = {
            id: `s-${Date.now()}`,
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

  const updateSet = (
    exerciseId: string,
    setId: string,
    field: 'weight' | 'reps',
    value: string
  ) => {
    setWorkout((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex) =>
          ex.id === exerciseId
            ? { ...ex, sets: ex.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)) }
            : ex
        ),
      };
    });
  };

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

  const updateAttachment = (exerciseId: string, attachment: string) => {
    setWorkout((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex) =>
          ex.id === exerciseId ? { ...ex, attachment } : ex
        ),
      };
    });
  };

  const handleFinish = async () => {
    if (!workout) return;
    if (workout.exercises.length === 0) {
      Alert.alert('Empty workout', 'Add at least one exercise before finishing.');
      return;
    }
    setSaving(true);
    setRunning(false);

    const sets = workout.exercises.flatMap((ex) =>
      ex.sets.map((set, setIdx) => ({
        exerciseName: ex.name,
        wgerId: ex.wgerId || null,
        setNumber: setIdx + 1,
        weightKg: set.weight,
        reps: set.reps,
        completed: set.isCompleted,
        attachment: ex.attachment === 'No attachment' ? null : ex.attachment,
      }))
    );

    try {
      await client.post('/api/workouts', {
        title: workout.title,
        durationSeconds: elapsed,
        sets,
        splitId: splitId ?? null,
      });
      router.back();
    } catch (err) {
      setSaving(false);
      Alert.alert('Failed to save', err instanceof Error ? err.message : 'Could not save workout');
    }
  };

  const pickingExercise = workout?.exercises.find((e) => e.id === pickingExerciseId);

  const status = isLoading ? 'loading' : error || !workout || workout.exercises.length === 0 ? 'empty' : 'data';

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
              <Text className="text-white text-lg font-extrabold tracking-tight" numberOfLines={1}>
                {workout?.title ?? 'Workout'}
              </Text>
              <View className="flex-row items-center mt-1">
                <Text className="text-[#E63946] text-xl font-bold mr-3">{formatTime(elapsed)}</Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setRunning(!running)}
                  className="w-8 h-8 rounded-full bg-[#1C1C1E] items-center justify-center mr-2"
                >
                  <Ionicons name={running ? 'pause' : 'play'} size={16} color="#E63946" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={saving}
            className={`rounded-xl px-5 py-2.5 ${saving ? 'bg-[#E63946]/50' : 'bg-[#E63946]'}`}
            onPress={handleFinish}
          >
            <Text className="text-white font-bold text-sm">{saving ? 'Saving...' : 'Finish'}</Text>
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
          >
            {workout && workout.exercises.length > 0 && (
              <>
                {workout.exercises.map((exercise, exIndex) => (
                  <View
                    key={exercise.id}
                    className="bg-[#121212] rounded-[20px] p-4 mb-3"
                    style={exIndex === 0 ? { marginTop: 4 } : undefined}
                  >
                    {/* Exercise Name */}
                    <Text className="text-white text-lg font-bold mb-1">{exercise.name}</Text>

                    {/* Attachment Picker */}
                    {getAttachmentsForEquipment(exercise.equipment).length > 1 && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setPickingExerciseId(exercise.id)}
                        className="flex-row items-center mb-4"
                      >
                        <Ionicons name="options-outline" size={14} color="#E63946" />
                        <Text className="text-[#E63946] text-sm font-semibold ml-1.5">
                          {exercise.attachment === 'No attachment' ? 'Add attachment' : exercise.attachment}
                        </Text>
                        <Ionicons name="chevron-down" size={14} color="#E63946" className="ml-1" />
                      </TouchableOpacity>
                    )}

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

        <AttachmentPicker
          visible={!!pickingExerciseId}
          exerciseName={pickingExercise?.name ?? ''}
          equipment={pickingExercise?.equipment ?? []}
          selectedId={
            pickingExercise
              ? getAttachmentsForEquipment(pickingExercise.equipment).find(
                  (a) => a.name === pickingExercise.attachment
                )?.id ?? null
              : null
          }
          onClose={() => setPickingExerciseId(null)}
          onSelect={(attachment) =>
            pickingExerciseId && updateAttachment(pickingExerciseId, attachment.name)
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

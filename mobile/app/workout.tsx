import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LoadableContainer } from '@/components/LoadableContainer';
import { AttachmentPicker } from '@/components/AttachmentPicker';
import { useWorkout, type PendingExercise } from '@/context/WorkoutContext';
import { getAttachmentsForEquipment } from '@/constants/attachments';
import { useWorkoutSessionStore } from '@/src/store/useWorkoutSessionStore';
import { usePowerSync } from '@powersync/react-native';
import type { ActiveExercise, ActiveSet, Routine } from '@/src/types/workout';

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Fetch previous set data from local SQLite for "previous" hints. */
function usePreviousSetHints(exercises: ActiveExercise[]) {
  const db = usePowerSync();
  const [hints, setHints] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadHints = async () => {
      const newHints: Record<string, string> = {};
      for (const ex of exercises) {
        try {
          const result = await db.execute(
            `SELECT ws.weight, ws.reps, ws.set_number
             FROM ${'workout_sets'} ws
             WHERE ws.exercise_name = ?
               AND ws.is_completed = 1
             ORDER BY ws.created_at DESC
             LIMIT 10`,
            [ex.name]
          );
          if (result.rows && result.rows.length > 0) {
            for (const row of result.rows._array || []) {
              const key = `${ex.exerciseId}-${row.set_number}`;
              if (!newHints[key]) {
                newHints[key] = `${row.weight}kg × ${row.reps}`;
              }
            }
          }
        } catch {
          // DB might not be ready yet — skip silently
        }
      }
      setHints(newHints);
    };

    if (exercises.length > 0) {
      loadHints();
    }
  }, [db, exercises]);

  return hints;
}

export default function WorkoutScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const db = usePowerSync();
  const { splitId, routineId } = useLocalSearchParams<{ splitId?: string; routineId?: string }>();
  const { pendingExercise, consumePendingExercise } = useWorkout();

  // Store state
  const isActive = useWorkoutSessionStore((s) => s.isActive);
  const workoutId = useWorkoutSessionStore((s) => s.workoutId);
  const title = useWorkoutSessionStore((s) => s.title);
  const exercises = useWorkoutSessionStore((s) => s.exercises);
  const isSaving = useWorkoutSessionStore((s) => s.isSaving);
  const startWorkout = useWorkoutSessionStore((s) => s.startWorkout);
  const addExerciseToStore = useWorkoutSessionStore((s) => s.addExercise);
  const addSetToStore = useWorkoutSessionStore((s) => s.addSet);
  const updateSetInStore = useWorkoutSessionStore((s) => s.updateSet);
  const toggleSetCompleteInStore = useWorkoutSessionStore((s) => s.toggleSetComplete);
  const setAttachmentInStore = useWorkoutSessionStore((s) => s.setAttachment);
  const finishWorkout = useWorkoutSessionStore((s) => s.finishWorkout);
  const discardWorkout = useWorkoutSessionStore((s) => s.discardWorkout);

  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [pickingExerciseId, setPickingExerciseId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const startTime = useWorkoutSessionStore((s) => s.startTime);

  const previousHints = usePreviousSetHints(exercises);

  // Start or resume workout
  useEffect(() => {
    if (isActive && !startedRef.current) {
      // Session already active (crash recovery or navigation return)
      startedRef.current = true;
      setRunning(true);
      setIsLoading(false);
      return;
    }

    if (!splitId || !routineId) {
      // Quick workout — start empty session
      if (!isActive) {
        startWorkout();
      }
      startedRef.current = true;
      setRunning(true);
      setIsLoading(false);
      return;
    }

    // Load routine from local SQLite and start with it
    const loadRoutine = async () => {
      try {
        // First check if we already have an active session
        if (isActive) {
          startedRef.current = true;
          setRunning(true);
          setIsLoading(false);
          return;
        }

        // Load routine from local SQLite (synced from server)
        const routineResult = await db.execute(
          `SELECT * FROM routines WHERE id = ?`,
          [routineId]
        );
        if (!routineResult.rows || routineResult.rows.length === 0) {
          setError('Routine not found');
          setIsLoading(false);
          return;
        }

        const routine = routineResult.rows._array?.[0] as any;

        // Load splits
        const splitsResult = await db.execute(
          `SELECT * FROM splits WHERE routine_id = ? ORDER BY order_index ASC`,
          [routineId]
        );
        const splits = splitsResult.rows?._array || [];

        // Load exercises for the selected split
        const split = splits.find((s: any) => s.id === splitId);
        if (!split) {
          setError('Split not found');
          setIsLoading(false);
          return;
        }

        const exercisesResult = await db.execute(
          `SELECT * FROM routine_exercises WHERE split_id = ? ORDER BY order_index ASC`,
          [split.id]
        );
        const splitExercises = exercisesResult.rows?._array || [];

        // Build a Routine object for the store
        const routineForStore: Routine = {
          id: routine.id,
          name: routine.name,
          exercises: splitExercises.map((ex: any) => ({
            exerciseId: ex.id,
            name: ex.exercise_name,
            orderIndex: ex.order_index,
            targetSets: ex.target_sets ?? undefined,
            targetReps: ex.target_reps ?? undefined,
            targetWeight: ex.target_weight ? Number(ex.target_weight) : undefined,
            restSeconds: ex.rest_seconds ?? undefined,
            wgerId: ex.wger_id ?? undefined,
            equipment: ex.equipment ? JSON.parse(ex.equipment) : [],
            attachment: ex.attachment ?? undefined,
          })),
        };

        startWorkout(routineForStore);
        startedRef.current = true;
        setRunning(true);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load routine');
        setIsLoading(false);
      }
    };

    loadRoutine();
  }, [splitId, routineId, isActive, startWorkout, db]);

  // Timer
  useEffect(() => {
    if (!running || !startTime) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [running, startTime]);

  // Consume exercise added from picker
  const addExercise = useCallback((pending: PendingExercise) => {
    addExerciseToStore({
      id: pending.id,
      name: pending.name,
      wgerId: pending.wgerId,
      equipment: pending.equipment,
    });
  }, [addExerciseToStore]);

  useEffect(() => {
    const pending = consumePendingExercise();
    if (pending) {
      addExercise(pending);
    }
  }, [pendingExercise, consumePendingExercise, addExercise]);

  const handleFinish = async () => {
    if (!isActive) return;
    if (exercises.length === 0) {
      Alert.alert('Empty workout', 'Add at least one exercise before finishing.');
      return;
    }

    try {
      await finishWorkout();
      queryClient.invalidateQueries({ queryKey: ['workouts'] });
      queryClient.invalidateQueries({ queryKey: ['routines'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      router.back();
    } catch (err) {
      Alert.alert('Failed to save', err instanceof Error ? err.message : 'Could not save workout');
    }
  };

  const handleDiscard = () => {
    Alert.alert(
      'Discard workout?',
      'All progress will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            discardWorkout();
            router.back();
          },
        },
      ]
    );
  };

  const pickingExercise = exercises.find((e) => e.exerciseId === pickingExerciseId);

  const status = isLoading ? 'loading' : error || exercises.length === 0 ? 'empty' : 'data';

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
              onPress={handleDiscard}
              activeOpacity={0.7}
              className="mr-3 p-2 rounded-full bg-[#1C1C1E]"
            >
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-white text-lg font-extrabold tracking-tight" numberOfLines={1}>
                {title || 'Workout'}
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
            disabled={isSaving}
            className={`rounded-xl px-5 py-2.5 ${isSaving ? 'bg-[#E63946]/50' : 'bg-[#E63946]'}`}
            onPress={handleFinish}
          >
            <Text className="text-white font-bold text-sm">{isSaving ? 'Saving...' : 'Finish'}</Text>
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
            {exercises.length > 0 && (
              <>
                {exercises.map((exercise, exIndex) => (
                  <View
                    key={exercise.exerciseId}
                    className="bg-[#121212] rounded-[20px] p-4 mb-3"
                    style={exIndex === 0 ? { marginTop: 4 } : undefined}
                  >
                    {/* Exercise Name */}
                    <Text className="text-white text-lg font-bold mb-1">{exercise.name}</Text>

                    {/* Attachment Picker */}
                    {getAttachmentsForEquipment(exercise.equipment || []).length > 1 && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setPickingExerciseId(exercise.exerciseId)}
                        className="flex-row items-center mb-4"
                      >
                        <Ionicons name="options-outline" size={14} color="#E63946" />
                        <Text className="text-[#E63946] text-sm font-semibold ml-1.5">
                          {exercise.attachment === 'No attachment' ? 'Add attachment' : exercise.attachment || 'Add attachment'}
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
                    {exercise.sets.map((set) => {
                      const hintKey = `${exercise.exerciseId}-${set.setIndex}`;
                      const previousDisplay =
                        previousHints[hintKey] ||
                        (set.previousWeight !== undefined
                          ? `${set.previousWeight}kg × ${set.previousReps}`
                          : '');

                      return (
                        <View
                          key={set.id}
                          className={`flex-row items-center mb-2 ${set.isCompleted ? 'opacity-40' : ''}`}
                        >
                          {/* Set Number */}
                          <View className="w-10 h-10 rounded-lg bg-[#1C1C1E] items-center justify-center">
                            <Text className="text-white text-sm font-bold">{set.setIndex}</Text>
                          </View>

                          {/* Previous */}
                          <Text className="text-[#A0A0A0] text-sm font-medium flex-1 px-2">
                            {previousDisplay}
                          </Text>

                          {/* Weight Input */}
                          <TextInput
                            value={set.weight !== null ? String(set.weight) : ''}
                            onChangeText={(val) => updateSetInStore(exercise.exerciseId, set.id, 'weight', val)}
                            keyboardType="numeric"
                            placeholder="—"
                            placeholderTextColor="#555"
                            className="w-16 h-10 bg-[#1C1C1E] rounded-lg text-white text-center text-sm font-semibold mr-2 px-2"
                          />

                          {/* Reps Input */}
                          <TextInput
                            value={set.reps !== null ? String(set.reps) : ''}
                            onChangeText={(val) => updateSetInStore(exercise.exerciseId, set.id, 'reps', val)}
                            keyboardType="numeric"
                            placeholder="—"
                            placeholderTextColor="#555"
                            className="w-16 h-10 bg-[#1C1C1E] rounded-lg text-white text-center text-sm font-semibold mr-2 px-2"
                          />

                          {/* Checkmark Toggle */}
                          <TouchableOpacity
                            onPress={() => toggleSetCompleteInStore(exercise.exerciseId, set.id)}
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
                      );
                    })}

                    {/* Add Set Button */}
                    <TouchableOpacity
                      onPress={() => addSetToStore(exercise.exerciseId)}
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
              ? getAttachmentsForEquipment(pickingExercise.equipment || []).find(
                  (a) => a.name === pickingExercise.attachment
                )?.id ?? null
              : null
          }
          onClose={() => setPickingExerciseId(null)}
          onSelect={(attachment) =>
            pickingExerciseId && setAttachmentInStore(pickingExerciseId, attachment.name)
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

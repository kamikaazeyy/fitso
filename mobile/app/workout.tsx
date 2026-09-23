import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,

  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { LoadableContainer } from '@/components/LoadableContainer';
import { AttachmentPicker } from '@/components/AttachmentPicker';
import { SetRow } from '@/components/SetRow';
import { useWorkout, type PendingExercise } from '@/context/WorkoutContext';
import { getAttachmentsForEquipment } from '@/constants/attachments';
import { useWorkoutSessionStore } from '@/src/store/useWorkoutSessionStore';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { WORKOUTS_TABLE, WORKOUT_SETS_TABLE } from '@/src/db/AppSchema';
import { usePowerSync } from '@powersync/react-native';
import { PlateCalculatorModal } from '@/components/PlateCalculatorModal';
import { displayWeight, parseWeightInput, type WeightUnit } from '@/src/utils/units';
import type { ActiveExercise, Routine } from '@/src/types/workout';

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Safely parses the equipment JSON string stored in SQLite; returns [] on failure. */
function parseEquipment(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Fetch previous set data from local SQLite for "previous" hints.
 * Runs once per distinct exercise list — keying the effect on the exercise
 * names rather than the `exercises` array, which gets a new identity on every
 * keystroke and would otherwise fire one query per exercise per keypress.
 */
function usePreviousSetHints(exercises: ActiveExercise[], unit: WeightUnit) {
  const db = usePowerSync();
  const [hints, setHints] = useState<Record<string, string>>({});
  const exercisesRef = useRef(exercises);
  exercisesRef.current = exercises;
  const exerciseKey = exercises.map((ex) => `${ex.exerciseId}:${ex.name}`).join('|');

  useEffect(() => {
    const loadHints = async () => {
      const newHints: Record<string, string> = {};
      for (const ex of exercisesRef.current) {
        try {
          // Order by the workout's finish time (not created_at — that value is
          // identical for every set in a workout) so hints come from the most
          // recent session that trained this exercise.
          const result = await db.execute(
            `SELECT ws.weight, ws.reps, ws.set_number
             FROM ${WORKOUT_SETS_TABLE} ws
             JOIN ${WORKOUTS_TABLE} w ON w.id = ws.workout_id
             WHERE ws.exercise_name = ?
               AND ws.is_completed = 1
             ORDER BY w.finished_at DESC, ws.set_number ASC
             LIMIT 10`,
            [ex.name]
          );
          if (result.rows && result.rows.length > 0) {
            for (const row of result.rows._array || []) {
              const key = `${ex.exerciseId}-${row.set_number}`;
              if (!newHints[key]) {
                const shown = row.weight != null ? displayWeight(row.weight, unit) : null;
                newHints[key] = `${shown ?? '—'}${unit} × ${row.reps ?? '—'}`;
              }
            }
          }
        } catch {
          // DB might not be ready yet — skip silently
        }
      }
      setHints(newHints);
    };

    if (exerciseKey.length > 0) {
      loadHints();
    }
  }, [db, exerciseKey, unit]);

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
  const removeSetInStore = useWorkoutSessionStore((s) => s.removeSet);
  const removeExerciseInStore = useWorkoutSessionStore((s) => s.removeExercise);
  const reorderExercisesInStore = useWorkoutSessionStore((s) => s.reorderExercises);
  const setExerciseRestInStore = useWorkoutSessionStore((s) => s.setExerciseRest);
  const updateSetInStore = useWorkoutSessionStore((s) => s.updateSet);
  const cycleSetTypeInStore = useWorkoutSessionStore((s) => s.cycleSetType);
  const toggleSetCompleteInStore = useWorkoutSessionStore((s) => s.toggleSetComplete);
  const setAttachmentInStore = useWorkoutSessionStore((s) => s.setAttachment);
  const finishWorkout = useWorkoutSessionStore((s) => s.finishWorkout);
  const discardWorkout = useWorkoutSessionStore((s) => s.discardWorkout);
  const setSplitIdInStore = useWorkoutSessionStore((s) => s.setSplitId);

  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [pickingExerciseId, setPickingExerciseId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPlateCalc, setShowPlateCalc] = useState(false);
  // Guard keyed on the route params — once this mount has initialised a
  // session, the effect must not fire again. Without this, `isActive`
  // flipping to false on finish/discard would re-run the effect and spawn a
  // phantom workout that MMKV persists as "in progress".
  const startedForParamsRef = useRef<string | null>(null);
  const paramsKey = `${routineId ?? ''}|${splitId ?? ''}`;
  const startTime = useWorkoutSessionStore((s) => s.startTime);
  const weightUnit = useSettingsStore((s) => s.weightUnit);

  const previousHints = usePreviousSetHints(exercises, weightUnit);

  // Start or resume workout
  useEffect(() => {
    if (startedForParamsRef.current === paramsKey) return;

    if (isActive) {
      // Session already active (crash recovery or navigation return)
      startedForParamsRef.current = paramsKey;
      setRunning(true);
      setIsLoading(false);
      return;
    }

    if (!splitId || !routineId) {
      // Quick workout — start empty session
      startedForParamsRef.current = paramsKey;
      setSplitIdInStore(null);
      startWorkout();
      setRunning(true);
      setIsLoading(false);
      return;
    }

    // Load routine from local SQLite and start with it
    startedForParamsRef.current = paramsKey;
    const loadRoutine = async () => {
      try {

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
            equipment: parseEquipment(ex.equipment),
            attachment: ex.attachment ?? undefined,
          })),
        };

        startWorkout(routineForStore);
        setSplitIdInStore(splitId);
        setRunning(true);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load routine');
        setIsLoading(false);
      }
    };

    void loadRoutine();
  }, [paramsKey, splitId, routineId, isActive, startWorkout, setSplitIdInStore, db]);

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

  // The session lives in the store (persisted to MMKV), so leaving the screen
  // is just a minimize — the Training tab banner offers a way back in.
  const exitScreen = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/journal');
    }
  };

  const handleFinish = async () => {
    if (!isActive) return;
    if (exercises.length === 0) {
      Alert.alert('Empty workout', 'Add at least one exercise before finishing.');
      return;
    }

    try {
      await finishWorkout();
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      exitScreen();
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
            exitScreen();
          },
        },
      ]
    );
  };

  const pickingExercise = exercises.find((e) => e.exerciseId === pickingExerciseId);

  const openRestPicker = (exercise: ActiveExercise) => {
    const presets = [30, 60, 90, 120, 180, 300];
    Alert.alert(
      `Rest after ${exercise.name}`,
      'Auto-starts when you complete a set.',
      [
        ...presets.map((seconds) => ({
          text: seconds >= 60 ? `${seconds / 60} min` : `${seconds}s`,
          onPress: () => setExerciseRestInStore(exercise.exerciseId, seconds),
        })),
        {
          text: 'Off',
          onPress: () => setExerciseRestInStore(exercise.exerciseId, 0),
        },
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  };

  const openExerciseMenu = (exercise: ActiveExercise, index: number) => {
    Alert.alert(exercise.name, undefined, [
      ...(index > 0
        ? [{ text: 'Move up', onPress: () => reorderExercisesInStore(index, index - 1) }]
        : []),
      ...(index < exercises.length - 1
        ? [{ text: 'Move down', onPress: () => reorderExercisesInStore(index, index + 1) }]
        : []),
      { text: 'Rest timer…', onPress: () => openRestPicker(exercise) },
      {
        text: 'Remove exercise',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Remove exercise?', `Removes ${exercise.name} and its sets.`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: () => removeExerciseInStore(exercise.exerciseId),
            },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const confirmRemoveSet = (exerciseId: string, setId: string) => {
    Alert.alert('Delete set?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeSetInStore(exerciseId, setId) },
    ]);
  };

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
              onPress={exitScreen}
              activeOpacity={0.7}
              accessibilityLabel="Minimize workout"
              className="mr-3 p-2 rounded-full bg-[#1C1C1E]"
            >
              <Ionicons name="chevron-down" size={22} color="#FFFFFF" />
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
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => setShowPlateCalc(true)}
              activeOpacity={0.7}
              accessibilityLabel="Plate calculator"
              className="mr-3 p-2.5 rounded-full bg-[#1C1C1E]"
            >
              <Ionicons name="calculator-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDiscard}
              activeOpacity={0.7}
              accessibilityLabel="Discard workout"
              className="mr-3 p-2.5 rounded-full bg-[#1C1C1E]"
            >
              <Ionicons name="trash-outline" size={18} color="#E63946" />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={isSaving}
              className={`rounded-xl px-5 py-2.5 ${isSaving ? 'bg-[#E63946]/50' : 'bg-[#E63946]'}`}
              onPress={handleFinish}
            >
              <Text className="text-white font-bold text-sm">{isSaving ? 'Saving...' : 'Finish'}</Text>
            </TouchableOpacity>
          </View>
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
                    {/* Exercise Name + menu */}
                    <View className="flex-row items-center justify-between mb-1">
                      <TouchableOpacity
                        activeOpacity={0.7}
                        className="flex-1"
                        onPress={() =>
                          router.push(`/exercise-detail?name=${encodeURIComponent(exercise.name)}`)
                        }
                      >
                        <Text className="text-white text-lg font-bold" numberOfLines={1}>
                          {exercise.name}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => openExerciseMenu(exercise, exIndex)}
                        activeOpacity={0.7}
                        accessibilityLabel={`options-${exercise.name}`}
                        className="p-1 ml-2"
                      >
                        <Ionicons name="ellipsis-horizontal" size={20} color="#A0A0A0" />
                      </TouchableOpacity>
                    </View>

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
                      <Text className="text-[#A0A0A0] text-xs font-semibold w-14 text-center">
                        {weightUnit}
                      </Text>
                      <Text className="text-[#A0A0A0] text-xs font-semibold w-14 text-center">Reps</Text>
                      <Text className="text-[#A0A0A0] text-xs font-semibold w-11 text-center">RPE</Text>
                      <View className="w-10 items-center">
                        <Ionicons name="checkmark" size={14} color="#A0A0A0" />
                      </View>
                    </View>

                    {/* Set Rows — swipe left to delete */}
                    {exercise.sets.map((set) => {
                      const hintKey = `${exercise.exerciseId}-${set.setIndex}`;
                      const hint = previousHints[hintKey];

                      return (
                        <ReanimatedSwipeable
                          key={set.id}
                          friction={2}
                          rightThreshold={40}
                          renderRightActions={() => (
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={() => confirmRemoveSet(exercise.exerciseId, set.id)}
                              className="w-16 items-center justify-center rounded-lg bg-[#E63946] ml-2 mb-2"
                            >
                              <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                          )}
                        >
                          <SetRow
                            set={set}
                            unit={weightUnit}
                            hint={hint}
                            onChangeWeight={(val) =>
                              updateSetInStore(
                                exercise.exerciseId,
                                set.id,
                                'weight',
                                parseWeightInput(val, weightUnit)
                              )
                            }
                            onChangeReps={(val) =>
                              updateSetInStore(exercise.exerciseId, set.id, 'reps', val)
                            }
                            onChangeRpe={(val) =>
                              updateSetInStore(exercise.exerciseId, set.id, 'rpe', val)
                            }
                            onCycleSetType={() =>
                              cycleSetTypeInStore(exercise.exerciseId, set.id)
                            }
                            onToggleComplete={() =>
                              toggleSetCompleteInStore(exercise.exerciseId, set.id)
                            }
                          />
                        </ReanimatedSwipeable>
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

        <PlateCalculatorModal
          visible={showPlateCalc}
          onClose={() => setShowPlateCalc(false)}
        />

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

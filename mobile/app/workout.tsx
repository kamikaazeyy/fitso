import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import Ionicons from '@expo/vector-icons/Ionicons';
import { LoadableContainer } from '@/components/LoadableContainer';
import { AttachmentPicker } from '@/components/AttachmentPicker';
import { SetRow } from '@/components/SetRow';
import { useWorkout } from '@/context/WorkoutContext';
import { getAttachmentsForEquipment } from '@/constants/attachments';
import { client } from '@/src/api/client';
import { useLiveActivity } from '@/src/hooks/useLiveActivity';
import { useWorkoutSessionStore } from '@/src/store/useWorkoutSessionStore';
import type { Routine } from '@/src/types/workout';

const NO_ATTACHMENT = 'No attachment';

interface SplitExerciseResponse {
  exerciseName: string;
  wgerId?: number;
  equipment?: string[];
  attachment?: string;
  sets?: number;
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

  const isActive = useWorkoutSessionStore((state) => state.isActive);
  const title = useWorkoutSessionStore((state) => state.title);
  const startTime = useWorkoutSessionStore((state) => state.startTime);
  const exercises = useWorkoutSessionStore((state) => state.exercises);
  const isSaving = useWorkoutSessionStore((state) => state.isSaving);
  const startWorkout = useWorkoutSessionStore((state) => state.startWorkout);
  const addExercise = useWorkoutSessionStore((state) => state.addExercise);
  const addSet = useWorkoutSessionStore((state) => state.addSet);
  const updateSet = useWorkoutSessionStore((state) => state.updateSet);
  const cycleSetType = useWorkoutSessionStore((state) => state.cycleSetType);
  const setAttachment = useWorkoutSessionStore((state) => state.setAttachment);
  const toggleSetComplete = useWorkoutSessionStore((state) => state.toggleSetComplete);
  const finishWorkout = useWorkoutSessionStore((state) => state.finishWorkout);
  const discardWorkout = useWorkoutSessionStore((state) => state.discardWorkout);

  const [isLoading, setIsLoading] = useState(!isActive);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [pickingExerciseId, setPickingExerciseId] = useState<string | null>(null);
  // Seeding runs once per mount: finishing or discarding clears `isActive` while
  // this screen is still mounted, and re-seeding there would spawn a phantom session.
  const hasSeeded = useRef(false);

  useLiveActivity();

  // Rehydrated sessions (MMKV) resume as-is; otherwise seed from the split template.
  useEffect(() => {
    if (hasSeeded.current) return;
    hasSeeded.current = true;

    if (useWorkoutSessionStore.getState().isActive) {
      setIsLoading(false);
      return;
    }

    if (!splitId || !routineId) {
      startWorkout();
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    client
      .get(`/api/routines/${routineId}`)
      .then(({ data }) => {
        if (cancelled) return;
        const split = data?.splits?.find((entry: { id: string }) => entry.id === splitId);
        if (!split) {
          setError('Split not found');
          return;
        }

        const routine: Routine = {
          id: routineId,
          name: `${data.name} - ${split.name}`,
          exercises: (split.exercises ?? []).map((ex: SplitExerciseResponse, index: number) => {
            const equipment = ex.equipment ?? [];
            const attachments = getAttachmentsForEquipment(equipment);
            return {
              exerciseId: `${splitId}-${index}`,
              name: ex.exerciseName,
              orderIndex: index,
              targetSets: ex.sets ?? 1,
              wgerId: ex.wgerId ?? null,
              equipment,
              attachment: ex.attachment ?? attachments[0]?.name ?? NO_ATTACHMENT,
            };
          }),
        };

        startWorkout(routine);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load split');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [splitId, routineId, startWorkout]);

  // Elapsed time is derived from the persisted startTime, so it survives a crash.
  useEffect(() => {
    if (startTime === null) {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  useEffect(() => {
    const pending = consumePendingExercise();
    if (!pending) return;
    addExercise({
      id: pending.id,
      name: pending.name,
      wgerId: pending.wgerId ?? null,
      equipment: pending.equipment,
    });
  }, [pendingExercise, consumePendingExercise, addExercise]);

  const handleFinish = useCallback(async () => {
    if (exercises.length === 0) {
      Alert.alert('Empty workout', 'Add at least one exercise before finishing.');
      return;
    }
    try {
      await finishWorkout();
      router.back();
    } catch (err) {
      Alert.alert(
        'Failed to save',
        err instanceof Error ? err.message : 'Could not write the workout to local storage'
      );
    }
  }, [exercises.length, finishWorkout, router]);

  const handleDiscard = useCallback(() => {
    Alert.alert('Discard workout?', 'This will delete the active session.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          discardWorkout();
          router.back();
        },
      },
    ]);
  }, [discardWorkout, router]);

  const pickingExercise = exercises.find((entry) => entry.exerciseId === pickingExerciseId);
  const status = isLoading ? 'loading' : error || exercises.length === 0 ? 'empty' : 'data';

  return (
    <SafeAreaView className="flex-1 bg-black">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
        keyboardVerticalOffset={0}
      >
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
                {title || 'Workout'}
              </Text>
              <View className="flex-row items-center mt-1">
                <Text className="text-[#E63946] text-xl font-bold mr-3">{formatTime(elapsed)}</Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleDiscard}
                  className="w-8 h-8 rounded-full bg-[#1C1C1E] items-center justify-center mr-2"
                >
                  <Ionicons name="trash-outline" size={15} color="#E63946" />
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
            {exercises.map((exercise, exIndex) => (
              <View
                key={exercise.exerciseId}
                className="bg-[#121212] rounded-[20px] p-4 mb-3"
                style={exIndex === 0 ? { marginTop: 4 } : undefined}
              >
                <Text className="text-white text-lg font-bold mb-1">{exercise.name}</Text>

                {getAttachmentsForEquipment(exercise.equipment ?? []).length > 1 && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setPickingExerciseId(exercise.exerciseId)}
                    className="flex-row items-center mb-4"
                  >
                    <Ionicons name="options-outline" size={14} color="#E63946" />
                    <Text className="text-[#E63946] text-sm font-semibold ml-1.5">
                      {!exercise.attachment || exercise.attachment === NO_ATTACHMENT
                        ? 'Add attachment'
                        : exercise.attachment}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="#E63946" className="ml-1" />
                  </TouchableOpacity>
                )}

                <View className="flex-row items-center mb-3 px-1">
                  <Text className="text-[#A0A0A0] text-xs font-semibold w-10">Set</Text>
                  <Text className="text-[#A0A0A0] text-xs font-semibold flex-1">Previous</Text>
                  <Text className="text-[#A0A0A0] text-xs font-semibold w-16 text-center">kg</Text>
                  <Text className="text-[#A0A0A0] text-xs font-semibold w-16 text-center">Reps</Text>
                  <View className="w-10 items-center">
                    <Ionicons name="checkmark" size={14} color="#A0A0A0" />
                  </View>
                </View>

                {exercise.sets.map((set) => (
                  <SetRow
                    key={set.id}
                    set={set}
                    onChangeWeight={(value) =>
                      updateSet(exercise.exerciseId, set.id, 'weight', value)
                    }
                    onChangeReps={(value) => updateSet(exercise.exerciseId, set.id, 'reps', value)}
                    onCycleSetType={() => cycleSetType(exercise.exerciseId, set.id)}
                    onToggleComplete={() => toggleSetComplete(exercise.exerciseId, set.id)}
                  />
                ))}

                <TouchableOpacity
                  onPress={() => addSet(exercise.exerciseId)}
                  activeOpacity={0.7}
                  className="flex-row items-center justify-center mt-2 py-3 rounded-xl bg-[#1C1C1E]"
                >
                  <Ionicons name="add" size={18} color="#E63946" />
                  <Text className="text-[#E63946] font-semibold text-sm ml-2">Add Set</Text>
                </TouchableOpacity>
              </View>
            ))}
          </LoadableContainer>

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
              ? getAttachmentsForEquipment(pickingExercise.equipment ?? []).find(
                  (a) => a.name === pickingExercise.attachment
                )?.id ?? null
              : null
          }
          onClose={() => setPickingExerciseId(null)}
          onSelect={(attachment) =>
            pickingExerciseId && setAttachment(pickingExerciseId, attachment.name)
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

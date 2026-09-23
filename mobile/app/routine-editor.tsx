import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePowerSync } from '@powersync/react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useWorkout, type PendingExercise } from '@/context/WorkoutContext';
import { useAuth } from '@/context/AuthContext';
import {
  ROUTINE_EXERCISES_TABLE,
  ROUTINES_TABLE,
  SPLITS_TABLE,
} from '@/src/db/AppSchema';
import {
  useRoutineMutations,
  type RoutineDraftExercise,
  type RoutineDraftSplit,
} from '@/src/hooks/useRoutineMutations';
import { AttachmentPicker } from '@/components/AttachmentPicker';
import { getAttachmentsForEquipment } from '@/constants/attachments';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { displayWeight, parseWeightInput } from '@/src/utils/units';
import { uuid } from '@/src/utils/id';

function newSplit(index: number): RoutineDraftSplit {
  return { id: uuid(), name: `Split ${index + 1}`, exercises: [] };
}

function parseEquipment(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toNullableInt(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function NumberField({
  label,
  value,
  onChange,
  placeholder = '—',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <View className="mr-3">
      <Text className="text-[#A0A0A0] text-[10px] font-semibold uppercase mb-1">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor="#555"
        className="w-14 h-9 bg-[#1C1C1E] rounded-lg text-white text-center text-sm font-semibold"
      />
    </View>
  );
}

export default function RoutineEditorScreen() {
  const router = useRouter();
  const db = usePowerSync();
  const { user } = useAuth();
  const { pendingExercise, consumePendingExercise } = useWorkout();
  const { saveRoutine } = useRoutineMutations();
  const { routineId } = useLocalSearchParams<{ routineId?: string }>();
  const unit = useSettingsStore((s) => s.weightUnit);

  const isEdit = !!routineId;
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [splits, setSplits] = useState<RoutineDraftSplit[]>([newSplit(0)]);
  const [activeSplit, setActiveSplit] = useState(0);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [attachmentTarget, setAttachmentTarget] = useState<string | null>(null);

  // Load existing routine for edit mode. Deliberately NOT keyed on `unit` —
  // re-running this effect on a unit change would discard in-progress edits.
  useEffect(() => {
    if (!routineId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const routineResult = await db.execute(
          `SELECT name, notes FROM ${ROUTINES_TABLE} WHERE id = ?`,
          [routineId]
        );
        const routine = routineResult.rows?._array?.[0] as
          | { name: string; notes: string | null }
          | undefined;
        if (!routine) {
          if (!cancelled) Alert.alert('Not found', 'This routine no longer exists.');
          return;
        }

        const splitsResult = await db.execute(
          `SELECT id, name FROM ${SPLITS_TABLE} WHERE routine_id = ? ORDER BY order_index ASC`,
          [routineId]
        );
        const splitRows = (splitsResult.rows?._array ?? []) as { id: string; name: string }[];

        const loadedSplits: RoutineDraftSplit[] = [];
        for (const split of splitRows) {
          const exResult = await db.execute(
            `SELECT * FROM ${ROUTINE_EXERCISES_TABLE} WHERE split_id = ? ORDER BY order_index ASC`,
            [split.id]
          );
          loadedSplits.push({
            id: split.id,
            name: split.name,
            exercises: ((exResult.rows?._array ?? []) as Record<string, unknown>[]).map((row) => ({
              id: row.id as string,
              exerciseName: row.exercise_name as string,
              wgerId: (row.wger_id as number | null) ?? null,
              equipment: parseEquipment(row.equipment as string | null),
              attachment: (row.attachment as string | null) ?? null,
              targetSets: (row.target_sets as number | null) ?? 3,
              targetReps: (row.target_reps as number | null) ?? null,
              targetRepsMax: (row.target_reps_max as number | null) ?? null,
              // Draft weight stays canonical kg — the field converts at the edges.
              targetWeight: (row.target_weight as number | null) ?? null,
              restSeconds: (row.rest_seconds as number | null) ?? null,
            })),
          });
        }

        if (!cancelled) {
          setName(routine.name);
          setNotes(routine.notes ?? '');
          setSplits(loadedSplits.length > 0 ? loadedSplits : [newSplit(0)]);
          setActiveSplit(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [routineId, db]);

  // Consume exercise picked in the picker — appends to the active split
  useEffect(() => {
    const pending = consumePendingExercise();
    if (!pending) return;
    setSplits((prev) =>
      prev.map((split, i) =>
        i === activeSplit
          ? {
              ...split,
              exercises: [
                ...split.exercises,
                {
                  id: uuid(),
                  exerciseName: pending.name,
                  wgerId: pending.wgerId ?? null,
                  equipment: pending.equipment ?? [],
                  attachment: null,
                  targetSets: 3,
                  targetReps: null,
                  targetRepsMax: null,
                  targetWeight: null,
                  restSeconds: null,
                },
              ],
            }
          : split
      )
    );
  }, [pendingExercise, consumePendingExercise, activeSplit]);

  const currentSplit = splits[Math.min(activeSplit, splits.length - 1)];
  const totalExercises = useMemo(
    () => splits.reduce((sum, split) => sum + split.exercises.length, 0),
    [splits]
  );
  const attachmentExercise = currentSplit?.exercises.find((ex) => ex.id === attachmentTarget);

  const patchSplit = (index: number, patch: Partial<RoutineDraftSplit>) => {
    setSplits((prev) => prev.map((split, i) => (i === index ? { ...split, ...patch } : split)));
  };

  const patchExercise = (index: number, patch: Partial<RoutineDraftExercise>) => {
    if (!currentSplit) return;
    patchSplit(
      activeSplit,
      {
        exercises: currentSplit.exercises.map((ex, i) => (i === index ? { ...ex, ...patch } : ex)),
      }
    );
  };

  const moveExercise = (index: number, direction: -1 | 1) => {
    if (!currentSplit) return;
    const next = [...currentSplit.exercises];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    patchSplit(activeSplit, { exercises: next });
  };

  const addSplit = () => {
    setSplits((prev) => [...prev, newSplit(prev.length)]);
    setActiveSplit(splits.length);
  };

  const removeSplit = (index: number) => {
    if (splits.length <= 1) {
      Alert.alert('Last split', 'A routine needs at least one split.');
      return;
    }
    Alert.alert('Delete split?', `"${splits[index].name}" and its exercises will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setSplits((prev) => prev.filter((_, i) => i !== index));
          setActiveSplit((prev) => Math.max(0, prev > index ? prev - 1 : Math.min(prev, splits.length - 2)));
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Routine name required', 'Give your routine a name.');
      return;
    }
    if (totalExercises === 0) {
      Alert.alert('Add exercises', 'A routine needs at least one exercise.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Not signed in', 'Sign in again and retry.');
      return;
    }

    setSaving(true);
    try {
      await saveRoutine(
        {
          id: routineId ?? uuid(),
          name: name.trim(),
          notes: notes.trim() || null,
          splits: splits.map((split) => ({
            ...split,
            name: split.name.trim() || 'Split',
            exercises: split.exercises,
          })),
        },
        user.id,
        !isEdit
      );
      router.back();
    } catch (err) {
      Alert.alert('Failed to save', err instanceof Error ? err.message : 'Could not save routine');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator size="large" color="#E63946" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center justify-between px-4 py-4 bg-black">
        <View className="flex-row items-center flex-1">
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            className="mr-3 p-2 rounded-full bg-[#1C1C1E]"
          >
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="text-white text-lg font-extrabold tracking-tight">
            {isEdit ? 'Edit Routine' : 'New Routine'}
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={saving}
          onPress={handleSave}
          className={`rounded-xl px-5 py-2.5 ${saving ? 'bg-[#E63946]/50' : 'bg-[#E63946]'}`}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text className="text-white font-bold text-sm">Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
          <Text className="text-[#A0A0A0] text-xs font-semibold mb-1.5 uppercase">Routine name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Push Pull Legs"
            placeholderTextColor="#555"
            className="text-white text-base"
            autoCapitalize="words"
          />
        </View>

        <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
          <Text className="text-[#A0A0A0] text-xs font-semibold mb-1.5 uppercase">Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional notes"
            placeholderTextColor="#555"
            className="text-white text-base"
            multiline
          />
        </View>

        {/* Split tabs */}
        <View className="flex-row items-center mb-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
            {splits.map((split, index) => {
              const selected = index === Math.min(activeSplit, splits.length - 1);
              return (
                <TouchableOpacity
                  key={split.id}
                  activeOpacity={0.7}
                  onPress={() => setActiveSplit(index)}
                  onLongPress={() => removeSplit(index)}
                  className={`rounded-full px-4 py-2 mr-2 border ${
                    selected ? 'bg-[#E63946] border-[#E63946]' : 'bg-[#121212] border-[#2C2C2E]'
                  }`}
                >
                  <Text className={`text-sm font-semibold ${selected ? 'text-white' : 'text-[#A0A0A0]'}`}>
                    {split.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={addSplit}
              className="rounded-full px-3 py-2 bg-[#121212] border border-dashed border-[#2C2C2E]"
            >
              <Ionicons name="add" size={16} color="#E63946" />
            </TouchableOpacity>
          </ScrollView>
        </View>

        {currentSplit && (
          <>
            <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
              <Text className="text-[#A0A0A0] text-xs font-semibold mb-1.5 uppercase">
                Split name
              </Text>
              <TextInput
                value={currentSplit.name}
                onChangeText={(val) => patchSplit(activeSplit, { name: val })}
                placeholder="e.g. Push A"
                placeholderTextColor="#555"
                className="text-white text-base"
                autoCapitalize="words"
              />
              <Text className="text-[#555] text-[10px] mt-2">
                Long-press a split tab to delete it.
              </Text>
            </View>

            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-white text-lg font-extrabold">Exercises</Text>
              <Text className="text-[#A0A0A0] text-sm">{currentSplit.exercises.length}</Text>
            </View>

            {currentSplit.exercises.length === 0 && (
              <View className="bg-[#121212] rounded-[20px] p-6 items-center mb-4">
                <Ionicons name="barbell-outline" size={32} color="#A0A0A0" />
                <Text className="text-[#A0A0A0] text-sm mt-2 text-center">
                  Add exercises to build this split.
                </Text>
              </View>
            )}

            {currentSplit.exercises.map((ex, index) => (
              <View key={ex.id} className="bg-[#121212] rounded-[20px] p-4 mb-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-white font-bold" numberOfLines={1}>
                      {ex.exerciseName}
                    </Text>
                    {ex.equipment.length > 0 && (
                      <Text className="text-[#A0A0A0] text-xs mt-0.5">
                        {ex.equipment.join(', ')}
                      </Text>
                    )}
                  </View>
                  <View className="flex-row items-center">
                    <TouchableOpacity
                      onPress={() => moveExercise(index, -1)}
                      activeOpacity={0.7}
                      className="p-1.5"
                      accessibilityLabel={`move-up-${ex.exerciseName}`}
                    >
                      <Ionicons name="chevron-up" size={18} color={index === 0 ? '#333' : '#A0A0A0'} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => moveExercise(index, 1)}
                      activeOpacity={0.7}
                      className="p-1.5"
                      accessibilityLabel={`move-down-${ex.exerciseName}`}
                    >
                      <Ionicons
                        name="chevron-down"
                        size={18}
                        color={index === currentSplit.exercises.length - 1 ? '#333' : '#A0A0A0'}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        patchSplit(activeSplit, {
                          exercises: currentSplit.exercises.filter((_, i) => i !== index),
                        })
                      }
                      activeOpacity={0.7}
                      className="p-1.5"
                      accessibilityLabel={`remove-${ex.exerciseName}`}
                    >
                      <Ionicons name="trash-outline" size={18} color="#E63946" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View className="flex-row flex-wrap items-end mt-3">
                  <NumberField
                    label="Sets"
                    value={String(ex.targetSets)}
                    onChange={(val) => {
                      const parsed = parseInt(val, 10);
                      patchExercise(index, { targetSets: Number.isNaN(parsed) ? 1 : Math.max(1, parsed) });
                    }}
                  />
                  <NumberField
                    label="Reps min"
                    value={ex.targetReps !== null ? String(ex.targetReps) : ''}
                    onChange={(val) => patchExercise(index, { targetReps: toNullableInt(val) })}
                  />
                  <NumberField
                    label="Reps max"
                    value={ex.targetRepsMax !== null ? String(ex.targetRepsMax) : ''}
                    onChange={(val) => patchExercise(index, { targetRepsMax: toNullableInt(val) })}
                  />
                  <NumberField
                    label={`Weight (${unit})`}
                    value={
                      ex.targetWeight !== null
                        ? String(displayWeight(ex.targetWeight, unit) ?? ex.targetWeight)
                        : ''
                    }
                    onChange={(val) =>
                      patchExercise(index, { targetWeight: parseWeightInput(val, unit) })
                    }
                  />
                  <NumberField
                    label="Rest (s)"
                    value={ex.restSeconds !== null ? String(ex.restSeconds) : ''}
                    onChange={(val) => patchExercise(index, { restSeconds: toNullableInt(val) })}
                  />
                </View>

                {getAttachmentsForEquipment(ex.equipment).length > 1 && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setAttachmentTarget(ex.id)}
                    className="flex-row items-center mt-3"
                  >
                    <Ionicons name="options-outline" size={14} color="#E63946" />
                    <Text className="text-[#E63946] text-sm font-semibold ml-1.5">
                      {ex.attachment ?? 'Add attachment'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-row items-center justify-center py-4 rounded-[20px] bg-[#121212] border border-[#2C2C2E] mb-3"
              onPress={() => router.push('/exercise-picker')}
            >
              <Ionicons name="add" size={20} color="#E63946" />
              <Text className="text-[#E63946] font-bold text-base ml-2">Add Exercise</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <AttachmentPicker
        visible={!!attachmentTarget}
        exerciseName={attachmentExercise?.exerciseName ?? ''}
        equipment={attachmentExercise?.equipment ?? []}
        selectedId={
          attachmentExercise
            ? getAttachmentsForEquipment(attachmentExercise.equipment).find(
                (a) => a.name === attachmentExercise.attachment
              )?.id ?? null
            : null
        }
        onClose={() => setAttachmentTarget(null)}
        onSelect={(attachment) => {
          if (!attachmentTarget || !currentSplit) return;
          const index = currentSplit.exercises.findIndex((ex) => ex.id === attachmentTarget);
          if (index >= 0) {
            patchExercise(index, {
              attachment: attachment.name === 'No attachment' ? null : attachment.name,
            });
          }
        }}
      />
    </SafeAreaView>
  );
}

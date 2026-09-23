import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { usePowerSync } from '@powersync/react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useWorkout, type PendingExercise } from '@/context/WorkoutContext';
import { useAuth } from '@/context/AuthContext';
import { ROUTINE_EXERCISES_TABLE, ROUTINES_TABLE, SPLITS_TABLE } from '@/src/db/AppSchema';
import { uuid } from '@/src/utils/id';

interface DraftExercise extends PendingExercise {
  targetSets: number;
  targetReps: number | null;
}

export default function CreateRoutineScreen() {
  const router = useRouter();
  const db = usePowerSync();
  const { user } = useAuth();
  const { pendingExercise, consumePendingExercise } = useWorkout();

  const [name, setName] = useState('');
  const [splitName, setSplitName] = useState('');
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const pending = consumePendingExercise();
    if (pending) {
      setExercises((prev) => [...prev, { ...pending, targetSets: 3, targetReps: null }]);
    }
  }, [pendingExercise, consumePendingExercise]);

  const removeExercise = (index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const updateExercise = (index: number, patch: Partial<DraftExercise>) => {
    setExercises((prev) => prev.map((ex, i) => (i === index ? { ...ex, ...patch } : ex)));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Routine name required', 'Give your routine a name.');
      return;
    }
    if (exercises.length === 0) {
      Alert.alert('Add exercises', 'A routine needs at least one exercise.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Not signed in', 'Sign in again and retry.');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const routineId = uuid();
      const splitId = uuid();

      // Write to local SQLite — PowerSync queues the INSERTs and pushes them
      // to Postgres via /api/sync/upload, so this works fully offline.
      await db.writeTransaction(async (tx) => {
        await tx.execute(
          `INSERT INTO ${ROUTINES_TABLE} (id, user_id, name, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [routineId, user.id, name.trim(), null, now, now]
        );
        await tx.execute(
          `INSERT INTO ${SPLITS_TABLE} (id, routine_id, name, order_index, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [splitId, routineId, splitName.trim() || 'Split 1', 0, now]
        );
        for (const [order, ex] of exercises.entries()) {
          await tx.execute(
            `INSERT INTO ${ROUTINE_EXERCISES_TABLE}
               (id, split_id, exercise_name, wger_id, equipment, attachment, order_index,
                target_sets, target_reps, target_weight, rest_seconds, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uuid(),
              splitId,
              ex.name,
              ex.wgerId ?? null,
              JSON.stringify(ex.equipment ?? []),
              null,
              order,
              Math.max(1, Math.round(ex.targetSets)) || 3,
              ex.targetReps,
              null,
              null,
              now,
            ]
          );
        }
      });
      router.back();
    } catch (err) {
      Alert.alert('Failed to save', err instanceof Error ? err.message : 'Could not save routine');
    } finally {
      setSaving(false);
    }
  };

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
          <Text className="text-white text-lg font-extrabold tracking-tight">New Routine</Text>
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
          <Text className="text-[#A0A0A0] text-xs font-semibold mb-1.5 uppercase">Split name</Text>
          <TextInput
            value={splitName}
            onChangeText={setSplitName}
            placeholder="e.g. Push A"
            placeholderTextColor="#555"
            className="text-white text-base"
            autoCapitalize="words"
          />
        </View>

        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-white text-lg font-extrabold">Exercises</Text>
          <Text className="text-[#A0A0A0] text-sm">{exercises.length}</Text>
        </View>

        {exercises.length === 0 && (
          <View className="bg-[#121212] rounded-[20px] p-6 items-center mb-4">
            <Ionicons name="barbell-outline" size={32} color="#A0A0A0" />
            <Text className="text-[#A0A0A0] text-sm mt-2 text-center">
              Add exercises to build your split.
            </Text>
          </View>
        )}

        {exercises.map((ex, index) => (
          <View
            key={`${ex.id}-${index}`}
            className="bg-[#121212] rounded-[20px] p-4 mb-3"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-white font-bold" numberOfLines={1}>
                  {ex.name}
                </Text>
                {ex.equipment.length > 0 && (
                  <Text className="text-[#A0A0A0] text-xs mt-0.5">
                    {ex.equipment.join(', ')}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => removeExercise(index)} activeOpacity={0.7} className="p-2">
                <Ionicons name="trash-outline" size={20} color="#E63946" />
              </TouchableOpacity>
            </View>
            <View className="flex-row items-center mt-3">
              <View className="flex-row items-center mr-4">
                <Text className="text-[#A0A0A0] text-xs font-semibold mr-2 uppercase">Sets</Text>
                <TextInput
                  value={String(ex.targetSets)}
                  onChangeText={(val) => {
                    const parsed = parseInt(val, 10);
                    updateExercise(index, { targetSets: Number.isNaN(parsed) ? 1 : parsed });
                  }}
                  keyboardType="numeric"
                  className="w-14 h-9 bg-[#1C1C1E] rounded-lg text-white text-center text-sm font-semibold"
                />
              </View>
              <View className="flex-row items-center">
                <Text className="text-[#A0A0A0] text-xs font-semibold mr-2 uppercase">Reps</Text>
                <TextInput
                  value={ex.targetReps !== null ? String(ex.targetReps) : ''}
                  onChangeText={(val) => {
                    if (val === '') {
                      updateExercise(index, { targetReps: null });
                      return;
                    }
                    const parsed = parseInt(val, 10);
                    if (!Number.isNaN(parsed)) updateExercise(index, { targetReps: parsed });
                  }}
                  keyboardType="numeric"
                  placeholder="—"
                  placeholderTextColor="#555"
                  className="w-14 h-9 bg-[#1C1C1E] rounded-lg text-white text-center text-sm font-semibold"
                />
              </View>
            </View>
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
      </ScrollView>
    </SafeAreaView>
  );
}

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
import { useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useWorkout, type PendingExercise } from '@/context/WorkoutContext';
import { client } from '@/src/api/client';

export default function CreateRoutineScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { pendingExercise, consumePendingExercise } = useWorkout();

  const [name, setName] = useState('');
  const [splitName, setSplitName] = useState('');
  const [exercises, setExercises] = useState<PendingExercise[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const pending = consumePendingExercise();
    if (pending) {
      setExercises((prev) => [...prev, pending]);
    }
  }, [pendingExercise, consumePendingExercise]);

  const removeExercise = (index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
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

    setSaving(true);
    try {
      await client.post('/api/routines', {
        name: name.trim(),
        splits: [
          {
            name: splitName.trim() || 'Split 1',
            exercises: exercises.map((ex, order) => ({
              wgerId: ex.wgerId || null,
              exerciseName: ex.name,
              equipment: ex.equipment,
              attachment: null,
              order,
            })),
          },
        ],
      });
      queryClient.invalidateQueries({ queryKey: ['routines'] });
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
            className="bg-[#121212] rounded-[20px] p-4 mb-3 flex-row items-center justify-between"
          >
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

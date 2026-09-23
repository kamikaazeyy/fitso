import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { usePowerSync } from '@powersync/react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/context/AuthContext';
import { CUSTOM_EXERCISES_TABLE } from '@/src/db/AppSchema';
import { uuid } from '@/src/utils/id';

const CATEGORIES = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Abs', 'Cardio', 'Other'];

// wger equipment names so attachment mappings keep working for custom entries.
const EQUIPMENT_OPTIONS = [
  'Barbell',
  'Dumbbell',
  'Cable machine',
  'Pull-up bar',
  'Resistance band',
  'Kettlebell',
  'Bench',
  'Machine',
  'Bodyweight',
];

const MUSCLE_OPTIONS = [
  'Chest',
  'Lats',
  'Back',
  'Shoulders',
  'Traps',
  'Biceps',
  'Triceps',
  'Forearms',
  'Abs',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
];

function ChipRow({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
}) {
  return (
    <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
      <Text className="text-[#A0A0A0] text-xs font-semibold uppercase mb-2.5">{label}</Text>
      <View className="flex-row flex-wrap">
        {options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <TouchableOpacity
              key={option}
              activeOpacity={0.7}
              onPress={() => onToggle(option)}
              className={`rounded-full px-3.5 py-2 mr-2 mb-2 border ${
                isSelected ? 'bg-[#E63946] border-[#E63946]' : 'bg-[#1C1C1E] border-[#2C2C2E]'
              }`}
            >
              <Text
                className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-[#A0A0A0]'}`}
              >
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function toggle(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];
}

export default function CustomExerciseScreen() {
  const router = useRouter();
  const db = usePowerSync();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [muscles, setMuscles] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give the exercise a name.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Not signed in', 'Sign in again and retry.');
      return;
    }

    setSaving(true);
    try {
      await db.execute(
        `INSERT INTO ${CUSTOM_EXERCISES_TABLE}
           (id, user_id, name, equipment, category, muscles, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid(),
          user.id,
          name.trim(),
          JSON.stringify(equipment),
          category,
          JSON.stringify(muscles),
          notes.trim() || null,
          new Date().toISOString(),
        ]
      );
      router.back();
    } catch (err) {
      Alert.alert('Failed to save', err instanceof Error ? err.message : 'Could not save exercise');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center justify-between px-4 py-4">
        <View className="flex-row items-center flex-1">
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            className="mr-3 p-2 rounded-full bg-[#1C1C1E]"
          >
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="text-white text-lg font-extrabold tracking-tight">Custom Exercise</Text>
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
          <Text className="text-[#A0A0A0] text-xs font-semibold uppercase mb-1.5">Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Meadows Row"
            placeholderTextColor="#555"
            className="text-white text-base"
            autoCapitalize="words"
          />
        </View>

        <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
          <Text className="text-[#A0A0A0] text-xs font-semibold uppercase mb-2.5">Category</Text>
          <View className="flex-row flex-wrap">
            {CATEGORIES.map((option) => {
              const isSelected = category === option;
              return (
                <TouchableOpacity
                  key={option}
                  activeOpacity={0.7}
                  onPress={() => setCategory(isSelected ? null : option)}
                  className={`rounded-full px-3.5 py-2 mr-2 mb-2 border ${
                    isSelected ? 'bg-[#E63946] border-[#E63946]' : 'bg-[#1C1C1E] border-[#2C2C2E]'
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-[#A0A0A0]'}`}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <ChipRow
          label="Equipment"
          options={EQUIPMENT_OPTIONS}
          selected={equipment}
          onToggle={(option) => setEquipment((prev) => toggle(prev, option))}
        />

        <ChipRow
          label="Primary muscles"
          options={MUSCLE_OPTIONS}
          selected={muscles}
          onToggle={(option) => setMuscles((prev) => toggle(prev, option))}
        />

        <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
          <Text className="text-[#A0A0A0] text-xs font-semibold uppercase mb-1.5">Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Form cues, setup details…"
            placeholderTextColor="#555"
            className="text-white text-base"
            multiline
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { displayWeight, type WeightUnit } from '@/src/utils/units';

const REST_PRESETS = [30, 60, 90, 120, 180, 300];
const BAR_PRESETS_KG = [20, 15, 10, 7.5];

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      className={`rounded-full px-4 py-2 mr-2 mb-2 border ${
        selected ? 'bg-[#E63946] border-[#E63946]' : 'bg-[#121212] border-[#2C2C2E]'
      }`}
    >
      <Text className={`text-sm font-semibold ${selected ? 'text-white' : 'text-[#A0A0A0]'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const weightUnit = useSettingsStore((s) => s.weightUnit);
  const defaultRestSeconds = useSettingsStore((s) => s.defaultRestSeconds);
  const defaultBarWeightKg = useSettingsStore((s) => s.defaultBarWeightKg);
  const setWeightUnit = useSettingsStore((s) => s.setWeightUnit);
  const setDefaultRestSeconds = useSettingsStore((s) => s.setDefaultRestSeconds);
  const setDefaultBarWeightKg = useSettingsStore((s) => s.setDefaultBarWeightKg);

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center px-4 py-4">
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          className="mr-3 p-2 rounded-full bg-[#1C1C1E]"
        >
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text className="text-white text-lg font-extrabold tracking-tight">Settings</Text>
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
          <Text className="text-white font-bold mb-1">Weight unit</Text>
          <Text className="text-[#A0A0A0] text-xs mb-3">
            Weights are stored in kg — this only changes how they're shown and entered.
          </Text>
          <View className="flex-row">
            {(['kg', 'lbs'] as WeightUnit[]).map((unit) => (
              <Chip
                key={unit}
                label={unit}
                selected={weightUnit === unit}
                onPress={() => setWeightUnit(unit)}
              />
            ))}
          </View>
        </View>

        <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
          <Text className="text-white font-bold mb-1">Default rest timer</Text>
          <Text className="text-[#A0A0A0] text-xs mb-3">
            Used when an exercise doesn't set its own rest time.
          </Text>
          <View className="flex-row flex-wrap">
            {REST_PRESETS.map((seconds) => (
              <Chip
                key={seconds}
                label={seconds >= 60 ? `${seconds / 60} min` : `${seconds}s`}
                selected={defaultRestSeconds === seconds}
                onPress={() => setDefaultRestSeconds(seconds)}
              />
            ))}
          </View>
        </View>

        <View className="bg-[#121212] rounded-[20px] p-4 mb-4">
          <Text className="text-white font-bold mb-1">Bar weight</Text>
          <Text className="text-[#A0A0A0] text-xs mb-3">Default bar for the plate calculator.</Text>
          <View className="flex-row flex-wrap">
            {BAR_PRESETS_KG.map((bar) => (
              <Chip
                key={bar}
                label={`${displayWeight(bar, weightUnit)} ${weightUnit}`}
                selected={defaultBarWeightKg === bar}
                onPress={() => setDefaultBarWeightKg(bar)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

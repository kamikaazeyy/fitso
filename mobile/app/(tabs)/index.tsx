import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { DatePickerStrip } from '@/components/DatePickerStrip';
import { WorkoutCharts } from '@/components/WorkoutCharts';
import { useWorkouts } from '@/src/hooks/useWorkouts';
import { showAlert } from '@/src/utils/alert';
import { colors } from '@/constants/theme';

export default function HomeScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { data: workouts, isLoading, error } = useWorkouts();
  const chartsStatus = isLoading ? 'loading' : error || !workouts || workouts.length === 0 ? 'empty' : 'data';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between pt-6 pb-4">
          <TouchableOpacity
            activeOpacity={0.85}
            className="flex-row items-center bg-[#E63946] rounded-full px-4 py-2.5"
            onPress={() => showAlert('Coming soon', 'Explore feature is under development.')}
          >
            <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
            <Text className="text-white font-semibold text-sm ml-2">Explore</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            className="p-2"
            onPress={() => showAlert('Coming soon', 'Stats dashboard is under development.')}
          >
            <Ionicons name="stats-chart" size={24} color="#E63946" />
          </TouchableOpacity>
        </View>

        {/* Date Picker Strip */}
        <View className="mb-5">
          <DatePickerStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        </View>

        {/* Workout activity */}
        <WorkoutCharts data={workouts} status={chartsStatus} error={error?.message ?? null} />

        {/* Start Workout CTA */}
        <TouchableOpacity
          activeOpacity={0.85}
          className="bg-[#E63946] rounded-[20px] flex-row items-center justify-center py-4 mb-4"
          onPress={() => router.push('/workout')}
        >
          <Ionicons name="barbell" size={20} color="#FFFFFF" />
          <Text className="text-white font-bold text-base ml-2">Start Workout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

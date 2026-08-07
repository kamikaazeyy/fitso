import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { DatePickerStrip } from '@/components/DatePickerStrip';
import { SegmentedCalorieRing } from '@/components/SegmentedCalorieRing';
import { LoadableContainer } from '@/components/LoadableContainer';
import { useLoadableData } from '@/hooks/useLoadableData';
import { colors } from '@/constants/theme';

const NUTRITION_DATA = {
  dayLabel: 'Day 12',
  calories: { current: 640, target: 1500 },
  macros: [
    { label: 'Carbs', current: 80, target: 160, color: '#38BDF8' },
    { label: 'Proteins', current: 55, target: 75, color: '#FACC15' },
    { label: 'Fats', current: 9, target: 30, color: '#C084FC' },
  ],
};

const MEAL_DATA = {
  promo: {
    title: "It's time to customize your",
    subtitle: 'Grocery List & Recipes',
    date: 'Sep 16 - Sep 20',
    emojis: ['🥦', '🍎', '🌽'],
  },
  item: {
    duration: '10 min',
    calories: 450,
  },
};

async function fetchHomeNutrition(): Promise<typeof NUTRITION_DATA> {
  return NUTRITION_DATA;
}

async function fetchHomeMeals(): Promise<typeof MEAL_DATA> {
  return MEAL_DATA;
}

function MacroIconBars({ color }: { color: string }) {
  return (
    <View className="w-5 h-5 mr-3 items-end justify-center">
      <View className="w-5 h-1 rounded-full mb-0.5" style={{ backgroundColor: color }} />
      <View className="w-3 h-1 rounded-full mb-0.5" style={{ backgroundColor: color }} />
      <View className="w-4 h-1 rounded-full" style={{ backgroundColor: color }} />
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());

  const nutrition = useLoadableData(fetchHomeNutrition, [], { loadingDelay: 600 });
  const meals = useLoadableData(fetchHomeMeals, [], { loadingDelay: 800 });

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
            onPress={() => Alert.alert('Coming soon', 'Explore feature is under development.')}
          >
            <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
            <Text className="text-white font-semibold text-sm ml-2">Explore</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            className="p-2"
            onPress={() => Alert.alert('Coming soon', 'Stats dashboard is under development.')}
          >
            <Ionicons name="stats-chart" size={24} color="#E63946" />
          </TouchableOpacity>
        </View>

        {/* Date Picker Strip */}
        <View className="mb-5">
          <DatePickerStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        </View>

        {/* Calorie Ring + Macros Card */}
        <LoadableContainer
          status={nutrition.status}
          loadingMessage="Loading nutrition..."
          emptyIcon="flame-outline"
          emptyTitle="No nutrition logged"
          emptySubtitle="Start tracking your calories and macros."
          error={nutrition.error}
          onRetry={nutrition.retry}
        >
          {nutrition.status === 'data' && nutrition.data && (
            <View className="bg-[#121212] rounded-[24px] p-5 mb-4">
              <View className="flex-row items-center">
                <SegmentedCalorieRing
                  calories={nutrition.data.calories}
                  macros={nutrition.data.macros}
                  dayLabel={nutrition.data.dayLabel}
                  size={210}
                  strokeWidth={16}
                />

                {/* Macro Stats */}
                <View className="flex-1 ml-2">
                  {nutrition.data.macros.map((macro) => (
                    <View key={macro.label} className="flex-row items-center mb-4">
                      <MacroIconBars color={macro.color} />
                      <View>
                        <Text className="text-white text-base font-bold">
                          {macro.current}/{macro.target}g
                        </Text>
                        <Text style={{ color: macro.color }} className="text-xs font-medium">
                          {macro.label}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}
        </LoadableContainer>

        {/* Check Calories Input */}
        <View
          className="flex-row items-center justify-between px-4 py-4 mb-4 rounded-[20px] bg-black"
          style={{
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: '#2C2C2E',
          }}
        >
          <Text className="text-[#A0A0A0] text-sm font-medium">Check calories</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            className="p-1"
            onPress={() => Alert.alert('Coming soon', 'Camera calorie scan is under development.')}
          >
            <Ionicons name="camera-outline" size={20} color="#A0A0A0" />
          </TouchableOpacity>
        </View>

        {/* Daily Meal Section */}
        <View className="mb-3">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-white text-2xl font-bold">Daily meal</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-row items-center"
              onPress={() => Alert.alert('Coming soon', 'Meal plan editor is under development.')}
            >
              <Text className="text-[#E63946] text-sm font-semibold mr-1.5">Edit plan</Text>
              <Ionicons name="calendar-outline" size={18} color="#E63946" />
            </TouchableOpacity>
          </View>

          <LoadableContainer
            status={meals.status}
            loadingMessage="Loading meals..."
            emptyIcon="restaurant-outline"
            emptyTitle="No meals planned"
            emptySubtitle="Add a meal to your daily plan."
            error={meals.error}
            onRetry={meals.retry}
          >
            {meals.status === 'data' && meals.data && (
              <>
                {/* Promo Card */}
                <View
                  className="rounded-[24px] p-5 mb-3"
                  style={{ backgroundColor: '#6EE7B7' }}
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-4">
                      <Text className="text-black text-lg font-bold leading-6">
                        {meals.data.promo.title}
                      </Text>
                      <View className="flex-row items-center mt-1">
                        <Text className="text-black text-lg font-bold mr-1">
                          {meals.data.promo.subtitle}
                        </Text>
                        <Ionicons name="chevron-forward" size={18} color="#000000" />
                      </View>
                      <View className="flex-row items-center mt-3">
                        <Ionicons name="calendar-outline" size={14} color="#000000" />
                        <Text className="text-black text-sm font-medium ml-2">
                          {meals.data.promo.date}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row flex-wrap justify-end" style={{ width: 90 }}>
                      {meals.data.promo.emojis.map((emoji, idx) => (
                        <View
                          key={idx}
                          className="w-11 h-11 rounded-full bg-white/40 items-center justify-center m-1"
                        >
                          <Text className="text-2xl">{emoji}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>

                {/* Meal Item Card */}
                <View className="bg-[#121212] rounded-[20px] p-4 flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View className="w-9 h-9 rounded-full bg-[#1C1C1E] items-center justify-center mr-3">
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    </View>
                    <Text className="text-white text-sm font-semibold">
                      {meals.data.item.duration} · {meals.data.item.calories} kcal
                    </Text>
                  </View>
                  <View className="w-20 h-12 rounded-xl bg-[#2C2C2E]" />
                </View>
              </>
            )}
          </LoadableContainer>
        </View>

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

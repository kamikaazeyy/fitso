import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { CircularProgressBase } from 'react-native-circular-progress-indicator';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LoadableContainer } from './LoadableContainer';
import { showComingSoon } from '@/lib/alerts';
import type { LoadableStatus } from '@/hooks/useLoadableData';

export interface Macro {
  id: string;
  label: string;
  current: number;
  target: number;
  color: string;
}

export interface FoodItem {
  id: string;
  name: string;
  serving: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface Meal {
  id: string;
  label: string;
  icon: string;
  items: FoodItem[];
}

export interface NutritionData {
  date: string;
  calories: {
    consumed: number;
    target: number;
  };
  macros: Macro[];
  meals: Meal[];
}

export const DUMMY_NUTRITION: NutritionData = {
  date: 'Today',
  calories: {
    consumed: 1850,
    target: 2400,
  },
  macros: [
    { id: 'm1', label: 'Carbs', current: 120, target: 250, color: '#38BDF8' },
    { id: 'm2', label: 'Proteins', current: 145, target: 180, color: '#FACC15' },
    { id: 'm3', label: 'Fats', current: 65, target: 80, color: '#C084FC' },
  ],
  meals: [
    {
      id: 'meal1',
      label: 'Breakfast',
      icon: 'cafe-outline',
      items: [
        { id: 'f1', name: 'Oatmeal with Berries', serving: '1 bowl', calories: 320, protein: 12, carbs: 54, fats: 6 },
        { id: 'f2', name: 'Greek Yogurt', serving: '150g', calories: 130, protein: 17, carbs: 9, fats: 4 },
        { id: 'f3', name: 'Almonds', serving: '20g', calories: 115, protein: 4, carbs: 4, fats: 10 },
      ],
    },
    {
      id: 'meal2',
      label: 'Lunch',
      icon: 'sunny-outline',
      items: [
        { id: 'f4', name: 'Grilled Chicken Breast', serving: '200g', calories: 330, protein: 62, carbs: 0, fats: 7 },
        { id: 'f5', name: 'Brown Rice', serving: '1 cup', calories: 215, protein: 5, carbs: 45, fats: 2 },
        { id: 'f6', name: 'Steamed Broccoli', serving: '100g', calories: 35, protein: 3, carbs: 7, fats: 0 },
      ],
    },
    {
      id: 'meal3',
      label: 'Dinner',
      icon: 'moon-outline',
      items: [
        { id: 'f7', name: 'Salmon Fillet', serving: '180g', calories: 367, protein: 40, carbs: 0, fats: 22 },
        { id: 'f8', name: 'Sweet Potato', serving: '1 medium', calories: 112, protein: 2, carbs: 26, fats: 0 },
      ],
    },
    {
      id: 'meal4',
      label: 'Snacks',
      icon: 'restaurant-outline',
      items: [
        { id: 'f9', name: 'Protein Shake', serving: '1 scoop', calories: 120, protein: 24, carbs: 3, fats: 1 },
        { id: 'f10', name: 'Banana', serving: '1 medium', calories: 105, protein: 1, carbs: 27, fats: 0 },
      ],
    },
  ],
};

interface CalorieMacroTrackerProps {
  data: NutritionData | null;
  status: LoadableStatus;
}

function NutritionContent({ data }: { data: NutritionData }) {
  const { calories, macros, meals } = data;
  const remaining = calories.target - calories.consumed;
  const caloriePercent = Math.round((calories.consumed / calories.target) * 100);

  return (
    <View>
      {/* Top Row: Calorie Ring + Macro List */}
      <View className="flex-row items-center">
        {/* Calorie Ring */}
        <View className="items-center justify-center mr-5">
          <CircularProgressBase
            value={caloriePercent}
            maxValue={100}
            radius={60}
            activeStrokeWidth={12}
            inActiveStrokeWidth={12}
            activeStrokeColor="#E63946"
            inActiveStrokeColor="#2C2C2E"
            strokeLinecap="round"
            duration={1200}
          >
            <View className="items-center justify-center">
              <Text className="text-white text-2xl font-extrabold" style={{ letterSpacing: -1 }}>
                {calories.consumed}
              </Text>
              <Text className="text-[#A0A0A0] text-xs font-medium mt-0.5">
                of {calories.target}
              </Text>
              <Text className="text-[#E63946] text-xs font-bold mt-1">
                {remaining} kcal left
              </Text>
            </View>
          </CircularProgressBase>
        </View>

        {/* Macro Breakdown */}
        <View className="flex-1">
          {macros.map((macro) => {
            const macroPercent = Math.round((macro.current / macro.target) * 100);
            return (
              <View key={macro.id} className="mb-3">
                <View className="flex-row items-center justify-between mb-1.5">
                  <View className="flex-row items-center">
                    <View
                      className="w-2.5 h-2.5 rounded-full mr-2"
                      style={{ backgroundColor: macro.color }}
                    />
                    <Text className="text-white text-sm font-semibold">{macro.label}</Text>
                  </View>
                  <Text className="text-[#A0A0A0] text-sm font-medium">
                    <Text className="text-white font-bold">{macro.current}</Text>
                    {' / '}
                    {macro.target}g
                  </Text>
                </View>
                {/* Progress Bar */}
                <View className="h-1.5 bg-[#2C2C2E] rounded-full overflow-hidden">
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(macroPercent, 100)}%`,
                      backgroundColor: macro.color,
                    }}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Divider */}
      <View className="h-px bg-[#2C2C2E] my-4" />

      {/* Meals List */}
      <View>
        {meals.map((meal) => {
          const totalCalories = meal.items.reduce((sum, item) => sum + item.calories, 0);
          const isEmptyMeal = meal.items.length === 0;
          return (
            <View key={meal.id} className="mb-3">
              {/* Meal Header */}
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-lg bg-[#1C1C1E] items-center justify-center mr-2.5">
                    <Ionicons name={meal.icon as any} size={16} color="#E63946" />
                  </View>
                  <Text className="text-white text-sm font-bold">{meal.label}</Text>
                </View>
                <Text className="text-[#A0A0A0] text-xs font-medium">
                  {totalCalories} kcal
                </Text>
              </View>

              {/* Food Items */}
              {isEmptyMeal ? (
                <View className="py-2 px-3 mb-1.5">
                  <Text className="text-[#A0A0A0] text-xs">No foods logged yet.</Text>
                </View>
              ) : (
                meal.items.map((item) => (
                  <View
                    key={item.id}
                    className="flex-row items-center justify-between py-2.5 px-3 mb-1.5 bg-[#1C1C1E] rounded-xl"
                  >
                    <View className="flex-1">
                      <Text className="text-white text-sm font-semibold">{item.name}</Text>
                      <Text className="text-[#A0A0A0] text-xs mt-0.5">
                        {item.serving} · P{item.protein}g · C{item.carbs}g · F{item.fats}g
                      </Text>
                    </View>
                    <Text className="text-white text-sm font-bold ml-2">
                      {item.calories}
                    </Text>
                  </View>
                ))
              )}

              {/* Add Food Button */}
              <TouchableOpacity
                activeOpacity={0.7}
                className="flex-row items-center py-2.5 px-3 rounded-xl border border-dashed border-[#2C2C2E]"
                onPress={() => showComingSoon('Food logging is under development.')}
              >
                <Ionicons name="add" size={16} color="#E63946" />
                <Text className="text-[#E63946] font-semibold text-sm ml-2">Add Food</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function CalorieMacroTracker({ data, status }: CalorieMacroTrackerProps) {
  return (
    <View className="bg-[#121212] rounded-[20px] p-5 mb-3">
      {/* Section Label */}
      <Text className="text-[#A0A0A0] text-xs font-semibold uppercase tracking-widest mb-4">
        Nutrition
      </Text>

      <LoadableContainer
        status={status}
        loadingMessage="Loading nutrition..."
        emptyIcon="nutrition-outline"
        emptyTitle="No nutrition data"
        emptySubtitle="Log your first meal to see macros and calories."
      >
        {data && status === 'data' ? <NutritionContent data={data} /> : null}
      </LoadableContainer>
    </View>
  );
}

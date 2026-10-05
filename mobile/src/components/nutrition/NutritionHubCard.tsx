import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface NutritionHubCardProps {
  dateRange?: string;
  groceryItemCount?: number;
  recipeCount?: number;
}

export function NutritionHubCard({
  dateRange = 'Sep 16 - 20',
  groceryItemCount = 14,
  recipeCount = 4,
}: NutritionHubCardProps) {
  const handleOpenGrocery = () => {
    Alert.alert(
      'Grocery List',
      '• Chicken Breast (1.5 kg)\n• Whole Eggs (12 pk)\n• Greek Yogurt (500g)\n• Rolled Oats (1 kg)\n• Jasmine Rice\n• Olive Oil',
      [{ text: 'Close' }]
    );
  };

  const handleOpenRecipes = () => {
    Alert.alert(
      'Recipes & Meal Prep',
      '• High-Protein Overnight Oats (420 kcal · 35g P)\n• Grilled Chicken & Avocado Rice (650 kcal · 52g P)\n• Baked Salmon & Sweet Potato (580 kcal · 44g P)',
      [{ text: 'Close' }]
    );
  };

  return (
    <View className="bg-[#121214] border border-[#222226] rounded-[24px] p-5 mb-3">
      {/* Top Header Row */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center bg-[#18181B] border border-[#27272A] px-3 py-1 rounded-full">
          <View className="w-2 h-2 rounded-full bg-[#10B981] mr-2" />
          <Text className="text-[#A1A1AA] text-[11px] font-bold uppercase tracking-wider">
            Nutrition Hub
          </Text>
        </View>

        <View className="flex-row items-center bg-[#18181B] border border-[#27272A] px-2.5 py-1 rounded-full">
          <Ionicons name="calendar-outline" size={12} color="#71717A" />
          <Text className="text-[#A1A1AA] text-xs font-semibold ml-1.5">{dateRange}</Text>
        </View>
      </View>

      {/* Dual Action Tiles */}
      <View className="gap-y-2.5">
        {/* 1. Grocery List Tile */}
        <TouchableOpacity
          activeOpacity={0.75}
          className="bg-[#18181B] border border-[#27272A] rounded-[18px] p-3.5 flex-row items-center justify-between"
          onPress={handleOpenGrocery}
        >
          <View className="flex-row items-center flex-1">
            <View className="w-10 h-10 rounded-xl bg-[#10B981]/15 border border-[#10B981]/30 items-center justify-center mr-3">
              <Ionicons name="cart-outline" size={20} color="#34D399" />
            </View>
            <View className="flex-1">
              <Text className="text-white text-sm font-bold">Grocery List</Text>
              <Text className="text-[#71717A] text-xs mt-0.5">{groceryItemCount} items to shop</Text>
            </View>
          </View>
          <View className="flex-row items-center">
            <View className="bg-[#27272A] px-2.5 py-1 rounded-lg mr-2">
              <Text className="text-[#A1A1AA] text-[11px] font-bold">{groceryItemCount}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#71717A" />
          </View>
        </TouchableOpacity>

        {/* 2. Recipes & Meal Prep Tile */}
        <TouchableOpacity
          activeOpacity={0.75}
          className="bg-[#18181B] border border-[#27272A] rounded-[18px] p-3.5 flex-row items-center justify-between"
          onPress={handleOpenRecipes}
        >
          <View className="flex-row items-center flex-1">
            <View className="w-10 h-10 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/30 items-center justify-center mr-3">
              <Ionicons name="restaurant-outline" size={20} color="#FBBF24" />
            </View>
            <View className="flex-1">
              <Text className="text-white text-sm font-bold">Recipes & Prep</Text>
              <Text className="text-[#71717A] text-xs mt-0.5">{recipeCount} custom meals planned</Text>
            </View>
          </View>
          <View className="flex-row items-center">
            <View className="bg-[#27272A] px-2.5 py-1 rounded-lg mr-2">
              <Text className="text-[#A1A1AA] text-[11px] font-bold">{recipeCount}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#71717A" />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

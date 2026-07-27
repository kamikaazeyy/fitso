import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';

interface MacroSegment {
  label: string;
  current: number;
  target: number;
  color: string;
}

interface SegmentedCalorieRingProps {
  calories: { current: number; target: number };
  macros: MacroSegment[];
  dayLabel: string;
  size?: number;
  strokeWidth?: number;
  gap?: number;
}

const CALORIES_PER_GRAM: Record<string, number> = {
  carbs: 4,
  protein: 4,
  fats: 9,
  fat: 9,
};

function getMacroCalories(macro: MacroSegment) {
  const factor = CALORIES_PER_GRAM[macro.label.toLowerCase()] ?? 4;
  return macro.current * factor;
}

function getMacroTargetCalories(macro: MacroSegment) {
  const factor = CALORIES_PER_GRAM[macro.label.toLowerCase()] ?? 4;
  return macro.target * factor;
}

export function SegmentedCalorieRing({
  calories,
  macros,
  dayLabel,
  size = 220,
  strokeWidth = 18,
  gap = 24,
}: SegmentedCalorieRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const totalAvailable = circumference - macros.length * gap;

  const totalTargetCalories = macros.reduce(
    (sum, m) => sum + getMacroTargetCalories(m),
    0
  ) || 1;

  return (
    <View className="items-center justify-center" style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        {/* Dark background track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#2C2C2E"
          strokeWidth={strokeWidth}
          fill="transparent"
        />

        {/* Segmented macro arcs */}
        {macros.reduce<{ elements: React.ReactNode[]; offset: number }>(
          (acc, macro) => {
            const targetCalories = getMacroTargetCalories(macro);
            const currentCalories = getMacroCalories(macro);
            const baseLength = (targetCalories / totalTargetCalories) * totalAvailable;
            const segmentLength = (currentCalories / totalTargetCalories) * totalAvailable;
            const element = (
              <Circle
                key={macro.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={macro.color}
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeLinecap="round"
                strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                strokeDashoffset={-acc.offset}
              />
            );
            const fullSegment = baseLength + gap;
            return { elements: [...acc.elements, element], offset: acc.offset + fullSegment };
          },
          { elements: [], offset: 0 }
        ).elements}
      </Svg>

      {/* Center content */}
      <View className="absolute items-center justify-center">
        <View className="bg-[#2C2C2E] px-3 py-1 rounded-lg mb-2">
          <Text className="text-white text-xs font-bold">{dayLabel}</Text>
        </View>
        <View className="flex-row items-center">
          <Ionicons name="flame" size={20} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text className="text-white text-5xl font-extrabold" style={{ letterSpacing: -2 }}>
            {calories.current}
          </Text>
        </View>
        <Text className="text-[#A0A0A0] text-sm font-medium mt-1">
          {calories.target} kcal
        </Text>
      </View>
    </View>
  );
}

import React, { useEffect } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SET_TYPE_LABELS, type ActiveSet, type SetType } from '@/src/types/workout';

const SET_TYPE_COLORS: Record<SetType, string> = {
  NORMAL: '#FFFFFF',
  WARMUP: '#FFD600',
  DROP: '#00E5FF',
  FAILURE: '#E63946',
};

export interface SetRowProps {
  set: ActiveSet;
  onChangeWeight: (value: string) => void;
  onChangeReps: (value: string) => void;
  onCycleSetType: () => void;
  onToggleComplete: () => void;
}

function formatGhost(weight?: number, reps?: number): string {
  if (weight === undefined && reps === undefined) return '—';
  const weightLabel = weight !== undefined ? `${weight}kg` : '—';
  const repsLabel = reps !== undefined ? `${reps}` : '—';
  return `${weightLabel} × ${repsLabel}`;
}

export function SetRow({
  set,
  onChangeWeight,
  onChangeReps,
  onCycleSetType,
  onToggleComplete,
}: SetRowProps) {
  const completion = useSharedValue(set.isCompleted ? 1 : 0);

  useEffect(() => {
    completion.value = withTiming(set.isCompleted ? 1 : 0, { duration: 220 });
  }, [set.isCompleted, completion]);

  const checkStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(completion.value, [0, 1], ['#1C1C1E', '#4ADE80']),
    transform: [{ scale: 1 + completion.value * 0.06 }],
  }));

  const rowStyle = useAnimatedStyle(() => ({
    opacity: 1 - completion.value * 0.45,
  }));

  const typeLabel = SET_TYPE_LABELS[set.setType];

  return (
    <Animated.View className="flex-row items-center mb-2" style={rowStyle}>
      <TouchableOpacity
        accessibilityLabel={`set-type-${set.setIndex}`}
        onPress={onCycleSetType}
        activeOpacity={0.7}
        className="w-10 h-10 rounded-lg bg-fitso-surface items-center justify-center"
      >
        <Text className="text-sm font-bold" style={{ color: SET_TYPE_COLORS[set.setType] }}>
          {typeLabel || set.setIndex}
        </Text>
      </TouchableOpacity>

      <Text className="text-fitso-label text-sm font-medium flex-1 px-2" numberOfLines={1}>
        {formatGhost(set.previousWeight, set.previousReps)}
      </Text>

      <TextInput
        accessibilityLabel={`weight-${set.setIndex}`}
        value={set.weight === null ? '' : String(set.weight)}
        onChangeText={onChangeWeight}
        keyboardType="decimal-pad"
        placeholder={set.previousWeight !== undefined ? String(set.previousWeight) : '—'}
        placeholderTextColor="#555"
        className="w-16 h-10 bg-fitso-surface rounded-lg text-white text-center text-sm font-semibold mr-2 px-2"
      />

      <TextInput
        accessibilityLabel={`reps-${set.setIndex}`}
        value={set.reps === null ? '' : String(set.reps)}
        onChangeText={onChangeReps}
        keyboardType="number-pad"
        placeholder={set.previousReps !== undefined ? String(set.previousReps) : '—'}
        placeholderTextColor="#555"
        className="w-16 h-10 bg-fitso-surface rounded-lg text-white text-center text-sm font-semibold mr-2 px-2"
      />

      <TouchableOpacity
        accessibilityLabel={`complete-${set.setIndex}`}
        onPress={onToggleComplete}
        activeOpacity={0.7}
      >
        <Animated.View className="w-10 h-10 rounded-lg items-center justify-center" style={checkStyle}>
          <Ionicons name="checkmark" size={18} color={set.isCompleted ? '#000000' : '#555'} />
        </Animated.View>
      </TouchableOpacity>

      {set.isPersonalRecord && (
        <View className="absolute -top-1 right-11 px-1.5 rounded bg-fitso-cta">
          <Text className="text-[9px] font-extrabold text-white">PR</Text>
        </View>
      )}
    </Animated.View>
  );
}

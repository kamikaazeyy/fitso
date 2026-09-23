import React, { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SET_TYPE_LABELS, type ActiveSet, type SetType } from '@/src/types/workout';
import { displayWeight, parseWeightInput, type WeightUnit } from '@/src/utils/units';

const SET_TYPE_COLORS: Record<SetType, string> = {
  NORMAL: '#FFFFFF',
  WARMUP: '#FFD600',
  DROP: '#00E5FF',
  FAILURE: '#E63946',
};

export interface SetRowProps {
  set: ActiveSet;
  unit?: WeightUnit;
  onChangeWeight: (value: string) => void;
  onChangeReps: (value: string) => void;
  onChangeRpe: (value: string) => void;
  onCycleSetType: () => void;
  onToggleComplete: () => void;
  /** Preformatted "previous" hint (e.g. from session history) — overrides the ghost display. */
  hint?: string;
}

function formatGhost(
  weight: number | undefined,
  reps: number | undefined,
  unit: WeightUnit
): string {
  if (weight === undefined && reps === undefined) return '—';
  const shown = weight !== undefined ? displayWeight(weight, unit) : null;
  const weightLabel = shown !== null ? `${shown}${unit}` : '—';
  const repsLabel = reps !== undefined ? `${reps}` : '—';
  return `${weightLabel} × ${repsLabel}`;
}

export function SetRow({
  set,
  unit = 'kg',
  onChangeWeight,
  onChangeReps,
  onChangeRpe,
  onCycleSetType,
  onToggleComplete,
  hint,
}: SetRowProps) {
  const completion = useSharedValue(set.isCompleted ? 1 : 0);

  const toText = (kg: number | null | undefined): string => {
    const shown = displayWeight(kg, unit);
    return shown === null ? '' : String(shown);
  };

  // Local text state for the weight field: stored weight is canonical kg, so
  // echoing `set.weight` back through display conversion would mangle the text
  // mid-typing in lbs mode. Resync only when the stored value diverges from
  // what the field currently parses to (ghost fills, external resets).
  const [weightText, setWeightText] = useState(() => toText(set.weight));

  useEffect(() => {
    completion.value = withTiming(set.isCompleted ? 1 : 0, { duration: 220 });
  }, [set.isCompleted, completion]);

  useEffect(() => {
    if (parseWeightInput(weightText, unit) !== set.weight) {
      setWeightText(toText(set.weight));
    }
    // weightText intentionally omitted — resync only on external value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set.weight, unit]);

  const checkStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(completion.value, [0, 1], ['#1C1C1E', '#4ADE80']),
    transform: [{ scale: 1 + completion.value * 0.06 }],
  }));

  const rowStyle = useAnimatedStyle(() => ({
    opacity: 1 - completion.value * 0.45,
  }));

  const typeLabel = SET_TYPE_LABELS[set.setType];
  const previousDisplay = hint ?? formatGhost(set.previousWeight, set.previousReps, unit);
  const weightPlaceholder = toText(set.previousWeight) || '—';

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
        {previousDisplay}
      </Text>

      <TextInput
        // Remount on ghost change: Android keeps the placeholder from first render.
        key={`weight-${set.previousWeight ?? 'none'}-${unit}`}
        accessibilityLabel={`weight-${set.setIndex}`}
        value={weightText}
        onChangeText={(val) => {
          setWeightText(val);
          onChangeWeight(val);
        }}
        keyboardType="decimal-pad"
        placeholder={weightPlaceholder}
        placeholderTextColor="#555"
        className="w-14 h-10 bg-fitso-surface rounded-lg text-white text-center text-sm font-semibold mr-2 px-1"
      />

      <TextInput
        key={`reps-${set.previousReps ?? 'none'}`}
        accessibilityLabel={`reps-${set.setIndex}`}
        value={set.reps === null ? '' : String(set.reps)}
        onChangeText={onChangeReps}
        keyboardType="number-pad"
        placeholder={set.previousReps !== undefined ? String(set.previousReps) : '—'}
        placeholderTextColor="#555"
        className="w-14 h-10 bg-fitso-surface rounded-lg text-white text-center text-sm font-semibold mr-2 px-1"
      />

      <TextInput
        accessibilityLabel={`rpe-${set.setIndex}`}
        value={set.rpe === null ? '' : String(set.rpe)}
        onChangeText={onChangeRpe}
        keyboardType="decimal-pad"
        placeholder="RPE"
        placeholderTextColor="#555"
        className="w-11 h-10 bg-fitso-surface rounded-lg text-white text-center text-xs font-semibold mr-2 px-1"
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

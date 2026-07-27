import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { CircularProgressBase } from 'react-native-circular-progress-indicator';

interface MetricScoreRingProps {
  score: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  sublabel?: string;
  style?: ViewStyle;
}

export function MetricScoreRing({
  score,
  max = 100,
  size = 220,
  strokeWidth = 18,
  color = '#00E5FF',
  label = 'Score',
  sublabel = 'Excellent',
  style,
}: MetricScoreRingProps) {
  const progressProps = {
    radius: (size - strokeWidth) / 2,
    activeStrokeWidth: strokeWidth,
    inActiveStrokeWidth: strokeWidth,
    activeStrokeColor: color,
    inActiveStrokeColor: '#2C2C2E',
    strokeLinecap: 'round' as const,
    value: score,
    maxValue: max,
    duration: 1200,
    clockwise: true,
  };

  return (
    <View
      className="items-center justify-center"
      style={[{ width: size, height: size }, style]}
    >
      <CircularProgressBase {...progressProps}>
        <View className="items-center justify-center" style={{ width: size, height: size }}>
          <Text className="text-fitso-label text-xs font-medium uppercase tracking-widest">
            {label}
          </Text>
          <Text
            className="text-fitso-white text-5xl font-extrabold mt-1"
            style={{ letterSpacing: -2 }}
          >
            {Math.round(score)}
          </Text>
          <Text className="text-fitso-label text-sm font-medium mt-1">
            {sublabel}
          </Text>
        </View>
      </CircularProgressBase>
    </View>
  );
}

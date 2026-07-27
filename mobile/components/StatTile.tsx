import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GlassCard } from './GlassCard';

interface StatTileProps {
  title: string;
  value: string | number;
  unit: string;
  trend?: number;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  color?: string;
  style?: ViewStyle;
}

export function StatTile({
  title,
  value,
  unit,
  trend = 0,
  icon: Icon,
  color = '#00E5FF',
  style,
}: StatTileProps) {
  const trendIconName: 'trending-up' | 'trending-down' | 'remove' =
    trend > 0 ? 'trending-up' : trend < 0 ? 'trending-down' : 'remove';
  const trendLabel = trend === 0 ? '—' : `${Math.abs(trend)}%`;
  const trendColor = trend > 0 ? '#00E5FF' : trend < 0 ? '#E63946' : '#A0A0A0';

  return (
    <GlassCard className="flex-1 min-w-[48%]" style={style}>
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-fitso-label text-xs font-medium uppercase tracking-widest">
          {title}
        </Text>
        {Icon ? <Icon size={18} color={color} /> : null}
      </View>
      <View className="flex-row items-baseline">
        <Text
          className="text-fitso-white text-3xl font-extrabold"
          style={{ letterSpacing: -0.5 }}
        >
          {value}
        </Text>
        <Text className="text-fitso-label text-sm font-medium ml-1">{unit}</Text>
      </View>
      <View className="flex-row items-center mt-3">
        <Ionicons name={trendIconName} size={14} color={trendColor} />
        <Text className="text-xs font-medium ml-1" style={{ color: trendColor }}>
          {trendLabel}
        </Text>
      </View>
    </GlassCard>
  );
}

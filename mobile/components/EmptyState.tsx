import React from 'react';
import { View, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon = 'cube-outline', title, subtitle }: EmptyStateProps) {
  return (
    <View className="items-center justify-center py-12 px-6">
      <Ionicons name={icon as any} size={40} color="#2C2C2E" />
      <Text className="text-white text-base font-bold mt-4 text-center">{title}</Text>
      {subtitle ? (
        <Text className="text-[#A0A0A0] text-sm mt-2 text-center">{subtitle}</Text>
      ) : null}
    </View>
  );
}

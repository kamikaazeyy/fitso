import React from 'react';
import { View, Text } from 'react-native';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function ScreenHeader({ title, subtitle, className = 'pt-4 pb-2' }: ScreenHeaderProps) {
  return (
    <View className={className}>
      <Text className="text-white text-3xl font-extrabold tracking-tight">{title}</Text>
      {subtitle ? (
        <Text className="text-[#A0A0A0] text-sm mt-1">{subtitle}</Text>
      ) : null}
    </View>
  );
}

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface StackHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: React.ReactNode;
  className?: string;
}

export function StackHeader({
  title,
  subtitle,
  onBack,
  right,
  className = 'flex-row items-center justify-between px-4 py-4',
}: StackHeaderProps) {
  return (
    <View className={className}>
      <View className="flex-row items-center flex-1">
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.7}
          className="mr-3 p-2 rounded-full bg-[#1C1C1E]"
        >
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-white text-lg font-extrabold tracking-tight">{title}</Text>
          {subtitle ? (
            <Text className="text-[#A0A0A0] text-sm font-medium">{subtitle}</Text>
          ) : null}
        </View>
      </View>
      {right}
    </View>
  );
}

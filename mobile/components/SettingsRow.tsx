import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

interface SettingsRowProps {
  icon: IoniconsName;
  label: string;
  onPress: () => void;
}

export function SettingsRow({ icon, label, onPress }: SettingsRowProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      className="bg-[#121212] rounded-[20px] p-4 flex-row items-center justify-between mb-2"
      onPress={onPress}
    >
      <View className="flex-row items-center">
        <Ionicons name={icon} size={20} color="#E63946" />
        <Text className="text-white font-semibold ml-3">{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#A0A0A0" />
    </TouchableOpacity>
  );
}

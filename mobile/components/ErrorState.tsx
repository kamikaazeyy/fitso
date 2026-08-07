import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface ErrorStateProps {
  title?: string;
  message?: string | null;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  return (
    <View className="items-center justify-center py-12 px-6">
      <Ionicons name="warning-outline" size={40} color="#E63946" />
      <Text className="text-white text-base font-bold mt-4 text-center">{title}</Text>
      {message ? (
        <Text className="text-[#A0A0A0] text-sm mt-2 text-center">{message}</Text>
      ) : null}
      {onRetry ? (
        <TouchableOpacity
          onPress={onRetry}
          activeOpacity={0.8}
          className="mt-5 bg-[#1C1C1E] rounded-full px-5 py-2.5 flex-row items-center"
        >
          <Ionicons name="refresh" size={16} color="#E63946" />
          <Text className="text-[#E63946] text-sm font-semibold ml-2">Try again</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

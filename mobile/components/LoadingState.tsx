import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <View className="items-center justify-center py-12 px-6">
      <ActivityIndicator size="large" color="#E63946" />
      <Text className="text-[#A0A0A0] text-sm mt-4 text-center">{message}</Text>
    </View>
  );
}

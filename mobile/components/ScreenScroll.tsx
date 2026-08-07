import React from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';

interface ScreenScrollProps {
  children: React.ReactNode;
  bottomPadding?: number;
  className?: string;
}

export function ScreenScroll({
  children,
  bottomPadding = 120,
  className = 'flex-1 px-4',
}: ScreenScrollProps) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        className={className}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

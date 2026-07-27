import React from 'react';
import { View, ViewProps } from 'react-native';

interface GlassCardProps extends ViewProps {
  children: React.ReactNode;
}

export function GlassCard({ children, style, ...rest }: GlassCardProps) {
  return (
    <View
      className="rounded-3xl border border-fitso-border bg-fitso-surface p-4"
      style={[{ overflow: 'hidden' }, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

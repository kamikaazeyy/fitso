import React, { useEffect } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useRestTimer } from '@/src/hooks/useRestTimer';

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Floating rest countdown, mounted once at the router root so it survives
 * navigation between screens while a session is running.
 */
export function RestTimerBar() {
  const { isResting, remainingSeconds, progress, skipRest, addTime } = useRestTimer();

  const fill = useSharedValue(0);
  const reveal = useSharedValue(0);

  useEffect(() => {
    fill.value = withTiming(Math.min(1, Math.max(0, progress)), { duration: 260 });
  }, [progress, fill]);

  useEffect(() => {
    reveal.value = withTiming(isResting ? 1 : 0, { duration: 200 });
  }, [isResting, reveal]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%`,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 24 }],
  }));

  if (!isResting) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={containerStyle}
      className="absolute left-4 right-4 bottom-6"
    >
      <View className="rounded-2xl overflow-hidden bg-fitso-surfaceAlt border border-fitso-border">
        <View className="h-1 w-full bg-fitso-border">
          <Animated.View className="h-1 bg-fitso-cta" style={fillStyle} />
        </View>

        <View className="flex-row items-center justify-between px-4 py-3">
          <View>
            <Text className="text-fitso-label text-[11px] font-semibold uppercase tracking-wide">
              Rest
            </Text>
            <Text className="text-white text-2xl font-extrabold">
              {formatCountdown(remainingSeconds)}
            </Text>
          </View>

          <View className="flex-row items-center">
            <TouchableOpacity
              accessibilityLabel="rest-add-30"
              onPress={() => addTime(30)}
              activeOpacity={0.8}
              className="px-3 py-2 rounded-xl bg-fitso-surface mr-2"
            >
              <Text className="text-white text-sm font-bold">+30s</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="rest-skip"
              onPress={skipRest}
              activeOpacity={0.8}
              className="flex-row items-center px-3 py-2 rounded-xl bg-fitso-cta"
            >
              <Ionicons name="play-forward" size={14} color="#FFFFFF" />
              <Text className="text-white text-sm font-bold ml-1.5">Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

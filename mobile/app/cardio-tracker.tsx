import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { useCardioSessionStore } from '@/src/store/useCardioSessionStore';
import {
  startLocationTracking,
  stopLocationTracking,
  requestLocationPermissions,
} from '@/src/services/locationTracker';
import { ActivityMap } from '@/src/components/ActivityMap';
import { formatPace, formatSpeed, formatDistance } from '@/src/utils/geo';
import type { WorkoutType } from '@/src/types/workout';

function formatTimer(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function CardioTrackerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();

  const isActive = useCardioSessionStore((s) => s.isActive);
  const isPaused = useCardioSessionStore((s) => s.isPaused);
  const workoutType = useCardioSessionStore((s) => s.workoutType);
  const title = useCardioSessionStore((s) => s.title);
  const elapsedSeconds = useCardioSessionStore((s) => s.elapsedSeconds);
  const distanceMeters = useCardioSessionStore((s) => s.distanceMeters);
  const currentPace = useCardioSessionStore((s) => s.currentPaceSecondsPerKm);
  const avgPace = useCardioSessionStore((s) => s.avgPaceSecondsPerKm);
  const currentSpeed = useCardioSessionStore((s) => s.currentSpeedMps);
  const elevationGain = useCardioSessionStore((s) => s.elevationGainMeters);
  const coordinates = useCardioSessionStore((s) => s.coordinates);

  const startActivity = useCardioSessionStore((s) => s.startActivity);
  const togglePause = useCardioSessionStore((s) => s.togglePause);
  const incrementElapsedSeconds = useCardioSessionStore((s) => s.incrementElapsedSeconds);
  const finishActivity = useCardioSessionStore((s) => s.finishActivity);
  const discardActivity = useCardioSessionStore((s) => s.discardActivity);

  const [isFinishing, setIsFinishing] = useState(false);
  const [liveLocation, setLiveLocation] = useState<{
    latitude: number;
    longitude: number;
    heading?: number | null;
  } | null>(null);

  const hasInitializedRef = useRef(false);

  // Initialize activity once on mount if not already active
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    if (!useCardioSessionStore.getState().isActive) {
      const type = (params.type?.toUpperCase() as WorkoutType) || 'RUN';
      startActivity(type);
    }
  }, [params.type, startActivity]);

  // Start live foreground + background GPS updates
  useEffect(() => {
    let watcher: Location.LocationSubscription | null = null;
    let isMounted = true;

    const initGPS = async () => {
      const hasPerms = await requestLocationPermissions();
      if (!hasPerms) return;

      // 1. Immediately fetch user's real current location
      try {
        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (isMounted && initial) {
          const pt = {
            latitude: initial.coords.latitude,
            longitude: initial.coords.longitude,
            altitude: initial.coords.altitude,
            speed: initial.coords.speed,
            heading: initial.coords.heading,
            timestamp: initial.timestamp,
          };
          setLiveLocation(pt);
          if (useCardioSessionStore.getState().isActive && !useCardioSessionStore.getState().isPaused) {
            useCardioSessionStore.getState().addLocationPoint(pt);
          }
        }
      } catch (err) {
        console.warn('Could not get initial position:', err);
      }

      // 2. Start background task & live foreground location watcher
      startLocationTracking();

      try {
        watcher = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1000,
            distanceInterval: 2,
          },
          (loc) => {
            if (!isMounted) return;
            const pt = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              altitude: loc.coords.altitude,
              speed: loc.coords.speed,
              heading: loc.coords.heading,
              timestamp: loc.timestamp,
            };
            setLiveLocation(pt);
            if (useCardioSessionStore.getState().isActive && !useCardioSessionStore.getState().isPaused) {
              useCardioSessionStore.getState().addLocationPoint(pt);
            }
          }
        );
      } catch (err) {
        console.warn('Could not start live location watcher:', err);
      }
    };

    initGPS();

    return () => {
      isMounted = false;
      watcher?.remove();
      // Don't stop background tracking if session is still running
      if (!useCardioSessionStore.getState().isActive) {
        stopLocationTracking();
      }
    };
  }, []);

  // Live timer tick every 1000ms
  useEffect(() => {
    if (!isActive || isPaused) return;
    const interval = setInterval(() => {
      incrementElapsedSeconds(1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, isPaused]);

  const handleTogglePause = () => {
    togglePause();
  };

  const handleFinish = () => {
    Alert.alert('Finish Workout', 'Ready to complete this activity and view your summary?', [
      { text: 'Resume', style: 'cancel' },
      {
        text: 'Finish',
        style: 'default',
        onPress: async () => {
          try {
            setIsFinishing(true);
            await stopLocationTracking();
            const finishedId = await finishActivity();
            if (finishedId) {
              router.replace(`/workout-detail?workoutId=${finishedId}`);
            } else {
              router.replace('/(tabs)/journal');
            }
          } catch (err) {
            setIsFinishing(false);
            Alert.alert('Error', 'Failed to save workout. Please try again.');
          }
        },
      },
    ]);
  };

  const handleDiscard = () => {
    Alert.alert('Discard Activity?', 'All recorded GPS points and stats will be deleted.', [
      { text: 'Keep Tracking', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          await stopLocationTracking();
          discardActivity();
          router.replace('/(tabs)/journal');
        },
      },
    ]);
  };

  const lastPoint = coordinates[coordinates.length - 1];

  const activityIcon =
    workoutType === 'RIDE'
      ? 'bicycle'
      : workoutType === 'WALK'
      ? 'walk'
      : workoutType === 'HIIT'
      ? 'flame'
      : 'fitness';

  return (
    <View className="flex-1 bg-[#0A0A0C]">
      <StatusBar barStyle="light-content" />

      {/* Top Map HUD */}
      <View className="flex-1">
        <ActivityMap
          coordinates={coordinates}
          isLive={true}
          userLocation={
            liveLocation
              ? liveLocation
              : lastPoint
              ? {
                  latitude: lastPoint.latitude,
                  longitude: lastPoint.longitude,
                  heading: lastPoint.heading,
                }
              : null
          }
        />

        {/* Floating Header */}
        <SafeAreaView className="absolute top-0 left-0 right-0 px-4 pt-2">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              activeOpacity={0.8}
              className="w-10 h-10 rounded-full bg-[#1C1C1E]/90 border border-[#3A3A3C] items-center justify-center"
              onPress={() => router.back()}
            >
              <Ionicons name="chevron-down" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <View className="flex-row items-center bg-[#1C1C1E]/90 px-3.5 py-2 rounded-full border border-[#3A3A3C]">
              <Ionicons name={activityIcon as any} size={16} color="#E63946" />
              <Text className="text-white text-xs font-bold ml-1.5 uppercase tracking-wider">
                {title || workoutType}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              className="w-10 h-10 rounded-full bg-[#1C1C1E]/90 border border-[#3A3A3C] items-center justify-center"
              onPress={handleDiscard}
            >
              <Ionicons name="close" size={20} color="#FF453A" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      {/* Bottom Telemetry HUD Card */}
      <View className="bg-[#121212] rounded-t-[32px] px-6 pt-5 pb-8 border-t border-[#1C1C1E]">
        {/* Main Big Stats (Distance & Time) */}
        <View className="flex-row items-baseline justify-between mb-4 pb-4 border-b border-[#1C1C1E]">
          <View>
            <Text className="text-[#8E8E93] text-xs font-bold uppercase tracking-wider mb-1">
              Distance
            </Text>
            <View className="flex-row items-baseline">
              <Text className="text-white text-4xl font-extrabold tracking-tight">
                {(distanceMeters / 1000).toFixed(2)}
              </Text>
              <Text className="text-[#8E8E93] text-base font-bold ml-1.5">km</Text>
            </View>
          </View>

          <View className="items-end">
            <Text className="text-[#8E8E93] text-xs font-bold uppercase tracking-wider mb-1">
              Time
            </Text>
            <Text className="text-white text-4xl font-extrabold font-mono tracking-tight">
              {formatTimer(elapsedSeconds)}
            </Text>
          </View>
        </View>

        {/* Secondary Metrics (Pace / Speed, Avg Pace, Elevation) */}
        <View className="flex-row items-center justify-between mb-6">
          <View className="flex-1">
            <Text className="text-[#8E8E93] text-xs font-semibold uppercase">
              {workoutType === 'RIDE' ? 'Speed' : 'Pace'}
            </Text>
            <Text className="text-white text-lg font-bold mt-0.5">
              {workoutType === 'RIDE'
                ? formatSpeed(currentSpeed)
                : formatPace(currentPace)}
            </Text>
          </View>

          <View className="flex-1 items-center">
            <Text className="text-[#8E8E93] text-xs font-semibold uppercase">Avg Pace</Text>
            <Text className="text-white text-lg font-bold mt-0.5">
              {formatPace(avgPace)}
            </Text>
          </View>

          <View className="flex-1 items-end">
            <Text className="text-[#8E8E93] text-xs font-semibold uppercase">Elevation</Text>
            <Text className="text-white text-lg font-bold mt-0.5">
              +{Math.round(elevationGain)} m
            </Text>
          </View>
        </View>

        {/* Action Controls */}
        <View className="flex-row items-center justify-between pt-2">
          {/* Pause / Resume Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            className={`flex-1 h-14 rounded-2xl items-center justify-center flex-row mr-3 ${
              isPaused ? 'bg-[#22C55E]' : 'bg-[#2C2C2E]'
            }`}
            onPress={handleTogglePause}
          >
            <Ionicons
              name={isPaused ? 'play' : 'pause'}
              size={22}
              color="#FFFFFF"
            />
            <Text className="text-white font-bold text-base ml-2">
              {isPaused ? 'Resume' : 'Pause'}
            </Text>
          </TouchableOpacity>

          {/* Finish Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={isFinishing}
            className="flex-1 h-14 bg-[#E63946] rounded-2xl items-center justify-center flex-row"
            onPress={handleFinish}
          >
            <Ionicons name="flag" size={20} color="#FFFFFF" />
            <Text className="text-white font-bold text-base ml-2">
              {isFinishing ? 'Saving...' : 'Finish'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

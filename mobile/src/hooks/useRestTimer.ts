import { useCallback, useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { cancelRestNotification, scheduleRestNotification } from '@/src/services/restTimerNotifications';
import { useWorkoutSessionStore } from '@/src/store/useWorkoutSessionStore';

export interface RestTimerState {
  isResting: boolean;
  durationSeconds: number;
  remainingSeconds: number;
  /** 0 → just started, 1 → finished. Safe to feed straight into Reanimated. */
  progress: number;
  targetTimestamp: number | null;
  startRest: (durationSeconds: number, exerciseName?: string) => void;
  skipRest: () => void;
  addTime: (seconds: number) => void;
}

function remainingFrom(targetTimestamp: number | null): number {
  if (targetTimestamp === null) return 0;
  return Math.max(0, Math.ceil((targetTimestamp - Date.now()) / 1000));
}

/**
 * Drives the rest countdown from an absolute target timestamp (never from a
 * decrementing counter), so the timer stays correct across backgrounding, and
 * mirrors it into a local notification for when the app is not in the foreground.
 */
export function useRestTimer(): RestTimerState {
  const activeRestTimer = useWorkoutSessionStore((state) => state.activeRestTimer);
  const startRestTimer = useWorkoutSessionStore((state) => state.startRestTimer);
  const stopRestTimer = useWorkoutSessionStore((state) => state.stopRestTimer);

  const targetTimestamp = activeRestTimer?.targetTimestamp ?? null;
  const durationSeconds = activeRestTimer?.durationSeconds ?? 0;
  const [remainingSeconds, setRemainingSeconds] = useState(() => remainingFrom(targetTimestamp));

  useEffect(() => {
    setRemainingSeconds(remainingFrom(targetTimestamp));
    if (targetTimestamp === null) return;

    const interval = setInterval(() => {
      const next = remainingFrom(targetTimestamp);
      setRemainingSeconds(next);
      if (next <= 0) {
        clearInterval(interval);
        stopRestTimer();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [targetTimestamp, stopRestTimer]);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: false,
      }),
    });
  }, []);

  const startRest = useCallback(
    (seconds: number, exerciseName?: string) => {
      startRestTimer(seconds, exerciseName);
    },
    [startRestTimer]
  );

  const skipRest = useCallback(() => {
    stopRestTimer();
  }, [stopRestTimer]);

  const addTime = useCallback(
    (seconds: number) => {
      if (targetTimestamp === null) return;
      const nextTarget = targetTimestamp + seconds * 1000;
      const nextDuration = Math.max(1, durationSeconds + seconds);
      void cancelRestNotification()
        .then(() => scheduleRestNotification(nextTarget))
        .catch(() => undefined);
      useWorkoutSessionStore.setState({
        activeRestTimer: { targetTimestamp: nextTarget, durationSeconds: nextDuration },
      });
    },
    [durationSeconds, targetTimestamp]
  );

  return {
    isResting: targetTimestamp !== null && remainingSeconds > 0,
    durationSeconds,
    remainingSeconds,
    progress: durationSeconds > 0 ? 1 - remainingSeconds / durationSeconds : 0,
    targetTimestamp,
    startRest,
    skipRest,
    addTime,
  };
}

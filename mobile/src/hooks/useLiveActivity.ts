import { useEffect, useRef } from 'react';
import {
  endLiveActivity,
  isLiveActivitySupported,
  startLiveActivity,
  updateLiveActivity,
  type LiveActivityPayload,
} from '@/src/native/liveActivityBridge';
import {
  selectCompletedSets,
  selectTotalSets,
  useWorkoutSessionStore,
} from '@/src/store/useWorkoutSessionStore';

/**
 * Streams the active session into the iOS Dynamic Island / Lock Screen widget.
 * No-ops on platforms (or builds) without the widget target, so the tracker
 * behaves identically on Android and in Expo Go.
 */
export function useLiveActivity(): { isSupported: boolean } {
  const isActive = useWorkoutSessionStore((state) => state.isActive);
  const title = useWorkoutSessionStore((state) => state.title);
  const startTime = useWorkoutSessionStore((state) => state.startTime);
  const exercises = useWorkoutSessionStore((state) => state.exercises);
  const activeRestTimer = useWorkoutSessionStore((state) => state.activeRestTimer);
  const completedSets = useWorkoutSessionStore(selectCompletedSets);
  const totalSets = useWorkoutSessionStore(selectTotalSets);

  const hasStarted = useRef(false);

  useEffect(() => {
    if (!isLiveActivitySupported) return;

    if (!isActive) {
      if (hasStarted.current) {
        hasStarted.current = false;
        void endLiveActivity().catch(() => undefined);
      }
      return;
    }

    const currentExercise =
      exercises.find((exercise) => exercise.sets.some((set) => !set.isCompleted)) ?? exercises.at(-1);

    const payload: LiveActivityPayload = {
      workoutTitle: title || 'Workout',
      exerciseName: currentExercise?.name ?? 'Warming up',
      startTimestamp: startTime ?? Date.now(),
      completedSets,
      totalSets,
      restTargetTimestamp: activeRestTimer?.targetTimestamp ?? null,
    };

    if (!hasStarted.current) {
      hasStarted.current = true;
      void startLiveActivity(payload).catch(() => undefined);
      return;
    }
    void updateLiveActivity(payload).catch(() => undefined);
  }, [isActive, title, startTime, exercises, activeRestTimer, completedSets, totalSets]);

  useEffect(
    () => () => {
      if (hasStarted.current) {
        void endLiveActivity().catch(() => undefined);
      }
    },
    []
  );

  return { isSupported: isLiveActivitySupported };
}

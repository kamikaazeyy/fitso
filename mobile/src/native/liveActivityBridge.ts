import { Platform } from 'react-native';

export interface LiveActivityPayload {
  workoutTitle: string;
  exerciseName: string;
  /** Epoch ms the session started, so the widget can run its own timer. */
  startTimestamp: number;
  completedSets: number;
  totalSets: number;
  /** Epoch ms the current rest period ends, when resting. */
  restTargetTimestamp?: number | null;
}

interface LiveActivityNativeModule {
  startActivity: (payload: LiveActivityPayload) => Promise<string | void>;
  updateActivity: (payload: LiveActivityPayload) => Promise<void>;
  endActivity: () => Promise<void>;
  areActivitiesEnabled?: () => boolean;
}

function loadNativeModule(): LiveActivityNativeModule | null {
  if (Platform.OS !== 'ios') return null;
  try {
    const module = require('expo-widgets') as Partial<LiveActivityNativeModule>;
    if (typeof module?.startActivity !== 'function') return null;
    return module as LiveActivityNativeModule;
  } catch {
    // The widget target is only present in a custom dev client / release build.
    return null;
  }
}

const nativeModule = loadNativeModule();

export const isLiveActivitySupported =
  nativeModule !== null && (nativeModule.areActivitiesEnabled?.() ?? true);

export async function startLiveActivity(payload: LiveActivityPayload): Promise<void> {
  if (!nativeModule) return;
  await nativeModule.startActivity(payload);
}

export async function updateLiveActivity(payload: LiveActivityPayload): Promise<void> {
  if (!nativeModule) return;
  await nativeModule.updateActivity(payload);
}

export async function endLiveActivity(): Promise<void> {
  if (!nativeModule) return;
  await nativeModule.endActivity();
}

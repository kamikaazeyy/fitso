import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export const REST_TIMER_CHANNEL_ID = 'rest-timer';

let scheduledIdentifier: string | null = null;

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(REST_TIMER_CHANNEL_ID, {
    name: 'Rest timer',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
  });
}

/**
 * Schedules the "rest is over" alert at an absolute epoch timestamp so the
 * countdown stays accurate while the app is backgrounded or the screen is off.
 */
export async function scheduleRestNotification(
  targetTimestamp: number,
  exerciseName?: string
): Promise<string | null> {
  await cancelRestNotification();
  await ensureChannel();

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Rest complete',
      body: exerciseName ? `Next set: ${exerciseName}` : 'Time for your next set.',
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: targetTimestamp,
      channelId: REST_TIMER_CHANNEL_ID,
    },
  });

  scheduledIdentifier = identifier;
  return identifier;
}

/** Cancels a pending rest alert (user skipped rest, or started the next set early). */
export async function cancelRestNotification(): Promise<void> {
  if (!scheduledIdentifier) return;
  const identifier = scheduledIdentifier;
  scheduledIdentifier = null;
  await Notifications.cancelScheduledNotificationAsync(identifier);
}

export function getScheduledRestNotificationId(): string | null {
  return scheduledIdentifier;
}

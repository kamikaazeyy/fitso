import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { useCardioSessionStore } from '@/src/store/useCardioSessionStore';

export const CARDIO_LOCATION_TASK_NAME = 'FITSO_CARDIO_LOCATION_TASK';
export const CARDIO_CHANNEL_ID = 'fitso-cardio-tracking';

// Ensure high-priority foreground service notification channel exists on Android
async function ensureLocationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(CARDIO_CHANNEL_ID, {
      name: 'Cardio Workout Tracking',
      importance: Notifications.AndroidImportance.HIGH,
      sound: null,
      enableVibrate: false,
      showBadge: false,
    });
  } catch (err) {
    console.warn('Could not create location notification channel:', err);
  }
}

// Define the background task outside React components so Expo can trigger it on wakeups
TaskManager.defineTask(CARDIO_LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    if (!locations || locations.length === 0) return;

    for (const loc of locations) {
      // Discard very inaccurate points (accuracy > 65 meters)
      if (loc.coords.accuracy != null && loc.coords.accuracy > 65) {
        continue;
      }

      useCardioSessionStore.getState().addLocationPoint({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        altitude: loc.coords.altitude,
        speed: loc.coords.speed,
        heading: loc.coords.heading,
        timestamp: loc.timestamp,
      });
    }
  }
});

/** Request foreground and background location permissions */
export async function requestLocationPermissions(): Promise<boolean> {
  try {
    const { status: existingForeground } = await Location.getForegroundPermissionsAsync();
    let foregroundGranted = existingForeground === 'granted';

    if (!foregroundGranted) {
      const { status: newForeground } = await Location.requestForegroundPermissionsAsync();
      foregroundGranted = newForeground === 'granted';
    }

    if (!foregroundGranted) {
      return false;
    }

    // Attempt background permission (for screen-off background tracking)
    try {
      const { status: existingBackground } = await Location.getBackgroundPermissionsAsync();
      if (existingBackground !== 'granted') {
        await Location.requestBackgroundPermissionsAsync();
      }
    } catch {
      // Background permission dialog might not be available or was dismissed
    }

    return true;
  } catch (err) {
    console.warn('Location permission request failed:', err);
    return false;
  }
}

/** Starts live GPS tracking with foreground notification */
export async function startLocationTracking(): Promise<boolean> {
  const hasPermission = await requestLocationPermissions();
  if (!hasPermission) return false;

  await ensureLocationChannel();

  const isStarted = await Location.hasStartedLocationUpdatesAsync(CARDIO_LOCATION_TASK_NAME);
  if (isStarted) return true;

  try {
    await Location.startLocationUpdatesAsync(CARDIO_LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 500, // sample every 500ms for continuous real-time distance
      distanceInterval: 0, // sample every movement
      deferredUpdatesInterval: 500,
      deferredUpdatesDistance: 0,
      showsBackgroundLocationIndicator: true,
      activityType: Location.ActivityType.Fitness,
      foregroundService: {
        notificationTitle: 'Fitso Activity Tracker',
        notificationBody: 'Recording route, pace and distance in real-time...',
        notificationColor: '#E63946',
        killServiceOnDestroy: false,
      },
      pausesUpdatesAutomatically: false,
    });
    return true;
  } catch (err) {
    console.warn('Failed to start background location tracking:', err);
    return false;
  }
}

/** Stops background GPS tracking */
export async function stopLocationTracking(): Promise<void> {
  try {
    const isStarted = await Location.hasStartedLocationUpdatesAsync(CARDIO_LOCATION_TASK_NAME);
    if (isStarted) {
      await Location.stopLocationUpdatesAsync(CARDIO_LOCATION_TASK_NAME);
    }
  } catch (err) {
    console.warn('Failed to stop location tracking:', err);
  }
}

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useCardioSessionStore } from '@/src/store/useCardioSessionStore';

export const CARDIO_LOCATION_TASK_NAME = 'FITSO_CARDIO_LOCATION_TASK';

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
      // Discard inaccurate points (accuracy > 25 meters)
      if (loc.coords.accuracy != null && loc.coords.accuracy > 25) {
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
    const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
    if (existingStatus === 'granted') {
      return true;
    }
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      return false;
    }

    try {
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      return backgroundStatus === 'granted' || foregroundStatus === 'granted';
    } catch {
      return foregroundStatus === 'granted';
    }
  } catch (err) {
    console.warn('Location permission request failed:', err);
    return false;
  }
}

/** Starts live GPS tracking with foreground notification */
export async function startLocationTracking(): Promise<boolean> {
  const hasPermission = await requestLocationPermissions();
  if (!hasPermission) return false;

  const isStarted = await Location.hasStartedLocationUpdatesAsync(CARDIO_LOCATION_TASK_NAME);
  if (isStarted) return true;

  try {
    await Location.startLocationUpdatesAsync(CARDIO_LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1000, // sample every 1 second
      distanceInterval: 3, // sample every 3 meters
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Fitso Activity Tracker',
        notificationBody: 'Recording your workout route...',
        notificationColor: '#E63946',
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

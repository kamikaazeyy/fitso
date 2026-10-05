jest.mock('@/src/db/database', () => ({
  getPowerSyncDatabase: jest.fn(),
  setPowerSyncDatabase: jest.fn(),
}));

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  REST_TIMER_CHANNEL_ID,
  scheduleRestNotification,
} from '@/src/services/restTimerNotifications';
import { DEFAULT_REST_SECONDS, useWorkoutSessionStore } from '@/src/store/useWorkoutSessionStore';
import { BENCH, PUSH_DAY, flushPromises, logSet, resetSession } from './support/session';

const store = useWorkoutSessionStore;
const NOW = 1_770_000_000_000;

beforeEach(() => {
  resetSession(store);
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('rest timer scheduling', () => {
  it('schedules a dated local notification when a set is completed', async () => {
    store.getState().startWorkout(PUSH_DAY);
    logSet(store, BENCH.exerciseId, 0, 100, 8);
    await flushPromises();

    const expectedTarget = NOW + BENCH.restSeconds! * 1000;
    expect(store.getState().activeRestTimer).toEqual({
      targetTimestamp: expectedTarget,
      durationSeconds: BENCH.restSeconds,
    });
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: 'Rest complete',
        body: 'Next set: Bench Press',
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: expectedTarget,
        channelId: REST_TIMER_CHANNEL_ID,
      },
    });
  });

  it('falls back to the default rest duration for ad-hoc exercises', async () => {
    store.getState().startWorkout();
    store.getState().addExercise({ id: 'ex-row', name: 'Barbell Row' });
    logSet(store, 'ex-row', 0, 60, 10);
    await flushPromises();

    expect(store.getState().activeRestTimer).toEqual({
      targetTimestamp: NOW + DEFAULT_REST_SECONDS * 1000,
      durationSeconds: DEFAULT_REST_SECONDS,
    });
  });

  it('cancels the pending notification when rest is skipped', async () => {
    store.getState().startWorkout(PUSH_DAY);
    logSet(store, BENCH.exerciseId, 0, 100, 8);
    await flushPromises();
    const identifier = await jest.mocked(Notifications.scheduleNotificationAsync).mock.results[0]
      .value;

    store.getState().stopRestTimer();
    await flushPromises();

    expect(store.getState().activeRestTimer).toBeNull();
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(identifier);
  });

  it('replaces the pending notification when the next set is completed', async () => {
    store.getState().startWorkout(PUSH_DAY);
    logSet(store, BENCH.exerciseId, 0, 100, 8);
    await flushPromises();

    jest.spyOn(Date, 'now').mockReturnValue(NOW + 30_000);
    logSet(store, BENCH.exerciseId, 1, 100, 7);
    await flushPromises();

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(store.getState().activeRestTimer?.targetTimestamp).toBe(
      NOW + 30_000 + BENCH.restSeconds! * 1000
    );
  });

  it('creates the high-importance Android channel before scheduling', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');

    await scheduleRestNotification(NOW + 90_000, 'Back Squat');

    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(REST_TIMER_CHANNEL_ID, {
      name: 'Rest timer',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  });

  it('does not schedule anything for a zero-length rest', async () => {
    store.getState().startWorkout();
    store.getState().addExercise({ id: 'ex-row', name: 'Barbell Row', defaultRestSeconds: 0 });
    logSet(store, 'ex-row', 0, 60, 10);
    await flushPromises();

    expect(store.getState().activeRestTimer).toBeNull();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

jest.mock('@/src/db/database', () => ({
  getPowerSyncDatabase: jest.fn(),
  setPowerSyncDatabase: jest.fn(),
}));

import { useCardioSessionStore } from '@/src/store/useCardioSessionStore';

const store = useCardioSessionStore;

beforeEach(() => {
  store.getState().discardActivity();
  jest.clearAllMocks();
});

describe('useCardioSessionStore', () => {
  it('starts a new running activity with correct initial state', () => {
    store.getState().startActivity('RUN', 'Sunset Jog');
    const state = store.getState();

    expect(state.isActive).toBe(true);
    expect(state.isPaused).toBe(false);
    expect(state.workoutType).toBe('RUN');
    expect(state.title).toBe('Sunset Jog');
    expect(state.workoutId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-/);
    expect(state.distanceMeters).toBe(0);
    expect(state.elapsedSeconds).toBe(0);
    expect(state.coordinates).toEqual([]);
    expect(state.splits).toEqual([]);
  });

  it('toggles pause and resume state', () => {
    store.getState().startActivity('RUN');
    expect(store.getState().isPaused).toBe(false);

    store.getState().togglePause();
    expect(store.getState().isPaused).toBe(true);

    store.getState().togglePause();
    expect(store.getState().isPaused).toBe(false);
  });

  it('accumulates GPS points, distance, and triggers split intervals', () => {
    store.getState().startActivity('RUN');

    // Add point 1
    store.getState().addLocationPoint({
      latitude: 37.7749,
      longitude: -122.4194,
      altitude: 10,
      speed: 3.5,
      timestamp: 1000,
    });

    // Add point 2 (~1.1 km away to trigger 1km split)
    store.getState().incrementElapsedSeconds(300); // 5 minutes (300s)
    store.getState().addLocationPoint({
      latitude: 37.7849,
      longitude: -122.4194,
      altitude: 15,
      speed: 3.8,
      timestamp: 301000,
    });

    const state = store.getState();
    expect(state.coordinates).toHaveLength(2);
    expect(state.distanceMeters).toBeGreaterThan(1000);
    expect(state.elevationGainMeters).toBeCloseTo(5, 1);
    expect(state.splits.length).toBeGreaterThanOrEqual(1);
    expect(state.splits[0].splitIndex).toBe(1);
  });

  it('discards activity and resets store', () => {
    store.getState().startActivity('RIDE');
    expect(store.getState().isActive).toBe(true);

    store.getState().discardActivity();
    expect(store.getState().isActive).toBe(false);
    expect(store.getState().workoutId).toBeNull();
  });
});

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getPowerSyncDatabase } from '@/src/db/database';
import { WORKOUTS_TABLE } from '@/src/db/AppSchema';
import { heavyFeedback, tapFeedback } from '@/src/services/haptics';
import { createMMKVJSONStorage } from '@/src/store/mmkvStorage';
import type { CardioLocationPoint, CardioSplit, WorkoutType } from '@/src/types/workout';
import { uuid } from '@/src/utils/id';
import {
  calculateDistanceMeters,
  encodeCoordinates,
  estimateCardioCalories,
} from '@/src/utils/geo';
import { GPSKalmanFilter, PaceSmoother } from '@/src/utils/kalmanFilter';

const kalmanFilter = new GPSKalmanFilter(3.0);
const paceSmoother = new PaceSmoother(0.35);

export const CARDIO_STORAGE_KEY = 'fitso.active-cardio-session';
const SPLIT_INTERVAL_METERS = 1000; // 1.00 km split checkpoints

export interface CardioSessionState {
  isActive: boolean;
  isPaused: boolean;
  workoutType: WorkoutType;
  workoutId: string | null;
  title: string;
  startTime: number | null;
  elapsedSeconds: number;
  distanceMeters: number;
  currentPaceSecondsPerKm: number | null;
  avgPaceSecondsPerKm: number | null;
  currentSpeedMps: number | null;
  maxSpeedMps: number;
  elevationGainMeters: number;
  coordinates: CardioLocationPoint[];
  splits: CardioSplit[];
  userId: string | null;
  isSaving: boolean;
}

export interface CardioSessionActions {
  setUserId: (userId: string | null) => void;
  startActivity: (type?: WorkoutType, title?: string) => void;
  pauseActivity: () => void;
  resumeActivity: () => void;
  togglePause: () => void;
  addLocationPoint: (point: CardioLocationPoint) => void;
  incrementElapsedSeconds: (seconds?: number) => void;
  finishActivity: () => Promise<string | null>;
  discardActivity: () => void;
}

export type CardioSessionStore = CardioSessionState & CardioSessionActions;

export type PersistedCardioSession = Omit<CardioSessionState, 'isSaving'>;

const initialState: CardioSessionState = {
  isActive: false,
  isPaused: false,
  workoutType: 'RUN',
  workoutId: null,
  title: '',
  startTime: null,
  elapsedSeconds: 0,
  distanceMeters: 0,
  currentPaceSecondsPerKm: null,
  avgPaceSecondsPerKm: null,
  currentSpeedMps: null,
  maxSpeedMps: 0,
  elevationGainMeters: 0,
  coordinates: [],
  splits: [],
  userId: null,
  isSaving: false,
};

function defaultTitleForType(type: WorkoutType): string {
  const timeOfDay = new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening';
  switch (type) {
    case 'RUN':
      return `${timeOfDay} Run`;
    case 'RIDE':
      return `${timeOfDay} Ride`;
    case 'WALK':
      return `${timeOfDay} Walk`;
    case 'HIIT':
      return `${timeOfDay} Cardio`;
    default:
      return `${timeOfDay} Workout`;
  }
}

export const useCardioSessionStore = create<CardioSessionStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setUserId: (userId) => set({ userId }),

      startActivity: (type = 'RUN', customTitle) => {
        tapFeedback();
        kalmanFilter.reset();
        paceSmoother.reset();
        const workoutId = uuid();
        const title = customTitle?.trim() || defaultTitleForType(type);
        set({
          ...initialState,
          isActive: true,
          isPaused: false,
          workoutType: type,
          workoutId,
          title,
          startTime: Date.now(),
          userId: get().userId,
        });
      },

      pauseActivity: () => {
        tapFeedback();
        paceSmoother.reset();
        set({ isPaused: true, currentSpeedMps: 0, currentPaceSecondsPerKm: null });
      },

      resumeActivity: () => {
        tapFeedback();
        paceSmoother.reset();
        set({ isPaused: false });
      },

      togglePause: () => {
        const { isPaused } = get();
        if (isPaused) {
          get().resumeActivity();
        } else {
          get().pauseActivity();
        }
      },

      incrementElapsedSeconds: (seconds = 1) => {
        const { isActive, isPaused, elapsedSeconds, distanceMeters } = get();
        if (!isActive || isPaused) return;

        const newElapsed = elapsedSeconds + seconds;
        const avgPace =
          distanceMeters > 50 && newElapsed > 0
            ? Math.round((newElapsed / distanceMeters) * 1000)
            : null;

        set({
          elapsedSeconds: newElapsed,
          avgPaceSecondsPerKm: avgPace,
        });
      },

      addLocationPoint: (point: CardioLocationPoint) => {
        const {
          isActive,
          isPaused,
          coordinates,
          distanceMeters,
          maxSpeedMps,
          elevationGainMeters,
          splits,
          elapsedSeconds,
        } = get();

        if (!isActive || isPaused) return;

        // 1. Pass through 2D GPS Kalman Filter (sensor fusion & noise cancellation)
        const filtered = kalmanFilter.process(
          point.latitude,
          point.longitude,
          5,
          point.timestamp,
          point.speed
        );

        const filteredPoint: CardioLocationPoint = {
          ...point,
          latitude: filtered.latitude,
          longitude: filtered.longitude,
          speed: filtered.speedMps,
        };

        let deltaDistance = 0;
        let deltaElevation = 0;
        const lastPoint = coordinates[coordinates.length - 1];

        if (lastPoint) {
          deltaDistance = calculateDistanceMeters(lastPoint, filteredPoint);

          const timeDeltaSeconds = Math.max(0.1, (point.timestamp - lastPoint.timestamp) / 1000);
          const computedSpeedMps = deltaDistance / timeDeltaSeconds;

          // Discard unrealistic GPS leaps (teleporting > 108 km/h)
          if (computedSpeedMps > 30) {
            return;
          }

          // Smart auto-pause threshold: ignore sub-35cm jitter when stationary
          if (filtered.speedMps < 0.35 && deltaDistance < 0.5) {
            deltaDistance = 0;
          }

          // Compute true elevation climb (only count positive climb > 0.4m)
          if (point.altitude != null && lastPoint.altitude != null) {
            const eleDiff = point.altitude - lastPoint.altitude;
            if (eleDiff > 0.4) {
              deltaElevation = eleDiff;
            }
          }
        }

        const newDistance = distanceMeters + deltaDistance;
        const newMaxSpeed = Math.max(maxSpeedMps, filtered.speedMps);

        // 2. Pass speed through Exponential Moving Average pace smoother
        const { smoothedSpeedMps, paceSecondsPerKm: livePace } = paceSmoother.update(filtered.speedMps);

        // Overall average pace
        const avgPace =
          newDistance > 10 && elapsedSeconds > 0
            ? Math.round((elapsedSeconds / newDistance) * 1000)
            : null;

        // Check if crossed a new split threshold (e.g. 1km, 2km, 3km)
        const updatedSplits = [...splits];
        const nextSplitIndex = updatedSplits.length + 1;
        const targetDistanceForNextSplit = nextSplitIndex * SPLIT_INTERVAL_METERS;

        if (newDistance >= targetDistanceForNextSplit) {
          const prevSplitsDuration = updatedSplits.reduce((acc, s) => acc + s.durationSeconds, 0);
          const splitDuration = Math.max(1, elapsedSeconds - prevSplitsDuration);
          const splitPace = Math.round((splitDuration / SPLIT_INTERVAL_METERS) * 1000);

          updatedSplits.push({
            splitIndex: nextSplitIndex,
            distanceMeters: SPLIT_INTERVAL_METERS,
            durationSeconds: splitDuration,
            paceSecondsPerKm: splitPace,
            elevationGainMeters: Math.round(deltaElevation),
          });
          heavyFeedback();
        }

        set({
          coordinates: [...coordinates, filteredPoint],
          distanceMeters: newDistance,
          currentSpeedMps: smoothedSpeedMps,
          maxSpeedMps: newMaxSpeed,
          elevationGainMeters: elevationGainMeters + deltaElevation,
          currentPaceSecondsPerKm: livePace,
          avgPaceSecondsPerKm: avgPace,
          splits: updatedSplits,
        });
      },

      finishActivity: async () => {
        const {
          workoutId,
          userId,
          title,
          workoutType,
          startTime,
          elapsedSeconds,
          distanceMeters,
          avgPaceSecondsPerKm,
          maxSpeedMps,
          elevationGainMeters,
          coordinates,
          splits,
        } = get();

        if (!workoutId) return null;

        set({ isSaving: true });
        heavyFeedback();

        try {
          const nowIso = new Date().toISOString();
          const startIso = startTime ? new Date(startTime).toISOString() : nowIso;
          const encodedPolyline = encodeCoordinates(coordinates);
          const caloriesBurned = estimateCardioCalories(
            workoutType,
            distanceMeters,
            elapsedSeconds,
            70 // standard baseline weight kg
          );

          const db = getPowerSyncDatabase();
          await db.execute(
            `INSERT INTO ${WORKOUTS_TABLE} (
              id, user_id, workout_type, title, started_at, finished_at,
              duration_seconds, distance_meters, avg_pace_seconds_per_km,
              max_speed_mps, elevation_gain_meters, calories_burned,
              route_coordinates, splits, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              workoutId,
              userId ?? '',
              workoutType,
              title || defaultTitleForType(workoutType),
              startIso,
              nowIso,
              elapsedSeconds,
              distanceMeters,
              avgPaceSecondsPerKm ?? 0,
              maxSpeedMps,
              elevationGainMeters,
              caloriesBurned,
              encodedPolyline,
              JSON.stringify(splits),
              nowIso,
            ]
          );

          const finishedId = workoutId;
          set({ ...initialState, userId: get().userId });
          return finishedId;
        } catch (error) {
          set({ isSaving: false });
          throw error;
        }
      },

      discardActivity: () => {
        tapFeedback();
        set({ ...initialState, userId: get().userId });
      },
    }),
    {
      name: CARDIO_STORAGE_KEY,
      storage: createMMKVJSONStorage<PersistedCardioSession>(),
      partialize: (state): PersistedCardioSession => ({
        isActive: state.isActive,
        isPaused: state.isPaused,
        workoutType: state.workoutType,
        workoutId: state.workoutId,
        title: state.title,
        startTime: state.startTime,
        elapsedSeconds: state.elapsedSeconds,
        distanceMeters: state.distanceMeters,
        currentPaceSecondsPerKm: state.currentPaceSecondsPerKm,
        avgPaceSecondsPerKm: state.avgPaceSecondsPerKm,
        currentSpeedMps: state.currentSpeedMps,
        maxSpeedMps: state.maxSpeedMps,
        elevationGainMeters: state.elevationGainMeters,
        coordinates: state.coordinates,
        splits: state.splits,
        userId: state.userId,
      }),
    }
  )
);

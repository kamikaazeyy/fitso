import type { CardioLocationPoint } from '@/src/types/workout';
import { calculateDistanceMeters } from './geo';

/**
 * 2D Kalman Filter specifically tuned for human running, cycling, and walking dynamics.
 * Fuses GPS coordinates with horizontal accuracy variance to eliminate GPS sawtooth noise.
 */
export class GPSKalmanFilter {
  private lat: number | null = null;
  private lng: number | null = null;
  private variance: number = -1; // -1 means uninitialized
  private timestampMs: number = 0;
  private speedMps: number = 0;

  // Process noise (Q): higher = more responsive to sudden turns, lower = smoother path
  // 3.0 m/s^2 is ideal for human running/cycling
  private readonly processNoise: number;

  constructor(processNoise = 3.0) {
    this.processNoise = processNoise;
  }

  /**
   * Reset filter state (e.g. on workout start)
   */
  public reset(): void {
    this.lat = null;
    this.lng = null;
    this.variance = -1;
    this.timestampMs = 0;
    this.speedMps = 0;
  }

  /**
   * Process a new raw GPS point and return the filtered, denoised coordinate
   */
  public process(
    rawLat: number,
    rawLng: number,
    accuracyMeters: number = 5,
    timestampMs: number = Date.now(),
    rawSpeed?: number | null
  ): { latitude: number; longitude: number; speedMps: number } {
    const accuracy = Math.max(1, accuracyMeters);

    // Initial measurement
    if (this.variance < 0 || this.lat == null || this.lng == null) {
      this.lat = rawLat;
      this.lng = rawLng;
      this.variance = accuracy * accuracy;
      this.timestampMs = timestampMs;
      this.speedMps = rawSpeed != null && rawSpeed >= 0 ? rawSpeed : 0;
      return { latitude: rawLat, longitude: rawLng, speedMps: this.speedMps };
    }

    const dtSeconds = Math.max(0.05, (timestampMs - this.timestampMs) / 1000);
    this.timestampMs = timestampMs;

    // 1. Time Update (Predict step)
    // Variance increases with time due to process noise
    this.variance += this.processNoise * this.processNoise * dtSeconds;

    // 2. Measurement Update (Correct step)
    const measurementVariance = accuracy * accuracy;
    const kalmanGain = this.variance / (this.variance + measurementVariance);

    // Update estimated coordinates with Kalman Gain
    const filteredLat = this.lat + kalmanGain * (rawLat - this.lat);
    const filteredLng = this.lng + kalmanGain * (rawLng - this.lng);
    this.variance = (1 - kalmanGain) * this.variance;

    // Calculate displacement & smoothed speed
    const displacementMeters = calculateDistanceMeters(
      { latitude: this.lat, longitude: this.lng },
      { latitude: filteredLat, longitude: filteredLng }
    );

    const calculatedSpeed = displacementMeters / dtSeconds;
    const finalSpeed =
      rawSpeed != null && rawSpeed >= 0
        ? 0.7 * rawSpeed + 0.3 * calculatedSpeed
        : calculatedSpeed;

    this.lat = filteredLat;
    this.lng = filteredLng;
    this.speedMps = finalSpeed;

    return {
      latitude: filteredLat,
      longitude: filteredLng,
      speedMps: finalSpeed,
    };
  }
}

/**
 * Exponential Moving Average (EMA) smoother for real-time pace & speed
 */
export class PaceSmoother {
  private smoothedSpeed: number | null = null;
  private readonly alpha: number;

  constructor(alpha = 0.35) {
    this.alpha = alpha;
  }

  public update(currentSpeedMps: number): { smoothedSpeedMps: number; paceSecondsPerKm: number | null } {
    if (this.smoothedSpeed == null) {
      this.smoothedSpeed = currentSpeedMps;
    } else {
      this.smoothedSpeed = this.alpha * currentSpeedMps + (1 - this.alpha) * this.smoothedSpeed;
    }

    let pace: number | null = null;
    // Speed threshold for running/walking (> 0.4 m/s ≈ 1.44 km/h)
    if (this.smoothedSpeed > 0.4) {
      pace = Math.min(1800, Math.round(1000 / this.smoothedSpeed));
    }

    return {
      smoothedSpeedMps: this.smoothedSpeed,
      paceSecondsPerKm: pace,
    };
  }

  public reset(): void {
    this.smoothedSpeed = null;
  }
}

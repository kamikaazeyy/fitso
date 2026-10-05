import { GPSKalmanFilter, PaceSmoother } from '@/src/utils/kalmanFilter';

describe('GPSKalmanFilter', () => {
  it('initializes with the first measurement', () => {
    const filter = new GPSKalmanFilter();
    const result = filter.process(37.7749, -122.4194, 5, 1000, 2.5);
    expect(result.latitude).toBeCloseTo(37.7749, 4);
    expect(result.longitude).toBeCloseTo(-122.4194, 4);
    expect(result.speedMps).toBe(2.5);
  });

  it('smooths out noisy jitter measurements', () => {
    const filter = new GPSKalmanFilter();
    filter.process(37.7749, -122.4194, 5, 1000, 2.0);

    // Sudden noisy spike with high inaccuracy (25m)
    const noisy = filter.process(37.7759, -122.4184, 25, 2000, 2.1);
    // Filtered coordinate should be pulled closer to previous point due to low confidence
    expect(noisy.latitude).toBeLessThan(37.7759);
    expect(noisy.longitude).toBeLessThan(-122.4184);
  });

  it('resets cleanly', () => {
    const filter = new GPSKalmanFilter();
    filter.process(37.7749, -122.4194, 5, 1000, 2.0);
    filter.reset();
    const result = filter.process(40.7128, -74.006, 5, 2000, 3.0);
    expect(result.latitude).toBeCloseTo(40.7128, 4);
    expect(result.longitude).toBeCloseTo(-74.006, 4);
  });
});

describe('PaceSmoother', () => {
  it('smooths speed and computes pace accurately', () => {
    const smoother = new PaceSmoother(0.5);
    // 2.78 m/s ≈ 10 km/h ≈ 360 s/km (6:00 /km)
    const res1 = smoother.update(2.78);
    expect(res1.smoothedSpeedMps).toBeCloseTo(2.78, 2);
    expect(res1.paceSecondsPerKm).toBe(360);

    // Sudden burst to 3.5 m/s
    const res2 = smoother.update(3.5);
    expect(res2.smoothedSpeedMps).toBeCloseTo((2.78 + 3.5) / 2, 2);
    expect(res2.paceSecondsPerKm).toBeLessThan(360);
  });

  it('returns null pace when speed is below stationary threshold', () => {
    const smoother = new PaceSmoother();
    const res = smoother.update(0.2); // 0.2 m/s (< 0.4 m/s threshold)
    expect(res.paceSecondsPerKm).toBeNull();
  });
});

import {
  calculateDistanceMeters,
  formatPace,
  formatSpeed,
  formatDistance,
  encodeCoordinates,
  decodeCoordinates,
  estimateCardioCalories,
  generateGpxString,
} from '@/src/utils/geo';
import type { CardioLocationPoint } from '@/src/types/workout';

describe('calculateDistanceMeters', () => {
  it('calculates distance between two known GPS coordinates', () => {
    // San Francisco Ferry Building to Coit Tower (~1.38 km)
    const ferryBuilding = { latitude: 37.7955, longitude: -122.3937 };
    const coitTower = { latitude: 37.8024, longitude: -122.4058 };

    const distance = calculateDistanceMeters(ferryBuilding, coitTower);
    expect(distance).toBeGreaterThan(1300);
    expect(distance).toBeLessThan(1450);
  });

  it('returns 0 for identical points', () => {
    const pt = { latitude: 40.7128, longitude: -74.006 };
    expect(calculateDistanceMeters(pt, pt)).toBe(0);
  });
});

describe('formatPace', () => {
  it('formats seconds per km into mm:ss /km', () => {
    expect(formatPace(330)).toBe('5:30 /km');
    expect(formatPace(298)).toBe('4:58 /km');
    expect(formatPace(0)).toBe('--:-- /km');
    expect(formatPace(null)).toBe('--:-- /km');
  });

  it('supports miles unit', () => {
    expect(formatPace(300, 'mi')).toBe('8:02 /mi');
  });
});

describe('formatSpeed', () => {
  it('formats meters per second into km/h', () => {
    expect(formatSpeed(5.0)).toBe('18.0 km/h');
    expect(formatSpeed(0)).toBe('0.0 km/h');
    expect(formatSpeed(null)).toBe('0.0 km/h');
  });
});

describe('formatDistance', () => {
  it('formats distance in meters to km', () => {
    expect(formatDistance(5000)).toBe('5.00 km');
    expect(formatDistance(3420)).toBe('3.42 km');
  });
});

describe('encodeCoordinates & decodeCoordinates', () => {
  it('encodes and decodes coordinates reversibly', () => {
    const points: CardioLocationPoint[] = [
      { latitude: 37.7749, longitude: -122.4194, timestamp: 1000 },
      { latitude: 37.7752, longitude: -122.4188, timestamp: 2000 },
      { latitude: 37.776, longitude: -122.4175, timestamp: 3000 },
    ];

    const encoded = encodeCoordinates(points);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);

    const decoded = decodeCoordinates(encoded);
    expect(decoded).toHaveLength(3);
    expect(decoded[0].latitude).toBeCloseTo(37.7749, 4);
    expect(decoded[0].longitude).toBeCloseTo(-122.4194, 4);
  });
});

describe('estimateCardioCalories', () => {
  it('estimates running calories accurately', () => {
    // 5 km in 30 mins (1800s) for a 70kg runner ~ 350 kcal
    const calories = estimateCardioCalories('RUN', 5000, 1800, 70);
    expect(calories).toBeGreaterThan(300);
    expect(calories).toBeLessThan(450);
  });
});

describe('generateGpxString', () => {
  it('generates valid GPX XML output', () => {
    const points: CardioLocationPoint[] = [
      { latitude: 37.7749, longitude: -122.4194, altitude: 15.2, timestamp: 1672531199000 },
      { latitude: 37.7752, longitude: -122.4188, altitude: 16.0, timestamp: 1672531201000 },
    ];

    const gpx = generateGpxString('Morning Run', '2023-01-01T00:00:00.000Z', points);
    expect(gpx).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(gpx).toContain('<gpx');
    expect(gpx).toContain('<name>Morning Run</name>');
    expect(gpx).toContain('<trkpt lat="37.774900" lon="-122.419400">');
    expect(gpx).toContain('<ele>15.2</ele>');
  });
});

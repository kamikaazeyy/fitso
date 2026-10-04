import polyline from '@mapbox/polyline';
import type { CardioLocationPoint, CardioSplit, WorkoutType } from '@/src/types/workout';

/** Haversine formula to compute distance in meters between two GPS coordinates */
export function calculateDistanceMeters(
  p1: { latitude: number; longitude: number },
  p2: { latitude: number; longitude: number }
): number {
  const R = 6371e3; // Earth's mean radius in meters
  const φ1 = (p1.latitude * Math.PI) / 180;
  const φ2 = (p2.latitude * Math.PI) / 180;
  const Δφ = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  const Δλ = ((p2.longitude - p1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/** Formats pace in seconds/km into string like "5:32 /km" */
export function formatPace(secondsPerKm: number | null | undefined, unit: 'km' | 'mi' = 'km'): string {
  if (!secondsPerKm || !Number.isFinite(secondsPerKm) || secondsPerKm <= 0 || secondsPerKm > 3600) {
    return `--:-- /${unit}`;
  }
  const effectiveSeconds = unit === 'mi' ? secondsPerKm * 1.60934 : secondsPerKm;
  const mins = Math.floor(effectiveSeconds / 60);
  const secs = Math.floor(effectiveSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')} /${unit}`;
}

/** Formats speed in meters per second into km/h or mph */
export function formatSpeed(mps: number | null | undefined, unit: 'km' | 'mi' = 'km'): string {
  if (!mps || !Number.isFinite(mps) || mps <= 0) {
    return unit === 'mi' ? '0.0 mph' : '0.0 km/h';
  }
  if (unit === 'mi') {
    const mph = mps * 2.23694;
    return `${mph.toFixed(1)} mph`;
  }
  const kmh = mps * 3.6;
  return `${kmh.toFixed(1)} km/h`;
}

/** Formats distance in meters into "3.42 km" or "2.12 mi" */
export function formatDistance(meters: number, unit: 'km' | 'mi' = 'km'): string {
  if (unit === 'mi') {
    const miles = meters / 1609.344;
    return `${miles.toFixed(2)} mi`;
  }
  const km = meters / 1000;
  return `${km.toFixed(2)} km`;
}

/** Encodes array of location points into Google Encoded Polyline string */
export function encodeCoordinates(points: CardioLocationPoint[]): string {
  if (!points || points.length === 0) return '';
  const latLngs: [number, number][] = points.map((p) => [p.latitude, p.longitude]);
  return polyline.encode(latLngs);
}

/** Decodes Google Encoded Polyline string into array of [latitude, longitude] */
export function decodeCoordinates(encoded: string): { latitude: number; longitude: number }[] {
  if (!encoded) return [];
  try {
    const decoded = polyline.decode(encoded);
    return decoded.map(([latitude, longitude]: [number, number]) => ({ latitude, longitude }));
  } catch {
    return [];
  }
}

/**
 * Estimates calories burned based on metabolic equivalent (MET), weight (kg), and time (seconds)
 */
export function estimateCardioCalories(
  type: WorkoutType,
  distanceMeters: number,
  durationSeconds: number,
  weightKg: number = 70
): number {
  if (durationSeconds <= 0 || distanceMeters <= 0) return 0;
  const hours = durationSeconds / 3600;
  const speedKmh = (distanceMeters / 1000) / hours;

  let met = 7.0; // default moderate run
  if (type === 'RUN') {
    if (speedKmh < 8) met = 7.0;
    else if (speedKmh < 10) met = 9.0;
    else if (speedKmh < 12) met = 11.0;
    else met = 12.5;
  } else if (type === 'RIDE') {
    if (speedKmh < 16) met = 4.0;
    else if (speedKmh < 20) met = 6.0;
    else if (speedKmh < 25) met = 8.5;
    else met = 11.0;
  } else if (type === 'WALK') {
    if (speedKmh < 4.5) met = 3.0;
    else met = 4.3;
  } else if (type === 'HIIT') {
    met = 8.0;
  }

  // Calories = MET * weight(kg) * time(hours)
  return Math.round(met * weightKg * hours);
}

/** Generates a standard GPX XML string from recorded points for export to Strava/Garmin */
export function generateGpxString(
  title: string,
  startTimeIso: string,
  points: CardioLocationPoint[]
): string {
  const trkpts = points
    .map((p) => {
      const timeIso = new Date(p.timestamp).toISOString();
      const eleXml = p.altitude != null ? `\n        <ele>${p.altitude.toFixed(1)}</ele>` : '';
      return `      <trkpt lat="${p.latitude.toFixed(6)}" lon="${p.longitude.toFixed(6)}">${eleXml}
        <time>${timeIso}</time>
      </trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Fitso App" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${title}</name>
    <time>${startTimeIso}</time>
  </metadata>
  <trk>
    <name>${title}</name>
    <type>running</type>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

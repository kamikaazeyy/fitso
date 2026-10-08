/**
 * Equipment-driven heuristic for whether an exercise can be logged per-side
 * (Left/Right weight + reps) instead of a single bilateral weight/reps pair.
 *
 * Strictly bilateral implements (barbell, smith machine, pull-up bar, leg
 * press, etc.) can never be unilateral. Cables sit in the middle: single-arm
 * attachments (D-handle, ankle cuff, rope) are unilateral-capable while fixed
 * two-hand bars (straight bar, V-bar, lat pulldown) are not.
 */

/** Equipment names that always force bilateral logging (lowercased). */
const STRICT_BILATERAL = new Set([
  'barbell',
  'smith machine',
  'pull-up bar',
  'pullup bar',
  'leg press',
  'hack squat machine',
  'sled',
]);

/** Cable attachments that are physically bilateral (lowercased). */
const BILATERAL_CABLE_ATTACHMENTS = new Set([
  'straight bar',
  'v-bar',
  'lat pulldown bar',
  'ez-curl bar attachment',
  'standard barbell',
  'ez / sz bar',
]);

function isCable(equipment: string[]): boolean {
  return equipment.some((name) => {
    const e = name.trim().toLowerCase();
    return e === 'cable' || e === 'cable machine';
  });
}

/**
 * Returns true when the exercise may be switched into unilateral tracking.
 * An empty equipment list (custom exercises, unknown wger entries) defaults
 * to true so the toggle stays available rather than hiding the feature.
 */
export function supportsUnilateral(equipment: string[], attachment?: string): boolean {
  if (equipment.length === 0) return true;

  const normalized = equipment.map((name) => name.trim().toLowerCase());
  if (normalized.some((name) => STRICT_BILATERAL.has(name))) return false;

  if (isCable(normalized)) {
    const att = attachment?.trim().toLowerCase();
    if (att && BILATERAL_CABLE_ATTACHMENTS.has(att)) return false;
  }

  return true;
}

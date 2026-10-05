export type WeightUnit = 'kg' | 'lbs';

const LBS_PER_KG = 2.2046226218;

export function kgToLbs(kg: number): number {
  return kg * LBS_PER_KG;
}

export function lbsToKg(lbs: number): number {
  return lbs / LBS_PER_KG;
}

/**
 * kg → the number shown in the user's preferred unit. lbs are rounded to one
 * decimal so values stay recognisable (95kg → 209.4).
 */
export function displayWeight(kg: number | null | undefined, unit: WeightUnit): number | null {
  if (kg === null || kg === undefined) return null;
  if (unit === 'kg') return kg;
  return Math.round(kgToLbs(kg) * 10) / 10;
}

/** kg → "95 kg" / "209.4 lbs" */
export function formatWeight(kg: number | null | undefined, unit: WeightUnit): string {
  const value = displayWeight(kg, unit);
  if (value === null) return '—';
  return `${value} ${unit}`;
}

/** Parses a field typed in the user's unit → canonical kg for storage. */
export function parseWeightInput(text: string, unit: WeightUnit): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const parsed = parseFloat(trimmed);
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return unit === 'lbs' ? lbsToKg(parsed) : parsed;
}

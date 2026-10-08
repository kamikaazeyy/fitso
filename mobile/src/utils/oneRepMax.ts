/**
 * Brzycki one-rep-max estimate: `weight * (36 / (37 - reps))`.
 * Returns null when the inputs fall outside the formula's valid domain
 * (the denominator collapses at 37 reps).
 */
export function estimateOneRepMax(weight: number | null, reps: number | null): number | null {
  if (weight === null || reps === null) return null;
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return null;
  if (weight <= 0 || reps <= 0 || reps >= 37) return null;
  return weight * (36 / (37 - reps));
}

/**
 * Unilateral e1RM: estimated strictly on the weaker side (the minimum of the
 * two rep counts) so a strong side can't mask a lagging one. Nulls are
 * treated as "not logged" — a set with only one side recorded estimates off
 * that side alone; both null returns null.
 */
export function estimateUnilateralOneRepMax(
  weight: number | null,
  repsLeft: number | null,
  repsRight: number | null
): number | null {
  const sides = [repsLeft, repsRight].filter((r): r is number => r !== null);
  if (sides.length === 0) return null;
  return estimateOneRepMax(weight, Math.min(...sides));
}

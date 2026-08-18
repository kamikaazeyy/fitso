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

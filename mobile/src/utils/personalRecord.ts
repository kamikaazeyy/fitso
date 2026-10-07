/**
 * Set volume (`weight * reps`), the metric a PR must beat: a completed NORMAL
 * set is a PR when its volume is strictly greater than every earlier NORMAL
 * set of that exercise. Null for bodyweight/empty sets, which can't be PRs.
 */
export function setVolume(weight: number | null, reps: number | null): number | null {
  if (weight === null || reps === null) return null;
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return null;
  if (weight <= 0 || reps <= 0) return null;
  return weight * reps;
}

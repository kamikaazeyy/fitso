import type { WorkoutSet, WorkoutWithSets } from '@/src/hooks/useWorkouts';
import { estimateOneRepMax, estimateUnilateralOneRepMax } from '@/src/utils/oneRepMax';

/** True when the set was logged in per-side (L/R) mode. */
export function isUnilateralSet(set: WorkoutSet): boolean {
  return set.executionMode === 'UNILATERAL';
}

/**
 * e1RM for a saved set, honoring execution mode: unilateral rows estimate off
 * the weaker side so the strong side can't inflate strength metrics.
 */
export function setE1rm(s: WorkoutSet): number | null {
  if (isUnilateralSet(s)) {
    return estimateUnilateralOneRepMax(
      s.weightLeft ?? s.weightRight ?? s.weightKg,
      s.repsLeft,
      s.repsRight
    );
  }
  return estimateOneRepMax(Number(s.weightKg) || 0, Number(s.reps) || 0);
}

/** Weaker-side rep count of a unilateral set (null when neither side logged). */
export function weakerSideReps(s: WorkoutSet): number | null {
  const sides = [s.repsLeft, s.repsRight].filter((r): r is number => r !== null);
  return sides.length === 0 ? null : Math.min(...sides);
}

/** Volume lifted by the left side across completed unilateral sets (kg). */
export function leftVolume(sets: WorkoutSet[]): number {
  return sets.reduce(
    (sum, s) =>
      s.completed && isUnilateralSet(s)
        ? sum + (Number(s.weightLeft ?? s.weightKg) || 0) * (Number(s.repsLeft) || 0)
        : sum,
    0
  );
}

/** Volume lifted by the right side across completed unilateral sets (kg). */
export function rightVolume(sets: WorkoutSet[]): number {
  return sets.reduce(
    (sum, s) =>
      s.completed && isUnilateralSet(s)
        ? sum + (Number(s.weightRight ?? s.weightKg) || 0) * (Number(s.repsRight) || 0)
        : sum,
    0
  );
}

export interface SideVolumes {
  left: number;
  right: number;
  /** Number of completed unilateral sets contributing to the totals. */
  setCount: number;
}

/** Aggregate L/R volume over `workouts` finished within the last `days` days. */
export function sideVolumesInWindow(
  workouts: WorkoutWithSets[],
  days: number,
  end: Date = new Date()
): SideVolumes {
  const cutoff = end.getTime() - days * 24 * 60 * 60 * 1000;
  let left = 0;
  let right = 0;
  let setCount = 0;
  for (const w of workouts) {
    const t = new Date(w.completedAt).getTime();
    if (Number.isNaN(t) || t < cutoff || t > end.getTime()) continue;
    left += leftVolume(w.sets);
    right += rightVolume(w.sets);
    setCount += w.sets.filter((s) => s.completed && isUnilateralSet(s)).length;
  }
  return { left, right, setCount };
}

export interface Imbalance {
  /** Which side is doing less total volume. */
  weakerSide: 'Left' | 'Right';
  /** How much less, as a percent of the stronger side's volume (0–100). */
  gapPct: number;
  left: number;
  right: number;
}

/**
 * Returns an imbalance when the weaker side's volume is >5% below the
 * stronger side's, null otherwise or when there is no unilateral volume.
 */
export function computeImbalance(volumes: SideVolumes): Imbalance | null {
  const { left, right } = volumes;
  if (left <= 0 && right <= 0) return null;
  const max = Math.max(left, right);
  const min = Math.min(left, right);
  if (max === 0) return null;
  const gapPct = ((max - min) / max) * 100;
  if (gapPct <= 5) return null;
  return { weakerSide: left < right ? 'Left' : 'Right', gapPct, left, right };
}

export interface SessionSplit {
  /** Short label for the chart axis (e.g. "Oct 8"). */
  label: string;
  /** Left/right volume for the session (kg, unilateral sets only). */
  left: number;
  right: number;
}

/**
 * Per-session L/R volume for unilateral sets, oldest → newest. Sessions with
 * no unilateral work are skipped so the charts stay meaningful.
 */
export function unilateralSessions(workouts: WorkoutWithSets[], max = 12): SessionSplit[] {
  const chronological = [...workouts].sort(
    (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
  );
  const rows: SessionSplit[] = [];
  for (const w of chronological) {
    const left = leftVolume(w.sets);
    const right = rightVolume(w.sets);
    if (left === 0 && right === 0) continue;
    rows.push({
      label: new Date(w.completedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      left,
      right,
    });
  }
  return rows.slice(-max);
}

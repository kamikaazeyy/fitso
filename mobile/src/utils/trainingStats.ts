import type { WorkoutWithSets } from '@/src/hooks/useWorkouts';
import { setE1rm } from '@/src/utils/unilateralStats';
import { displayWeight, type WeightUnit } from '@/src/utils/units';
import type { OverloadSeries } from '@/components/ProgressCharts';
import { colors } from '@/constants/theme';

export type WorkoutSets = WorkoutWithSets['sets'];

/** Total kg lifted across completed sets (canonical kg — convert for display). */
export function workoutVolume(sets: WorkoutSets): number {
  return sets.reduce(
    (sum, s) => (s.completed ? sum + (Number(s.weightKg) || 0) * (Number(s.reps) || 0) : sum),
    0
  );
}

export function workoutReps(sets: WorkoutSets): number {
  return sets.reduce((sum, s) => (s.completed ? sum + (Number(s.reps) || 0) : sum), 0);
}

/**
 * Progressive overload series: best estimated 1RM per exercise per session on
 * completed NORMAL sets (the PR definition used everywhere in the app), for
 * the `top` most frequently trained exercises. `workouts` must be
 * chronological (oldest → newest).
 */
export function buildOverloadSeries(
  workouts: WorkoutWithSets[],
  unit: WeightUnit,
  top = 3
): { series: OverloadSeries[] } {
  const perWorkoutBest = workouts.map((w) => {
    const best = new Map<string, number>();
    for (const s of w.sets) {
      if (!s.completed || s.setType !== 'NORMAL') continue;
      // Weaker-side estimate for unilateral sets (see unilateralStats).
      const e1rm = setE1rm(s);
      if (e1rm === null) continue;
      const current = best.get(s.exerciseName);
      if (current === undefined || e1rm > current) best.set(s.exerciseName, e1rm);
    }
    return best;
  });

  const counts = new Map<string, number>();
  for (const best of perWorkoutBest) {
    for (const name of best.keys()) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const topExercises = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([name]) => name);

  const palette = [colors.cta, colors.cyan, colors.yellow];
  return {
    series: topExercises.map((name, i) => ({
      name,
      color: palette[i],
      points: perWorkoutBest.map((best) => {
        const kg = best.get(name);
        return kg === undefined ? null : displayWeight(kg, unit);
      }),
    })),
  };
}

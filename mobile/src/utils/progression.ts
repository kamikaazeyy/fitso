import type { WorkoutWithSets } from '@/src/hooks/useWorkouts';
import { setE1rm } from '@/src/utils/unilateralStats';

export interface ProgressionRow {
  exerciseName: string;
  sessions: number;
  /** Best e1RM (kg) per session, oldest → newest. */
  points: number[];
  latestE1rm: number;
  /** Percent change first → last session; null with <2 points. */
  trendPct: number | null;
}

/**
 * Per-exercise strength progression within `days` days: sessions where the
 * exercise was trained with at least one completed NORMAL set, best e1RM per
 * session. Returns the `top` most frequently trained exercises.
 */
export function buildStrengthProgression(
  workouts: WorkoutWithSets[],
  days: number,
  top = 6,
  end: Date = new Date()
): ProgressionRow[] {
  const cutoff = end.getTime() - days * 24 * 60 * 60 * 1000;
  const chronological = [...workouts]
    .filter((w) => {
      const t = new Date(w.completedAt).getTime();
      return t >= cutoff && t <= end.getTime();
    })
    .filter((w) => !w.workoutType || w.workoutType === 'STRENGTH')
    .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());

  const byExercise = new Map<string, number[]>();
  for (const w of chronological) {
    const best = new Map<string, number>();
    for (const s of w.sets) {
      if (!s.completed || s.setType !== 'NORMAL') continue;
      // Weaker-side estimate for unilateral sets (see unilateralStats).
      const e1rm = setE1rm(s);
      if (e1rm === null) continue;
      const cur = best.get(s.exerciseName);
      if (cur === undefined || e1rm > cur) best.set(s.exerciseName, e1rm);
    }
    for (const [name, e1rm] of best) {
      const list = byExercise.get(name) ?? [];
      list.push(e1rm);
      byExercise.set(name, list);
    }
  }

  return [...byExercise.entries()]
    .map(([exerciseName, points]) => ({
      exerciseName,
      sessions: points.length,
      points,
      latestE1rm: points[points.length - 1] ?? 0,
      trendPct:
        points.length >= 2 && points[0] > 0
          ? ((points[points.length - 1] - points[0]) / points[0]) * 100
          : null,
    }))
    .sort((a, b) => b.sessions - a.sessions || b.latestE1rm - a.latestE1rm)
    .slice(0, top);
}

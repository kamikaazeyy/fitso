import type { WorkoutWithSets } from '@/src/hooks/useWorkouts';
import { workoutVolume } from '@/src/utils/trainingStats';
import { displayWeight, type WeightUnit } from '@/src/utils/units';

/** Monday 00:00 local time of the week containing `d`. */
export function startOfWeekFor(d: Date): Date {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

export interface TodayStats {
  trainedToday: boolean;
  todayVolumeKg: number;
  lastWorkoutTitle: string | null;
  hoursSinceLastWorkout: number | null;
  sessionsThisWeek: number;
  weeklyTarget: number;
  weekVolumeKg: number;
  /** Average weekly volume over the trailing 28 days (kg). */
  avgWeekVolumeKg: number;
  /** Median per-session volume over the trailing 28 days (kg, strength only). */
  medianSessionVolumeKg: number;
  /** Consecutive weeks (counting current) with at least one session. */
  weekStreak: number;
  /** Mon..Sun volume buckets for the current week. */
  dailyVolumes: { label: string; isToday: boolean; value: number }[];
}

/** Derives the "Today" dashboard numbers from workout history. `workouts` may be in any order.
 *  `asOf` lets the Home screen act as a day-wise view — stats are computed as if "now" were
 *  the end of the selected day (or the current moment when it's today). */
export function computeTodayStats(
  workouts: WorkoutWithSets[],
  weeklyTarget: number,
  asOf?: Date
): TodayStats {
  const realNow = new Date();
  let now = realNow;
  if (asOf) {
    const isSameDay =
      asOf.getFullYear() === realNow.getFullYear() &&
      asOf.getMonth() === realNow.getMonth() &&
      asOf.getDate() === realNow.getDate();
    now = isSameDay ? realNow : new Date(asOf.setHours(23, 59, 59, 999));
  }
  const weekStart = startOfWeekFor(now);
  const dayMs = 24 * 60 * 60 * 1000;
  const target = Math.max(1, weeklyTarget);

  const sorted = [...workouts]
    .filter((w) => new Date(w.completedAt).getTime() <= now.getTime())
    .sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );
  const last = sorted[0] ?? null;

  const thisWeek = sorted.filter((w) => new Date(w.completedAt) >= weekStart);
  const trailing28 = sorted.filter(
    (w) => now.getTime() - new Date(w.completedAt).getTime() < 28 * dayMs
  );

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayWorkouts = thisWeek.filter((w) => new Date(w.completedAt) >= todayStart);

  // Weekly streak: walk backwards in 7-day windows starting from this week.
  let weekStreak = 0;
  let cursor = new Date(weekStart);
  while (true) {
    const windowStart = cursor;
    const windowEnd = new Date(cursor.getTime() + 7 * dayMs);
    const has = sorted.some((w) => {
      const t = new Date(w.completedAt).getTime();
      return t >= windowStart.getTime() && t < windowEnd.getTime();
    });
    if (!has) break;
    weekStreak += 1;
    cursor = new Date(cursor.getTime() - 7 * dayMs);
  }

  const dayLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const todayIndex = (now.getDay() + 6) % 7;
  const dailyVolumes = dayLetters.map((label, i) => {
    const dayStart = new Date(weekStart.getTime() + i * dayMs);
    const dayEnd = new Date(dayStart.getTime() + dayMs);
    const value = thisWeek
      .filter((w) => {
        const t = new Date(w.completedAt).getTime();
        return t >= dayStart.getTime() && t < dayEnd.getTime();
      })
      .reduce((sum, w) => sum + workoutVolume(w.sets), 0);
    return { label, isToday: i === todayIndex, value };
  });

  return {
    trainedToday: todayWorkouts.length > 0,
    todayVolumeKg: todayWorkouts.reduce((sum, w) => sum + workoutVolume(w.sets), 0),
    lastWorkoutTitle: last?.title ?? null,
    hoursSinceLastWorkout: last
      ? (now.getTime() - new Date(last.completedAt).getTime()) / (60 * 60 * 1000)
      : null,
    sessionsThisWeek: thisWeek.length,
    weeklyTarget: target,
    weekVolumeKg: thisWeek.reduce((sum, w) => sum + workoutVolume(w.sets), 0),
    avgWeekVolumeKg:
      trailing28.reduce((sum, w) => sum + workoutVolume(w.sets), 0) / 4,
    medianSessionVolumeKg: (() => {
      const vols = trailing28
        .filter((w) => !w.workoutType || w.workoutType === 'STRENGTH')
        .map((w) => workoutVolume(w.sets))
        .filter((v) => v > 0)
        .sort((a, b) => a - b);
      if (vols.length === 0) return 0;
      const mid = Math.floor(vols.length / 2);
      return vols.length % 2 ? vols[mid] : (vols[mid - 1] + vols[mid]) / 2;
    })(),
    weekStreak,
    dailyVolumes,
  };
}

/** One rule-based coaching line derived from real numbers. */
export function coachMessage(stats: TodayStats, unit: WeightUnit): string {
  const fmt = (kg: number) =>
    (displayWeight(kg, unit) ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

  if (stats.hoursSinceLastWorkout === null) {
    return 'Finish your first session to set your baseline.';
  }
  if (stats.trainedToday) {
    return stats.todayVolumeKg > 0
      ? `Session logged — ${fmt(stats.todayVolumeKg)} ${unit} moved today. Nice work.`
      : 'Session logged today. Nice work.';
  }
  const hours = Math.round(stats.hoursSinceLastWorkout);
  const remaining = stats.weeklyTarget - stats.sessionsThisWeek;
  if (hours >= 48 && remaining > 0) {
    return `Recovered — ${hours}h since your last session. ${remaining} more to hit your weekly target.`;
  }
  if (hours >= 48) {
    return `Recovered — ${hours}h since your last session. You're clear to train.`;
  }
  if (remaining > 0) {
    return `Recovering — ${hours}h since your last session. ${stats.sessionsThisWeek} of ${stats.weeklyTarget} sessions done this week.`;
  }
  return `On pace — ${stats.sessionsThisWeek} of ${stats.weeklyTarget} sessions done this week.`;
}

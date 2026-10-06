import { useMemo } from 'react';
import { useQuery } from '@powersync/react-native';
import { CUSTOM_EXERCISES_TABLE, EXERCISE_CACHE_TABLE } from '@/src/db/AppSchema';
import type { WorkoutWithSets } from '@/src/hooks/useWorkouts';

export type MuscleGroup =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Legs'
  | 'Arms'
  | 'Core'
  | 'Other';

export const MUSCLE_GROUP_COLORS: Record<MuscleGroup, string> = {
  Chest: '#FF8B94',
  Back: '#4ADE80',
  Shoulders: '#00E5FF',
  Legs: '#34D399',
  Arms: '#FFD600',
  Core: '#B388FF',
  Other: '#8E8E93',
};

/** Maps a raw wger/catalogue muscle name (e.g. "Pectoralis major") to a display group. */
export function muscleGroup(raw: string | null | undefined): MuscleGroup {
  const m = (raw ?? '').toLowerCase();
  if (/pect|chest/.test(m)) return 'Chest';
  if (/latissim|\blats?\b|trapez|traps|erector|rhomboid|teres|infraspin|back/.test(m)) return 'Back';
  if (/delt|shoulder/.test(m)) return 'Shoulders';
  // Legs before Arms: "Biceps femoris" is a hamstring, not an arm muscle.
  if (
    /quad|hamstring|femoris|glute|gastrocnem|soleus|calf|calves|adduct|abduct|tibial|sartorius|leg/.test(
      m
    )
  )
    return 'Legs';
  if (/bicep|tricep|brachi|forearm|arm/.test(m)) return 'Arms';
  if (/abdomin|obliqu|serratus|transverse|core|abs/.test(m)) return 'Core';
  return 'Other';
}

function parseJsonList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export type MuscleLookup = (exerciseName: string, wgerId: number | null) => MuscleGroup;

/**
 * Exercise → primary muscle group lookup, sourced from the wger cache
 * (by wger id, falling back to name) and custom exercises (by name).
 */
export function useMuscleLookup(): MuscleLookup {
  const cacheRows = useQuery<{ wger_id: number; name: string; muscles: string }>(
    `SELECT wger_id, name, muscles FROM ${EXERCISE_CACHE_TABLE}`
  );
  const customRows = useQuery<{ name: string; muscles: string }>(
    `SELECT name, muscles FROM ${CUSTOM_EXERCISES_TABLE}`
  );

  return useMemo(() => {
    const byWger = new Map<number, MuscleGroup>();
    const byName = new Map<string, MuscleGroup>();
    for (const row of cacheRows.data) {
      const group = muscleGroup(parseJsonList(row.muscles)[0]);
      if (group === 'Other' && parseJsonList(row.muscles).length === 0) continue;
      byWger.set(row.wger_id, group);
      if (!byName.has(row.name)) byName.set(row.name, group);
    }
    for (const row of customRows.data) {
      const group = muscleGroup(parseJsonList(row.muscles)[0]);
      if (!byName.has(row.name)) byName.set(row.name, group);
    }
    return (exerciseName, wgerId) =>
      (wgerId != null ? byWger.get(wgerId) : undefined) ?? byName.get(exerciseName) ?? 'Other';
  }, [cacheRows.data, customRows.data]);
}

export interface MuscleLoadSlice {
  group: MuscleGroup;
  volumeKg: number;
  share: number; // 0..1 of total
}

/**
 * Muscle-group volume shares across completed sets within `days` days of `end`.
 * Returns slices sorted desc; anything past the top 6 is folded into "Other".
 */
export function buildMuscleLoad(
  workouts: WorkoutWithSets[],
  lookup: MuscleLookup,
  days: number,
  end: Date = new Date()
): MuscleLoadSlice[] {
  const cutoff = end.getTime() - days * 24 * 60 * 60 * 1000;
  const totals = new Map<MuscleGroup, number>();
  for (const w of workouts) {
    const t = new Date(w.completedAt).getTime();
    if (t < cutoff || t > end.getTime()) continue;
    if (w.workoutType && w.workoutType !== 'STRENGTH') continue;
    for (const s of w.sets) {
      if (!s.completed) continue;
      const volume = (Number(s.weightKg) || 0) * (Number(s.reps) || 0);
      if (volume <= 0) continue;
      const group = lookup(s.exerciseName, s.wgerId);
      totals.set(group, (totals.get(group) ?? 0) + volume);
    }
  }
  const total = [...totals.values()].reduce((a, b) => a + b, 0);
  if (total <= 0) return [];

  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 6);
  const rest = sorted.slice(6).reduce((a, [, v]) => a + v, 0);
  const slices: MuscleLoadSlice[] = top.map(([group, volumeKg]) => ({
    group,
    volumeKg,
    share: volumeKg / total,
  }));
  if (rest > 0) {
    const existing = slices.find((s) => s.group === 'Other');
    if (existing) existing.share += rest / total;
    else slices.push({ group: 'Other', volumeKg: rest, share: rest / total });
  }
  return slices;
}

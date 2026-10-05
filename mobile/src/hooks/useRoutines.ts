import { useMemo } from 'react';
import { useQuery } from '@powersync/react-native';

function safeParseEquipment(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export interface RoutineExercise {
  id: string;
  wgerId: number | null;
  exerciseName: string;
  equipment: string[];
  attachment: string | null;
  order: number;
}

export interface Split {
  id: string;
  name: string;
  order: number;
  exercises: RoutineExercise[];
}

export interface Routine {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  splits: Split[];
}

interface RoutineRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface SplitRow {
  id: string;
  routine_id: string;
  name: string;
  order_index: number;
}

interface RoutineExerciseRow {
  id: string;
  split_id: string;
  exercise_name: string;
  wger_id: number | null;
  equipment: string | null;
  attachment: string | null;
  order_index: number;
}

/**
 * Reads routines from local SQLite using PowerSync watched queries, which
 * re-emit whenever the underlying tables change — including when the sync
 * engine rewrites local rows during checkpoint reconciliation. The three
 * result sets are joined client-side (routines → splits → exercises).
 */
export function useRoutines() {
  const routinesResult = useQuery<RoutineRow>(
    `SELECT id, name, created_at, updated_at FROM routines ORDER BY updated_at DESC`
  );
  const splitsResult = useQuery<SplitRow>(
    `SELECT id, routine_id, name, order_index FROM splits ORDER BY order_index ASC`
  );
  const exercisesResult = useQuery<RoutineExerciseRow>(
    `SELECT id, split_id, exercise_name, wger_id, equipment, attachment, order_index
     FROM routine_exercises ORDER BY order_index ASC`
  );

  const isLoading =
    routinesResult.isLoading || splitsResult.isLoading || exercisesResult.isLoading;
  const error =
    routinesResult.error ?? splitsResult.error ?? exercisesResult.error ?? null;

  const data = useMemo<Routine[] | undefined>(() => {
    if (isLoading) return undefined;

    const exercisesBySplit = new Map<string, RoutineExercise[]>();
    for (const ex of exercisesResult.data) {
      const list = exercisesBySplit.get(ex.split_id) ?? [];
      list.push({
        id: ex.id,
        wgerId: ex.wger_id ?? null,
        exerciseName: ex.exercise_name,
        equipment: ex.equipment ? safeParseEquipment(ex.equipment) : [],
        attachment: ex.attachment ?? null,
        order: ex.order_index,
      });
      exercisesBySplit.set(ex.split_id, list);
    }

    const splitsByRoutine = new Map<string, Split[]>();
    for (const split of splitsResult.data) {
      const list = splitsByRoutine.get(split.routine_id) ?? [];
      list.push({
        id: split.id,
        name: split.name,
        order: split.order_index,
        exercises: exercisesBySplit.get(split.id) ?? [],
      });
      splitsByRoutine.set(split.routine_id, list);
    }

    return routinesResult.data.map((routine) => ({
      id: routine.id,
      name: routine.name,
      createdAt: routine.created_at,
      updatedAt: routine.updated_at,
      splits: splitsByRoutine.get(routine.id) ?? [],
    }));
  }, [isLoading, routinesResult.data, splitsResult.data, exercisesResult.data]);

  return { data, isLoading, error };
}

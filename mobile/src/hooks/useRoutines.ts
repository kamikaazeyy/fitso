import { useQuery } from '@tanstack/react-query';
import { usePowerSync } from '@powersync/react-native';

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

export function useRoutines() {
  const db = usePowerSync();

  return useQuery<Routine[]>({
    queryKey: ['routines'],
    queryFn: async () => {
      const routinesResult = await db.execute(
        `SELECT id, name, created_at, updated_at FROM routines ORDER BY updated_at DESC`
      );
      const routineRows = routinesResult.rows?._array || [];
      if (routineRows.length === 0) return [];

      // Fetch splits and exercises in one batched query each instead of
      // nested per-row queries.
      const routineIds = routineRows.map((r: any) => r.id);
      const splitsResult = await db.execute(
        `SELECT id, routine_id, name, order_index FROM splits
         WHERE routine_id IN (${routineIds.map(() => '?').join(', ')})
         ORDER BY order_index ASC`,
        routineIds
      );
      const splitRows = splitsResult.rows?._array || [];

      const splitIds = splitRows.map((s: any) => s.id);
      const exerciseRows = splitIds.length
        ? (
            await db.execute(
              `SELECT id, split_id, exercise_name, wger_id, equipment, attachment, order_index
               FROM routine_exercises
               WHERE split_id IN (${splitIds.map(() => '?').join(', ')})
               ORDER BY order_index ASC`,
              splitIds
            )
          ).rows?._array || []
        : [];

      const exercisesBySplit = new Map<string, RoutineExercise[]>();
      for (const ex of exerciseRows) {
        const exercise: RoutineExercise = {
          id: ex.id,
          wgerId: ex.wger_id ?? null,
          exerciseName: ex.exercise_name,
          equipment: ex.equipment ? safeParseEquipment(ex.equipment) : [],
          attachment: ex.attachment ?? null,
          order: ex.order_index,
        };
        const list = exercisesBySplit.get(ex.split_id);
        if (list) list.push(exercise);
        else exercisesBySplit.set(ex.split_id, [exercise]);
      }

      const splitsByRoutine = new Map<string, Split[]>();
      for (const split of splitRows) {
        const entry: Split = {
          id: split.id,
          name: split.name,
          order: split.order_index,
          exercises: exercisesBySplit.get(split.id) ?? [],
        };
        const list = splitsByRoutine.get(split.routine_id);
        if (list) list.push(entry);
        else splitsByRoutine.set(split.routine_id, [entry]);
      }

      return routineRows.map((routine: any) => ({
        id: routine.id,
        name: routine.name,
        createdAt: routine.created_at,
        updatedAt: routine.updated_at,
        splits: splitsByRoutine.get(routine.id) ?? [],
      }));
    },
  });
}

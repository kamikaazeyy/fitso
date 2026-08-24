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

      const result: Routine[] = [];
      for (const routine of routineRows) {
        const splitsResult = await db.execute(
          `SELECT id, name, order_index FROM splits WHERE routine_id = ? ORDER BY order_index ASC`,
          [routine.id]
        );
        const splitRows = splitsResult.rows?._array || [];

        const splits: Split[] = [];
        for (const split of splitRows) {
          const exercisesResult = await db.execute(
            `SELECT id, exercise_name, wger_id, equipment, attachment, order_index
             FROM routine_exercises WHERE split_id = ? ORDER BY order_index ASC`,
            [split.id]
          );
          const exerciseRows = exercisesResult.rows?._array || [];

          splits.push({
            id: split.id,
            name: split.name,
            order: split.order_index,
            exercises: exerciseRows.map((ex: any) => ({
              id: ex.id,
              wgerId: ex.wger_id ?? null,
              exerciseName: ex.exercise_name,
              equipment: ex.equipment ? safeParseEquipment(ex.equipment) : [],
              attachment: ex.attachment ?? null,
              order: ex.order_index,
            })),
          });
        }

        result.push({
          id: routine.id,
          name: routine.name,
          createdAt: routine.created_at,
          updatedAt: routine.updated_at,
          splits,
        });
      }

      return result;
    },
  });
}

import { useCallback } from 'react';
import { usePowerSync } from '@powersync/react-native';
import {
  ROUTINES_TABLE,
  ROUTINE_EXERCISES_TABLE,
  SPLITS_TABLE,
} from '@/src/db/AppSchema';
import { uuid } from '@/src/utils/id';

export interface RoutineDraftExercise {
  id: string;
  exerciseName: string;
  wgerId: number | null;
  equipment: string[];
  attachment: string | null;
  targetSets: number;
  targetReps: number | null;
  targetRepsMax: number | null;
  targetWeight: number | null;
  restSeconds: number | null;
}

export interface RoutineDraftSplit {
  id: string;
  name: string;
  exercises: RoutineDraftExercise[];
}

export interface RoutineDraft {
  id: string;
  name: string;
  notes: string | null;
  splits: RoutineDraftSplit[];
}

interface SplitRow {
  id: string;
}

interface RoutineExerciseIdRow {
  id: string;
  split_id: string;
}

/**
 * Routine CRUD against local SQLite. Every write is a normal INSERT/UPDATE/
 * DELETE inside a writeTransaction, so PowerSync queues the ops and pushes
 * them through /api/sync/upload — all of this works fully offline.
 */
export function useRoutineMutations() {
  const db = usePowerSync();

  const saveRoutine = useCallback(
    async (draft: RoutineDraft, userId: string, isNew: boolean) => {
      const now = new Date().toISOString();

      await db.writeTransaction(async (tx) => {
        if (isNew) {
          await tx.execute(
            `INSERT INTO ${ROUTINES_TABLE} (id, user_id, name, notes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [draft.id, userId, draft.name, draft.notes, now, now]
          );
        } else {
          await tx.execute(
            `UPDATE ${ROUTINES_TABLE} SET name = ?, notes = ?, updated_at = ? WHERE id = ?`,
            [draft.name, draft.notes, now, draft.id]
          );
        }

        // Splits: delete removed, insert new, update kept
        const existingSplits = await tx.execute(
          `SELECT id FROM ${SPLITS_TABLE} WHERE routine_id = ?`,
          [draft.id]
        );
        const draftSplitIds = new Set(draft.splits.map((split) => split.id));
        for (const row of (existingSplits.rows?._array ?? []) as SplitRow[]) {
          if (!draftSplitIds.has(row.id)) {
            await tx.execute(
              `DELETE FROM ${ROUTINE_EXERCISES_TABLE} WHERE split_id = ?`,
              [row.id]
            );
            await tx.execute(`DELETE FROM ${SPLITS_TABLE} WHERE id = ?`, [row.id]);
          }
        }

        const existingSplitIds = new Set(
          ((existingSplits.rows?._array ?? []) as SplitRow[]).map((row) => row.id)
        );
        for (const [index, split] of draft.splits.entries()) {
          if (existingSplitIds.has(split.id)) {
            await tx.execute(
              `UPDATE ${SPLITS_TABLE} SET name = ?, order_index = ? WHERE id = ?`,
              [split.name, index, split.id]
            );
          } else {
            await tx.execute(
              `INSERT INTO ${SPLITS_TABLE} (id, routine_id, name, order_index, created_at)
               VALUES (?, ?, ?, ?, ?)`,
              [split.id, draft.id, split.name, index, now]
            );
          }
        }

        // Exercises: same diff per split — delete removed, upsert kept/new
        for (const split of draft.splits) {
          const existing = await tx.execute(
            `SELECT id, split_id FROM ${ROUTINE_EXERCISES_TABLE} WHERE split_id = ?`,
            [split.id]
          );
          const existingRows = (existing.rows?._array ?? []) as RoutineExerciseIdRow[];
          const existingIds = new Set(existingRows.map((row) => row.id));
          const draftIds = new Set(split.exercises.map((ex) => ex.id));

          for (const row of existingRows) {
            if (!draftIds.has(row.id)) {
              await tx.execute(
                `DELETE FROM ${ROUTINE_EXERCISES_TABLE} WHERE id = ?`,
                [row.id]
              );
            }
          }

          for (const [orderIndex, ex] of split.exercises.entries()) {
            const params = [
              split.id,
              ex.exerciseName,
              ex.wgerId,
              JSON.stringify(ex.equipment),
              ex.attachment,
              orderIndex,
              ex.targetSets,
              ex.targetReps,
              ex.targetRepsMax,
              ex.targetWeight,
              ex.restSeconds,
            ];
            if (existingIds.has(ex.id)) {
              await tx.execute(
                `UPDATE ${ROUTINE_EXERCISES_TABLE}
                 SET split_id = ?, exercise_name = ?, wger_id = ?, equipment = ?,
                     attachment = ?, order_index = ?, target_sets = ?, target_reps = ?,
                     target_reps_max = ?, target_weight = ?, rest_seconds = ?
                 WHERE id = ?`,
                [...params, ex.id]
              );
            } else {
              await tx.execute(
                `INSERT INTO ${ROUTINE_EXERCISES_TABLE}
                   (id, split_id, exercise_name, wger_id, equipment, attachment, order_index,
                    target_sets, target_reps, target_reps_max, target_weight, rest_seconds, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [ex.id, ...params, now]
              );
            }
          }
        }
      });
    },
    [db]
  );

  const deleteRoutine = useCallback(
    async (routineId: string) => {
      await db.writeTransaction(async (tx) => {
        const splits = await tx.execute(
          `SELECT id FROM ${SPLITS_TABLE} WHERE routine_id = ?`,
          [routineId]
        );
        for (const row of (splits.rows?._array ?? []) as SplitRow[]) {
          await tx.execute(
            `DELETE FROM ${ROUTINE_EXERCISES_TABLE} WHERE split_id = ?`,
            [row.id]
          );
        }
        await tx.execute(`DELETE FROM ${SPLITS_TABLE} WHERE routine_id = ?`, [routineId]);
        await tx.execute(`DELETE FROM ${ROUTINES_TABLE} WHERE id = ?`, [routineId]);
      });
    },
    [db]
  );

  const duplicateRoutine = useCallback(
    async (routineId: string, userId: string) => {
      const now = new Date().toISOString();

      const routineResult = await db.execute(
        `SELECT name, notes FROM ${ROUTINES_TABLE} WHERE id = ?`,
        [routineId]
      );
      const source = routineResult.rows?._array?.[0] as
        | { name: string; notes: string | null }
        | undefined;
      if (!source) throw new Error('Routine not found');

      const splitsResult = await db.execute(
        `SELECT id, name, order_index FROM ${SPLITS_TABLE} WHERE routine_id = ? ORDER BY order_index ASC`,
        [routineId]
      );
      const sourceSplits = (splitsResult.rows?._array ?? []) as {
        id: string;
        name: string;
        order_index: number;
      }[];

      const exercisesResult = await db.execute(
        `SELECT re.* FROM ${ROUTINE_EXERCISES_TABLE} re
         INNER JOIN ${SPLITS_TABLE} s ON re.split_id = s.id
         WHERE s.routine_id = ?
         ORDER BY re.order_index ASC`,
        [routineId]
      );
      const sourceExercises = (exercisesResult.rows?._array ?? []) as Record<string, unknown>[];

      await db.writeTransaction(async (tx) => {
        const newRoutineId = uuid();
        await tx.execute(
          `INSERT INTO ${ROUTINES_TABLE} (id, user_id, name, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [newRoutineId, userId, `${source.name} (Copy)`, source.notes, now, now]
        );

        const splitIdMap = new Map<string, string>();
        for (const split of sourceSplits) {
          const newSplitId = uuid();
          splitIdMap.set(split.id, newSplitId);
          await tx.execute(
            `INSERT INTO ${SPLITS_TABLE} (id, routine_id, name, order_index, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            [newSplitId, newRoutineId, split.name, split.order_index, now]
          );
        }

        for (const ex of sourceExercises) {
          const newSplitId = splitIdMap.get(ex.split_id as string);
          if (!newSplitId) continue;
          await tx.execute(
            `INSERT INTO ${ROUTINE_EXERCISES_TABLE}
               (id, split_id, exercise_name, wger_id, equipment, attachment, order_index,
                target_sets, target_reps, target_reps_max, target_weight, rest_seconds, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uuid(),
              newSplitId,
              ex.exercise_name,
              ex.wger_id,
              ex.equipment,
              ex.attachment,
              ex.order_index,
              ex.target_sets,
              ex.target_reps,
              ex.target_reps_max,
              ex.target_weight,
              ex.rest_seconds,
              now,
            ]
          );
        }
      });
    },
    [db]
  );

  return { saveRoutine, deleteRoutine, duplicateRoutine };
}

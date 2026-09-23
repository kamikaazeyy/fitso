import { computeRoutineUpdate } from '@/src/utils/routineSync';
import type { ActiveExercise, ActiveSet } from '@/src/types/workout';

function makeSet(overrides: Partial<ActiveSet> = {}): ActiveSet {
  return {
    id: `set-${Math.random().toString(36).slice(2)}`,
    setIndex: 1,
    setType: 'NORMAL',
    weight: null,
    reps: null,
    rpe: null,
    isCompleted: false,
    ...overrides,
  };
}

function makeExercise(overrides: Partial<ActiveExercise> = {}): ActiveExercise {
  return {
    exerciseId: 'ex-1',
    name: 'Bench Press',
    orderIndex: 0,
    restSeconds: 90,
    sets: [makeSet()],
    ...overrides,
  };
}

describe('computeRoutineUpdate', () => {
  it('updates an existing template exercise from its last completed working set', () => {
    const plan = computeRoutineUpdate(
      new Set(['ex-1']),
      [
        makeExercise({
          sets: [
            makeSet({ setIndex: 1, weight: 100, reps: 8, isCompleted: true }),
            makeSet({ setIndex: 2, weight: 105, reps: 6, isCompleted: true }),
            makeSet({ setIndex: 3 }),
          ],
        }),
      ]
    );

    expect(plan.inserts).toHaveLength(0);
    expect(plan.updates).toEqual([
      expect.objectContaining({
        id: 'ex-1',
        targetSets: 2,
        targetReps: 6,
        targetWeight: 105,
        restSeconds: 90,
      }),
    ]);
  });

  it('skips warm-up sets when picking the target basis', () => {
    const plan = computeRoutineUpdate(
      new Set(['ex-1']),
      [
        makeExercise({
          sets: [
            makeSet({ setIndex: 1, setType: 'NORMAL', weight: 100, reps: 8, isCompleted: true }),
            makeSet({ setIndex: 2, setType: 'WARMUP', weight: 40, reps: 12, isCompleted: true }),
          ],
        }),
      ]
    );

    expect(plan.updates[0]).toMatchObject({ targetReps: 8, targetWeight: 100, targetSets: 2 });
  });

  it('inserts exercises added mid-workout (id not in the template)', () => {
    const plan = computeRoutineUpdate(
      new Set(['ex-1']),
      [
        makeExercise({
          exerciseId: 'wger-uuid-123',
          name: 'Lat Pulldown',
          wgerId: 42,
          equipment: ['Cable machine'],
          attachment: 'Rope',
          orderIndex: 1,
          sets: [makeSet({ weight: 50, reps: 10, isCompleted: true })],
        }),
      ]
    );

    expect(plan.updates).toHaveLength(0);
    expect(plan.inserts).toEqual([
      expect.objectContaining({
        exerciseName: 'Lat Pulldown',
        wgerId: 42,
        equipment: ['Cable machine'],
        attachment: 'Rope',
        orderIndex: 1,
        targetSets: 1,
        targetReps: 10,
        targetWeight: 50,
      }),
    ]);
  });

  it('leaves targets null when nothing was completed (preserves stored values via COALESCE)', () => {
    const plan = computeRoutineUpdate(new Set(['ex-1']), [makeExercise()]);

    expect(plan.updates[0]).toMatchObject({
      id: 'ex-1',
      targetSets: null,
      targetReps: null,
      targetWeight: null,
    });
  });

  it('writes order and attachment even when sets were skipped', () => {
    const plan = computeRoutineUpdate(
      new Set(['ex-1']),
      [makeExercise({ orderIndex: 3, attachment: 'V-bar', restSeconds: 45 })]
    );

    expect(plan.updates[0]).toMatchObject({ orderIndex: 3, attachment: 'V-bar', restSeconds: 45 });
  });

  it('handles a mixed session: update existing + insert new, in order', () => {
    const plan = computeRoutineUpdate(new Set(['ex-1']), [
      makeExercise({ exerciseId: 'ex-1', sets: [makeSet({ weight: 80, reps: 5, isCompleted: true })] }),
      makeExercise({ exerciseId: 'new-ex', name: 'Dips', orderIndex: 1 }),
    ]);

    expect(plan.updates.map((u) => u.id)).toEqual(['ex-1']);
    expect(plan.inserts.map((i) => i.exerciseName)).toEqual(['Dips']);
    expect(plan.inserts[0].targetSets).toBe(1); // falls back to session set count
  });
});

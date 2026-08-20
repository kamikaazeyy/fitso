export type SetType = 'NORMAL' | 'WARMUP' | 'DROP' | 'FAILURE';

export const SET_TYPE_CYCLE: readonly SetType[] = ['NORMAL', 'WARMUP', 'DROP', 'FAILURE'] as const;

export const SET_TYPE_LABELS: Record<SetType, string> = {
  NORMAL: '',
  WARMUP: 'W',
  DROP: 'D',
  FAILURE: 'F',
};

/** An exercise definition (from the local `routine_exercises` table or the wger catalogue). */
export interface Exercise {
  id: string;
  name: string;
  wgerId?: number | null;
  equipment?: string[];
  defaultRestSeconds?: number | null;
}

/** A single exercise slot inside a routine template. */
export interface RoutineExercise {
  exerciseId: string;
  name: string;
  orderIndex: number;
  targetSets?: number;
  targetReps?: number | null;
  targetWeight?: number | null;
  restSeconds?: number | null;
  wgerId?: number | null;
  equipment?: string[];
  attachment?: string;
}

/** A saved routine template used to seed a session. */
export interface Routine {
  id: string;
  name: string;
  exercises: RoutineExercise[];
}

/** A set as it lives in RAM during an active session. */
export interface ActiveSet {
  id: string;
  setIndex: number;
  setType: SetType;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  isCompleted: boolean;
  /** Ghost placeholder values propagated from the previous completed set. */
  previousWeight?: number;
  previousReps?: number;
  /** Brzycki estimate captured when the set was completed. */
  estimatedOneRepMax?: number | null;
  isPersonalRecord?: boolean;
}

export interface ActiveExercise {
  exerciseId: string;
  name: string;
  orderIndex: number;
  restSeconds: number;
  sets: ActiveSet[];
  wgerId?: number | null;
  equipment?: string[];
  attachment?: string;
}

export interface ActiveRestTimer {
  targetTimestamp: number;
  durationSeconds: number;
}

import { column, Schema, Table } from '@powersync/common';

export const ROUTINES_TABLE = 'routines';
export const WORKOUTS_TABLE = 'workouts';
export const SPLITS_TABLE = 'splits';
export const ROUTINE_EXERCISES_TABLE = 'routine_exercises';
export const WORKOUT_SETS_TABLE = 'workout_sets';

const routines = new Table(
  {
    user_id: column.text,
    name: column.text,
    notes: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { by_user: ['user_id'] } }
);

const workouts = new Table(
  {
    user_id: column.text,
    routine_id: column.text,
    split_id: column.text,
    title: column.text,
    started_at: column.text,
    finished_at: column.text,
    duration_seconds: column.integer,
    created_at: column.text,
  },
  { indexes: { by_user: ['user_id'], by_routine: ['routine_id'] } }
);

const splits = new Table(
  {
    routine_id: column.text,
    name: column.text,
    order_index: column.integer,
    created_at: column.text,
  },
  { indexes: { by_routine: ['routine_id'] } }
);

const routine_exercises = new Table(
  {
    split_id: column.text,
    exercise_name: column.text,
    wger_id: column.integer,
    equipment: column.text,
    attachment: column.text,
    order_index: column.integer,
    target_sets: column.integer,
    target_reps: column.integer,
    target_weight: column.real,
    rest_seconds: column.integer,
    created_at: column.text,
  },
  { indexes: { by_split: ['split_id'] } }
);

const workout_sets = new Table(
  {
    workout_id: column.text,
    exercise_name: column.text,
    wger_id: column.integer,
    order_index: column.integer,
    set_number: column.integer,
    set_type: column.text,
    weight: column.real,
    reps: column.integer,
    rpe: column.real,
    is_completed: column.integer,
    attachment: column.text,
    created_at: column.text,
  },
  { indexes: { by_workout: ['workout_id'], by_exercise: ['exercise_name'] } }
);

export const AppSchema = new Schema({
  routines,
  workouts,
  splits,
  routine_exercises,
  workout_sets,
});

export type Database = (typeof AppSchema)['types'];
export type RoutineRecord = Database['routines'];
export type WorkoutRecord = Database['workouts'];
export type SplitRecord = Database['splits'];
export type RoutineExerciseRecord = Database['routine_exercises'];
export type WorkoutSetRecord = Database['workout_sets'];

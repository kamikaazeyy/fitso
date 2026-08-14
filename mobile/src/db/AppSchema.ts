import { column, Schema, Table } from '@powersync/common';

export const ROUTINES_TABLE = 'routines';
export const WORKOUTS_TABLE = 'workouts';
export const EXERCISES_TABLE = 'exercises';
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
    title: column.text,
    started_at: column.text,
    finished_at: column.text,
    duration_seconds: column.integer,
    created_at: column.text,
  },
  { indexes: { by_user: ['user_id'], by_routine: ['routine_id'] } }
);

const exercises = new Table(
  {
    name: column.text,
    wger_id: column.integer,
    equipment: column.text,
    default_rest_seconds: column.integer,
    created_at: column.text,
  },
  { indexes: { by_name: ['name'] } }
);

const workout_sets = new Table(
  {
    workout_id: column.text,
    exercise_id: column.text,
    order_index: column.integer,
    set_type: column.text,
    weight: column.real,
    reps: column.integer,
    rpe: column.real,
    is_completed: column.integer,
    created_at: column.text,
  },
  { indexes: { by_workout: ['workout_id'], by_exercise: ['exercise_id'] } }
);

export const AppSchema = new Schema({
  routines,
  workouts,
  exercises,
  workout_sets,
});

export type Database = (typeof AppSchema)['types'];
export type RoutineRecord = Database['routines'];
export type WorkoutRecord = Database['workouts'];
export type ExerciseRecord = Database['exercises'];
export type WorkoutSetRecord = Database['workout_sets'];

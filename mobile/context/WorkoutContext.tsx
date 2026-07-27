import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export interface PendingExercise {
  id: string;
  name: string;
}

interface WorkoutContextValue {
  pendingExercise: PendingExercise | null;
  selectExercise: (exercise: PendingExercise) => void;
  consumePendingExercise: () => PendingExercise | null;
}

const WorkoutContext = createContext<WorkoutContextValue | null>(null);

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [pendingExercise, setPendingExercise] = useState<PendingExercise | null>(null);

  const selectExercise = useCallback((exercise: PendingExercise) => {
    setPendingExercise(exercise);
  }, []);

  const consumePendingExercise = useCallback(() => {
    const exercise = pendingExercise;
    if (exercise) {
      setPendingExercise(null);
    }
    return exercise;
  }, [pendingExercise]);

  const value = useMemo(
    () => ({
      pendingExercise,
      selectExercise,
      consumePendingExercise,
    }),
    [pendingExercise, selectExercise, consumePendingExercise]
  );

  return <WorkoutContext.Provider value={value}>{children}</WorkoutContext.Provider>;
}

export function useWorkout() {
  const context = useContext(WorkoutContext);
  if (!context) {
    throw new Error('useWorkout must be used within a WorkoutProvider');
  }
  return context;
}

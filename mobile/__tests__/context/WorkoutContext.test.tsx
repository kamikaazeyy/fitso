import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { WorkoutProvider, useWorkout } from '@/context/WorkoutContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <WorkoutProvider>{children}</WorkoutProvider>
);

describe('useWorkout', () => {
  it('throws when used outside of a provider', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useWorkout())).toThrow(
      'useWorkout must be used within a WorkoutProvider'
    );
    errorSpy.mockRestore();
  });

  it('starts with no pending exercise', () => {
    const { result } = renderHook(() => useWorkout(), { wrapper });
    expect(result.current.pendingExercise).toBeNull();
  });

  it('stores the selected exercise', () => {
    const { result } = renderHook(() => useWorkout(), { wrapper });

    act(() => result.current.selectExercise({ id: '1', name: 'Bench Press' }));

    expect(result.current.pendingExercise).toEqual({ id: '1', name: 'Bench Press' });
  });

  it('overwrites a previous selection', () => {
    const { result } = renderHook(() => useWorkout(), { wrapper });

    act(() => result.current.selectExercise({ id: '1', name: 'Bench Press' }));
    act(() => result.current.selectExercise({ id: '2', name: 'Squat' }));

    expect(result.current.pendingExercise).toEqual({ id: '2', name: 'Squat' });
  });

  it('returns and clears the pending exercise when consumed', () => {
    const { result } = renderHook(() => useWorkout(), { wrapper });

    act(() => result.current.selectExercise({ id: '1', name: 'Bench Press' }));

    let consumed: ReturnType<typeof result.current.consumePendingExercise> = null;
    act(() => {
      consumed = result.current.consumePendingExercise();
    });

    expect(consumed).toEqual({ id: '1', name: 'Bench Press' });
    expect(result.current.pendingExercise).toBeNull();
  });

  it('returns null when consuming twice', () => {
    const { result } = renderHook(() => useWorkout(), { wrapper });

    act(() => result.current.selectExercise({ id: '1', name: 'Bench Press' }));
    act(() => {
      result.current.consumePendingExercise();
    });

    let consumed: ReturnType<typeof result.current.consumePendingExercise> = {
      id: 'x',
      name: 'x',
    };
    act(() => {
      consumed = result.current.consumePendingExercise();
    });

    expect(consumed).toBeNull();
  });

  it('keeps a stable selectExercise identity across renders', () => {
    const { result, rerender } = renderHook(() => useWorkout(), { wrapper });
    const first = result.current.selectExercise;

    rerender({});

    expect(result.current.selectExercise).toBe(first);
  });
});

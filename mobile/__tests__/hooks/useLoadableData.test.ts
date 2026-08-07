import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useLoadableData } from '@/hooks/useLoadableData';

describe('useLoadableData', () => {
  it('starts in the loading state with the provided initial data', () => {
    const { result } = renderHook(() =>
      useLoadableData(() => 'value', [], { initialData: 'seed', loadingDelay: 0 })
    );

    expect(result.current.status).toBe('loading');
    expect(result.current.data).toBe('seed');
    expect(result.current.error).toBeNull();
  });

  it('resolves synchronous loaders to the data state', async () => {
    const { result } = renderHook(() =>
      useLoadableData(() => ['a'], [], { loadingDelay: 0 })
    );

    await waitFor(() => expect(result.current.status).toBe('data'));
    expect(result.current.data).toEqual(['a']);
  });

  it('resolves async loaders to the data state', async () => {
    const { result } = renderHook(() =>
      useLoadableData(async () => ({ id: 1 }), [], { loadingDelay: 0 })
    );

    await waitFor(() => expect(result.current.status).toBe('data'));
    expect(result.current.data).toEqual({ id: 1 });
  });

  it('treats an empty array as empty', async () => {
    const { result } = renderHook(() =>
      useLoadableData<string[]>(() => [], [], { loadingDelay: 0 })
    );

    await waitFor(() => expect(result.current.status).toBe('empty'));
    expect(result.current.data).toEqual([]);
  });

  it('treats an object with no keys as empty', async () => {
    const { result } = renderHook(() =>
      useLoadableData<Record<string, number>>(() => ({}), [], { loadingDelay: 0 })
    );

    await waitFor(() => expect(result.current.status).toBe('empty'));
  });

  it('treats null as empty', async () => {
    const { result } = renderHook(() =>
      useLoadableData<null>(() => null, [], { loadingDelay: 0 })
    );

    await waitFor(() => expect(result.current.status).toBe('empty'));
  });

  it('honours a custom isEmpty predicate', async () => {
    const { result } = renderHook(() =>
      useLoadableData(() => ({ items: [] as string[] }), [], {
        loadingDelay: 0,
        isEmpty: (data) => data.items.length === 0,
      })
    );

    await waitFor(() => expect(result.current.status).toBe('empty'));
    expect(result.current.data).toEqual({ items: [] });
  });

  it('exposes the error message and falls back to empty when the loader rejects', async () => {
    const { result } = renderHook(() =>
      useLoadableData(async () => {
        throw new Error('boom');
      }, [], { loadingDelay: 0 })
    );

    await waitFor(() => expect(result.current.error).toBe('boom'));
    expect(result.current.status).toBe('empty');
    expect(result.current.data).toBeNull();
  });

  it('uses a generic message when a non-Error value is thrown', async () => {
    const { result } = renderHook(() =>
      useLoadableData(async () => {
        throw 'nope';
      }, [], { loadingDelay: 0 })
    );

    await waitFor(() => expect(result.current.error).toBe('Failed to load'));
  });

  it('reloads and clears the previous error when deps change', async () => {
    const loader = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new Error('first failure'))
      .mockResolvedValueOnce('second');

    const { result, rerender } = renderHook(
      ({ dep }: { dep: number }) => useLoadableData(loader, [dep], { loadingDelay: 0 }),
      { initialProps: { dep: 1 } }
    );

    await waitFor(() => expect(result.current.error).toBe('first failure'));

    rerender({ dep: 2 });

    await waitFor(() => expect(result.current.status).toBe('data'));
    expect(result.current.data).toBe('second');
    expect(result.current.error).toBeNull();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('does not reload when deps are unchanged', async () => {
    const loader = jest.fn(() => 'value');

    const { result, rerender } = renderHook(() =>
      useLoadableData(loader, [], { loadingDelay: 0 })
    );

    await waitFor(() => expect(result.current.status).toBe('data'));
    rerender({});

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('waits for loadingDelay before publishing data', async () => {
    jest.useFakeTimers();
    try {
      const { result } = renderHook(() =>
        useLoadableData(async () => 'value', [], { loadingDelay: 500 })
      );

      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.status).toBe('loading');

      await act(async () => {
        jest.advanceTimersByTime(500);
      });
      expect(result.current.status).toBe('data');
      expect(result.current.data).toBe('value');
    } finally {
      jest.useRealTimers();
    }
  });

  it('ignores a resolution that lands after unmount', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    let resolveLoader: (value: string) => void = () => {};
    const loader = () =>
      new Promise<string>((resolve) => {
        resolveLoader = resolve;
      });

    const { result, unmount } = renderHook(() =>
      useLoadableData(loader, [], { loadingDelay: 0 })
    );

    unmount();
    await act(async () => {
      resolveLoader('late');
    });

    expect(result.current.status).toBe('loading');
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

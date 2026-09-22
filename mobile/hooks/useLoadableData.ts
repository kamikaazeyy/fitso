import { useState, useEffect, useRef } from 'react';

export type LoadableStatus = 'loading' | 'empty' | 'data';

export interface UseLoadableDataOptions<T> {
  initialData?: T | null;
  isEmpty?: (data: T) => boolean;
}

export interface UseLoadableDataResult<T> {
  data: T | null;
  status: LoadableStatus;
  error: string | null;
}

export function useLoadableData<T>(
  loader: () => Promise<T> | T,
  deps: unknown[] = [],
  options: UseLoadableDataOptions<T> = {}
): UseLoadableDataResult<T> {
  const { initialData = null, isEmpty } = options;

  const loaderRef = useRef(loader);
  const isEmptyRef = useRef(isEmpty);

  loaderRef.current = loader;
  isEmptyRef.current = isEmpty;

  const [data, setData] = useState<T | null>(initialData);
  const [status, setStatus] = useState<LoadableStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);

    const run = async () => {
      try {
        const result = await loaderRef.current();
        if (cancelled) return;

        const emptyFn = isEmptyRef.current;
        const empty = emptyFn
          ? emptyFn(result)
          : Array.isArray(result)
          ? result.length === 0
          : result === null || result === undefined ||
            (typeof result === 'object' && Object.keys(result).length === 0);

        setData(result);
        setStatus(empty ? 'empty' : 'data');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load');
        setStatus('empty');
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, deps);

  return { data, status, error };
}

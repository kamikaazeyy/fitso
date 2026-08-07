import { useState, useEffect, useRef, useCallback } from 'react';

export type LoadableStatus = 'loading' | 'empty' | 'data' | 'error';

export interface UseLoadableDataOptions<T> {
  initialData?: T | null;
  isEmpty?: (data: T) => boolean;
  loadingDelay?: number;
  onError?: (error: Error) => void;
}

export interface UseLoadableDataResult<T> {
  data: T | null;
  status: LoadableStatus;
  error: string | null;
  retry: () => void;
}

function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new Error(typeof value === 'string' ? value : 'Failed to load');
}

export function useLoadableData<T>(
  loader: () => Promise<T> | T,
  deps: unknown[] = [],
  options: UseLoadableDataOptions<T> = {}
): UseLoadableDataResult<T> {
  const { initialData = null, isEmpty, loadingDelay = 600, onError } = options;

  const loaderRef = useRef(loader);
  const isEmptyRef = useRef(isEmpty);
  const loadingDelayRef = useRef(loadingDelay);
  const onErrorRef = useRef(onError);

  loaderRef.current = loader;
  isEmptyRef.current = isEmpty;
  loadingDelayRef.current = loadingDelay;
  onErrorRef.current = onError;

  const [data, setData] = useState<T | null>(initialData);
  const [status, setStatus] = useState<LoadableStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((prev) => prev + 1), []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);

    const run = async () => {
      try {
        const result = await loaderRef.current();
        await new Promise((resolve) => setTimeout(resolve, loadingDelayRef.current));
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
        const failure = toError(err);
        // Always surface the failure, even when the effect has been cancelled,
        // so it is never lost when a screen unmounts mid-load.
        console.error('useLoadableData loader failed:', failure);
        onErrorRef.current?.(failure);
        if (cancelled) return;
        setError(failure.message);
        setStatus('error');
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  return { data, status, error, retry };
}

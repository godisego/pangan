// ============================================
// useFetch Hook - Unified data fetching
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';

const pendingRequests = new Map<string, Promise<unknown>>();

export interface UseFetchOptions<T> {
  interval?: number;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  retryOnMount?: boolean;
  staleTime?: number;
  cacheKey?: string;
}

export interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  isStale: boolean;
  isRefreshing: boolean;
}

export function useFetch<T>(
  fetchFn: () => Promise<T>,
  options: UseFetchOptions<T> = {}
): UseFetchResult<T> {
  const {
    interval,
    enabled = true,
    onSuccess,
    onError,
    staleTime = 0,
    cacheKey
  } = options;

  const readCachedData = useCallback((): T | null => {
    if (!cacheKey || typeof window === 'undefined') {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(cacheKey);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }, [cacheKey]);

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cacheReady, setCacheReady] = useState(() => !cacheKey);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted = useRef(true);
  const dataRef = useRef<T | null>(null);
  const serializedRef = useRef<string | null>(null);
  const fetchFnRef = useRef(fetchFn);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    fetchFnRef.current = fetchFn;
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [fetchFn, onSuccess, onError]);

  useEffect(() => {
    if (!cacheKey) {
      return;
    }

    const hydrateTimer = window.setTimeout(() => {
      const cachedData = readCachedData();
      if (cachedData !== null) {
        dataRef.current = cachedData;
        try {
          serializedRef.current = JSON.stringify(cachedData);
        } catch {
          serializedRef.current = null;
        }
        setData(cachedData);
        setLoading(false);
      } else {
        setLoading(true);
      }
      setCacheReady(true);
    }, 0);

    return () => {
      window.clearTimeout(hydrateTimer);
    };
  }, [cacheKey, readCachedData]);

  const fetchData = useCallback(async (background = false) => {
    if (!enabled) return;

    const hasData = dataRef.current !== null;
    const silentRefresh = background && hasData;

    try {
      if (silentRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }

      const requestKey = cacheKey || null;
      const requestPromise = requestKey
        ? (pendingRequests.get(requestKey) as Promise<T> | undefined) || (() => {
            const promise = fetchFnRef.current();
            pendingRequests.set(requestKey, promise);
            promise.finally(() => {
              if (pendingRequests.get(requestKey) === promise) {
                pendingRequests.delete(requestKey);
              }
            });
            return promise;
          })()
        : fetchFnRef.current();
      const result = await requestPromise;

      if (isMounted.current) {
        let shouldUpdate = true;
        try {
          const serialized = JSON.stringify(result);
          if (serializedRef.current === serialized) {
            shouldUpdate = false;
          } else {
            serializedRef.current = serialized;
          }
        } catch {
          shouldUpdate = true;
        }

        if (shouldUpdate) {
          dataRef.current = result;
          setData(result);
          if (cacheKey && typeof window !== 'undefined') {
            try {
              window.localStorage.setItem(cacheKey, JSON.stringify(result));
            } catch {
              // Ignore storage write failure and keep runtime state only.
            }
          }
        }

        setLoading(false);
        setIsRefreshing(false);
        setError(null);
        setIsStale(false);

        if (onSuccessRef.current) onSuccessRef.current(result);
      }
    } catch (err) {
      if (isMounted.current) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        setLoading(false);
        setIsRefreshing(false);

        if (onErrorRef.current) onErrorRef.current(error);
      }
    }
  }, [enabled, cacheKey]);

  // Refetch function
  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  // Initial fetch and interval setup
  useEffect(() => {
    if (!enabled || !cacheReady) return;

    const initialTimer = setTimeout(() => {
      void fetchData(false);
    }, 0);

    // Set up stale timer
    if (staleTime > 0) {
      const staleTimer = setTimeout(() => {
        setIsStale(true);
      }, staleTime);
      return () => {
        clearTimeout(initialTimer);
        clearTimeout(staleTimer);
      };
    }
    return () => clearTimeout(initialTimer);
  }, [enabled, staleTime, fetchData, cacheReady]);

  // Interval polling
  useEffect(() => {
    if (!enabled || !interval || !cacheReady) return;

    intervalRef.current = setInterval(() => {
      fetchData(true);
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, interval, fetchData, cacheReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    data,
    loading,
    error,
    refetch,
    isStale,
    isRefreshing
  };
}

// Hook for fetching multiple resources in parallel
export function useFetchParallel<T extends Record<string, unknown>>(
  fetchFns: Record<keyof T, () => Promise<unknown>>,
  options: UseFetchOptions<T> = {}
): UseFetchResult<T> {
  const combinedFetch = useCallback(async () => {
    const entries = Object.entries(fetchFns) as Array<[string, () => Promise<unknown>]>;
    const results = await Promise.all(
      entries.map(async ([key, fn]) => [key, await fn()])
    );
    return Object.fromEntries(results) as T;
  }, [fetchFns]);

  return useFetch(combinedFetch, options);
}

// Hook for fetching with progressive loading (like in btc/page.tsx)
export function useProgressiveFetch<T extends Record<string, unknown>>(
  primaryFetch: () => Promise<T>,
  secondaryFetchs: Array<() => Promise<Record<string, unknown>>> = [],
  options: UseFetchOptions<T> = {}
): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const primaryFetchRef = useRef(primaryFetch);
  const secondaryFetchRef = useRef(secondaryFetchs);
  const onSuccessRef = useRef(options.onSuccess);
  const onErrorRef = useRef(options.onError);

  useEffect(() => {
    primaryFetchRef.current = primaryFetch;
    secondaryFetchRef.current = secondaryFetchs;
    onSuccessRef.current = options.onSuccess;
    onErrorRef.current = options.onError;
  }, [primaryFetch, secondaryFetchs, options.onSuccess, options.onError]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Phase 1: Primary data (fast)
      const primaryData = await primaryFetchRef.current();
      setData(primaryData);
      setLoading(false);

      if (onSuccessRef.current) onSuccessRef.current(primaryData);

      // Phase 2: Secondary data (background, non-blocking)
      if (secondaryFetchRef.current.length > 0) {
        const secondaryResults = await Promise.allSettled(
          secondaryFetchRef.current.map(fn => fn())
        );

        // Merge secondary results
        secondaryResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            setData((prev) => (
              prev
                ? {
                    ...prev,
                    ...result.value,
                  }
                : prev
            ));
          }
        });
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      setLoading(false);

      if (onErrorRef.current) onErrorRef.current(error);
    }
  }, []);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  useEffect(() => {
    const initialTimer = setTimeout(() => {
      void fetchData();
    }, 0);

    return () => {
      clearTimeout(initialTimer);
    };
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
    isStale: false,
    isRefreshing: false
  };
}

export default useFetch;

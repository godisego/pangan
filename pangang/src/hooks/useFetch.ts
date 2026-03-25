// ============================================
// useFetch Hook - Unified data fetching
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiError, TimeoutError } from '@/lib/api';

export interface UseFetchOptions<T> {
  interval?: number;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  retryOnMount?: boolean;
  staleTime?: number;
}

export interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  isStale: boolean;
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
    staleTime = 0
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(false);

  const lastFetchTime = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted = useRef(true);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    try {
      setLoading(true);
      setError(null);

      const result = await fetchFn();

      if (isMounted.current) {
        setData(result);
        setLoading(false);
        lastFetchTime.current = Date.now();
        setIsStale(false);

        if (onSuccess) onSuccess(result);
      }
    } catch (err) {
      if (isMounted.current) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        setLoading(false);

        if (onError) onError(error);
      }
    }
  }, [fetchFn, enabled, onSuccess, onError]);

  // Refetch function
  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  // Initial fetch and interval setup
  useEffect(() => {
    if (!enabled) return;

    fetchData();

    // Set up stale timer
    if (staleTime > 0) {
      const staleTimer = setTimeout(() => {
        setIsStale(true);
      }, staleTime);
      return () => clearTimeout(staleTimer);
    }
  }, [enabled, staleTime]);

  // Interval polling
  useEffect(() => {
    if (!enabled || !interval) return;

    intervalRef.current = setInterval(() => {
      fetchData();
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, interval, fetchData]);

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
    isStale
  };
}

// Hook for fetching multiple resources in parallel
export function useFetchParallel<T extends Record<string, any>>(
  fetchFns: Record<keyof T, () => Promise<any>>,
  options: UseFetchOptions<T> = {}
): UseFetchResult<T> {
  const combinedFetch = useCallback(async () => {
    const entries = Object.entries(fetchFns) as Array<[string, () => Promise<any>]>;
    const results = await Promise.all(
      entries.map(async ([key, fn]) => [key, await fn()])
    );
    return Object.fromEntries(results) as T;
  }, [fetchFns]);

  return useFetch(combinedFetch, options);
}

// Hook for fetching with progressive loading (like in btc/page.tsx)
export function useProgressiveFetch<T>(
  primaryFetch: () => Promise<T>,
  secondaryFetchs: Array<() => Promise<any>> = [],
  options: UseFetchOptions<T> = {}
): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Phase 1: Primary data (fast)
      const primaryData = await primaryFetch();
      setData(primaryData);
      setLoading(false);

      if (options.onSuccess) options.onSuccess(primaryData);

      // Phase 2: Secondary data (background, non-blocking)
      if (secondaryFetchs.length > 0) {
        const secondaryResults = await Promise.allSettled(
          secondaryFetchs.map(fn => fn())
        );

        // Merge secondary results
        secondaryResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && data) {
            setData((prev: any) => ({
              ...prev,
              ...result.value
            }));
          }
        });
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      setLoading(false);

      if (options.onError) options.onError(error);
    }
  }, [primaryFetch, secondaryFetchs, options, data]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  useEffect(() => {
    // Use a flag to prevent calling setState during render
    let isActive = true;

    if (isActive) {
      fetchData();
    }

    return () => {
      isActive = false;
    };
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
    isStale: false
  };
}

export default useFetch;

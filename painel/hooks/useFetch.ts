"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useFetch<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const doFetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (mountedRef.current) setData(result);
    } catch (err) {
      if (mountedRef.current)
        setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    doFetch();
    return () => {
      mountedRef.current = false;
    };
  }, [doFetch]);

  return { data, loading, error, refetch: doFetch };
}

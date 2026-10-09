import { useCallback, useEffect, useRef, useState } from 'react';

export function usePolling<T>(fetcher: () => Promise<T>, intervalMs = 5000) {
  const [data, setData] = useState<T | null>(null as T | null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const visibleRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const result = await fetcher();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    refresh();

    const poll = () => {
      timerRef.current = setTimeout(async () => {
        if (visibleRef.current) {
          await refresh();
        }
        poll();
      }, intervalMs);
    };
    poll();

    const onVisibility = () => {
      visibleRef.current = !document.hidden;
      if (visibleRef.current) refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh, intervalMs]);

  return { data, error, loading, refresh };
}

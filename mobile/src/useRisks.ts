import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './api';
import { Risk } from './types';

/** All non-rejected risks from the backend, reloaded whenever `refreshKey` changes. */
export function useRisks(refreshKey: number) {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      setRisks((await api.risks()).filter((r) => r.status !== 'rejected'));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load risks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);
  return { risks, loading, error, reload: load };
}

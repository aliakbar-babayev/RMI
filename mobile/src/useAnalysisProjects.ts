import { useEffect, useState } from 'react';
import { api } from './api';
import { Risk } from './types';

// An analysis never changes after it is created, so its project (the `source` it was sent with) is cached.
const cache = new Map<string, string | null>();

/** Maps each risk's analysis_id to the project name the document was analyzed under. */
export function useAnalysisProjects(risks: Risk[]) {
  const [map, setMap] = useState<Record<string, string | null>>(() => Object.fromEntries(cache));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const missing = [...new Set(risks.map((r) => r.analysis_id))].filter((id) => !cache.has(id));
    if (missing.length === 0) { setMap(Object.fromEntries(cache)); return; }
    let alive = true;
    setLoading(true);
    Promise.all(missing.map((id) => api.analysis(id).then((a) => cache.set(id, a.source)).catch(() => undefined)))
      .finally(() => { if (alive) { setMap(Object.fromEntries(cache)); setLoading(false); } });
    return () => { alive = false; };
  }, [risks]);

  return { projectOf: (r: Risk) => map[r.analysis_id] ?? null, loading };
}

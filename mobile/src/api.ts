import {
  Analysis, AuditEntry, Heatmap, Insights, Kpis, Risk, Role, Sample,
} from './types';

// Real phones cannot reach "localhost" on your computer: use the computer's LAN IP,
// for example http://192.168.1.20:8000, set here, in Settings, or via EXPO_PUBLIC_API_URL.
let baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
let role: Role = 'executive';

export const getBaseUrl = () => baseUrl;
export const setBaseUrl = (url: string) => { baseUrl = url.trim().replace(/\/+$/, ''); };
export const getRole = () => role;
export const setRole = (r: Role) => { role = r; };

export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

async function req<T>(path: string, init: RequestInit = {}, timeoutMs = 20000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'X-Role': role, ...(init.headers ?? {}) },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiError(body?.error ?? 'http_error', body?.message ?? `Request failed (${res.status})`);
    }
    return body as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof Error && e.name === 'AbortError') throw new ApiError('timeout', 'The server took too long to answer.');
    throw new ApiError('network', `Cannot reach the server at ${baseUrl}. Check the address in Settings.`);
  } finally {
    clearTimeout(timer);
  }
}

const post = <T>(path: string, body?: unknown) =>
  req<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  health: () => req<{ ok: boolean; model: string }>('/health'),
  samples: () => req<Sample[]>('/samples'),
  kpis: () => req<Kpis>('/dashboard/kpis'),
  heatmap: (mode: 'all' | 'open' = 'all', source?: string) =>
    req<Heatmap>(`/dashboard/heatmap?mode=${mode}${source ? `&source=${encodeURIComponent(source)}` : ''}`),
  top: (limit = 5) => req<Risk[]>(`/dashboard/top?limit=${limit}`),
  insights: () => req<Insights>('/dashboard/insights'),
  risks: (query: Record<string, string> = {}) => {
    const qs = new URLSearchParams(query).toString();
    return req<Risk[]>(`/risks${qs ? `?${qs}` : ''}`);
  },
  risk: (id: string) => req<Risk>(`/risks/${encodeURIComponent(id)}`),
  analysis: (id: string) => req<Analysis>(`/analyses/${encodeURIComponent(id)}`),
  analyze: (text: string, source?: string, language?: string) =>
    req<Analysis>('/analyses', {
      method: 'POST', body: JSON.stringify({ text, source: source || null, language_hint: language || null }),
    }, 600000),
  approve: (id: string, comment?: string) => post<Risk>(`/risks/${encodeURIComponent(id)}/approve`, { comment: comment || null }),
  reject: (id: string, reason: string) => post<Risk>(`/risks/${encodeURIComponent(id)}/reject`, { reason }),
  escalate: (id: string, to: 'ciso' | 'pmo', reason: string) =>
    post<Risk>(`/risks/${encodeURIComponent(id)}/escalate`, { to, reason }),
  edit: (id: string, patch: Partial<Pick<Risk, 'probability' | 'impact' | 'owner_role' | 'statement'>>) =>
    req<Risk>(`/risks/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  resolve: (id: string) => post<Risk>(`/risks/${encodeURIComponent(id)}/resolve`, {}),
  audit: (entityId: string) => req<AuditEntry[]>(`/audit?entity_id=${encodeURIComponent(entityId)}&limit=20`),
  verify: () => req<{ ok: boolean; checked: number; broken_at: number | null }>('/audit/verify'),
};

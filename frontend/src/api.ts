import type {
  Analysis, AuditEntry, AuditVerifyResult, EscalationTarget,
  HeatmapData, HealthResponse, InsightsData, KPIs,
  Risk, RiskPatch, Role, Sample,
} from './types';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

let currentRole: Role = (localStorage.getItem('rm-ai-role') as Role) || 'analyst';

export function getRole(): Role {
  return currentRole;
}

export function setRole(role: Role) {
  currentRole = role;
  localStorage.setItem('rm-ai-role', role);
}

class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-Role': currentRole,
        ...(init?.headers as Record<string, string>),
      },
    });
  } catch {
    throw new ApiError(0, 'network', 'Cannot reach the server. Is the backend running?');
  }
  if (!res.ok) {
    let body: { error?: string; message?: string; details?: unknown };
    try {
      body = await res.json();
    } catch {
      body = {};
    }
    throw new ApiError(
      res.status,
      body.error ?? 'unknown',
      body.message ?? `Request failed with status ${res.status}`,
      body.details,
    );
  }
  return res.json() as Promise<T>;
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred.';
}

// --- Samples ---
export const getSamples = () => request<Sample[]>('/samples');

// --- Analyses ---
export const createAnalysis = (text: string, languageHint?: string, source?: string) =>
  request<Analysis>('/analyses', {
    method: 'POST',
    body: JSON.stringify({ text, language_hint: languageHint || undefined, source: source || undefined }),
  });

export const getAnalysis = (id: string) => request<Analysis>(`/analyses/${encodeURIComponent(id)}`);

// --- Risks ---
export const getRisks = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request<Risk[]>(`/risks${qs}`);
};

export const getRisk = (id: string) => request<Risk>(`/risks/${encodeURIComponent(id)}`);

export const patchRisk = (id: string, body: RiskPatch) =>
  request<Risk>(`/risks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const approveRisk = (id: string, comment?: string) =>
  request<Risk>(`/risks/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify({ comment: comment || undefined }),
  });

export const rejectRisk = (id: string, reason: string) =>
  request<Risk>(`/risks/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });

export const escalateRisk = (id: string, to: EscalationTarget, reason: string) =>
  request<Risk>(`/risks/${encodeURIComponent(id)}/escalate`, {
    method: 'POST',
    body: JSON.stringify({ to, reason }),
  });

export const resolveRisk = (id: string, comment?: string) =>
  request<Risk>(`/risks/${encodeURIComponent(id)}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ comment: comment || undefined }),
  });

// --- Dashboard ---
export const getKPIs = () => request<KPIs>('/dashboard/kpis');

export const getHeatmap = (mode: 'all' | 'open' = 'all', source?: string) => {
  const params = new URLSearchParams({ mode });
  if (source) params.set('source', source);
  return request<HeatmapData>(`/dashboard/heatmap?${params}`);
};

export const getTopRisks = (limit = 10) =>
  request<Risk[]>(`/dashboard/top?limit=${limit}`);

export const getInsights = () => request<InsightsData>('/dashboard/insights');

// --- Audit ---
export const getAuditLog = (entityId?: string, limit = 200) => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (entityId) params.set('entity_id', entityId);
  return request<AuditEntry[]>(`/audit?${params}`);
};

export const verifyAudit = () => request<AuditVerifyResult>('/audit/verify');

// --- Health ---
export const getHealth = () => request<HealthResponse>('/health');

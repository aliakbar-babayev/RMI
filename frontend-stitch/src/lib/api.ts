// Typed client for the RM AI backend. Shapes mirror backend/app/models/schemas.py.

export type Classification = 'risk' | 'issue' | 'assumption'
export type Category = 'financial' | 'operational' | 'it' | 'infosec' | 'reputational'
export type Strategy = 'avoid' | 'mitigate' | 'transfer' | 'accept'
export type Status = 'pending' | 'approved' | 'edited' | 'rejected' | 'escalated' | 'resolved'
export type Level = 'low' | 'medium' | 'high' | 'critical'
export type Role = 'admin' | 'worker'

export interface Evidence {
  type: string
  text: string
  verified: boolean
  start: number | null
  end: number | null
}

export interface Risk {
  risk_id: string
  analysis_id: string
  classification: Classification
  statement: string
  category: Category
  source: string | null
  probability: number
  impact: number
  score: number
  level: Level
  rationale: string
  evidence: Evidence[]
  confidence: number
  needs_review: boolean
  strategy: Strategy
  actions: string[]
  trigger: string
  owner_role: string
  status: Status
  escalated_to: string | null
  materialized_by: string | null
  incident_id: string | null
  created_at: string
  updated_at: string
}

export interface Analysis {
  analysis_id: string
  text: string
  language_hint: string | null
  source: string | null
  model: string
  stats: { risks_returned: number; needs_review: number; dropped_quotes: number; model_attempts: number }
  created_at: string
  readiness: Readiness | null
  incident_id: string | null
  risks: Risk[]
}

export type DimensionStatus = 'passed' | 'warning' | 'failed'

export interface ReadinessDimension {
  key: string
  status: DimensionStatus
  finding: string
  recommendation: string
  evidence: Evidence | null
  assessed: boolean
}

export interface Readiness {
  score: number
  base_score: number
  critical_penalty: number
  decision: 'go' | 'conditional_go' | 'not_ready'
  summary: string
  dimensions: ReadinessDimension[]
  counts: Record<DimensionStatus, number>
}

export interface Kpis {
  open: number
  critical: number
  pending_review: number
  needs_review: number
  escalated: number
  resolved: number
  rejected: number
  total: number
  materialized: number
  open_incidents: number
  open_sev1_sev2: number
  pending_escalations: number
  active_grants: number
  quotes_verified: number
  quotes_dropped: number
  quote_verification_rate: number | null
}

export interface HeatCell {
  p: number
  i: number
  open: number
  total: number
  risk_ids: string[]
}

export interface SourceRow {
  source: string
  total: number
  open: number
  solved: number
  open_exposure: number
}

export interface Heatmap {
  cells: HeatCell[]
  sources: SourceRow[]
}

export interface Insights {
  insights: { text: string; fact_ids: string[] }[]
  facts: { id: string; values: Record<string, unknown>; text: string }[]
  generated_by: 'ai' | 'template' | 'none'
}

export interface AuditEntry {
  event_id: number
  entity_type: string
  entity_id: string
  event_type: string
  actor: { type: 'human' | 'ai' | 'system'; role: string | null }
  data: Record<string, unknown>
  recorded_at: string
  prev_hash: string
  hash: string
}

export interface Sample {
  id: string
  language: string
  title: string
  source: string
  text: string
  test?: boolean
}

export type Severity = 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4'
export type IncidentStatus = 'reported' | 'acknowledged' | 'contained' | 'recovered' | 'closed'
export type SlaState = 'met' | 'breached' | 'running' | 'none'

export interface IncidentMetrics {
  detection_lag_seconds: number | null
  time_to_acknowledge_seconds: number | null
  time_to_contain_seconds: number | null
  time_to_recover_seconds: number | null
  ai_assessment_seconds: number | null
  sla: Record<'acknowledge' | 'contain' | 'recover', { target_minutes: number | null; elapsed_seconds: number | null; state: SlaState; done: boolean }>
}

export interface IncidentSummary {
  incident_id: string
  title: string
  severity: Severity
  status: IncidentStatus
  environment: string | null
  systems: string[]
  reported_at: string
  time_to_impact: string
  metrics: IncidentMetrics
}

export interface BlastNode {
  system_id: string
  name: string
  kind: string
  environment: string
  criticality: 'low' | 'medium' | 'high' | 'critical'
  owner_team: string
  hop: number
  via: string | null
}

export interface PlanAction {
  action: string
  owner_role: string
  flagged: boolean
}

export interface EscalationSuggestion {
  resource: string
  access_level: string
  duration_minutes: number
  reason: string
  known_system: boolean
}

export interface Incident extends IncidentSummary {
  report: string
  reporter_role: string | null
  reporter_name: string | null
  anonymous: boolean
  resolution: string | null
  unmapped_systems: string[]
  severity_reason: string
  summary: string
  response_plan: Record<'immediate' | 'recovery' | 'prevention', PlanAction[]>
  escalation_suggestion: EscalationSuggestion | null
  analysis_id: string | null
  occurred_at: string | null
  acknowledged_at: string | null
  contained_at: string | null
  recovered_at: string | null
  closed_at: string | null
  notify: string[]
  sla_minutes: Record<'acknowledge' | 'contain' | 'recover', number | null>
  blast_radius: BlastNode[]
  consequential_risks: Risk[]
  materialize_candidates: Risk[]
}

export interface WorkerReport {
  incident_id: string
  worker_name: string | null
  anonymous: boolean
  title: string
  problem: string
  solution: string | null
  problem_time: string
  reported_at: string
  solved_at: string | null
  time_to_solve_seconds: number | null
  severity: Severity
  status: IncidentStatus
}

export interface IncidentSample {
  id: string
  title: string
  environment: string
  systems: string[]
  report: string
}

export interface SystemNode {
  system_id: string
  name: string
  kind: string
  environment: string
  criticality: 'low' | 'medium' | 'high' | 'critical'
  owner_team: string
  description: string
  depends_on: string[]
}

export type EscalationStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'revoked'

export interface Escalation {
  escalation_id: string
  type: string
  incident_id: string | null
  risk_id: string | null
  requested_by_role: string
  action_needed: string
  resource: string
  access_level: string
  duration_minutes: number
  justification: string
  suggestion: EscalationSuggestion | null
  break_glass: boolean
  status: EscalationStatus
  decision: { result: string; by_role: string; at: string; comment: string | null; review?: { justified: boolean; comment: string | null } } | null
  decision_deadline: string | null
  overdue: boolean
  granted_at: string | null
  expires_at: string | null
  revoked_at: string | null
  review_required: boolean
  reviewed_at: string | null
  created_at: string
  approver_role: string
  flags: { type: string; message: string }[]
}

export interface AuditProof {
  event_id: number
  components: Record<string, unknown>
  canonical_payload: string
  payload_bytes: number
  stored_hash: string
  recomputed_hash: string
  hash_matches: boolean
  previous_event_id: number | null
  expected_prev_hash: string
  prev_link_ok: boolean
  algorithm: string
}

export interface AuditStats {
  total: number
  by_category: Record<string, number>
  head: { event_id: number; hash: string; recorded_at: string } | null
  genesis_prev_hash: string
}

export interface VerifyResult {
  ok: boolean
  checked: number
  broken_at: number | null
  duration_ms: number | null
}

export interface RiskPatch {
  probability?: number
  impact?: number
  statement?: string
  owner_role?: string
  category?: Category
  strategy?: Strategy
  trigger?: string
  actions?: string[]
  source?: string
  comment?: string
}

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

const BASE = import.meta.env.VITE_API_URL ?? '/api'

let currentRole: Role = 'worker'
export function setApiRole(role: Role) {
  currentRole = role
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'X-Role': currentRole, ...init.headers },
    })
  } catch {
    throw new ApiError(0, 'network_error', `Cannot reach the backend at ${BASE}. Check that it is running and that VITE_API_URL points to it.`)
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? 'http_error', body?.message ?? `Request failed (${res.status})`)
  }
  return body as T
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })

function query(params: Record<string, string | number | boolean | undefined | null>) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const api = {
  health: () => request<{ ok: boolean; model: string }>('/health'),
  samples: () => request<Sample[]>('/samples'),

  analyze: (text: string, language_hint?: string, source?: string, readiness = false) =>
    post<Analysis>('/analyses', { text, language_hint: language_hint || null, source: source || null, readiness }),
  analysis: (id: string) => request<Analysis>(`/analyses/${id}`),

  risks: (filters: { status?: string; category?: string; level?: string; source?: string; needs_review?: boolean } = {}) =>
    request<Risk[]>(`/risks${query(filters)}`),
  risk: (id: string) => request<Risk>(`/risks/${id}`),
  edit: (id: string, patch: RiskPatch) => request<Risk>(`/risks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  approve: (id: string, comment?: string) => post<Risk>(`/risks/${id}/approve`, { comment: comment || null }),
  reject: (id: string, reason: string) => post<Risk>(`/risks/${id}/reject`, { reason }),
  escalate: (id: string, to: 'ciso' | 'pmo', reason: string) => post<Risk>(`/risks/${id}/escalate`, { to, reason }),
  resolve: (id: string, comment?: string) => post<Risk>(`/risks/${id}/resolve`, { comment: comment || null }),

  kpis: () => request<Kpis>('/dashboard/kpis'),
  heatmap: (source?: string, mode: 'all' | 'open' = 'all') => request<Heatmap>(`/dashboard/heatmap${query({ source, mode })}`),
  top: (limit = 10) => request<Risk[]>(`/dashboard/top${query({ limit })}`),
  insights: () => request<Insights>('/dashboard/insights'),

  audit: (filters: { entity_id?: string; category?: string; search?: string; limit?: number } = {}) =>
    request<AuditEntry[]>(`/audit${query({ limit: 200, ...filters })}`),
  auditStats: () => request<AuditStats>('/audit/stats'),
  proof: (eventId: number) => request<AuditProof>(`/audit/${eventId}/proof`),
  proofDownloadUrl: (eventId: number) => `${BASE}/audit/${eventId}/proof/download`,
  verify: () => request<VerifyResult>('/audit/verify'),

  systems: () => request<SystemNode[]>('/systems'),
  incidentSamples: () => request<IncidentSample[]>('/samples/incidents'),
  incidents: (status?: string) => request<IncidentSummary[]>(`/incidents${query({ status })}`),
  incident: (id: string) => request<Incident>(`/incidents/${id}`),
  incidentTimeline: (id: string) => request<AuditEntry[]>(`/incidents/${id}/timeline`),
  workerReports: () => request<WorkerReport[]>('/incidents/worker-reports'),
  reportIncident: (body: { report: string; reporter_name?: string | null; environment?: string | null; systems: string[]; occurred_at?: string | null; anonymous: boolean }) =>
    post<Incident>('/incidents', body),
  advanceIncident: (id: string, action: 'acknowledge' | 'contain' | 'recover' | 'close', note?: string) =>
    post<Incident>(`/incidents/${id}/${action}`, { note: note || null }),
  changeSeverity: (id: string, severity: Severity, reason: string) =>
    request<Incident>(`/incidents/${id}/severity`, { method: 'PATCH', body: JSON.stringify({ severity, reason }) }),
  materialize: (id: string, risk_id: string) => post<Risk>(`/incidents/${id}/materialize`, { risk_id }),

  escalations: (filters: { status?: string; incident_id?: string } = {}) => request<Escalation[]>(`/escalations${query(filters)}`),
  requestEscalation: (body: { incident_id?: string | null; risk_id?: string | null; type?: string; action_needed: string; resource: string; access_level: string; duration_minutes: number; justification: string }) =>
    post<Escalation>('/escalations', body),
  breakGlass: (body: { incident_id: string; resource: string; access_level: string; justification: string }) =>
    post<Escalation>('/escalations/break-glass', body),
  decideEscalation: (id: string, body: { result: 'approve' | 'reject'; comment?: string; access_level?: string; duration_minutes?: number }) =>
    post<Escalation>(`/escalations/${id}/decision`, body),
  revokeEscalation: (id: string) => post<Escalation>(`/escalations/${id}/revoke`),
  reviewBreakGlass: (id: string, justified: boolean, comment?: string) =>
    post<Escalation>(`/escalations/${id}/review`, { justified, comment: comment || null }),
}

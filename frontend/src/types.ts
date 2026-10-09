export type Classification = 'risk' | 'issue' | 'assumption';
export type Category = 'financial' | 'operational' | 'it' | 'infosec' | 'reputational';
export type Strategy = 'avoid' | 'mitigate' | 'transfer' | 'accept';
export type Status = 'pending' | 'approved' | 'edited' | 'rejected' | 'escalated' | 'resolved';
export type Level = 'low' | 'medium' | 'high' | 'critical';
export type Role = 'executive' | 'analyst' | 'auditor';
export type EscalationTarget = 'ciso' | 'pmo';

export interface Evidence {
  type: string;
  text: string;
  verified: boolean;
  start: number | null;
  end: number | null;
}

export interface Risk {
  risk_id: string;
  analysis_id: string;
  classification: Classification;
  statement: string;
  category: Category;
  source: string | null;
  probability: number;
  impact: number;
  score: number;
  level: Level;
  rationale: string;
  evidence: Evidence[];
  confidence: number;
  needs_review: boolean;
  strategy: Strategy;
  actions: string[];
  trigger: string;
  owner_role: string;
  status: Status;
  escalated_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface Analysis {
  analysis_id: string;
  text: string;
  language_hint: string | null;
  source: string | null;
  model: string;
  stats: Record<string, number>;
  created_at: string;
  risks: Risk[];
}

export interface Sample {
  id: string;
  language: string;
  title: string;
  source: string;
  text: string;
}

export interface KPIs {
  open: number;
  critical: number;
  pending_review: number;
  needs_review: number;
  escalated: number;
  resolved: number;
  rejected: number;
  total: number;
}

export interface HeatmapCell {
  p: number;
  i: number;
  open: number;
  total: number;
  risk_ids: string[];
}

export interface HeatmapSource {
  source: string;
  total: number;
  open: number;
  solved: number;
  open_exposure: number;
}

export interface HeatmapData {
  cells: HeatmapCell[];
  sources: HeatmapSource[];
}

export interface Insight {
  text: string;
  fact_ids: string[];
}

export interface InsightsData {
  insights: Insight[];
  facts: string[];
  generated_by: 'ai' | 'template' | 'none';
}

export interface AuditActor {
  type: string;
  role: string | null;
}

export interface AuditEntry {
  event_id: number;
  entity_type: string;
  entity_id: string;
  event_type: string;
  actor: AuditActor;
  data: Record<string, unknown>;
  recorded_at: string;
  prev_hash: string;
  hash: string;
}

export interface AuditVerifyResult {
  ok: boolean;
  checked: number;
  broken_at: number | null;
}

export interface HealthResponse {
  ok: boolean;
  model: string;
}

export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}

export interface RiskPatch {
  probability?: number;
  impact?: number;
  statement?: string;
  owner_role?: string;
  category?: Category;
  strategy?: Strategy;
  trigger?: string;
  actions?: string[];
  source?: string;
  comment?: string;
}

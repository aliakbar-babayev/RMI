// Display text for backend enums. One place to translate the UI later.
import type { Category, Classification, Level, Role, Status, Strategy } from './api'

export const CATEGORY: Record<Category, string> = {
  financial: 'Financial',
  operational: 'Operational',
  it: 'IT',
  infosec: 'Information security',
  reputational: 'Reputational',
}

export const STATUS: Record<Status, string> = {
  pending: 'Pending review',
  approved: 'Approved',
  edited: 'Edited',
  rejected: 'Rejected',
  escalated: 'Escalated',
  resolved: 'Resolved',
}

export const STRATEGY: Record<Strategy, string> = {
  avoid: 'Avoid',
  mitigate: 'Mitigate',
  transfer: 'Transfer',
  accept: 'Accept',
}

export const LEVEL: Record<Level, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

export const CLASSIFICATION: Record<Classification, string> = {
  risk: 'Risk',
  issue: 'Issue',
  assumption: 'Assumption',
}

export const ROLE: Record<Role, string> = {
  admin: 'Admin',
  worker: 'Worker',
}

export const PROBABILITY = ['Very unlikely', 'Unlikely', 'Somewhat likely', 'Likely', 'Very likely']
export const IMPACT = ['Very low impact', 'Low impact', 'Medium impact', 'High impact', 'Very high impact']

export const ESCALATE_TO = { ciso: 'CISO', pmo: 'PMO' } as const

export function levelFor(score: number): Level {
  if (score >= 16) return 'critical'
  if (score >= 10) return 'high'
  if (score >= 5) return 'medium'
  return 'low'
}

// Which actions each status allows. Mirrors backend/app/services/risks.py.
export const ALLOWED: Record<'edit' | 'approve' | 'reject' | 'escalate' | 'resolve', Status[]> = {
  edit: ['pending', 'approved', 'edited', 'escalated'],
  approve: ['pending', 'edited', 'escalated'],
  reject: ['pending', 'edited', 'escalated', 'approved'],
  escalate: ['pending', 'edited', 'approved'],
  resolve: ['approved', 'edited', 'escalated'],
}

export const OPEN_STATUSES: Status[] = ['pending', 'approved', 'edited', 'escalated']

export function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export const DIMENSION: Record<string, string> = {
  scope: 'Scope definition',
  success_criteria: 'Success criteria',
  schedule: 'Schedule realism',
  budget: 'Budget & contingency',
  resourcing: 'Team & key people',
  vendors: 'Vendor management',
  dependencies: 'Dependencies',
  testing: 'Testing & QA',
  rollback: 'Rollback & continuity',
  security_access: 'Security & access',
  compliance: 'Compliance',
  stakeholders: 'Stakeholders',
}

export const DECISION = { go: 'Go', conditional_go: 'Conditional go', not_ready: 'Not ready' } as const

export const SEVERITY = {
  SEV1: { name: 'Critical', hint: 'Production down, data loss or breach' },
  SEV2: { name: 'High', hint: 'Production degraded or failure likely' },
  SEV3: { name: 'Medium', hint: 'Non-production, or has a workaround' },
  SEV4: { name: 'Low', hint: 'Minor, no user impact' },
} as const

export const INCIDENT_STATUS = {
  reported: 'Reported',
  acknowledged: 'Acknowledged',
  contained: 'Contained',
  recovered: 'Recovered',
  closed: 'Closed',
} as const

export const ESCALATION_STATUS = {
  pending: 'Awaiting decision',
  approved: 'Access active',
  rejected: 'Rejected',
  expired: 'Expired',
  revoked: 'Revoked',
} as const

export const TIME_TO_IMPACT: Record<string, string> = {
  immediate: 'Impact now',
  hours: 'Impact within hours',
  days: 'Impact within days',
  none: 'No further impact expected',
  unknown: 'Impact timing unknown',
}

export const CATEGORY_TABS = { risk: 'Risks', analysis: 'Analyses', incident: 'Incidents', escalation: 'Escalations' } as const

/** 75 → "1m 15s", 4000 → "1h 6m". */
export function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return '—'
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ${m % 60}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

export function shortHash(h: string, n = 4) {
  return `${h.slice(0, n)}…${h.slice(-n)}`
}

export function minutesLeft(iso: string | null) {
  if (!iso) return null
  return Math.round((new Date(iso).getTime() - Date.now()) / 60000)
}

import { AlertTriangle, ExternalLink, FileText, Link2, ShieldCheck, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { AuditEntry, Evidence } from '../lib/api'
import { usePoll } from '../lib/app'
import { CATEGORY, CLASSIFICATION, ESCALATE_TO, IMPACT, LEVEL, PROBABILITY, STRATEGY, formatTime, levelFor, shortHash } from '../lib/labels'
import { useOpenRisk } from '../lib/useOpenRisk'
import { RiskActions } from './RiskActions'
import { AiChip, Caption, Chip, ErrorBanner, LEVEL_SOFT, LEVEL_TEXT, Loading, Mono, StatusPill, cx } from './ui'

export function Highlighted({ text, evidence, showOffsets = false }: { text: string; evidence: Evidence[]; showOffsets?: boolean }) {
  const spans = evidence
    .filter((e) => e.verified && e.start !== null && e.end !== null)
    .map((e) => [e.start as number, e.end as number] as const)
    .sort((a, b) => a[0] - b[0])
  const parts: ReactNode[] = []
  let pos = 0
  spans.forEach(([s, e], i) => {
    if (s < pos) return // overlapping quote: already highlighted
    parts.push(<span key={`t${i}`} className="text-ink-3">{text.slice(pos, s)}</span>)
    parts.push(
      <mark key={`m${i}`} className="evidence">
        {text.slice(s, e)}
      </mark>,
    )
    if (showOffsets) {
      parts.push(
        <span key={`o${i}`} className="mx-1 rounded-sm bg-emerald-100 px-1 font-mono text-[11px] text-ok-ink">
          [start: {s}, end: {e}]
        </span>,
      )
    }
    pos = e
  })
  parts.push(<span key="end" className={spans.length ? 'text-ink-3' : ''}>{text.slice(pos)}</span>)
  return <p className="font-mono text-[13px] leading-7 whitespace-pre-wrap">{parts}</p>
}

const EVENT_LABEL: Record<string, string> = {
  'risk.proposed': 'Proposed by AI',
  'risk.edited': 'Edited',
  'risk.approved': 'Approved',
  'risk.rejected': 'Rejected',
  'risk.escalated': 'Escalated',
  'risk.resolved': 'Resolved',
  'risk.materialized': 'Confirmed as happened',
}

function eventDetail(e: AuditEntry) {
  const d = e.data as Record<string, unknown>
  if (e.event_type === 'risk.edited' && d.changes) {
    const changes = Object.entries(d.changes as Record<string, { from: unknown; to: unknown }>)
      .map(([k, v]) => `${k}: ${String(v.from)} → ${String(v.to)}`)
      .join(', ')
    return [changes, d.comment].filter(Boolean).join(' · ')
  }
  if (e.event_type === 'risk.escalated') return `To ${String(d.to).toUpperCase()}: ${String(d.reason)}`
  if (e.event_type === 'risk.rejected') return String(d.reason ?? '')
  if (e.event_type === 'risk.proposed') return `Score ${String(d.score)}${d.needs_review ? ' · flagged for review' : ''}`
  if (e.event_type === 'risk.materialized') return `By incident ${String(d.incident_id)}`
  return d.comment ? String(d.comment) : ''
}

function Box({ label, value, sub, tone }: { label: string; value: ReactNode; sub: string; tone: string }) {
  return (
    <div className="rounded-md border border-line bg-canvas p-3">
      <Caption>{label}</Caption>
      <p className="mt-1 font-mono text-[13px]">
        <span className={cx('text-xl font-semibold', tone)}>{value}</span> <span className="text-ink-2">/ 5</span>
      </p>
      <p className="mt-1 text-xs text-ink-2">{sub}</p>
    </div>
  )
}

export function RiskInspector({ riskId, variant, onClose }: { riskId: string; variant: 'panel' | 'overlay'; onClose?: () => void }) {
  const { close } = useOpenRisk()
  const done = onClose ?? close
  const { data: risk, error } = usePoll(() => api.risk(riskId), [riskId], 0)
  const { data: history } = usePoll(() => api.audit({ entity_id: riskId }), [riskId], 0)
  const [showDoc, setShowDoc] = useState(false)
  const { data: analysis } = usePoll(
    () => (showDoc && risk ? api.analysis(risk.analysis_id) : Promise.resolve(null)),
    [showDoc, risk?.analysis_id],
    0,
  )

  useEffect(() => {
    if (variant !== 'overlay') return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && done()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [done, variant])

  const level = risk ? levelFor(risk.score) : 'low'
  const latest = history?.[0]

  const body = (
    <>
      <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          {risk && (
            <div className="flex flex-wrap items-center gap-2">
              <span className={cx('rounded-sm px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase', LEVEL_SOFT[level])}>
                {LEVEL[level]} priority
              </span>
              <StatusPill status={risk.status} />
              <Chip>{CLASSIFICATION[risk.classification]}</Chip>
              {risk.escalated_to && risk.status === 'escalated' && <Chip tone="warn">To {ESCALATE_TO[risk.escalated_to as 'ciso' | 'pmo'] ?? risk.escalated_to}</Chip>}
            </div>
          )}
          <p className="mt-2 flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold tracking-tight">{riskId}</span>
            {latest && <Mono className="text-ink-2">logged · block #{latest.event_id}</Mono>}
          </p>
        </div>
        <button onClick={done} aria-label="Close" className="rounded p-1 text-ink-3 hover:bg-well hover:text-ink">
          <X size={18} />
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {error && <ErrorBanner message={error} />}
        {!risk && !error && <Loading />}
        {risk && (
          <>
            <p className="text-[15px] leading-6 font-medium text-ink">{risk.statement}</p>

            {risk.materialized_by && (
              <div className="flex items-center gap-2 rounded-md bg-ink px-3 py-2 text-xs text-white">
                <Link2 size={14} />
                Happened: confirmed by incident
                <Link to={`/incidents?incident=${risk.materialized_by}`} className="font-mono underline">{risk.materialized_by}</Link>
              </div>
            )}
            {risk.incident_id && (
              <p className="text-xs text-ink-2">
                Raised from incident{' '}
                <Link to={`/incidents?incident=${risk.incident_id}`} className="font-mono text-ink underline">{risk.incident_id}</Link>
              </p>
            )}
            {risk.needs_review && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-warn-soft px-3 py-2 text-xs text-warn-ink">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                {risk.evidence.length === 0
                  ? 'Needs review: no quote from the AI could be found in the document.'
                  : `Needs review: AI confidence is ${Math.round(risk.confidence * 100)}%.`}
              </div>
            )}

            <section className="rounded-md border border-line bg-canvas p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <Caption className="flex items-center gap-1.5 font-semibold text-ink">
                  <span className={cx('h-2 w-2 rounded-full', risk.evidence.length ? 'bg-ok' : 'bg-warn')} />
                  Verbatim source quote
                </Caption>
                {risk.evidence[0] && <Chip>chars [{risk.evidence[0].start}:{risk.evidence[0].end}]</Chip>}
              </div>
              {risk.evidence.length === 0 ? (
                <p className="text-xs text-ink-2">No verified quote. Check the source document before approving.</p>
              ) : (
                risk.evidence.map((ev, i) => (
                  <blockquote key={i} className="mb-2 rounded-md border border-line bg-white p-3 text-[14px] leading-6 text-ink italic">
                    “{ev.text}”
                  </blockquote>
                ))
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-ink-2">
                <span>Doc: {risk.analysis_id}</span>
              </div>
              {risk.evidence.length > 0 && (
                <button onClick={() => setShowDoc((s) => !s)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-ai-ink hover:underline">
                  <FileText size={12} /> {showDoc ? 'Hide document' : 'Show in document'}
                </button>
              )}
              {showDoc && (
                <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-line bg-white p-3">
                  {analysis ? <Highlighted text={analysis.text} evidence={risk.evidence} /> : <Loading />}
                </div>
              )}
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[13px] font-semibold">Deterministic P × I scoring</h4>
                <Mono className={cx('font-semibold', LEVEL_TEXT[level])}>
                  Score: {risk.score} / 25 ({LEVEL[level]})
                </Mono>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Box label="Probability (P)" value={risk.probability} sub={PROBABILITY[risk.probability - 1]} tone={LEVEL_TEXT[level]} />
                <Box label="Impact (I)" value={risk.impact} sub={IMPACT[risk.impact - 1]} tone={LEVEL_TEXT[level]} />
              </div>
              <dl className="mt-3 grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                <dt className="text-ink-2">Category</dt>
                <dd>{CATEGORY[risk.category]}</dd>
                <dt className="text-ink-2">Source</dt>
                <dd className="font-mono text-[12px]">{risk.source ?? 'unassigned'}</dd>
                <dt className="text-ink-2">AI confidence</dt>
                <dd className="font-mono text-[12px]">{Math.round(risk.confidence * 100)}%</dd>
              </dl>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[13px] font-semibold">AI reasoning</h4>
                <AiChip label="AI generated" />
              </div>
              <p className="text-[13px] leading-5 whitespace-pre-wrap text-ink-2">{risk.rationale}</p>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[13px] font-semibold">Treatment runbook</h4>
                <Chip>Strategy: {STRATEGY[risk.strategy]}</Chip>
              </div>
              <ol className="space-y-2">
                {risk.actions.map((a, i) => (
                  <li key={i} className="flex gap-3 rounded-md border border-line bg-canvas px-3 py-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line bg-white font-mono text-[11px]">{i + 1}</span>
                    <span className="text-[13px]">{a}</span>
                  </li>
                ))}
              </ol>
              <dl className="mt-3 grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                <dt className="text-ink-2">Trigger</dt>
                <dd>{risk.trigger || '—'}</dd>
                <dt className="text-ink-2">Owner</dt>
                <dd>{risk.owner_role || 'Unassigned'}</dd>
              </dl>
            </section>

            {latest && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line px-3 py-2 font-mono text-[11px] text-ink-2">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck size={13} /> Ledger block #{latest.event_id}
                </span>
                <span>HASH: {shortHash(latest.hash, 6)}</span>
                <Link to={`/audit?event=${latest.event_id}`} className="inline-flex items-center gap-1 text-ai-ink hover:underline">
                  Verify <ExternalLink size={11} />
                </Link>
              </div>
            )}

            <section>
              <h4 className="mb-2 text-[13px] font-semibold">History</h4>
              {!history ? (
                <Loading />
              ) : (
                <ol className="relative space-y-3 border-l border-line pl-4">
                  {history.map((e) => (
                    <li key={e.event_id} className="relative">
                      <span className={cx('absolute top-1 -left-[21px] h-2.5 w-2.5 rounded-full border-2 border-white', e.actor.type === 'ai' ? 'bg-ai' : 'bg-ink-3')} />
                      <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
                        {EVENT_LABEL[e.event_type] ?? e.event_type}
                        {e.actor.type === 'ai' ? <AiChip /> : e.actor.role && <span className="text-xs font-normal text-ink-2">by {e.actor.role}</span>}
                      </p>
                      {eventDetail(e) && <p className="mt-0.5 text-xs text-ink-2">{eventDetail(e)}</p>}
                      <p className="mt-0.5 font-mono text-[11px] text-ink-3">{formatTime(e.recorded_at)} · #{e.event_id}</p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </div>

      {risk && (
        <footer className="border-t border-line bg-white px-5 py-3">
          <RiskActions risk={risk} layout="inspector" />
        </footer>
      )}
    </>
  )

  if (variant === 'panel') {
    return <aside className="shadow-card flex max-h-[calc(100vh-140px)] flex-col rounded-md border border-line bg-white xl:sticky xl:top-[120px]">{body}</aside>
  }
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#0f172a]/30" onMouseDown={done}>
      <aside role="dialog" aria-label={`Risk ${riskId}`} className="flex h-full w-full max-w-[560px] flex-col bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        {body}
      </aside>
    </div>
  )
}

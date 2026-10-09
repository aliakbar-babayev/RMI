import { AlertTriangle, Bot, Clock, KeyRound, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Caption, Card, Chip, Empty, ErrorBanner, Field, Loading, Modal, Mono, PageHeader, StatTile, Tabs, cx, inputCls } from '../components/ui'
import { api } from '../lib/api'
import type { Escalation } from '../lib/api'
import { usePoll, useApp } from '../lib/app'
import { ESCALATION_STATUS, ROLE, formatTime, minutesLeft } from '../lib/labels'

type Tab = 'pending' | 'active' | 'review' | 'history'

function DecideModal({ esc, mode, onClose }: { esc: Escalation; mode: 'narrow' | 'reject'; onClose: () => void }) {
  const { refresh } = useApp()
  const s = esc.suggestion
  const [level, setLevel] = useState(s?.access_level ?? esc.access_level)
  const [duration, setDuration] = useState(Math.min(s?.duration_minutes ?? esc.duration_minutes, esc.duration_minutes))
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.decideEscalation(esc.escalation_id, mode === 'reject'
        ? { result: 'reject', comment: comment.trim() }
        : { result: 'approve', access_level: level, duration_minutes: duration, comment: comment.trim() || undefined })
      refresh()
      onClose()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }
  return (
    <Modal
      title={mode === 'reject' ? `Reject ${esc.escalation_id}` : `Approve ${esc.escalation_id} with narrower scope`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant={mode === 'reject' ? 'danger' : 'primary'} loading={busy} disabled={mode === 'reject' && !comment.trim()} onClick={submit}>
            {mode === 'reject' ? 'Reject' : 'Approve'}
          </Button>
        </>
      }
    >
      {mode === 'narrow' && (
        <>
          <p className="text-[13px] text-ink-2">Requested: <Mono>{esc.access_level}</Mono> for {esc.duration_minutes} min. An approval can only narrow it.</p>
          <Field label="Access level"><input value={level} onChange={(e) => setLevel(e.target.value)} className={inputCls} /></Field>
          <Field label={`Duration (max ${esc.duration_minutes} min)`}><input type="number" min={5} max={esc.duration_minutes} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={inputCls} /></Field>
        </>
      )}
      <Field label={mode === 'reject' ? 'Reason (required)' : 'Comment (optional)'}>
        <textarea autoFocus rows={3} value={comment} onChange={(e) => setComment(e.target.value)} className={inputCls} />
      </Field>
      {error && <ErrorBanner message={error} />}
    </Modal>
  )
}

function EscalationCard({ esc }: { esc: Escalation }) {
  const { role, refresh } = useApp()
  const [modal, setModal] = useState<'narrow' | 'reject' | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isApprover = role === esc.approver_role
  const left = minutesLeft(esc.status === 'pending' ? esc.decision_deadline : esc.expires_at)

  const run = async (name: string, fn: () => Promise<unknown>) => {
    setBusy(name)
    setError(null)
    try { await fn(); refresh() } catch (e) { setError((e as Error).message) } finally { setBusy(null) }
  }

  return (
    <li className={cx('shadow-card rounded-md border bg-white p-4', esc.break_glass ? 'border-red-200' : 'border-line')}>
      <div className="flex flex-wrap items-center gap-2">
        <Mono className="font-semibold">{esc.escalation_id}</Mono>
        {esc.break_glass ? <Chip tone="bad"><ShieldAlert size={11} /> Break-glass</Chip> : <Chip>{esc.type}</Chip>}
        <Chip tone={esc.status === 'approved' ? 'ok' : esc.status === 'pending' ? 'warn' : 'gray'}>{ESCALATION_STATUS[esc.status]}</Chip>
        {esc.overdue && <Chip tone="bad">Decision overdue</Chip>}
        {esc.incident_id && <Link to={`/incidents?incident=${esc.incident_id}`} className="font-mono text-[11px] text-ai-ink hover:underline">{esc.incident_id}</Link>}
        <span className="ml-auto font-mono text-[11px] text-ink-2">by {ROLE[esc.requested_by_role as keyof typeof ROLE] ?? esc.requested_by_role} · {formatTime(esc.created_at)}</span>
      </div>

      <p className="mt-2 text-[15px] font-medium">
        <Mono className="text-[14px] font-semibold">{esc.access_level}</Mono> on <Mono className="text-[14px] font-semibold">{esc.resource}</Mono> for {esc.duration_minutes} min
      </p>
      <p className="mt-1 text-[13px] text-ink-2">{esc.action_needed}</p>
      <p className="mt-1 text-[13px]"><span className="text-ink-2">Why: </span>{esc.justification}</p>

      {esc.suggestion && (
        <p className="mt-2 flex items-center gap-1.5 rounded-md border border-ai-line bg-ai-soft px-2.5 py-1.5 text-xs text-ai-ink">
          <Bot size={13} /> AI least-privilege suggestion: <Mono className="font-semibold">{esc.suggestion.access_level}</Mono> on <Mono>{esc.suggestion.resource}</Mono> for {esc.suggestion.duration_minutes} min
        </p>
      )}
      {esc.flags.length > 0 && (
        <ul className="mt-2 space-y-1">
          {esc.flags.map((f) => (
            <li key={f.type} className="flex items-start gap-1.5 rounded-md bg-bad-soft px-2.5 py-1.5 text-xs text-bad-ink">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {f.message}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-2">
          <Clock size={12} />
          {esc.status === 'pending' && esc.decision_deadline && (left! >= 0 ? `Decide within ${left} min` : `Overdue by ${-left!} min`)}
          {esc.status === 'approved' && esc.expires_at && `Access expires ${formatTime(esc.expires_at)} (${Math.max(0, left!)} min left)`}
          {esc.status !== 'pending' && esc.status !== 'approved' && esc.decision && `${esc.decision.result} · ${esc.decision.comment ?? ''}`}
          {esc.reviewed_at && esc.decision?.review && ` · reviewed: ${esc.decision.review.justified ? 'justified' : 'NOT justified'}`}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {esc.status === 'pending' && isApprover && (
            <>
              <Button size="sm" variant="primary" loading={busy === 'ok'} onClick={() => run('ok', () => api.decideEscalation(esc.escalation_id, { result: 'approve' }))}>Approve as requested</Button>
              <Button size="sm" variant="ai" onClick={() => setModal('narrow')}>Approve narrower</Button>
              <Button size="sm" variant="danger-soft" onClick={() => setModal('reject')}>Reject</Button>
            </>
          )}
          {esc.status === 'pending' && !isApprover && <span className="text-xs text-ink-2">Waiting for an executive decision.</span>}
          {esc.status === 'approved' && role !== 'auditor' && (
            <Button size="sm" variant="danger-soft" loading={busy === 'rv'} onClick={() => run('rv', () => api.revokeEscalation(esc.escalation_id))}>Revoke now</Button>
          )}
          {esc.break_glass && !esc.reviewed_at && isApprover && (
            <>
              <Button size="sm" loading={busy === 'j'} onClick={() => run('j', () => api.reviewBreakGlass(esc.escalation_id, true))}>Justified</Button>
              <Button size="sm" variant="danger" loading={busy === 'n'} onClick={() => run('n', () => api.reviewBreakGlass(esc.escalation_id, false, 'Not justified'))}>Not justified</Button>
            </>
          )}
        </div>
      </div>
      {error && <div className="mt-2"><ErrorBanner message={error} onClose={() => setError(null)} /></div>}
      {modal && <DecideModal esc={esc} mode={modal} onClose={() => setModal(null)} />}
    </li>
  )
}

export function Escalations() {
  const { role } = useApp()
  const [tab, setTab] = useState<Tab>('pending')
  const { data, error } = usePoll(() => api.escalations(), [])
  const all = data ?? []
  const groups: Record<Tab, Escalation[]> = {
    pending: all.filter((e) => e.status === 'pending'),
    active: all.filter((e) => e.status === 'approved'),
    review: all.filter((e) => e.break_glass && !e.reviewed_at),
    history: all.filter((e) => !['pending', 'approved'].includes(e.status) || e.reviewed_at),
  }

  return (
    <>
      <PageHeader
        caption="Module 06 · escalation & access governance"
        title="Escalations & Time-Boxed Access"
        subtitle="When fixing something needs more privilege or authority, an executive decides. Access always expires; break-glass is granted at once but must be reviewed."
      />
      {role !== 'executive' && (
        <div className="mb-4 rounded-md border border-ai-line bg-ai-soft px-3 py-2 text-xs text-ai-ink">
          You are viewing as {ROLE[role]}. Only the Executive role can approve, reject or review. Switch role in the header to decide.
        </div>
      )}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Awaiting decision" value={groups.pending.length} chip={groups.pending.some((e) => e.overdue) ? <Chip tone="bad">overdue</Chip> : undefined} note="Executive approval needed" />
        <StatTile label="Active access grants" value={groups.active.length} note="Expire automatically" />
        <StatTile label="Break-glass to review" value={groups.review.length} chip={groups.review.length ? <Chip tone="bad">review</Chip> : undefined} note="Mandatory after emergency use" />
        <StatTile label="Total requests" value={all.length} note="All decisions are in the audit chain" />
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'pending', label: 'Awaiting decision', count: groups.pending.length },
          { value: 'active', label: 'Active access', count: groups.active.length },
          { value: 'review', label: 'Break-glass review', count: groups.review.length },
          { value: 'history', label: 'History', count: groups.history.length },
        ]}
      />
      <div className="mt-4">
        {error && <ErrorBanner message={error} />}
        {!data && !error && <Loading />}
        {data && groups[tab].length === 0 && (
          <Card>
            <Empty title="Nothing here">
              <span className="inline-flex items-center gap-1"><KeyRound size={12} /> Escalations are requested from an incident page.</span>
            </Empty>
          </Card>
        )}
        <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {groups[tab].map((e) => (
            <EscalationCard key={e.escalation_id} esc={e} />
          ))}
        </ul>
      </div>
      <Caption className="mt-6">Rules: approver = executive · never the requester’s own role · approval can only narrow scope · access expires on its own</Caption>
    </>
  )
}

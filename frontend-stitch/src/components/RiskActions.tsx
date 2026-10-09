import { ArrowUpRight, Check, CheckCheck, Pencil, X } from 'lucide-react'
import { useState } from 'react'
import { api } from '../lib/api'
import type { Category, Risk, Strategy } from '../lib/api'
import { useApp } from '../lib/app'
import { ALLOWED, CATEGORY, ESCALATE_TO, IMPACT, PROBABILITY, STRATEGY } from '../lib/labels'
import { Button, ErrorBanner, Field, Modal, ScoreCapsule, inputCls } from './ui'

type Kind = 'edit' | 'reject' | 'escalate'

/**
 * Approve · Edit · Escalate · Reject · Resolve, showing only what the risk's status allows.
 * layout "inspector": Reject + Approve side by side, a full-width red Escalate below.
 */
export function RiskActions({ risk, layout = 'row' }: { risk: Risk; layout?: 'row' | 'compact' | 'inspector' }) {
  const { canAct, refresh } = useApp()
  const [modal, setModal] = useState<Kind | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!canAct) return <p className="text-xs text-ink-2">Read-only role: no decisions.</p>
  const can = (a: keyof typeof ALLOWED) => ALLOWED[a].includes(risk.status)
  const size = layout === 'compact' ? 'sm' : 'md'

  const quick = async (name: string, fn: () => Promise<unknown>) => {
    setBusy(name)
    setError(null)
    try {
      await fn()
      refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const approve = can('approve') && (
    <Button size={size} variant="primary" loading={busy === 'approve'} onClick={() => quick('approve', () => api.approve(risk.risk_id))}>
      <Check size={13} /> {layout === 'compact' ? 'Accept' : 'Approve & anchor'}
    </Button>
  )
  const reject = can('reject') && (
    <Button size={size} variant={layout === 'inspector' ? 'secondary' : 'danger-soft'} onClick={() => setModal('reject')}>
      <X size={13} /> Reject
    </Button>
  )
  const edit = can('edit') && layout !== 'compact' && (
    <Button size={size} variant="ghost" onClick={() => setModal('edit')}>
      <Pencil size={13} /> Edit
    </Button>
  )
  const resolve = can('resolve') && (
    <Button size={size} loading={busy === 'resolve'} onClick={() => quick('resolve', () => api.resolve(risk.risk_id))}>
      <CheckCheck size={13} /> Mark resolved
    </Button>
  )
  const escalate = can('escalate') && (
    <Button size={size} variant={layout === 'inspector' ? 'danger' : 'secondary'} className={layout === 'inspector' ? 'w-full' : ''} onClick={() => setModal('escalate')}>
      <ArrowUpRight size={13} /> {layout === 'inspector' ? 'Escalate to CISO / PMO' : 'Escalate'}
    </Button>
  )

  return (
    <div className="space-y-2">
      {layout === 'inspector' ? (
        <>
          <div className="grid grid-cols-2 gap-2 [&>*]:w-full">
            {reject || <span />}
            {approve || resolve || <span />}
          </div>
          {escalate}
          <div className="flex flex-wrap justify-center gap-1">
            {edit}
            {approve && resolve}
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {approve}
          {edit}
          {escalate}
          {resolve}
          {reject}
        </div>
      )}
      {error && <ErrorBanner message={error} onClose={() => setError(null)} />}
      {modal === 'reject' && <ReasonModal risk={risk} kind="reject" onClose={() => setModal(null)} />}
      {modal === 'escalate' && <ReasonModal risk={risk} kind="escalate" onClose={() => setModal(null)} />}
      {modal === 'edit' && <EditModal risk={risk} onClose={() => setModal(null)} />}
    </div>
  )
}

function ReasonModal({ risk, kind, onClose }: { risk: Risk; kind: 'reject' | 'escalate'; onClose: () => void }) {
  const { refresh } = useApp()
  const [reason, setReason] = useState('')
  const [to, setTo] = useState<'ciso' | 'pmo'>('ciso')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      if (kind === 'reject') await api.reject(risk.risk_id, reason.trim())
      else await api.escalate(risk.risk_id, to, reason.trim())
      refresh()
      onClose()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Modal
      title={kind === 'reject' ? `Reject ${risk.risk_id}` : `Escalate ${risk.risk_id}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant={kind === 'reject' ? 'danger' : 'primary'} disabled={!reason.trim()} loading={busy} onClick={submit}>
            {kind === 'reject' ? 'Reject risk' : 'Escalate'}
          </Button>
        </>
      }
    >
      {kind === 'escalate' && (
        <Field label="Escalate to">
          <div className="flex gap-2">
            {(Object.keys(ESCALATE_TO) as ('ciso' | 'pmo')[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTo(k)}
                className={`h-8 flex-1 rounded-md border text-[13px] font-medium ${to === k ? 'border-ink bg-ink text-white' : 'border-line bg-white'}`}
              >
                {ESCALATE_TO[k]}
              </button>
            ))}
          </div>
        </Field>
      )}
      <Field label={kind === 'reject' ? 'Why is this not a real risk? (required)' : 'Reason (required)'}>
        <textarea autoFocus rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} />
      </Field>
      {error && <ErrorBanner message={error} />}
    </Modal>
  )
}

function EditModal({ risk, onClose }: { risk: Risk; onClose: () => void }) {
  const { refresh } = useApp()
  const [f, setF] = useState({
    probability: risk.probability,
    impact: risk.impact,
    statement: risk.statement,
    category: risk.category,
    strategy: risk.strategy,
    owner_role: risk.owner_role,
    trigger: risk.trigger,
    comment: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }))

  const submit = async () => {
    // Send only what changed: the backend rejects "nothing to change".
    const patch: Record<string, unknown> = {}
    for (const k of ['probability', 'impact', 'statement', 'category', 'strategy', 'owner_role', 'trigger'] as const) {
      if (f[k] !== risk[k]) patch[k] = f[k]
    }
    if (f.comment.trim()) patch.comment = f.comment.trim()
    setBusy(true)
    setError(null)
    try {
      await api.edit(risk.risk_id, patch)
      refresh()
      onClose()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Modal
      title={`Edit ${risk.risk_id}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Probability">
          <select value={f.probability} onChange={(e) => set('probability', Number(e.target.value))} className={inputCls}>
            {PROBABILITY.map((l, i) => (
              <option key={l} value={i + 1}>
                {i + 1} – {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Impact">
          <select value={f.impact} onChange={(e) => set('impact', Number(e.target.value))} className={inputCls}>
            {IMPACT.map((l, i) => (
              <option key={l} value={i + 1}>
                {i + 1} – {l}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="flex items-center gap-2 text-xs text-ink-2">
        New score <ScoreCapsule score={f.probability * f.impact} /> (calculated by the backend as P × I)
      </p>
      <Field label="Risk statement">
        <textarea rows={3} value={f.statement} onChange={(e) => set('statement', e.target.value)} className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <select value={f.category} onChange={(e) => set('category', e.target.value as Category)} className={inputCls}>
            {(Object.keys(CATEGORY) as Category[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Treatment">
          <select value={f.strategy} onChange={(e) => set('strategy', e.target.value as Strategy)} className={inputCls}>
            {(Object.keys(STRATEGY) as Strategy[]).map((s) => (
              <option key={s} value={s}>
                {STRATEGY[s]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Owner role">
        <input value={f.owner_role} onChange={(e) => set('owner_role', e.target.value)} className={inputCls} />
      </Field>
      <Field label="Trigger">
        <input value={f.trigger} onChange={(e) => set('trigger', e.target.value)} className={inputCls} />
      </Field>
      <Field label="Comment for the audit log (optional)">
        <input value={f.comment} onChange={(e) => set('comment', e.target.value)} className={inputCls} />
      </Field>
      {error && <ErrorBanner message={error} />}
    </Modal>
  )
}

import { AlertTriangle, ArrowRight, Bot, Clock, KeyRound, Link2, Network, ShieldAlert, Siren, Timer, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Caption, Card, Chip, Empty, ErrorBanner, Field, Loading, Modal, Mono, PageHeader, ScoreCapsule, StatusPill, Tabs, cx, inputCls } from '../components/ui'
import { api } from '../lib/api'
import type { BlastNode, Incident, IncidentSummary, Severity, SlaState } from '../lib/api'
import { usePoll, useApp } from '../lib/app'
import { ESCALATION_STATUS, INCIDENT_STATUS, SEVERITY, TIME_TO_IMPACT, formatDuration, formatTime, shortHash } from '../lib/labels'
import { useOpenRisk } from '../lib/useOpenRisk'

const SEVS: Severity[] = ['SEV1', 'SEV2', 'SEV3', 'SEV4']
const NAME_KEY = 'rmai.reporter-name'
const SEV_TONE: Record<Severity, 'bad' | 'warn' | 'ai' | 'gray'> = { SEV1: 'bad', SEV2: 'bad', SEV3: 'warn', SEV4: 'gray' }
const CRIT_TONE = { critical: 'bad', high: 'warn', medium: 'ai', low: 'gray' } as const
const NEXT_ACTION = {
  reported: [['acknowledge', 'Acknowledge'], ['contain', 'Mark contained']],
  acknowledged: [['contain', 'Mark contained'], ['recover', 'Mark recovered']],
  contained: [['recover', 'Mark recovered']],
  recovered: [['close', 'Close incident']],
  closed: [],
} as const

// ---------- report form ----------

function ReportForm({ onCreated }: { onCreated: (id: string) => void }) {
  const { refresh } = useApp()
  const { data: systems } = usePoll(() => api.systems(), [], 0)
  const { data: samples } = usePoll(() => api.incidentSamples(), [], 0)
  const [report, setReport] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [environment, setEnvironment] = useState('')
  const [occurred, setOccurred] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [more, setMore] = useState(false)
  const { session } = useApp()
  const [name, setName] = useState(() => {
    try { return session?.name ?? localStorage.getItem(NAME_KEY) ?? '' } catch { return session?.name ?? '' }
  })
  const [busy, setBusy] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!busy) return
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [busy])

  const submit = async () => {
    setSeconds(0)
    setBusy(true)
    setError(null)
    try {
      try { localStorage.setItem(NAME_KEY, name.trim()) } catch { /* storage unavailable */ }
      const inc = await api.reportIncident({
        report: report.trim(),
        reporter_name: anonymous ? null : name.trim(),
        systems: picked,
        environment: environment || null,
        occurred_at: occurred ? new Date(occurred).toISOString() : null,
        anonymous,
      })
      setReport('')
      setPicked([])
      setOccurred('')
      refresh()
      onCreated(inc.incident_id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title={<span className="inline-flex items-center gap-2"><Siren size={16} className="text-bad" />Report a technical issue</span>} subtitle="Blameless: reporting fast matters more than who did it.">
      <div className="mb-2 flex flex-wrap gap-1.5">
        {samples?.map((s) => (
          <button
            key={s.id}
            onClick={() => { setReport(s.report); setPicked(s.systems); setEnvironment(s.environment); setMore(true) }}
            className="rounded-md border border-line bg-canvas px-2 py-1 text-xs hover:bg-well"
          >
            {s.title}
          </button>
        ))}
      </div>
      <textarea value={report} onChange={(e) => setReport(e.target.value)} rows={5} placeholder="What happened? e.g. “I accidentally deleted nginx.conf on prod-web-02…”" className={cx(inputCls, 'resize-y leading-5')} />
      <button type="button" onClick={() => setMore((m) => !m)} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-ai-ink hover:underline">
        {more ? 'Hide details' : 'More details (systems, environment, time)'}
      </button>
      {more && (<>
      <div className="mt-3">
        <Caption className="mb-1">Affected systems (optional, the AI also finds them in the text)</Caption>
        <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
          {systems?.map((s) => {
            const on = picked.includes(s.system_id)
            return (
              <button
                key={s.system_id}
                onClick={() => setPicked(on ? picked.filter((x) => x !== s.system_id) : [...picked, s.system_id])}
                className={cx('rounded-sm border px-1.5 py-0.5 font-mono text-[11px]', on ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-2 hover:bg-canvas')}
                title={`${s.name} · ${s.environment} · ${s.criticality}`}
              >
                {s.system_id}
              </button>
            )
          })}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Field label="Environment">
          <select value={environment} onChange={(e) => setEnvironment(e.target.value)} className={inputCls}>
            <option value="">Not sure</option>
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="development">Development</option>
          </select>
        </Field>
        <Field label="When did it happen?">
          <input type="datetime-local" value={occurred} onChange={(e) => setOccurred(e.target.value)} className={inputCls} />
        </Field>
      </div>
      </>)}
      {!anonymous && (
        <div className="mt-3">
          <Field label="Your name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aysel Mammadova" className={inputCls} />
          </Field>
        </div>
      )}
      <label className="mt-3 inline-flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-4 w-4 accent-ink" />
        Report anonymously (your name and role are not stored)
      </label>
      {error && <div className="mt-2"><ErrorBanner message={error} onClose={() => setError(null)} /></div>}
      <Button variant="primary" className="mt-3 w-full" disabled={!report.trim() || (!anonymous && !name.trim())} loading={busy} onClick={submit}>
        {busy ? `Assessing… ${seconds}s` : 'Submit & assess'}
      </Button>
    </Card>
  )
}

// ---------- detail parts ----------

function SlaBar({ state, elapsed, target }: { state: SlaState; elapsed: number | null; target: number | null }) {
  if (!target) return <p className="mt-2 font-mono text-[11px] text-ink-3">No target</p>
  const pct = elapsed === null ? 0 : Math.min(100, (elapsed / (target * 60)) * 100)
  const tone = state === 'breached' ? 'bg-bad' : state === 'met' ? 'bg-ok' : 'bg-ai'
  return (
    <>
      <p className={cx('mt-1 font-mono text-[11px]', state === 'breached' ? 'text-bad-ink' : 'text-ink-2')}>
        Target ≤ {formatDuration(target * 60)} · {state === 'running' ? 'in progress' : state}
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-well">
        <div className={cx('h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
      </div>
    </>
  )
}

function Metric({ label, icon, value, children, alert }: { label: string; icon: ReactNode; value: string; children?: ReactNode; alert?: boolean }) {
  return (
    <div className="shadow-card rounded-md border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <Caption>{label}</Caption>
        <span className="text-ink-3">{icon}</span>
      </div>
      <p className={cx('mt-2 text-[26px] leading-none font-semibold tracking-tight', alert && 'text-bad-ink')}>{value}</p>
      {children}
    </div>
  )
}

function ResolveModal({ inc, onClose }: { inc: Incident; onClose: () => void }) {
  const { refresh } = useApp()
  const [solution, setSolution] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Modal
      title={`Mark ${inc.incident_id} as recovered`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!solution.trim()} loading={busy} onClick={async () => {
            setBusy(true)
            try { await api.advanceIncident(inc.incident_id, 'recover', solution.trim()); refresh(); onClose() } catch (e) { setError((e as Error).message); setBusy(false) }
          }}>Save solution</Button>
        </>
      }
    >
      <Field label="How was the problem solved? (required, shown to admins)">
        <textarea autoFocus rows={4} value={solution} onChange={(e) => setSolution(e.target.value)} placeholder="e.g. Restored nginx.conf from the config repo and reloaded nginx." className={inputCls} />
      </Field>
      {error && <ErrorBanner message={error} />}
    </Modal>
  )
}

function SeverityModal({ inc, to, onClose }: { inc: Incident; to: Severity; onClose: () => void }) {
  const { refresh } = useApp()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Modal
      title={`Change ${inc.incident_id} to ${to}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!reason.trim()} loading={busy} onClick={async () => {
            setBusy(true)
            try { await api.changeSeverity(inc.incident_id, to, reason.trim()); refresh(); onClose() } catch (e) { setError((e as Error).message); setBusy(false) }
          }}>Change severity</Button>
        </>
      }
    >
      <p className="text-[13px] text-ink-2">From {inc.severity} to {to} ({SEVERITY[to].name}). The SLA targets follow the new severity.</p>
      <Field label="Reason (required, logged)">
        <textarea autoFocus rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} />
      </Field>
      {error && <ErrorBanner message={error} />}
    </Modal>
  )
}

function BlastGraph({ nodes, unmapped }: { nodes: BlastNode[]; unmapped: string[] }) {
  const hops = [0, 1, 2, 3].map((h) => nodes.filter((n) => n.hop === h))
  const titles = ['Hop 0 · root failure', 'Hop 1 · direct dependents', 'Hop 2 · secondary', 'Hop 3 · cascading']
  return (
    <>
      {nodes.length === 0 ? (
        <Empty title="No known system located">Pick the affected systems when reporting, or add them to the registry.</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-3 rounded-md border border-line bg-canvas p-3 md:grid-cols-4">
          {hops.map((col, h) => (
            <div key={h} className="min-w-0">
              <Caption className="mb-2">{titles[h]}</Caption>
              <div className="space-y-2">
                {col.length === 0 && <p className="font-mono text-[11px] text-ink-3">—</p>}
                {col.map((n) => (
                  <div key={n.system_id} className={cx('rounded-md border bg-white p-2.5', h === 0 ? 'border-red-300' : 'border-line')}>
                    <div className="flex items-start justify-between gap-1">
                      <Chip tone={h === 0 ? 'bad' : 'gray'}>{h === 0 ? 'root' : n.kind}</Chip>
                      <Chip tone={CRIT_TONE[n.criticality]}>{n.criticality}</Chip>
                    </div>
                    <p className="mt-1.5 font-mono text-[12px] font-semibold break-all">{n.system_id}</p>
                    <p className="text-[11px] text-ink-2">{n.name}</p>
                    <p className="mt-1 font-mono text-[10px] text-ink-3">
                      {n.owner_team} · {n.environment}
                      {n.via && <> · via {n.via}</>}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {unmapped.length > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-warn-ink">
          <AlertTriangle size={13} /> Not in the system registry: <Mono>{unmapped.join(', ')}</Mono>. Not guessed; add them to the registry.
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-4 font-mono text-[11px] text-ink-2">
        <span>Blast radius: {Math.max(0, nodes.length - nodes.filter((n) => n.hop === 0).length)} dependent system(s)</span>
        <span>Edges from the registry’s depends_on lists</span>
      </div>
    </>
  )
}

function EscalationPanel({ inc }: { inc: Incident }) {
  const { refresh } = useApp()
  const s = inc.escalation_suggestion
  const { data: escalations } = usePoll(() => api.escalations({ incident_id: inc.incident_id }), [inc.incident_id])
  const [form, setForm] = useState({
    action_needed: '',
    resource: s?.resource ?? inc.systems[0] ?? '',
    access_level: s?.access_level ?? '',
    duration_minutes: s?.duration_minutes ?? 60,
    justification: '',
  })
  const [bg, setBg] = useState({ resource: s?.resource ?? inc.systems[0] ?? '', access_level: s?.access_level ?? '', justification: '' })
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const canBreakGlass = (inc.severity === 'SEV1' || inc.severity === 'SEV2') && !['recovered', 'closed'].includes(inc.status)

  const run = async (name: string, fn: () => Promise<unknown>) => {
    setBusy(name)
    setError(null)
    try { await fn(); refresh() } catch (e) { setError((e as Error).message) } finally { setBusy(null) }
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card title={<span className="inline-flex items-center gap-2"><KeyRound size={16} className="text-ai" />Least-privilege AI scoping</span>} action={<Chip tone="ai">Approver: admin</Chip>}>
        {s ? (
          <div className="mb-3 rounded-md border border-ai-line bg-ai-soft p-3 text-[13px]">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ai-ink"><Bot size={13} /> Smallest access the AI thinks is enough</p>
            <p className="mt-1">
              <Mono className="font-semibold">{s.access_level}</Mono> on <Mono className="font-semibold">{s.resource}</Mono> for {s.duration_minutes} min
            </p>
            {s.reason && <p className="mt-1 text-xs text-ink-2">{s.reason}</p>}
            {!s.known_system && <p className="mt-1 text-xs text-warn-ink">This resource is not in the system registry.</p>}
          </div>
        ) : (
          <p className="mb-3 text-xs text-ink-2">The AI did not suggest an escalation for this incident. You can still request one.</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Resource"><input value={form.resource} onChange={(e) => setForm({ ...form, resource: e.target.value })} className={inputCls} /></Field>
          <Field label="Access level"><input value={form.access_level} onChange={(e) => setForm({ ...form, access_level: e.target.value })} placeholder="e.g. sudo: nginx config only" className={inputCls} /></Field>
          <Field label="Duration (minutes)"><input type="number" min={5} max={1440} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} className={inputCls} /></Field>
          <Field label="I need to"><input value={form.action_needed} onChange={(e) => setForm({ ...form, action_needed: e.target.value })} placeholder="Restore nginx.conf" className={inputCls} /></Field>
        </div>
        <div className="mt-2">
          <Field label="Justification"><textarea rows={2} value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} className={inputCls} /></Field>
        </div>
        <Button className="mt-3 w-full" variant="primary" disabled={!form.action_needed || !form.resource || !form.access_level || !form.justification} loading={busy === 'req'}
          onClick={() => run('req', () => api.requestEscalation({ incident_id: inc.incident_id, type: 'privilege', ...form }))}>
          Request escalation
        </Button>
      </Card>

      <Card
        className={canBreakGlass ? 'border-red-200' : ''}
        title={<span className="inline-flex items-center gap-2"><ShieldAlert size={16} className="text-bad" />Request break-glass emergency access</span>}
        action={<Chip tone="bad">High-audit flow</Chip>}
      >
        {!canBreakGlass ? (
          <p className="text-[13px] text-ink-2">Break-glass is only for open SEV1 / SEV2 incidents. Use a normal escalation.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Resource"><input value={bg.resource} onChange={(e) => setBg({ ...bg, resource: e.target.value })} className={inputCls} /></Field>
              <Field label="Access level"><input value={bg.access_level} onChange={(e) => setBg({ ...bg, access_level: e.target.value })} className={inputCls} /></Field>
            </div>
            <div className="mt-2">
              <Field label="Emergency justification (logged permanently)"><textarea rows={2} value={bg.justification} onChange={(e) => setBg({ ...bg, justification: e.target.value })} className={inputCls} /></Field>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Caption className="mb-1">Who is told</Caption>
                <ul className="space-y-0.5 font-mono text-[11px] text-ink-2">
                  {(inc.notify.length ? inc.notify : ['Risk team']).map((n) => <li key={n}>· {n}</li>)}
                </ul>
              </div>
              <div>
                <Caption className="mb-1">Guardrails</Caption>
                <ul className="space-y-0.5 font-mono text-[11px] text-bad-ink">
                  <li>· Access granted at once, expires in 60 min</li>
                  <li>· Admin review required afterwards</li>
                  <li>· Logged as breakglass.used in the audit chain</li>
                </ul>
              </div>
            </div>
            <Button variant="danger" className="mt-3 w-full" disabled={!bg.resource || !bg.access_level || !bg.justification} loading={busy === 'bg'}
              onClick={() => run('bg', () => api.breakGlass({ incident_id: inc.incident_id, ...bg }))}>
              <ShieldAlert size={14} /> Authorize break-glass
            </Button>
          </>
        )}
      </Card>

      {error && <div className="xl:col-span-2"><ErrorBanner message={error} onClose={() => setError(null)} /></div>}

      {escalations && escalations.length > 0 && (
        <Card className="xl:col-span-2" title="Escalations for this incident" bodyClass="p-0">
          <ul className="divide-y divide-well">
            {escalations.map((e) => (
              <li key={e.escalation_id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <Mono className="font-semibold">{e.escalation_id}</Mono>
                {e.break_glass && <Chip tone="bad">Break-glass</Chip>}
                <span className="flex-1 text-[13px]">{e.access_level} on <Mono>{e.resource}</Mono> · {e.duration_minutes} min</span>
                <Chip tone={e.status === 'approved' ? 'ok' : e.status === 'pending' ? 'warn' : 'gray'}>{ESCALATION_STATUS[e.status]}</Chip>
                {e.expires_at && e.status === 'approved' && <span className="font-mono text-[11px] text-ink-2">until {formatTime(e.expires_at)}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function Detail({ id }: { id: string }) {
  const { canAct, refresh } = useApp()
  const { open } = useOpenRisk()
  const { data: inc, error } = usePoll(() => api.incident(id), [id])
  const { data: trail } = usePoll(() => api.incidentTimeline(id), [id])
  const [sevTo, setSevTo] = useState<Severity | null>(null)
  const [resolving, setResolving] = useState(false)
  const [tab, setTab] = useState<'overview' | 'impact' | 'response' | 'activity'>('overview')
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  if (error) return <ErrorBanner message={error} />
  if (!inc) return <Loading />
  const m = inc.metrics

  const act = async (name: string, fn: () => Promise<unknown>) => {
    setBusy(name)
    setActionError(null)
    try { await fn(); refresh() } catch (e) { setActionError((e as Error).message) } finally { setBusy(null) }
  }

  return (
    <div className="space-y-5">
      <div className="shadow-card rounded-md border border-line bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone={SEV_TONE[inc.severity]}>{inc.incident_id} · {inc.severity}</Chip>
              <Chip tone="ink">{INCIDENT_STATUS[inc.status]}</Chip>
              {inc.environment && <Chip>{inc.environment}</Chip>}
              <Chip tone={inc.time_to_impact === 'immediate' || inc.time_to_impact === 'hours' ? 'warn' : 'gray'}>{TIME_TO_IMPACT[inc.time_to_impact]}</Chip>
            </div>
            <h2 className="mt-2 text-lg font-semibold">{inc.title}</h2>
            <p className="mt-1 font-mono text-[11px] text-ink-2">
              Reported {formatTime(inc.reported_at)} by {inc.anonymous ? 'anonymous reporter' : `${inc.reporter_name ?? 'unnamed'} (${inc.reporter_role ?? '—'})`}
              {inc.occurred_at && <> · happened {formatTime(inc.occurred_at)}</>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canAct && NEXT_ACTION[inc.status].map(([action, label]) => (
              <Button key={action} variant={action === 'acknowledge' ? 'primary' : 'secondary'} loading={busy === action}
                onClick={() => action === 'recover' ? setResolving(true) : act(action, () => api.advanceIncident(inc.incident_id, action))}>
                {label}
              </Button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-md bg-canvas p-3">
            <Caption className="mb-1">Original report</Caption>
            <p className="text-[13px] leading-5 whitespace-pre-wrap">{inc.report}</p>
          </div>
          <div className="rounded-md border border-ai-line bg-ai-soft p-3">
            <Caption className="mb-1 text-ai-ink">AI assessment</Caption>
            <p className="text-[13px] leading-5">{inc.summary || '—'}</p>
            {inc.severity_reason && <p className="mt-1 text-xs text-ink-2">Severity: {inc.severity_reason}</p>}
          </div>
        </div>
        {inc.resolution && (
          <div className="mt-3 rounded-md border border-emerald-200 bg-ok-soft p-3">
            <Caption className="mb-1 text-ok-ink">Solution{inc.recovered_at ? ` · ${formatTime(inc.recovered_at)}` : ''}</Caption>
            <p className="text-[13px] leading-5 whitespace-pre-wrap">{inc.resolution}</p>
          </div>
        )}
        {actionError && <div className="mt-2"><ErrorBanner message={actionError} onClose={() => setActionError(null)} /></div>}
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'overview' as const, label: 'Overview' },
          { value: 'impact' as const, label: 'Impact', count: inc.blast_radius.length },
          { value: 'response' as const, label: 'Response' },
          { value: 'activity' as const, label: 'Activity', count: trail?.length },
        ]}
      />

      {tab === 'overview' && (<>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2" title="Severity classification" subtitle="AI-proposed; a person can change it with a reason.">
          <div className="grid grid-cols-2 gap-2">
            {SEVS.map((s) => {
              const on = inc.severity === s
              return (
                <button key={s} disabled={!canAct || on || inc.status === 'closed'} onClick={() => setSevTo(s)}
                  className={cx('rounded-md border p-2.5 text-left transition', on ? 'border-lvl-critical bg-lvl-critical text-on-accent' : 'border-line bg-canvas hover:bg-well disabled:hover:bg-canvas')}>
                  <p className="font-mono text-[11px]">{s}</p>
                  <p className="text-[13px] font-semibold">{SEVERITY[s].name}</p>
                  <p className={cx('text-[11px] leading-4', on ? 'text-on-accent/80' : 'text-ink-2')}>{SEVERITY[s].hint}</p>
                </button>
              )
            })}
          </div>
        </Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:col-span-3">
          <Metric label="Detection lag" icon={<Clock size={15} />} value={formatDuration(m.detection_lag_seconds)}>
            <p className="mt-1 font-mono text-[11px] text-ink-2">{m.detection_lag_seconds === null ? 'Occurred time not given' : 'reported − occurred'}</p>
          </Metric>
          <Metric label="Time to acknowledge" icon={<Timer size={15} />} value={formatDuration(m.time_to_acknowledge_seconds ?? m.sla.acknowledge.elapsed_seconds)} alert={m.sla.acknowledge.state === 'breached'}>
            <SlaBar state={m.sla.acknowledge.state} elapsed={m.sla.acknowledge.elapsed_seconds} target={m.sla.acknowledge.target_minutes} />
          </Metric>
          <Metric label="Time to contain" icon={<ShieldAlert size={15} />} value={formatDuration(m.time_to_contain_seconds ?? m.sla.contain.elapsed_seconds)} alert={m.sla.contain.state === 'breached'}>
            <SlaBar state={m.sla.contain.state} elapsed={m.sla.contain.elapsed_seconds} target={m.sla.contain.target_minutes} />
          </Metric>
          <Metric label="AI assessment latency" icon={<Bot size={15} />} value={m.ai_assessment_seconds === null ? '—' : `${m.ai_assessment_seconds}s`}>
            <p className="mt-1 font-mono text-[11px] text-ink-2">Report → severity, systems, risks, plan</p>
          </Metric>
        </div>
      </div>

      {(inc.materialize_candidates.length > 0) && (
        <div className="space-y-2">
          {inc.materialize_candidates.slice(0, 3).map((r) => (
            <div key={r.risk_id} className="flex flex-wrap items-center gap-3 rounded-md bg-code px-4 py-3 text-on-accent">
              <Chip className="border-[#475569] bg-[#1e293b] text-[#e2e8f0]"><Link2 size={11} /> Risk linkage</Chip>
              <p className="min-w-0 flex-1 text-[13px]">
                Predicted risk <button onClick={() => open(r.risk_id)} className="font-mono font-semibold text-[#6ee7b7] underline">{r.risk_id}</button> on{' '}
                <Mono>{r.source}</Mono> (score {r.score}) may be what just happened. Confirm to mark it as happened.
              </p>
              {canAct && (
                <Button size="sm" className="border-[#fff] bg-[#fff] text-[#0f172a] hover:opacity-90" loading={busy === r.risk_id} onClick={() => act(r.risk_id, () => api.materialize(inc.incident_id, r.risk_id))}>
                  Confirm it happened
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      </>)}

      {tab === 'impact' && (<>
      <Card
        title={<span className="inline-flex items-center gap-2"><Network size={16} className="text-ai" />Dependency graph & blast radius</span>}
        subtitle="Systems that depend on the affected ones, walked through the system registry (up to 3 hops)."
        action={<Chip tone="bad">{inc.blast_radius.length} systems in scope</Chip>}
      >
        <BlastGraph nodes={inc.blast_radius} unmapped={inc.unmapped_systems} />
      </Card>

      <Card title="Consequential risks (added to the register)" subtitle="What may happen next because of this incident.">
        {inc.consequential_risks.length === 0 ? (
          <p className="text-xs text-ink-2">None proposed.</p>
        ) : (
          <ul className="space-y-2">
            {inc.consequential_risks.map((r) => (
              <li key={r.risk_id}>
                <button onClick={() => open(r.risk_id)} className="flex w-full items-center gap-3 rounded-md border border-line px-3 py-2 text-left hover:bg-canvas">
                  <ScoreCapsule score={r.score} />
                  <Mono className="text-ai-ink">{r.risk_id}</Mono>
                  <span className="line-clamp-1 flex-1 text-[13px]">{r.statement}</span>
                  <StatusPill status={r.status} />
                  <ArrowRight size={14} className="text-ink-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      </>)}

      {tab === 'response' && (<>
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">Three response horizons</h3>
          <Chip>Human-in-the-loop: nothing runs automatically</Chip>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {(['immediate', 'recovery', 'prevention'] as const).map((h, idx) => (
            <Card key={h} caption={`Horizon ${idx + 1}`} title={['Immediate containment', 'Recovery', 'Prevention'][idx]}>
              {inc.response_plan[h]?.length ? (
                <ol className="space-y-2">
                  {inc.response_plan[h].map((a, i) => (
                    <li key={i} className={cx('rounded-md border p-2.5 text-[13px]', a.flagged ? 'border-red-200 bg-bad-soft' : 'border-line bg-canvas')}>
                      <p>{a.action}</p>
                      <p className="mt-1 font-mono text-[11px] text-ink-2">{a.owner_role || 'Owner not set'}</p>
                      {a.flagged && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-bad-ink">
                          <TriangleAlert size={12} /> Contains a destructive command. Verify with the system owner before doing anything.
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-xs text-ink-2">No actions proposed.</p>
              )}
            </Card>
          ))}
        </div>
      </div>

      <EscalationPanel key={inc.incident_id} inc={inc} />
      </>)}


      {tab === 'activity' && (
      <Card title="Incident activity & evidence trail" action={<Chip>From the audit chain</Chip>} bodyClass="p-0">
        {!trail ? (
          <Loading />
        ) : (
          <ul className="divide-y divide-well">
            {trail.map((e) => (
              <li key={e.event_id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="w-36 shrink-0 font-mono text-[11px] text-ink-2">{formatTime(e.recorded_at)}</span>
                <Chip tone={e.actor.type === 'ai' ? 'ai' : e.event_type.startsWith('breakglass') ? 'bad' : 'gray'}>{e.event_type}</Chip>
                <span className="min-w-0 flex-1 text-[13px]">
                  <Mono>{e.entity_id}</Mono> · {e.actor.type === 'ai' ? 'AI' : e.actor.role ?? e.actor.type}
                </span>
                <span className="font-mono text-[11px] text-ink-3">#{e.event_id} · {shortHash(e.hash)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      )}

      {sevTo && <SeverityModal inc={inc} to={sevTo} onClose={() => setSevTo(null)} />}
      {resolving && <ResolveModal inc={inc} onClose={() => setResolving(false)} />}
    </div>
  )
}

function WorkerReports({ onSelect }: { onSelect: (id: string) => void }) {
  const { data, error } = usePoll(() => api.workerReports(), [])
  return (
    <Card
      className="mb-5"
      caption="Admin only"
      title="Worker reports"
      subtitle="Every problem reported by a worker: what happened, how it was solved, and when."
      action={<Chip>{data?.length ?? 0} reports</Chip>}
      bodyClass="p-0"
    >
      {error && <div className="p-4"><ErrorBanner message={error} /></div>}
      {!data && !error && <Loading />}
      {data && data.length === 0 && <Empty title="No worker reports yet" />}
      {data && data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr>
                {['Worker', 'Problem', 'Solution', 'Problem time', 'Solved at', 'Time to solve', 'Status'].map((h) => (
                  <th key={h} className="border-b border-line bg-well/60 px-3 py-2.5 font-mono text-[11px] font-medium tracking-[0.04em] text-ink-2 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.incident_id} onClick={() => onSelect(r.incident_id)} className="cursor-pointer align-top hover:bg-canvas">
                  <td className="border-b border-well px-3 py-3 text-[13px]">
                    <p className="font-medium">{r.worker_name ?? (r.anonymous ? 'Anonymous' : '—')}</p>
                    <Mono className="text-ink-2">{r.incident_id} · {r.severity}</Mono>
                  </td>
                  <td className="max-w-[300px] border-b border-well px-3 py-3 text-[13px]">
                    <p className="font-medium">{r.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink-2">{r.problem}</p>
                  </td>
                  <td className="max-w-[260px] border-b border-well px-3 py-3 text-[13px]">
                    {r.solution ? <p className="line-clamp-3">{r.solution}</p> : <span className="text-xs text-warn-ink">Not solved yet</span>}
                  </td>
                  <td className="border-b border-well px-3 py-3 font-mono text-[11px] whitespace-nowrap">{formatTime(r.problem_time)}</td>
                  <td className="border-b border-well px-3 py-3 font-mono text-[11px] whitespace-nowrap">{r.solved_at ? formatTime(r.solved_at) : '—'}</td>
                  <td className="border-b border-well px-3 py-3 font-mono text-[11px] whitespace-nowrap">{formatDuration(r.time_to_solve_seconds)}</td>
                  <td className="border-b border-well px-3 py-3"><Chip tone={r.solved_at ? 'ok' : 'warn'}>{INCIDENT_STATUS[r.status]}</Chip></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function IncidentList({ items, selected, onSelect }: { items: IncidentSummary[]; selected: string | null; onSelect: (id: string) => void }) {
  if (!items.length) return <Empty title="No incidents reported yet" />
  return (
    <ul className="space-y-1.5">
      {items.map((i) => (
        <li key={i.incident_id}>
          <button onClick={() => onSelect(i.incident_id)} className={cx('w-full rounded-md border px-3 py-2 text-left', selected === i.incident_id ? 'border-ink bg-white' : 'border-line bg-white hover:bg-canvas')}>
            <div className="flex items-center gap-2">
              <Chip tone={SEV_TONE[i.severity]}>{i.severity}</Chip>
              <Mono className="text-ink-2">{i.incident_id}</Mono>
              <span className="ml-auto font-mono text-[10px] text-ink-3 uppercase">{i.status}</span>
            </div>
            <p className="mt-1 line-clamp-1 text-[13px] font-medium">{i.title}</p>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function Incidents() {
  const { role } = useApp()
  const [params, setParams] = useSearchParams()
  const { data: list } = usePoll(() => api.incidents(), [])
  const selected = params.get('incident') ?? list?.[0]?.incident_id ?? null
  const select = (id: string) => {
    const next = new URLSearchParams(params)
    next.set('incident', id)
    setParams(next)
  }
  const active = list?.find((i) => (i.severity === 'SEV1' || i.severity === 'SEV2') && !['recovered', 'closed'].includes(i.status))

  return (
    <>
      <PageHeader
        caption="Module 02 & 06 · incident response"
        title="Incidents"
        subtitle="Report a problem; the AI rates it and shows what it can affect."
        aside={
          active && (
            <button onClick={() => select(active.incident_id)} className="flex items-center gap-3 rounded-md border border-red-200 bg-bad-soft px-3 py-2 text-left">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-bad text-on-accent"><Siren size={16} /></span>
              <div>
                <p className="font-mono text-[11px] font-semibold text-bad-ink">{active.incident_id} · {active.severity} · {INCIDENT_STATUS[active.status]}</p>
                <p className="line-clamp-1 max-w-xs text-[13px]">{active.title}</p>
              </div>
            </button>
          )
        }
      />
      {role === 'admin' && <WorkerReports onSelect={select} />}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-4">
          <ReportForm onCreated={select} />
          <Card title="All incidents" action={<Chip>{list?.length ?? 0}</Chip>}>
            {list ? <IncidentList items={list} selected={selected} onSelect={select} /> : <Loading />}
          </Card>
        </div>
        <div className="min-w-0 xl:col-span-8">
          {selected ? <Detail id={selected} /> : <Card><Empty title="Report an incident to see its assessment here" /></Card>}
        </div>
      </div>
    </>
  )
}

import { AlertOctagon, ArrowRight, BadgeCheck, Download, KeyRound, ShieldAlert, Siren, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { HeatMap } from '../components/HeatMap'
import { AiChip, Button, Card, Caption, Chip, Empty, ErrorBanner, Legend, Loading, Mono, PageHeader, Ring, ScoreCapsule, StatTile, StatusPill, Tabs, cx } from '../components/ui'
import { api } from '../lib/api'
import type { HeatCell, Risk, Strategy } from '../lib/api'
import { usePoll, useApp } from '../lib/app'
import { STRATEGY, minutesLeft } from '../lib/labels'
import { useOpenRisk } from '../lib/useOpenRisk'

// Checked with the dataviz palette validator (color-blind + normal-vision separation, contrast).
const C_APPROVED = '#059669'
const C_REVIEW = '#6366f1'
const C_ESCALATED = '#d97706'

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="shadow-pop rounded-md border border-line-strong bg-white px-3 py-2 text-xs">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex justify-between gap-4 text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-mono text-ink">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

function SectionTitle({ icon, title, right }: { icon: ReactNode; title: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <span className="text-ai">{icon}</span>
        {title}
      </h2>
      {right}
    </div>
  )
}

function exportRegister(risks: Risk[]) {
  const cols: (keyof Risk)[] = ['risk_id', 'statement', 'category', 'source', 'probability', 'impact', 'score', 'level', 'strategy', 'owner_role', 'status', 'materialized_by', 'incident_id']
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [cols.join(','), ...risks.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  Object.assign(document.createElement('a'), { href: url, download: 'risk-register.csv' }).click()
  URL.revokeObjectURL(url)
}

export function Overview() {
  const { role } = useApp()
  const { open } = useOpenRisk()
  const [mode, setMode] = useState<'all' | 'open'>('all')
  const [scope, setScope] = useState('')
  const [cell, setCell] = useState<HeatCell | null>(null)

  const kpis = usePoll(() => api.kpis(), [])
  const verify = usePoll(() => api.verify(), [], 10000)
  const heat = usePoll(() => api.heatmap(scope || undefined, mode), [scope, mode])
  const allHeat = usePoll(() => api.heatmap(undefined, 'all'), [], 10000)
  const all = usePoll(() => api.risks(), [])
  const incidents = usePoll(() => api.incidents(), [])
  const escalations = usePoll(() => api.escalations(), [])
  const insights = usePoll(() => api.insights(), [], 6000)

  const risks = useMemo(() => (all.data ?? []).filter((r) => r.status !== 'rejected'), [all.data])
  const byId = useMemo(() => new Map(risks.map((r) => [r.risk_id, r])), [risks])

  // Every number below is counted from database rows; the model produces none of them.
  const treatment = useMemo(
    () =>
      (Object.keys(STRATEGY) as Strategy[]).map((s) => {
        const rows = risks.filter((r) => r.strategy === s)
        const approved = rows.filter((r) => r.status === 'approved' || r.status === 'resolved').length
        return { name: STRATEGY[s], Approved: approved, 'In review': rows.length - approved, total: rows.length }
      }),
    [risks],
  )
  const review = {
    approved: risks.filter((r) => r.status === 'approved' || r.status === 'resolved').length,
    inReview: risks.filter((r) => r.status === 'pending' || r.status === 'edited').length,
    escalated: risks.filter((r) => r.status === 'escalated').length,
  }
  const inc = incidents.data ?? []
  const incStatus = {
    open: inc.filter((i) => i.status === 'reported' || i.status === 'acknowledged').length,
    contained: inc.filter((i) => i.status === 'contained').length,
    done: inc.filter((i) => i.status === 'recovered' || i.status === 'closed').length,
  }
  const sources = allHeat.data?.sources ?? []
  const totalExposure = sources.reduce((s, x) => s + x.open_exposure, 0)

  const k = kpis.data
  const rate = k?.quote_verification_rate
  const cellRisks = cell ? cell.risk_ids.map((id) => byId.get(id)).filter((r): r is Risk => !!r) : []

  // Urgent work, most pressing first.
  const tasks: { key: string; icon: ReactNode; title: string; meta: string; tag: ReactNode; to: string; action: string }[] = []
  for (const i of inc.filter((x) => (x.severity === 'SEV1' || x.severity === 'SEV2') && !['recovered', 'closed'].includes(x.status))) {
    tasks.push({ key: i.incident_id, icon: <Siren size={15} className="text-bad" />, title: i.title, meta: `${i.incident_id} · ${i.status}`, tag: <Chip tone="bad">{i.severity}</Chip>, to: `/incidents?incident=${i.incident_id}`, action: 'Respond' })
  }
  for (const e of (escalations.data ?? []).filter((x) => x.status === 'pending')) {
    const left = minutesLeft(e.decision_deadline)
    tasks.push({ key: e.escalation_id, icon: <KeyRound size={15} className="text-warn-ink" />, title: `${e.access_level} on ${e.resource}`, meta: `${e.escalation_id} · ${e.overdue ? 'decision overdue' : `decide within ${left} min`}`, tag: <Chip tone={e.overdue ? 'bad' : 'warn'}>{e.overdue ? 'Overdue' : 'Pending'}</Chip>, to: '/escalations', action: 'Decide' })
  }
  for (const e of (escalations.data ?? []).filter((x) => x.break_glass && !x.reviewed_at)) {
    tasks.push({ key: `${e.escalation_id}-r`, icon: <AlertOctagon size={15} className="text-bad" />, title: `Review break-glass on ${e.resource}`, meta: e.escalation_id, tag: <Chip tone="bad">Review</Chip>, to: '/escalations', action: 'Review' })
  }
  for (const r of risks.filter((x) => x.level === 'critical' && x.status === 'pending').slice(0, 5)) {
    tasks.push({ key: r.risk_id, icon: <ShieldAlert size={15} className="text-lvl-critical" />, title: r.statement, meta: `${r.risk_id} · awaiting approval`, tag: <Chip tone="bad">P{r.probability} × I{r.impact}</Chip>, to: `?risk=${r.risk_id}`, action: 'Triage' })
  }

  return (
    <>
      <PageHeader
        caption="Risk governance overview"
        title="Executive Risk Register & Treatment Overview"
        subtitle="Live totals from the risk register, incidents, escalations and the audit chain. AI proposes; people approve; every step is logged."
        aside={
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            {verify.data && (
              <span className={cx('shadow-card inline-flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-[11px]', verify.data.ok ? 'border-line bg-white' : 'border-red-200 bg-bad-soft text-bad-ink')}>
                <span className={cx('h-2 w-2 rounded-full', verify.data.ok ? 'bg-ok' : 'bg-bad')} />
                AUDIT CHAIN: {verify.data.ok ? `VALID · ${verify.data.checked} BLOCKS` : `BROKEN AT #${verify.data.broken_at}`}
              </span>
            )}
            <Button variant="primary" onClick={() => exportRegister(all.data ?? [])} disabled={!all.data?.length}>
              <Download size={14} /> Export register
            </Button>
          </div>
        }
      />

      {kpis.error && <div className="mb-4"><ErrorBanner message={kpis.error} /></div>}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Open risks"
          value={k?.open ?? '–'}
          unit="in register"
          chip={k && <Chip tone={k.critical ? 'bad' : 'gray'}>{k.critical} critical</Chip>}
          note={k ? `Pending review ${k.pending_review} · flagged ${k.needs_review} · resolved ${k.resolved}` : undefined}
          bar={k && k.total ? ((k.resolved + k.rejected) / k.total) * 100 : null}
          barTone="ok"
        />
        <StatTile
          label="Evidence verification"
          value={rate === null || rate === undefined ? '–' : `${Math.round(rate * 100)}%`}
          unit="quotes verbatim"
          chip={<Chip tone="ai">Verbatim</Chip>}
          note={k ? `Verified ${k.quotes_verified} · removed ${k.quotes_dropped} (not found in source)` : undefined}
          bar={rate === null || rate === undefined ? null : rate * 100}
          barTone="ai"
        />
        <StatTile
          label="Open incidents"
          value={k?.open_incidents ?? '–'}
          unit="not closed"
          chip={k && <Chip tone={k.open_sev1_sev2 ? 'bad' : 'gray'}>{k.open_sev1_sev2} SEV1/2</Chip>}
          note={k ? `Predicted risks that happened: ${k.materialized} · active access grants: ${k.active_grants}` : undefined}
        />
        <StatTile
          label="Audit chain"
          value={verify.data?.checked ?? '–'}
          unit="blocks re-hashed"
          chip={verify.data && <Chip tone={verify.data.ok ? 'ok' : 'bad'}>{verify.data.ok ? 'Valid' : 'Broken'}</Chip>}
          note={verify.data ? `Full chain recomputed in ${verify.data.duration_ms} ms` : undefined}
          bar={verify.data ? (verify.data.ok ? 100 : 0) : null}
          barTone={verify.data?.ok ? 'ok' : 'bad'}
        />
      </section>

      <section className="mt-8">
        <SectionTitle icon={<BadgeCheck size={16} />} title="Treatment & review status" right={<Caption>Counted from the register · rejected risks excluded</Caption>} />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2" title="Number of risks by treatment type" subtitle="Approved (incl. resolved) vs still in review, per treatment strategy.">
            {risks.length === 0 ? (
              <Empty title="No risks yet">Analyze a document in the Project Analyzer.</Empty>
            ) : (
              <>
                <div className="mb-2 flex gap-4 text-xs text-ink-2">
                  {[['Approved', C_APPROVED], ['In review', C_REVIEW]].map(([l, c]) => (
                    <span key={l} className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />
                      {l}
                    </span>
                  ))}
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={treatment} barGap={2} barCategoryGap="28%">
                      <CartesianGrid vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip content={<ChartTip />} cursor={{ fill: '#f8fafc' }} />
                      <Bar isAnimationActive={false} dataKey="Approved" fill={C_APPROVED} radius={[4, 4, 0, 0]} />
                      <Bar isAnimationActive={false} dataKey="In review" fill={C_REVIEW} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-1 grid grid-cols-4 text-center font-mono text-[11px] text-ink-2">
                  {treatment.map((t) => (
                    <span key={t.name}>{t.total} total</span>
                  ))}
                </div>
              </>
            )}
          </Card>
          <div className="grid grid-cols-1 gap-4">
            <Card title="Review status" action={<Chip>{risks.length} total</Chip>}>
              <div className="flex items-center gap-5">
                <Ring size={104} stroke={11} segments={[{ value: review.approved, color: C_APPROVED, label: 'Approved' }, { value: review.inReview, color: C_REVIEW, label: 'In review' }, { value: review.escalated, color: C_ESCALATED, label: 'Escalated' }]}>
                  <span className="text-xl font-semibold">{review.approved}</span>
                  <span className="font-mono text-[9px] text-ink-2 uppercase">approved</span>
                </Ring>
                <div className="flex-1">
                  <Legend items={[{ label: 'Approved', color: C_APPROVED, value: review.approved }, { label: 'In review', color: C_REVIEW, value: review.inReview }, { label: 'Escalated', color: C_ESCALATED, value: review.escalated }]} />
                </div>
              </div>
            </Card>
            <Card title="Incident status" action={<Chip>{inc.length} total</Chip>}>
              <div className="flex items-center gap-5">
                <Ring size={104} stroke={11} segments={[{ value: incStatus.done, color: C_APPROVED, label: 'Recovered' }, { value: incStatus.contained, color: C_REVIEW, label: 'Contained' }, { value: incStatus.open, color: C_ESCALATED, label: 'Open' }]}>
                  <span className="text-xl font-semibold">{incStatus.open}</span>
                  <span className="font-mono text-[9px] text-ink-2 uppercase">open</span>
                </Ring>
                <div className="flex-1">
                  <Legend items={[{ label: 'Recovered / closed', color: C_APPROVED, value: incStatus.done }, { label: 'Contained', color: C_REVIEW, value: incStatus.contained }, { label: 'Open', color: C_ESCALATED, value: incStatus.open }]} />
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card
          className="xl:col-span-3"
          title="Current risk: 5×5 probability vs. impact"
          subtitle="Click a cell to list its risks."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <select value={scope} onChange={(e) => { setScope(e.target.value); setCell(null) }} className="h-8 rounded-md border border-line bg-white px-2 text-[13px]">
                <option value="">All sources</option>
                {sources.map((s) => (
                  <option key={s.source} value={s.source}>{s.source}</option>
                ))}
              </select>
              <Tabs value={mode} onChange={(m) => { setMode(m); setCell(null) }} items={[{ value: 'all', label: 'All exposure' }, { value: 'open', label: 'Open only' }]} />
            </div>
          }
        >
          {heat.data ? <HeatMap cells={heat.data.cells} selected={cell} onSelect={setCell} /> : heat.error ? <ErrorBanner message={heat.error} /> : <Loading />}
          {cell && (
            <ul className="mt-4 divide-y divide-well border-t border-line">
              {cellRisks.map((r) => (
                <li key={r.risk_id}>
                  <button onClick={() => open(r.risk_id)} className="flex w-full items-center gap-3 py-2 text-left hover:bg-canvas">
                    <Mono className="w-14 shrink-0 text-ink-2">{r.risk_id}</Mono>
                    <span className="line-clamp-1 flex-1 text-[13px]">{r.statement}</span>
                    <StatusPill status={r.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-2" title="Source exposure (Σ P×I)" subtitle="Open exposure per system, and how many of its risks are solved." action={<Chip>{totalExposure} total open</Chip>}>
          {sources.length === 0 ? (
            <Empty title="No sources yet" />
          ) : (
            <ul className="space-y-4">
              {sources.slice(0, 7).map((s) => {
                const solvedPct = s.total ? (s.solved / s.total) * 100 : 0
                return (
                  <li key={s.source}>
                    <div className="flex items-center justify-between gap-2">
                      <Link to={`/risks?source=${encodeURIComponent(s.source)}`} className="font-mono text-[12px] font-medium hover:underline">
                        {s.source}
                      </Link>
                      <span className="font-mono text-[11px] text-ink-2">
                        ΣP×I = {s.open_exposure} {totalExposure ? `(${Math.round((s.open_exposure / totalExposure) * 100)}%)` : ''}
                      </span>
                    </div>
                    <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-well" title={`${s.solved} solved of ${s.total}`}>
                      <div className="bg-ok" style={{ width: `${solvedPct}%` }} />
                      <div className="bg-lvl-critical/70" style={{ width: `${s.total ? (s.open / s.total) * 100 : 0}%` }} />
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-ink-2">
                      {s.solved}/{s.total} solved · {s.open} open
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="mt-4 flex gap-4 border-t border-line pt-3 text-xs text-ink-2">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-ok" />Solved</span>
            <span className="inline-flex items-center gap-1.5"><span className="bg-lvl-critical/70 h-2.5 w-2.5 rounded-sm" />Open</span>
          </div>
        </Card>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card
          title="Fact-grounded AI risk synthesizer"
          subtitle="The AI writes the sentences; every number comes from a database query and is checked."
          action={insights.data?.generated_by === 'ai' ? <AiChip label="AI · numbers checked" /> : insights.data?.generated_by === 'template' ? <Chip>Fixed text (AI unavailable)</Chip> : null}
        >
          {!insights.data ? (
            insights.error ? <ErrorBanner message={insights.error} /> : <Loading />
          ) : insights.data.insights.length === 0 ? (
            <Empty title="Nothing to summarize yet" />
          ) : (
            <>
              <ul className="space-y-2">
                {insights.data.insights.map((ins, i) => (
                  <li key={i} className="flex gap-2.5 rounded-md border border-line bg-canvas px-3 py-2.5 text-[13px] leading-5">
                    <Sparkles size={14} className="mt-0.5 shrink-0 text-ai" />
                    <span>“{ins.text}”</span>
                  </li>
                ))}
              </ul>
              <Caption className="mt-4 mb-2">Grounded evidence mapping</Caption>
              <dl className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {insights.data.facts.map((f) => (
                  <div key={f.id} className="rounded-md bg-well px-2.5 py-1.5 font-mono text-[11px]">
                    <dt className="text-ink-2">{f.id}</dt>
                    <dd className="text-ink">{Object.entries(f.values).map(([kk, v]) => `${kk}=${String(v)}`).join(' · ')}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </Card>

        <Card title="Action center & urgent tasks" subtitle="Incidents, approvals and critical risks waiting for a person." action={<Chip tone={tasks.length ? 'warn' : 'gray'}>{tasks.length} open</Chip>}>
          {tasks.length === 0 ? (
            <Empty title="Nothing urgent">No open SEV1/2 incidents, pending escalations or critical risks awaiting approval.</Empty>
          ) : (
            <ul className="space-y-2">
              {tasks.slice(0, 8).map((t) => (
                <li key={t.key} className="flex items-center gap-3 rounded-md border border-line px-3 py-2">
                  {t.icon}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-[13px] font-medium">{t.title}</p>
                    <p className="font-mono text-[11px] text-ink-2">{t.meta}</p>
                  </div>
                  {t.tag}
                  <Link to={t.to}>
                    <Button size="sm" variant={role === 'auditor' ? 'secondary' : 'primary'}>{role === 'auditor' ? 'Inspect' : t.action}</Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex justify-end">
            <Link to="/risks?status=pending" className="inline-flex items-center gap-1 text-xs font-medium text-ai-ink hover:underline">
              Open risk register <ArrowRight size={12} />
            </Link>
          </div>
        </Card>
      </section>

      {risks.length > 0 && (
        <section className="mt-8">
          <SectionTitle icon={<ShieldAlert size={16} />} title="Highest open scores" />
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {risks
              .filter((r) => r.status !== 'resolved')
              .sort((a, b) => b.score - a.score)
              .slice(0, 6)
              .map((r) => (
                <button key={r.risk_id} onClick={() => open(r.risk_id)} className="shadow-card flex items-center gap-3 rounded-md border border-line bg-white px-3 py-2.5 text-left hover:bg-canvas">
                  <ScoreCapsule score={r.score} />
                  <Mono className="text-ink-2">{r.risk_id}</Mono>
                  <span className="line-clamp-1 flex-1 text-[13px]">{r.statement}</span>
                  <StatusPill status={r.status} />
                </button>
              ))}
          </div>
        </section>
      )}
    </>
  )
}

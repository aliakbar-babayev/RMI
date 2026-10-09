import { AlertTriangle, BadgeCheck, Download, FileSearch, Link2, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RiskInspector } from '../components/RiskInspector'
import { Button, Chip, Empty, ErrorBanner, FilterSelect, LEVEL_BAR, Loading, Mono, PageHeader, ScoreCapsule, StatusPill, TableWrap, cx, inputCls, td, th } from '../components/ui'
import { api } from '../lib/api'
import type { Category, Level, Risk, Status, Strategy } from '../lib/api'
import { usePoll } from '../lib/app'
import { CATEGORY, LEVEL, STATUS, STRATEGY } from '../lib/labels'
import { useOpenRisk } from '../lib/useOpenRisk'

const PAGE = 10
const opts = <T extends string>(labels: Record<T, string>) => (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }))

function download(name: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  Object.assign(document.createElement('a'), { href: url, download: name }).click()
  URL.revokeObjectURL(url)
}

function exportRows(rows: Risk[], format: 'csv' | 'json') {
  if (format === 'json') return download('risk-register.json', 'application/json', JSON.stringify(rows, null, 2))
  const cols: (keyof Risk)[] = ['risk_id', 'statement', 'category', 'source', 'probability', 'impact', 'score', 'level', 'strategy', 'owner_role', 'trigger', 'status', 'needs_review', 'confidence', 'materialized_by', 'incident_id']
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  download('risk-register.csv', 'text/csv;charset=utf-8', '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n'))
}

function useWide() {
  const query = '(min-width: 1280px)'
  const [wide, setWide] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const on = () => setWide(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return wide
}

export function Risks() {
  const [params, setParams] = useSearchParams()
  const { open } = useOpenRisk()
  const wide = useWide()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)

  // Filters live in the URL so other pages can link to a filtered register.
  const f = {
    status: (params.get('status') ?? '') as Status | '',
    category: (params.get('category') ?? '') as Category | '',
    level: (params.get('level') ?? '') as Level | '',
    strategy: (params.get('strategy') ?? '') as Strategy | '',
    source: params.get('source') ?? '',
    review: params.get('needs_review') === 'true',
  }
  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('risk')
    setParams(next)
    setPage(0)
  }
  const reset = () => {
    setParams(new URLSearchParams())
    setSearch('')
    setPage(0)
  }

  const { data, error } = usePoll(
    () => api.risks({ status: f.status || undefined, category: f.category || undefined, level: f.level || undefined, source: f.source || undefined, needs_review: f.review || undefined }),
    [f.status, f.category, f.level, f.source, f.review],
  )
  const { data: heat } = usePoll(() => api.heatmap(), [], 15000)
  const { data: stats } = usePoll(() => api.auditStats(), [], 15000)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data ?? [])
      .filter((r) => !f.strategy || r.strategy === f.strategy)
      .filter((r) => !q || `${r.risk_id} ${r.statement} ${r.source ?? ''} ${r.owner_role} ${r.evidence.map((e) => e.text).join(' ')}`.toLowerCase().includes(q))
  }, [data, search, f.strategy])
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE)
  const active = [
    f.status && { key: 'status', label: `Status: ${STATUS[f.status]}` },
    f.category && { key: 'category', label: `Category: ${CATEGORY[f.category]}` },
    f.level && { key: 'level', label: `Level: ${LEVEL[f.level]}` },
    f.strategy && { key: 'strategy', label: `Strategy: ${STRATEGY[f.strategy]}` },
    f.source && { key: 'source', label: `Source: ${f.source}` },
    f.review && { key: 'needs_review', label: 'Needs review only' },
  ].filter(Boolean) as { key: string; label: string }[]

  const select = (id: string) => (wide ? setSelected(id) : open(id))
  const panelOpen = wide && selected

  return (
    <>
      <PageHeader
        caption="Module 01 · risk register"
        title="Risk Register"
        subtitle="All risks, scored P × I, each backed by a quote from its source."
        aside={
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <Chip>{data?.length ?? 0} scenarios</Chip>
            {stats?.head && <Chip tone="ok"><BadgeCheck size={12} /> Audit head #{stats.head.event_id}</Chip>}
            <Button onClick={() => exportRows(rows, 'csv')} disabled={!rows.length}>
              <Download size={13} /> CSV
            </Button>
            <Button onClick={() => exportRows(rows, 'json')} disabled={!rows.length}>
              <Download size={13} /> JSON
            </Button>
            <Link to="/analyze">
              <Button variant="ai">
                <FileSearch size={14} /> Ingest & scan document
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="relative w-full md:w-80">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-3" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} placeholder="Search ID, statement, source or quote…" className={`${inputCls} h-8 pl-8`} />
        </div>
        <FilterSelect label="Status" value={f.status} options={opts(STATUS)} onChange={(v) => setFilter('status', v)} />
        <FilterSelect label="Category" value={f.category} options={opts(CATEGORY)} onChange={(v) => setFilter('category', v)} />
        <FilterSelect label="Level" value={f.level} options={opts(LEVEL)} onChange={(v) => setFilter('level', v)} />
        <FilterSelect label="Strategy" value={f.strategy} options={opts(STRATEGY)} onChange={(v) => setFilter('strategy', v)} />
        <FilterSelect label="Source" value={f.source} options={(heat?.sources ?? []).map((s) => ({ value: s.source, label: s.source }))} onChange={(v) => setFilter('source', v)} />
        <button
          onClick={() => setFilter('needs_review', f.review ? '' : 'true')}
          className={cx('inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-[13px] font-medium', f.review ? 'border-red-300 bg-bad-soft text-bad-ink' : 'border-line bg-white hover:bg-canvas')}
        >
          <AlertTriangle size={13} /> Needs review only
        </button>
      </div>
      {active.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 font-mono text-[11px] text-ink-2">
          ACTIVE FILTERS:
          {active.map((a) => (
            <button key={a.key} onClick={() => setFilter(a.key, '')} className="inline-flex items-center gap-1 rounded-sm bg-well px-1.5 py-0.5 text-ink hover:bg-line">
              {a.label} <X size={11} />
            </button>
          ))}
          <button onClick={reset} className="text-ai-ink hover:underline">Reset all ({active.length})</button>
        </div>
      )}

      {error && <ErrorBanner message={error} />}
      {!data && !error && <Loading />}

      {data && (
        <div className={cx('grid grid-cols-1 gap-4', panelOpen && 'xl:grid-cols-[minmax(0,1fr)_480px]')}>
          <div className="min-w-0">
            <TableWrap minWidth={panelOpen ? 720 : 900}>
              <thead>
                <tr>
                  <th className={th}>Risk ID</th>
                  <th className={`${th} w-[36%]`}>Risk statement (ISO 31000)</th>
                  <th className={th}>Source / owner</th>
                  <th className={th}>P × I</th>
                  <th className={th}>Score</th>
                  {!panelOpen && <th className={th}>Evidence</th>}
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr
                    key={r.risk_id}
                    onClick={() => select(r.risk_id)}
                    className={cx('cursor-pointer hover:bg-canvas', selected === r.risk_id && panelOpen && 'bg-canvas')}
                  >
                    <td className={td}>
                      <div className="flex items-stretch gap-2">
                        <span className={cx('w-1 rounded-full', LEVEL_BAR[r.level], selected === r.risk_id && panelOpen && 'w-1.5')} />
                        <div>
                          <Mono className={cx('font-semibold', r.level === 'critical' && 'text-lvl-critical')}>{r.risk_id}</Mono>
                          <p className="font-mono text-[10px] text-ink-3">{r.analysis_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className={td}>
                      <p className="line-clamp-2">{r.statement}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                        {r.evidence.length > 0 ? (
                          <span className="inline-flex items-center gap-1 font-mono text-ok-ink"><BadgeCheck size={11} /> Verbatim backed</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-mono text-warn-ink"><AlertTriangle size={11} /> No verified quote</span>
                        )}
                        <span className="text-ink-3">·</span>
                        <span className="text-ink-2">{CATEGORY[r.category]}</span>
                        {r.materialized_by && <Chip tone="ink"><Link2 size={10} /> Happened · {r.materialized_by}</Chip>}
                        {r.needs_review && <Chip tone="warn">Needs review</Chip>}
                      </div>
                    </td>
                    <td className={td}>
                      <Mono>{r.source ?? 'unassigned'}</Mono>
                      <p className="text-xs text-ink-2">{r.owner_role || '—'}</p>
                    </td>
                    <td className={td}>
                      <span className="inline-flex items-center gap-1 rounded-md border border-line bg-canvas px-2 py-1 font-mono text-[11px] whitespace-nowrap">
                        P:{r.probability} <span className="text-ink-3">×</span> I:{r.impact}
                      </span>
                    </td>
                    <td className={td}>
                      <ScoreCapsule score={r.score} label />
                    </td>
                    {!panelOpen && (
                      <td className={td}>
                        {r.evidence[0] ? (
                          <div className="font-mono text-[11px]">
                            <span className="rounded-sm bg-ok-soft px-1 text-ok-ink">{r.evidence.length} verbatim</span>
                            <p className="mt-0.5 text-ink-2">chars [{r.evidence[0].start}:{r.evidence[0].end}]</p>
                          </div>
                        ) : (
                          <span className="font-mono text-[11px] text-ink-3">—</span>
                        )}
                      </td>
                    )}
                    <td className={td}>
                      <StatusPill status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            {rows.length === 0 ? (
              <Empty title={data.length ? 'No risks match' : 'No risks yet'}>
                {data.length ? 'Change the search or reset the filters.' : <Link className="underline" to="/analyze">Analyze a document to fill the register.</Link>}
              </Empty>
            ) : (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-ink-2">
                <span>Showing {page * PAGE + 1}–{Math.min(rows.length, page * PAGE + PAGE)} of {rows.length} scenarios</span>
                <div className="flex items-center gap-1">
                  <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                  {Array.from({ length: pages }, (_, i) => (
                    <button key={i} onClick={() => setPage(i)} className={cx('h-7 min-w-7 rounded-md px-2', i === page ? 'bg-ink text-white' : 'hover:bg-well')}>
                      {i + 1}
                    </button>
                  ))}
                  <Button size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </div>
          {panelOpen && <RiskInspector riskId={selected} variant="panel" onClose={() => setSelected(null)} />}
        </div>
      )}
    </>
  )
}

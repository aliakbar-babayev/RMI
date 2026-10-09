import { AlertTriangle, BadgeCheck, Bot, CheckCircle2, CircleX, FileCode2, Gauge, ScanSearch, TriangleAlert, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Highlighted } from '../components/RiskInspector'
import { Button, Caption, Card, Chip, Empty, ErrorBanner, Field, LevelTag, Mono, PageHeader, Ring, ScoreCapsule, StatusPill, cx, inputCls } from '../components/ui'
import { api } from '../lib/api'
import type { Analysis, Evidence, ReadinessDimension } from '../lib/api'
import { usePoll, useApp } from '../lib/app'
import { DECISION, DIMENSION } from '../lib/labels'
import { useOpenRisk } from '../lib/useOpenRisk'

const MAX_CHARS = 20000
const LANGS = [
  { value: '', label: 'Auto-detect' },
  { value: 'en', label: 'English' },
  { value: 'az', label: 'Azerbaijani' },
  { value: 'ru', label: 'Russian' },
]
const DECISION_COLOR = { go: '#059669', conditional_go: '#6366f1', not_ready: '#b3122f' }

async function sha256(text: string) {
  if (!crypto?.subtle) return null
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

function DimensionTile({ d, open, onClick }: { d: ReadinessDimension; open: boolean; onClick: () => void }) {
  const icon = {
    passed: <CheckCircle2 size={14} className="text-ok" />,
    warning: <TriangleAlert size={14} className="text-warn" />,
    failed: <CircleX size={14} className="text-bad" />,
  }[d.status]
  const tone = { passed: 'text-ok-ink', warning: 'text-warn-ink', failed: 'text-bad-ink' }[d.status]
  return (
    <button onClick={onClick} className={cx('rounded-md border bg-white p-2.5 text-left transition', open ? 'border-ink' : 'border-line hover:border-line-strong')}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[11px] leading-4 text-ink">{DIMENSION[d.key] ?? d.key}</span>
        <span className={cx('inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase', tone)}>
          {icon}
          {d.status}
        </span>
      </div>
      {!d.assessed && <p className="mt-1 text-[11px] text-ink-3">Not assessed by the model</p>}
    </button>
  )
}

function Telemetry({ busy, seconds, result, error, model }: { busy: boolean; seconds: number; result: Analysis | null; error: string | null; model?: string }) {
  const state = busy ? `RUNNING (${seconds}s)` : error ? 'ERROR' : result ? 'DONE' : 'READY'
  const lines = busy
    ? ['Document sent to the local model inside a random-marker fence.', 'Extracting risks, then checking every quote against the original text…']
    : error
      ? [error]
      : result
        ? [
            `${result.analysis_id}: ${result.stats.risks_returned} risks proposed, ${result.stats.needs_review} flagged for review.`,
            `${result.stats.dropped_quotes} quote(s) removed (not found word for word). Model attempts: ${result.stats.model_attempts}.`,
          ]
        : ['Waiting for input. Scores are computed by the backend as P × I; the model never sets them.']
  return (
    <div className="rounded-md bg-ink p-3 font-mono text-[12px] leading-5 text-slate-300">
      <div className="mb-1 flex justify-between text-[11px] tracking-[0.04em] uppercase">
        <span className="text-slate-400">Engine status · {model ?? '…'}</span>
        <span className={error ? 'text-red-400' : 'text-emerald-400'}>{state}</span>
      </div>
      {lines.map((l, i) => (
        <p key={i}>{l}</p>
      ))}
    </div>
  )
}

export function Analyze() {
  const { canAct, refresh } = useApp()
  const { open } = useOpenRisk()
  const { data: samples } = usePoll(() => api.samples(), [], 0)
  const { data: health } = usePoll(() => api.health(), [], 0)
  const [text, setText] = useState('')
  const [lang, setLang] = useState('')
  const [source, setSource] = useState('')
  const [withReadiness, setWithReadiness] = useState(true)
  const [sampleId, setSampleId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // The shown analysis lives in the URL, so results survive navigation and can be linked.
  const [params, setParams] = useSearchParams()
  const resultId = params.get('analysis')
  const setResultId = (id: string | null) => {
    const next = new URLSearchParams(params)
    if (id) next.set('analysis', id)
    else next.delete('analysis')
    setParams(next, { replace: true })
  }
  const [openDim, setOpenDim] = useState<string | null>(null)
  const [checksum, setChecksum] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Re-read the analysis so statuses update after Accept / Triage.
  const { data: result } = usePoll(() => (resultId ? api.analysis(resultId) : Promise.resolve(null)), [resultId])

  useEffect(() => {
    if (!busy) return
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [busy])

  useEffect(() => {
    let alive = true
    sha256(text).then((h) => alive && setChecksum(h))
    return () => {
      alive = false
    }
  }, [text])

  const pick = (id: string) => {
    const s = samples?.find((x) => x.id === id)
    if (!s) return
    setSampleId(id)
    setText(s.text)
    setLang(s.language)
    setSource(s.source)
    setResultId(null)
  }

  const loadFile = async (file: File) => {
    setError(null)
    if (!/\.(txt|md|json)$/i.test(file.name)) {
      setError('Only .txt, .md and .json files can be read here. Paste other text directly.')
      return
    }
    setText(await file.text())
    setSampleId(null)
    setResultId(null)
  }

  const run = async () => {
    setSeconds(0)
    setBusy(true)
    setError(null)
    setResultId(null)
    try {
      const a = await api.analyze(text, lang, source.trim(), withReadiness)
      setResultId(a.analysis_id)
      setOpenDim(null)
      refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const acceptAll = async () => {
    if (!result) return
    setAccepting(true)
    try {
      for (const r of result.risks.filter((x) => x.status === 'pending' && !x.needs_review)) await api.approve(r.risk_id)
      refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAccepting(false)
    }
  }

  const allEvidence: Evidence[] = useMemo(() => result?.risks.flatMap((r) => r.evidence) ?? [], [result])
  const r = result?.readiness
  const tooLong = text.length > MAX_CHARS
  const acceptable = result?.risks.filter((x) => x.status === 'pending' && !x.needs_review).length ?? 0
  const dim = r?.dimensions.find((d) => d.key === openDim)

  return (
    <>
      <PageHeader
        caption="Module 01 · project analyzer & document ingestion"
        title="Project Analyzer & Document Ingestion"
        subtitle="Turn project documents, sprint notes and transcripts into scored, evidence-backed ISO 31000 risks, with an optional 12-dimension readiness review before the project starts."
        aside={
          <div className="shadow-card flex items-center gap-3 rounded-md border border-line bg-white px-3 py-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink text-white"><Bot size={16} /></span>
            <div>
              <p className="text-[13px] font-medium">{health?.model ?? 'Model'}</p>
              <p className="font-mono text-[11px] text-ink-2">Local model · quotes verified · P × I by backend</p>
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-5">
          <Card caption="Test corpus presets" action={<Caption>Built-in samples</Caption>}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {samples?.map((s) => (
                <button
                  key={s.id}
                  onClick={() => pick(s.id)}
                  className={cx(
                    'rounded-md border px-3 py-2 text-left',
                    sampleId === s.id ? 'border-ink bg-ink text-white' : 'border-line bg-canvas hover:bg-well',
                  )}
                >
                  <p className={cx('text-[13px] font-medium', s.test && sampleId !== s.id && 'text-bad-ink')}>{s.title}</p>
                  <p className={cx('font-mono text-[11px] uppercase', sampleId === s.id ? 'text-slate-300' : 'text-ink-2')}>
                    {s.language} · {s.test ? 'prompt-injection probe' : s.source}
                  </p>
                </button>
              ))}
            </div>
          </Card>

          <Card
            title={<span className="inline-flex items-center gap-2"><FileCode2 size={16} className="text-ai" />Untrusted source payload</span>}
            action={<Chip>Fence: random marker per request</Chip>}
          >
            <div className="mb-3 grid grid-cols-1 gap-3 rounded-md bg-canvas p-3 sm:grid-cols-3">
              <Field label="Entity namespace">
                <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. core-db" className={inputCls} />
              </Field>
              <Field label="Language hint">
                <select value={lang} onChange={(e) => setLang(e.target.value)} className={inputCls}>
                  {LANGS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Character budget">
                <p className={cx('pt-1.5 font-mono text-[13px]', tooLong ? 'font-semibold text-bad-ink' : 'text-ai-ink')}>
                  {text.length.toLocaleString()}<span className="text-ink-2">/20k</span>
                </p>
              </Field>
            </div>

            <div className="overflow-hidden rounded-md border border-line bg-canvas">
              <div className="flex justify-between border-b border-line px-3 py-1.5 font-mono text-[11px]">
                <span className="text-ai-ink">{'<<<DOCUMENT-{random}'}</span>
                <span className="text-ink-2 italic">treated as data, never as instructions</span>
              </div>
              <textarea
                value={text}
                onChange={(e) => { setText(e.target.value); setSampleId(null) }}
                rows={12}
                placeholder="Paste project text, sprint notes, a meeting transcript…"
                className="block min-h-64 w-full resize-y bg-white px-3 py-2 font-mono text-[13px] leading-6 text-ink outline-none placeholder:text-ink-3"
              />
              <div className="flex flex-wrap justify-between gap-2 border-t border-line px-3 py-1.5 font-mono text-[11px]">
                <span className="text-ai-ink">{'DOCUMENT-{random}>>>'}</span>
                <span className="text-ok-ink">{checksum && text ? `SHA-256: ${checksum.slice(0, 12)}…` : 'SHA-256: —'}</span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 text-xs font-medium text-ink-2 hover:text-ink">
                <Upload size={13} /> Load .txt / .md / .json
              </button>
              <input ref={fileRef} type="file" accept=".txt,.md,.json,text/plain,text/markdown,application/json" className="hidden" onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
              <label className="inline-flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={withReadiness} onChange={(e) => setWithReadiness(e.target.checked)} className="h-4 w-4 accent-ink" />
                12-dimension readiness review (second model call)
              </label>
            </div>

            <Button variant="primary" size="lg" className="mt-4 w-full" disabled={!canAct || !text.trim() || tooLong} loading={busy} onClick={run}>
              <ScanSearch size={18} /> {busy ? 'Analyzing…' : 'Run analysis & verify citations'}
            </Button>
            {!canAct && <p className="mt-2 text-xs text-ink-2">Auditors cannot start analyses.</p>}
            <p className="mt-2 font-mono text-[11px] text-ink-2">A local model on a laptop can take 1–3 minutes, longer with the readiness review.</p>
            <div className="mt-3">
              <Telemetry busy={busy} seconds={seconds} result={result ?? null} error={error} model={health?.model} />
            </div>
          </Card>
        </div>

        <div className="space-y-4 xl:col-span-7">
          <Card
            caption="ISO 31000 pre-project evaluation"
            title="12-dimension project readiness scoring"
            action={r && <Chip tone="ai">{r.dimensions.filter((d) => d.assessed).length} of 12 assessed</Chip>}
          >
            {!r ? (
              <Empty title={result ? 'Readiness review was not requested' : 'No evaluation yet'}>
                {result ? 'Tick the readiness option and run again.' : 'Run an analysis with the readiness review enabled.'}
              </Empty>
            ) : (
              <div className="grid grid-cols-1 gap-5 rounded-md bg-canvas p-4 lg:grid-cols-[180px_1fr]">
                <div className="flex flex-col items-center gap-3">
                  <Ring size={150} stroke={12} segments={[{ value: r.score, color: DECISION_COLOR[r.decision], label: 'Score' }, { value: 100 - r.score, color: '#e2e8f0', label: 'Remaining' }]}>
                    <span className="text-3xl font-semibold">{r.score}</span>
                    <span className="font-mono text-[11px] text-ink-2">/ 100</span>
                  </Ring>
                  <Chip tone={r.decision === 'go' ? 'ok' : r.decision === 'conditional_go' ? 'ai' : 'bad'} className="px-3 py-1 text-[12px]">
                    {DECISION[r.decision]}
                  </Chip>
                  <p className="text-center font-mono text-[10px] text-ink-2">
                    base {r.base_score} − {r.critical_penalty} for critical risks
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold">Gate verdict</p>
                  <p className="mb-3 text-[13px] leading-5 text-ink-2">{r.summary || '—'}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {r.dimensions.map((d) => (
                      <DimensionTile key={d.key} d={d} open={openDim === d.key} onClick={() => setOpenDim(openDim === d.key ? null : d.key)} />
                    ))}
                  </div>
                  {dim && (
                    <div className="mt-3 rounded-md border border-line bg-white p-3 text-[13px]">
                      <p className="font-semibold">{DIMENSION[dim.key]}</p>
                      <p className="mt-1 text-ink-2">{dim.finding || 'No finding.'}</p>
                      {dim.recommendation && <p className="mt-2"><span className="font-medium">Improve: </span>{dim.recommendation}</p>}
                      {dim.evidence && (
                        <p className="mt-2 rounded-sm bg-ok-soft px-2 py-1 font-mono text-[11px] text-ok-ink">
                          “{dim.evidence.text}” [{dim.evidence.start}:{dim.evidence.end}] verified
                        </p>
                      )}
                    </div>
                  )}
                  <p className="mt-3 flex items-center gap-1.5 font-mono text-[10px] text-ink-2">
                    <Gauge size={11} /> passed = 10, warning = 5, failed = 0 per dimension; Go ≥ 75, Conditional 50–74
                  </p>
                </div>
              </div>
            )}
          </Card>

          <Card
            title={<span className="inline-flex items-center gap-2"><BadgeCheck size={16} className="text-ok" />Verbatim offset inspector</span>}
            subtitle="Each quote is searched in the original text; only exact matches (ignoring case and spaces) are kept."
            action={
              result && (
                <div className="flex gap-2">
                  <Chip tone="ok">{allEvidence.length} quotes verified</Chip>
                  <Chip tone={result.stats.dropped_quotes ? 'bad' : 'gray'}>Dropped: {result.stats.dropped_quotes}</Chip>
                </div>
              )
            }
          >
            {!result ? (
              <Empty title="No document analyzed yet" />
            ) : (
              <div className="max-h-80 overflow-y-auto rounded-md border border-line bg-canvas p-3">
                <Highlighted text={result.text} evidence={allEvidence} showOffsets />
              </div>
            )}
          </Card>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                Extracted risk objects {result && <Chip>{result.risks.length} detected</Chip>}
              </h3>
              {result && canAct && (
                <Button variant="ai" disabled={!acceptable} loading={accepting} onClick={acceptAll} title="Approves pending risks that have a verified quote and good confidence">
                  Accept all verified ({acceptable})
                </Button>
              )}
            </div>
            {error && <div className="mb-2"><ErrorBanner message={error} onClose={() => setError(null)} /></div>}
            {!result ? (
              <Card><Empty title="Results appear here" /></Card>
            ) : result.risks.length === 0 ? (
              <Card><Empty title="The AI found no risks in this document" /></Card>
            ) : (
              <ul className="space-y-2">
                {result.risks.map((risk) => (
                  <li key={risk.risk_id} className="shadow-card rounded-md border border-line bg-white p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <ScoreCapsule score={risk.score} size="lg" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Mono className="font-semibold text-ai-ink">{risk.risk_id}</Mono>
                          <LevelTag score={risk.score} p={risk.probability} i={risk.impact} />
                          <StatusPill status={risk.status} />
                          {risk.needs_review && <Chip tone="warn"><AlertTriangle size={11} /> Needs review</Chip>}
                        </div>
                        <p className="mt-1.5 text-[13px] leading-5">{risk.statement}</p>
                      </div>
                      <div className="flex gap-1.5">
                        {canAct && risk.status === 'pending' && (
                          <Button variant="primary" size="sm" onClick={async () => { await api.approve(risk.risk_id); refresh() }}>
                            <CheckCircle2 size={13} /> Accept
                          </Button>
                        )}
                        <Button size="sm" onClick={() => open(risk.risk_id)}>Triage</Button>
                      </div>
                    </div>
                    {risk.evidence[0] ? (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-canvas px-3 py-1.5 font-mono text-[11px]">
                        <span className="line-clamp-1 flex-1 text-ink-2">“{risk.evidence[0].text}”</span>
                        <span className="text-ok-ink">[offset {risk.evidence[0].start}–{risk.evidence[0].end}] verified</span>
                      </div>
                    ) : (
                      <p className="mt-3 rounded-md bg-warn-soft px-3 py-1.5 font-mono text-[11px] text-warn-ink">No quote could be found in the document. Check before accepting.</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

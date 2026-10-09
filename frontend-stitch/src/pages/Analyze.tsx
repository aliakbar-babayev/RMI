import { AlertTriangle, CheckCircle2, CircleX, FileSearch, Loader2, Sparkles, TriangleAlert, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Highlighted } from '../components/RiskInspector'
import { Button, Card, Chip, Empty, ErrorBanner, Field, LevelTag, Mono, PageHeader, Ring, ScoreCapsule, StatusPill, Tabs, cx, inputCls } from '../components/ui'
import { api } from '../lib/api'
import type { Evidence, ReadinessDimension } from '../lib/api'
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
const STATUS_ICON = {
  passed: <CheckCircle2 size={15} className="text-ok" />,
  warning: <TriangleAlert size={15} className="text-warn" />,
  failed: <CircleX size={15} className="text-bad" />,
}

type Tab = 'risks' | 'readiness' | 'document'

function Dimension({ d, open, onClick }: { d: ReadinessDimension; open: boolean; onClick: () => void }) {
  return (
    <li>
      <button onClick={onClick} className={cx('flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left', open ? 'border-ink' : 'border-line hover:bg-canvas')}>
        {STATUS_ICON[d.status]}
        <span className="flex-1 text-[13px]">{DIMENSION[d.key] ?? d.key}</span>
        <span className="text-xs text-ink-2 capitalize">{d.status}</span>
      </button>
      {open && (
        <div className="mt-1 mb-2 rounded-md bg-canvas px-3 py-2.5 text-[13px] leading-5">
          <p className="text-ink-2">{d.finding || 'No finding.'}</p>
          {d.recommendation && <p className="mt-1.5"><span className="font-medium">Improve: </span>{d.recommendation}</p>}
          {d.evidence && <p className="mt-1.5 text-xs text-ok-ink">“{d.evidence.text}”</p>}
        </div>
      )}
    </li>
  )
}

export function Analyze() {
  const { refresh } = useApp()
  const { open } = useOpenRisk()
  const { data: samples } = usePoll(() => api.samples(), [], 0)
  const [text, setText] = useState('')
  const [lang, setLang] = useState('')
  const [source, setSource] = useState('')
  const [withReadiness, setWithReadiness] = useState(true)
  const [busy, setBusy] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('risks')
  const [openDim, setOpenDim] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // The shown analysis lives in the URL, so results survive navigation and can be linked.
  const [params, setParams] = useSearchParams()
  const resultId = params.get('analysis')
  const setResultId = (id: string | null) => {
    const next = new URLSearchParams(params)
    if (id) next.set('analysis', id)
    else next.delete('analysis')
    setParams(next, { replace: true })
  }
  const { data: result } = usePoll(() => (resultId ? api.analysis(resultId) : Promise.resolve(null)), [resultId])

  useEffect(() => {
    if (!busy) return
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [busy])

  const pick = (id: string) => {
    const s = samples?.find((x) => x.id === id)
    if (!s) return
    setText(s.text)
    setLang(s.language)
    setSource(s.source)
  }

  const loadFile = async (file: File) => {
    setError(null)
    if (!/\.(txt|md|json)$/i.test(file.name)) {
      setError('Only .txt, .md and .json files can be read. Paste other text directly.')
      return
    }
    setText(await file.text())
  }

  const run = async () => {
    setSeconds(0)
    setBusy(true)
    setError(null)
    try {
      const a = await api.analyze(text, lang, source.trim(), withReadiness)
      setResultId(a.analysis_id)
      setTab('risks')
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

  const evidence: Evidence[] = useMemo(() => result?.risks.flatMap((r) => r.evidence) ?? [], [result])
  const r = result?.readiness
  const tooLong = text.length > MAX_CHARS
  const acceptable = result?.risks.filter((x) => x.status === 'pending' && !x.needs_review).length ?? 0

  return (
    <>
      <PageHeader title="Project Analyzer" subtitle="Paste a project document. The AI finds the risks and checks every quote against your text." />

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* ---------- input ---------- */}
        <Card title="Document" bodyClass="p-4 sm:p-5 space-y-4">
          <div className="flex gap-2">
            <select value="" onChange={(e) => pick(e.target.value)} className={cx(inputCls, 'h-9 flex-1')} aria-label="Load a sample">
              <option value="">Load a sample…</option>
              {samples?.map((s) => (
                <option key={s.id} value={s.id}>{s.title} ({s.language.toUpperCase()})</option>
              ))}
            </select>
            <Button className="h-9" onClick={() => fileRef.current?.click()} title="Load a .txt, .md or .json file">
              <Upload size={14} /> File
            </Button>
            <input ref={fileRef} type="file" accept=".txt,.md,.json,text/plain,text/markdown,application/json" className="hidden" onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
          </div>

          <div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={14}
              placeholder="Paste sprint notes, a project plan or meeting minutes…"
              className={cx(inputCls, 'min-h-72 resize-y py-2.5 leading-6')}
            />
            <p className={cx('mt-1 text-right text-xs', tooLong ? 'font-semibold text-bad-ink' : 'text-ink-3')}>
              {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Source">
              <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. core-db" className={inputCls} />
            </Field>
            <Field label="Language">
              <select value={lang} onChange={(e) => setLang(e.target.value)} className={inputCls}>
                {LANGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </Field>
          </div>

          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={withReadiness} onChange={(e) => setWithReadiness(e.target.checked)} className="h-4 w-4 accent-ink" />
            Also score project readiness
          </label>

          <Button variant="primary" size="lg" className="w-full" disabled={!text.trim() || tooLong || busy} onClick={run}>
            {busy ? <><Loader2 size={17} className="animate-spin" /> Analyzing… {seconds}s</> : <><Sparkles size={17} /> Analyze</>}
          </Button>
          {error && <ErrorBanner message={error} onClose={() => setError(null)} />}
        </Card>

        {/* ---------- results ---------- */}
        <div className="min-w-0 space-y-4">
          {busy && !result ? (
            <Card>
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Loader2 size={28} className="animate-spin text-ai" />
                <p className="text-[15px] font-medium">Reading the document… {seconds}s</p>
                <p className="max-w-sm text-[13px] text-ink-2">Finding risks and checking each quote against your text. This usually takes 30–90 seconds.</p>
              </div>
            </Card>
          ) : !result ? (
            <Card>
              <div className="flex flex-col items-center gap-3 py-14 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ai-soft text-ai"><FileSearch size={22} /></span>
                <p className="text-[15px] font-medium">Results will appear here</p>
                <p className="max-w-sm text-[13px] text-ink-2">Load a sample or paste a document, then press Analyze.</p>
              </div>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Mono className="font-semibold">{result.analysis_id}</Mono>
                  <Chip tone="ai" mono={false}>{result.risks.length} risks</Chip>
                  {result.stats.needs_review > 0 && <Chip tone="warn" mono={false}>{result.stats.needs_review} need review</Chip>}
                  {r && <Chip tone={r.decision === 'go' ? 'ok' : r.decision === 'conditional_go' ? 'ai' : 'bad'} mono={false}>Readiness {r.score}/100</Chip>}
                </div>
                <Button variant="ai" disabled={!acceptable} loading={accepting} onClick={acceptAll} title="Approves pending risks that have a verified quote">
                  Accept all verified ({acceptable})
                </Button>
              </div>

              <Tabs
                value={tab}
                onChange={setTab}
                items={[
                  { value: 'risks' as Tab, label: 'Risks', count: result.risks.length },
                  ...(r ? [{ value: 'readiness' as Tab, label: 'Readiness' }] : []),
                  { value: 'document' as Tab, label: 'Document' },
                ]}
              />

              {tab === 'risks' && (
                result.risks.length === 0 ? (
                  <Card><Empty title="No risks found in this document" /></Card>
                ) : (
                  <ul className="space-y-2">
                    {result.risks.map((risk) => (
                      <li key={risk.risk_id} className="shadow-card rounded-md border border-line bg-white p-4">
                        <div className="flex items-start gap-3">
                          <ScoreCapsule score={risk.score} size="lg" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Mono className="font-semibold text-ai-ink">{risk.risk_id}</Mono>
                              <LevelTag score={risk.score} p={risk.probability} i={risk.impact} />
                              <StatusPill status={risk.status} />
                              {risk.needs_review && <Chip tone="warn" mono={false}><AlertTriangle size={11} /> Check</Chip>}
                            </div>
                            <p className="mt-1.5 text-[14px] leading-5">{risk.statement}</p>
                            {risk.evidence[0] ? (
                              <p className="mt-2 line-clamp-2 text-[12px] text-ink-2">“{risk.evidence[0].text}”</p>
                            ) : (
                              <p className="mt-2 text-[12px] text-warn-ink">No quote found in the document.</p>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
                            {risk.status === 'pending' && (
                              <Button variant="primary" size="sm" onClick={async () => { await api.approve(risk.risk_id); refresh() }}>Accept</Button>
                            )}
                            <Button size="sm" onClick={() => open(risk.risk_id)}>Details</Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              )}

              {tab === 'readiness' && r && (
                <Card>
                  <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
                    <div className="flex flex-col items-center gap-2">
                      <Ring size={140} stroke={12} segments={[{ value: r.score, color: DECISION_COLOR[r.decision], label: 'Score' }, { value: 100 - r.score, color: 'var(--color-line)', label: 'Remaining' }]}>
                        <span className="text-3xl font-semibold">{r.score}</span>
                        <span className="text-xs text-ink-2">of 100</span>
                      </Ring>
                      <Chip tone={r.decision === 'go' ? 'ok' : r.decision === 'conditional_go' ? 'ai' : 'bad'} mono={false} className="px-3 py-1 text-[13px]">
                        {DECISION[r.decision]}
                      </Chip>
                    </div>
                    <div className="min-w-0 flex-1">
                      {r.summary && <p className="mb-3 text-[14px] leading-6 text-ink-2">{r.summary}</p>}
                      <div className="mb-2 flex gap-3 text-xs text-ink-2">
                        <span className="inline-flex items-center gap-1">{STATUS_ICON.passed} {r.counts.passed} passed</span>
                        <span className="inline-flex items-center gap-1">{STATUS_ICON.warning} {r.counts.warning} warnings</span>
                        <span className="inline-flex items-center gap-1">{STATUS_ICON.failed} {r.counts.failed} failed</span>
                      </div>
                      <ul className="grid grid-cols-1 gap-x-3 gap-y-1.5 md:grid-cols-2">
                        {r.dimensions.map((d) => (
                          <Dimension key={d.key} d={d} open={openDim === d.key} onClick={() => setOpenDim(openDim === d.key ? null : d.key)} />
                        ))}
                      </ul>
                    </div>
                  </div>
                </Card>
              )}

              {tab === 'document' && (
                <Card subtitle={`Highlighted: ${evidence.length} quotes found word for word${result.stats.dropped_quotes ? ` · ${result.stats.dropped_quotes} AI quotes removed (not in the text)` : ''}.`}>
                  <div className="max-h-[560px] overflow-y-auto rounded-md bg-canvas p-4">
                    <Highlighted text={result.text} evidence={evidence} />
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

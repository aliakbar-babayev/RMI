import { Anchor, BadgeCheck, ChevronDown, Copy, Database, Download, Lock, RefreshCw, Search, ShieldAlert, ShieldCheck, Sigma } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AiChip, Button, Card, Chip, Empty, ErrorBanner, Loading, Mono, PageHeader, Tabs, cx, inputCls } from '../components/ui'
import { api } from '../lib/api'
import type { AuditEntry, VerifyResult } from '../lib/api'
import { usePoll, useApp } from '../lib/app'
import { CATEGORY_TABS, formatTime, shortHash } from '../lib/labels'
import { useOpenRisk } from '../lib/useOpenRisk'

type Cat = '' | keyof typeof CATEGORY_TABS

function eventTone(e: AuditEntry): 'bad' | 'warn' | 'ok' | 'ai' | 'gray' {
  if (e.event_type.startsWith('breakglass') || e.event_type.endsWith('rejected')) return 'bad'
  if (e.event_type.includes('escalat') || e.event_type.startsWith('incident')) return 'warn'
  if (e.event_type.endsWith('approved') || e.event_type.endsWith('resolved') || e.event_type.endsWith('recovered')) return 'ok'
  if (e.actor.type === 'ai') return 'ai'
  return 'gray'
}

/** One-line chain status with the re-verify button. */
function ChainStatus({ v, onVerify, busy }: { v: VerifyResult | null; onVerify: () => void; busy: boolean }) {
  const ok = v?.ok !== false
  return (
    <div className={cx('shadow-card flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border px-4 py-3', ok ? 'border-line bg-white' : 'border-red-200 bg-bad-soft')}>
      <span className={cx('flex items-center gap-2 text-[14px] font-semibold', ok ? 'text-ok-ink' : 'text-bad-ink')}>
        {ok ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
        {!v ? 'Checking…' : v.ok ? 'Chain intact' : `Chain broken at block #${v.broken_at}`}
      </span>
      {v && (
        <span className="text-[13px] text-ink-2">
          {v.ok ? v.checked : (v.broken_at ?? 1) - 1}/{v.checked} blocks verified · {v.duration_ms} ms
        </span>
      )}
      <Button size="sm" onClick={onVerify} loading={busy} className="ml-auto">
        <RefreshCw size={13} /> Re-verify
      </Button>
    </div>
  )
}

function Safeguards() {
  const [open, setOpen] = useState(false)
  const items: { icon: ReactNode; title: string; text: ReactNode }[] = [
    { icon: <Database size={15} />, title: 'Database blocks changes', text: <>SQLite <Mono>BEFORE UPDATE</Mono> / <Mono>BEFORE DELETE</Mono> triggers refuse any change to a saved block.</> },
    { icon: <Sigma size={15} />, title: 'Each block hashes the previous one', text: <>hash = SHA-256 of the block’s fields (sorted JSON) plus the previous block’s hash.</> },
    { icon: <Lock size={15} />, title: 'One writer at a time', text: <>Blocks are appended one by one, and a unique index on <Mono>prev_hash</Mono> rejects any fork.</> },
  ]
  return (
    <div className="mb-5">
      <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ai-ink hover:underline">
        <ChevronDown size={14} className={cx('transition-transform', open && 'rotate-180')} /> How is the log protected?
      </button>
      {open && (
        <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          {items.map((it) => (
            <li key={it.title} className="rounded-md border border-line bg-white p-3">
              <p className="flex items-center gap-2 text-[13px] font-semibold"><span className="text-ai">{it.icon}</span>{it.title}</p>
              <p className="mt-1 text-[12px] leading-5 text-ink-2">{it.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ProofInspector({ eventId }: { eventId: number }) {
  const { data: p, error } = usePoll(() => api.proof(eventId), [eventId], 0)
  const [showRaw, setShowRaw] = useState(false)
  const [copied, setCopied] = useState(false)
  if (error) return <ErrorBanner message={error} />
  if (!p) return <Loading />
  const good = p.hash_matches && p.prev_link_ok
  const c = p.components
  const rows: [string, string][] = [
    ['Event', String(c.event_type)],
    ['Entity', `${c.entity_type} ${c.entity_id}`],
    ['Actor', `${c.actor_type}${c.actor_role ? ` (${c.actor_role})` : ''}`],
    ['Time', formatTime(String(c.recorded_at))],
    ['Previous hash', String(c.prev_hash)],
    ['Stored hash', p.stored_hash],
    ['Recomputed', p.recomputed_hash],
  ]
  return (
    <div className="space-y-3">
      <div className={cx('rounded-md border p-3', good ? 'border-emerald-200 bg-ok-soft' : 'border-red-200 bg-bad-soft')}>
        <p className={cx('flex items-center gap-1.5 text-[14px] font-semibold', good ? 'text-ok-ink' : 'text-bad-ink')}>
          {good ? <BadgeCheck size={16} /> : <ShieldAlert size={16} />} {good ? 'Block verified' : 'Block failed verification'}
        </p>
        <ul className="mt-1 space-y-0.5 text-[12px] text-ink-2">
          <li>{p.hash_matches ? '✓' : '✗'} Recomputed hash equals the stored hash</li>
          <li>{p.prev_link_ok ? '✓' : '✗'} Linked to {p.previous_event_id ? `block #${p.previous_event_id}` : 'the genesis value'}</li>
        </ul>
      </div>

      <dl className="divide-y divide-line rounded-md border border-line">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 px-3 py-2 text-[12px]">
            <dt className="shrink-0 text-ink-2">{k}</dt>
            <dd className={cx('truncate font-mono text-[11px]', k === 'Recomputed' && (p.hash_matches ? 'text-ok-ink' : 'text-bad-ink'))} title={v}>{v}</dd>
          </div>
        ))}
      </dl>

      <div>
        <button onClick={() => setShowRaw((s) => !s)} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ai-ink hover:underline">
          <ChevronDown size={13} className={cx('transition-transform', showRaw && 'rotate-180')} />
          {showRaw ? 'Hide' : 'Show'} exact data hashed ({p.payload_bytes} bytes)
        </button>
        {showRaw && (
          <div className="mt-2">
            <pre className="max-h-64 overflow-auto rounded-md bg-code p-3 font-mono text-[11px] leading-5 text-[#e2e8f0]">{JSON.stringify(JSON.parse(p.canonical_payload), null, 2)}</pre>
            <button
              onClick={() => { navigator.clipboard?.writeText(p.canonical_payload).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }}
              className="mt-1 inline-flex items-center gap-1 text-[11px] text-ink-2 hover:text-ink"
            >
              <Copy size={11} /> {copied ? 'Copied' : 'Copy JSON'}
            </button>
          </div>
        )}
      </div>

      <a href={api.proofDownloadUrl(p.event_id)} className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-line bg-white text-[13px] font-medium hover:bg-canvas">
        <Download size={14} /> Download proof (.json)
      </a>
    </div>
  )
}

export function AuditTrail() {
  const { refresh } = useApp()
  const { open } = useOpenRisk()
  const [params, setParams] = useSearchParams()
  const [cat, setCat] = useState<Cat>('')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [verifying, setVerifying] = useState(false)
  const verify = usePoll(() => api.verify(), [], 10000)
  const stats = usePoll(() => api.auditStats(), [])
  const list = usePoll(() => api.audit({ category: cat || undefined, search: query || undefined, limit: 300 }), [cat, query])
  const head = stats.data?.head?.event_id
  const selected = Number(params.get('event')) || head || null

  const select = (id: number) => {
    const next = new URLSearchParams(params)
    next.set('event', String(id))
    setParams(next)
  }
  const reverify = async () => {
    setVerifying(true)
    try { await api.verify(); refresh() } finally { setVerifying(false) }
  }
  const by = stats.data?.by_category ?? {}

  return (
    <>
      <PageHeader title="Audit Trail" subtitle="Every AI proposal and decision, linked by SHA-256 so changes are detected." />

      <div className="mb-3">
        <ChainStatus v={verify.data} onVerify={reverify} busy={verifying} />
      </div>
      <Safeguards />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-7">
          <div className="mb-3 space-y-2">
            <form className="relative" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()) }}>
              <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-3" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by ID (e.g. R-001) or hash, then Enter" className={`${inputCls} h-9 pl-8`} />
            </form>
            <Tabs
              value={cat}
              onChange={(v) => setCat(v)}
              items={[
                { value: '' as Cat, label: 'All', count: stats.data?.total },
                ...(Object.keys(CATEGORY_TABS) as (keyof typeof CATEGORY_TABS)[]).map((k) => ({ value: k as Cat, label: CATEGORY_TABS[k], count: by[k] ?? 0 })),
              ]}
            />
            {query && (
              <p className="text-xs text-ink-2">
                Filter: <Mono>{query}</Mono> <button className="ml-2 text-ai-ink hover:underline" onClick={() => { setQuery(''); setSearch('') }}>clear</button>
              </p>
            )}
          </div>

          {list.error && <ErrorBanner message={list.error} />}
          {!list.data && !list.error && <Loading />}
          {list.data && list.data.length === 0 && <Card><Empty title="No blocks match" /></Card>}

          <ol className="space-y-2">
            {list.data?.map((e) => (
              <li key={e.event_id}>
                <button
                  onClick={() => select(e.event_id)}
                  className={cx(
                    'shadow-card w-full rounded-md border bg-white px-4 py-3 text-left transition',
                    selected === e.event_id ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-line-strong',
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone={eventTone(e)}>{e.event_type}</Chip>
                    <Mono className="font-semibold">{e.entity_id}</Mono>
                    <span className="text-[12px] text-ink-2">
                      by {e.actor.type === 'ai' ? <AiChip /> : (e.actor.role ?? e.actor.type)}
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                      {e.event_id === head && <Chip tone="ok">Latest</Chip>}
                      <Mono className="text-ink-3">#{e.event_id}</Mono>
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[12px] text-ink-2">
                    <span>{formatTime(e.recorded_at)}</span>
                    <span className="font-mono text-[11px]">
                      {shortHash(e.prev_hash)} → <span className="text-ai-ink">{shortHash(e.hash)}</span>
                    </span>
                  </div>
                  {e.entity_type === 'risk' && (
                    <span role="link" onClick={(ev) => { ev.stopPropagation(); open(e.entity_id) }} className="mt-1 inline-block text-[11px] text-ai-ink hover:underline">
                      Open {e.entity_id}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ol>

          {stats.data && (
            <button onClick={() => select(1)} className="mt-3 flex w-full items-center gap-3 rounded-md border border-dashed border-line px-4 py-3 text-left hover:bg-white">
              <Anchor size={16} className="text-ink-2" />
              <span className="text-[13px]">
                <span className="font-medium">First block (#1)</span>
                <span className="text-ink-2"> · starts from an all-zero previous hash</span>
              </span>
            </button>
          )}
        </div>

        <div className="xl:col-span-5">
          <div className="xl:sticky xl:top-[88px]">
            <Card
              title={<span className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-ai" />Block check</span>}
              subtitle="Recomputed by the backend from the stored data."
              action={selected && <Chip>#{selected}</Chip>}
            >
              {selected ? <ProofInspector eventId={selected} /> : <Empty title="No blocks yet" />}
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}

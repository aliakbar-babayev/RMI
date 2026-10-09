import { Anchor, BadgeCheck, Copy, Database, Download, Link2, Lock, RefreshCw, Search, ShieldAlert, ShieldCheck, Sigma } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AiChip, Button, Caption, Card, Chip, Empty, ErrorBanner, Loading, Mono, PageHeader, Tabs, cx, inputCls } from '../components/ui'
import { api } from '../lib/api'
import type { AuditEntry, VerifyResult } from '../lib/api'
import { usePoll, useApp } from '../lib/app'
import { CATEGORY_TABS, shortHash } from '../lib/labels'
import { useOpenRisk } from '../lib/useOpenRisk'

type Cat = '' | keyof typeof CATEGORY_TABS

function eventTone(e: AuditEntry): 'bad' | 'warn' | 'ok' | 'ai' | 'gray' {
  if (e.event_type.startsWith('breakglass') || e.event_type.endsWith('rejected')) return 'bad'
  if (e.event_type.includes('escalat') || e.event_type.startsWith('incident')) return 'warn'
  if (e.event_type.endsWith('approved') || e.event_type.endsWith('resolved') || e.event_type.endsWith('recovered')) return 'ok'
  if (e.actor.type === 'ai') return 'ai'
  return 'gray'
}

function Safeguard({ rule, icon, title, children, tone }: { rule: string; icon: ReactNode; title: string; children: ReactNode; tone: string }) {
  return (
    <div className={cx('shadow-card rounded-md border border-line border-l-4 bg-white p-4', tone)}>
      <div className="flex items-center justify-between">
        <Chip tone="ai">{rule}</Chip>
        <span className="text-ai">{icon}</span>
      </div>
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      <div className="mt-1 text-[13px] leading-5 text-ink-2">{children}</div>
    </div>
  )
}

function LedgerState({ v, onVerify, busy }: { v: VerifyResult | null; onVerify: () => void; busy: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-5 rounded-md border border-line bg-well/60 p-4">
      <div className="flex items-center gap-3">
        <span className={cx('flex h-10 w-10 items-center justify-center rounded-md text-white', v?.ok === false ? 'bg-bad' : 'bg-ink')}>
          {v?.ok === false ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
        </span>
        <div>
          <Caption className={v?.ok === false ? 'text-bad-ink' : 'text-ok-ink'}>Ledger invariant state</Caption>
          <p className="font-mono text-sm font-semibold">{v ? (v.ok ? 'CHAIN INTEGRITY 100% VALID' : `BROKEN AT BLOCK #${v.broken_at}`) : '…'}</p>
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-4 font-mono text-[11px]">
        <div><dt className="text-ink-2">Verified blocks</dt><dd className="mt-1 text-[13px]">{v ? `${v.ok ? v.checked : (v.broken_at ?? 1) - 1} / ${v.checked}` : '—'}</dd></div>
        <div><dt className="text-ink-2">Broken</dt><dd className={cx('mt-1 text-[13px]', v?.ok === false && 'text-bad-ink')}>{v ? (v.ok ? 0 : 1) : '—'}</dd></div>
        <div><dt className="text-ink-2">Verify time</dt><dd className="mt-1 text-[13px] text-ai-ink">{v?.duration_ms ?? '—'} ms</dd></div>
      </dl>
      <Button variant="primary" onClick={onVerify} loading={busy}><RefreshCw size={14} /> Re-verify entire chain</Button>
    </div>
  )
}

function ProofInspector({ eventId }: { eventId: number }) {
  const { data: p, error } = usePoll(() => api.proof(eventId), [eventId], 0)
  const [copied, setCopied] = useState(false)
  if (error) return <ErrorBanner message={error} />
  if (!p) return <Loading />
  const pretty = JSON.stringify(JSON.parse(p.canonical_payload), null, 2)
  const rows: [string, string][] = [
    ['prev_hash', p.components.prev_hash as string],
    ['entity', `${p.components.entity_type} ${p.components.entity_id}`],
    ['event_type', p.components.event_type as string],
    ['actor', `${p.components.actor_type}${p.components.actor_role ? ` (${p.components.actor_role})` : ''}`],
    ['recorded_at', p.components.recorded_at as string],
    ['stored_hash', p.stored_hash],
    ['recomputed', p.recomputed_hash],
  ]
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-line bg-canvas p-3">
        <div className="mb-2 flex items-center justify-between">
          <Caption>Canonical component map</Caption>
          <Chip tone={p.hash_matches && p.prev_link_ok ? 'ok' : 'bad'}>{p.hash_matches && p.prev_link_ok ? 'Byte validated' : 'Mismatch'}</Chip>
        </div>
        <dl className="divide-y divide-line rounded-md border border-line bg-white">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 px-2.5 py-1.5 font-mono text-[11px]">
              <dt className="shrink-0 text-ink-2">{k}</dt>
              <dd className={cx('truncate', k === 'recomputed' && (p.hash_matches ? 'text-ok-ink' : 'text-bad-ink'), k === 'event_type' && 'text-ai-ink')} title={v}>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <Caption>Canonical payload (exact bytes hashed · {p.payload_bytes} bytes)</Caption>
          <button
            onClick={() => { navigator.clipboard?.writeText(p.canonical_payload).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }}
            className="inline-flex items-center gap-1 font-mono text-[11px] text-ai-ink hover:underline"
          >
            <Copy size={11} /> {copied ? 'Copied' : 'Copy JSON'}
          </button>
        </div>
        <pre className="max-h-72 overflow-auto rounded-md bg-ink p-3 font-mono text-[11px] leading-5 text-slate-200">{pretty}</pre>
      </div>
      <div className="rounded-md border border-line bg-canvas p-3 text-[13px]">
        <p className="flex items-center gap-1.5 font-semibold">
          {p.hash_matches && p.prev_link_ok ? <BadgeCheck size={15} className="text-ok" /> : <ShieldAlert size={15} className="text-bad" />}
          {p.hash_matches && p.prev_link_ok ? 'Block verified' : 'Block failed verification'}
        </p>
        <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-ink-2">
          <li>{p.hash_matches ? '✓' : '✗'} SHA-256 of the payload equals the stored hash</li>
          <li>{p.prev_link_ok ? '✓' : '✗'} prev_hash equals {p.previous_event_id ? `block #${p.previous_event_id}'s hash` : 'the genesis value (64 zeros)'}</li>
          <li>{p.algorithm}</li>
        </ul>
        <a href={api.proofDownloadUrl(p.event_id)} className="mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-line bg-white text-[13px] font-medium hover:bg-canvas">
          <Download size={14} /> Export proof bundle (.json)
        </a>
      </div>
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
  const contiguous = !cat && !query
  const by = stats.data?.by_category ?? {}

  return (
    <>
      <PageHeader
        caption="Module 03 · audit integrity · GET /audit/verify"
        title="Cryptographic Audit Trail & Integrity Ledger"
        subtitle="Append-only SHA-256 hash chain. Every AI proposal and human decision is a block that includes the previous block's hash, so any edit or deletion of past entries is detected."
        aside={<LedgerState v={verify.data} onVerify={reverify} busy={verifying} />}
      />

      <Caption className="mb-3">Safeguards (what actually protects the ledger)</Caption>
      <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Safeguard rule="Rule 01" icon={<Database size={16} />} title="Database-level trigger defense" tone="border-l-ink">
          SQLite <Mono>BEFORE UPDATE</Mono> and <Mono>BEFORE DELETE</Mono> triggers abort any change to a committed block.
          <pre className="mt-2 overflow-x-auto rounded-md bg-canvas p-2 font-mono text-[11px] text-ink">CREATE TRIGGER audit_no_update{'\n'}BEFORE UPDATE ON audit_events …</pre>
        </Safeguard>
        <Safeguard rule="Rule 02" icon={<Sigma size={16} />} title="Hash formula" tone="border-l-ai">
          Canonical JSON (sorted keys, no spaces, UTF-8) of the block’s fields plus the previous hash.
          <pre className="mt-2 overflow-x-auto rounded-md bg-canvas p-2 font-mono text-[11px] text-ink">hash = SHA256(entity | event_type |{'\n'}  actor | data | recorded_at | prev_hash)</pre>
        </Safeguard>
        <Safeguard rule="Rule 03" icon={<Lock size={16} />} title="Concurrency serialization" tone="border-l-ink">
          One writer at a time appends to the chain, and a unique index on <Mono>prev_hash</Mono> makes the database reject any fork.
        </Safeguard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-7">
          <div className="shadow-card mb-3 flex flex-wrap items-center gap-2 rounded-md border border-line bg-white p-2">
            <form className="relative w-full" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()) }}>
              <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-3" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by block hash or entity ID (e.g. R-001), Enter" className={`${inputCls} h-8 pl-8`} />
            </form>
            <Tabs
              value={cat}
              onChange={(v) => setCat(v)}
              items={[
                { value: '' as Cat, label: 'All events', count: stats.data?.total },
                ...(Object.keys(CATEGORY_TABS) as (keyof typeof CATEGORY_TABS)[]).map((k) => ({ value: k as Cat, label: CATEGORY_TABS[k], count: by[k] ?? 0 })),
              ]}
            />
          </div>
          {query && (
            <p className="mb-2 font-mono text-[11px] text-ink-2">
              Filter: {query} <button className="ml-2 text-ai-ink hover:underline" onClick={() => { setQuery(''); setSearch('') }}>clear</button>
            </p>
          )}
          {list.error && <ErrorBanner message={list.error} />}
          {!list.data && !list.error && <Loading />}
          {list.data && list.data.length === 0 && <Card><Empty title="No blocks match" /></Card>}
          <ol>
            {list.data?.map((e, idx) => (
              <li key={e.event_id}>
                <button
                  onClick={() => select(e.event_id)}
                  className={cx('shadow-card relative w-full rounded-md border bg-white p-4 text-left transition', selected === e.event_id ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-line-strong')}
                >
                  {e.event_id === head && <span className="absolute -top-2.5 right-3 rounded-sm bg-ink px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">● HEAD BLOCK #{e.event_id}</span>}
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone={eventTone(e)}>{e.event_type}</Chip>
                    <span className="text-[13px] font-medium">Entity: <Mono>{e.entity_id}</Mono></span>
                    <span className="font-mono text-[11px] text-ink-2">· {e.recorded_at}</span>
                    {e.event_id !== head && <Chip className="ml-auto">Block #{e.event_id}</Chip>}
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 rounded-md bg-canvas p-2.5 font-mono text-[11px] sm:grid-cols-2">
                    <div>
                      <p className="text-ink-2">↳ Parent prev-hash</p>
                      <p>{shortHash(e.prev_hash)}</p>
                    </div>
                    <div>
                      <p className="text-ink-2">Committed hash (SHA-256)</p>
                      <p className="text-ai-ink">{shortHash(e.hash)}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px]">
                    <span className="text-ink-2">
                      Actor: {e.actor.type === 'ai' ? <AiChip /> : <span className="text-ink">{e.actor.role ?? e.actor.type}</span>} <span className="font-mono text-[11px]">[{e.actor.type}]</span>
                    </span>
                    {e.entity_type === 'risk' && (
                      <span role="link" onClick={(ev) => { ev.stopPropagation(); open(e.entity_id) }} className="font-mono text-[11px] text-ai-ink hover:underline">Open {e.entity_id}</span>
                    )}
                  </div>
                  {Object.keys(e.data).length > 0 && (
                    <p className="mt-2 truncate rounded-md border border-line px-2 py-1 font-mono text-[11px] text-ink-2">{JSON.stringify(e.data)}</p>
                  )}
                </button>
                {contiguous && idx < list.data!.length - 1 && list.data![idx + 1].event_id === e.event_id - 1 && (
                  <div className="flex justify-center py-1.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-well px-2.5 py-0.5 font-mono text-[10px] text-ink-2">
                      <Link2 size={11} /> prev_hash → block #{e.event_id - 1}
                    </span>
                  </div>
                )}
                {(!contiguous || idx === list.data!.length - 1) && <div className="h-2" />}
              </li>
            ))}
          </ol>
          {stats.data && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-line bg-well/60 p-4">
              <Anchor size={18} className="text-ink-2" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium">Genesis anchor</p>
                <p className="truncate font-mono text-[11px] text-ink-2">Block #1 prev_hash: {stats.data.genesis_prev_hash}</p>
              </div>
              <Button onClick={() => select(1)}>Inspect block #1</Button>
            </div>
          )}
        </div>

        <div className="xl:col-span-5">
          <div className="xl:sticky xl:top-[120px]">
            <Card
              title={<span className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-ai" />Cryptographic proof inspector</span>}
              subtitle="The backend recomputes this block’s hash from its stored fields and checks the link to the previous block."
              action={selected && <Chip>Block #{selected}</Chip>}
            >
              {selected ? <ProofInspector eventId={selected} /> : <Empty title="No blocks yet" />}
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}

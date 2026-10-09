import { AlertTriangle, Check, ChevronDown, CircleDashed, Clock, Loader2, Sparkles, X, XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { Level, Status } from '../lib/api'
import { LEVEL, STATUS, levelFor } from '../lib/labels'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export const LEVEL_SOLID: Record<Level, string> = {
  low: 'bg-lvl-low text-on-accent',
  medium: 'bg-lvl-medium text-ink', // yellow is too light for white text
  high: 'bg-lvl-high text-on-accent',
  critical: 'bg-lvl-critical text-on-accent',
}
export const LEVEL_SOFT: Record<Level, string> = {
  low: 'bg-lvl-low-soft text-ok-ink',
  medium: 'bg-lvl-medium-soft text-warn-ink',
  high: 'bg-lvl-high-soft text-lvl-high',
  critical: 'bg-lvl-critical-soft text-lvl-critical',
}
export const LEVEL_TEXT: Record<Level, string> = {
  low: 'text-ok-ink',
  medium: 'text-warn-ink',
  high: 'text-lvl-high',
  critical: 'text-lvl-critical',
}
export const LEVEL_BAR: Record<Level, string> = {
  low: 'bg-lvl-low',
  medium: 'bg-lvl-medium',
  high: 'bg-lvl-high',
  critical: 'bg-lvl-critical',
}

/** Monospace identifier (risk IDs, hashes, offsets): machine-made values look different from prose. */
export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('font-mono text-[12px] tracking-[0.02em]', className)}>{children}</span>
}

/** Score capsule: number always printed, color by level. */
export function ScoreCapsule({ score, label = false, size = 'md' }: { score: number; label?: boolean; size?: 'md' | 'lg' }) {
  const level = levelFor(score)
  return (
    <span
      title={`${LEVEL[level]} · score ${score}`}
      className={cx(
        'inline-flex items-center justify-center gap-1 rounded-full font-mono font-semibold whitespace-nowrap',
        LEVEL_SOLID[level],
        size === 'md' ? 'h-6 min-w-6 px-2 text-[12px]' : 'h-10 min-w-10 px-2.5 text-base',
      )}
    >
      {score}
      {label && <span className="text-[10px] font-medium uppercase opacity-90">{LEVEL[level]}</span>}
    </span>
  )
}

/** "CRITICAL · P5 × I4" chip. */
export function LevelTag({ score, p, i }: { score: number; p?: number; i?: number }) {
  const level = levelFor(score)
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase', LEVEL_SOFT[level])}>
      {LEVEL[level]}
      {p !== undefined && i !== undefined && <> · P{p} × I{i}</>}
    </span>
  )
}

const STATUS_STYLE: Record<Status, { cls: string; icon: ReactNode }> = {
  pending: { cls: 'border-line bg-well text-ink-2', icon: <CircleDashed size={11} /> },
  edited: { cls: 'border-sky-200 bg-sky-50 text-sky-700', icon: <Clock size={11} /> },
  approved: { cls: 'border-emerald-200 bg-ok-soft text-ok-ink', icon: <Check size={11} /> },
  escalated: { cls: 'border-amber-200 bg-warn-soft text-warn-ink', icon: <AlertTriangle size={11} /> },
  resolved: { cls: 'border-emerald-300 bg-emerald-100 text-ok-ink', icon: <Check size={11} /> },
  rejected: { cls: 'border-line bg-well text-ink-3 line-through', icon: <XCircle size={11} /> },
}

export function StatusPill({ status }: { status: Status }) {
  const s = STATUS_STYLE[status]
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium', s.cls)}>
      {s.icon}
      {STATUS[status]}
    </span>
  )
}

type Tone = 'gray' | 'ok' | 'warn' | 'bad' | 'ai' | 'ink'
const TONES: Record<Tone, string> = {
  gray: 'border-line bg-well text-ink-2',
  ok: 'border-emerald-200 bg-ok-soft text-ok-ink',
  warn: 'border-amber-200 bg-warn-soft text-warn-ink',
  bad: 'border-red-200 bg-bad-soft text-bad-ink',
  ai: 'border-ai-line bg-ai-soft text-ai-ink',
  ink: 'border-ink bg-ink text-white',
}

/** Small bordered chip; mono by default (identity / telemetry markers). */
export function Chip({ children, tone = 'gray', mono = true, className }: { children: ReactNode; tone?: Tone; mono?: boolean; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-[11px] font-medium',
        mono && 'font-mono uppercase tracking-[0.02em]',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function AiChip({ label = 'AI' }: { label?: string }) {
  return (
    <Chip tone="ai">
      <Sparkles size={11} />
      {label}
    </Chip>
  )
}

export function Dot({ tone }: { tone: 'ok' | 'warn' | 'bad' | 'gray' | 'ai' }) {
  const c = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', gray: 'bg-ink-3', ai: 'bg-ai' }[tone]
  return <span className={cx('inline-block h-2 w-2 shrink-0 rounded-full', c)} />
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ai' | 'danger' | 'danger-soft' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}) {
  const variants = {
    primary: 'bg-ink text-white border-ink hover:opacity-85',
    secondary: 'bg-white text-ink border-line hover:bg-canvas',
    ai: 'bg-ai-soft text-ai-ink border-ai-line hover:bg-indigo-100',
    danger: 'bg-bad text-on-accent border-bad hover:opacity-90',
    'danger-soft': 'bg-white text-bad-ink border-red-200 hover:bg-bad-soft',
    ghost: 'bg-transparent text-ink-2 border-transparent hover:bg-well hover:text-ink',
  }
  const sizes = { sm: 'h-7 px-2.5 text-xs', md: 'h-8 px-3 text-[13px]', lg: 'h-11 px-5 text-[15px]' }
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        sizes[size],
        variants[variant],
        className,
      )}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}

export function Caption({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('font-mono text-[11px] tracking-[0.06em] text-ink-2 uppercase', className)}>{children}</p>
}

export function Card({ title, caption, subtitle, action, children, className, bodyClass }: {
  title?: ReactNode
  caption?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClass?: string
}) {
  return (
    <section className={cx('shadow-card rounded-md border border-line bg-white', className)}>
      {(title || caption || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5">
          <div className="min-w-0">
            {caption && <Caption className="mb-1">{caption}</Caption>}
            {title && <h3 className="text-base font-semibold tracking-[-0.01em] text-ink">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-[13px] leading-[18px] text-ink-2">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cx('p-4 sm:p-5', bodyClass)}>{children}</div>
    </section>
  )
}

export function PageHeader({ title, subtitle, actions, aside }: {
  caption?: string
  title: string
  subtitle?: string
  actions?: ReactNode
  aside?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div className="min-w-0">
        <h1 className="text-[28px] leading-9 font-semibold tracking-[-0.02em] text-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm leading-5 text-ink-2">{subtitle}</p>}
        {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
      </div>
      {aside}
    </div>
  )
}

/** Stat tile: mono caption, big value, a note and an optional bar. */
export function StatTile({ label, value, unit, note, chip, bar, barTone = 'ink' }: {
  label: string
  value: ReactNode
  unit?: string
  note?: ReactNode
  chip?: ReactNode
  bar?: number | null
  barTone?: 'ink' | 'ok' | 'warn' | 'bad' | 'ai'
}) {
  const barCls = { ink: 'bg-ink', ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', ai: 'bg-ai' }[barTone]
  return (
    <div className="shadow-card flex flex-col rounded-md border border-line bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <Caption>{label}</Caption>
        {chip}
      </div>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="text-[28px] leading-none font-semibold tracking-tight text-ink">{value}</span>
        {unit && <span className="text-[13px] text-ink-2">{unit}</span>}
      </p>
      {note && <p className="mt-2 font-mono text-[11px] leading-4 text-ink-2">{note}</p>}
      {bar !== undefined && bar !== null && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-well">
          <div className={cx('h-full rounded-full', barCls)} style={{ width: `${Math.max(0, Math.min(100, bar))}%` }} />
        </div>
      )}
    </div>
  )
}

/** Ring gauge made of segments (part-to-whole for a few parts), center text supplied by caller. */
export function Ring({ segments, size = 120, stroke = 12, children }: {
  segments: { value: number; color: string; label: string }[]
  size?: number
  stroke?: number
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const total = segments.reduce((s, x) => s + x.value, 0)
  const visible = segments.filter((x) => x.value > 0)
  let offset = 0
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: 'var(--color-well)' }} strokeWidth={stroke} />
        {total > 0 &&
          visible.map((s) => {
            const len = (s.value / total) * c
            const gap = visible.length > 1 ? 2 : 0 // 2px surface gap between segments
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                style={{ stroke: s.color }}
                strokeWidth={stroke}
                strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
                strokeDashoffset={-offset}
              >
                <title>{`${s.label}: ${s.value}`}</title>
              </circle>
            )
            offset += len
            return el
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string; value?: ReactNode }[] }) {
  return (
    <ul className="space-y-1.5 text-[13px]">
      {items.map((it) => (
        <li key={it.label} className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 text-ink-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: it.color }} />
            {it.label}
          </span>
          {it.value !== undefined && <span className="font-mono text-[12px] text-ink">{it.value}</span>}
        </li>
      ))}
    </ul>
  )
}

/** Filter trigger like "Status: All ⌄". */
export function FilterSelect<T extends string>({ label, value, options, onChange, allLabel = 'All' }: {
  label: string
  value: T | ''
  options: { value: T; label: string }[]
  onChange: (v: T | '') => void
  allLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  const selected = options.find((o) => o.value === value)
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cx(
          'inline-flex h-8 items-center gap-1.5 rounded-md border bg-white px-2.5 text-[13px]',
          selected ? 'border-ink' : 'border-line hover:bg-canvas',
        )}
      >
        <span className="font-mono text-[11px] text-ink-2">{label}:</span>
        <span className="font-medium text-ink">{selected ? selected.label : allLabel}</span>
        <ChevronDown size={14} className="text-ink-3" />
      </button>
      {open && (
        <div className="shadow-pop absolute left-0 z-30 mt-1 min-w-44 rounded-md border border-line-strong bg-white py-1">
          {[{ value: '' as T | '', label: allLabel }, ...options].map((o) => (
            <button
              key={o.value || '_all'}
              type="button"
              onClick={() => {
                onChange(o.value)
                setOpen(false)
              }}
              className="flex w-full items-center justify-between gap-4 px-3 py-1.5 text-left text-[13px] hover:bg-canvas"
            >
              {o.label}
              {o.value === value && <Check size={13} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, items }: {
  value: T
  onChange: (v: T) => void
  items: { value: T; label: string; count?: number }[]
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cx(
            'inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium',
            value === t.value ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:bg-canvas',
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="font-mono text-[11px] opacity-80">({t.count})</span>}
        </button>
      ))}
    </div>
  )
}

export function ErrorBanner({ message, onClose }: { message: string; onClose?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md border border-red-200 bg-bad-soft px-3 py-2 text-[13px] text-bad-ink">
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      <span className="flex-1">{message}</span>
      {onClose && (
        <button onClick={onClose} aria-label="Dismiss" className="text-red-400 hover:text-bad-ink">
          <X size={14} />
        </button>
      )}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-4 py-10 text-center">
      <p className="text-[13px] font-medium text-ink">{title}</p>
      {children && <div className="max-w-sm text-xs text-ink-2">{children}</div>}
    </div>
  )
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-xs text-ink-2">
      <Loader2 size={14} className="animate-spin" /> {label}
    </div>
  )
}

export function Modal({ title, onClose, children, footer, wide = false }: {
  title: string
  onClose: () => void
  children: ReactNode
  footer: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0f172a]/40 p-4" onMouseDown={onClose}>
      <div className={cx('shadow-pop w-full rounded-md border border-line-strong bg-white', wide ? 'max-w-xl' : 'max-w-md')} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-ink-3 hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>
      </div>
    </div>
  )
}

export const inputCls =
  'w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px] text-ink outline-none placeholder:text-ink-3 focus:border-ink'

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[11px] tracking-[0.04em] text-ink-2 uppercase">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-3">{hint}</span>}
    </label>
  )
}

/** Wide tables scroll inside their card, never the page. */
export function TableWrap({ children, minWidth = 760 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="shadow-card overflow-x-auto rounded-md border border-line bg-white">
      <table className="w-full border-collapse text-left" style={{ minWidth }}>
        {children}
      </table>
    </div>
  )
}

export const th = 'border-b border-line bg-well/60 px-3 py-2.5 font-mono text-[11px] font-medium tracking-[0.04em] text-ink-2 uppercase'
export const td = 'border-b border-well px-3 py-3 align-middle text-[13px] text-ink'

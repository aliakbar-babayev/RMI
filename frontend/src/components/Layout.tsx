import { BadgeCheck, Lock, ShieldAlert, ShieldCheck } from 'lucide-react'
import { NavLink, Outlet, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Role } from '../lib/api'
import { usePoll, useApp } from '../lib/app'
import { ROLE } from '../lib/labels'
import { RiskInspector } from './RiskInspector'
import { cx } from './ui'

const NAV = [
  { to: '/', label: 'Overview & Analytics' },
  { to: '/risks', label: 'Risk Register' },
  { to: '/analyze', label: 'Project Analyzer' },
  { to: '/incidents', label: 'Incidents & Blast Radius' },
  { to: '/escalations', label: 'Escalations' },
  { to: '/audit', label: 'Audit Trail' },
]

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink text-white">
        <ShieldCheck size={18} />
      </span>
      <div className="leading-tight">
        <p className="text-base font-semibold tracking-tight text-ink">RMAI</p>
        <p className="hidden font-mono text-[10px] tracking-[0.04em] text-ink-2 uppercase 2xl:block">Evidence-backed risk assurance</p>
      </div>
    </div>
  )
}

function ChainChip() {
  const { data, error } = usePoll(() => api.verify(), [], 15000)
  if (error || !data) return null
  return (
    <span
      className={cx(
        'hidden items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] lg:inline-flex',
        data.ok ? 'bg-well text-ink' : 'bg-bad-soft text-bad-ink',
      )}
      title="Recomputed from every audit entry"
    >
      {data.ok ? <BadgeCheck size={14} className="text-ok" /> : <ShieldAlert size={14} />}
      {data.ok ? `SHA-256 chain verified: ${data.checked} blocks` : `Chain broken at #${data.broken_at}`}
    </span>
  )
}

function StatusStrip() {
  const health = usePoll(() => api.health(), [], 15000)
  const verify = usePoll(() => api.verify(), [], 15000)
  const online = !!health.data && !health.error
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-line bg-well/70 px-4 py-1 font-mono text-[11px] text-ink-2 sm:px-6">
      <span className="inline-flex items-center gap-1.5">
        <Lock size={12} className="text-ai" />
        Verbatim evidence verification enabled · AI recommends, people decide
      </span>
      <span className="flex items-center gap-4">
        <span className="inline-flex items-center gap-1.5">
          <span className={cx('h-1.5 w-1.5 rounded-full', online ? 'bg-ok' : 'bg-bad')} />
          {online ? `Model ${health.data!.model}` : 'Backend offline'}
        </span>
        {verify.data && (
          <span>
            Audit state: <strong className={verify.data.ok ? 'text-ink' : 'text-bad-ink'}>{verify.data.ok ? 'VALID' : 'BROKEN'}</strong>
          </span>
        )}
      </span>
    </div>
  )
}

export function Layout() {
  const { role, setRole } = useApp()
  const [params] = useSearchParams()
  const openRisk = params.get('risk')

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-white shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-6">
            <Logo />
            <nav className="hidden items-center gap-1 lg:flex">
              {NAV.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    cx(
                      'rounded-md px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors',
                      isActive ? 'bg-ink text-white' : 'text-ink-2 hover:bg-well hover:text-ink',
                    )
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ChainChip />
            <label className="flex h-8 items-center gap-1.5 rounded-md bg-well pl-2.5 font-mono text-[11px] text-ink-2">
              X-Role:
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="h-full rounded-r-md bg-transparent pr-2 font-sans text-[13px] font-semibold text-ink outline-none"
              >
                {(Object.keys(ROLE) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE[r]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-2 lg:hidden">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cx('shrink-0 rounded-md px-2.5 py-1 text-xs font-medium', isActive ? 'bg-ink text-white' : 'bg-well text-ink-2')
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <StatusStrip />
      </header>

      {role === 'auditor' && (
        <div className="border-b border-ai-line bg-ai-soft px-4 py-1.5 text-xs font-medium text-ai-ink sm:px-6">
          Auditor view: read-only. Decisions and reports are disabled.
        </div>
      )}

      <main className="w-full flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-[1440px]">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-line bg-well/60 px-4 py-4 font-mono text-[11px] text-ink-2 sm:px-6">
        <div className="mx-auto flex max-w-[1440px] flex-wrap justify-between gap-3">
          <span>RMAI · AI-assisted risk management (PMBOK / ISO 31000)</span>
          <span>Scores: backend P × I · Quotes: verified word for word · Log: SHA-256 hash chain</span>
        </div>
      </footer>

      {openRisk && <RiskInspector riskId={openRisk} variant="overlay" />}
    </div>
  )
}

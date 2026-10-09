import { BadgeCheck, LogOut, ShieldAlert } from 'lucide-react'
import { Navigate, NavLink, Outlet, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { usePoll, useApp } from '../lib/app'
import { ROLE } from '../lib/labels'
import { RiskInspector } from './RiskInspector'
import { ThemeSwitch } from './ThemeSwitch'
import { cx } from './ui'

const NAV = [
  { to: '/', label: 'Overview' },
  { to: '/risks', label: 'Risks' },
  { to: '/analyze', label: 'Analyzer' },
  { to: '/incidents', label: 'Incidents' },
  { to: '/escalations', label: 'Escalations' },
  { to: '/audit', label: 'Audit' },
]

function Logo() {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <img src="/favicon.svg" alt="" width={32} height={32} className="h-8 w-8 rounded-md" />
      <div className="leading-tight">
        <p className="text-base font-semibold tracking-tight text-ink">RMAI</p>
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
        'hidden items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] xl:inline-flex',
        data.ok ? 'bg-well text-ink' : 'bg-bad-soft text-bad-ink',
      )}
      title="Recomputed from every audit entry"
    >
      {data.ok ? <BadgeCheck size={14} className="text-ok" /> : <ShieldAlert size={14} />}
      {data.ok ? `Chain verified · ${data.checked} blocks` : `Chain broken at #${data.broken_at}`}
    </span>
  )
}

export function Layout() {
  const { session, signOut } = useApp()
  const [params] = useSearchParams()
  const openRisk = params.get('risk')
  if (!session) return <Navigate to="/login" replace />

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-white shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-6">
            <Logo />
            <nav className="hidden min-w-0 items-center gap-1 overflow-x-auto lg:flex">
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
            <ThemeSwitch />
            {session && (
              <div className="flex items-center gap-2 rounded-md bg-well py-1 pr-1 pl-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-white">
                  {session.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                </span>
                <div className="hidden leading-tight sm:block">
                  <p className="max-w-32 truncate text-[12px] font-semibold text-ink">{session.name}</p>
                  <p className="font-mono text-[10px] text-ink-2 uppercase">{ROLE[session.role]} · demo</p>
                </div>
                <button onClick={signOut} title="Sign out" aria-label="Sign out" className="flex h-7 w-7 items-center justify-center rounded text-ink-3 hover:bg-white hover:text-ink">
                  <LogOut size={14} />
                </button>
              </div>
            )}
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
      </header>


      <main className="w-full flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-[1440px]">
          <Outlet />
        </div>
      </main>


      {openRisk && <RiskInspector riskId={openRisk} variant="overlay" />}
    </div>
  )
}

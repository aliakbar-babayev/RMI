import { ArrowRight, BadgeCheck, HardHat, Network, Sparkles, UserCog } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { BrandLogo } from '../components/BrandLogo'
import { ThemeSwitch } from '../components/ThemeSwitch'
import { Caption, Chip, cx, inputCls } from '../components/ui'
import type { Role } from '../lib/api'
import { useApp } from '../lib/app'

const NAME_KEY = 'rmai.reporter-name'

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10 text-[#a5b4fc] ring-1 ring-white/15">{icon}</span>
      <div>
        <p className="text-[14px] font-semibold text-[#f1f5f9]">{title}</p>
        <p className="mt-0.5 text-[13px] leading-5 text-[#94a3b8]">{children}</p>
      </div>
    </li>
  )
}

function RoleButton({ role, icon, title, text, onClick, primary }: {
  role: Role
  icon: ReactNode
  title: string
  text: string
  onClick: (r: Role) => void
  primary?: boolean
}) {
  return (
    <button
      onClick={() => onClick(role)}
      className={cx(
        'group flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg',
        primary ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-line-strong',
      )}
    >
      <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', primary ? 'bg-white/15' : 'bg-well')}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[15px] font-semibold">{title}</span>
          <span className={cx('rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase', primary ? 'bg-white/15' : 'bg-ai-soft text-ai-ink')}>Demo</span>
        </span>
        <span className={cx('mt-0.5 block text-[12px] leading-4', primary ? 'opacity-75' : 'text-ink-2')}>{text}</span>
      </span>
      <ArrowRight size={18} className="shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100" />
    </button>
  )
}

export function Login() {
  const { session, signIn } = useApp()
  const navigate = useNavigate()
  const [name, setName] = useState(() => {
    try { return localStorage.getItem(NAME_KEY) ?? '' } catch { return '' }
  })

  if (session) return <Navigate to={session.role === 'admin' ? '/' : '/incidents'} replace />

  const go = (role: Role) => {
    const typed = name.trim()
    try { if (typed) localStorage.setItem(NAME_KEY, typed) } catch { /* storage unavailable */ }
    signIn(role, typed || (role === 'admin' ? 'Admin' : 'Worker'))
    navigate(role === 'admin' ? '/' : '/incidents', { replace: true })
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-canvas lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel: the heat-map palette as slow waves, cold blue to hot red */}
      <aside className="relative hidden overflow-hidden bg-code p-10 lg:flex lg:flex-col">
        <div
          aria-hidden
          className="login-waves pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(60% 50% at 18% 85%, rgba(96,165,250,0.45), transparent 70%),' +
              'radial-gradient(45% 40% at 85% 20%, rgba(220,38,38,0.38), transparent 70%),' +
              'radial-gradient(40% 35% at 65% 70%, rgba(99,102,241,0.30), transparent 70%)',
          }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:44px_44px]" />

        <div className="relative flex items-center gap-2.5">
          <BrandLogo onDark className="h-10 w-auto" />
        </div>

        <div className="relative mx-auto my-auto w-full max-w-lg py-10">
          <Caption className="text-[#a5b4fc]">AI risk management · PMBOK / ISO 31000</Caption>
          <h1 className="mt-3 text-[40px] leading-[1.1] font-semibold tracking-[-0.02em] text-[#fff]">
            See project risks before they become incidents.
          </h1>
          <p className="mt-4 text-[15px] leading-6 text-[#94a3b8]">
            Turn project documents and incident reports into scored, evidence-backed risks, then decide, escalate and prove every step.
          </p>
          <ul className="mt-8 space-y-5">
            <Feature icon={<Sparkles size={16} />} title="Every AI claim has a quote">Risks are kept only when their quote is found word for word in your document.</Feature>
            <Feature icon={<Network size={16} />} title="Incidents with blast radius">Report a mistake and see which systems depend on it and what to do now.</Feature>
            <Feature icon={<BadgeCheck size={16} />} title="Tamper-evident audit chain">Each decision is a SHA-256-linked block that anyone can re-verify.</Feature>
          </ul>
        </div>
        <p className="relative font-mono text-[11px] text-[#64748b]">RMAI · Neurobridge / OMNI AI Summit</p>
      </aside>

      {/* Sign-in */}
      <main className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 lg:invisible">
            <BrandLogo className="h-8 w-auto" />
          </div>
          <ThemeSwitch />
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <Chip tone="ai" className="self-start">Demo access</Chip>
          <h2 className="mt-3 text-[28px] leading-9 font-semibold tracking-[-0.02em]">Sign in to RMAI</h2>
          <p className="mt-1 text-sm text-ink-2">Choose how you want to use the app. Your name is shown on the incidents you report.</p>

          <label className="mt-7 block">
            <span className="mb-1.5 block font-mono text-[11px] tracking-[0.04em] text-ink-2 uppercase">Your name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && go('admin')}
              placeholder="e.g. Aysel Məmmədova"
              className={cx(inputCls, 'h-11 text-[15px]')}
            />
          </label>

          <div className="mt-5 space-y-3">
            <RoleButton role="admin" primary onClick={go} icon={<UserCog size={22} />} title="Continue as Admin"
              text="Risk team: sees every page plus the worker reports, and approves escalations." />
            <RoleButton role="worker" onClick={go} icon={<HardHat size={22} />} title="Continue as Worker"
              text="Reports incidents, follows them to resolution and requests access when needed." />
          </div>

          <p className="mt-6 rounded-md border border-line bg-well/60 px-3 py-2.5 text-[12px] leading-5 text-ink-2">
            Demo sign-in: there is no password yet, and the role only changes what the app shows. Real authentication comes later.
          </p>
        </div>
      </main>
    </div>
  )
}

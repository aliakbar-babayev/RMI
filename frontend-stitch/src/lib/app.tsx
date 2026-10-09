import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { setApiRole } from './api'
import type { Role } from './api'

export type Theme = 'light' | 'dark' | 'system'

interface AppState {
  theme: Theme
  setTheme: (t: Theme) => void
  /** The theme actually shown (system resolved). */
  dark: boolean
  /** Demo sign-in: who is using the app. No password; real authentication is not built yet. */
  session: Session | null
  signIn: (role: Role, name: string) => void
  signOut: () => void
  role: Role
  setRole: (r: Role) => void
  /** Admin makes every decision; workers report incidents and request access. */
  canAct: boolean
  /** Bumped after every change, so all visible data reloads at once. */
  version: number
  refresh: () => void
}

const AppContext = createContext<AppState | null>(null)
export interface Session {
  role: Role
  name: string
}

const ROLE_KEY = 'rmai.role'
const SESSION_KEY = 'rmai.session'

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    if ((s.role === 'admin' || s.role === 'worker') && typeof s.name === 'string') return s
  } catch {
    /* storage unavailable or bad value */
  }
  return null
}
const THEME_KEY = 'rmai.theme'

function loadTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY)
    if (t === 'light' || t === 'dark' || t === 'system') return t
  } catch {
    /* storage unavailable */
  }
  return 'system'
}

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches

function loadRole(): Role {
  try {
    const r = localStorage.getItem(ROLE_KEY)
    if (r === 'admin' || r === 'worker') return r
    if (r === 'executive' || r === 'analyst') return 'admin' // role names saved by older versions
  } catch {
    /* storage unavailable */
  }
  return 'admin'
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(loadSession)
  const [role, setRoleState] = useState<Role>(() => {
    const r = loadSession()?.role ?? loadRole()
    setApiRole(r)
    return r
  })
  const [version, setVersion] = useState(0)
  const [theme, setThemeState] = useState<Theme>(loadTheme)
  const [sysDark, setSysDark] = useState(systemDark)
  const dark = theme === 'dark' || (theme === 'system' && sysDark)

  useEffect(() => {
    const m = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => setSysDark(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    try {
      localStorage.setItem(THEME_KEY, t)
    } catch {
      /* storage unavailable */
    }
  }, [])

  const setRole = useCallback((r: Role) => {
    setApiRole(r)
    setRoleState(r)
    setVersion((v) => v + 1) // reload everything with the new role's view
    try {
      localStorage.setItem(ROLE_KEY, r)
    } catch {
      /* storage unavailable */
    }
  }, [])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  const signIn = useCallback(
    (r: Role, name: string) => {
      const s = { role: r, name: name.trim() || (r === 'admin' ? 'Admin' : 'Worker') }
      setSession(s)
      setRole(r)
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(s))
      } catch {
        /* storage unavailable: signed in for this tab only */
      }
    },
    [setRole],
  )

  const signOut = useCallback(() => {
    setSession(null)
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {
      /* storage unavailable */
    }
  }, [])

  return (
    <AppContext.Provider value={{ theme, setTheme, dark, session, signIn, signOut, role, setRole, canAct: true, version, refresh }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp outside AppProvider')
  return ctx
}

/**
 * Load data and reload it every `intervalMs` (the brief: polling every 3–5 s, no WebSockets),
 * whenever `deps` change, and after any change in the app (`refresh()`).
 */
export function usePoll<T>(load: () => Promise<T>, deps: unknown[], intervalMs = 4000) {
  const { version } = useApp()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    let alive = true
    const run = () =>
      loadRef.current().then(
        (d) => {
          if (alive) {
            setData(d)
            setError(null)
          }
        },
        (e: Error) => alive && setError(e.message),
      )
    run()
    const id = intervalMs > 0 ? window.setInterval(run, intervalMs) : undefined
    return () => {
      alive = false
      if (id) window.clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, intervalMs, ...deps])

  return { data, error, loading: data === null && error === null }
}

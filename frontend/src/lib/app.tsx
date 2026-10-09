import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { setApiRole } from './api'
import type { Role } from './api'

interface AppState {
  role: Role
  setRole: (r: Role) => void
  canAct: boolean
  /** Bumped after every change, so all visible data reloads at once. */
  version: number
  refresh: () => void
}

const AppContext = createContext<AppState | null>(null)
const ROLE_KEY = 'rmai.role'

function loadRole(): Role {
  try {
    const r = localStorage.getItem(ROLE_KEY)
    if (r === 'executive' || r === 'analyst' || r === 'auditor') return r
  } catch {
    /* storage unavailable */
  }
  return 'analyst'
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(() => {
    const r = loadRole()
    setApiRole(r)
    return r
  })
  const [version, setVersion] = useState(0)

  const setRole = useCallback((r: Role) => {
    setApiRole(r)
    setRoleState(r)
    try {
      localStorage.setItem(ROLE_KEY, r)
    } catch {
      /* storage unavailable */
    }
  }, [])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  return (
    <AppContext.Provider value={{ role, setRole, canAct: role !== 'auditor', version, refresh }}>
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

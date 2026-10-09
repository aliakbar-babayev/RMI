import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/** The risk drawer is driven by ?risk=R-001, so it works on every page and links can share it. */
export function useOpenRisk() {
  const [params, setParams] = useSearchParams()
  const open = useCallback(
    (id: string) => {
      const next = new URLSearchParams(params)
      next.set('risk', id)
      setParams(next)
    },
    [params, setParams],
  )
  const close = useCallback(() => {
    const next = new URLSearchParams(params)
    next.delete('risk')
    setParams(next)
  }, [params, setParams])
  return { open, close }
}

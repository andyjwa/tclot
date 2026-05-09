import { useCallback, useEffect, useState } from 'react'
import { draftResourceUrl } from './fplDraftUrl.js'

/**
 * Draft `bootstrap-static` → `events.current` / `events.next` for UI that must not depend on
 * opening the Live tab (e.g. waiver GW picker defaulting to the upcoming processed gameweek).
 *
 * Refetches when the tab becomes visible and on an interval so `events.current` can roll
 * across gameweeks without a full page reload.
 */
export function useDraftBootstrapEvents() {
  const [current, setCurrent] = useState(null)
  const [next, setNext] = useState(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch(draftResourceUrl('bootstrap-static'), {
        cache: 'no-store',
      })
      if (!r.ok) return
      const j = await r.json()
      const ev = j?.events
      const c = ev?.current != null ? Number(ev.current) : null
      const n = ev?.next != null ? Number(ev.next) : null
      setCurrent(Number.isFinite(c) && c >= 1 && c <= 38 ? c : null)
      setNext(Number.isFinite(n) && n >= 1 && n <= 38 ? n : null)
    } catch {
      /* ignore — static waiver JSON still works */
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const onVis = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [load])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const id = window.setInterval(() => void load(), 15 * 60 * 1000)
    return () => window.clearInterval(id)
  }, [load])

  return { current, next }
}

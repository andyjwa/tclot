import { useCallback, useEffect, useMemo, useState } from 'react'
import { draftResourceUrl } from './fplDraftUrl.js'

/**
 * Draft `bootstrap-static` → `events.current` / `events.next` for UI that must not depend on
 * opening the Live tab (e.g. waiver GW picker defaulting to the upcoming processed gameweek,
 * the global brand header status strip showing live / idle / pre-season state).
 *
 * Refetches when the tab becomes visible and on an interval so `events.current` can roll
 * across gameweeks without a full page reload.
 *
 * Returned shape stays backward-compatible: `current` and `next` are the numeric GW ids that
 * existing callers rely on; the richer `currentEvent` / `nextEvent` / `lastFinishedEvent`
 * objects are added for the status strip + are `null` when bootstrap hasn't loaded yet.
 */
export function useDraftBootstrapEvents() {
  /** @type {[number | null, (v: number | null) => void]} */
  const [current, setCurrent] = useState(null)
  /** @type {[number | null, (v: number | null) => void]} */
  const [next, setNext] = useState(null)
  /** @type {[object[] | null, (v: object[] | null) => void]} */
  const [events, setEvents] = useState(null)

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
      const list = Array.isArray(ev?.data)
        ? ev.data
        : Array.isArray(ev)
          ? ev
          : null
      setEvents(Array.isArray(list) ? list : null)
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

  /** Lookup map id → event object; stable across renders so the consumer can `useMemo` cleanly. */
  const eventById = useMemo(() => {
    if (!Array.isArray(events)) return null
    const m = new Map()
    for (const e of events) {
      const id = Number(e?.id)
      if (Number.isFinite(id)) m.set(id, e)
    }
    return m
  }, [events])

  const currentEvent = useMemo(() => {
    if (!eventById || current == null) return null
    return eventById.get(current) ?? null
  }, [eventById, current])

  const nextEvent = useMemo(() => {
    if (!eventById || next == null) return null
    return eventById.get(next) ?? null
  }, [eventById, next])

  /** Highest event id with `finished === true`; null pre-season. */
  const lastFinishedEvent = useMemo(() => {
    if (!Array.isArray(events) || events.length === 0) return null
    let best = null
    for (const e of events) {
      if (e?.finished === true) {
        if (!best || Number(e.id) > Number(best.id)) best = e
      }
    }
    return best
  }, [events])

  return { current, next, events, currentEvent, nextEvent, lastFinishedEvent }
}

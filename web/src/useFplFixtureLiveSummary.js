/**
 * Lightweight polling hook that returns `{ liveFixtureCount, minute }` for the
 * current FPL gameweek so the brand-header status strip can render the full
 * live message `● GW {N} — {liveCount} fixtures live · {minute}'` page-wide
 * (PR #4 of the redesign Phase 2 — see brandHeaderStatus.js).
 *
 * Why a dedicated hook (Option B in PR #4 design notes)?
 * --------------------------------------------------------
 * `useLiveScores` already polls the classic fixtures endpoint — but it also
 * fetches the draft bootstrap, draft event/{gw}/live, ESPN Prem window, and
 * per-team draft picks (n_teams * one HTTP per refresh). Hoisting that to
 * `App.jsx` so the header strip can see liveCount/minute would burn ~6–10×
 * the network traffic when the user is parked on a non-Live tab. The header
 * only needs `fixtures?event={gw}` — a single classic call. So we keep a
 * tiny, isolated polling loop that exits early when the GW isn't actually
 * live (pre-season, between GWs, deadline not yet passed, or finished).
 *
 * Shared cache: requests go through `fetchFplJsonCached`, so when the user
 * opens the Live tab `useLiveScores` will hit (or warm) the same cache key
 * — no double-fetching. TTL for `fixtures?…` is 3 minutes (see
 * `fplFetchCache.js`).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { FPL_DIRECT, fplApiBase } from './fplDraftUrl.js'
import { fetchFplJsonCached } from './fplFetchCache.js'

/** Classic `fantasy.premierleague.com/api` path + query (mirror of the
 * private `classicResourceUrl` in `useLiveScores.js`). Kept inline rather
 * than exported from there to avoid pulling that heavy hook's imports
 * into the header path. */
function classicResourceUrl(pathAndQuery) {
  const pq = String(pathAndQuery).replace(/^\/+/, '')
  const base = fplApiBase()
  if (base !== FPL_DIRECT) {
    return `${base.replace(/\/$/, '')}/${pq}`
  }
  if (import.meta.env.DEV) {
    return `/__fpl/${pq}`
  }
  return `${FPL_DIRECT}/${pq}`
}

/**
 * Pure derivation — given the classic `fixtures?event={gw}` payload,
 * return the live-fixture summary the brand header needs.
 *
 * A fixture is "live" when it has kicked off but FPL hasn't marked the
 * match finished (provisional or hard). 0 live fixtures returns `null`
 * fields for `liveFixtureCount` / `minute` so the consumer falls back to
 * the bare `● GW {N} · Live` copy.
 *
 * `minute` uses the **highest** elapsed minute among live fixtures (i.e.
 * the live fixture that started earliest in real time, since synchronized
 * kickoffs tick the same minute counter). Documented in the PR #4 brief
 * as the "GW window is currently at" reading.
 *
 * `finishedFixtureCount` / `totalFixtureCount` (PR #5h) drive the
 * brand-header strip's `progressLabel` ("2 of 10 complete"). They reflect
 * the whole-GW shape, not the live subset — so a fully-finished mid-GW
 * window (between fixture days) still surfaces `7 of 10 complete` while
 * `liveFixtureCount` is null. `totalFixtureCount` is 0 only when the
 * fixtures payload is empty / not yet loaded; consumers gate on `> 0`.
 *
 * @param {object[] | null | undefined} fixtures
 * @returns {{
 *   liveFixtureCount: number | null,
 *   minute: number | null,
 *   finishedFixtureCount: number,
 *   totalFixtureCount: number,
 * }}
 */
export function deriveLiveSummary(fixtures) {
  const arr = Array.isArray(fixtures) ? fixtures : []
  const totalFixtureCount = arr.length
  let finishedFixtureCount = 0
  for (const f of arr) {
    if (f && (f.finished === true || f.finished_provisional === true)) {
      finishedFixtureCount += 1
    }
  }
  if (totalFixtureCount === 0) {
    return {
      liveFixtureCount: null,
      minute: null,
      finishedFixtureCount: 0,
      totalFixtureCount: 0,
    }
  }
  const live = arr.filter(
    (f) =>
      f &&
      f.started === true &&
      f.finished !== true &&
      f.finished_provisional !== true,
  )
  if (!live.length) {
    return {
      liveFixtureCount: null,
      minute: null,
      finishedFixtureCount,
      totalFixtureCount,
    }
  }
  let maxMin = 0
  let sawMinute = false
  for (const f of live) {
    /** `Number(null) === 0` (finite!) — must gate on the raw value so the
     * pre-tick window doesn't leak `0'` while we wait for the FPL counter. */
    if (f.minutes == null) continue
    const m = Number(f.minutes)
    if (Number.isFinite(m)) {
      sawMinute = true
      if (m > maxMin) maxMin = m
    }
  }
  return {
    liveFixtureCount: live.length,
    minute: sawMinute ? maxMin : null,
    finishedFixtureCount,
    totalFixtureCount,
  }
}

/**
 * Polls `classic fixtures?event={currentEvent.id}` while the GW is live so
 * the brand header status strip can render fixture count + minute +
 * `finished / total` progress. No-op when there's no current event, the
 * deadline hasn't passed, or the event is already marked finished — the
 * strip degrades to the bootstrap-only `● GW {N} · Live` copy in those
 * windows.
 *
 * @param {{
 *   currentEvent?: object | null,
 *   enabled?: boolean,
 *   pollIntervalMs?: number,
 *   now?: () => Date,
 * }} opts
 * @returns {{
 *   liveFixtureCount: number | null,
 *   minute: number | null,
 *   finishedFixtureCount: number,
 *   totalFixtureCount: number,
 * }}
 */
export function useFplFixtureLiveSummary({
  currentEvent,
  enabled = true,
  pollIntervalMs = 60_000,
  now = () => new Date(),
} = {}) {
  const [summary, setSummary] = useState({
    liveFixtureCount: null,
    minute: null,
    finishedFixtureCount: 0,
    totalFixtureCount: 0,
  })

  const nowRef = useRef(now)
  nowRef.current = now

  const currentGw =
    currentEvent && currentEvent.id != null && currentEvent.finished !== true
      ? Number(currentEvent.id)
      : null

  /** Only poll while the deadline has actually passed — pre-kickoff the
   * classic fixtures payload would just show 0 live / 0 minutes anyway. */
  const deadlinePassed = (() => {
    if (!currentEvent?.deadline_time) return false
    const t = new Date(currentEvent.deadline_time).getTime()
    if (Number.isNaN(t)) return false
    return t <= nowRef.current().getTime()
  })()

  const shouldPoll = enabled && currentGw != null && deadlinePassed

  const [tabVisible, setTabVisible] = useState(() =>
    typeof document === 'undefined' ? true : !document.hidden,
  )

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const onVis = () => setTabVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const load = useCallback(
    async (gw) => {
      if (gw == null || !Number.isFinite(gw)) return
      try {
        // Trailing slash bypasses FPL's 301 → see same-named fetch in
        // `useLiveScores.js` for the full explanation.
        const url = classicResourceUrl(`fixtures/?event=${gw}`)
        const data = await fetchFplJsonCached(url, {
          label: 'brand-header fixtures',
        })
        const next = deriveLiveSummary(
          Array.isArray(data) ? data.filter((f) => Number(f.event) === gw) : [],
        )
        setSummary(next)
      } catch {
        /* Header strip degrades to the bootstrap-only fallback. Don't surface
         * a banner — that's reserved for the actual FPL Live tab. */
      }
    },
    [],
  )

  /** Reset summary the moment we leave the live window so a stale count
   * doesn't linger between GWs / after FT. */
  useEffect(() => {
    if (!shouldPoll) {
      setSummary({
        liveFixtureCount: null,
        minute: null,
        finishedFixtureCount: 0,
        totalFixtureCount: 0,
      })
    }
  }, [shouldPoll])

  useEffect(() => {
    if (!shouldPoll) return undefined
    void load(currentGw)
    if (typeof window === 'undefined' || !tabVisible) return undefined
    const ms = Number(pollIntervalMs) > 0 ? Number(pollIntervalMs) : 60_000
    const id = window.setInterval(() => void load(currentGw), ms)
    return () => window.clearInterval(id)
  }, [shouldPoll, currentGw, pollIntervalMs, tabVisible, load])

  return summary
}

import { useEffect, useState } from 'react'
import { fetchLeagueData, leagueDataCacheKey } from './leagueDataClient.js'

/**
 * Loads `no-bonus-points.json` for Standings → Stats. Missing artifact
 * resolves to null.
 *
 * @param {boolean} [enabled]
 */
export function useNoBonusPoints(enabled = true) {
  const [state, setState] = useState({
    report: null,
    loading: Boolean(enabled),
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const v = await leagueDataCacheKey()
        if (cancelled) return
        if (!enabled) {
          setState({ report: null, loading: false })
          return
        }
        const report = await fetchLeagueData('no-bonus-points.json', v)
        if (!cancelled) setState({ report, loading: false })
      } catch {
        if (!cancelled) setState({ report: null, loading: false })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])

  return state
}

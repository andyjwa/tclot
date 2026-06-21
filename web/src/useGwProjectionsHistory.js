import { useState, useEffect } from 'react';
import { leagueDataCacheKey, fetchLeagueData } from './leagueDataClient.js';

/**
 * Loads the archived per-gameweek projection snapshot
 * (`projections-history/gw-NN.json`) produced by build-projections-history.mjs.
 *
 * Each file carries the league's H2H matchups with both the pre-match forecast
 * (xPtsXi / xPtsMc) and the final result (actualXiPts / projMc), so a finished
 * gameweek can show what was predicted before kick-off alongside how it actually
 * settled. Only fetched when `enabled` and a valid gameweek is supplied; misses
 * resolve to `null`.
 *
 * @param {number|null|undefined} gw gameweek number (1–38)
 * @param {boolean} [enabled] skip the fetch entirely when false
 */
export function useGwProjectionsHistory(gw, enabled = true) {
  const [state, setState] = useState({ history: null, loading: Boolean(enabled) });

  useEffect(() => {
    let cancelled = false;
    const n = Number(gw);
    const valid = enabled && Number.isFinite(n) && n >= 1;
    // All setState calls live inside the async IIFE (after an await) so none run
    // synchronously during the effect body (react-hooks/set-state-in-effect).
    (async () => {
      try {
        const v = await leagueDataCacheKey();
        if (cancelled) return;
        if (!valid) {
          setState({ history: null, loading: false });
          return;
        }
        const file = `projections-history/gw-${String(n).padStart(2, '0')}.json`;
        const history = await fetchLeagueData(file, v);
        if (!cancelled) setState({ history, loading: false });
      } catch {
        if (!cancelled) setState({ history: null, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gw, enabled]);

  return state;
}

import { useState, useEffect } from 'react';
import { leagueDataCacheKey, fetchLeagueData } from './leagueDataClient.js';

/**
 * Loads the static forecast artifacts produced by scripts/build-predictions.mjs:
 *   - predictions.json         (per-player pre-deadline xP forecast for the target GW)
 *   - predictions-health.json  (gameweek, freshness, Understat coverage, id reconciliation)
 *
 * Uses the shared league-data client for base-path + revision cache-busting. Degrades
 * gracefully: a missing artifact (e.g. off-season, before the first build) resolves to
 * `null`, not an error.
 */
export function usePredictions() {
  const [state, setState] = useState({
    predictions: null,
    health: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await leagueDataCacheKey();
        const [predictions, health] = await Promise.all([
          fetchLeagueData('predictions.json', v),
          fetchLeagueData('predictions-health.json', v),
        ]);
        if (cancelled) return;
        setState({ predictions, health, loading: false, error: null });
      } catch (e) {
        if (cancelled) return;
        setState({ predictions: null, health: null, loading: false, error: e?.message || 'failed' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

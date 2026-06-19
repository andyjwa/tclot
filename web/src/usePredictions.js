import { useState, useEffect } from 'react';

/**
 * Loads the static forecast artifacts produced by scripts/build-predictions.mjs:
 *   - predictions.json         (per-player pre-deadline xP forecast for the target GW)
 *   - predictions-health.json  (gameweek, freshness, Understat coverage, id reconciliation)
 *
 * Mirrors useLeagueData's base-path + revision cache-busting so it resolves correctly under the
 * GitHub Pages base (`/TCLOT/`) and refreshes when league-data is rebuilt. Degrades gracefully:
 * a missing artifact (e.g. off-season, before the first build) resolves to `null`, not an error.
 */
const DATA_BASE = `${import.meta.env.BASE_URL}league-data`;
const BUILD_LEAGUE_DATA_V = String(import.meta.env.VITE_LEAGUE_DATA_REVISION || '').trim();

async function cacheKey() {
  if (BUILD_LEAGUE_DATA_V) return BUILD_LEAGUE_DATA_V;
  try {
    const r = await fetch(`${DATA_BASE}/revision.json`, { cache: 'no-store' });
    if (!r.ok) return '';
    const j = await r.json();
    return j?.v != null ? String(j.v) : '';
  } catch {
    return '';
  }
}

function urlFor(path, v) {
  const base = `${DATA_BASE}/${path}`;
  return v ? `${base}?v=${encodeURIComponent(v)}` : base;
}

async function fetchOptional(path, v) {
  try {
    const res = await fetch(urlFor(path, v), v ? { cache: 'no-store' } : undefined);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

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
        const v = await cacheKey();
        const [predictions, health] = await Promise.all([
          fetchOptional('predictions.json', v),
          fetchOptional('predictions-health.json', v),
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

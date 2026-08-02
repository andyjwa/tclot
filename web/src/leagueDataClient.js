/**
 * Shared client for fetching static league-data artifacts produced by the build
 * scripts (predictions.json, projections-history/gw-NN.json, etc.).
 *
 * Centralises the GitHub Pages base-path handling and the revision-based
 * cache-busting (mirrors useLeagueData) so every data hook resolves correctly
 * under `/TCLOT/` and refreshes when league-data is rebuilt. All fetches degrade
 * gracefully: a missing artifact resolves to `null` rather than throwing.
 */
import { leagueDataBase } from './seasonArchive.js';

/** Resolves to `league-data/seasons/<label>` in archive view (see seasonArchive.js). */
const DATA_BASE = leagueDataBase();
const BUILD_LEAGUE_DATA_V = String(import.meta.env.VITE_LEAGUE_DATA_REVISION || '').trim();

/** Resolve the cache-busting revision: build-time env wins, else revision.json. */
export async function leagueDataCacheKey() {
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

/** Build a versioned URL for a league-data path (relative to league-data/). */
export function leagueDataUrl(path, v) {
  const base = `${DATA_BASE}/${path}`;
  return v ? `${base}?v=${encodeURIComponent(v)}` : base;
}

/** Fetch + parse a league-data artifact; returns null on any miss/error. */
export async function fetchLeagueData(path, v) {
  try {
    const res = await fetch(leagueDataUrl(path, v), v ? { cache: 'no-store' } : undefined);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

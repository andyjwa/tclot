/**
 * Season-archive view resolution.
 *
 * Past seasons live under `league-data/seasons/<label>/` (written by
 * archive-prior-season.mjs at rollover). Viewing one is driven entirely by a
 * `?season=<label>` URL parameter: every data module resolves its base path
 * through `leagueDataBase()` at module init, so switching seasons is a plain
 * navigation (full reload) and the whole app — standings, moves, trades, stats —
 * reads the archived tree with no per-hook plumbing.
 *
 * The header switcher discovers what exists via `seasons/index.json`
 * (build-seasons-manifest.mjs).
 */

/** Archive folder labels look like "2025-26". */
const SEASON_LABEL_RE = /^\d{4}-\d{2}$/;

/** The validated `?season=` label, or null when viewing the current season. */
export function archivedSeasonLabel() {
  if (typeof window === 'undefined') return null;
  try {
    const v = new URLSearchParams(window.location.search).get('season');
    return v && SEASON_LABEL_RE.test(v) ? v : null;
  } catch {
    return null;
  }
}

/** True when the app is showing an archived (read-only, finished) season. */
export function isArchiveView() {
  return archivedSeasonLabel() != null;
}

/**
 * Base URL every league-data fetch resolves against — the live tree, or the
 * archived season's subtree when `?season=` is present.
 */
export function leagueDataBase() {
  const root = `${import.meta.env.BASE_URL}league-data`;
  const label = archivedSeasonLabel();
  return label ? `${root}/seasons/${label}` : root;
}

/** "2025-26" → "2025/26" (header pill display form). */
export function seasonLabelDisplay(label) {
  if (typeof label !== 'string') return label;
  const m = label.match(/^(\d{4})-(\d{2})$/);
  return m ? `${m[1]}/${m[2]}` : label;
}

/** Href for the given archived season label (null → current season), keeping other params. */
export function seasonHref(label) {
  const params = new URLSearchParams(window.location.search);
  if (label) params.set('season', label);
  else params.delete('season');
  const qs = params.toString();
  return `${window.location.pathname}${qs ? `?${qs}` : ''}`;
}

/**
 * Fetch `seasons/index.json`. `current` is the live tree's label (`2026-27`);
 * `archived` is older labels only, newest first. Empty catalog on any miss.
 */
export async function fetchSeasonCatalog() {
  try {
    const res = await fetch(
      `${import.meta.env.BASE_URL}league-data/seasons/index.json`,
      { cache: 'no-store' },
    );
    if (!res.ok) return { current: null, archived: [] };
    const j = await res.json();
    const current =
      typeof j?.current === 'string' && SEASON_LABEL_RE.test(j.current)
        ? j.current
        : null;
    const archived = (Array.isArray(j?.seasons) ? j.seasons : [])
      .filter((s) => typeof s === 'string' && SEASON_LABEL_RE.test(s))
      .filter((s) => s !== current)
      .sort()
      .reverse();
    return { current, archived };
  } catch {
    return { current: null, archived: [] };
  }
}

/**
 * Fetch `seasons/index.json` and return archived labels older than the current
 * season, newest first. Returns [] on any miss (feature quietly disabled).
 */
export async function fetchArchivedSeasons() {
  const { archived } = await fetchSeasonCatalog();
  return archived;
}

/**
 * Season derivation helpers shared by the data pipeline (build scripts) and the app.
 *
 * FPL seasons run August–May. We expose two forms:
 *  - `getSeasonString()` → two-digit compact form, e.g. "2526" (matches external feed conventions)
 *  - `getSeasonLabel()`  → human/display + archive-folder form, e.g. "2025-26"
 *
 * Always derive — never hardcode a season anywhere else in the codebase. Prefer deriving
 * from live bootstrap `events` (`resolveSeasonFromBootstrap`) so an artifact is labelled with
 * the season its data actually belongs to; fall back to the wall-clock date only when no
 * events are available.
 */

/** Month (1-indexed) at/after which a calendar year starts a new FPL season. GW1 is mid-August; pre-season deadlines can land in late July. */
const SEASON_START_MONTH = 7;

/** @param {number} startYear e.g. 2025 → { string: "2526", label: "2025-26" } */
export function seasonFormsFromStartYear(startYear) {
  const sy = Number(startYear);
  const endYear = sy + 1;
  return {
    startYear: sy,
    endYear,
    string: `${String(sy).slice(2)}${String(endYear).slice(2)}`,
    label: `${sy}-${String(endYear).slice(2)}`,
  };
}

/**
 * Season start year for a given date. Uses UTC parts so results are deterministic regardless
 * of the build machine's timezone (FPL deadlines are published in UTC).
 * @param {Date} [now]
 * @returns {number}
 */
export function seasonStartYearFromDate(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // 1-indexed
  return month >= SEASON_START_MONTH ? year : year - 1;
}

/**
 * Compact two-digit season string, e.g. "2526".
 * @param {Date} [now]
 */
export function getSeasonString(now = new Date()) {
  return seasonFormsFromStartYear(seasonStartYearFromDate(now)).string;
}

/**
 * Human/display + archive-folder label, e.g. "2025-26".
 * @param {Date} [now]
 */
export function getSeasonLabel(now = new Date()) {
  return seasonFormsFromStartYear(seasonStartYearFromDate(now)).label;
}

/**
 * Season start year inferred from an FPL event `deadline_time` ISO string.
 * @param {string} deadlineIso e.g. "2025-08-15T17:30:00Z"
 * @returns {number | null}
 */
export function seasonStartYearFromDeadline(deadlineIso) {
  if (typeof deadlineIso !== 'string' || !deadlineIso) return null;
  const d = new Date(deadlineIso);
  if (Number.isNaN(d.getTime())) return null;
  return seasonStartYearFromDate(d);
}

/** Normalise the varied shapes FPL/draft bootstrap `events` can take into a plain array. */
function eventsArray(events) {
  if (Array.isArray(events)) return events;
  if (events && Array.isArray(events.data)) return events.data;
  return [];
}

/**
 * Derive season forms from the earliest event deadline in a bootstrap payload.
 * @param {{ events?: any }} boot classic or draft `bootstrap-static`
 * @returns {{ startYear: number, endYear: number, string: string, label: string } | null}
 */
export function resolveSeasonFromBootstrap(boot) {
  const events = eventsArray(boot?.events);
  let earliest = null;
  for (const ev of events) {
    const t = ev?.deadline_time;
    if (typeof t !== 'string') continue;
    const ms = new Date(t).getTime();
    if (Number.isNaN(ms)) continue;
    if (earliest == null || ms < earliest.ms) earliest = { ms, t };
  }
  if (!earliest) return null;
  const startYear = seasonStartYearFromDeadline(earliest.t);
  if (startYear == null) return null;
  return seasonFormsFromStartYear(startYear);
}

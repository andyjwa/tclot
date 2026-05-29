/**
 * Session-scoped cache for merged Premier League fixture rows (PremWindow rows)
 * keyed by FPL's `pulse_id`.
 *
 * # Why this exists
 *
 * Opening the Lineups tab fires `fetchPulselivePremWindow` AND `fetchEspnPremWindow`
 * in parallel. Each source makes one umbrella call + N sequential per-fixture
 * lineup/summary calls (10 per typical GW), so a cold open is ~12 round trips
 * per source. Tab-switching to another sub-tab and back unmounts `PremWindow`
 * and re-fires the whole graph from scratch.
 *
 * For finished matches (`score.finished === true`), the lineups, events, and
 * scoreline are immutable — refetching is pure cost. We persist those rows to
 * `sessionStorage` so subsequent mounts within the same session can hydrate
 * without any network traffic. Sessions are intentionally session-scoped (no
 * `localStorage`) — we'd rather a fresh browser session re-fetch than risk
 * stale rows sticking around indefinitely.
 *
 * # What gets cached
 *
 * Only rows whose `score.finished === true`, no `fetchError`, and that carry
 * a finite numeric `fplFixture.pulse_id`. Live or pre-match rows are NOT
 * cached because their lineups (pre-match) and events/scores (live) still
 * change. `fplFixture` is intentionally stripped from cached payloads —
 * callers re-attach the live FPL fixture when reading, so a `pulse_id` move
 * between gameweeks (theoretical) can't surface a stale FPL fixture.
 *
 * # API
 *
 * - `getCachedLineup(pulseId)` — returns the cached row body (no `fplFixture`)
 *   or `null`.
 * - `setCachedLineup(pulseId, row)` — writes a row iff it's terminal; no-op
 *   otherwise. Returns whether it wrote.
 * - `clearCachedLineup(pulseId)` — used by the refresh button to evict a
 *   single fixture before a forced refetch.
 * - `clearAllCachedLineups()` — used by the refresh button to invalidate the
 *   whole cache before a forced refetch.
 *
 * # Failure modes
 *
 * Every `sessionStorage` access is wrapped in `try / catch` because Safari
 * private mode + some embedded webviews throw on access. The in-memory mirror
 * keeps the API working even when persistence is unavailable.
 *
 * # Version bumping
 *
 * If the cached row shape ever changes (different field names, different
 * dimensions on `lineups`, etc.), bump `CACHE_VERSION`. Older versioned keys
 * are simply ignored — they sit in `sessionStorage` until the user closes the
 * tab, but they're never read.
 */

const CACHE_VERSION = 1;
const STORAGE_KEY = `prem-lineups-cache:v${CACHE_VERSION}`;

/**
 * Module-level mirror of the parsed cache contents. Keeps reads cheap (no
 * JSON parsing per call) and keeps the cache usable when sessionStorage
 * isn't writable (Safari private, embedded webviews, etc.).
 *
 * @type {Record<string, CachedLineupRow> | null}
 */
let memoryCache = null;

/**
 * @typedef {{
 *   cachedAt: number,
 *   matchId: number | null,
 *   score: object | null,
 *   events: object[],
 *   lineups: { home: object, away: object } | null,
 *   fetchError: string | null,
 *   detailsBlockedReason: string | null,
 *   lineupSource?: string,
 *   eventSource?: string,
 *   scoreSource?: string,
 * }} CachedLineupRow
 */

function getStorage() {
  try {
    if (typeof globalThis === 'undefined') return null;
    const s = globalThis.sessionStorage;
    return s && typeof s.getItem === 'function' ? s : null;
  } catch {
    return null;
  }
}

function readFromStorage() {
  const store = getStorage();
  if (!store) return {};
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeToStorage(cache) {
  const store = getStorage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /** Quota exceeded / private mode — fall back to in-memory only. */
  }
}

function loadCache() {
  if (memoryCache != null) return memoryCache;
  memoryCache = readFromStorage();
  return memoryCache;
}

/**
 * Premise: a "finished" fixture's lineup + events + score are immutable.
 *
 * Mirrors `isFixtureFullTime` in PremWindow.jsx — kept inline here to keep
 * the cache module self-contained (no React import dependency).
 */
function isRowFullTime(row) {
  if (!row) return false;
  if (row.score?.finished === true) return true;
  const fx = row.fplFixture;
  if (fx?.finished === true || fx?.finished_provisional === true) return true;
  return false;
}

/**
 * @param {number} pulseId
 * @returns {CachedLineupRow | null}
 */
export function getCachedLineup(pulseId) {
  const pid = Number(pulseId);
  if (!Number.isFinite(pid)) return null;
  const cache = loadCache();
  const entry = cache[String(pid)];
  return entry || null;
}

/**
 * Write a row to the cache iff it's a finished fixture with no fetch error.
 * `fplFixture` is stripped — callers re-attach the live FPL fixture when
 * reading.
 *
 * @param {number} pulseId
 * @param {object} row — merged PremWindow row
 * @returns {boolean} true if the row was cached
 */
export function setCachedLineup(pulseId, row) {
  const pid = Number(pulseId);
  if (!Number.isFinite(pid)) return false;
  if (!row || row.fetchError) return false;
  if (!isRowFullTime(row)) return false;
  /** Don't cache empty rows — would mask retries when upstream recovers. */
  if (!row.lineups && !row.score && (!row.events || !row.events.length)) {
    return false;
  }
  const cache = loadCache();
  const next = {
    ...cache,
    [String(pid)]: {
      cachedAt: Date.now(),
      matchId: row.matchId ?? null,
      score: row.score ?? null,
      events: Array.isArray(row.events) ? row.events : [],
      lineups: row.lineups ?? null,
      fetchError: null,
      detailsBlockedReason: row.detailsBlockedReason ?? null,
      lineupSource: row.lineupSource,
      eventSource: row.eventSource,
      scoreSource: row.scoreSource,
    },
  };
  memoryCache = next;
  writeToStorage(next);
  return true;
}

/**
 * Evict a single pulse_id from the cache. Called by the refresh button when
 * the user asks for a forced refetch of a specific fixture.
 */
export function clearCachedLineup(pulseId) {
  const pid = Number(pulseId);
  if (!Number.isFinite(pid)) return;
  const cache = loadCache();
  if (!(String(pid) in cache)) return;
  const next = { ...cache };
  delete next[String(pid)];
  memoryCache = next;
  writeToStorage(next);
}

/**
 * Wipe the entire cache. Used when the refresh icon is clicked: the next
 * fetch must hit the network for every fixture so the "Updated …" stamp
 * reflects a real round-trip.
 */
export function clearAllCachedLineups() {
  memoryCache = {};
  writeToStorage({});
}

/**
 * Test-only hook to reset the module's in-memory mirror so the next read
 * re-loads from sessionStorage. Not part of the production API.
 */
export function __resetLineupCacheForTests() {
  memoryCache = null;
}

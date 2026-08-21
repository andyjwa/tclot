/**
 * Merge two same-shape PremWindow row arrays (one row per FPL fixture) into a single
 * authoritative list, preferring the **primary** source per-fixture when it has any
 * useful signal (confirmed lineups, populated events, populated score) and falling back
 * to the **fallback** source otherwise.
 *
 * Rows from both sources share the contract produced by `fetchEspnPremWindow` and
 * `fetchPulselivePremWindow`:
 *
 *   { fplFixture, matchId, score, events, lineups, fetchError, ... }
 *
 * Today's usage:
 *   - primary  = Pulselive PremWindow rows (PL official source, T-75 lineups + wallclock events)
 *   - fallback = ESPN PremWindow rows (covers Pulselive outages, also fallback for missing
 *                fixtures Pulselive doesn't index e.g. mid-season postponements)
 *
 * Sofascore was evaluated and rejected — its CDN (Varnish) returns HTTP 403 to all non-
 * real-browser clients, including Cloudflare Workers. See `validate-lineup-sources.mjs`
 * and the PR description for the reproducible probes.
 */

function bothSidesConfirmed(lu) {
  return lu?.home?.confirmed === true && lu?.away?.confirmed === true;
}

function lineupsHaveAnyPlayers(lu) {
  if (!lu) return false;
  const homeXi = Array.isArray(lu.home?.xi) ? lu.home.xi.length : 0;
  const homeBench = Array.isArray(lu.home?.bench) ? lu.home.bench.length : 0;
  const awayXi = Array.isArray(lu.away?.xi) ? lu.away.xi.length : 0;
  const awayBench = Array.isArray(lu.away?.bench) ? lu.away.bench.length : 0;
  return homeXi + homeBench + awayXi + awayBench > 0;
}

function hasAnyScore(score) {
  if (!score) return false;
  /** Score field is meaningful even when 0–0; presence of a non-null score means the row
   *  has been populated from a real upstream response. */
  return score.homeScore != null || score.awayScore != null || !!score.statusText;
}

function rowHasSignal(row) {
  if (!row) return false;
  if (lineupsHaveAnyPlayers(row.lineups)) return true;
  if (Array.isArray(row.events) && row.events.length > 0) return true;
  if (hasAnyScore(row.score)) return true;
  return false;
}

/**
 * Per-field selection from primary + fallback. Each field has its own preference rules so
 * we don't drag a partial primary row over a richer fallback row when only some fields
 * are populated upstream.
 *
 *   - lineups:  primary if both-sides-confirmed, else fallback if confirmed, else whichever has any players
 *   - events:   primary if non-empty, else fallback
 *   - score:    primary if non-null, else fallback
 *   - matchId:  primary's matchId stays with its own row when its lineups/events/score win,
 *               otherwise fallback's. Useful for cache keys + debugging.
 *
 * @param {object | null} primary
 * @param {object | null} fallback
 * @param {{ primaryLabel?: string, fallbackLabel?: string }} [labels]
 * @returns {object} merged row + `lineupSource` / `eventSource` / `scoreSource` tags
 */
export function pickPreferredRow(primary, fallback, labels = {}) {
  const pLabel = labels.primaryLabel || 'primary';
  const fLabel = labels.fallbackLabel || 'fallback';

  /** Lineups: confirmed-first within primary→fallback order, then any-player fallback. */
  let lineups = null;
  let lineupSource = 'none';
  if (bothSidesConfirmed(primary?.lineups)) {
    lineups = primary.lineups;
    lineupSource = pLabel;
  } else if (bothSidesConfirmed(fallback?.lineups)) {
    lineups = fallback.lineups;
    lineupSource = fLabel;
  } else if (lineupsHaveAnyPlayers(primary?.lineups)) {
    lineups = primary.lineups;
    lineupSource = pLabel;
  } else if (lineupsHaveAnyPlayers(fallback?.lineups)) {
    lineups = fallback.lineups;
    lineupSource = fLabel;
  }

  /** Events: prefer the source that actually has events; if both have them, primary wins
   *  (we trust the official PL feed when present). */
  let events = [];
  let eventSource = 'none';
  if (Array.isArray(primary?.events) && primary.events.length > 0) {
    events = primary.events;
    eventSource = pLabel;
  } else if (Array.isArray(fallback?.events) && fallback.events.length > 0) {
    events = fallback.events;
    eventSource = fLabel;
  }

  /** Score: same rule — primary first, then fallback. */
  let score = null;
  let scoreSource = 'none';
  if (hasAnyScore(primary?.score)) {
    score = primary.score;
    scoreSource = pLabel;
  } else if (hasAnyScore(fallback?.score)) {
    score = fallback.score;
    scoreSource = fLabel;
  }

  /** matchId follows whichever source contributed the strongest signal — lineups > events > score. */
  let matchId = null;
  if (lineupSource === pLabel) matchId = primary?.matchId ?? null;
  else if (lineupSource === fLabel) matchId = fallback?.matchId ?? null;
  else if (eventSource === pLabel) matchId = primary?.matchId ?? null;
  else if (eventSource === fLabel) matchId = fallback?.matchId ?? null;
  else if (scoreSource === pLabel) matchId = primary?.matchId ?? null;
  else if (scoreSource === fLabel) matchId = fallback?.matchId ?? null;

  /** Surface an upstream fetch error only when the merged row has nothing useful to show.
   *  A source can fail (e.g. Pulselive rejecting the proxy IP) while the other still fills
   *  the row — in that case we don't want the losing source's error alarming a row that
   *  actually rendered lineups/events/score. */
  const rowHasUsableSignal =
    lineupsHaveAnyPlayers(lineups) ||
    (Array.isArray(events) && events.length > 0) ||
    hasAnyScore(score);
  const fetchError = rowHasUsableSignal
    ? null
    : primary?.fetchError ?? fallback?.fetchError ?? null;

  const fplFixture = primary?.fplFixture ?? fallback?.fplFixture ?? null;

  return {
    fplFixture,
    matchId,
    score,
    events,
    lineups,
    fetchError,
    detailsBlockedReason: null,
    lineupSource,
    eventSource,
    scoreSource,
  };
}

/**
 * Merge two equal-length-or-not row lists keyed by FPL fixture id. The primary list
 * drives the output order; rows that exist only in the fallback are appended.
 *
 * @param {Array<object>} primaryRows — e.g. Pulselive
 * @param {Array<object>} fallbackRows — e.g. ESPN
 * @param {{ primaryLabel?: string, fallbackLabel?: string }} [labels]
 */
export function mergePremWindowSources(primaryRows, fallbackRows, labels = {}) {
  const primary = Array.isArray(primaryRows) ? primaryRows : [];
  const fallback = Array.isArray(fallbackRows) ? fallbackRows : [];
  const byPrimaryFxId = new Map();
  for (const r of primary) {
    const k = Number(r?.fplFixture?.id);
    if (Number.isFinite(k)) byPrimaryFxId.set(k, r);
  }
  const byFallbackFxId = new Map();
  for (const r of fallback) {
    const k = Number(r?.fplFixture?.id);
    if (Number.isFinite(k)) byFallbackFxId.set(k, r);
  }

  const out = [];
  const seen = new Set();
  /** Walk primary first so its order is preserved in the output. */
  const driver = primary.length ? primary : fallback;
  for (const r of driver) {
    const k = Number(r?.fplFixture?.id);
    if (!Number.isFinite(k) || seen.has(k)) continue;
    seen.add(k);
    const p = byPrimaryFxId.get(k) ?? null;
    const f = byFallbackFxId.get(k) ?? null;
    /** When `rowHasSignal(p)` is false but `rowHasSignal(f)` is true, we still merge so the
     *  `lineupSource`/`eventSource` tags are attached for downstream display. */
    if (!p && !f) continue;
    out.push(pickPreferredRow(p, f, labels));
  }
  /** Append fallback-only rows (e.g. a postponed fixture Pulselive doesn't index). */
  for (const [k, f] of byFallbackFxId) {
    if (seen.has(k)) continue;
    seen.add(k);
    if (!rowHasSignal(f)) {
      out.push({ ...f, lineupSource: 'none', eventSource: 'none', scoreSource: 'none' });
      continue;
    }
    out.push(pickPreferredRow(null, f, labels));
  }
  return out;
}

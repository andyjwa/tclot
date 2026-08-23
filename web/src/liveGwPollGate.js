/**
 * When should the Live / Lineups views keep polling the FPL feeds for a
 * given gameweek?
 *
 * The original gate keyed purely off FPL's `events.current` flag. That flag
 * can lag the actual lineup/lock deadline by several minutes right after the
 * deadline (FPL flips it late, and our Cloudflare proxy caches
 * `bootstrap-static` for ~10 minutes), so a viewer sitting on the Lineups tab
 * at T-75 would never see confirmed XIs auto-appear — the poll stayed off
 * because `is_current` still pointed at "next". This helper adds a
 * deadline-passed fallback so we resume polling as soon as the selected GW's
 * lineup deadline has passed and the GW isn't finished, regardless of whether
 * FPL has flipped `is_current` yet.
 *
 * Pure (no React / DOM) so it can be unit-tested in isolation; the visibility
 * + interval wiring stays in `useLiveScores`.
 */

/** @param {unknown} value ISO string / epoch ms / Date */
function parseInstantMs(value) {
  if (value == null || value === '') return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(ms) ? ms : null;
}

/**
 * @param {{
 *   events?: Array<{ id?: number, is_current?: boolean, finished?: boolean, deadline_time?: string }> | null,
 *   eventSnapshot?: { id?: number, finished?: boolean, deadline_time?: string } | null,
 *   gameweek?: number | null,
 *   nowMs?: number,
 * }} p
 * @returns {boolean}
 */
export function shouldPollLiveGw({ events, eventSnapshot, gameweek, nowMs = Date.now() } = {}) {
  const gw = Number(gameweek);
  if (!Number.isFinite(gw)) return false;

  const list = Array.isArray(events) ? events : [];
  const selected = list.find((e) => Number(e?.id) === gw) ?? null;

  /** A finished GW never needs live polling. Prefer the richer event object,
   *  fall back to the caller-provided snapshot. */
  const finished =
    selected?.finished === true || eventSnapshot?.finished === true;
  if (finished) return false;

  /** Primary signal: FPL says this GW is current. */
  if (list.some((e) => e?.is_current === true && Number(e?.id) === gw)) {
    return true;
  }

  /** Fallback: the lineup deadline has already passed for this GW (and it
   *  isn't finished), so matches are imminent / underway even though FPL
   *  hasn't flipped `is_current` yet. */
  const deadlineMs =
    parseInstantMs(selected?.deadline_time) ??
    parseInstantMs(eventSnapshot?.deadline_time);
  if (deadlineMs != null && deadlineMs <= Number(nowMs)) {
    return true;
  }

  return false;
}

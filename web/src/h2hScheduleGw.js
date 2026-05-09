/**
 * Head-to-head schedule helpers — keep UI defaults aligned with ingested `details.json`
 * when FPL bootstrap `events.current` / `events.next` run ahead of finished H2H rows.
 */

/**
 * @param {object[] | null | undefined} matches
 * @returns {number | null}
 */
export function lastFinishedH2hGameweek(matches) {
  const finished = (matches || []).filter((m) => m?.finished === true)
  if (!finished.length) return null
  let max = 0
  for (const m of finished) {
    const ev = Number(m.event)
    if (Number.isFinite(ev) && ev > max) max = ev
  }
  return max || null
}

/**
 * @param {object[] | null | undefined} matches
 * @param {number} gw
 */
export function h2hGameweekFullyFinished(matches, gw) {
  const g = Number(gw)
  if (!Number.isFinite(g)) return false
  const rows = (matches || []).filter((m) => Number(m.event) === g)
  return rows.length > 0 && rows.every((m) => m.finished === true)
}

/**
 * @param {object[] | null | undefined} rows — drops-gw-live rows
 * @param {number} gw
 */
export function waiverAnalyticsHasGameweek(rows, gw) {
  const g = Number(gw)
  if (!Number.isFinite(g)) return false
  const list = Array.isArray(rows) ? rows : rows?.rows
  if (!Array.isArray(list)) return false
  return list.some((r) => Number(r.gameweek) === g)
}

/**
 * @param {{
 *   matches?: object[],
 *   bootstrapCurrent?: number | null,
 *   previousGameweek?: number | null,
 *   nextEvent?: number | null,
 *   fplLiveLandingGw?: number | null,
 *   explicitLiveGw?: number | null,
 * }} p
 */
export function resolveLiveGameweek({
  matches,
  bootstrapCurrent,
  previousGameweek,
  nextEvent,
  fplLiveLandingGw,
  explicitLiveGw,
}) {
  const explicit = Number(explicitLiveGw)
  if (Number.isFinite(explicit) && explicit >= 1) return explicit

  /**
   * Live tab must track draft `event/{gw}/live`, which follows FPL `events.current`.
   * Do not require `details.json` H2H rows to be finished — that file can lag the calendar
   * or GW36 can be “live” before all eight fixtures are `finished`.
   */
  const fromCalendar = Number(bootstrapCurrent ?? fplLiveLandingGw)
  if (Number.isFinite(fromCalendar) && fromCalendar >= 1 && fromCalendar <= 38) {
    return fromCalendar
  }

  const landing = Number(fplLiveLandingGw)
  if (Number.isFinite(landing) && landing >= 1 && landing <= 38) return landing

  const next = Number(nextEvent)
  if (Number.isFinite(next) && next >= 1 && next <= 38) return next

  const lastFinished = lastFinishedH2hGameweek(matches)
  if (lastFinished != null) return lastFinished

  const prev = Number(previousGameweek)
  if (Number.isFinite(prev) && prev >= 1) return prev
  return 1
}

/**
 * @param {{
 *   matches?: object[],
 *   latestProcessedWaiverGw?: number | null,
 *   waiverOutGwRows?: object[] | { rows?: object[] },
 *   bootstrapCurrent?: number | null,
 *   bootstrapNext?: number | null,
 *   previousGameweek?: number | null,
 * }} p
 */
export function resolveDefaultWaiverGameweek({
  matches,
  latestProcessedWaiverGw,
  waiverOutGwRows,
  bootstrapCurrent,
  bootstrapNext,
  previousGameweek,
}) {
  const lp = Number(latestProcessedWaiverGw)
  const nLp = Number.isFinite(lp) ? lp : 0
  const nNext = Number(bootstrapNext)
  const nCur = Number(bootstrapCurrent)

  if (
    Number.isFinite(nNext) &&
    nNext >= 1 &&
    nNext <= 38 &&
    nNext > nLp &&
    waiverAnalyticsHasGameweek(waiverOutGwRows, nNext)
  ) {
    return nNext
  }
  if (nLp >= 1) return nLp

  const lastFinished = lastFinishedH2hGameweek(matches)
  if (lastFinished != null) return lastFinished

  const pg = Number(previousGameweek)
  if (Number.isFinite(pg) && pg >= 1) return pg
  return Math.min(Math.max(nCur, nNext, 1), 38)
}

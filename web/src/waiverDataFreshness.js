/**
 * Waivers tab freshness copy — explains why moves may lag FPL after `waivers_time`.
 * TCLOT ships static JSON from gated GitHub Actions deploys, not live FPL polling.
 */

import {
  WAIVER_BURST_WINDOW_MS,
  WAIVER_FRESH_WINDOW_MS,
  WAIVER_GRACE_START_MS,
  msUntilNextHourlyCron,
  msUntilNextQuarterHour,
  postWaiverRefreshEvent,
  waiversTimeForGameweek,
} from './waiverRefreshSchedule.js'

/**
 * @param {number} builtAtMs
 * @param {number} nowMs
 * @returns {string | null}
 */
export function formatLeagueDataBuiltAgo(builtAtMs, nowMs = Date.now()) {
  if (!Number.isFinite(builtAtMs) || !Number.isFinite(nowMs)) return null
  const deltaMs = Math.max(0, nowMs - builtAtMs)
  const minutes = Math.floor(deltaMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/**
 * @param {{
 *   draftEvents?: object[] | null,
 *   leagueDataBuiltAt?: string | null,
 *   selectedGw?: number | null,
 *   hasMovesForSelectedGw?: boolean,
 *   isGwInProcessedList?: boolean,
 *   now?: Date,
 * }} input
 * @returns {{ kind: 'grace' | 'awaiting-deploy' | 'stale', title: string, message: string } | null}
 */
export function deriveWaiverFreshnessNotice({
  draftEvents,
  leagueDataBuiltAt,
  selectedGw,
  hasMovesForSelectedGw = false,
  isGwInProcessedList = false,
  now = new Date(),
}) {
  if (!Array.isArray(draftEvents) || !draftEvents.length) return null
  const gw = Number(selectedGw)
  if (!Number.isFinite(gw) || gw < 1) return null

  const waiversTimeRaw = waiversTimeForGameweek(draftEvents, gw)
  if (!waiversTimeRaw) return null
  const waiversTimeMs = Date.parse(waiversTimeRaw)
  if (!Number.isFinite(waiversTimeMs)) return null

  const nowMs = now.getTime()
  if (nowMs < waiversTimeMs) return null

  const builtAtMs = leagueDataBuiltAt ? Date.parse(leagueDataBuiltAt) : NaN
  const graceEndMs = waiversTimeMs + WAIVER_GRACE_START_MS
  const freshWindowEndMs = waiversTimeMs + WAIVER_FRESH_WINDOW_MS
  const inPostWaiverWindow = nowMs > graceEndMs && nowMs < freshWindowEndMs
  const dataBuiltAfterGrace = Number.isFinite(builtAtMs) && builtAtMs >= graceEndMs
  const gwPresentInBuild = isGwInProcessedList || hasMovesForSelectedGw

  if (dataBuiltAfterGrace && gwPresentInBuild) return null

  if (nowMs < graceEndMs) {
    return {
      kind: 'grace',
      title: 'Waiver results pending',
      message:
        'FPL usually publishes successful claims within ~10 minutes of waivers running. This site starts refreshing about 10 minutes after waivers.',
    }
  }

  if (inPostWaiverWindow) {
    const inBurst = nowMs < waiversTimeMs + WAIVER_BURST_WINDOW_MS
    const msToNext = inBurst ? msUntilNextQuarterHour(nowMs) : msUntilNextHourlyCron(nowMs)
    const minsToNext = Math.max(1, Math.ceil(msToNext / 60_000))
    const builtAgo = formatLeagueDataBuiltAgo(builtAtMs, nowMs)
    const builtPart = builtAgo ? ` Site data last built ${builtAgo}.` : ''
    const cadence = inBurst
      ? 'Moves appear after the site redeploys (every ~15 min for the first 90 min after waivers). Typical total delay is 15–35 minutes.'
      : 'Moves appear after the site redeploys (hourly for ~36h after waivers).'
    return {
      kind: 'awaiting-deploy',
      title: 'Waivers not in this build yet',
      message: `${cadence} Next automatic refresh in ~${minsToNext} min.${builtPart} Reload after deploy — refreshing alone won't fetch new moves.`,
    }
  }

  if (!gwPresentInBuild && nowMs >= waiversTimeMs) {
    const builtAgo = formatLeagueDataBuiltAgo(builtAtMs, nowMs)
    const builtPart = builtAgo ? ` Site data last built ${builtAgo}.` : ''
    return {
      kind: 'stale',
      title: 'Waivers may be missing',
      message: `This gameweek is not in the deployed waiver data yet.${builtPart} Run Actions → Deploy site to Pages → Run workflow (or push to main) to refresh.`,
    }
  }

  return null
}

/**
 * Whether the selected GW is inside the post-waiver refresh window (for tests / diagnostics).
 *
 * @param {object[] | null | undefined} draftEvents
 * @param {number} gameweek
 * @param {number} [nowMs]
 */
export function isInPostWaiverRefreshWindow(draftEvents, gameweek, nowMs = Date.now()) {
  const hit = postWaiverRefreshEvent(draftEvents, nowMs)
  return hit != null && Number(hit.id) === Number(gameweek)
}

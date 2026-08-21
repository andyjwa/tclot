/**
 * Season-open landing: the site opens on Moves → Draft until the first GW
 * waivers run, then Waivers. Independent of the retired preseason hub.
 *
 * Exception: once bootstrap resolves and the current GW is live (deadline
 * passed, not finished), cold load lands on FPL Live → Scores instead.
 */

/** Cold-load dashboard view. Players hash and archive views still win. */
export function initialDashboardView({
  hasPlayersHash = false,
  archiveView = false,
} = {}) {
  if (hasPlayersHash) return 'players'
  if (archiveView) return 'standings'
  return 'teamSelection'
}

/**
 * Whether a cold-load session should redirect from Moves to FPL Live → Scores.
 * Bootstrap status is usually unknown on first paint, so App applies this once
 * `deriveBrandHeaderStatus` resolves (not in `initialDashboardView`).
 *
 * @param {{
 *   status?: 'live' | 'idle' | 'pre-season' | 'unknown' | null,
 *   hasPlayersHash?: boolean,
 *   archiveView?: boolean,
 *   navLocked?: boolean,
 *   dashboardView?: string,
 * }} [p]
 * @returns {boolean}
 */
export function shouldDefaultToLiveScores({
  status = null,
  hasPlayersHash = false,
  archiveView = false,
  navLocked = false,
  dashboardView = 'teamSelection',
} = {}) {
  if (status !== 'live') return false
  if (hasPlayersHash || archiveView || navLocked) return false
  // Only nudge the season-open Moves landing — never yank an explicit nav.
  return dashboardView === 'teamSelection'
}

function eventsArray(events) {
  if (Array.isArray(events)) return events
  if (events && Array.isArray(events.data)) return events.data
  return []
}

/** Earliest `waivers_time` on the FPL Draft events calendar, as epoch ms. */
export function firstWaiversTimeMs(events) {
  let first = null
  for (const e of eventsArray(events)) {
    const ms = Date.parse(e?.waivers_time)
    if (!Number.isFinite(ms)) continue
    if (first == null || ms < first) first = ms
  }
  return first
}

/**
 * @param {unknown} events draft bootstrap `events` list or `{ data: [] }`
 * @param {Date} [now]
 * @returns {'draft' | 'waivers'}
 */
export function initialMovesTab(events, now = new Date()) {
  const first = firstWaiversTimeMs(events)
  if (first == null) return 'draft'
  return now.getTime() < first ? 'draft' : 'waivers'
}

/**
 * Season-open landing: the site opens on Moves → Draft until the first GW
 * waivers run, then Waivers. Independent of the retired preseason hub.
 *
 * Once the FPL calendar loads, `seasonPhaseLanding` refines the landing to
 * follow the gameweek cycle: Scores while a GW is live, Table after a GW
 * completes (before the next waiver deadline), Waivers once that deadline
 * has passed.
 */

import { pickDeadlinePassedLiveEvent } from './fplLiveCalendar.js'

/** Cold-load dashboard view. Players hash and archive views still win. */
export function initialDashboardView({
  hasPlayersHash = false,
  archiveView = false,
} = {}) {
  if (hasPlayersHash) return 'players'
  if (archiveView) return 'standings'
  return 'teamSelection'
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

/**
 * Where a cold load should land based on the gameweek cycle:
 *
 * - `'scores'`  — a GW is live (deadline passed, not finished)
 * - `'waivers'` — the upcoming GW's waiver deadline has passed, GW not live yet
 * - `'table'`   — a GW has completed, upcoming waiver deadline not reached
 *                 (also season complete: nothing upcoming)
 * - `null`      — pre-season / no calendar yet (keep the Moves landing)
 *
 * @param {{ currentEvent?: object | null, nextEvent?: object | null, lastFinishedEvent?: object | null }} events
 * @param {Date} [now]
 * @returns {'scores' | 'waivers' | 'table' | null}
 */
export function seasonPhaseLanding(
  { currentEvent = null, nextEvent = null, lastFinishedEvent = null } = {},
  now = new Date(),
) {
  const nowMs = now.getTime()
  const liveEvent = pickDeadlinePassedLiveEvent(
    [currentEvent, nextEvent].filter(Boolean),
    now,
  )
  if (liveEvent) return 'scores'
  const currentUnfinished = currentEvent && currentEvent.finished !== true
  if (currentUnfinished) {
    const deadlineMs = Date.parse(currentEvent.deadline_time)
    if (Number.isFinite(deadlineMs) && deadlineMs <= nowMs) return 'scores'
  }
  if (!lastFinishedEvent) return null
  const upcoming = currentUnfinished ? currentEvent : nextEvent
  const waiversMs = Date.parse(upcoming?.waivers_time)
  if (Number.isFinite(waiversMs) && waiversMs <= nowMs) return 'waivers'
  return 'table'
}

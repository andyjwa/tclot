/**
 * Brand-header status strip helpers — derive the `live` / `idle` / `pre-season` state
 * plus the human-readable copy from data already in `App.jsx` (draft bootstrap events
 * + locally-ingested H2H matches). No new network calls.
 *
 * Spec source: variant 4 of the HEADER · POST-PR-#2 EVOLUTION mockup showcase
 * (`Mockup.jsx#HeroVariantBSeasonAndCrests` + `HeroVariantBStatusStrip`).
 */

import { formatKickoffLabel } from './liveScoresDerivations.js'

/**
 * Compact season label for the status strip — `25/26` for the 2025/26 season.
 * The brand header itself shows the wider `2025/26` form; the strip uses the
 * tighter `25/26` form (matches the mockup copy "25/26 season starts …").
 *
 * @param {string | null | undefined} season Like `2025/26`.
 * @returns {string}
 */
export function seasonShortLabel(season) {
  if (typeof season !== 'string') return ''
  const m = season.match(/^(\d{2})(\d{2})\/(\d{2})$/)
  if (m) return `${m[2]}/${m[3]}`
  return season
}

/**
 * Format an ISO deadline ('2025-08-15T18:30:00Z') as `Aug 15`. Returns null on bad input.
 * @param {string | null | undefined} iso
 * @returns {string | null}
 */
export function formatDeadlineDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(d)
  } catch {
    return null
  }
}

/**
 * Format a timestamp as a local month/day + time label, e.g. `Mar 14 at 13:30`.
 * The waiver cutoff and gameweek deadline are moments, not date-only events,
 * so idle-state milestone copy always uses this richer form.
 *
 * @param {string | number | Date | null | undefined} value
 * @returns {string | null}
 */
export function formatMilestoneDateTime(value) {
  if (value == null) return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  try {
    const date = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(d)
    const time = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d)
    return `${date} at ${time}`
  } catch {
    return null
  }
}

/**
 * Compact countdown to a future milestone. Days/hours are favored for long
 * waits; minutes appear inside the final day so the header stays useful as
 * the cutoff approaches.
 *
 * @param {string | number | Date | null | undefined} target
 * @param {Date} now
 * @returns {string | null}
 */
export function formatMilestoneCountdown(target, now = new Date()) {
  if (target == null) return null
  const d = target instanceof Date ? target : new Date(target)
  if (Number.isNaN(d.getTime()) || Number.isNaN(now.getTime())) return null
  const totalMinutes = Math.max(0, Math.ceil((d.getTime() - now.getTime()) / 60_000))
  if (totalMinutes <= 0) return null
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  return `${minutes}m`
}

/**
 * Coerce to a finite positive integer, or return null. Used to gate the
 * optional per-fixture live fields so 0 / NaN never leak into the UI.
 * @param {unknown} v
 * @returns {number | null}
 */
function finitePositiveOrNull(v) {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

/** 24 hours in ms — the cutoff for swapping the month-day `Mar 15` label
 * to the tighter `Sat 16:30` day-of-week + time-of-day form. Matches the
 * spec for PR #5h (absorb live pill into brand header). */
const KICKOFF_LABEL_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * `Sat 16:30` label when the next deadline is within the next 24h, null
 * otherwise. Past deadlines also return null so the strip never surfaces
 * an already-elapsed kickoff. Reuses `formatKickoffLabel` from
 * `liveScoresDerivations.js` so the formatting stays in lockstep with
 * the (now-retired) live tile pill copy.
 *
 * @param {string | null | undefined} deadlineIso
 * @param {Date} now
 * @returns {string | null}
 */
function kickoffLabelWithin24h(deadlineIso, now) {
  if (!deadlineIso) return null
  const d = new Date(deadlineIso)
  if (Number.isNaN(d.getTime())) return null
  const delta = d.getTime() - now.getTime()
  if (delta <= 0) return null
  if (delta > KICKOFF_LABEL_WINDOW_MS) return null
  return formatKickoffLabel(deadlineIso, now)
}

/**
 * Derive the brand-header status strip state purely from bootstrap-derived data.
 *
 * Status definitions:
 * - `live`: `events.current` exists, its deadline has passed, and `finished === false`.
 *           Optional `liveFixtureCount` / `minute` (from `useFplFixtureLiveSummary`,
 *           PR #4) ride along on the result — when both are absent the strip degrades
 *           to `● GW {N} · Live` (pre-kickoff, between fixture windows, or fetch
 *           failure). Optional `finishedFixtureCount` / `totalFixtureCount` drive
 *           the `progressLabel` ("2 of 10 complete") added in PR #5h.
 * - `idle`: `events.current` is finished (between GWs). Before the waiver
 *           cutoff (24h before the next GW deadline), the next milestone is
 *           `Waivers in {countdown} · {dateTime}`. After that cutoff, it
 *           advances to `GW {next} starts in {countdown} · {dateTime}`.
 * - `pre-season`: no event has finished yet. Copy: `Pre-season · {seasonShort}
 *           season starts {date}`. Same 24h kickoff window swap as `idle`
 *           (`{seasonShort} season kicks off {kickoffLabel}`).
 *
 * @param {{
 *   currentEvent?: object | null,
 *   nextEvent?: object | null,
 *   lastFinishedEvent?: object | null,
 *   season?: string,
 *   now?: Date,
 *   liveFixtureCount?: number | null,
 *   minute?: number | null,
 *   finishedFixtureCount?: number | null,
 *   totalFixtureCount?: number | null,
 * }} p
 * @returns {{
 *   status: 'live' | 'idle' | 'pre-season' | 'unknown',
 *   liveGw: number | null,
 *   lastFinishedGw: number | null,
 *   nextGw: number | null,
 *   nextDeadlineLabel: string | null,
 *   seasonShort: string,
 *   liveFixtureCount: number | null,
 *   minute: number | null,
 *   progressLabel: string | null,
 *   kickoffLabel: string | null,
 *   idleMilestone: {
 *     kind: 'waivers' | 'gameweek',
 *     countdownLabel: string,
 *     dateTimeLabel: string,
 *   } | null,
 * }}
 */
export function deriveBrandHeaderStatus({
  currentEvent,
  nextEvent,
  lastFinishedEvent,
  season = '2025/26',
  now = new Date(),
  liveFixtureCount = null,
  minute = null,
  finishedFixtureCount = null,
  totalFixtureCount = null,
}) {
  const seasonShort = seasonShortLabel(season)
  const lastFinishedGw =
    lastFinishedEvent?.id != null ? Number(lastFinishedEvent.id) : null
  const nextGw = nextEvent?.id != null ? Number(nextEvent.id) : null

  if (!currentEvent && !nextEvent && !lastFinishedEvent) {
    return {
      status: 'unknown',
      liveGw: null,
      lastFinishedGw: null,
      nextGw: null,
      nextDeadlineLabel: null,
      seasonShort,
      liveFixtureCount: null,
      minute: null,
      progressLabel: null,
      kickoffLabel: null,
      idleMilestone: null,
    }
  }

  if (currentEvent && currentEvent.finished !== true) {
    const deadline = currentEvent.deadline_time
      ? new Date(currentEvent.deadline_time)
      : null
    const deadlinePassed =
      deadline && !Number.isNaN(deadline.getTime()) && deadline.getTime() <= now.getTime()
    if (deadlinePassed) {
      const totalNum = Number(totalFixtureCount)
      const finishedNum = Number(finishedFixtureCount)
      const progressLabel =
        Number.isFinite(totalNum) &&
        totalNum > 0 &&
        Number.isFinite(finishedNum) &&
        finishedNum >= 0
          ? `${finishedNum} of ${totalNum} complete`
          : null
      return {
        status: 'live',
        liveGw: Number(currentEvent.id),
        lastFinishedGw,
        nextGw,
        nextDeadlineLabel: formatDeadlineDate(nextEvent?.deadline_time),
        seasonShort,
        liveFixtureCount: finitePositiveOrNull(liveFixtureCount),
        /** Allow 0' (kickoff whistle) through — `>= 0` lets us show "0'" briefly
         * before FPL ticks the counter. Negative / NaN coerce to null. */
        minute:
          minute == null || !Number.isFinite(Number(minute)) || Number(minute) < 0
            ? null
            : Number(minute),
        progressLabel,
        kickoffLabel: null,
        idleMilestone: null,
      }
    }
  }

  if (lastFinishedEvent) {
    const nextDeadline = nextEvent?.deadline_time
      ? new Date(nextEvent.deadline_time)
      : null
    const nextDeadlineValid =
      nextDeadline && !Number.isNaN(nextDeadline.getTime())
    const waiverDeadline = nextDeadlineValid
      ? new Date(nextDeadline.getTime() - KICKOFF_LABEL_WINDOW_MS)
      : null
    const waiverPending =
      waiverDeadline && waiverDeadline.getTime() > now.getTime()
    const milestoneTarget = waiverPending ? waiverDeadline : nextDeadline
    const countdownLabel = milestoneTarget
      ? formatMilestoneCountdown(milestoneTarget, now)
      : null
    const dateTimeLabel = milestoneTarget
      ? formatMilestoneDateTime(milestoneTarget)
      : null
    const idleMilestone =
      countdownLabel && dateTimeLabel
        ? {
            kind: waiverPending ? 'waivers' : 'gameweek',
            countdownLabel,
            dateTimeLabel,
          }
        : null
    return {
      status: 'idle',
      liveGw: null,
      lastFinishedGw,
      nextGw,
      nextDeadlineLabel: formatDeadlineDate(nextEvent?.deadline_time),
      seasonShort,
      liveFixtureCount: null,
      minute: null,
      progressLabel: null,
      kickoffLabel: kickoffLabelWithin24h(nextEvent?.deadline_time, now),
      idleMilestone,
    }
  }

  return {
    status: 'pre-season',
    liveGw: null,
    lastFinishedGw: null,
    nextGw: nextGw ?? 1,
    nextDeadlineLabel: formatDeadlineDate(nextEvent?.deadline_time),
    seasonShort,
    liveFixtureCount: null,
    minute: null,
    progressLabel: null,
    kickoffLabel: kickoffLabelWithin24h(nextEvent?.deadline_time, now),
    idleMilestone: null,
  }
}

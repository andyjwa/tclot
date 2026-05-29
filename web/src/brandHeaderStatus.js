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
 * tighter `25/26` form (matches the mockup copy "GW 1 of 25/26 starts …").
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
 * - `idle`: `events.current` is finished (between GWs). Copy: `GW {last} complete ·
 *           GW {next} of {seasonShort} starts {date}`. When the deadline is within
 *           24h the consumer swaps to `GW {next} kicks off {kickoffLabel}` using
 *           the tighter `Sat 16:30` form.
 * - `pre-season`: no event has finished yet. Copy: `Pre-season · GW 1 of {seasonShort}
 *           starts {date}`. Same 24h kickoff window swap as `idle`.
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
      }
    }
  }

  if (lastFinishedEvent) {
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
  }
}

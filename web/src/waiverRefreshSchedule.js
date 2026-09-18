/**
 * Shared waiver deploy schedule — used by the GitHub Actions gate
 * (`web/scripts/waiver-refresh-gate.mjs`) and the Waivers tab freshness notice.
 * See DEPLOY.md § "Waiver visibility latency".
 */

/**
 * FPL usually exposes successful waiver rows within ~10 minutes of this timestamp
 * (observed on the FPL Draft site). The gate waits this long before trusting rows.
 */
export const WAIVER_GRACE_START_MS = 10 * 60 * 1000
/**
 * "Burst" window right after each `waivers_time`: a high-frequency 15-minute cron is
 * allowed to deploy during (waivers_time + grace .. waivers_time + burst) so freshly
 * processed waivers appear within minutes instead of waiting for the next hourly cron.
 * Outside this window the burst cron skips and the hourly cadence takes over.
 */
export const WAIVER_BURST_WINDOW_MS = 90 * 60 * 1000
/** Re-run builds at most this long after each `waivers_time` to pick up stragglers. */
export const WAIVER_FRESH_WINDOW_MS = 36 * 60 * 60 * 1000
/**
 * After the PL GW deadline, draft `details.json` H2H rows often flip to `finished` before
 * the next `waivers_time`. Hourly cron must still ingest in that gap — and must not wait
 * for FPL's lagging event-level `finished` / `data_checked` flags (those can stay false
 * for a day+ after the football ends while provisional points are already on the matches).
 */
export const POST_DEADLINE_INGEST_DELAY_MS = 2 * 60 * 60 * 1000
/** Stop hourly post-deadline ingests once the next GW deadline is this close. */
export const POST_DEADLINE_STOP_BEFORE_NEXT_DEADLINE_MS = 3 * 60 * 60 * 1000
/**
 * After the lineup deadline, bake locked XIs into weekly-recaps Preview.
 * The 2h post-deadline ingest wait is for H2H `finished` rows — Preview must
 * go live at lock, not two hours later. Burst cron also uses this window.
 */
export const LINEUP_LOCK_WINDOW_MS = 3 * 60 * 60 * 1000
/**
 * Dedicated Preview backup clocks (GitHub ping + Worker) keep retrying this
 * long after lock. GitHub often drops every slot inside the 3h burst window,
 * and the ping workflow itself may not start again for 4–5 hours.
 */
export const PREVIEW_CATCHUP_WINDOW_MS = 12 * 60 * 60 * 1000
/**
 * Daily catch-all crons (`30 5/13/21 * * *`, ~05:30/13:30/21:30 UTC) always allow full refresh.
 * Accept a few minutes' drift around each slot.
 */
export const DAILY_UTC_WINDOWS = [5, 13, 21].map((h) => ({
  startMin: h * 60 + 26,
  endMin: h * 60 + 45,
}))
/** In the day before a GW's `waivers_time`, refresh on this UTC-hour cadence. */
export const PRE_WAIVER_WINDOW_MS = 24 * 60 * 60 * 1000
export const PRE_WAIVER_CADENCE_HOURS = 3

function minuteOfDayUtc(d) {
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

/** @param {Date} [now] */
export function inDailyCatchAllWindow(now = new Date()) {
  const m = minuteOfDayUtc(now)
  return DAILY_UTC_WINDOWS.some((w) => m >= w.startMin && m <= w.endMin)
}

/**
 * GW whose post-deadline ingest window is active: from (deadline + 2h) until
 * (next deadline − 3h). Does **not** require event `finished` — FPL often leaves
 * that false long after provisional H2H points are already on `details.json`.
 *
 * @param {object[]} eventList — bootstrap `events.data`
 * @param {number} nowMs
 * @returns {{ id: number, deadline: string } | null}
 */
export function postDeadlineIngestEvent(eventList, nowMs) {
  if (!Array.isArray(eventList)) return null
  const now = Number(nowMs)
  if (!Number.isFinite(now)) return null

  const rows = eventList
    .map((e) => {
      const id = Number(e?.id)
      const deadline = e?.deadline_time
      if (!Number.isFinite(id) || typeof deadline !== 'string' || !deadline) return null
      const dl = Date.parse(deadline)
      if (!Number.isFinite(dl)) return null
      return {
        id,
        deadline,
        dl,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.id - b.id)

  // Prefer the latest GW still inside its post-deadline window (most relevant for
  // picking up just-closed H2H scores); fall back to any earlier open window.
  let best = null
  for (let i = 0; i < rows.length; i++) {
    const cur = rows[i]
    const ingestAfter = cur.dl + POST_DEADLINE_INGEST_DELAY_MS
    if (now < ingestAfter) continue

    const next = rows[i + 1]
    if (next) {
      const stopAt = next.dl - POST_DEADLINE_STOP_BEFORE_NEXT_DEADLINE_MS
      if (now >= stopAt) continue
    }

    best = { id: cur.id, deadline: cur.deadline }
  }
  return best
}

/**
 * GW whose lineup-lock refresh window is active: from `deadline_time` until
 * deadline + windowMs. Used so weekly Preview (and upcoming XI snapshots) deploy
 * as soon as FPL XIs lock, instead of waiting for the 2h post-deadline ingest.
 *
 * @param {object[]} eventList — bootstrap `events.data`
 * @param {number} nowMs
 * @param {number} windowMs
 * @returns {{ id: number, deadline: string } | null}
 */
function lockWindowEvent(eventList, nowMs, windowMs) {
  if (!Array.isArray(eventList)) return null
  const now = Number(nowMs)
  if (!Number.isFinite(now) || !Number.isFinite(windowMs)) return null

  let best = null
  for (const e of eventList) {
    const id = Number(e?.id)
    const deadline = e?.deadline_time
    if (!Number.isFinite(id) || typeof deadline !== 'string' || !deadline) continue
    const dl = Date.parse(deadline)
    if (!Number.isFinite(dl)) continue
    if (now < dl) continue
    if (now >= dl + windowMs) continue
    if (!best || id > best.id) best = { id, deadline }
  }
  return best
}

/** Burst / hourly gate: deadline until +3h. */
export function postLineupLockRefreshEvent(eventList, nowMs) {
  return lockWindowEvent(eventList, nowMs, LINEUP_LOCK_WINDOW_MS)
}

/** Preview backup clocks: deadline until +12h, so a dropped 3h burst can still land. */
export function previewCatchupEvent(eventList, nowMs) {
  return lockWindowEvent(eventList, nowMs, PREVIEW_CATCHUP_WINDOW_MS)
}

/**
 * Every-3-hours refresh in the 24 hours leading up to a GW's `waivers_time`.
 *
 * @param {object[]} eventList — bootstrap `events.data`
 * @param {number} nowMs
 * @returns {{ id: number, waiversTime: string } | null}
 */
export function preWaiverRefreshEvent(eventList, nowMs) {
  if (!Array.isArray(eventList)) return null
  const now = Number(nowMs)
  if (!Number.isFinite(now)) return null
  if (new Date(now).getUTCHours() % PRE_WAIVER_CADENCE_HOURS !== 0) return null
  for (const e of eventList) {
    const raw = e?.waivers_time
    if (typeof raw !== 'string' || !raw) continue
    const wt = Date.parse(raw)
    if (!Number.isFinite(wt)) continue
    if (now >= wt - PRE_WAIVER_WINDOW_MS && now < wt) {
      return { id: e.id, waiversTime: raw }
    }
  }
  return null
}

/**
 * GW whose post-waiver refresh window is active (waivers_time + 20m … + 36h).
 *
 * @param {object[]} eventList
 * @param {number} nowMs
 * @returns {{ id: number, waiversTime: string, waiversTimeMs: number } | null}
 */
export function postWaiverRefreshEvent(eventList, nowMs) {
  if (!Array.isArray(eventList)) return null
  const now = Number(nowMs)
  if (!Number.isFinite(now)) return null

  let best = null
  for (const e of eventList) {
    const raw = e?.waivers_time
    if (typeof raw !== 'string' || !raw) continue
    const wt = Date.parse(raw)
    if (!Number.isFinite(wt)) continue
    const start = wt + WAIVER_GRACE_START_MS
    const end = wt + WAIVER_FRESH_WINDOW_MS
    if (now > start && now < end) {
      const id = Number(e.id)
      if (!Number.isFinite(id)) continue
      if (!best || wt > best.waiversTimeMs) best = { id, waiversTime: raw, waiversTimeMs: wt }
    }
  }
  return best
}

/**
 * GW whose burst window is active (waivers_time + grace … waivers_time + 90m).
 * Used by the high-frequency 15-minute cron so waivers land within minutes.
 *
 * @param {object[]} eventList
 * @param {number} nowMs
 * @returns {{ id: number, waiversTime: string, waiversTimeMs: number } | null}
 */
export function burstWaiverRefreshEvent(eventList, nowMs) {
  if (!Array.isArray(eventList)) return null
  const now = Number(nowMs)
  if (!Number.isFinite(now)) return null

  let best = null
  for (const e of eventList) {
    const raw = e?.waivers_time
    if (typeof raw !== 'string' || !raw) continue
    const wt = Date.parse(raw)
    if (!Number.isFinite(wt)) continue
    const start = wt + WAIVER_GRACE_START_MS
    const end = wt + WAIVER_BURST_WINDOW_MS
    if (now > start && now < end) {
      const id = Number(e.id)
      if (!Number.isFinite(id)) continue
      if (!best || wt > best.waiversTimeMs) best = { id, waiversTime: raw, waiversTimeMs: wt }
    }
  }
  return best
}

/**
 * @param {object[]} eventList
 * @param {number} gameweek
 * @returns {string | null}
 */
export function waiversTimeForGameweek(eventList, gameweek) {
  if (!Array.isArray(eventList)) return null
  const gw = Number(gameweek)
  if (!Number.isFinite(gw)) return null
  const row = eventList.find((e) => Number(e?.id) === gw)
  const raw = row?.waivers_time
  return typeof raw === 'string' && raw ? raw : null
}

/** Milliseconds until the next UTC top-of-hour (hourly deploy cron). */
export function msUntilNextHourlyCron(nowMs) {
  const d = new Date(nowMs)
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours() + 1, 0, 0, 0))
  return Math.max(0, next.getTime() - nowMs)
}

/** Milliseconds until the next :00/:15/:30/:45 (15-minute burst cron). */
export function msUntilNextQuarterHour(nowMs) {
  const period = 15 * 60 * 1000
  const next = Math.ceil((nowMs + 1) / period) * period
  return Math.max(0, next - nowMs)
}

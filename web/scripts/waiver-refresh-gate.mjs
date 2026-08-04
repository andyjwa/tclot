#!/usr/bin/env node
/**
 * GitHub Actions scheduled deploy gate: only "proceed" when a full ingest/build is worth
 * doing — i.e. soon after a gameweek's FPL `waivers_time` (so transactions land in
 * `drops-gw-live` after build-waiver-gw-analytics) or at the daily UTC catch-all.
 *
 * Not invoked for push / workflow_dispatch (the workflow skips this logic there).
 * Data: draft bootstrap-static { events: { data: [{ id, waivers_time }, ...] } }.
 */
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const DRAFT_BOOTSTRAP = 'https://draft.premierleague.com/api/bootstrap-static'
/** FPL usually exposes successful waiver rows a short time after this timestamp */
const WAIVER_GRACE_START_MS = 20 * 60 * 1000
/** Re-run builds at most this long after each `waivers_time` to pick up stragglers */
const WAIVER_FRESH_WINDOW_MS = 36 * 60 * 60 * 1000
/**
 * After the PL GW deadline, draft `details.json` H2H rows often flip to `finished` before
 * the next `waivers_time`. Hourly cron must still ingest in that gap (otherwise the site can
 * sit on an old committed `details.json` until the next waiver window or 05:30 UTC daily).
 */
const POST_DEADLINE_INGEST_DELAY_MS = 2 * 60 * 60 * 1000
/** Stop hourly post-deadline ingests once the next GW deadline is this close */
const POST_DEADLINE_STOP_BEFORE_NEXT_DEADLINE_MS = 3 * 60 * 60 * 1000
/**
 * When the daily cron `30 5 * * *` fires (~05:30 UTC), always allow full refresh
 * (also covers missed windows). Accept a few minutes' drift.
 */
const DAILY_UTC = { startMin: 5 * 60 + 26, endMin: 5 * 60 + 45 } // 05:26–05:45

function minuteOfDayUtc(d) {
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

function inDailyCatchAllWindow() {
  const m = minuteOfDayUtc(new Date())
  return m >= DAILY_UTC.startMin && m <= DAILY_UTC.endMin
}

/**
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
        finished: e?.finished === true,
        deadline,
        dl,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.id - b.id)

  for (let i = 0; i < rows.length; i++) {
    const cur = rows[i]
    if (!cur.finished) continue
    const ingestAfter = cur.dl + POST_DEADLINE_INGEST_DELAY_MS
    if (now < ingestAfter) continue

    const next = rows[i + 1]
    if (next) {
      const stopAt = next.dl - POST_DEADLINE_STOP_BEFORE_NEXT_DEADLINE_MS
      if (now >= stopAt) continue
    }

    return { id: cur.id, deadline: cur.deadline }
  }
  return null
}

async function main() {
  if (inDailyCatchAllWindow()) {
    console.log(
      'waiver-refresh-gate: in daily 05:26–05:45 UTC window — run full deploy',
    )
    process.exit(0)
  }

  const r = await fetch(DRAFT_BOOTSTRAP, {
    headers: { Accept: 'application/json' },
  })
  if (!r.ok) {
    console.error(`waiver-refresh-gate: bootstrap HTTP ${r.status} — skip deploy`)
    process.exit(1)
  }
  const j = await r.json()
  const list = j?.events?.data
  if (!Array.isArray(list)) {
    console.error('waiver-refresh-gate: no events.data — skip')
    process.exit(1)
  }

  const now = Date.now()
  for (const e of list) {
    const raw = e?.waivers_time
    if (typeof raw !== 'string' || !raw) continue
    const wt = Date.parse(raw)
    if (!Number.isFinite(wt)) continue
    const start = wt + WAIVER_GRACE_START_MS
    const end = wt + WAIVER_FRESH_WINDOW_MS
    if (now > start && now < end) {
      console.log(
        `waiver-refresh-gate: inside post-waivers window for GW${e.id} (waivers_time ${raw}) — run deploy`,
      )
      process.exit(0)
    }
  }

  const postGw = postDeadlineIngestEvent(list, now)
  if (postGw) {
    console.log(
      `waiver-refresh-gate: GW${postGw.id} finished and past deadline (${postGw.deadline}) — run deploy for league details`,
    )
    process.exit(0)
  }

  console.log(
    'waiver-refresh-gate: not in post-waivers, post-deadline, or daily window — skip deploy',
  )
  process.exit(1)
}

const invokedDirectly =
  Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === process.argv[1]
if (invokedDirectly) {
  main().catch((e) => {
    console.error('waiver-refresh-gate:', e)
    process.exit(1)
  })
}

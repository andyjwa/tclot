#!/usr/bin/env node
/**
 * GitHub Actions scheduled deploy gate: only "proceed" when a full ingest/build is worth
 * doing — i.e. soon after a gameweek's FPL `waivers_time` (so transactions land in
 * `drops-gw-live` after build-waiver-gw-analytics), every 3 hours in the 24h leading
 * up to `waivers_time`, or at one of the thrice-daily UTC catch-alls.
 *
 * Not invoked for push / workflow_dispatch (the workflow skips this logic there).
 * Data: draft bootstrap-static { events: { data: [{ id, waivers_time }, ...] } }.
 */
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  inDailyCatchAllWindow,
  postDeadlineIngestEvent,
  postWaiverRefreshEvent,
  preWaiverRefreshEvent,
} from '../src/waiverRefreshSchedule.js'

const DRAFT_BOOTSTRAP = 'https://draft.premierleague.com/api/bootstrap-static'

export { postDeadlineIngestEvent, preWaiverRefreshEvent } from '../src/waiverRefreshSchedule.js'

async function main() {
  if (inDailyCatchAllWindow()) {
    console.log(
      'waiver-refresh-gate: in daily catch-all window (05:26–05:45 / 13:26–13:45 / 21:26–21:45 UTC) — run full deploy',
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
  const postWaivers = postWaiverRefreshEvent(list, now)
  if (postWaivers) {
    console.log(
      `waiver-refresh-gate: inside post-waivers window for GW${postWaivers.id} (waivers_time ${postWaivers.waiversTime}) — run deploy`,
    )
    process.exit(0)
  }

  const preGw = preWaiverRefreshEvent(list, now)
  if (preGw) {
    console.log(
      `waiver-refresh-gate: within 24h of GW${preGw.id} waivers (${preGw.waiversTime}), on 3-hour cadence — run deploy`,
    )
    process.exit(0)
  }

  const postGw = postDeadlineIngestEvent(list, now)
  if (postGw) {
    console.log(
      `waiver-refresh-gate: GW${postGw.id} finished and past deadline (${postGw.deadline}) — run deploy for league details`,
    )
    process.exit(0)
  }

  console.log(
    'waiver-refresh-gate: not in post-waivers, pre-waivers, post-deadline, or daily window — skip deploy',
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

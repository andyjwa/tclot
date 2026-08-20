/**
 * Scheduled notification triggers (deadlines + waiver results).
 * Live XI scoring alerts live in ./liveXi.js.
 * Pure helpers are exported for unit tests.
 */

const DRAFT_BOOTSTRAP = 'https://draft.premierleague.com/api/bootstrap-static'

/** @typedef {{ id: number, deadlineMs: number, waiversMs: number | null, isCurrent: boolean, finished: boolean, isNext: boolean, isLive: boolean }} GwEvent */

/**
 * @param {object[]} eventList bootstrap-static events.data
 * @returns {GwEvent[]}
 */
export function parseGwEvents(eventList) {
  if (!Array.isArray(eventList)) return []
  return eventList
    .map((e) => {
      const id = Number(e?.id)
      const deadlineMs = Date.parse(String(e?.deadline_time ?? ''))
      const waiversMs = e?.waivers_time ? Date.parse(String(e.waivers_time)) : null
      if (!Number.isFinite(id) || !Number.isFinite(deadlineMs)) return null
      return {
        id,
        deadlineMs,
        waiversMs: Number.isFinite(waiversMs) ? waiversMs : null,
        isCurrent: e?.is_current === true,
        finished: e?.finished === true,
        isNext: e?.is_next === true,
        isLive: e?.is_live === true,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.id - b.id)
}

/**
 * The event whose deadlines are next relevant (next GW, else current unfinished, else first unfinished).
 * @param {GwEvent[]} events
 * @returns {GwEvent | null}
 */
export function upcomingEvent(events) {
  return (
    events.find((e) => e.isNext && !e.finished) ??
    events.find((e) => e.isCurrent && !e.finished) ??
    events.find((e) => !e.finished) ??
    null
  )
}

const ONE_HOUR_MS = 60 * 60 * 1000
const ONE_DAY_MS = 24 * ONE_HOUR_MS

/**
 * @param {number} msUntil
 * @returns {'1h' | '24h' | null}
 */
function reminderBucket(msUntil) {
  if (msUntil > 0 && msUntil <= ONE_HOUR_MS) return '1h'
  if (msUntil > ONE_HOUR_MS && msUntil <= ONE_DAY_MS) return '24h'
  return null
}

/**
 * Deadline reminders for BOTH the waiver deadline (`waivers_time`) and the
 * lineup deadline (`deadline_time`) of the upcoming GW, at 24h and 1h out.
 * @param {GwEvent[]} events
 * @param {number} nowMs
 * @returns {Array<{ type: string, gw: number, title: string, body: string, pref: string, dedupKey: string, url: string }>}
 */
export function pickDeadlineReminders(events, nowMs) {
  const target = upcomingEvent(events)
  if (!target) return []
  const now = Number(nowMs)
  const out = []

  if (target.waiversMs != null) {
    const bucket = reminderBucket(target.waiversMs - now)
    if (bucket) {
      out.push({
        type: `waiver_deadline_${bucket}`,
        gw: target.id,
        pref: 'deadlineReminders',
        dedupKey: `waiver_deadline_${bucket}:${target.id}`,
        url: '/#/teamSelection',
        title:
          bucket === '1h'
            ? `GW${target.id} waiver deadline in 1 hour`
            : `GW${target.id} waiver deadline tomorrow`,
        body: 'Submit your waiver claims in Moves before the deadline.',
      })
    }
  }

  const lineupBucket = reminderBucket(target.deadlineMs - now)
  if (lineupBucket) {
    out.push({
      type: `lineup_deadline_${lineupBucket}`,
      gw: target.id,
      pref: 'deadlineReminders',
      dedupKey: `lineup_deadline_${lineupBucket}:${target.id}`,
      url: '/#/fplLive',
      title:
        lineupBucket === '1h'
          ? `GW${target.id} lineup deadline in 1 hour`
          : `GW${target.id} lineup deadline tomorrow`,
      body: 'Set your starting XI before the Premier League deadline.',
    })
  }

  return out
}

/**
 * One "waivers processed" alert shortly after `waivers_time`.
 * @param {GwEvent[]} events
 * @param {number} nowMs
 */
export function pickWaiverWindow(events, nowMs) {
  const now = Number(nowMs)
  const target =
    events.find((e) => e.isCurrent && !e.finished) ??
    events.find((e) => e.isNext && !e.finished)
  if (!target?.waiversMs) return null

  const msUntil = target.waiversMs - now
  const graceStart = -30 * 60 * 1000
  const graceEnd = 3 * ONE_HOUR_MS
  if (msUntil < graceStart || msUntil > graceEnd) return null

  return {
    type: 'waiver_processed',
    gw: target.id,
    pref: 'waiverResults',
    dedupKey: `waiver_processed:${target.id}`,
    url: '/#/teamSelection',
    title: `GW${target.id} waivers processed`,
    body: 'Waiver results are in — open Moves to see who changed hands.',
  }
}

/**
 * @param {object} env
 * @param {KVNamespace} kv
 * @param {object[]} subscriptions
 */
export async function runScheduledNotifications(env, kv, subscriptions, deps = {}) {
  const nowMs = deps.nowMs ?? Date.now()
  const fetchBootstrap = deps.fetchBootstrap ?? (async () => {
    const res = await fetch(DRAFT_BOOTSTRAP, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`bootstrap-static ${res.status}`)
    return res.json()
  })
  const markSentOnce = deps.markSentOnce ?? (async (key) => {
    const mod = await import('./subscriptions.js')
    return mod.markSentOnce(kv, key)
  })
  const broadcastPush = deps.broadcastPush ?? (async (notification) => {
    const mod = await import('./send.js')
    return mod.broadcastPush(env, kv, subscriptions, notification)
  })

  const bootstrap = await fetchBootstrap()
  const events = parseGwEvents(bootstrap?.events?.data)
  const candidates = [
    ...pickDeadlineReminders(events, nowMs),
    pickWaiverWindow(events, nowMs),
  ].filter(Boolean)

  const summary = { checked: candidates.length, sent: 0, skipped: 0 }

  for (const candidate of candidates) {
    if (!(await markSentOnce(candidate.dedupKey))) {
      summary.skipped += 1
      continue
    }
    const result = await broadcastPush({
      title: candidate.title,
      body: candidate.body,
      url: candidate.url,
      tag: candidate.type,
      pref: candidate.pref,
    })
    summary.sent += result.sent
  }

  return summary
}

/**
 * Internal (CI / admin) trigger.
 * @param {object} env
 * @param {KVNamespace} kv
 * @param {object[]} subscriptions
 * @param {{ type: string, gw?: number, title?: string, body?: string }} payload
 */
export async function runInternalNotification(env, kv, subscriptions, payload) {
  const { broadcastPush } = await import('./send.js')
  const { markSentOnce } = await import('./subscriptions.js')

  const gw = Number(payload.gw)
  const type = String(payload.type ?? 'custom')

  let notification
  if (type === 'waiver_processed' && Number.isFinite(gw)) {
    notification = {
      title: payload.title ?? `GW${gw} waivers processed`,
      body: payload.body ?? 'Waiver results are in — open Moves to see who changed hands.',
      url: '/#/teamSelection',
      tag: 'waiver_processed',
      pref: 'waiverResults',
    }
    if (!(await markSentOnce(`waiver_processed:${gw}`))) {
      return { sent: 0, skipped: 1, deduped: true }
    }
  } else if (type === 'test') {
    notification = {
      title: payload.title ?? 'TCLOT test notification',
      body: payload.body ?? 'Web push from the TCLOT web app is working.',
      url: '/',
      tag: 'test',
    }
  } else {
    throw new Error(`Unknown notification type: ${type}`)
  }

  return broadcastPush(env, kv, subscriptions, notification)
}

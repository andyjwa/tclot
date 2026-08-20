/**
 * "Your live XI" scoring alerts — goals, assists, and defensive-contribution
 * (+2) moments for players in a subscriber's starting XI (draft picks 1-11).
 *
 * Pure detection helpers are exported for unit tests; the orchestration
 * (runLiveXiNotifications) fetches draft data and sends push.
 */

const DRAFT_API = 'https://draft.premierleague.com/api'

/**
 * FPL 25/26 defensive-contribution point threshold by position.
 * 2 DEF → 10 actions; 3 MID / 4 FWD → 12. GKP (1) earns no DC points in draft.
 * @param {number | null | undefined} elementTypeId
 * @returns {number | null}
 */
export function defconThreshold(elementTypeId) {
  const t = Number(elementTypeId)
  if (t === 2) return 10
  if (t === 3 || t === 4) return 12
  return null
}

/** @param {object | null | undefined} stats */
export function defconCount(stats) {
  const direct = Number(stats?.defensive_contribution)
  return Number.isFinite(direct) ? direct : 0
}

/**
 * Fantasy DC points for a live row: prefer explain points, else count ≥ threshold.
 * @param {object | null | undefined} row full live element row ({ stats, explain })
 * @param {number | null | undefined} elementTypeId
 * @returns {0 | 2}
 */
export function defconPoints(row, elementTypeId) {
  const ex = row?.explain
  if (Array.isArray(ex) && ex.length) {
    let pts = 0
    for (const block of ex) {
      // draft shape: [ [ {stat,value,points}, ... ], fixtureId ]
      if (Array.isArray(block) && Array.isArray(block[0])) {
        for (const s of block[0]) {
          if (s?.stat === 'defensive_contribution') pts += Number(s.points) || 0
        }
      } else if (block && Array.isArray(block.stats)) {
        // classic shape: { fixture, stats: [ {identifier,value,points} ] }
        for (const s of block.stats) {
          if (s?.identifier === 'defensive_contribution') pts += Number(s.points) || 0
        }
      }
    }
    if (pts > 0) return 2
  }
  const threshold = defconThreshold(elementTypeId)
  if (threshold != null && defconCount(row?.stats) >= threshold) return 2
  return 0
}

/**
 * Normalize draft `event/live` elements (object keyed by id, or array) to a Map.
 * @param {object | any[]} elements
 * @returns {Map<number, { stats: object, explain: any }>}
 */
export function normalizeLiveElements(elements) {
  const map = new Map()
  if (Array.isArray(elements)) {
    for (const row of elements) {
      const id = Number(row?.id)
      if (Number.isFinite(id)) map.set(id, { stats: row?.stats ?? {}, explain: row?.explain })
    }
  } else if (elements && typeof elements === 'object') {
    for (const [key, row] of Object.entries(elements)) {
      const id = Number(key)
      if (Number.isFinite(id)) map.set(id, { stats: row?.stats ?? {}, explain: row?.explain })
    }
  }
  return map
}

/** Minutes gate — matches the app: only emit once a player is actually on the pitch. */
function onPitch(stats) {
  return (Number(stats?.minutes) || 0) > 0
}

/**
 * Diff previous cumulative totals against the current live snapshot and return
 * new scoring events for the given set of relevant element ids.
 *
 * @param {Record<string, { g: number, a: number, dc: number }> | null | undefined} prevTotals
 *   keyed by element id; null/empty means "first poll" (baseline only, no events)
 * @param {Map<number, { stats: object, explain: any }>} liveMap
 * @param {Map<number, { web_name?: string, element_type?: number }>} elementMeta
 * @param {Set<number>} relevantIds elements owned as starters by some subscriber
 * @param {number} gw
 * @returns {{ events: Array<{ el: number, kind: 'goal'|'assist'|'defcon', total: number, webName: string, stableId: string }>, totals: Record<string, { g: number, a: number, dc: number }> }}
 */
export function diffLiveXiEvents(prevTotals, liveMap, elementMeta, relevantIds, gw) {
  const isBaseline = !prevTotals || Object.keys(prevTotals).length === 0
  const totals = {}
  const events = []

  for (const el of relevantIds) {
    const row = liveMap.get(el)
    const stats = row?.stats ?? {}
    const g = Number(stats.goals_scored) || 0
    const a = Number(stats.assists) || 0
    const meta = elementMeta.get(el) ?? {}
    const dc = defconPoints(row, meta.element_type)
    totals[el] = { g, a, dc }

    if (isBaseline) continue
    const prev = prevTotals[el] ?? { g: 0, a: 0, dc: 0 }
    const webName = meta.web_name || `Player ${el}`

    if (g > prev.g && onPitch(stats)) {
      events.push({ el, kind: 'goal', total: g, webName, stableId: `${gw}:${el}:goal:tot${g}` })
    }
    if (a > prev.a && onPitch(stats)) {
      events.push({ el, kind: 'assist', total: a, webName, stableId: `${gw}:${el}:assist:tot${a}` })
    }
    if (dc > prev.dc && onPitch(stats)) {
      events.push({ el, kind: 'defcon', total: dc, webName, stableId: `${gw}:${el}:defcon:tot${dc}` })
    }
  }

  return { events, totals }
}

/** @param {{ kind: string, webName: string }} event */
export function liveXiMessage(event, gw) {
  if (event.kind === 'goal') {
    return { title: `⚽ ${event.webName} scored`, body: `GW${gw} — a player in your XI just scored.` }
  }
  if (event.kind === 'assist') {
    return { title: `${event.webName} — assist`, body: `GW${gw} — a player in your XI got an assist.` }
  }
  return {
    title: `${event.webName} — defensive contribution`,
    body: `GW${gw} — +2 defcon points for a player in your XI.`,
  }
}

/** Find the current live GW (deadline passed, current/live, not finished). */
export function findLiveGw(events, nowMs) {
  const now = Number(nowMs)
  const live = events.find(
    (e) => (e.isLive || (e.isCurrent && !e.finished)) && now >= e.deadlineMs,
  )
  return live ? live.id : null
}

const TOTALS_TTL_SECONDS = 7 * 24 * 60 * 60

/**
 * @param {object} env
 * @param {KVNamespace} kv
 * @param {object[]} subscriptions
 * @param {object} [deps]
 */
export async function runLiveXiNotifications(env, kv, subscriptions, deps = {}) {
  const nowMs = deps.nowMs ?? Date.now()

  const liveSubs = subscriptions.filter(
    (s) => s.prefs?.liveXi !== false && s.entryId != null,
  )
  if (!liveSubs.length) return { skipped: 'no-live-subscribers' }

  const fetchJson = deps.fetchJson ?? (async (url) => {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`${url} ${res.status}`)
    return res.json()
  })

  const parseGwEvents = deps.parseGwEvents ?? (await import('./cron.js')).parseGwEvents
  const bootstrap = await fetchJson(`${DRAFT_API}/bootstrap-static`)
  const events = parseGwEvents(bootstrap?.events?.data)
  const gw = deps.gw ?? findLiveGw(events, nowMs)
  if (gw == null) return { skipped: 'no-live-gw' }

  const elementMeta = new Map()
  for (const el of bootstrap?.elements ?? []) {
    const id = Number(el?.id)
    if (Number.isFinite(id)) {
      elementMeta.set(id, { web_name: el.web_name, element_type: el.element_type })
    }
  }

  // Map element id -> subscriber rows that start that player this GW.
  const ownersByElement = new Map()
  for (const sub of liveSubs) {
    let picks
    try {
      picks = await fetchJson(`${DRAFT_API}/entry/${sub.entryId}/event/${gw}`)
    } catch {
      continue
    }
    const starters = (picks?.picks ?? [])
      .filter((p) => Number(p?.position) <= 11)
      .map((p) => Number(p?.element))
    for (const el of starters) {
      if (!ownersByElement.has(el)) ownersByElement.set(el, [])
      ownersByElement.get(el).push(sub)
    }
  }
  const relevantIds = new Set(ownersByElement.keys())
  if (!relevantIds.size) return { skipped: 'no-starters' }

  const live = await fetchJson(`${DRAFT_API}/event/${gw}/live`)
  const liveMap = normalizeLiveElements(live?.elements)

  const totalsKey = `live:totals:${gw}`
  const prevRaw = await kv.get(totalsKey)
  let prevTotals = null
  try {
    prevTotals = prevRaw ? JSON.parse(prevRaw) : null
  } catch {
    prevTotals = null
  }

  const { events: scoringEvents, totals } = diffLiveXiEvents(
    prevTotals,
    liveMap,
    elementMeta,
    relevantIds,
    gw,
  )

  await kv.put(totalsKey, JSON.stringify(totals), { expirationTtl: TOTALS_TTL_SECONDS })

  if (!scoringEvents.length) {
    return { gw, sent: 0, baseline: prevTotals == null }
  }

  const { markSentOnce } = await import('./subscriptions.js')
  const { sendPush } = await import('./send.js')

  const summary = { gw, sent: 0, skipped: 0, removed: 0 }
  for (const event of scoringEvents) {
    if (!(await markSentOnce(kv, event.stableId))) {
      summary.skipped += 1
      continue
    }
    const message = liveXiMessage(event, gw)
    const owners = ownersByElement.get(event.el) ?? []
    for (const sub of owners) {
      const subscription = {
        endpoint: sub.endpoint,
        expirationTime: sub.expirationTime ?? null,
        keys: sub.keys,
      }
      try {
        const outcome = await sendPush(env, subscription, {
          title: message.title,
          body: message.body,
          url: '/#/fplLive',
          tag: `live_xi:${event.el}`,
        })
        if (outcome.ok) summary.sent += 1
        else if (outcome.gone) {
          await kv.delete(`sub:${sub.id}`)
          summary.removed += 1
        }
      } catch {
        /* skip */
      }
    }
  }

  return summary
}

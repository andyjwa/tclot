/**
 * Fixture-swap luck. Keep each team's weekly score, put it against everyone
 * else's opponent that week, and count the result. A win is 3, a draw is 1,
 * a loss is 0. The margin does not matter once the result is decided.
 *
 * The luck delta is what this fixture list paid, minus the average of the
 * other lists. Own list is not in that average. Plus means this draw paid
 * more. Rank 1 is the luckiest (largest plus). Rank last is the unluckiest.
 */

function scoreOf(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** League points `squadId`'s scores would have got against `ownerId`'s opponents. */
function pointsOnList(squadId, ownerId, myPts, oppPts) {
  const opponents = oppPts[ownerId]
  if (!opponents) return null
  let pts = 0
  let games = 0
  for (const gw of Object.keys(opponents)) {
    const my = myPts[squadId]?.[gw]
    const op = opponents[gw]
    if (my == null || op == null) continue
    games += 1
    if (my > op) pts += 3
    else if (my === op) pts += 1
  }
  if (!games) return null
  return pts
}

/**
 * @param {object[]} matches Finished and upcoming league matches. Only finished
 *   matches with both scores are used.
 * @param {Array<number|string>} teamIds
 * @returns {{ byId: Record<string, { actual: number|null, avg: number|null, delta: number|null, ready: boolean }>, points: Record<string, Record<string, number|null>> } | null}
 *   `points[row][col]` is league points `row` would have got on `col`'s opponents.
 *   The diagonal is what this draw actually paid.
 */
export function buildResultScheduleLuck(matches, teamIds) {
  const ids = [...new Set((teamIds || []).filter((id) => id != null))]
  if (ids.length < 2) return null

  /** @type {Record<string, Record<string, number>>} */
  const myPts = {}
  /** @type {Record<string, Record<string, number>>} */
  const oppPts = {}
  for (const id of ids) {
    myPts[id] = {}
    oppPts[id] = {}
  }

  const finished = (matches || []).filter((m) => m?.finished)
  for (const m of finished) {
    const gw = Number(m.event)
    if (!Number.isFinite(gw) || gw < 1) continue
    const a = m.league_entry_1
    const b = m.league_entry_2
    const sa = scoreOf(m.league_entry_1_points)
    const sb = scoreOf(m.league_entry_2_points)
    if (sa == null || sb == null) continue
    if (!myPts[a] || !myPts[b]) continue
    myPts[a][gw] = sa
    oppPts[a][gw] = sb
    myPts[b][gw] = sb
    oppPts[b][gw] = sa
  }

  const byId = {}
  const points = {}
  for (const rowId of ids) {
    points[rowId] = {}
    let sum = 0
    let n = 0
    for (const colId of ids) {
      const pts = pointsOnList(rowId, colId, myPts, oppPts)
      points[rowId][colId] = pts
      if (colId === rowId || pts == null) continue
      sum += pts
      n += 1
    }
    const actual = points[rowId][rowId]
    const ready = actual != null && n > 0
    const avg = ready ? sum / n : null
    byId[rowId] = {
      actual: ready ? actual : null,
      avg,
      delta: ready ? actual - avg : null,
      ready,
    }
  }

  return { byId, points }
}

/** Signed one-decimal label. Zero is `0.0`. */
export function formatLuckDelta(delta) {
  if (delta == null || Number.isNaN(delta)) return null
  const v = Math.round(delta * 10) / 10
  const n = Object.is(v, -0) ? 0 : v
  if (n === 0) return '0.0'
  return n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1)
}

/** Card subtitle: `+3.0 vs other draws`. */
export function luckDrawLabel(delta) {
  const signed = formatLuckDelta(delta)
  if (signed == null) return null
  return `${signed} vs other draws`
}

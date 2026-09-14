/**
 * Schedule luck from results, not scores.
 *
 * A win is 3, a draw is 1, a loss is 0. A 1-point win and a 40-point win
 * count the same. The scoreline is only used to decide the result.
 *
 * Opponent strength is that team's league points per game against everyone
 * except the team whose luck we are measuring. Leaving those games out means
 * beating someone does not, by itself, make the draw look easy.
 *
 * A fixture list's difficulty is the average of those strengths. The luck
 * delta is the average difficulty of every fixture list, including this one,
 * minus this list's difficulty. Positive means the teams on this list have
 * been losing more than the typical draw. Rank 1 is the kindest list.
 */

function resultPoints(my, opp) {
  if (my > opp) return 3
  if (my < opp) return 0
  return 1
}

function scoreOf(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** League points per game for `oppId`, ignoring games against `excludeId`. */
function opponentPpg(results, oppId, excludeId) {
  const games = results[oppId]
  if (!games?.length) return null
  let pts = 0
  let n = 0
  for (const g of games) {
    if (g.oppId === excludeId) continue
    pts += g.pts
    n += 1
  }
  if (!n) return null
  return pts / n
}

/** Average opponent result-strength on `ownerId`'s fixture list, from `rowId`'s view. */
function scheduleQuality(results, oppByOwner, rowId, ownerId) {
  const byGw = oppByOwner[ownerId]
  if (!byGw) return null
  let sum = 0
  let n = 0
  for (const oppId of Object.values(byGw)) {
    const ppg = opponentPpg(results, oppId, rowId)
    if (ppg == null) continue
    sum += ppg
    n += 1
  }
  if (!n) return null
  return sum / n
}

/**
 * @param {object[]} matches Finished and upcoming league matches. Only finished
 *   matches with both scores are used.
 * @param {Array<number|string>} teamIds
 * @returns {{ byId: Record<string, { own: number|null, avg: number|null, delta: number|null, ready: boolean }>, quality: Record<string, Record<string, number|null>> } | null}
 */
export function buildResultScheduleLuck(matches, teamIds) {
  const ids = [...new Set((teamIds || []).filter((id) => id != null))]
  if (ids.length < 2) return null

  /** @type {Record<string, { oppId: number|string, pts: number }[]>} */
  const results = {}
  /** @type {Record<string, Record<string, number|string>>} */
  const oppByOwner = {}
  for (const id of ids) {
    results[id] = []
    oppByOwner[id] = {}
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
    if (!results[a] || !results[b]) continue
    results[a].push({ oppId: b, pts: resultPoints(sa, sb) })
    results[b].push({ oppId: a, pts: resultPoints(sb, sa) })
    oppByOwner[a][gw] = b
    oppByOwner[b][gw] = a
  }

  const byId = {}
  const quality = {}
  for (const rowId of ids) {
    quality[rowId] = {}
    let sum = 0
    let n = 0
    for (const colId of ids) {
      const q = scheduleQuality(results, oppByOwner, rowId, colId)
      quality[rowId][colId] = q
      if (q == null) continue
      sum += q
      n += 1
    }
    const own = quality[rowId][rowId]
    const ready = own != null
    const avg = ready ? sum / n : null
    byId[rowId] = {
      own,
      avg,
      delta: ready ? avg - own : null,
      ready,
    }
  }

  return { byId, quality }
}

/** Signed one-decimal label, or `'0'`. */
export function formatLuckDelta(delta) {
  if (delta == null || Number.isNaN(delta)) return null
  const v = Math.round(delta * 10) / 10
  const n = Object.is(v, -0) ? 0 : v
  if (n === 0) return '0'
  return n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1)
}

/** Card subtitle: `+0.4 easier`, `-0.3 harder`, or `level`. */
export function luckEaseLabel(delta) {
  const signed = formatLuckDelta(delta)
  if (signed == null || signed === '0') return 'level'
  return `${signed} ${signed.startsWith('-') ? 'harder' : 'easier'}`
}

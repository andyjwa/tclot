/**
 * Counterfactual table points (3 / 1 / 0): each squad keeps its real weekly scores, but
 * faces the same opponent sequence (and thus opposing GW scores) as another squad’s schedule.
 */

/**
 * @param {Array<{ finished?: boolean, event?: number, league_entry_1: number, league_entry_2: number, league_entry_1_points?: number, league_entry_2_points?: number }>} matches
 * @returns {{ myPts: Record<number, Record<number, number>>, oppPts: Record<number, Record<number, number>> }}
 */
function buildGwPointMaps(matches) {
  const myPts = {}
  const oppPts = {}
  const finished = (matches || []).filter((m) => m.finished)
  for (const m of finished) {
    const gw = Number(m.event)
    if (!Number.isFinite(gw) || gw < 1) continue
    const a = m.league_entry_1
    const b = m.league_entry_2
    const pa = Number(m.league_entry_1_points) || 0
    const pb = Number(m.league_entry_2_points) || 0
    for (const [me, _op, myP, opP] of [
      [a, b, pa, pb],
      [b, a, pb, pa],
    ]) {
      if (!myPts[me]) myPts[me] = {}
      if (!oppPts[me]) oppPts[me] = {}
      myPts[me][gw] = myP
      oppPts[me][gw] = opP
    }
  }
  return { myPts, oppPts }
}

/**
 * H2H table points (W×3 + D) for `squadId`'s scores vs opponents implied by `fixtureOwnerId`'s schedule.
 */
function leaguePointsForSchedule(squadId, fixtureOwnerId, myPts, oppPts) {
  const gws = Object.keys(oppPts[fixtureOwnerId] || {})
    .map(Number)
    .filter((g) => Number.isFinite(g))
    .sort((a, b) => a - b)
  let w = 0
  let d = 0
  let l = 0
  for (const gw of gws) {
    const my = myPts[squadId]?.[gw]
    const op = oppPts[fixtureOwnerId]?.[gw]
    if (my == null || op == null) continue
    if (my > op) w += 1
    else if (my < op) l += 1
    else d += 1
  }
  return w * 3 + d
}

/**
 * @param {object[]} leagueEntries `details.json` league_entries
 * @param {{ league_entry?: number, rank?: number }[]} tableRows Standing rows (for ordering)
 */
export function buildFixtureScheduleMatrix(matches, leagueEntries, tableRows) {
  const idSet = new Set()
  for (const e of leagueEntries || []) {
    if (e?.id != null) idSet.add(e.id)
  }
  if (idSet.size < 2) return null

  const idToName = Object.fromEntries(
    (leagueEntries || [])
      .filter((e) => e?.id != null)
      .map((e) => [e.id, e.entry_name?.trim() ? e.entry_name : `Team ${e.id}`]),
  )

  /** @type {number[]} */
  let orderedIds = []
  if (Array.isArray(tableRows) && tableRows.length) {
    const byRank = [...tableRows].sort(
      (a, b) => (Number(a.rank) || 99) - (Number(b.rank) || 99),
    )
    for (const r of byRank) {
      const le = r.league_entry
      if (le != null && idSet.has(le) && !orderedIds.includes(le)) orderedIds.push(le)
    }
  }
  for (const id of [...idSet].sort((a, b) => a - b)) {
    if (!orderedIds.includes(id)) orderedIds.push(id)
  }

  const { myPts, oppPts } = buildGwPointMaps(matches)
  const n = orderedIds.length
  /** @type {number[][]} */
  const matrix = []
  for (let i = 0; i < n; i++) {
    matrix[i] = []
    for (let j = 0; j < n; j++) {
      matrix[i][j] = leaguePointsForSchedule(
        orderedIds[i],
        orderedIds[j],
        myPts,
        oppPts,
      )
    }
  }

  const rowAverages = matrix.map((row) => {
    const sum = row.reduce((a, v) => a + v, 0)
    return n > 0 ? sum / n : 0
  })

  return {
    orderedIds,
    idToName,
    matrix,
    rowAverages,
  }
}

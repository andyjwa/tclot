/**
 * FPL points for one player in one Premier League fixture.
 *
 * Prefers the live `explain` block for `fixtureId` (sum of that block's
 * `points`) so a double gameweek does not show the other match. Falls
 * back to the GW `total_points` only when explain is absent.
 *
 * @param {Record<number, object> | null | undefined} liveFullByElementId
 * @param {number | string | null | undefined} elementId
 * @param {number | string | null | undefined} fixtureId
 * @returns {number | null}
 */
export function fixtureFplPoints(liveFullByElementId, elementId, fixtureId) {
  const id = Number(elementId)
  if (!Number.isFinite(id)) return null
  const row =
    liveFullByElementId?.[id] ?? liveFullByElementId?.[String(id)] ?? null
  if (!row || typeof row !== 'object') return null

  const fid = Number(fixtureId)
  const ex = row.explain
  if (Number.isFinite(fid) && Array.isArray(ex) && ex.length > 0) {
    const first = ex[0]
    let statList = null
    let sawBlock = false
    if (Array.isArray(first) && first.length === 2 && typeof first[1] === 'number') {
      sawBlock = true
      for (const pair of ex) {
        if (Number(pair?.[1]) === fid) statList = pair[0]
      }
    } else if (first && typeof first === 'object' && first.fixture != null) {
      sawBlock = true
      for (const block of ex) {
        if (Number(block?.fixture) === fid) statList = block.stats
      }
    }
    if (sawBlock) {
      if (!Array.isArray(statList)) return null
      let pts = 0
      for (const s of statList) pts += Number(s?.points) || 0
      return pts
    }
  }

  const st = row.stats && typeof row.stats === 'object' ? row.stats : row
  if (st.total_points != null && Number.isFinite(Number(st.total_points))) {
    return Number(st.total_points)
  }
  return null
}

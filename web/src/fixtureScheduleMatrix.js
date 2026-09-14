/**
 * Fixture-swap grid. `matrix[row][col]` is league points that row's scores
 * would have got against that column's opponents (the diagonal is the real
 * draw). `rowAverages` is actual minus the average of the other lists, which
 * is the average of the displayed row (diagonal left out).
 */
import { buildResultScheduleLuck } from './scheduleLuck.js'

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

  const luck = buildResultScheduleLuck(matches, orderedIds)
  const n = orderedIds.length
  /** @type {(number|null)[][]} */
  const matrix = []
  const rowAverages = []
  for (let i = 0; i < n; i++) {
    const rowId = orderedIds[i]
    matrix[i] = []
    for (let j = 0; j < n; j++) {
      matrix[i][j] = luck?.points[rowId]?.[orderedIds[j]] ?? null
    }
    rowAverages[i] = luck?.byId[rowId]?.delta ?? null
  }

  return {
    orderedIds,
    idToName,
    matrix,
    rowAverages,
  }
}

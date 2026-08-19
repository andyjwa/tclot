/**
 * Build per-squad regular-FPL value totals from league-data artifacts.
 *
 * Output key is Draft `league_entries[].id` (league entry id used by standings
 * / season prediction tables), while element ownership comes from Draft
 * `entry_id`, so we bridge that via `details.json`.
 */
export function buildSquadFplValueByLeagueEntryId({
  elementStatus = null,
  bootstrapFpl = null,
  details = null,
} = {}) {
  const statuses = Array.isArray(elementStatus?.element_status)
    ? elementStatus.element_status
    : []
  const elements = Array.isArray(bootstrapFpl?.elements) ? bootstrapFpl.elements : []
  const leagueEntries = Array.isArray(details?.league_entries) ? details.league_entries : []

  const entryIdToLeagueEntryId = new Map()
  for (const row of leagueEntries) {
    const entryId = Number(row?.entry_id)
    const leagueEntryId = Number(row?.id)
    if (!Number.isFinite(entryId) || !Number.isFinite(leagueEntryId)) continue
    entryIdToLeagueEntryId.set(entryId, leagueEntryId)
  }

  const nowCostByElementId = new Map()
  for (const el of elements) {
    const elementId = Number(el?.id)
    const nowCost = Number(el?.now_cost)
    if (!Number.isFinite(elementId) || !Number.isFinite(nowCost)) continue
    nowCostByElementId.set(elementId, nowCost)
  }

  const totals = new Map()
  const counts = new Map()
  for (const row of statuses) {
    const ownerEntryId = Number(row?.owner)
    if (!Number.isFinite(ownerEntryId)) continue
    const leagueEntryId = entryIdToLeagueEntryId.get(ownerEntryId)
    if (!Number.isFinite(leagueEntryId)) continue
    const nowCost = nowCostByElementId.get(Number(row?.element))
    if (!Number.isFinite(nowCost)) continue
    totals.set(leagueEntryId, (totals.get(leagueEntryId) ?? 0) + nowCost)
    counts.set(leagueEntryId, (counts.get(leagueEntryId) ?? 0) + 1)
  }

  const out = new Map()
  for (const [leagueEntryId, totalTenths] of totals.entries()) {
    out.set(leagueEntryId, {
      totalValue: totalTenths / 10,
      playerCount: counts.get(leagueEntryId) ?? 0,
    })
  }
  return out
}

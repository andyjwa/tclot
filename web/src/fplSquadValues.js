/**
 * Build per-squad regular-FPL data from league-data artifacts: the total
 * market value plus the owned player list (for the squad breakdown).
 *
 * Output key is Draft `league_entries[].id` (league entry id used by standings
 * / season prediction tables), while element ownership comes from Draft
 * `entry_id`, so we bridge that via `details.json`.
 */

const ELEMENT_TYPE_TO_POS = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }
const POS_RANK = { GK: 1, DEF: 2, MID: 3, FWD: 4 }

/** PL club badge for an FPL team `code` (regular-FPL club, not fantasy team). */
export function plClubBadgeUrl(code) {
  if (code == null) return null
  return `https://resources.premierleague.com/premierleague/badges/50/t${code}.png`
}

/** Official first + last name, falling back to `web_name` — the user-facing full name. */
function elementFullName(el) {
  const parts = [el?.first_name, el?.second_name]
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean)
  if (parts.length) return parts.join(' ')
  const web = typeof el?.web_name === 'string' ? el.web_name.trim() : ''
  return web || `#${el?.id ?? '?'}`
}

export function buildSquadFplValueByLeagueEntryId({
  elementStatus = null,
  bootstrapFpl = null,
  details = null,
} = {}) {
  const statuses = Array.isArray(elementStatus?.element_status)
    ? elementStatus.element_status
    : []
  const elements = Array.isArray(bootstrapFpl?.elements) ? bootstrapFpl.elements : []
  const teams = Array.isArray(bootstrapFpl?.teams) ? bootstrapFpl.teams : []
  const leagueEntries = Array.isArray(details?.league_entries) ? details.league_entries : []

  const entryIdToLeagueEntryId = new Map()
  for (const row of leagueEntries) {
    const entryId = Number(row?.entry_id)
    const leagueEntryId = Number(row?.id)
    if (!Number.isFinite(entryId) || !Number.isFinite(leagueEntryId)) continue
    entryIdToLeagueEntryId.set(entryId, leagueEntryId)
  }

  const teamById = new Map()
  for (const t of teams) {
    const id = Number(t?.id)
    if (!Number.isFinite(id)) continue
    teamById.set(id, { code: t?.code ?? null, shortName: t?.short_name ?? null })
  }

  const elementById = new Map()
  for (const el of elements) {
    const id = Number(el?.id)
    if (!Number.isFinite(id)) continue
    elementById.set(id, el)
  }

  const totals = new Map()
  const players = new Map()
  for (const row of statuses) {
    const ownerEntryId = Number(row?.owner)
    if (!Number.isFinite(ownerEntryId)) continue
    const leagueEntryId = entryIdToLeagueEntryId.get(ownerEntryId)
    if (!Number.isFinite(leagueEntryId)) continue
    const el = elementById.get(Number(row?.element))
    if (!el) continue

    const nowCost = Number(el?.now_cost)
    if (Number.isFinite(nowCost)) {
      totals.set(leagueEntryId, (totals.get(leagueEntryId) ?? 0) + nowCost)
    }

    const club = teamById.get(Number(el?.team)) ?? { code: null, shortName: null }
    const posLabel = ELEMENT_TYPE_TO_POS[Number(el?.element_type)] ?? null
    const list = players.get(leagueEntryId) ?? []
    list.push({
      elementId: Number(el.id),
      fullName: elementFullName(el),
      posLabel,
      posRank: posLabel ? POS_RANK[posLabel] : 5,
      teamCode: club.code,
      teamShort: club.shortName,
    })
    players.set(leagueEntryId, list)
  }

  const out = new Map()
  const keys = new Set([...totals.keys(), ...players.keys()])
  for (const leagueEntryId of keys) {
    const list = (players.get(leagueEntryId) ?? [])
      .slice()
      .sort(
        (a, b) =>
          a.posRank - b.posRank ||
          a.fullName.localeCompare(b.fullName),
      )
    out.set(leagueEntryId, {
      totalValue: (totals.get(leagueEntryId) ?? 0) / 10,
      playerCount: list.length,
      players: list,
    })
  }
  return out
}

/** Group a squad's players into ordered position sections for display. */
export function squadPlayersByPosition(players = []) {
  const order = ['GK', 'DEF', 'MID', 'FWD']
  const sections = order.map((pos) => ({
    pos,
    players: players.filter((p) => p.posLabel === pos),
  }))
  const unknown = players.filter((p) => !order.includes(p.posLabel))
  if (unknown.length) sections.push({ pos: null, players: unknown })
  return sections.filter((s) => s.players.length > 0)
}

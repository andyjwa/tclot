/**
 * A single line under the table, only when a club is exactly two
 * wins from La Decima (8 wins; 10 ends it) or exactly two wins from
 * a Golden Circuit (five different managers beaten in a row).
 */

/** @param {Array<{ league_entry?: number, teamName?: string, matches_won?: number }>} rows */
export function laDecimaTwoAway(rows) {
  return (rows || [])
    .filter((r) => Number(r?.matches_won) === 8 && r?.league_entry != null)
    .map((r) => ({
      leagueEntryId: r.league_entry,
      teamName: r.teamName || 'Club',
      kind: 'decima',
    }))
}

function sideResult(entryId, match) {
  const id = Number(entryId)
  const home = Number(match.league_entry_1) === id
  if (!home && Number(match.league_entry_2) !== id) return null
  const mine = Number(home ? match.league_entry_1_points : match.league_entry_2_points)
  const opp = Number(home ? match.league_entry_2_points : match.league_entry_1_points)
  const oppId = Number(home ? match.league_entry_2 : match.league_entry_1)
  if (!Number.isFinite(mine) || !Number.isFinite(opp) || !Number.isFinite(oppId)) return null
  return { win: mine > opp, oppId }
}

/**
 * @param {Array<object>} matches
 * @param {Map<number, string>} nameByEntry
 */
export function goldenCircuitTwoAway(matches, nameByEntry) {
  const finished = (matches || [])
    .filter(
      (m) =>
        m &&
        m.finished &&
        m.league_entry_1_points != null &&
        m.league_entry_2_points != null,
    )
    .slice()
    .sort(
      (a, b) =>
        Number(a.event) - Number(b.event) ||
        Number(a.league_entry_1) - Number(b.league_entry_1),
    )

  /** @type {Map<number, object[]>} */
  const byEntry = new Map()
  for (const m of finished) {
    for (const id of [Number(m.league_entry_1), Number(m.league_entry_2)]) {
      if (!Number.isFinite(id)) continue
      if (!byEntry.has(id)) byEntry.set(id, [])
      byEntry.get(id).push(m)
    }
  }

  const out = []
  for (const [id, list] of byEntry) {
    /** @type {number[]} */
    const streak = []
    for (const m of list) {
      const res = sideResult(id, m)
      if (!res?.win) {
        streak.length = 0
        continue
      }
      if (streak.includes(res.oppId)) {
        streak.length = 0
        streak.push(res.oppId)
        continue
      }
      streak.push(res.oppId)
    }
    if (streak.length === 5) {
      out.push({
        leagueEntryId: id,
        teamName: nameByEntry.get(id) || 'Club',
        kind: 'circuit',
      })
    }
  }
  return out
}

/**
 * @param {Array<{ league_entry?: number, teamName?: string, matches_won?: number }>} rows
 * @param {Array<object>} matches
 * @returns {string[]}
 */
export function raceWatchLines(rows, matches) {
  const names = new Map()
  for (const r of rows || []) {
    if (r?.league_entry != null) names.set(Number(r.league_entry), r.teamName || 'Club')
  }
  /** @type {Map<number, { teamName: string, decima: boolean, circuit: boolean }>} */
  const byId = new Map()
  for (const item of [
    ...laDecimaTwoAway(rows),
    ...goldenCircuitTwoAway(matches, names),
  ]) {
    const id = Number(item.leagueEntryId)
    const cur = byId.get(id) || {
      teamName: names.get(id) || item.teamName,
      decima: false,
      circuit: false,
    }
    if (item.kind === 'decima') cur.decima = true
    if (item.kind === 'circuit') cur.circuit = true
    byId.set(id, cur)
  }
  const lines = []
  for (const { teamName, decima, circuit } of byId.values()) {
    if (decima && circuit) {
      lines.push(`${teamName} is 2 wins from La Decima and the Golden Circuit`)
    } else if (decima) {
      lines.push(`${teamName} is 2 wins from La Decima`)
    } else if (circuit) {
      lines.push(`${teamName} is 2 wins from the Golden Circuit`)
    }
  }
  return lines
}

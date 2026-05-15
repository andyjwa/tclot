import { draftEntryEventUrl } from './fplDraftUrl'

/**
 * @param {{ entry_id?: number }[]} leagueEntries
 * @param {number} gw
 * @returns {Promise<Map<number, Set<number>|null>>} FPL entry_id → squad element IDs (or null on fetch failure).
 */
export async function fetchSquadSetsForGw(leagueEntries, gw) {
  const m = new Map()
  await Promise.all(
    (leagueEntries || []).map(async (le) => {
      const id = le.entry_id
      try {
        const url = draftEntryEventUrl(id, gw)
        const r = await fetch(url)
        if (!r.ok) {
          m.set(id, null)
          return
        }
        const j = await r.json()
        const els = (j.picks || []).map((p) => p.element).filter((x) => x != null)
        m.set(id, new Set(els))
      } catch {
        m.set(id, null)
      }
    }),
  )
  return m
}

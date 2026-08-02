import {
  enrichBootstrapElements,
  fetchKnownNameMap,
  fplElementDisplayName,
} from './fplElementNames.js'
import { POS_LABEL } from './playersWireList.js'
import { leagueDataBase } from './seasonArchive.js'

/** League JSON under `web/public/league-data` (or a season archive subtree). */
export const PLAYERS_LEAGUE_DATA_BASE = leagueDataBase()

export async function fetchBootstrapDraft(cacheKey = '') {
  const base = `${PLAYERS_LEAGUE_DATA_BASE}/bootstrap_draft.json`
  const url =
    cacheKey.trim() !== '' ? `${base}?v=${encodeURIComponent(cacheKey)}` : base
  const res = await fetch(url, cacheKey ? { cache: 'no-store' } : undefined)
  if (!res.ok) throw new Error(`bootstrap_draft.json (${res.status})`)
  const boot = await res.json()
  const knownMap = await fetchKnownNameMap(cacheKey)
  return enrichBootstrapElements(boot, knownMap)
}

export async function fetchLeagueJsonFile(name, cacheKey = '') {
  const base = `${PLAYERS_LEAGUE_DATA_BASE}/${name}`
  const url =
    cacheKey.trim() !== '' ? `${base}?v=${encodeURIComponent(cacheKey)}` : base
  const res = await fetch(url, cacheKey ? { cache: 'no-store' } : undefined)
  if (!res.ok) throw new Error(`${name} (${res.status})`)
  return res.json()
}

/** @param {number} leagueEntryId @param {Map<number,{leagueEntryId:number}>} ownerByElementId */
export function rosterIdsForLeagueEntry(leagueEntryId, ownerByElementId) {
  if (leagueEntryId == null) return new Set()
  const s = new Set()
  for (const [pid, owner] of ownerByElementId) {
    if (Number(owner.leagueEntryId) === Number(leagueEntryId)) {
      s.add(Number(pid))
    }
  }
  return s
}

/**
 * Pick lowest total-points teammate at position (quick “who might I bump?” cue).
 */
export function suggestBenchTarget(rosterElements, elemsById, waiverEl) {
  if (!waiverEl?.element_type) return null
  let best = null
  let bestPts = Infinity
  for (const pid of rosterElements) {
    const e = elemsById.get(Number(pid))
    if (!e || e.element_type !== waiverEl.element_type) continue
    const pts = Number(e.total_points) || 0
    if (pts < bestPts) {
      bestPts = pts
      best = pid
    }
  }
  return best
}

export function buildCompareOptionLabel(el, elementType, teamById, showClub = false) {
  const pts = Number(el.total_points) || 0
  const name = `${fplElementDisplayName(el, el.id)} (${POS_LABEL[elementType]})`
  if (!showClub || !teamById) return `${name} · ${pts} pts`
  const club = teamById.get(Number(el?.team))?.short_name ?? '—'
  return `${name} · ${club} · ${pts} pts`
}

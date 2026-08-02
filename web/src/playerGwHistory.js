import { defensiveContributionPointThreshold, fixturesForTeamInGw } from './fplBonusFromBps'
import { leagueDataBase } from './seasonArchive.js'

/** @type {object[] | null} */
let leagueFixturesCache = null
/** @type {Promise<object[]> | null} */
let leagueFixturesLoad = null

/**
 * Cached load of `league-data/fixtures.json` (per-fixture stats for DefCon display).
 * @param {string} [baseUrl]
 * @returns {Promise<object[]>}
 */
export function loadLeagueFixtures(baseUrl = leagueDataBase()) {
  if (leagueFixturesCache) return Promise.resolve(leagueFixturesCache)
  if (!leagueFixturesLoad) {
    leagueFixturesLoad = fetch(`${baseUrl}/fixtures.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        leagueFixturesCache = Array.isArray(data) ? data : []
        return leagueFixturesCache
      })
      .catch(() => {
        leagueFixturesCache = []
        return leagueFixturesCache
      })
  }
  return leagueFixturesLoad
}

/** @param {object} fixture @param {number} elementId */
export function defConFromFixtureStats(fixture, elementId) {
  const stats = fixture?.stats
  if (!Array.isArray(stats)) return null
  const eid = Number(elementId)
  if (!Number.isFinite(eid)) return null
  for (const block of stats) {
    if (block?.identifier !== 'defensive_contribution') continue
    for (const side of ['a', 'h']) {
      for (const row of block[side] || []) {
        if (Number(row?.element) === eid) {
          const n = Number(row.value)
          return Number.isFinite(n) ? n : null
        }
      }
    }
  }
  return null
}

/**
 * DefCon fantasy-point fixtures earned in one GW (max one per match; ×2 only on DGW).
 * @param {object} historyRow
 * @param {number} elementId
 * @param {number} teamId
 * @param {number | null | undefined} elementTypeId
 * @param {object[] | null | undefined} allFixtures
 */
export function defConFixtureHitsInGw(
  historyRow,
  elementId,
  teamId,
  elementTypeId,
  allFixtures,
) {
  const threshold = defensiveContributionPointThreshold(elementTypeId)
  if (threshold == null) return 0
  const dc = historyDcCount(historyRow)
  if (dc == null || dc < threshold) return 0

  const gw = historyGw(historyRow)
  if (!Number.isFinite(gw)) return dc >= threshold ? 1 : 0

  const list = Array.isArray(allFixtures) ? allFixtures : []
  if (!list.length) return 1

  const gwFixtures = list.filter((f) => Number(f.event) === gw)
  const teamFixtures = fixturesForTeamInGw(gwFixtures, teamId)

  if (teamFixtures.length <= 1) return 1

  let hits = 0
  let sawPerFixture = false
  for (const fx of teamFixtures) {
    const perFx = defConFromFixtureStats(fx, elementId)
    if (perFx == null) continue
    sawPerFixture = true
    if (perFx >= threshold) hits += 1
  }
  if (!sawPerFixture) return 1
  return hits
}

/**
 * DC cell for season history: raw count below threshold; 🪖 once when earned; 🪖×2 only on DGW with two hits.
 * @param {object} historyRow
 * @param {number} elementId
 * @param {number} teamId
 * @param {number | null | undefined} elementTypeId
 * @param {object[] | null | undefined} [allFixtures]
 */
export function formatHistoryDcForRow(
  historyRow,
  elementId,
  teamId,
  elementTypeId,
  allFixtures = null,
) {
  const dc = historyDcCount(historyRow)
  const raw = dc == null ? NaN : Number(dc)
  if (!Number.isFinite(raw) || raw < 1) return ''
  const threshold = defensiveContributionPointThreshold(elementTypeId)
  if (threshold == null) return String(raw)
  if (raw < threshold) return String(raw)

  const hits = defConFixtureHitsInGw(
    historyRow,
    elementId,
    teamId,
    elementTypeId,
    allFixtures,
  )
  if (hits > 1) return `🪖×${hits}`
  return '🪖'
}

/** @deprecated Use {@link formatHistoryDcForRow} — kept for callers passing aggregate count only. */
export function formatHistoryDc(dc, elementTypeId) {
  const raw = dc == null ? NaN : Number(dc)
  if (!Number.isFinite(raw) || raw < 1) return '—'
  const threshold = defensiveContributionPointThreshold(elementTypeId)
  if (threshold == null) return String(raw)
  if (raw < threshold) return String(raw)
  return '🪖'
}

/** Gameweek index on a history row — classic API uses `round`, draft uses `event`. */
export function historyGw(h) {
  if (!h || typeof h !== 'object') return NaN
  const n = Number(h.round ?? h.event)
  return Number.isFinite(n) ? n : NaN
}

export function historyDcCount(h) {
  const v =
    h?.defensive_contribution ??
    h?.defensive_contributions ??
    h?.dc ??
    h?.dc_count
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Every gameweek row FPL returns for this player (current season `history`), oldest GW first. */
export function normalizeHistoryRows(payload) {
  const raw = payload?.history
  if (!Array.isArray(raw)) return []
  return [...raw]
    .filter((h) => h && Number.isFinite(historyGw(h)))
    .sort((a, b) => historyGw(a) - historyGw(b))
}

/** @param {object[]} rows */
export function historyRowsByGw(rows) {
  const m = new Map()
  for (const h of rows) {
    const gw = historyGw(h)
    if (Number.isFinite(gw)) m.set(gw, h)
  }
  return m
}

/** Sorted union of gameweeks present in either player's history. */
export function mergedGameweeks(primaryRows, compareRows) {
  const s = new Set()
  for (const h of primaryRows) {
    const gw = historyGw(h)
    if (Number.isFinite(gw)) s.add(gw)
  }
  for (const h of compareRows) {
    const gw = historyGw(h)
    if (Number.isFinite(gw)) s.add(gw)
  }
  return [...s].sort((a, b) => a - b)
}

export function historyMinutes(h) {
  const n = Number(h?.minutes)
  return Number.isFinite(n) ? n : 0
}

export function historyPoints(h) {
  const n = Number(h?.total_points)
  return Number.isFinite(n) ? n : null
}

/**
 * @param {Map<number, object> | Record<number | string, object> | null | undefined} teamById
 */
function lookupPlTeam(teamById, teamNumericId) {
  const tid = Number(teamNumericId)
  if (!Number.isFinite(tid)) return null
  if (teamById instanceof Map) {
    const t = teamById.get(tid)
    return t && typeof t === 'object' ? t : null
  }
  const t = teamById?.[tid]
  return t && typeof t === 'object' ? t : null
}

/** @typedef {{ code: number | null, short: string, name: string, isHome: boolean }} HistoryOppClub */

/**
 * Premier League opponents for this GW (`fixtures.json` × bootstrap teams); used for badges in player detail history.
 *
 * @param {number | null | undefined} gameweek
 * @param {number | null | undefined} playerTeamId FPL real-life team id (`element.team`)
 * @param {object[] | null | undefined} allFixtures
 * @param {Map<number, object> | Record<number | string, object> | null | undefined} teamById
 * @returns {{ opponents: HistoryOppClub[], title: string }}
 */
export function historyOpponentMetaForGw(gameweek, playerTeamId, allFixtures, teamById) {
  /** @type {{ opponents: HistoryOppClub[], title: string }} */
  const unset = { opponents: [], title: '' }
  const gw = Number(gameweek)
  const tid = Number(playerTeamId)
  if (!Number.isFinite(gw) || !Number.isFinite(tid)) return unset
  const list = Array.isArray(allFixtures) ? allFixtures : []
  if (!list.length || teamById == null) return unset

  const gwFixtures = list.filter((f) => Number(f.event) === gw)
  const mine = fixturesForTeamInGw(gwFixtures, tid)
  if (!mine.length) return unset

  const sorted = mine.slice().sort((a, b) => {
    const ka = a.kickoff_time != null ? String(a.kickoff_time) : ''
    const kb = b.kickoff_time != null ? String(b.kickoff_time) : ''
    return ka.localeCompare(kb)
  })

  /** @type {HistoryOppClub[]} */
  const opponents = []
  const seenShort = new Set()
  for (const f of sorted) {
    const th = Number(f.team_h)
    const ta = Number(f.team_a)
    const oppId = th === tid ? ta : th
    /** Player's club is listed as team_h → home fixture. */
    const isHome = th === tid
    const opp = lookupPlTeam(teamById, oppId)
    const short =
      opp?.short_name != null ? String(opp.short_name) : opp?.short != null ? String(opp.short) : null
    if (!short || seenShort.has(short)) continue
    seenShort.add(short)
    const name = opp?.name != null ? String(opp.name) : short
    const codeRaw = opp?.code
    const codeN = Number(codeRaw)
    opponents.push({
      code: Number.isFinite(codeN) ? codeN : null,
      short,
      name,
      isHome,
    })
  }

  if (!opponents.length) return unset
  const title = opponents.map((o) => `${o.isHome ? 'Home' : 'Away'} vs ${o.name}`).join(' · ')
  return {
    opponents,
    title,
  }
}

export function formatHistoryCount(emoji, count) {
  const n = Number(count)
  if (!Number.isFinite(n) || n < 1) return ''
  return n > 1 ? `${emoji}×${n}` : emoji
}

/** Blank when a per-GW stat is zero, missing, or a dash placeholder. */
export function formatHistoryBlankStat(v) {
  if (v == null) return ''
  if (typeof v === 'string') {
    const t = v.trim()
    if (t === '' || t === '—' || t === '-') return ''
  }
  const n = Number(v)
  if (Number.isFinite(n)) return n === 0 ? '' : String(n)
  return ''
}

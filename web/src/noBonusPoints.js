/**
 * Standings and H2H results with FPL bonus taken out of each counting XI.
 *
 * Bonus that counted is `stats.bonus` on the post-autosub XI, times the
 * pick multiplier (2 when a captain's points were doubled). Official match
 * scores stay the base — we only subtract that bonus, then re-rank with the
 * same keys as the live table: league points, points for, then name.
 */

import { effectiveXiIds } from './bestXi.js'
import { compareH2hStandingsKeys } from './h2hEffectiveFinished.js'

/**
 * @param {number} a
 * @param {number} b
 * @returns {'W' | 'D' | 'L'}
 */
export function matchOutcome(a, b) {
  const x = Number(a) || 0
  const y = Number(b) || 0
  if (x > y) return 'W'
  if (x < y) return 'L'
  return 'D'
}

/**
 * Bonus that actually landed in the score: post-autosub XI only, captain
 * multiplier included. Bench bonus does not count.
 *
 * @param {Array<{ element?: number, multiplier?: number }> | null | undefined} picks
 * @param {Array<{ element_out?: number, element_in?: number }> | null | undefined} subs
 * @param {Record<string, number> | Map<number, number> | null | undefined} bonusByElement
 * @returns {number}
 */
export function countedBonus(picks, subs, bonusByElement) {
  const xi = effectiveXiIds(picks, subs)
  const pickById = new Map()
  for (const p of picks || []) {
    const id = Number(p?.element)
    if (Number.isFinite(id) && id > 0) pickById.set(id, p)
  }
  let total = 0
  for (const id of xi) {
    const bonus = readBonus(bonusByElement, id)
    if (bonus <= 0) continue
    const multRaw = Number(pickById.get(id)?.multiplier)
    const mult = Number.isFinite(multRaw) && multRaw > 0 ? multRaw : 1
    total += bonus * mult
  }
  return total
}

function readBonus(bonusByElement, id) {
  if (!bonusByElement) return 0
  if (bonusByElement instanceof Map) return Number(bonusByElement.get(id)) || 0
  const raw = bonusByElement[id] ?? bonusByElement[String(id)]
  return Number(raw) || 0
}

/**
 * @param {number} pts
 * @param {number} bonus
 */
export function scoreWithoutBonus(pts, bonus) {
  return Math.max(0, (Number(pts) || 0) - (Number(bonus) || 0))
}

function emptyRec() {
  return { w: 0, d: 0, l: 0, pf: 0, pa: 0, pts: 0 }
}

function applyScore(rec, mine, opp) {
  const my = Number(mine) || 0
  const their = Number(opp) || 0
  rec.pf += my
  rec.pa += their
  const result = matchOutcome(my, their)
  if (result === 'W') rec.w += 1
  else if (result === 'D') rec.d += 1
  else rec.l += 1
  rec.pts = rec.w * 3 + rec.d
}

function recordChanged(a, b) {
  return a.w !== b.w || a.d !== b.d || a.l !== b.l
}

/**
 * Unique places after the standings sort (points, then points for, then
 * name). A tie does not share a number: three teams level on points are
 * 4th, 5th and 6th, not all 4th.
 *
 * @param {{ rank?: number }[]} rows already sorted
 */
export function assignPositions(rows) {
  rows.forEach((row, i) => {
    row.rank = i + 1
  })
  return rows
}

/**
 * Unique places from the current standings list, in display order.
 * Replaces the match-derived "Was" place when that list covers every team,
 * so Was matches the standings table (one number each, same order).
 *
 * @param {{ leagueEntryId: number, rank?: number }[]} nowRows
 * @param {Array<{ leagueEntryId?: number, league_entry?: number }> | null | undefined} currentStandings
 */
export function applyCurrentPlaces(nowRows, currentStandings) {
  if (!Array.isArray(currentStandings) || !currentStandings.length) return nowRows
  const place = new Map()
  currentStandings.forEach((row, i) => {
    const id = Number(row?.leagueEntryId ?? row?.league_entry)
    if (Number.isFinite(id)) place.set(id, i + 1)
  })
  if (!nowRows.every((row) => place.has(row.leagueEntryId))) return nowRows
  for (const row of nowRows) row.rank = place.get(row.leagueEntryId)
  return nowRows
}

function sortStandings(rows, nameOf) {
  rows.sort((a, b) =>
    compareH2hStandingsKeys(a.pts, b.pts, a.pf, b.pf, nameOf(a), nameOf(b)),
  )
  return rows
}

function sideView(fx, entryId) {
  const home = Number(fx.homeId) === Number(entryId)
  return {
    opponentId: home ? fx.awayId : fx.homeId,
    opponentName: home ? fx.awayName : fx.homeName,
    pts: home ? fx.homePts : fx.awayPts,
    oppPts: home ? fx.awayPts : fx.homePts,
    bonus: home ? fx.homeBonus : fx.awayBonus,
    oppBonus: home ? fx.awayBonus : fx.homeBonus,
    adj: home ? fx.homeAdj : fx.awayAdj,
    oppAdj: home ? fx.awayAdj : fx.homeAdj,
  }
}

/**
 * @param {{
 *   teams: { leagueEntryId: number, teamName?: string }[],
 *   fixtures: {
 *     gw: number,
 *     homeId: number,
 *     awayId: number,
 *     homeName?: string,
 *     awayName?: string,
 *     homePts: number,
 *     awayPts: number,
 *     homeBonus: number,
 *     awayBonus: number,
 *   }[],
 * }} input
 */
export function buildNoBonusReport(input) {
  const teams = input?.teams || []
  const currentStandings = input?.currentStandings
  const nameOfId = new Map(
    teams.map((t) => [Number(t.leagueEntryId), t.teamName || `Team ${t.leagueEntryId}`]),
  )
  const actual = new Map()
  const stripped = new Map()
  const bonusRemoved = new Map()
  const flipsByTeam = new Map()
  for (const t of teams) {
    const id = Number(t.leagueEntryId)
    actual.set(id, emptyRec())
    stripped.set(id, emptyRec())
    bonusRemoved.set(id, 0)
    flipsByTeam.set(id, [])
  }

  const fixtures = []
  for (const raw of input?.fixtures || []) {
    const homeId = Number(raw.homeId)
    const awayId = Number(raw.awayId)
    if (!Number.isFinite(homeId) || !Number.isFinite(awayId)) continue
    const homePts = Number(raw.homePts) || 0
    const awayPts = Number(raw.awayPts) || 0
    const homeBonus = Number(raw.homeBonus) || 0
    const awayBonus = Number(raw.awayBonus) || 0
    const homeAdj = scoreWithoutBonus(homePts, homeBonus)
    const awayAdj = scoreWithoutBonus(awayPts, awayBonus)
    const homeName = raw.homeName || nameOfId.get(homeId) || `Team ${homeId}`
    const awayName = raw.awayName || nameOfId.get(awayId) || `Team ${awayId}`
    const fromHome = matchOutcome(homePts, awayPts)
    const toHome = matchOutcome(homeAdj, awayAdj)
    const flipped = fromHome !== toHome
    const fx = {
      gw: Number(raw.gw) || 0,
      homeId,
      awayId,
      homeName,
      awayName,
      homePts,
      awayPts,
      homeBonus,
      awayBonus,
      homeAdj,
      awayAdj,
      flipped,
    }
    fixtures.push(fx)

    for (const id of [homeId, awayId]) {
      if (!actual.has(id)) {
        actual.set(id, emptyRec())
        stripped.set(id, emptyRec())
        bonusRemoved.set(id, 0)
        flipsByTeam.set(id, [])
        nameOfId.set(id, id === homeId ? homeName : awayName)
      }
    }
    applyScore(actual.get(homeId), homePts, awayPts)
    applyScore(actual.get(awayId), awayPts, homePts)
    applyScore(stripped.get(homeId), homeAdj, awayAdj)
    applyScore(stripped.get(awayId), awayAdj, homeAdj)
    bonusRemoved.set(homeId, (bonusRemoved.get(homeId) || 0) + homeBonus)
    bonusRemoved.set(awayId, (bonusRemoved.get(awayId) || 0) + awayBonus)

    if (flipped) {
      for (const id of [homeId, awayId]) {
        const side = sideView(fx, id)
        flipsByTeam.get(id).push({
          gw: fx.gw,
          opponentId: side.opponentId,
          opponentName: side.opponentName,
          bonusRemoved: side.bonus,
          opponentBonus: side.oppBonus,
          pts: side.pts,
          oppPts: side.oppPts,
          adj: side.adj,
          oppAdj: side.oppAdj,
          from: matchOutcome(side.pts, side.oppPts),
          to: matchOutcome(side.adj, side.oppAdj),
        })
      }
    }
  }

  const ids = [...new Set([...actual.keys()])]
  const nameOf = (row) => nameOfId.get(row.leagueEntryId) || `Team ${row.leagueEntryId}`

  const nowRows = ids.map((id) => ({
    leagueEntryId: id,
    ...actual.get(id),
  }))
  const nextRows = ids.map((id) => ({
    leagueEntryId: id,
    ...stripped.get(id),
  }))
  sortStandings(nowRows, nameOf)
  sortStandings(nextRows, nameOf)
  assignPositions(nowRows)
  assignPositions(nextRows)
  applyCurrentPlaces(nowRows, currentStandings)
  const nowById = new Map(nowRows.map((r) => [r.leagueEntryId, r]))

  const standings = nextRows.map((row) => {
    const now = nowById.get(row.leagueEntryId)
    const ptsDelta = row.pts - now.pts
    const rankDelta = now.rank - row.rank
    const changed =
      rankDelta !== 0 || ptsDelta !== 0 || recordChanged(row, now)
    return {
      leagueEntryId: row.leagueEntryId,
      teamName: nameOf(row),
      rank: row.rank,
      nowRank: now.rank,
      rankDelta,
      w: row.w,
      d: row.d,
      l: row.l,
      pts: row.pts,
      pf: row.pf,
      pa: row.pa,
      nowW: now.w,
      nowD: now.d,
      nowL: now.l,
      nowPts: now.pts,
      nowPf: now.pf,
      ptsDelta,
      bonusRemoved: bonusRemoved.get(row.leagueEntryId) || 0,
      changed,
    }
  })

  const teamRows = standings.map((row) => ({
    leagueEntryId: row.leagueEntryId,
    teamName: row.teamName,
    rank: row.rank,
    ptsDelta: row.ptsDelta,
    bonusRemoved: row.bonusRemoved,
    flips: (flipsByTeam.get(row.leagueEntryId) || []).sort(
      (a, b) => a.gw - b.gw || String(a.opponentName).localeCompare(String(b.opponentName)),
    ),
  }))

  return {
    schemaVersion: 1,
    gameweeks: [...new Set(fixtures.map((f) => f.gw))].sort((a, b) => a - b),
    flippedCount: fixtures.filter((f) => f.flipped).length,
    standings,
    fixtures: fixtures
      .filter((f) => f.flipped)
      .sort((a, b) => a.gw - b.gw || a.homeName.localeCompare(b.homeName)),
    teams: teamRows,
  }
}

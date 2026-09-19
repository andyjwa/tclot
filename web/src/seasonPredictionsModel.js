/**
 * Pure helpers for the living season predictions + weekly recap facts.
 *
 * Everything here is deterministic and reconstructible from details.json
 * (`matches`) plus the pre-season priors in season-preview.json — the deploy
 * pipeline never commits state back, so every build regenerates the full
 * snapshot history from scratch.
 *
 * "As of GW N" always means: bank matches with event <= N, simulate every
 * later match — even ones that have since finished — so historical snapshots
 * show what the model would have said at the time.
 */

import { favoriteFromOriented, orientFreezeRow } from './weeklyPreviewFreezeOrient.js'

/** Deterministic xorshift32 RNG in [0, 1). */
export function makeRng(seed) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    s >>>= 0
    return s / 4294967296
  }
}

function gaussFrom(rng) {
  const u = Math.max(rng(), 1e-9)
  const v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** A team's actual weekly scores from finished matches through `throughGw`. */
export function teamWeeklyScores(matches, entryId, throughGw) {
  const id = Number(entryId)
  const out = []
  for (const m of matches) {
    if (Number(m.event) > throughGw || !m.finished) continue
    if (Number(m.league_entry_1) === id) out.push(Number(m.league_entry_1_points) || 0)
    else if (Number(m.league_entry_2) === id) out.push(Number(m.league_entry_2_points) || 0)
  }
  return out
}

/**
 * How many pseudo-games the draft prior is worth in `updatedStrength`.
 *
 * Was 6, which let a single week move a team's strength by 1/7th of the gap —
 * over a 38-game season one result could halve a team's title odds. A weekly
 * H2H score is a very noisy read on true strength (fixtures, autosubs, one
 * red card), while the draft prior aggregates full player projections, so the
 * prior deserves more weight: with weekly noise sigma ~11 and prior accuracy
 * ~±3 weekly points, the implied weight is (11/3)^2 ≈ 12.
 */
export const STRENGTH_PRIOR_WEIGHT = 12

/**
 * Bayesian-ish strength update: the draft prior counts as `priorWeight`
 * pseudo-games, observed scores take over as real games accumulate.
 *
 * `muScores` optionally supplies a lower-noise observation series (e.g. the
 * xP-blended scores from `blendedWeeklyScoresByEntry`) that drives the mean
 * update, while `scores` (the raw actuals) always drive the variance estimate
 * — blended series are artificially smooth, and feeding them into the
 * variance would make the simulator overconfident about weekly spread.
 *
 * @param {{ mu: number, sigma: number }} prior
 * @param {number[]} scores actual weekly scores (variance + fallback mean)
 * @param {number} [priorWeight]
 * @param {number[]|null} [muScores] de-noised scores for the mean update
 */
export function updatedStrength(prior, scores, priorWeight = STRENGTH_PRIOR_WEIGHT, muScores = null) {
  const n = scores.length
  const se = prior.sigma / Math.sqrt(priorWeight + n)
  if (n === 0) return { mu: prior.mu, sigma: prior.sigma, se }
  const meanScores = Array.isArray(muScores) && muScores.length === n ? muScores : scores
  const sum = scores.reduce((a, b) => a + b, 0)
  const meanSum = meanScores.reduce((a, b) => a + b, 0)
  const mu = (priorWeight * prior.mu + meanSum) / (priorWeight + n)
  const obsVar =
    n > 1 ? scores.reduce((a, b) => a + (b - sum / n) ** 2, 0) / (n - 1) : prior.sigma ** 2
  const sigma = Math.sqrt(
    (priorWeight * prior.sigma ** 2 + n * obsVar) / (priorWeight + n),
  )
  return { mu, sigma, se: sigma / Math.sqrt(priorWeight + n) }
}

/**
 * De-noised weekly observation series per entry: each finished week's score
 * is blended toward the engine's pre-match expectation for the XI actually
 * fielded (`xPtsXi` from the projections-history archive). Actual score =
 * underlying performance + one-week luck; xP strips a whole layer of luck
 * (a 90-point fluke or a 25-point disasterclass moves strength far less),
 * while real squad changes still flow through because they move xP too.
 *
 * The engine's level can run hot/cold vs actuals (e.g. GW1 ran ~3.5 pts low
 * league-wide), so each week's xP values are re-centered to that week's
 * actual league mean before blending — xP contributes the *relative* signal,
 * actuals anchor the scoring level.
 *
 * Weeks with no archive row fall back to the raw actual score.
 *
 * @param {any[]} matches details.json matches
 * @param {number[]} entryIds all league entry ids
 * @param {number} throughGw
 * @param {Map<number, any>} historyByGw gw → parsed projections-history file
 * @param {number} [xpWeight] weight on the (re-centered) engine expectation
 * @returns {Map<number, number[]>} entry id → blended weekly series
 */
export function blendedWeeklyScoresByEntry(matches, entryIds, throughGw, historyByGw, xpWeight = 0.7) {
  const ids = entryIds.map(Number)
  const out = new Map(ids.map((id) => [id, []]))

  // Per-GW re-centering shift: actual league mean − engine league mean.
  const shiftByGw = new Map()
  for (const [gw, history] of historyByGw ?? []) {
    const rows = Array.isArray(history?.h2h) ? history.h2h : []
    let sumActual = 0
    let sumXp = 0
    let count = 0
    for (const row of rows) {
      const a1 = Number(row.actualH2hPts1)
      const a2 = Number(row.actualH2hPts2)
      const x1 = Number(row.xPtsXi1)
      const x2 = Number(row.xPtsXi2)
      if (![a1, a2, x1, x2].every(Number.isFinite)) continue
      sumActual += a1 + a2
      sumXp += x1 + x2
      count += 2
    }
    if (count > 0) shiftByGw.set(Number(gw), (sumActual - sumXp) / count)
  }

  const sorted = [...matches]
    .filter((m) => m.finished && Number(m.event) <= throughGw)
    .sort((a, b) => Number(a.event) - Number(b.event))
  for (const m of sorted) {
    const gw = Number(m.event)
    const history = historyByGw?.get(gw)
    for (const side of [1, 2]) {
      const id = Number(side === 1 ? m.league_entry_1 : m.league_entry_2)
      if (!out.has(id)) continue
      const actual = Number(side === 1 ? m.league_entry_1_points : m.league_entry_2_points) || 0
      let blended = actual
      const row = history ? findArchivedH2hRow(history, id, Number(side === 1 ? m.league_entry_2 : m.league_entry_1)) : null
      if (row) {
        const isE1 = Number(row.league_entry_1) === id
        const xp = Number(isE1 ? row.xPtsXi1 : row.xPtsXi2)
        if (Number.isFinite(xp)) {
          const centered = xp + (shiftByGw.get(gw) ?? 0)
          blended = xpWeight * centered + (1 - xpWeight) * actual
        }
      }
      out.get(id).push(blended)
    }
  }
  return out
}

/** H2H table state (pts/w/d/l/pf) from finished matches through `throughGw`. */
export function bankedTable(matches, entryIds, throughGw) {
  const t = new Map(
    entryIds.map((id) => [Number(id), { pts: 0, w: 0, d: 0, l: 0, pf: 0, played: 0 }]),
  )
  for (const m of matches) {
    if (Number(m.event) > throughGw || !m.finished) continue
    const a = t.get(Number(m.league_entry_1))
    const b = t.get(Number(m.league_entry_2))
    if (!a || !b) continue
    const pa = Number(m.league_entry_1_points) || 0
    const pb = Number(m.league_entry_2_points) || 0
    a.pf += pa
    b.pf += pb
    a.played++
    b.played++
    if (pa > pb) {
      a.pts += 3
      a.w++
      b.l++
    } else if (pb > pa) {
      b.pts += 3
      b.w++
      a.l++
    } else {
      a.pts += 1
      b.pts += 1
      a.d++
      b.d++
    }
  }
  return t
}

/**
 * Simulate the season as of `throughGw`: banked results stand, every later
 * match is sampled from each side's normal strength (rounded, so draws
 * happen). Each iteration first draws every team's "true" strength around
 * its estimate (`se` — the standard error, shrinking as real games
 * accumulate), so early-season odds honestly reflect how little the model
 * knows yet and one bad week can't crater a favourite.
 *
 * Returns per-entry summary keyed by entry id.
 *
 * @param {{
 *   matches: any[],
 *   entryIds: number[],
 *   throughGw: number,
 *   strengths: Map<number, { mu: number, sigma: number, se?: number }>,
 *   sims?: number,
 *   seed?: number,
 * }} args
 */
export function simulateSeasonAsOf({ matches, entryIds, throughGw, strengths, sims = 2000, seed = 1 }) {
  const ids = entryIds.map(Number)
  const idx = new Map(ids.map((id, i) => [id, i]))
  const n = ids.length
  const base = bankedTable(matches, ids, throughGw)
  const future = matches.filter((m) => Number(m.event) > throughGw)
  const rng = makeRng(seed)

  const sumPts = new Array(n).fill(0)
  const sumPf = new Array(n).fill(0)
  const sumW = new Array(n).fill(0)
  const sumD = new Array(n).fill(0)
  const finishCounts = Array.from({ length: n }, () => new Array(n).fill(0))

  for (let s = 0; s < sims; s++) {
    const pts = ids.map((id) => base.get(id).pts)
    const pf = ids.map((id) => base.get(id).pf)
    const w = ids.map((id) => base.get(id).w)
    const d = ids.map((id) => base.get(id).d)
    const mus = ids.map((id) => {
      const t = strengths.get(id)
      return t.mu + (t.se ?? 0) * gaussFrom(rng)
    })
    for (const m of future) {
      const i = idx.get(Number(m.league_entry_1))
      const j = idx.get(Number(m.league_entry_2))
      if (i == null || j == null) continue
      const si = strengths.get(ids[i])
      const sj = strengths.get(ids[j])
      const a = Math.max(0, Math.round(mus[i] + si.sigma * gaussFrom(rng)))
      const b = Math.max(0, Math.round(mus[j] + sj.sigma * gaussFrom(rng)))
      pf[i] += a
      pf[j] += b
      if (a > b) {
        pts[i] += 3
        w[i]++
      } else if (b > a) {
        pts[j] += 3
        w[j]++
      } else {
        pts[i] += 1
        pts[j] += 1
        d[i]++
        d[j]++
      }
    }
    const order = [...Array(n).keys()].sort((x, y) => pts[y] - pts[x] || pf[y] - pf[x])
    order.forEach((teamIdx, rank) => {
      finishCounts[teamIdx][rank]++
    })
    for (let i = 0; i < n; i++) {
      sumPts[i] += pts[i]
      sumPf[i] += pf[i]
      sumW[i] += w[i]
      sumD[i] += d[i]
    }
  }

  const out = new Map()
  ids.forEach((id, i) => {
    const fc = finishCounts[i]
    const banked = base.get(id)
    out.set(id, {
      titlePct: +((fc[0] / sims) * 100).toFixed(1),
      topHalfPct: +((fc.slice(0, Math.floor(n / 2)).reduce((a, b) => a + b, 0) / sims) * 100).toFixed(1),
      lastPct: +((fc[n - 1] / sims) * 100).toFixed(1),
      avgFinish: +(fc.reduce((a, c, r) => a + c * (r + 1), 0) / sims).toFixed(2),
      projPts: +(sumPts[i] / sims).toFixed(1),
      projPf: Math.round(sumPf[i] / sims),
      avgW: +(sumW[i] / sims).toFixed(1),
      avgD: +(sumD[i] / sims).toFixed(1),
      finishDistribution: fc.map((c) => +((c / sims) * 100).toFixed(1)),
      banked: { ...banked },
    })
  })
  return out
}

/** Standings order (rank per entry) from banked results through `throughGw`. */
export function ranksAsOf(matches, entryIds, throughGw) {
  const t = bankedTable(matches, entryIds, throughGw)
  const order = [...t.entries()].sort(
    (a, b) => b[1].pts - a[1].pts || b[1].pf - a[1].pf,
  )
  const ranks = new Map()
  order.forEach(([id], i) => ranks.set(id, i + 1))
  return ranks
}

/** Current win/loss streak through `throughGw`: e.g. { type: 'W', len: 3 }. */
export function streakAsOf(matches, entryId, throughGw) {
  const id = Number(entryId)
  const results = []
  for (const m of matches) {
    if (Number(m.event) > throughGw || !m.finished) continue
    let mine = null
    let theirs = null
    if (Number(m.league_entry_1) === id) {
      mine = Number(m.league_entry_1_points) || 0
      theirs = Number(m.league_entry_2_points) || 0
    } else if (Number(m.league_entry_2) === id) {
      mine = Number(m.league_entry_2_points) || 0
      theirs = Number(m.league_entry_1_points) || 0
    } else continue
    results.push({ ev: Number(m.event), r: mine > theirs ? 'W' : mine < theirs ? 'L' : 'D' })
  }
  results.sort((a, b) => a.ev - b.ev)
  if (results.length === 0) return null
  const last = results[results.length - 1].r
  let len = 0
  for (let i = results.length - 1; i >= 0 && results[i].r === last; i--) len++
  return { type: last, len }
}

/**
 * Season head-to-head series between two entries, counting every finished
 * fixture between them with event <= throughGw. Oriented to `entryA` (so
 * `aWins` is entryA's wins). Returns null when they've never met yet.
 */
export function h2hSeriesAsOf(matches, entryA, entryB, throughGw) {
  const a = Number(entryA)
  const b = Number(entryB)
  let aWins = 0
  let bWins = 0
  let draws = 0
  let last = null
  const meetings = []
  for (const m of matches) {
    if (!m.finished || Number(m.event) > throughGw) continue
    const e1 = Number(m.league_entry_1)
    const e2 = Number(m.league_entry_2)
    if (!((e1 === a && e2 === b) || (e1 === b && e2 === a))) continue
    const p1 = Number(m.league_entry_1_points) || 0
    const p2 = Number(m.league_entry_2_points) || 0
    const aPts = e1 === a ? p1 : p2
    const bPts = e1 === a ? p2 : p1
    let r
    if (aPts > bPts) {
      aWins++
      r = 'A'
    } else if (bPts > aPts) {
      bWins++
      r = 'B'
    } else {
      draws++
      r = 'D'
    }
    meetings.push({ ev: Number(m.event), r })
  }
  const games = aWins + bWins + draws
  if (games === 0) return null
  meetings.sort((x, y) => x.ev - y.ev)
  last = meetings[meetings.length - 1].r
  return { games, aWins, bWins, draws, lastResult: last }
}

/**
 * Per-team + per-match facts for one finished gameweek, ready for the recap
 * text generator. Returns null when the GW has no finished matches.
 */
export function recapFactsForGw(matches, entryIds, nameById, gw) {
  const gwMatches = matches.filter((m) => Number(m.event) === gw && m.finished)
  if (gwMatches.length === 0) return null
  const ids = entryIds.map(Number)
  const ranksNow = ranksAsOf(matches, ids, gw)
  const ranksPrev = gw > 1 ? ranksAsOf(matches, ids, gw - 1) : null

  const matchRows = gwMatches.map((m) => {
    const h = Number(m.league_entry_1)
    const a = Number(m.league_entry_2)
    const hp = Number(m.league_entry_1_points) || 0
    const ap = Number(m.league_entry_2_points) || 0
    return { home: h, away: a, homePts: hp, awayPts: ap, margin: Math.abs(hp - ap) }
  })

  const weekHighPts = Math.max(...matchRows.flatMap((r) => [r.homePts, r.awayPts]))
  const table = bankedTable(matches, ids, gw)

  const teams = new Map()
  for (const row of matchRows) {
    for (const side of ['home', 'away']) {
      const id = row[side]
      const mine = side === 'home' ? row.homePts : row.awayPts
      const theirs = side === 'home' ? row.awayPts : row.homePts
      const oppId = side === 'home' ? row.away : row.home
      const scores = teamWeeklyScores(matches, id, gw)
      const priorScores = scores.slice(0, -1)
      const seasonAvg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
      teams.set(id, {
        entryId: id,
        name: nameById.get(id) ?? String(id),
        oppName: nameById.get(oppId) ?? String(oppId),
        points: mine,
        oppPoints: theirs,
        result: mine > theirs ? 'W' : mine < theirs ? 'L' : 'D',
        margin: Math.abs(mine - theirs),
        rank: ranksNow.get(id),
        prevRank: ranksPrev ? ranksPrev.get(id) : null,
        record: (() => {
          const t = table.get(id)
          return { w: t.w, d: t.d, l: t.l }
        })(),
        streak: streakAsOf(matches, id, gw),
        seasonAvg: +seasonAvg.toFixed(1),
        isSeasonHigh: priorScores.length > 0 && mine > Math.max(...priorScores),
        isWeekHigh: mine === weekHighPts,
      })
    }
  }

  const sortedByMargin = [...matchRows].sort((a, b) => a.margin - b.margin)
  return {
    gw,
    matches: matchRows,
    teams,
    superlatives: {
      weekHigh: [...teams.values()].find((t) => t.isWeekHigh) ?? null,
      closest: sortedByMargin[0] ?? null,
      blowout: sortedByMargin[sortedByMargin.length - 1] ?? null,
    },
  }
}

/** Standard normal CDF (Abramowitz–Stegun erf approximation). */
function normCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  let p =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  if (z > 0) p = 1 - p
  return p
}

/**
 * P(home outscores away) from two normal strengths, as a clamped percent.
 * Uses the predictive spread: weekly score noise (sigma) plus each side's
 * strength-estimate uncertainty (se), so early-season fallback odds don't
 * overstate confidence in barely-separated estimates.
 */
export function strengthWinPct(home, away) {
  const sd = Math.sqrt(
    home.sigma ** 2 + away.sigma ** 2 + (home.se ?? 0) ** 2 + (away.se ?? 0) ** 2,
  )
  if (!(sd > 0)) return home.mu > away.mu ? 99 : home.mu < away.mu ? 1 : 50
  const p = normCdf((home.mu - away.mu) / sd)
  return Math.min(99, Math.max(1, Math.round(p * 100)))
}

/**
 * Model favorite + pre-match win percentages for one match.
 *
 * Prefers the locked weekly Preview freeze (the board the recap is scored
 * against), then the archived engine odds, then the strength model.
 *
 * @returns {{
 *   favorite: number|null,
 *   source: 'preview'|'engine'|'strength',
 *   homePct: number|null,
 *   awayPct: number|null,
 *   predHome?: number|null,
 *   predAway?: number|null,
 * }}
 */
export function matchFavorite(match, history, strengths, previewFreeze = null) {
  const h = Number(match.league_entry_1)
  const a = Number(match.league_entry_2)
  if (previewFreeze) {
    const oriented = orientFreezeRow(previewFreeze, h, a)
    if (oriented && Number.isFinite(oriented.homeWinPct) && Number.isFinite(oriented.awayWinPct)) {
      return favoriteFromOriented(oriented, h, a)
    }
  }
  const row = findArchivedH2hRow(history, h, a)
  if (row) {
    // Archive orientation: home = league_entry_1 of the archived row.
    const homeIsH = Number(row.league_entry_1) === h
    const hw = Number(row?.xPtsMc?.homeWinPct)
    const aw = Number(row?.xPtsMc?.awayWinPct)
    if (Number.isFinite(hw) && Number.isFinite(aw) && hw !== aw) {
      const homePct = homeIsH ? hw : aw
      const awayPct = homeIsH ? aw : hw
      return {
        favorite: homePct > awayPct ? h : a,
        source: 'engine',
        homePct,
        awayPct,
      }
    }
  }
  const sh = strengths?.get(h)
  const sa = strengths?.get(a)
  if (sh && sa) {
    const homePct = strengthWinPct(sh, sa)
    if (sh.mu !== sa.mu) {
      return {
        favorite: sh.mu > sa.mu ? h : a,
        source: 'strength',
        homePct,
        awayPct: 100 - homePct,
      }
    }
  }
  return { favorite: null, source: 'strength', homePct: null, awayPct: null }
}

/** The archived h2h row for a pairing, in either orientation, or null. */
export function findArchivedH2hRow(history, entryA, entryB) {
  const rows = Array.isArray(history?.h2h) ? history.h2h : []
  const a = Number(entryA)
  const b = Number(entryB)
  for (const row of rows) {
    const e1 = Number(row?.league_entry_1)
    const e2 = Number(row?.league_entry_2)
    if ((e1 === a && e2 === b) || (e1 === b && e2 === a)) return row
  }
  return null
}

/**
 * Pre-match projected vs actual score for one side of an archived h2h row
 * (`xPtsXi` vs `actualH2hPts`). Null when the archive lacks the fields.
 */
export function archivedScoreError(row, entryId) {
  if (!row) return null
  const isE1 = Number(row.league_entry_1) === Number(entryId)
  const pred = Number(isE1 ? row.xPtsXi1 : row.xPtsXi2)
  const actual = Number(isE1 ? row.actualH2hPts1 : row.actualH2hPts2)
  if (!Number.isFinite(pred) || !Number.isFinite(actual)) return null
  return { predicted: pred, actual, absErr: +Math.abs(pred - actual).toFixed(2) }
}

/**
 * One side's archived XI rows ({ id, name, pos, pts, xp }) from an archived
 * h2h row, oriented by entry id. Null when the archive predates
 * schemaVersion 3 (no per-player rows).
 */
export function archivedXi(row, entryId) {
  if (!row) return null
  const isE1 = Number(row.league_entry_1) === Number(entryId)
  const xi = isE1 ? row.xi1 : row.xi2
  return Array.isArray(xi) && xi.length > 0 ? xi : null
}

/**
 * Player storylines for one side of a matchup, from archived XI rows:
 *  - `top`: the side's top scorer.
 *  - `share`: top scorer's share of the team's XI points.
 *  - `haul`: top scorer again when the week counts as a haul (>= 15, or >= 13
 *    while beating the model's pre-match call for them by 2.5x).
 *  - `flop`: the biggest letdown — the highest-xP player who was expected to
 *    lead (xP >= 5) and returned 2 points or fewer.
 */
export function sidePlayerFacts(xi) {
  if (!Array.isArray(xi) || xi.length === 0) return null
  const total = xi.reduce((s, p) => s + (Number(p.pts) || 0), 0)
  let top = xi[0]
  for (const p of xi) if ((Number(p.pts) || 0) > (Number(top.pts) || 0)) top = p
  const topPts = Number(top.pts) || 0
  const isHaul =
    topPts >= 15 || (topPts >= 13 && Number.isFinite(top.xp) && topPts >= top.xp * 2.5)
  let flop = null
  for (const p of xi) {
    if (!Number.isFinite(p.xp) || p.xp < 5 || (Number(p.pts) || 0) > 2) continue
    if (!flop || p.xp > flop.xp) flop = p
  }
  return {
    top: { id: top.id ?? null, name: top.name, pts: topPts },
    share: total > 0 ? +(topPts / total).toFixed(3) : 0,
    haul: isHaul ? { id: top.id ?? null, name: top.name, pts: topPts } : null,
    flop: flop
      ? { id: flop.id ?? null, name: flop.name, pts: Number(flop.pts) || 0, xp: flop.xp }
      : null,
  }
}

/** Sum of archived XI `pts`. Null when there is no XI to sum. */
export function sumArchivedXiPoints(xi) {
  if (!Array.isArray(xi) || xi.length === 0) return null
  return xi.reduce((s, p) => s + (Number(p.pts) || 0), 0)
}

/**
 * Recover the XI total from `sidePlayerFacts` when the archive itself is not
 * on hand: `top.pts / share`. Null when share is missing or zero.
 */
export function impliedXiPoints(players) {
  const top = Number(players?.top?.pts)
  const share = Number(players?.share)
  if (!Number.isFinite(top) || top < 0) return null
  if (!Number.isFinite(share) || share <= 0) return null
  return Math.round(top / share)
}

/**
 * Team GW total for a recap card. Official H2H points can lag the live XI
 * (FPL Draft leaves `league_entry_*_points` on Saturday leftovers while
 * player rows already have the finished haul). Never let the team total sit
 * below the XI sum, the implied XI from `top/share`, or the side's top scorer.
 *
 * @param {number | null | undefined} official
 * @param {{ players?: { top?: { pts?: number }, share?: number } | null, xi?: object[] | null }} [src]
 */
export function reconcileTeamPoints(official, { players = null, xi = null } = {}) {
  const officialN = Number(official)
  const officialPts = Number.isFinite(officialN) ? officialN : 0
  const xiSum = sumArchivedXiPoints(xi)
  const implied = impliedXiPoints(players)
  const topPts = Number(players?.top?.pts)
  return Math.max(
    officialPts,
    xiSum ?? 0,
    implied ?? 0,
    Number.isFinite(topPts) ? topPts : 0,
  )
}

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  teamWeeklyScores,
  updatedStrength,
  STRENGTH_PRIOR_WEIGHT,
  blendedWeeklyScoresByEntry,
  strengthWinPct,
  bankedTable,
  simulateSeasonAsOf,
  ranksAsOf,
  streakAsOf,
  recapFactsForGw,
  matchFavorite,
  findArchivedH2hRow,
  archivedScoreError,
  archivedXi,
  sidePlayerFacts,
  h2hSeriesAsOf,
  sumArchivedXiPoints,
  impliedXiPoints,
  reconcileTeamPoints,
} from './seasonPredictionsModel.js'

const IDS = [1, 2, 3, 4]

/** Round-robin-ish fixture list: GW1-3 finished, GW4 not. */
function fixtureSet() {
  const m = (event, a, b, pa, pb, finished = true) => ({
    event,
    league_entry_1: a,
    league_entry_2: b,
    league_entry_1_points: pa,
    league_entry_2_points: pb,
    finished,
    started: finished,
  })
  return [
    m(1, 1, 2, 50, 40),
    m(1, 3, 4, 30, 60),
    m(2, 1, 3, 45, 45),
    m(2, 2, 4, 55, 35),
    m(3, 1, 4, 70, 20),
    m(3, 2, 3, 41, 42),
    m(4, 2, 1, 0, 0, false),
    m(4, 4, 3, 0, 0, false),
  ]
}

test('teamWeeklyScores respects throughGw and finished flag', () => {
  const matches = fixtureSet()
  assert.deepEqual(teamWeeklyScores(matches, 1, 3), [50, 45, 70])
  assert.deepEqual(teamWeeklyScores(matches, 1, 1), [50])
  // GW4 not finished — never counted even when throughGw includes it
  assert.deepEqual(teamWeeklyScores(matches, 1, 4), [50, 45, 70])
})

test('updatedStrength: no games returns the prior, se shrinks with games', () => {
  const prior = { mu: 50, sigma: 10 }
  const none = updatedStrength(prior, [], 6)
  assert.equal(none.mu, 50)
  assert.equal(none.sigma, 10)
  const one = updatedStrength(prior, [29], 6)
  // (6*50 + 29) / 7 = 47
  assert.equal(one.mu, 47)
  assert.ok(one.se < none.se, 'standard error shrinks as games accumulate')
})

test('updatedStrength default prior weight is 12 (damped single-week response)', () => {
  assert.equal(STRENGTH_PRIOR_WEIGHT, 12)
  const prior = { mu: 50, sigma: 10 }
  const d = updatedStrength(prior, [29])
  // (12*50 + 29) / 13 ≈ 48.38 — roughly half the swing of the old weight-6 update (47)
  assert.ok(Math.abs(d.mu - 629 / 13) < 1e-9)
  assert.ok(d.mu > updatedStrength(prior, [29], 6).mu, 'heavier prior damps one bad week')
})

test('updatedStrength muScores drive the mean while actuals drive the variance', () => {
  const prior = { mu: 50, sigma: 10 }
  const actuals = [20, 80] // wild swings
  const denoised = [48, 52] // what the engine thought those weeks were worth
  const blended = updatedStrength(prior, actuals, 6, denoised)
  const raw = updatedStrength(prior, actuals, 6)
  // Same actual sum (100) either way here, so pick asymmetric actuals to see the mean move:
  const blended2 = updatedStrength(prior, [20, 30], 6, [48, 52])
  const raw2 = updatedStrength(prior, [20, 30], 6)
  assert.ok(blended2.mu > raw2.mu, 'de-noised series pulls the mean less than raw bad weeks')
  // Variance always comes from the actuals — smooth muScores must not shrink sigma.
  assert.equal(blended.sigma, raw.sigma)
  // Mismatched-length muScores are ignored (falls back to actuals).
  const mismatched = updatedStrength(prior, [20, 30], 6, [48])
  assert.equal(mismatched.mu, raw2.mu)
})

test('blendedWeeklyScoresByEntry re-centers xP to the week level and blends', () => {
  const matches = [
    {
      event: 1,
      league_entry_1: 1,
      league_entry_2: 2,
      league_entry_1_points: 31,
      league_entry_2_points: 51,
      finished: true,
    },
  ]
  const historyByGw = new Map([
    [
      1,
      {
        h2h: [
          {
            league_entry_1: 1,
            league_entry_2: 2,
            xPtsXi1: 45,
            xPtsXi2: 39,
            actualH2hPts1: 31,
            actualH2hPts2: 51,
          },
        ],
      },
    ],
  ])
  const out = blendedWeeklyScoresByEntry(matches, [1, 2], 1, historyByGw, 0.7)
  // Week shift: actual mean 41, xP mean 42 → shift −1. Centered xP: 44 and 38.
  // Team 1: 0.7*44 + 0.3*31 = 40.1 — a 31-point week with a 45-xP XI reads as unlucky.
  assert.ok(Math.abs(out.get(1)[0] - 40.1) < 1e-9)
  // Team 2: 0.7*38 + 0.3*51 = 41.9 — a 51-point week on a 39-xP XI reads as fortunate.
  assert.ok(Math.abs(out.get(2)[0] - 41.9) < 1e-9)
})

test('blendedWeeklyScoresByEntry falls back to actuals when no archive exists', () => {
  const matches = [
    {
      event: 1,
      league_entry_1: 1,
      league_entry_2: 2,
      league_entry_1_points: 31,
      league_entry_2_points: 51,
      finished: true,
    },
  ]
  const out = blendedWeeklyScoresByEntry(matches, [1, 2], 1, new Map())
  assert.deepEqual(out.get(1), [31])
  assert.deepEqual(out.get(2), [51])
})

test('strengthWinPct includes strength-estimate uncertainty when present', () => {
  const withSe = strengthWinPct({ mu: 50, sigma: 8, se: 5 }, { mu: 45, sigma: 8, se: 5 })
  const noSe = strengthWinPct({ mu: 50, sigma: 8 }, { mu: 45, sigma: 8 })
  assert.ok(withSe < noSe, 'extra estimate uncertainty pulls odds toward even')
  assert.ok(withSe > 50, 'higher mu still favored')
})

test('updatedStrength moves toward the observed mean with more games', () => {
  const prior = { mu: 50, sigma: 10 }
  const few = updatedStrength(prior, [70, 70], 6)
  const many = updatedStrength(prior, [70, 70, 70, 70, 70, 70, 70, 70], 6)
  assert.ok(few.mu > prior.mu)
  assert.ok(many.mu > few.mu, 'more evidence pulls harder')
  assert.ok(many.mu < 70, 'prior still counts')
})

test('bankedTable scores 3/1/0 with points-for', () => {
  const t = bankedTable(fixtureSet(), IDS, 3)
  assert.deepEqual(t.get(1), { pts: 7, w: 2, d: 1, l: 0, pf: 165, played: 3 })
  assert.deepEqual(t.get(4), { pts: 3, w: 1, d: 0, l: 2, pf: 115, played: 3 })
})

test('ranksAsOf orders by points then points-for', () => {
  const ranks = ranksAsOf(fixtureSet(), IDS, 3)
  assert.equal(ranks.get(1), 1) // 7 pts
  assert.equal(ranks.get(3), 2) // 4 pts (L, D, W)
  // 2 and 4 both on 3 pts: 2 has pf 136, 4 has pf 115
  assert.equal(ranks.get(2), 3)
  assert.equal(ranks.get(4), 4)
})

test('streakAsOf finds current run', () => {
  const matches = fixtureSet()
  assert.deepEqual(streakAsOf(matches, 4, 3), { type: 'L', len: 2 })
  assert.deepEqual(streakAsOf(matches, 1, 1), { type: 'W', len: 1 })
  assert.equal(streakAsOf(matches, 1, 0), null)
})

test('simulateSeasonAsOf banks finished results and is deterministic', () => {
  const matches = fixtureSet()
  const strengths = new Map(IDS.map((id) => [id, { mu: 50, sigma: 8, se: 2 }]))
  const args = { matches, entryIds: IDS, throughGw: 3, strengths, sims: 500, seed: 7 }
  const a = simulateSeasonAsOf(args)
  const b = simulateSeasonAsOf(args)
  assert.deepEqual(a.get(1), b.get(1), 'same seed → same output')
  // Team 1 leads by 3 pts with one equal-strength game left: heavy favorite
  assert.ok(a.get(1).titlePct > 60)
  const total = IDS.reduce((s, id) => s + a.get(id).titlePct, 0)
  assert.ok(Math.abs(total - 100) < 1.5, `title odds sum ≈ 100, got ${total}`)
  // Banked points carried into projections
  assert.ok(a.get(1).projPts >= 7)
})

test('simulateSeasonAsOf at throughGw 0 ignores finished results', () => {
  const matches = fixtureSet()
  const strengths = new Map(IDS.map((id) => [id, { mu: 50, sigma: 8, se: 2 }]))
  const sim = simulateSeasonAsOf({ matches, entryIds: IDS, throughGw: 0, strengths, sims: 500, seed: 7 })
  for (const id of IDS) {
    assert.equal(sim.get(id).banked.pts, 0)
    // Equal strengths → nobody dominates
    assert.ok(sim.get(id).titlePct > 10 && sim.get(id).titlePct < 40)
  }
})

test('recapFactsForGw computes results, ranks, streaks and superlatives', () => {
  const matches = fixtureSet()
  const names = new Map(IDS.map((id) => [id, `Team ${id}`]))
  const facts = recapFactsForGw(matches, IDS, names, 3)
  assert.equal(facts.gw, 3)
  const t1 = facts.teams.get(1)
  assert.equal(t1.result, 'W')
  assert.equal(t1.points, 70)
  assert.equal(t1.oppName, 'Team 4')
  assert.equal(t1.rank, 1)
  assert.ok(t1.isSeasonHigh)
  assert.ok(t1.isWeekHigh)
  assert.deepEqual(t1.record, { w: 2, d: 1, l: 0 })
  assert.equal(facts.superlatives.weekHigh.name, 'Team 1')
  assert.equal(facts.superlatives.closest.margin, 1)
  assert.equal(facts.superlatives.blowout.margin, 50)
  assert.equal(recapFactsForGw(matches, IDS, names, 4), null, 'unfinished GW → null')
})

test('matchFavorite prefers locked Preview freeze over archive', () => {
  const match = { league_entry_1: 6849, league_entry_2: 4898 }
  const history = {
    h2h: [
      {
        league_entry_1: 6849,
        league_entry_2: 4898,
        xPtsMc: { homeWinPct: 54, drawPct: 4, awayWinPct: 42 },
      },
    ],
  }
  const freeze = {
    home: 6849,
    away: 4898,
    homeWinPct: 41,
    drawPct: 5,
    awayWinPct: 54,
    predHome: 36,
    predAway: 40,
  }
  const out = matchFavorite(match, history, null, freeze)
  assert.equal(out.favorite, 4898)
  assert.equal(out.source, 'preview')
  assert.equal(out.homePct, 41)
  assert.equal(out.awayPct, 54)
  assert.equal(out.predHome, 36)
})

test('matchFavorite prefers the archived engine odds over strengths', () => {
  const match = { league_entry_1: 1, league_entry_2: 2 }
  const history = {
    h2h: [
      {
        league_entry_1: 1,
        league_entry_2: 2,
        xPtsMc: { homeWinPct: 30, drawPct: 10, awayWinPct: 60 },
      },
    ],
  }
  // Strength model would pick 1; the archive says 2.
  const strengths = new Map([
    [1, { mu: 60, sigma: 8 }],
    [2, { mu: 40, sigma: 8 }],
  ])
  assert.deepEqual(matchFavorite(match, history, strengths), {
    favorite: 2,
    source: 'engine',
    homePct: 30,
    awayPct: 60,
  })
  const fallback = matchFavorite(match, null, strengths)
  assert.equal(fallback.favorite, 1)
  assert.equal(fallback.source, 'strength')
  assert.ok(fallback.homePct > 90, `strength gap of 20 → strong favorite, got ${fallback.homePct}`)
  assert.equal(fallback.homePct + fallback.awayPct, 100)
  assert.equal(matchFavorite(match, null, null).favorite, null)
  assert.equal(matchFavorite(match, null, null).homePct, null)
})

test('matchFavorite handles reversed archive orientation', () => {
  const match = { league_entry_1: 1, league_entry_2: 2 }
  const history = {
    h2h: [
      {
        league_entry_1: 2,
        league_entry_2: 1,
        xPtsMc: { homeWinPct: 70, drawPct: 10, awayWinPct: 20 },
      },
    ],
  }
  const rev = matchFavorite(match, history, null)
  assert.equal(rev.favorite, 2)
  // Pcts stay oriented to the MATCH's home/away, not the archive row's.
  assert.equal(rev.homePct, 20)
  assert.equal(rev.awayPct, 70)
})

test('archivedScoreError orients by entry id', () => {
  const row = {
    league_entry_1: 1,
    league_entry_2: 2,
    xPtsXi1: 48.2,
    xPtsXi2: 41.0,
    actualH2hPts1: 55,
    actualH2hPts2: 39,
  }
  assert.equal(findArchivedH2hRow({ h2h: [row] }, 2, 1), row)
  assert.deepEqual(archivedScoreError(row, 1), {
    predicted: 48.2,
    actual: 55,
    absErr: 6.8,
  })
  assert.deepEqual(archivedScoreError(row, 2), {
    predicted: 41,
    actual: 39,
    absErr: 2,
  })
  assert.equal(archivedScoreError(null, 1), null)
})

test('archivedXi orients by entry id and tolerates old schemas', () => {
  const xi1 = [{ id: 10, name: 'Haaland', pos: 'FWD', pts: 13, xp: 6.1 }]
  const xi2 = [{ id: 20, name: 'Saka', pos: 'MID', pts: 8, xp: 5.4 }]
  const row = { league_entry_1: 1, league_entry_2: 2, xi1, xi2 }
  assert.equal(archivedXi(row, 1), xi1)
  assert.equal(archivedXi(row, 2), xi2)
  assert.equal(archivedXi({ league_entry_1: 1, league_entry_2: 2 }, 1), null)
  assert.equal(archivedXi(null, 1), null)
})

test('h2hSeriesAsOf: counts finished meetings, oriented to entryA', () => {
  const m = (event, a, b, pa, pb, finished = true) => ({
    event,
    league_entry_1: a,
    league_entry_2: b,
    league_entry_1_points: pa,
    league_entry_2_points: pb,
    finished,
  })
  const matches = [
    m(1, 1, 2, 50, 40), // 1 beats 2
    m(5, 2, 1, 60, 30), // 2 beats 1 (orientation flipped)
    m(9, 1, 2, 44, 44), // draw
    m(13, 2, 1, 0, 0, false), // not finished — ignored
  ]
  // Never met yet (through GW0) → null.
  assert.equal(h2hSeriesAsOf(matches, 1, 2, 0), null)
  // First meeting only.
  assert.deepEqual(h2hSeriesAsOf(matches, 1, 2, 1), {
    games: 1,
    aWins: 1,
    bWins: 0,
    draws: 0,
    lastResult: 'A',
  })
  // Through GW9: 1 win each + a draw, oriented to entryA=1.
  assert.deepEqual(h2hSeriesAsOf(matches, 1, 2, 20), {
    games: 3,
    aWins: 1,
    bWins: 1,
    draws: 1,
    lastResult: 'D',
  })
  // Orientation swaps when entryA=2.
  const flipped = h2hSeriesAsOf(matches, 2, 1, 20)
  assert.equal(flipped.aWins, 1)
  assert.equal(flipped.bWins, 1)
})

test('sidePlayerFacts: top scorer, share, haul and flop detection', () => {
  const xi = [
    { id: 1, name: 'Salah', pos: 'MID', pts: 21, xp: 7.2 },
    { id: 2, name: 'Isak', pos: 'FWD', pts: 2, xp: 6.0 },
    { id: 3, name: 'Gabriel', pos: 'DEF', pts: 6, xp: 4.1 },
    { id: 4, name: 'Raya', pos: 'GK', pts: 1, xp: 3.9 },
  ]
  const f = sidePlayerFacts(xi)
  assert.deepEqual(f.top, { id: 1, name: 'Salah', pts: 21 })
  assert.equal(f.share, +(21 / 30).toFixed(3))
  assert.deepEqual(f.haul, { id: 1, name: 'Salah', pts: 21 })
  // Isak is the flop (xp >= 5, pts <= 2); Raya's 1 doesn't count (xp < 5).
  assert.deepEqual(f.flop, { id: 2, name: 'Isak', pts: 2, xp: 6.0 })
})

test('sidePlayerFacts: quiet weeks produce no haul or flop', () => {
  const xi = [
    { id: 1, name: 'A', pos: 'MID', pts: 7, xp: 5.5 },
    { id: 2, name: 'B', pos: 'FWD', pts: 6, xp: 5.8 },
  ]
  const f = sidePlayerFacts(xi)
  assert.deepEqual(f.top, { id: 1, name: 'A', pts: 7 })
  assert.equal(f.haul, null)
  assert.equal(f.flop, null)
  assert.equal(sidePlayerFacts([]), null)
  assert.equal(sidePlayerFacts(null), null)
})

test('sidePlayerFacts: modest score still counts as haul when it doubles the call', () => {
  const xi = [
    { id: 1, name: 'Mbeumo', pos: 'MID', pts: 13, xp: 5.0 },
    { id: 2, name: 'B', pos: 'FWD', pts: 4, xp: 4.0 },
  ]
  assert.deepEqual(sidePlayerFacts(xi).haul, { id: 1, name: 'Mbeumo', pts: 13 })
})

test('reconcileTeamPoints lifts a stale official total to the XI / top scorer', () => {
  const xi = [
    { id: 204, name: 'Mitchell', pos: 'DEF', pts: 15 },
    { id: 2, name: 'Saka', pos: 'MID', pts: 8 },
    { id: 3, name: 'Rest', pos: 'FWD', pts: 17 },
  ]
  const players = sidePlayerFacts(xi)
  assert.equal(sumArchivedXiPoints(xi), 40)
  assert.equal(impliedXiPoints(players), 40)
  // Official H2H still on Saturday leftovers (9) while Mitchell already has 15.
  assert.equal(reconcileTeamPoints(9, { players, xi }), 40)
  assert.equal(reconcileTeamPoints(9, { players }), 40)
  assert.equal(reconcileTeamPoints(9, { players: { top: { pts: 15 }, share: 0 } }), 15)
  assert.equal(reconcileTeamPoints(43, { players, xi }), 43)
})

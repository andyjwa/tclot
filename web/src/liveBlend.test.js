import assert from 'node:assert/strict'
import test from 'node:test'
import {
  routeOf,
  playerPhase,
  blendPlayer,
  teamProjection,
  teamReturns,
  anyFixtureLive,
} from './liveBlend.js'

/** Prediction player factory. */
function pred(overrides = {}) {
  const { forecast = {}, ...rest } = overrides
  return {
    id: 1,
    name: 'Player',
    position: 'MID',
    ...rest,
    forecast: {
      totalPoints: 5,
      breakdown: { minutes: 2, goals: 1.5, assists: 1, cleanSheet: 0.5, defensiveContribution: 0 },
      probabilities: { goalLikelihood: 0.4, assistLikelihood: 0.3, cleanSheetPct: 25 },
      percentiles: { p10: 1, p50: 4, p90: 12 },
      outcomes: { blank: 0.3, returns: 0.5, haul: 0.2 },
      ...forecast,
    },
  }
}

/** Live row factory. */
function row(overrides = {}) {
  return {
    element: 1,
    minutes: 0,
    total_points: 0,
    goalsScored: 0,
    assists: 0,
    goalsConceded: 0,
    dcCount: 0,
    posSingular: 'MID',
    stillYetToPlayPl: true,
    clubGwFixturesFinished: false,
    ...overrides,
  }
}

test('routeOf picks the largest contribution; CS only for eligible positions', () => {
  assert.equal(routeOf(0.5, 0.2, 0.1, 'FWD'), 'goal')
  assert.equal(routeOf(0.1, 0.6, 0.2, 'MID'), 'assist')
  assert.equal(routeOf(0.05, 0.05, 0.8, 'DEF'), 'cs')
  // Forward with high "cs" number still never routes to clean sheet.
  assert.equal(routeOf(0.3, 0.1, 0.9, 'FWD'), 'goal')
})

test('playerPhase classifies upcoming / live / done', () => {
  assert.equal(playerPhase(row({ minutes: 0, stillYetToPlayPl: true })), 'upcoming')
  assert.equal(playerPhase(row({ minutes: 40, stillYetToPlayPl: true })), 'live')
  assert.equal(playerPhase(row({ minutes: 90, stillYetToPlayPl: false })), 'done')
  assert.equal(playerPhase(row({ minutes: 30, clubGwFixturesFinished: true })), 'done')
})

test('prematch mode ignores live data and returns the raw forecast', () => {
  const b = blendPlayer(row({ minutes: 90, total_points: 99 }), pred(), 'prematch')
  assert.equal(b.points, 5)
  assert.equal(b.goals, 0.4)
  assert.equal(b.assists, 0.3)
  assert.equal(b.phase, 'prematch')
})

test('upcoming player in live mode equals the pre-match forecast', () => {
  const b = blendPlayer(row({ minutes: 0 }), pred(), 'live')
  assert.equal(b.points, 5)
  assert.equal(b.goals, 0.4)
  assert.equal(b.phase, 'upcoming')
})

test('done player locks in banked points and actual goals/assists', () => {
  const b = blendPlayer(
    row({ minutes: 90, total_points: 9, goalsScored: 1, assists: 1, stillYetToPlayPl: false }),
    pred(),
    'live',
  )
  assert.equal(b.points, 9)
  assert.equal(b.goals, 1)
  assert.equal(b.assists, 1)
  assert.equal(b.sigma, 0) // finished → no remaining uncertainty
  assert.equal(b.returnProb, 1) // 9 >= 6 → already returned
})

test('live player blends banked + time-scaled remainder', () => {
  // 45 mins played → half the match left → half the variable forecast added.
  const b = blendPlayer(
    row({ minutes: 45, total_points: 3, goalsScored: 0 }),
    pred(),
    'live',
  )
  // variable forecast = total(5) − appearance(2) = 3; remainder = 3 * 0.5 = 1.5
  assert.ok(Math.abs(b.points - (3 + 1.5)) < 1e-9)
  // goals = 0 actual + 0.5 * 0.4 = 0.2
  assert.ok(Math.abs(b.goals - 0.2) < 1e-9)
  assert.ok(b.sigma > 0 && b.sigma < 12 / 2.563) // shrunk but non-zero
})

test('clean sheet rises with time when held, drops to 0 once conceded', () => {
  const def = pred({ position: 'DEF', forecast: { probabilities: { cleanSheetPct: 30, goalLikelihood: 0.05, assistLikelihood: 0.05 } } })
  const early = blendPlayer(row({ minutes: 10, posSingular: 'DEF', goalsConceded: 0 }), def, 'live')
  const late = blendPlayer(row({ minutes: 80, posSingular: 'DEF', goalsConceded: 0 }), def, 'live')
  const conceded = blendPlayer(row({ minutes: 80, posSingular: 'DEF', goalsConceded: 1 }), def, 'live')
  // CS probability climbs as the match runs out with the sheet intact.
  assert.ok(late.cs > early.cs)
  // Late, intact CS should exceed the pre-match 0.30 baseline.
  assert.ok(late.cs > 0.3)
  // A conceded goal kills it.
  assert.equal(conceded.cs, 0)
})

test('defcon awards the full 2 once the threshold is reached', () => {
  const b = blendPlayer(row({ minutes: 70, posSingular: 'DEF', dcCount: 12 }), pred({ position: 'DEF' }), 'live')
  assert.equal(b.defcon, 2)
})

test('teamProjection sums the blend over matched XI players', () => {
  const byId = new Map([
    [1, pred({ id: 1 })],
    [2, pred({ id: 2, position: 'FWD' })],
  ])
  const rows = [row({ element: 1, minutes: 0 }), row({ element: 2, minutes: 0, posSingular: 'FWD' })]
  const t = teamProjection(rows, byId, 'prematch')
  assert.equal(t.matched, 2)
  assert.equal(t.mu, 10) // 5 + 5
  assert.ok(t.goals > 0)
})

test('teamReturns ranks by return probability and respects N', () => {
  const byId = new Map([
    [1, pred({ id: 1, name: 'Low', forecast: { outcomes: { returns: 0.2 } } })],
    [2, pred({ id: 2, name: 'High', forecast: { outcomes: { returns: 0.8 } } })],
  ])
  const rows = [row({ element: 1 }), row({ element: 2 })]
  const res = teamReturns(rows, byId, 'prematch', 'home', 1)
  assert.equal(res.length, 1)
  assert.equal(res[0].name, 'High')
  assert.equal(res[0].side, 'home')
})

test('anyFixtureLive is false pre-kickoff and true once minutes appear', () => {
  assert.equal(anyFixtureLive([row({ minutes: 0 })], [row({ minutes: 0 })]), false)
  assert.equal(anyFixtureLive([row({ minutes: 0 })], [row({ minutes: 3 })]), true)
  assert.equal(anyFixtureLive([row({ minutes: 0, clubGwFixturesFinished: true })], []), true)
})

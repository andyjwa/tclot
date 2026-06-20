import assert from 'node:assert/strict'
import test from 'node:test'
import {
  teamKeyStatTotals,
  keyStatRows,
  teamXiElementIds,
  h2hSeasonSummary,
  h2hBarRows,
} from './liveFixtureCardDerivations.js'

function player(overrides) {
  return {
    element: 1,
    minutes: 0,
    goalsScored: 0,
    assists: 0,
    dcCount: 0,
    cleanSheets: 0,
    yellowCards: 0,
    redCards: 0,
    ...overrides,
  }
}

test('teamKeyStatTotals — aggregates the effective starting XI', () => {
  const squad = {
    starters: [
      player({ element: 1, minutes: 90, goalsScored: 1, assists: 1, dcCount: 12, cleanSheets: 1 }),
      player({ element: 2, minutes: 60, goalsScored: 0, assists: 2, dcCount: 4, yellowCards: 1 }),
      player({ element: 3, minutes: 45, goalsScored: 2, redCards: 1 }),
    ],
    bench: [],
  }
  const t = teamKeyStatTotals(squad)
  assert.equal(t.players60, 2) // 90 and 60 minutes; 45 excluded
  assert.equal(t.goals, 3)
  assert.equal(t.assists, 3)
  assert.equal(t.defcon, 16)
  assert.equal(t.cleanSheets, 1)
  assert.equal(t.yellow, 1)
  assert.equal(t.red, 1)
})

test('teamKeyStatTotals — prefers displayStarters when the post-autosub lineup is complete', () => {
  const squad = {
    starters: Array.from({ length: 11 }, (_, i) => player({ element: i + 1, minutes: 0 })),
    displayStarters: Array.from({ length: 11 }, (_, i) =>
      player({ element: i + 1, minutes: 90, goalsScored: i === 0 ? 1 : 0 }),
    ),
    bench: [player({ element: 12 })],
    displayBench: [player({ element: 12 })],
  }
  const t = teamKeyStatTotals(squad)
  assert.equal(t.players60, 11)
  assert.equal(t.goals, 1)
})

test('teamKeyStatTotals — empty / error squad yields zeros', () => {
  assert.deepEqual(teamKeyStatTotals(null), {
    players60: 0,
    goals: 0,
    assists: 0,
    defcon: 0,
    defconPoints: 0,
    cleanSheets: 0,
    saves: 0,
    savePoints: 0,
    yellow: 0,
    red: 0,
  })
  assert.equal(teamKeyStatTotals({ error: 'x', starters: [player({ minutes: 90 })] }).players60, 0)
})

test('teamKeyStatTotals — Def Con Points (2 per XI player past threshold) + GK-only saves', () => {
  const squad = {
    starters: [
      // DEF threshold is 10 → hit (2 pts)
      player({ element: 1, posSingular: 'DEF', dcCount: 11 }),
      // MID threshold is 12 → not hit (10 < 12), no pts
      player({ element: 2, posSingular: 'MID', dcCount: 10 }),
      // MID threshold is 12 → hit (2 pts)
      player({ element: 3, posSingular: 'MID', dcCount: 12 }),
      // GK: saves count only for the keeper; GK threshold 10 → hit (2 pts)
      player({ element: 4, posSingular: 'GK', dcCount: 10, saves: 5 }),
      // Outfield saves must NOT count toward the Saves row
      player({ element: 5, posSingular: 'FWD', dcCount: 0, saves: 3 }),
    ],
    bench: [],
  }
  const t = teamKeyStatTotals(squad)
  assert.equal(t.defconPoints, 6) // DEF + MID + GK each cleared threshold → 3 × 2
  assert.equal(t.saves, 5) // only the GK's saves
  assert.equal(t.savePoints, 1) // floor(5 / 3)
})

test('keyStatRows — always-on rows only when nothing has happened', () => {
  const rows = keyStatRows({ starters: [] }, { starters: [] })
  assert.deepEqual(
    rows.map((r) => r.key),
    ['players60', 'goals', 'assists', 'cleanSheets', 'defconPoints'],
  )
  assert.equal(rows[0].label, 'Players 60+')
  assert.equal(rows[3].label, 'Clean Sheets')
  assert.equal(rows[4].label, 'Def Con Points')
})

test('keyStatRows — conditional rows appear once they occur (Save/Yellow/Red)', () => {
  const squad = {
    starters: [
      player({ element: 1, posSingular: 'GK', saves: 6, yellowCards: 1 }),
      player({ element: 2, posSingular: 'DEF', redCards: 0 }),
    ],
    bench: [],
  }
  const rows = keyStatRows(squad, { starters: [] })
  const keys = rows.map((r) => r.key)
  assert.ok(keys.includes('savePoints')) // 6 GK saves → 2 save points
  assert.ok(keys.includes('yellow')) // a yellow occurred
  assert.ok(!keys.includes('red')) // no reds → hidden
  const sp = rows.find((r) => r.key === 'savePoints')
  assert.equal(sp.label, 'Save Points')
  assert.equal(sp.home, 2)
})

test('teamXiElementIds — pulls the effective XI element ids', () => {
  const squad = {
    starters: [player({ element: 11 }), player({ element: 22 }), player({ element: null, elementId: 33 })],
    bench: [],
  }
  assert.deepEqual(teamXiElementIds(squad), [11, 22, 33])
  assert.deepEqual(teamXiElementIds(null), [])
})

test('h2hSeasonSummary — wins/draws/points across meetings, excludes 0-0', () => {
  const matches = [
    { event: 1, league_entry_1: 1, league_entry_2: 2, league_entry_1_points: 50, league_entry_2_points: 40 },
    { event: 5, league_entry_1: 2, league_entry_2: 1, league_entry_1_points: 30, league_entry_2_points: 30 },
    { event: 9, league_entry_1: 1, league_entry_2: 2, league_entry_1_points: 20, league_entry_2_points: 35 },
    { event: 12, league_entry_1: 1, league_entry_2: 2, league_entry_1_points: 0, league_entry_2_points: 0 }, // unplayed
    { event: 3, league_entry_1: 1, league_entry_2: 3, league_entry_1_points: 60, league_entry_2_points: 10 }, // other opp
  ]
  const s = h2hSeasonSummary(matches, 1, 2)
  assert.equal(s.meetings, 3)
  assert.equal(s.homeWins, 1) // GW1 (50>40)
  assert.equal(s.awayWins, 1) // GW9 (35>20 for entry 2)
  assert.equal(s.draws, 1) // GW5 30-30
  assert.equal(s.homePts, 50 + 30 + 20) // 100
  assert.equal(s.awayPts, 40 + 30 + 35) // 105
  assert.equal(s.homeAvg, 33.3)
  assert.equal(s.awayAvg, 35)
})

test('h2hSeasonSummary — no meetings yields zeros and zero averages', () => {
  const s = h2hSeasonSummary([], 1, 2)
  assert.equal(s.meetings, 0)
  assert.equal(s.homeAvg, 0)
  assert.equal(s.awayAvg, 0)
})

test('h2hBarRows — exposes numeric values and display text', () => {
  const rows = h2hBarRows(h2hSeasonSummary([
    { event: 1, league_entry_1: 1, league_entry_2: 2, league_entry_1_points: 50, league_entry_2_points: 40 },
  ], 1, 2))
  assert.deepEqual(rows.map((r) => r.key), ['wins', 'avg'])
  assert.equal(rows.find((r) => r.key === 'wins').label, 'Record (wins)')
  const avg = rows.find((r) => r.key === 'avg')
  assert.equal(avg.homeText, '50.0')
  assert.equal(avg.awayText, '40.0')
})

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  HALL_SEASON_FINAL_TABLES,
  LIVE_HALL_SEASON_LABEL,
  computeHallAlgorithmRows,
  computeHallManagerCareerRows,
  computeLiveHallManagerCareerRows,
  hallManagerDisplayKey,
  liveHallSeasonHasResults,
} from './hallManagerHistory.js'

test('LIVE_HALL_SEASON_LABEL is the in-progress 26/27 season', () => {
  assert.equal(LIVE_HALL_SEASON_LABEL, '2026-27')
})

test('HALL_SEASON_FINAL_TABLES includes the 2025-26 final table', () => {
  const s = HALL_SEASON_FINAL_TABLES.find((x) => x.season === '2025-26')
  assert.ok(s, 'expected 2025-26 final table')
  assert.equal(s.rows.length, 8)
  assert.deepEqual(
    s.rows.map((r) => [r.rank, r.team, r.manager, r.w, r.d, r.l, r.pf, r.pts]),
    [
      [1, 'Crouch End Oashisu', 'David', 22, 1, 15, 1673, 67],
      [2, 'Clapton Cornershop', 'Mike', 22, 0, 16, 1740, 66],
      [3, 'Toronto Oizo', 'Andy', 22, 0, 16, 1635, 66],
      [4, 'Hanson of York AFC', 'Nick', 20, 0, 18, 1812, 60],
      [5, 'Seoul Club 7', 'Luke', 18, 0, 20, 1556, 54],
      [6, 'Hackney Meat Loaf', 'Nick', 17, 0, 21, 1710, 51],
      [7, 'Morpeth Jamiroquai', 'Jon', 16, 0, 22, 1586, 48],
      [8, 'Brampton II Men', 'Eddy', 14, 1, 23, 1616, 43],
    ],
  )
  assert.equal(s.rows[0].pa, 1610)
  assert.equal(HALL_SEASON_FINAL_TABLES.at(-1)?.season, '2025-26')
})

test('hallManagerDisplayKey — 25/26 and 26/27 Nick splitters', () => {
  assert.equal(hallManagerDisplayKey('Hanson of York AFC', 'Nick'), 'Nick G')
  assert.equal(hallManagerDisplayKey('Hackney Meat Loaf', 'Nick'), 'Nick M')
  assert.equal(hallManagerDisplayKey('Atlético Bilbo', 'Nick'), 'Nick G')
  assert.equal(hallManagerDisplayKey('Mr Mordorlicious SFG', 'Nick'), 'Nick M')
  assert.equal(hallManagerDisplayKey('Crouch End Oashisu', 'David'), 'David')
})

test('career totals count David\'s 2025-26 title', () => {
  const david = computeHallManagerCareerRows().find((r) => r.key === 'David')
  assert.ok(david)
  assert.equal(david.titles, 1)
  assert.equal(david.lastRank, 1)
  assert.equal(david.seasons, 6)
})

test('liveHallSeasonHasResults is false for empty / unplayed pre-season rows', () => {
  assert.equal(liveHallSeasonHasResults([]), false)
  assert.equal(
    liveHallSeasonHasResults([{ w: 0, d: 0, l: 0, pts: 0, pf: 0 }]),
    false,
  )
  assert.equal(liveHallSeasonHasResults([{ w: 1, d: 0, l: 0, pts: 3, pf: 40 }]), true)
})

test('CofC algorithm omits empty 26/27 live table during pre-season', () => {
  const emptyLive = computeHallAlgorithmRows([])
  assert.ok(!emptyLive.seasonLabels.includes('2026-27'))
  assert.ok(emptyLive.seasonLabels.includes('2025-26'))

  const zeroLive = computeHallAlgorithmRows([
    {
      teamName: 'Atlético Bilbo',
      manager: 'Nick Goodacre',
      rank: 1,
      matches_won: 0,
      matches_drawn: 0,
      matches_lost: 0,
      gf: 0,
      ga: 0,
      total: 0,
    },
  ])
  assert.ok(!zeroLive.seasonLabels.includes('2026-27'))

  const started = computeHallAlgorithmRows([
    {
      teamName: 'Atlético Bilbo',
      manager: 'Nick Goodacre',
      rank: 1,
      matches_won: 1,
      matches_drawn: 0,
      matches_lost: 0,
      gf: 44,
      ga: 31,
      total: 3,
    },
  ])
  assert.ok(started.seasonLabels.includes('2026-27'))
  assert.equal(started.seasonLabels.at(-1), '2026-27')
})

test('live career rows match historic-only totals before GW1', () => {
  const historic = computeHallManagerCareerRows()
  const liveEmpty = computeLiveHallManagerCareerRows([])
  assert.deepEqual(
    liveEmpty.map((r) => [r.key, r.titles, r.totalPts, r.seasons]),
    historic.map((r) => [r.key, r.titles, r.totalPts, r.seasons]),
  )
})

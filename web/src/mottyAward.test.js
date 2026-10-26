import assert from 'node:assert/strict'
import test from 'node:test'
import {
  benchComeInPoints,
  isMottyWin,
  mottyEntryIdsFromFixtures,
} from './mottyAward.js'

function squad(subs, rows, source = 'official') {
  return {
    autosubSource: source,
    autoSubs: source === 'official' ? subs : [],
    projectedAutoSubs: source === 'projected' ? subs : [],
    starters: rows.filter((r) => r.pickPosition <= 11),
    bench: rows.filter((r) => r.pickPosition > 11),
  }
}

test('benchComeInPoints — sums multiplied points of players who came in', () => {
  const s = squad(
    [
      { element_out: 1, element_in: 12 },
      { element_out: 2, element_in: 13 },
    ],
    [
      { element: 1, pickPosition: 1, total_points: 0 },
      { element: 12, pickPosition: 12, total_points: 6 },
      { element: 13, pickPosition: 13, total_points: 2 },
    ],
  )
  assert.equal(benchComeInPoints(s), 8)
})

test('benchComeInPoints — projected subs count when that is what the lineup shows', () => {
  const s = squad(
    [{ element_out: 1, element_in: 12 }],
    [{ element: 12, pickPosition: 12, total_points: 4 }],
    'projected',
  )
  assert.equal(benchComeInPoints(s), 4)
})

test('isMottyWin — bench points are the only reason it is a win', () => {
  const s = squad(
    [{ element_out: 1, element_in: 12 }],
    [{ element: 12, pickPosition: 12, total_points: 5 }],
  )
  assert.equal(isMottyWin(s, 42, 40), true)
  assert.equal(isMottyWin(s, 42, 37), true)
  assert.equal(isMottyWin(s, 50, 40), false)
})

test('isMottyWin — a win with no bench points, a draw, and a loss are not the Motty', () => {
  const cameIn = squad(
    [{ element_out: 1, element_in: 12 }],
    [{ element: 12, pickPosition: 12, total_points: 0 }],
  )
  assert.equal(isMottyWin(cameIn, 30, 20), false)
  const noSub = squad([], [{ element: 12, pickPosition: 12, total_points: 9 }])
  assert.equal(isMottyWin(noSub, 30, 20), false)
  const decisive = squad(
    [{ element_out: 1, element_in: 12 }],
    [{ element: 12, pickPosition: 12, total_points: 8 }],
  )
  assert.equal(isMottyWin(decisive, 20, 20), false)
  assert.equal(isMottyWin(decisive, 18, 20), false)
})

test('mottyEntryIdsFromFixtures — only the side the bench carried', () => {
  const home = squad(
    [{ element_out: 1, element_in: 12 }],
    [{ element: 12, pickPosition: 12, total_points: 4 }],
  )
  const ids = mottyEntryIdsFromFixtures([
    {
      homeId: 1,
      awayId: 2,
      homeSquad: home,
      awaySquad: null,
      homeLive: 31,
      awayLive: 30,
    },
  ])
  assert.deepEqual([...ids], [1])
})

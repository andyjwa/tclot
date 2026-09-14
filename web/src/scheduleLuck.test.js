import assert from 'node:assert/strict'
import test from 'node:test'
import { buildResultScheduleLuck } from './scheduleLuck.js'

function match(event, home, away, homePts, awayPts) {
  return {
    event,
    finished: true,
    league_entry_1: home,
    league_entry_2: away,
    league_entry_1_points: homePts,
    league_entry_2_points: awayPts,
  }
}

/**
 * GW1: A 10 loses to B 20. C 8 beats D 6.
 * A would have drawn B's opponent (A, 10) and beaten C's and D's opponents.
 */
const SWAP = [
  match(1, 1, 2, 10, 20),
  match(1, 3, 4, 8, 6),
]

test('a loss that would have won on another fixture list is unlucky', () => {
  const model = buildResultScheduleLuck(SWAP, [1, 2, 3, 4])
  assert.ok(model)
  const a = model.byId[1]
  assert.equal(a.ready, true)
  assert.equal(a.actual, 0)
  assert.equal(model.points[1][4], 3, 'A 10 beats D opponent C 8')
  assert.equal(model.points[1][2], 1, 'A 10 draws B opponent A 10')
  assert.equal(a.avg, (1 + 3 + 3) / 3)
  assert.equal(a.delta, a.actual - a.avg)
  assert.ok(a.delta < 0)
  assert.ok(model.byId[2].delta > a.delta)
})

test('the margin does not change a result that is already a win or a loss', () => {
  const blowouts = buildResultScheduleLuck(
    [match(1, 1, 2, 10, 80), match(1, 3, 4, 9, 1)],
    [1, 2, 3, 4],
  )
  const narrow = buildResultScheduleLuck(SWAP, [1, 2, 3, 4])
  assert.deepEqual(blowouts.byId, narrow.byId)
  assert.deepEqual(blowouts.points, narrow.points)
})

test('own fixture list is not in the average', () => {
  const model = buildResultScheduleLuck(SWAP, [1, 2, 3, 4])
  const others = [2, 3, 4].map((id) => model.points[1][id])
  assert.equal(model.byId[1].avg, others.reduce((s, n) => s + n, 0) / others.length)
})

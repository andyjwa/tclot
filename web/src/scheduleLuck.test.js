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
 * GW1: A beats B, C beats D.
 * GW2: A beats C, D beats B.
 * From A's view, games against A are left out:
 * B's only other game is a loss (0), C's only other game is a win (3).
 */
const RESULTS = [
  match(1, 1, 2, 50, 10),
  match(1, 3, 4, 40, 20),
  match(2, 1, 3, 30, 29),
  match(2, 4, 2, 15, 14),
]

test('schedule luck uses results, so the margin does not change it', () => {
  const blowouts = buildResultScheduleLuck(RESULTS, [1, 2, 3, 4])
  const narrow = buildResultScheduleLuck(
    [
      match(1, 1, 2, 11, 10),
      match(1, 3, 4, 21, 20),
      match(2, 1, 3, 12, 11),
      match(2, 4, 2, 16, 15),
    ],
    [1, 2, 3, 4],
  )
  assert.deepEqual(narrow.byId, blowouts.byId)
  assert.deepEqual(narrow.quality, blowouts.quality)
})

test('schedule luck ranks the kinder draw by opponents other results', () => {
  const model = buildResultScheduleLuck(RESULTS, [1, 2, 3, 4])
  assert.ok(model)
  const a = model.byId[1]
  const b = model.byId[2]
  assert.equal(a.ready, true)
  assert.equal(a.own, 1.5)
  assert.equal(a.avg, 1.875)
  assert.equal(a.delta, 0.375)
  assert.equal(model.quality[1][1], 1.5)
  assert.equal(model.quality[1][2], 2.25)
  assert.ok(a.delta > b.delta)
  assert.ok(a.delta > 0)
  assert.ok(b.delta < 0)
})

test('schedule luck waits until opponents have played someone else', () => {
  const model = buildResultScheduleLuck(
    [match(1, 1, 2, 80, 10), match(1, 3, 4, 70, 20)],
    [1, 2, 3, 4],
  )
  assert.equal(model.byId[1].ready, false)
  assert.equal(model.byId[1].delta, null)
})

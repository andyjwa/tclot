import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureFplPoints } from './premFixturePoints.js'

test('fixtureFplPoints sums the explain block for this fixture', () => {
  const live = {
    10: {
      stats: { total_points: 15 },
      explain: [
        {
          fixture: 3,
          stats: [
            { identifier: 'minutes', points: 2, value: 90 },
            { identifier: 'goals_scored', points: 5, value: 1 },
          ],
        },
        {
          fixture: 9,
          stats: [{ identifier: 'minutes', points: 2, value: 80 }],
        },
      ],
    },
  }
  assert.equal(fixtureFplPoints(live, 10, 3), 7)
  assert.equal(fixtureFplPoints(live, 10, 9), 2)
  assert.equal(fixtureFplPoints(live, 10, 4), null)
})

test('fixtureFplPoints falls back to GW total when explain is missing', () => {
  assert.equal(
    fixtureFplPoints({ 4: { stats: { total_points: 6 } } }, 4, 1),
    6,
  )
  assert.equal(fixtureFplPoints({}, 4, 1), null)
})

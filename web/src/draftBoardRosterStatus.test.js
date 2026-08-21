import assert from 'node:assert/strict'
import test from 'node:test'
import { draftSeasonStarted, draftCurrentGameweek } from './draftBoardRosterStatus.js'

test('draftSeasonStarted — false pre-season (no current or finished GW)', () => {
  assert.equal(draftSeasonStarted(null), false)
  assert.equal(draftSeasonStarted({}), false)
  assert.equal(draftSeasonStarted({ events: { current: null, data: [] } }), false)
  assert.equal(
    draftSeasonStarted({
      events: {
        current: null,
        data: [
          { id: 1, is_current: false, finished: false },
          { id: 2, is_current: false, finished: false },
        ],
      },
    }),
    false,
  )
})

test('draftSeasonStarted — true once a GW is current or finished', () => {
  assert.equal(draftSeasonStarted({ events: { current: 1, data: [] } }), true)
  assert.equal(
    draftSeasonStarted({
      events: { current: null, data: [{ id: 1, is_current: true, finished: false }] },
    }),
    true,
  )
  assert.equal(
    draftSeasonStarted({
      events: { current: null, data: [{ id: 1, is_current: false, finished: true }] },
    }),
    true,
  )
})

test('draftCurrentGameweek — falls back sensibly', () => {
  assert.equal(draftCurrentGameweek({ events: { current: 3 } }), 3)
  assert.equal(
    draftCurrentGameweek({
      events: { data: [{ id: 1, finished: true }, { id: 2, finished: false }] },
    }),
    1,
  )
  assert.equal(draftCurrentGameweek(null), 1)
})

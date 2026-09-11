import assert from 'node:assert/strict'
import test from 'node:test'
import {
  forbiddenIdSetFromPayload,
  isForbiddenWaiverPickup,
  pickupElementId,
  pickupIdSetFromLatestWaiver,
  pickupIdSetFromMoves,
  takenForbiddenIdsFromMoves,
} from './forbiddenWaivers.js'

const DEDIC = 595
const PAYLOAD = {
  players: [
    { id: 593, webName: 'David' },
    { id: DEDIC, webName: 'Dedić', fullName: 'Amar Dedic' },
    { id: '596', webName: 'Ruggeri' },
  ],
}

test('forbiddenIdSetFromPayload — numeric ids, including string ids', () => {
  const ids = forbiddenIdSetFromPayload(PAYLOAD)
  assert.equal(ids.has(593), true)
  assert.equal(ids.has(DEDIC), true)
  assert.equal(ids.has(596), true)
  assert.equal(ids.has(1), false)
})

test('forbiddenIdSetFromPayload — empty / missing payload', () => {
  assert.equal(forbiddenIdSetFromPayload(null).size, 0)
  assert.equal(forbiddenIdSetFromPayload({}).size, 0)
  assert.equal(forbiddenIdSetFromPayload({ players: null }).size, 0)
})

test('pickupElementId — element_in or elementId', () => {
  assert.equal(pickupElementId({ element_in: DEDIC }), DEDIC)
  assert.equal(pickupElementId({ elementId: DEDIC }), DEDIC)
  assert.equal(pickupElementId({ element_in: '595' }), DEDIC)
  assert.equal(pickupElementId({}), null)
  assert.equal(pickupElementId(null), null)
})

test('isForbiddenWaiverPickup — Dedic taken is flagged; ordinary pickup is not', () => {
  const ids = forbiddenIdSetFromPayload(PAYLOAD)
  assert.equal(isForbiddenWaiverPickup({ element_in: DEDIC }, ids), true)
  assert.equal(isForbiddenWaiverPickup({ element_in: 415 }, ids), false)
  assert.equal(isForbiddenWaiverPickup({ element_in: DEDIC }, null), false)
  assert.equal(isForbiddenWaiverPickup(null, ids), false)
})

test('takenForbiddenIdsFromMoves — only forbidden pickups', () => {
  const ids = forbiddenIdSetFromPayload(PAYLOAD)
  const taken = takenForbiddenIdsFromMoves(
    [
      { element_in: 415 },
      { element_in: DEDIC },
      { elementId: 593 },
    ],
    ids,
  )
  assert.equal(taken.has(DEDIC), true)
  assert.equal(taken.has(593), true)
  assert.equal(taken.has(415), false)
  assert.equal(taken.size, 2)
})

test('pickupIdSetFromLatestWaiver — only the newest waiver gameweek', () => {
  const set = pickupIdSetFromLatestWaiver([
    { element_in: DEDIC, gameweek: 2 },
    { element_in: 597, event: 2 },
    { element_in: 415, gameweek: 3 },
    { element_in: null, gameweek: 3 },
  ])
  assert.equal(set.has(415), true)
  assert.equal(set.has(DEDIC), false)
  assert.equal(set.has(597), false)
  assert.equal(set.size, 1)
  assert.equal(pickupIdSetFromLatestWaiver([]).size, 0)
  assert.equal(pickupIdSetFromLatestWaiver(null).size, 0)
})

test('pickupIdSetFromMoves — all successful pickup ids', () => {
  const set = pickupIdSetFromMoves([
    { element_in: DEDIC },
    { element_in: 415 },
    { element_in: null },
  ])
  assert.equal(set.has(DEDIC), true)
  assert.equal(set.has(415), true)
  assert.equal(set.size, 2)
})

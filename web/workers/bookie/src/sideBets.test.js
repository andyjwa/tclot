import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SIDE_MAX_STAKE,
  SIDE_MIN_STAKE,
  ledgerAddends,
  mergeSideBetLedger,
  normalizeSentence,
  parseStake,
  planSideAction,
} from './sideBets.js'

const offered = {
  id: 1,
  proposerId: 10,
  opponentId: 20,
  stake: 50,
  sentence: 'Eddy outscores Jon this week',
  status: 'offered',
}

test('normalizeSentence collapses space and rejects short or huge text', () => {
  assert.equal(normalizeSentence('  Eddy   wins  '), 'Eddy wins')
  assert.equal(normalizeSentence('short'), null)
  assert.equal(normalizeSentence('x'.repeat(241)), null)
  assert.equal(normalizeSentence('Eddy wins\u0000now'), null)
  assert.equal(parseStake(9), null)
  assert.equal(parseStake(10), SIDE_MIN_STAKE)
  assert.equal(parseStake(1000), SIDE_MAX_STAKE)
  assert.equal(parseStake(1001), null)
  assert.equal(parseStake(10.5), null)
})

test('decline and cancel refund only the proposer, and only the right person', () => {
  const decline = planSideAction(offered, 20, 'decline')
  assert.equal(decline.ok, true)
  assert.equal(decline.status, 'declined')
  assert.deepEqual(decline.credits, [{ entryId: 10, amount: 50 }])
  assert.equal(planSideAction(offered, 10, 'decline').ok, false)

  const cancel = planSideAction(offered, 10, 'cancel')
  assert.equal(cancel.status, 'cancelled')
  assert.equal(planSideAction(offered, 20, 'cancel').ok, false)
  assert.equal(planSideAction(offered, 30, 'cancel').status, 403)
})

test('accept holds the opponent stake and nobody else can take it', () => {
  const accept = planSideAction(offered, 20, 'accept')
  assert.equal(accept.status, 'accepted')
  assert.deepEqual(accept.debit, { entryId: 20, amount: 50 })
  assert.deepEqual(accept.credits, [])
  assert.equal(planSideAction(offered, 10, 'accept').ok, false)
})

test('a live bet needs the other person to confirm a winner or a void', () => {
  const live = { ...offered, status: 'accepted' }
  const jonWins = planSideAction(live, 10, 'propose', { result: 'me' })
  assert.equal(jonWins.proposedBy, 10)
  assert.equal(jonWins.proposedResult, 'proposer')

  const eddyWins = planSideAction(live, 10, 'propose', { result: 'them' })
  assert.equal(eddyWins.proposedResult, 'opponent')

  const eddyClaims = planSideAction(live, 20, 'propose', { result: 'me' })
  assert.equal(eddyClaims.proposedResult, 'opponent')

  const pending = { ...live, proposedBy: 10, proposedResult: 'proposer' }
  assert.equal(planSideAction(pending, 10, 'confirm').ok, false)
  const confirmed = planSideAction(pending, 20, 'confirm')
  assert.equal(confirmed.status, 'settled')
  assert.equal(confirmed.winnerId, 10)
  assert.deepEqual(confirmed.credits, [{ entryId: 10, amount: 100 }])

  const voided = planSideAction({ ...live, proposedBy: 20, proposedResult: 'void' }, 10, 'confirm')
  assert.equal(voided.status, 'void')
  assert.deepEqual(voided.credits, [
    { entryId: 10, amount: 50 },
    { entryId: 20, amount: 50 },
  ])
  assert.equal(planSideAction(live, 10, 'propose', { result: 'draw' }).status, 400)
  assert.equal(planSideAction(pending, 20, 'reject').kind, 'clear-proposal')
})

test('ledger counts escrow as live and a win as the stake, not the pot', () => {
  assert.deepEqual(ledgerAddends(offered), [{ entryId: 10, won: 0, lost: 0, live: 50 }])
  assert.equal(ledgerAddends({ ...offered, status: 'declined' }).length, 0)
  const map = new Map([[10, { won: 20, lost: 0, live: 10 }]])
  mergeSideBetLedger(map, [
    { ...offered, status: 'accepted' },
    { ...offered, id: 2, status: 'settled', winnerId: 20 },
  ])
  assert.deepEqual(map.get(10), { won: 20, lost: 50, live: 60 })
  assert.deepEqual(map.get(20), { won: 50, lost: 0, live: 50 })
})

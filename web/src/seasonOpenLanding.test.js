import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  firstWaiversTimeMs,
  initialDashboardView,
  initialMovesTab,
  seasonPhaseLanding,
} from './seasonOpenLanding.js'

const events = [
  { id: 1, waivers_time: '2026-08-20T17:30:00Z', deadline_time: '2026-08-21T17:30:00Z' },
  { id: 2, waivers_time: '2026-08-27T17:30:00Z', deadline_time: '2026-08-28T17:30:00Z' },
]

test('firstWaiversTimeMs is GW1, not a later week', () => {
  assert.equal(firstWaiversTimeMs(events), Date.parse('2026-08-20T17:30:00Z'))
  assert.equal(firstWaiversTimeMs({ data: events }), Date.parse('2026-08-20T17:30:00Z'))
})

test('Moves lands on Draft until the first Thursday waivers', () => {
  assert.equal(initialMovesTab(events, new Date('2026-08-17T19:00:00Z')), 'draft')
  assert.equal(initialMovesTab(events, new Date('2026-08-20T17:29:59Z')), 'draft')
})

test('Moves lands on Waivers once the first waivers_time has passed', () => {
  assert.equal(initialMovesTab(events, new Date('2026-08-20T17:30:00Z')), 'waivers')
  assert.equal(initialMovesTab(events, new Date('2026-09-01T00:00:00Z')), 'waivers')
})

test('no calendar yet → Draft (post-draft squads live there)', () => {
  assert.equal(initialMovesTab(null), 'draft')
  assert.equal(initialMovesTab([]), 'draft')
})

const gw2 = {
  id: 2,
  finished: false,
  waivers_time: '2026-08-27T17:30:00Z',
  deadline_time: '2026-08-28T17:30:00Z',
}
const gw1Finished = { id: 1, finished: true }

test('GW live (deadline passed, not finished) → Scores', () => {
  assert.equal(
    seasonPhaseLanding(
      { currentEvent: gw2, lastFinishedEvent: gw1Finished },
      new Date('2026-08-28T18:00:00Z'),
    ),
    'scores',
  )
})

test('GW2 deadline passed while current still on finished GW1 → Scores', () => {
  assert.equal(
    seasonPhaseLanding(
      { currentEvent: gw1Finished, nextEvent: gw2, lastFinishedEvent: gw1Finished },
      new Date('2026-08-28T17:31:00Z'),
    ),
    'scores',
  )
})

test('GW complete, before next waiver deadline → Table', () => {
  // current still points at the finished GW, next is upcoming
  assert.equal(
    seasonPhaseLanding(
      { currentEvent: gw1Finished, nextEvent: gw2, lastFinishedEvent: gw1Finished },
      new Date('2026-08-25T12:00:00Z'),
    ),
    'table',
  )
})

test('after waiver deadline, before GW live → Waivers', () => {
  // upcoming GW as `nextEvent`
  assert.equal(
    seasonPhaseLanding(
      { currentEvent: gw1Finished, nextEvent: gw2, lastFinishedEvent: gw1Finished },
      new Date('2026-08-27T17:30:00Z'),
    ),
    'waivers',
  )
  // upcoming GW already rolled into `currentEvent` (deadline still future)
  assert.equal(
    seasonPhaseLanding(
      { currentEvent: gw2, lastFinishedEvent: gw1Finished },
      new Date('2026-08-28T12:00:00Z'),
    ),
    'waivers',
  )
})

test('pre-season / no calendar → null (keep Moves landing)', () => {
  assert.equal(
    seasonPhaseLanding(
      { currentEvent: gw2, nextEvent: gw2 },
      new Date('2026-08-20T12:00:00Z'),
    ),
    null,
  )
  assert.equal(seasonPhaseLanding({}, new Date('2026-08-20T12:00:00Z')), null)
})

test('season complete (nothing upcoming) → Table', () => {
  assert.equal(
    seasonPhaseLanding(
      { currentEvent: { id: 38, finished: true }, lastFinishedEvent: { id: 38, finished: true } },
      new Date('2027-06-01T12:00:00Z'),
    ),
    'table',
  )
})

test('cold load lands on Moves (Draft) except hash/archive', () => {
  assert.equal(initialDashboardView(), 'teamSelection')
  assert.equal(initialDashboardView({ hasPlayersHash: true }), 'players')
  assert.equal(initialDashboardView({ archiveView: true }), 'standings')
  assert.equal(
    initialDashboardView({ hasPlayersHash: true, archiveView: true }),
    'players',
  )
})

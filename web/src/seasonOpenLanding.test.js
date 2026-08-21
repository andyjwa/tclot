import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  firstWaiversTimeMs,
  initialDashboardView,
  initialMovesTab,
  shouldDefaultToLiveScores,
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

test('cold load lands on Moves (Draft) except hash/archive', () => {
  assert.equal(initialDashboardView(), 'teamSelection')
  assert.equal(initialDashboardView({ hasPlayersHash: true }), 'players')
  assert.equal(initialDashboardView({ archiveView: true }), 'standings')
  assert.equal(
    initialDashboardView({ hasPlayersHash: true, archiveView: true }),
    'players',
  )
})

test('live GW → redirect Moves cold load to Live Scores', () => {
  assert.equal(shouldDefaultToLiveScores({ status: 'live' }), true)
  assert.equal(
    shouldDefaultToLiveScores({
      status: 'live',
      dashboardView: 'teamSelection',
    }),
    true,
  )
})

test('live GW does not override hash, archive, draft lock, or other views', () => {
  assert.equal(
    shouldDefaultToLiveScores({ status: 'live', hasPlayersHash: true }),
    false,
  )
  assert.equal(
    shouldDefaultToLiveScores({ status: 'live', archiveView: true }),
    false,
  )
  assert.equal(
    shouldDefaultToLiveScores({ status: 'live', navLocked: true }),
    false,
  )
  assert.equal(
    shouldDefaultToLiveScores({ status: 'live', dashboardView: 'standings' }),
    false,
  )
  assert.equal(
    shouldDefaultToLiveScores({ status: 'live', dashboardView: 'fplLive' }),
    false,
  )
})

test('non-live / unknown status does not redirect to Live Scores', () => {
  assert.equal(shouldDefaultToLiveScores({ status: 'idle' }), false)
  assert.equal(shouldDefaultToLiveScores({ status: 'pre-season' }), false)
  assert.equal(shouldDefaultToLiveScores({ status: 'unknown' }), false)
  assert.equal(shouldDefaultToLiveScores({ status: null }), false)
  assert.equal(shouldDefaultToLiveScores(), false)
})

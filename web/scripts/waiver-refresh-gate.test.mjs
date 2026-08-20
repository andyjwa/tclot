import assert from 'node:assert/strict'
import test from 'node:test'
import {
  postDeadlineIngestEvent,
  preWaiverRefreshEvent,
} from './waiver-refresh-gate.mjs'
import { burstWaiverRefreshEvent } from '../src/waiverRefreshSchedule.js'

test('postDeadlineIngestEvent — allows ingest after finished GW deadline', () => {
  const dl = '2026-05-01T17:30:00Z'
  const now = Date.parse(dl) + 3 * 60 * 60 * 1000
  const hit = postDeadlineIngestEvent(
    [
      { id: 34, finished: true, deadline_time: '2026-04-24T17:30:00Z' },
      { id: 35, finished: true, deadline_time: dl },
      { id: 36, finished: false, deadline_time: '2026-05-09T10:00:00Z' },
    ],
    now,
  )
  assert.equal(hit?.id, 35)
})

test('postDeadlineIngestEvent — skips before deadline + grace', () => {
  const dl = '2026-05-01T17:30:00Z'
  const now = Date.parse(dl) + 30 * 60 * 1000
  assert.equal(
    postDeadlineIngestEvent([{ id: 35, finished: true, deadline_time: dl }], now),
    null,
  )
})

test('postDeadlineIngestEvent — skips when next GW deadline is imminent', () => {
  const dl35 = '2026-05-01T17:30:00Z'
  const dl36 = '2026-05-09T10:00:00Z'
  const now = Date.parse(dl36) - 2 * 60 * 60 * 1000
  assert.equal(
    postDeadlineIngestEvent(
      [
        { id: 35, finished: true, deadline_time: dl35 },
        { id: 36, finished: false, deadline_time: dl36 },
      ],
      now,
    ),
    null,
  )
})

const WT = '2026-09-02T10:00:00Z' // waivers processed 10:00 UTC

test('preWaiverRefreshEvent — allows on 3-hour cadence within 24h of waivers', () => {
  // 09:00 UTC same day: inside 24h window, hour 9 is on the cadence
  const now = Date.parse('2026-09-02T09:00:00Z')
  const hit = preWaiverRefreshEvent([{ id: 4, waivers_time: WT }], now)
  assert.equal(hit?.id, 4)
  assert.equal(hit?.waiversTime, WT)
})

test('preWaiverRefreshEvent — skips off-cadence hours inside the window', () => {
  // 08:00 UTC: inside window but hour 8 is not a multiple of 3
  const now = Date.parse('2026-09-02T08:00:00Z')
  assert.equal(preWaiverRefreshEvent([{ id: 4, waivers_time: WT }], now), null)
})

test('preWaiverRefreshEvent — skips more than 24h before waivers', () => {
  // 09:00 UTC the previous day: on cadence but 25h out
  const now = Date.parse('2026-09-01T09:00:00Z')
  assert.equal(preWaiverRefreshEvent([{ id: 4, waivers_time: WT }], now), null)
})

test('preWaiverRefreshEvent — skips once waivers have processed', () => {
  const now = Date.parse('2026-09-02T12:00:00Z')
  assert.equal(preWaiverRefreshEvent([{ id: 4, waivers_time: WT }], now), null)
})

test('preWaiverRefreshEvent — null on bad input', () => {
  assert.equal(preWaiverRefreshEvent(null, Date.now()), null)
  assert.equal(preWaiverRefreshEvent([{ id: 4, waivers_time: WT }], NaN), null)
  assert.equal(
    preWaiverRefreshEvent([{ id: 4 }], Date.parse('2026-09-02T09:00:00Z')),
    null,
  )
})

test('burstWaiverRefreshEvent — allows inside 90-min post-waiver burst only', () => {
  const wt = Date.parse(WT)
  assert.equal(burstWaiverRefreshEvent([{ id: 4, waivers_time: WT }], wt + 5 * 60_000), null) // inside grace
  assert.equal(burstWaiverRefreshEvent([{ id: 4, waivers_time: WT }], wt + 30 * 60_000)?.id, 4) // burst
  assert.equal(burstWaiverRefreshEvent([{ id: 4, waivers_time: WT }], wt + 120 * 60_000), null) // past burst
  assert.equal(burstWaiverRefreshEvent(null, wt + 30 * 60_000), null)
})

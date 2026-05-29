import assert from 'node:assert/strict'
import test from 'node:test'
import {
  deriveBrandHeaderStatus,
  formatDeadlineDate,
  seasonShortLabel,
} from './brandHeaderStatus.js'

test('seasonShortLabel — 2025/26 → 25/26', () => {
  assert.equal(seasonShortLabel('2025/26'), '25/26')
  assert.equal(seasonShortLabel('2026/27'), '26/27')
  assert.equal(seasonShortLabel(''), '')
  assert.equal(seasonShortLabel(null), '')
})

test('formatDeadlineDate — ISO → "Aug 15"', () => {
  assert.equal(formatDeadlineDate('2025-08-15T17:30:00Z'), 'Aug 15')
  assert.equal(formatDeadlineDate(null), null)
  assert.equal(formatDeadlineDate('not-a-date'), null)
})

test('deriveBrandHeaderStatus — live when current event is unfinished and deadline passed', () => {
  const out = deriveBrandHeaderStatus({
    currentEvent: {
      id: 28,
      finished: false,
      deadline_time: '2026-03-08T13:30:00Z',
    },
    nextEvent: { id: 29, deadline_time: '2026-03-15T13:30:00Z' },
    lastFinishedEvent: { id: 27 },
    season: '2025/26',
    now: new Date('2026-03-08T15:00:00Z'),
  })
  assert.equal(out.status, 'live')
  assert.equal(out.liveGw, 28)
  assert.equal(out.seasonShort, '25/26')
})

test('deriveBrandHeaderStatus — idle (between GWs) when last is finished and next deadline future', () => {
  const out = deriveBrandHeaderStatus({
    currentEvent: { id: 28, finished: true, deadline_time: '2026-03-08T13:30:00Z' },
    nextEvent: { id: 29, deadline_time: '2026-03-15T13:30:00Z' },
    lastFinishedEvent: { id: 28 },
    season: '2025/26',
    now: new Date('2026-03-10T10:00:00Z'),
  })
  assert.equal(out.status, 'idle')
  assert.equal(out.lastFinishedGw, 28)
  assert.equal(out.nextGw, 29)
  assert.equal(out.nextDeadlineLabel, 'Mar 15')
})

test('deriveBrandHeaderStatus — pre-season when no event has finished', () => {
  const out = deriveBrandHeaderStatus({
    currentEvent: null,
    nextEvent: { id: 1, deadline_time: '2026-08-14T17:30:00Z' },
    lastFinishedEvent: null,
    season: '2026/27',
    now: new Date('2026-06-01T10:00:00Z'),
  })
  assert.equal(out.status, 'pre-season')
  assert.equal(out.nextGw, 1)
  assert.equal(out.seasonShort, '26/27')
  assert.equal(out.nextDeadlineLabel, 'Aug 14')
})

test('deriveBrandHeaderStatus — unknown when bootstrap not loaded yet', () => {
  const out = deriveBrandHeaderStatus({
    currentEvent: null,
    nextEvent: null,
    lastFinishedEvent: null,
  })
  assert.equal(out.status, 'unknown')
})

test('deriveBrandHeaderStatus — post-season (no events.next) still classified idle; consumer drops the "next" copy', () => {
  const out = deriveBrandHeaderStatus({
    currentEvent: null,
    nextEvent: null,
    lastFinishedEvent: { id: 38 },
    season: '2025/26',
    now: new Date('2026-05-26T10:00:00Z'),
  })
  assert.equal(out.status, 'idle')
  assert.equal(out.lastFinishedGw, 38)
  assert.equal(out.nextGw, null)
  assert.equal(out.nextDeadlineLabel, null)
})

test('deriveBrandHeaderStatus — current event but deadline not yet → falls back to idle/pre-season', () => {
  const out = deriveBrandHeaderStatus({
    currentEvent: {
      id: 29,
      finished: false,
      deadline_time: '2026-03-15T13:30:00Z',
    },
    nextEvent: { id: 30, deadline_time: '2026-03-22T13:30:00Z' },
    lastFinishedEvent: { id: 28 },
    now: new Date('2026-03-12T10:00:00Z'),
  })
  assert.equal(out.status, 'idle')
})

// PR #4 — `useFplFixtureLiveSummary` rides along on the `live` branch.
// Non-live branches must always null these fields so the strip never
// renders a stale `4 fixtures live` after FT.

test('deriveBrandHeaderStatus — live carries liveFixtureCount + minute when supplied', () => {
  const out = deriveBrandHeaderStatus({
    currentEvent: {
      id: 28,
      finished: false,
      deadline_time: '2026-03-08T13:30:00Z',
    },
    nextEvent: { id: 29, deadline_time: '2026-03-15T13:30:00Z' },
    lastFinishedEvent: { id: 27 },
    now: new Date('2026-03-08T15:00:00Z'),
    liveFixtureCount: 4,
    minute: 47,
  })
  assert.equal(out.status, 'live')
  assert.equal(out.liveFixtureCount, 4)
  assert.equal(out.minute, 47)
})

test('deriveBrandHeaderStatus — live without summary nulls liveFixtureCount + minute', () => {
  const out = deriveBrandHeaderStatus({
    currentEvent: {
      id: 28,
      finished: false,
      deadline_time: '2026-03-08T13:30:00Z',
    },
    nextEvent: { id: 29, deadline_time: '2026-03-15T13:30:00Z' },
    lastFinishedEvent: { id: 27 },
    now: new Date('2026-03-08T15:00:00Z'),
  })
  assert.equal(out.status, 'live')
  assert.equal(out.liveFixtureCount, null)
  assert.equal(out.minute, null)
})

test('deriveBrandHeaderStatus — live with 0 / NaN summary coerces to null (consumer falls back to "· Live")', () => {
  const baseInput = {
    currentEvent: {
      id: 28,
      finished: false,
      deadline_time: '2026-03-08T13:30:00Z',
    },
    nextEvent: { id: 29, deadline_time: '2026-03-15T13:30:00Z' },
    lastFinishedEvent: { id: 27 },
    now: new Date('2026-03-08T15:00:00Z'),
  }
  const zeroCount = deriveBrandHeaderStatus({
    ...baseInput,
    liveFixtureCount: 0,
    minute: 47,
  })
  assert.equal(zeroCount.liveFixtureCount, null)
  assert.equal(zeroCount.minute, 47)
  const nanMinute = deriveBrandHeaderStatus({
    ...baseInput,
    liveFixtureCount: 2,
    minute: Number.NaN,
  })
  assert.equal(nanMinute.liveFixtureCount, 2)
  assert.equal(nanMinute.minute, null)
})

test('deriveBrandHeaderStatus — live with minute === 0 kept (early kickoff whistle)', () => {
  const out = deriveBrandHeaderStatus({
    currentEvent: {
      id: 28,
      finished: false,
      deadline_time: '2026-03-08T13:30:00Z',
    },
    nextEvent: { id: 29, deadline_time: '2026-03-15T13:30:00Z' },
    lastFinishedEvent: { id: 27 },
    now: new Date('2026-03-08T15:00:00Z'),
    liveFixtureCount: 2,
    minute: 0,
  })
  assert.equal(out.minute, 0)
})

test('deriveBrandHeaderStatus — idle ignores liveFixtureCount/minute (defensive null)', () => {
  const out = deriveBrandHeaderStatus({
    currentEvent: { id: 28, finished: true, deadline_time: '2026-03-08T13:30:00Z' },
    nextEvent: { id: 29, deadline_time: '2026-03-15T13:30:00Z' },
    lastFinishedEvent: { id: 28 },
    season: '2025/26',
    now: new Date('2026-03-10T10:00:00Z'),
    liveFixtureCount: 4,
    minute: 47,
  })
  assert.equal(out.status, 'idle')
  assert.equal(out.liveFixtureCount, null)
  assert.equal(out.minute, null)
})

test('deriveBrandHeaderStatus — pre-season ignores liveFixtureCount/minute', () => {
  const out = deriveBrandHeaderStatus({
    currentEvent: null,
    nextEvent: { id: 1, deadline_time: '2026-08-14T17:30:00Z' },
    lastFinishedEvent: null,
    season: '2026/27',
    now: new Date('2026-06-01T10:00:00Z'),
    liveFixtureCount: 4,
    minute: 47,
  })
  assert.equal(out.status, 'pre-season')
  assert.equal(out.liveFixtureCount, null)
  assert.equal(out.minute, null)
})

// PR #5h — absorb the live tile pill into the brand-header strip. Two new
// optional inputs (finished/totalFixtureCount) drive `progressLabel`; the
// 24h-window kickoff sneak peek drives `kickoffLabel`.

test('deriveBrandHeaderStatus — live populates progressLabel "2 of 10 complete" from fixture counts', () => {
  const out = deriveBrandHeaderStatus({
    currentEvent: {
      id: 28,
      finished: false,
      deadline_time: '2026-03-08T13:30:00Z',
    },
    nextEvent: { id: 29, deadline_time: '2026-03-15T13:30:00Z' },
    lastFinishedEvent: { id: 27 },
    now: new Date('2026-03-08T15:00:00Z'),
    liveFixtureCount: 5,
    minute: 47,
    finishedFixtureCount: 2,
    totalFixtureCount: 10,
  })
  assert.equal(out.status, 'live')
  assert.equal(out.progressLabel, '2 of 10 complete')
})

test('deriveBrandHeaderStatus — live with 0 finished of 10 still renders "0 of 10 complete"', () => {
  const out = deriveBrandHeaderStatus({
    currentEvent: {
      id: 28,
      finished: false,
      deadline_time: '2026-03-08T13:30:00Z',
    },
    nextEvent: { id: 29, deadline_time: '2026-03-15T13:30:00Z' },
    lastFinishedEvent: { id: 27 },
    now: new Date('2026-03-08T15:00:00Z'),
    finishedFixtureCount: 0,
    totalFixtureCount: 10,
  })
  assert.equal(out.progressLabel, '0 of 10 complete')
})

test('deriveBrandHeaderStatus — progressLabel null when totalFixtureCount is 0 (graceful)', () => {
  const out = deriveBrandHeaderStatus({
    currentEvent: {
      id: 28,
      finished: false,
      deadline_time: '2026-03-08T13:30:00Z',
    },
    nextEvent: { id: 29, deadline_time: '2026-03-15T13:30:00Z' },
    lastFinishedEvent: { id: 27 },
    now: new Date('2026-03-08T15:00:00Z'),
    finishedFixtureCount: 0,
    totalFixtureCount: 0,
  })
  assert.equal(out.progressLabel, null)
})

test('deriveBrandHeaderStatus — progressLabel null when totalFixtureCount is null', () => {
  const out = deriveBrandHeaderStatus({
    currentEvent: {
      id: 28,
      finished: false,
      deadline_time: '2026-03-08T13:30:00Z',
    },
    nextEvent: { id: 29, deadline_time: '2026-03-15T13:30:00Z' },
    lastFinishedEvent: { id: 27 },
    now: new Date('2026-03-08T15:00:00Z'),
  })
  assert.equal(out.progressLabel, null)
})

test('deriveBrandHeaderStatus — progressLabel null on idle even with fixture counts (defensive)', () => {
  const out = deriveBrandHeaderStatus({
    currentEvent: { id: 28, finished: true, deadline_time: '2026-03-08T13:30:00Z' },
    nextEvent: { id: 29, deadline_time: '2026-03-15T13:30:00Z' },
    lastFinishedEvent: { id: 28 },
    now: new Date('2026-03-10T10:00:00Z'),
    finishedFixtureCount: 10,
    totalFixtureCount: 10,
  })
  assert.equal(out.status, 'idle')
  assert.equal(out.progressLabel, null)
})

test('deriveBrandHeaderStatus — progressLabel null on pre-season even with fixture counts (defensive)', () => {
  const out = deriveBrandHeaderStatus({
    currentEvent: null,
    nextEvent: { id: 1, deadline_time: '2026-08-14T17:30:00Z' },
    lastFinishedEvent: null,
    season: '2026/27',
    now: new Date('2026-06-01T10:00:00Z'),
    finishedFixtureCount: 0,
    totalFixtureCount: 10,
  })
  assert.equal(out.status, 'pre-season')
  assert.equal(out.progressLabel, null)
})

test('deriveBrandHeaderStatus — kickoffLabel populated on idle when deadline within 24h', () => {
  /** `now` deliberately 23h before the deadline so the kickoff falls into
   * tomorrow in every host timezone — guarantees the cross-day "Sat 16:30"
   * shape (rather than the same-day "16:30" tail) regardless of where the
   * test machine is. */
  const out = deriveBrandHeaderStatus({
    currentEvent: { id: 28, finished: true, deadline_time: '2026-03-08T13:30:00Z' },
    nextEvent: { id: 29, deadline_time: '2026-03-14T15:30:00Z' },
    lastFinishedEvent: { id: 28 },
    now: new Date('2026-03-13T16:00:00Z'),
  })
  assert.equal(out.status, 'idle')
  assert.equal(out.nextGw, 29)
  assert.ok(out.kickoffLabel, 'expected a Sat 16:30-style label within 24h window')
  assert.ok(
    /^[A-Z][a-z]{2}\s\d{2}:\d{2}$/.test(out.kickoffLabel),
    `kickoffLabel "${out.kickoffLabel}" should look like "Sat 16:30"`,
  )
})

test('deriveBrandHeaderStatus — kickoffLabel populated on pre-season when deadline within 24h', () => {
  const out = deriveBrandHeaderStatus({
    currentEvent: null,
    nextEvent: { id: 1, deadline_time: '2026-08-15T17:30:00Z' },
    lastFinishedEvent: null,
    season: '2026/27',
    now: new Date('2026-08-15T10:00:00Z'),
  })
  assert.equal(out.status, 'pre-season')
  assert.ok(out.kickoffLabel, 'expected kickoffLabel within 24h window')
})

test('deriveBrandHeaderStatus — kickoffLabel null when deadline more than 24h away (nextDeadlineLabel stays the source of truth)', () => {
  const out = deriveBrandHeaderStatus({
    currentEvent: { id: 28, finished: true, deadline_time: '2026-03-08T13:30:00Z' },
    nextEvent: { id: 29, deadline_time: '2026-03-15T13:30:00Z' },
    lastFinishedEvent: { id: 28 },
    now: new Date('2026-03-10T10:00:00Z'),
  })
  assert.equal(out.status, 'idle')
  assert.equal(out.kickoffLabel, null)
  assert.equal(out.nextDeadlineLabel, 'Mar 15')
})

test('deriveBrandHeaderStatus — kickoffLabel null when deadline already in the past', () => {
  const out = deriveBrandHeaderStatus({
    currentEvent: { id: 28, finished: true, deadline_time: '2026-03-08T13:30:00Z' },
    nextEvent: { id: 29, deadline_time: '2026-03-14T15:30:00Z' },
    lastFinishedEvent: { id: 28 },
    now: new Date('2026-03-14T20:00:00Z'),
  })
  assert.equal(out.status, 'idle')
  assert.equal(out.kickoffLabel, null)
})

test('deriveBrandHeaderStatus — kickoffLabel null on post-season idle (no nextEvent)', () => {
  const out = deriveBrandHeaderStatus({
    currentEvent: null,
    nextEvent: null,
    lastFinishedEvent: { id: 38 },
    season: '2025/26',
    now: new Date('2026-05-26T10:00:00Z'),
  })
  assert.equal(out.status, 'idle')
  assert.equal(out.kickoffLabel, null)
})

test('deriveBrandHeaderStatus — kickoffLabel null on live state (defensive)', () => {
  const out = deriveBrandHeaderStatus({
    currentEvent: {
      id: 28,
      finished: false,
      deadline_time: '2026-03-08T13:30:00Z',
    },
    nextEvent: { id: 29, deadline_time: '2026-03-09T13:30:00Z' },
    lastFinishedEvent: { id: 27 },
    now: new Date('2026-03-08T15:00:00Z'),
  })
  assert.equal(out.status, 'live')
  assert.equal(out.kickoffLabel, null)
})

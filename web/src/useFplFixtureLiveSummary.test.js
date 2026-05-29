import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveLiveSummary } from './useFplFixtureLiveSummary.js'

test('deriveLiveSummary — empty / non-array → null live fields, zero progress counts', () => {
  assert.deepEqual(deriveLiveSummary([]), {
    liveFixtureCount: null,
    minute: null,
    finishedFixtureCount: 0,
    totalFixtureCount: 0,
  })
  assert.deepEqual(deriveLiveSummary(null), {
    liveFixtureCount: null,
    minute: null,
    finishedFixtureCount: 0,
    totalFixtureCount: 0,
  })
  assert.deepEqual(deriveLiveSummary(undefined), {
    liveFixtureCount: null,
    minute: null,
    finishedFixtureCount: 0,
    totalFixtureCount: 0,
  })
})

test('deriveLiveSummary — 4 unstarted fixtures → null live, 0/4 progress', () => {
  const fx = [
    { started: false, finished: false, finished_provisional: false, minutes: 0 },
    { started: false, finished: false, finished_provisional: false, minutes: 0 },
    { started: false, finished: false, finished_provisional: false, minutes: 0 },
    { started: false, finished: false, finished_provisional: false, minutes: 0 },
  ]
  assert.deepEqual(deriveLiveSummary(fx), {
    liveFixtureCount: null,
    minute: null,
    finishedFixtureCount: 0,
    totalFixtureCount: 4,
  })
})

test('deriveLiveSummary — synchronized 4 live at 47\u2032 → count 4, minute 47, 0/4 progress', () => {
  const fx = [
    { started: true, finished: false, finished_provisional: false, minutes: 47 },
    { started: true, finished: false, finished_provisional: false, minutes: 47 },
    { started: true, finished: false, finished_provisional: false, minutes: 47 },
    { started: true, finished: false, finished_provisional: false, minutes: 47 },
  ]
  assert.deepEqual(deriveLiveSummary(fx), {
    liveFixtureCount: 4,
    minute: 47,
    finishedFixtureCount: 0,
    totalFixtureCount: 4,
  })
})

test('deriveLiveSummary — staggered minutes → max wins (earliest-kickoff fixture); progress reflects total', () => {
  const fx = [
    { started: true, finished: false, finished_provisional: false, minutes: 80 },
    { started: true, finished: false, finished_provisional: false, minutes: 35 },
    { started: false, finished: false, finished_provisional: false, minutes: 0 },
  ]
  assert.deepEqual(deriveLiveSummary(fx), {
    liveFixtureCount: 2,
    minute: 80,
    finishedFixtureCount: 0,
    totalFixtureCount: 3,
  })
})

test('deriveLiveSummary — finished + finished_provisional skipped from live, counted in progress', () => {
  const fx = [
    { started: true, finished: true, finished_provisional: true, minutes: 90 },
    { started: true, finished: false, finished_provisional: true, minutes: 90 },
    { started: true, finished: false, finished_provisional: false, minutes: 22 },
  ]
  assert.deepEqual(deriveLiveSummary(fx), {
    liveFixtureCount: 1,
    minute: 22,
    finishedFixtureCount: 2,
    totalFixtureCount: 3,
  })
})

test('deriveLiveSummary — between fixture windows (all 4 finished) → null live, full progress', () => {
  const fx = [
    { started: true, finished: true, finished_provisional: true, minutes: 90 },
    { started: true, finished: true, finished_provisional: true, minutes: 92 },
  ]
  assert.deepEqual(deriveLiveSummary(fx), {
    liveFixtureCount: null,
    minute: null,
    finishedFixtureCount: 2,
    totalFixtureCount: 2,
  })
})

test('deriveLiveSummary — started but no minute number yet → count w/ null minute', () => {
  const fx = [
    { started: true, finished: false, finished_provisional: false, minutes: null },
    { started: true, finished: false, finished_provisional: false, minutes: undefined },
  ]
  assert.deepEqual(deriveLiveSummary(fx), {
    liveFixtureCount: 2,
    minute: null,
    finishedFixtureCount: 0,
    totalFixtureCount: 2,
  })
})

test('deriveLiveSummary — mid-GW (some live, some finished) carries both meta and progress', () => {
  const fx = [
    { started: true, finished: true, finished_provisional: true, minutes: 90 },
    { started: true, finished: true, finished_provisional: true, minutes: 95 },
    { started: true, finished: false, finished_provisional: false, minutes: 47 },
    { started: true, finished: false, finished_provisional: false, minutes: 47 },
    { started: false, finished: false, finished_provisional: false, minutes: 0 },
  ]
  assert.deepEqual(deriveLiveSummary(fx), {
    liveFixtureCount: 2,
    minute: 47,
    finishedFixtureCount: 2,
    totalFixtureCount: 5,
  })
})

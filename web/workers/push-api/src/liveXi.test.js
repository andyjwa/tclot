import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  defconCount,
  defconPoints,
  defconThreshold,
  diffLiveXiEvents,
  findLiveGw,
  liveXiMessage,
  normalizeLiveElements,
} from './liveXi.js'

describe('defconThreshold', () => {
  it('is 10 for DEF, 12 for MID/FWD, null for GKP', () => {
    assert.equal(defconThreshold(2), 10)
    assert.equal(defconThreshold(3), 12)
    assert.equal(defconThreshold(4), 12)
    assert.equal(defconThreshold(1), null)
  })
})

describe('defconPoints', () => {
  it('reads +2 from draft explain', () => {
    const row = {
      stats: { defensive_contribution: 11 },
      explain: [[[{ stat: 'defensive_contribution', value: 11, points: 2 }], 1]],
    }
    assert.equal(defconPoints(row, 2), 2)
  })

  it('falls back to count >= threshold', () => {
    assert.equal(defconPoints({ stats: { defensive_contribution: 12 } }, 3), 2)
    assert.equal(defconPoints({ stats: { defensive_contribution: 9 } }, 2), 0)
  })

  it('counts raw actions', () => {
    assert.equal(defconCount({ defensive_contribution: 7 }), 7)
    assert.equal(defconCount(null), 0)
  })
})

describe('normalizeLiveElements', () => {
  it('handles object-keyed elements', () => {
    const map = normalizeLiveElements({ 449: { stats: { goals_scored: 1 } } })
    assert.equal(map.get(449).stats.goals_scored, 1)
  })
  it('handles array elements', () => {
    const map = normalizeLiveElements([{ id: 12, stats: { assists: 2 } }])
    assert.equal(map.get(12).stats.assists, 2)
  })
})

const elementMeta = new Map([
  [449, { web_name: 'Salah', element_type: 3 }],
  [85, { web_name: 'Gabriel', element_type: 2 }],
])

describe('diffLiveXiEvents', () => {
  it('emits nothing on the first (baseline) poll', () => {
    const liveMap = normalizeLiveElements({
      449: { stats: { goals_scored: 1, assists: 0, minutes: 30 } },
    })
    const { events, totals } = diffLiveXiEvents(null, liveMap, elementMeta, new Set([449]), 5)
    assert.equal(events.length, 0)
    assert.equal(totals[449].g, 1)
  })

  it('emits a goal when goals_scored increments and player is on pitch', () => {
    const liveMap = normalizeLiveElements({
      449: { stats: { goals_scored: 1, assists: 0, minutes: 30 } },
    })
    const prev = { 449: { g: 0, a: 0, dc: 0 } }
    const { events } = diffLiveXiEvents(prev, liveMap, elementMeta, new Set([449]), 5)
    assert.equal(events.length, 1)
    assert.equal(events[0].kind, 'goal')
    assert.equal(events[0].webName, 'Salah')
    assert.equal(events[0].stableId, '5:449:goal:tot1')
  })

  it('emits a defcon event when +2 is reached', () => {
    const liveMap = normalizeLiveElements({
      85: { stats: { goals_scored: 0, assists: 0, minutes: 90, defensive_contribution: 10 } },
    })
    const prev = { 85: { g: 0, a: 0, dc: 0 } }
    const { events } = diffLiveXiEvents(prev, liveMap, elementMeta, new Set([85]), 5)
    assert.equal(events.length, 1)
    assert.equal(events[0].kind, 'defcon')
  })

  it('does not emit for a player who has not been on the pitch', () => {
    const liveMap = normalizeLiveElements({
      449: { stats: { goals_scored: 1, assists: 0, minutes: 0 } },
    })
    const prev = { 449: { g: 0, a: 0, dc: 0 } }
    const { events } = diffLiveXiEvents(prev, liveMap, elementMeta, new Set([449]), 5)
    assert.equal(events.length, 0)
  })

  it('ignores elements not in the relevant set', () => {
    const liveMap = normalizeLiveElements({
      999: { stats: { goals_scored: 5, minutes: 90 } },
    })
    const prev = { 999: { g: 0, a: 0, dc: 0 } }
    const { events } = diffLiveXiEvents(prev, liveMap, elementMeta, new Set([449]), 5)
    assert.equal(events.length, 0)
  })
})

describe('liveXiMessage', () => {
  it('formats a goal', () => {
    const msg = liveXiMessage({ kind: 'goal', webName: 'Salah' }, 5)
    assert.match(msg.title, /Salah/)
  })
})

describe('findLiveGw', () => {
  it('returns the live gw once the deadline has passed', () => {
    const events = [
      { id: 5, deadlineMs: Date.parse('2026-08-23T10:00:00Z'), isCurrent: true, isLive: true, finished: false },
    ]
    assert.equal(findLiveGw(events, Date.parse('2026-08-23T12:00:00Z')), 5)
    assert.equal(findLiveGw(events, Date.parse('2026-08-23T09:00:00Z')), null)
  })
})

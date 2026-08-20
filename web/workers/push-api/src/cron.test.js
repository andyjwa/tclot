import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseGwEvents,
  pickDeadlineReminders,
  pickWaiverWindow,
  upcomingEvent,
} from './cron.js'

const events = parseGwEvents([
  {
    id: 5,
    deadline_time: '2026-08-23T10:00:00Z',
    waivers_time: '2026-08-22T08:00:00Z',
    is_next: true,
    finished: false,
  },
  {
    id: 4,
    deadline_time: '2026-08-16T10:00:00Z',
    waivers_time: '2026-08-15T08:00:00Z',
    finished: true,
  },
])

describe('parseGwEvents', () => {
  it('parses draft bootstrap rows and sorts by id', () => {
    assert.equal(events.length, 2)
    assert.equal(events[1].id, 5)
    assert.equal(events[1].isNext, true)
    assert.equal(events[1].waiversMs, Date.parse('2026-08-22T08:00:00Z'))
  })
})

describe('upcomingEvent', () => {
  it('prefers the next unfinished event', () => {
    assert.equal(upcomingEvent(events)?.id, 5)
  })
})

describe('pickDeadlineReminders', () => {
  it('fires a waiver-deadline 24h reminder inside the window', () => {
    const now = Date.parse('2026-08-21T09:00:00Z') // ~23h before waivers_time
    const picks = pickDeadlineReminders(events, now)
    const waiver = picks.find((p) => p.type === 'waiver_deadline_24h')
    assert.ok(waiver)
    assert.equal(waiver.gw, 5)
    assert.equal(waiver.pref, 'deadlineReminders')
  })

  it('fires a lineup-deadline 1h reminder near the lineup deadline', () => {
    const now = Date.parse('2026-08-23T09:15:00Z') // 45m before deadline_time
    const picks = pickDeadlineReminders(events, now)
    const lineup = picks.find((p) => p.type === 'lineup_deadline_1h')
    assert.ok(lineup)
    assert.equal(lineup.gw, 5)
  })

  it('returns nothing far from either deadline', () => {
    const now = Date.parse('2026-08-01T00:00:00Z')
    assert.equal(pickDeadlineReminders(events, now).length, 0)
  })
})

describe('pickWaiverWindow', () => {
  it('fires shortly after waivers_time for the next GW', () => {
    const nextOnly = parseGwEvents([
      {
        id: 5,
        deadline_time: '2026-08-23T10:00:00Z',
        waivers_time: '2026-08-22T08:00:00Z',
        is_next: true,
        finished: false,
      },
    ])
    const pick = pickWaiverWindow(nextOnly, Date.parse('2026-08-22T08:20:00Z'))
    assert.ok(pick)
    assert.equal(pick.type, 'waiver_processed')
    assert.equal(pick.gw, 5)
  })
})

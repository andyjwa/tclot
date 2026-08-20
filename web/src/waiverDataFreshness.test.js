import assert from 'node:assert/strict'
import test from 'node:test'
import {
  deriveWaiverFreshnessNotice,
  formatLeagueDataBuiltAgo,
  isInPostWaiverRefreshWindow,
} from '../src/waiverDataFreshness.js'
import { postWaiverRefreshEvent } from '../src/waiverRefreshSchedule.js'

const WT = '2026-09-02T10:00:00Z'
const EVENTS = [{ id: 4, waivers_time: WT }]

test('formatLeagueDataBuiltAgo — minutes and hours', () => {
  const base = Date.parse('2026-09-02T12:00:00Z')
  assert.equal(formatLeagueDataBuiltAgo(base, base + 30_000), 'just now')
  assert.equal(formatLeagueDataBuiltAgo(base, base + 5 * 60_000), '5 min ago')
  assert.equal(formatLeagueDataBuiltAgo(base, base + 3 * 60 * 60_000), '3h ago')
})

test('deriveWaiverFreshnessNotice — null before waivers run', () => {
  const now = new Date(Date.parse(WT) - 60_000)
  assert.equal(
    deriveWaiverFreshnessNotice({ draftEvents: EVENTS, selectedGw: 4, now }),
    null,
  )
})

test('deriveWaiverFreshnessNotice — grace period copy', () => {
  const now = new Date(Date.parse(WT) + 5 * 60_000)
  const notice = deriveWaiverFreshnessNotice({
    draftEvents: EVENTS,
    selectedGw: 4,
    leagueDataBuiltAt: '2026-09-01T12:00:00Z',
    now,
  })
  assert.equal(notice?.kind, 'grace')
  assert.match(notice?.message ?? '', /20 minutes/)
})

test('deriveWaiverFreshnessNotice — awaiting deploy in post-waiver window', () => {
  const now = new Date(Date.parse(WT) + 45 * 60_000)
  const notice = deriveWaiverFreshnessNotice({
    draftEvents: EVENTS,
    selectedGw: 4,
    leagueDataBuiltAt: '2026-09-01T12:00:00Z',
    isGwInProcessedList: false,
    hasMovesForSelectedGw: false,
    now,
  })
  assert.equal(notice?.kind, 'awaiting-deploy')
  assert.match(notice?.message ?? '', /20–90 minutes/)
  assert.match(notice?.message ?? '', /Next automatic refresh/)
})

test('deriveWaiverFreshnessNotice — null when GW is present in build', () => {
  const now = new Date(Date.parse(WT) + 45 * 60_000)
  assert.equal(
    deriveWaiverFreshnessNotice({
      draftEvents: EVENTS,
      selectedGw: 4,
      leagueDataBuiltAt: '2026-09-02T11:00:00Z',
      isGwInProcessedList: true,
      now,
    }),
    null,
  )
})

test('deriveWaiverFreshnessNotice — stale outside post-waiver window', () => {
  const now = new Date(Date.parse(WT) + 40 * 60 * 60_000)
  const notice = deriveWaiverFreshnessNotice({
    draftEvents: EVENTS,
    selectedGw: 4,
    leagueDataBuiltAt: '2026-09-01T12:00:00Z',
    isGwInProcessedList: false,
    now,
  })
  assert.equal(notice?.kind, 'stale')
  assert.match(notice?.message ?? '', /Run workflow/)
})

test('postWaiverRefreshEvent — active inside window', () => {
  const now = Date.parse(WT) + 45 * 60_000
  const hit = postWaiverRefreshEvent(EVENTS, now)
  assert.equal(hit?.id, 4)
  assert.ok(isInPostWaiverRefreshWindow(EVENTS, 4, now))
})

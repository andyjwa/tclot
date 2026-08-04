import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
/** Completed-season snapshot — live league-data is 26/27 pre-season (no waivers yet). */
const leagueDataDir = join(__dirname, '../public/league-data/seasons/2025-26')

/**
 * Successful waiver swaps always have both element_in and element_out, so
 * per-team In and Out claim counts must match. The UI used to show distinct
 * waivered-in players vs out transaction count, which made volume look wrong.
 */
test('every successful waiver has both in and out', () => {
  const { transactions } = JSON.parse(
    readFileSync(join(leagueDataDir, 'transactions.json'), 'utf8')
  )
  const waivers = transactions.filter(
    (t) => t.kind === 'w' && t.result === 'a' && Number(t.event) > 0
  )
  assert.ok(waivers.length > 0)
  for (const t of waivers) {
    assert.notEqual(t.element_in, null)
    assert.notEqual(t.element_out, null)
  }
})

test('teamWaiverInTotals.waiverInCount matches waived-out transaction volume', () => {
  const tenure = JSON.parse(
    readFileSync(join(leagueDataDir, 'pickups-tenure.json'), 'utf8')
  )
  const drops = JSON.parse(
    readFileSync(join(leagueDataDir, 'drops-gw-live.json'), 'utf8')
  )
  const outByEntry = new Map()
  for (const r of drops.rows || []) {
    if (r.transactionKind === 'f') continue
    outByEntry.set(r.entry, (outByEntry.get(r.entry) || 0) + 1)
  }
  for (const t of tenure.teamWaiverInTotals || []) {
    assert.equal(t.waiverInCount, outByEntry.get(t.entry) || 0)
    // Distinct players can be lower when the same player is re-waived.
    assert.ok(t.distinctPlayers <= t.waiverInCount)
  }
})

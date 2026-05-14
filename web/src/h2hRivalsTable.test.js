import assert from 'node:assert/strict'
import test from 'node:test'
import { buildH2hRivalsForTeam } from './h2hRivalsTable.js'

test('buildH2hRivalsForTeam — aggregates and last meeting by latest GW', () => {
  const idToName = { 1: 'A', 2: 'B' }
  const matches = [
    {
      event: 1,
      finished: true,
      league_entry_1: 1,
      league_entry_2: 2,
      league_entry_1_points: 50,
      league_entry_2_points: 40,
    },
    {
      event: 10,
      finished: true,
      league_entry_1: 1,
      league_entry_2: 2,
      league_entry_1_points: 30,
      league_entry_2_points: 35,
    },
  ]
  const rows = buildH2hRivalsForTeam(matches, idToName, 1)
  assert.equal(rows.length, 1)
  const b = rows[0]
  assert.equal(b.opponentId, 2)
  assert.equal(b.record, '1–0–1')
  assert.equal(b.for, 80)
  assert.equal(b.against, 75)
  assert.ok(b.lastLabel.includes('GW10'), 'later GW wins for Last')
  assert.ok(b.lastLabel.includes('30–35'))
})

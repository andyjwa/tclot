import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFixtureScheduleMatrix } from './fixtureScheduleMatrix.js'

test('buildFixtureScheduleMatrix — diagonal vs counterfactual column', () => {
  const leagueEntries = [
    { id: 1, entry_name: 'A' },
    { id: 2, entry_name: 'B' },
    { id: 3, entry_name: 'C' },
    { id: 4, entry_name: 'D' },
  ]
  const matches = [
    {
      event: 1,
      finished: true,
      league_entry_1: 1,
      league_entry_2: 2,
      league_entry_1_points: 20,
      league_entry_2_points: 10,
    },
    {
      event: 1,
      finished: true,
      league_entry_1: 3,
      league_entry_2: 4,
      league_entry_1_points: 15,
      league_entry_2_points: 15,
    },
    {
      event: 2,
      finished: true,
      league_entry_1: 1,
      league_entry_2: 3,
      league_entry_1_points: 30,
      league_entry_2_points: 30,
    },
    {
      event: 2,
      finished: true,
      league_entry_1: 2,
      league_entry_2: 4,
      league_entry_1_points: 5,
      league_entry_2_points: 100,
    },
  ]
  const tableRows = leagueEntries.map((e, i) => ({
    league_entry: e.id,
    rank: i + 1,
  }))

  const model = buildFixtureScheduleMatrix(matches, leagueEntries, tableRows)
  assert.ok(model)
  const { orderedIds, matrix } = model
  assert.deepEqual(orderedIds, [1, 2, 3, 4])

  const idx = (id) => orderedIds.indexOf(id)
  const iA = idx(1)
  const iD = idx(4)

  assert.equal(matrix[iA][iA], 4, 'A: W GW1, D GW2 → 3+1')
  assert.equal(matrix[iA][iD], 6, 'A with D opponents: both W → 6')
  assert.ok(matrix[iA][iD] > matrix[iA][iA])

  const n = orderedIds.length
  const rowAvg = matrix[iA].reduce((s, v) => s + v, 0) / n
  assert.equal(model.rowAverages[iA], rowAvg)
})

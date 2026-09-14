import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFixtureScheduleMatrix } from './fixtureScheduleMatrix.js'

test('buildFixtureScheduleMatrix — row average is actual minus the other lists', () => {
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
      league_entry_1_points: 10,
      league_entry_2_points: 20,
    },
    {
      event: 1,
      finished: true,
      league_entry_1: 3,
      league_entry_2: 4,
      league_entry_1_points: 8,
      league_entry_2_points: 6,
    },
  ]
  const tableRows = leagueEntries.map((e, i) => ({
    league_entry: e.id,
    rank: i + 1,
  }))

  const model = buildFixtureScheduleMatrix(matches, leagueEntries, tableRows)
  assert.ok(model)
  const { orderedIds, matrix, rowAverages } = model
  const iA = orderedIds.indexOf(1)
  const actual = matrix[iA][iA]
  const others = matrix[iA].filter((_, j) => j !== iA)
  assert.equal(actual, 0, 'A lost')
  assert.equal(matrix[iA][orderedIds.indexOf(4)], 3, 'A would have beaten D\'s opponent')
  const avg = others.reduce((s, n) => s + n, 0) / others.length
  assert.equal(rowAverages[iA], actual - avg)
  assert.ok(rowAverages[iA] < 0)
})

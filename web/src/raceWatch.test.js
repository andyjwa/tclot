import assert from 'node:assert/strict'
import test from 'node:test'
import { goldenCircuitTwoAway, laDecimaTwoAway, raceWatchLines } from './raceWatch.js'

test('La Decima line appears only at 8 wins', () => {
  const rows = [
    { league_entry: 1, teamName: 'Hackney', matches_won: 8 },
    { league_entry: 2, teamName: 'Toronto', matches_won: 9 },
    { league_entry: 3, teamName: 'Shire', matches_won: 7 },
  ]
  assert.deepEqual(
    laDecimaTwoAway(rows).map((r) => r.teamName),
    ['Hackney'],
  )
})

function win(event, a, b, aPts, bPts) {
  return {
    event,
    finished: true,
    league_entry_1: a,
    league_entry_2: b,
    league_entry_1_points: aPts,
    league_entry_2_points: bPts,
  }
}

test('Golden Circuit line appears at five different opponents in a row', () => {
  const matches = [
    win(1, 1, 2, 40, 20),
    win(2, 1, 3, 40, 20),
    win(3, 1, 4, 40, 20),
    win(4, 1, 5, 40, 20),
    win(5, 1, 6, 40, 20),
  ]
  const names = new Map([[1, 'Hackney']])
  const rows = goldenCircuitTwoAway(matches, names)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].teamName, 'Hackney')
})

test('a loss clears the Golden Circuit run', () => {
  const matches = [
    win(1, 1, 2, 40, 20),
    win(2, 1, 3, 40, 20),
    win(3, 1, 4, 40, 20),
    win(4, 1, 5, 40, 20),
    win(5, 1, 6, 10, 30),
    win(6, 1, 7, 40, 20),
  ]
  assert.equal(goldenCircuitTwoAway(matches, new Map([[1, 'Hackney']])).length, 0)
})

test('race lines name both watches when one club has each', () => {
  const rows = [{ league_entry: 1, teamName: 'Hackney', matches_won: 8 }]
  const matches = [
    win(1, 1, 2, 40, 20),
    win(2, 1, 3, 40, 20),
    win(3, 1, 4, 40, 20),
    win(4, 1, 5, 40, 20),
    win(5, 1, 6, 40, 20),
  ]
  assert.deepEqual(raceWatchLines(rows, matches), [
    'Hackney is 2 wins from La Decima and the Golden Circuit',
  ])
})

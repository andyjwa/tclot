import assert from 'node:assert/strict'
import test from 'node:test'
import {
  groupScheduleByGw,
  buildTeamScheduleRows,
  summarizeTeamSchedule,
} from './standingsScheduleDerivations.js'

const idToName = { 1: 'Alpha', 2: 'Bravo', 3: 'Charlie', 4: 'Delta' }

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
    event: 1,
    finished: true,
    league_entry_1: 3,
    league_entry_2: 4,
    league_entry_1_points: 30,
    league_entry_2_points: 30,
  },
  {
    event: 2,
    finished: true,
    league_entry_1: 1,
    league_entry_2: 3,
    league_entry_1_points: 20,
    league_entry_2_points: 60,
  },
  {
    event: 2,
    finished: true,
    league_entry_1: 2,
    league_entry_2: 4,
    league_entry_1_points: 45,
    league_entry_2_points: 30,
  },
  {
    event: 3,
    finished: false,
    league_entry_1: 1,
    league_entry_2: 4,
  },
  {
    event: 3,
    finished: false,
    league_entry_1: 2,
    league_entry_2: 3,
  },
]

test('groupScheduleByGw — sorts GWs descending and tags finished', () => {
  const groups = groupScheduleByGw(matches, idToName)
  assert.deepEqual(
    groups.map((g) => g.event),
    [3, 2, 1],
  )
  assert.equal(groups[0].finished, false)
  assert.equal(groups[1].finished, true)
  assert.equal(groups[2].finished, true)
  assert.equal(groups[2].fixtures.length, 2)
  assert.equal(groups[2].fixtures[0].homeName, 'Alpha')
  assert.equal(groups[2].fixtures[0].homePts, 50)
  assert.equal(groups[0].fixtures[0].homePts, null)
})

test('buildTeamScheduleRows — chronological with H/A and W/L/D', () => {
  const rows = buildTeamScheduleRows(1, matches, idToName)
  assert.equal(rows.length, 3)
  assert.deepEqual(
    rows.map((r) => r.event),
    [1, 2, 3],
  )
  assert.equal(rows[0].location, 'H')
  assert.equal(rows[0].opponentName, 'Bravo')
  assert.equal(rows[0].result, 'W')
  assert.equal(rows[1].location, 'H')
  assert.equal(rows[1].result, 'L')
  assert.equal(rows[2].finished, false)
  assert.equal(rows[2].result, null)
})

test('summarizeTeamSchedule — W/L/D + streak + avg from filtered rows only', () => {
  const aRows = buildTeamScheduleRows(1, matches, idToName)
  const aSummary = summarizeTeamSchedule(aRows)
  assert.equal(aSummary.wins, 1)
  assert.equal(aSummary.losses, 1)
  assert.equal(aSummary.draws, 0)
  assert.equal(aSummary.streakLabel, 'L1')
  assert.equal(aSummary.avgPoints, 35)
  assert.equal(aSummary.finishedCount, 2)
})

test('summarizeTeamSchedule — extends streak across consecutive same-result GWs', () => {
  const rows = [
    { event: 1, finished: true, result: 'W', myPoints: 50 },
    { event: 2, finished: true, result: 'W', myPoints: 60 },
    { event: 3, finished: true, result: 'W', myPoints: 70 },
    { event: 4, finished: false, result: null, myPoints: null },
  ]
  const s = summarizeTeamSchedule(rows)
  assert.equal(s.streakLabel, 'W3')
  assert.equal(s.wins, 3)
})

test('summarizeTeamSchedule — empty/all-upcoming returns nulls', () => {
  const s = summarizeTeamSchedule([
    { event: 1, finished: false, result: null, myPoints: null },
  ])
  assert.equal(s.wins, 0)
  assert.equal(s.streakLabel, null)
  assert.equal(s.avgPoints, null)
})

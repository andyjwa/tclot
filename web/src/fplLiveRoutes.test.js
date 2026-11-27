import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseFplLiveHash,
  buildFplLiveHash,
  fixtureIndexFromFplHash,
} from './fplLiveRoutes.js'

test('parseFplLiveHash reads canonical TCLOT and Premier League paths', () => {
  assert.deepEqual(parseFplLiveHash('#/fpl/tclot/11/4-9'), {
    tab: 'live',
    gameweek: 11,
    homeId: 4,
    awayId: 9,
    fixtureKey: null,
    alias: false,
  })
  assert.deepEqual(parseFplLiveHash('#/fpl/premier-league/11/88'), {
    tab: 'squads',
    gameweek: 11,
    homeId: null,
    awayId: null,
    fixtureKey: 88,
    alias: false,
  })
  assert.equal(parseFplLiveHash('#/players?w=1'), null)
  assert.equal(parseFplLiveHash('#/fpl/nope'), null)
})

test('old Scores and Lineups hashes stay valid aliases', () => {
  const scores = parseFplLiveHash('#/fpl/scores/3/1-2')
  assert.equal(scores.tab, 'live')
  assert.equal(scores.alias, true)
  assert.equal(scores.homeId, 1)
  assert.equal(buildFplLiveHash(scores), '#/fpl/tclot/3/1-2')

  const lineups = parseFplLiveHash('#/fpl/lineups/8/f-10-20')
  assert.equal(lineups.tab, 'squads')
  assert.equal(lineups.alias, true)
  assert.equal(lineups.fixtureKey, 'f-10-20')
  assert.equal(buildFplLiveHash(lineups), '#/fpl/premier-league/8/f-10-20')

  const squads = parseFplLiveHash('#/fpl/squads')
  assert.equal(squads.tab, 'squads')
  assert.equal(buildFplLiveHash(squads), '#/fpl/premier-league')
})

test('fixtureIndexFromFplHash matches the pairing on this gameweek', () => {
  const fixtures = [
    { homeId: 1, awayId: 2 },
    { homeId: 4, awayId: 9 },
  ]
  assert.equal(fixtureIndexFromFplHash(fixtures, 11, '#/fpl/tclot/11/4-9'), 1)
  assert.equal(fixtureIndexFromFplHash(fixtures, 11, '#/fpl/scores/11/4-9'), 1)
  assert.equal(fixtureIndexFromFplHash(fixtures, 12, '#/fpl/tclot/11/4-9'), null)
  assert.equal(fixtureIndexFromFplHash(fixtures, 11, '#/fpl/premier-league/11/4'), null)
})

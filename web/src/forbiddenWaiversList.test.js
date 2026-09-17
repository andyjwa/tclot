import test from 'node:test'
import assert from 'node:assert/strict'
import {
  compareForbiddenByClub,
  filterForbiddenPlayers,
  matchesForbiddenSearch,
} from './forbiddenWaiversList.js'

const players = [
  { id: 1, webName: 'David', fullName: 'Promise David', team: 'BHA', position: 'FWD' },
  { id: 2, webName: 'Gozo', fullName: 'Zavier Gozo', team: 'CRY', position: 'MID' },
  { id: 3, webName: 'Suzuki', fullName: 'Zion Suzuki', team: 'AVL', position: 'GKP' },
  { id: 4, webName: 'Ruggeri', fullName: 'Matteo Ruggeri', team: 'AVL', position: 'DEF' },
  { id: 5, webName: 'Dedić', fullName: 'Amar Dedic', team: 'NEW', position: 'DEF' },
]

test('compareForbiddenByClub orders by club then name, not position', () => {
  const ordered = players.slice().sort(compareForbiddenByClub)
  assert.deepEqual(
    ordered.map((p) => `${p.team}:${p.webName}`),
    ['AVL:Ruggeri', 'AVL:Suzuki', 'BHA:David', 'CRY:Gozo', 'NEW:Dedić'],
  )
})

test('matchesForbiddenSearch finds player, club, and accent-folded names', () => {
  assert.equal(matchesForbiddenSearch(players[0], 'bha'), true)
  assert.equal(matchesForbiddenSearch(players[0], 'promise'), true)
  assert.equal(matchesForbiddenSearch(players[4], 'dedic'), true)
  assert.equal(matchesForbiddenSearch(players[0], 'cry'), false)
})

test('filterForbiddenPlayers searches and keeps club order', () => {
  const avl = filterForbiddenPlayers(players, 'avl')
  assert.deepEqual(
    avl.map((p) => p.webName),
    ['Ruggeri', 'Suzuki'],
  )
  assert.equal(filterForbiddenPlayers(players, 'zzz').length, 0)
  assert.equal(filterForbiddenPlayers(players, '').length, players.length)
})

test('filterForbiddenPlayers keeps taken pickups first, then club', () => {
  const taken = new Set([1])
  const ordered = filterForbiddenPlayers(players, '', taken)
  assert.equal(ordered[0].webName, 'David')
  assert.deepEqual(
    ordered.slice(1).map((p) => `${p.team}:${p.webName}`),
    ['AVL:Ruggeri', 'AVL:Suzuki', 'CRY:Gozo', 'NEW:Dedić'],
  )
})

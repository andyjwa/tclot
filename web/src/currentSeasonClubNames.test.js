import test from 'node:test'
import assert from 'node:assert/strict'
import {
  currentSeasonClubLabel,
  currentSeasonNameByManagerKey,
  managerMatchKey,
  overlayCurrentSeasonEntryName,
} from './currentSeasonClubNames.js'

const MANIFEST = {
  teams: [
    { name: 'Atlético Bilbo', manager: 'Nick Goodacre' },
    { name: 'Toronto Gimli', manager: 'Andy Ward' },
    { name: 'Hackney Rohirrim', manager: 'Michael Sutton' },
    { name: 'Suffolk Sméagol', manager: 'Jon Ward' },
    {
      name: 'Mr Mordorlicious School for Girls',
      shortName: 'Mr. MSFG',
      manager: 'Nick Mottershead',
    },
    { name: 'Rokesly Regorasu', manager: 'David Higman' },
    { name: 'Seoul Shire', manager: 'Luke Buther' },
    { name: 'Brampton Balrogs', manager: 'Tery Webster' },
  ],
}

test('managerMatchKey — first-name and spelling aliases', () => {
  assert.equal(
    managerMatchKey('Michael', 'Sutton'),
    managerMatchKey('Mike', 'Sutton'),
  )
  assert.equal(
    managerMatchKey('Luke', 'Buther'),
    managerMatchKey('Luke', 'Butcher'),
  )
  assert.equal(
    managerMatchKey('Tery', 'Webster'),
    managerMatchKey('Eddy', 'Webster'),
  )
  assert.notEqual(
    managerMatchKey('Andy', 'Ward'),
    managerMatchKey('Jon', 'Ward'),
  )
})

test('currentSeasonClubLabel — MSFG renders as Mordor SFG', () => {
  assert.equal(currentSeasonClubLabel({ name: 'Atlético Bilbo' }), 'Atlético Bilbo')
  assert.equal(
    currentSeasonClubLabel({
      name: 'Mr Mordorlicious School for Girls',
      shortName: 'Mr. MSFG',
    }),
    'Mordor SFG',
  )
})

test('overlayCurrentSeasonEntryName — maps 25/26 FPL entries to 26/27 clubs', () => {
  const byManager = currentSeasonNameByManagerKey(MANIFEST)
  assert.equal(
    overlayCurrentSeasonEntryName(
      { player_first_name: 'Nick', player_last_name: 'Goodacre', entry_name: 'Hanson of York AFC' },
      byManager,
    ),
    'Atlético Bilbo',
  )
  assert.equal(
    overlayCurrentSeasonEntryName(
      { player_first_name: 'Andy', player_last_name: 'Ward', entry_name: 'Toronto Oizo' },
      byManager,
    ),
    'Toronto Gimli',
  )
  assert.equal(
    overlayCurrentSeasonEntryName(
      { player_first_name: 'Mike', player_last_name: 'Sutton', entry_name: 'Clapton Cornershop' },
      byManager,
    ),
    'Hackney Rohirrim',
  )
  assert.equal(
    overlayCurrentSeasonEntryName(
      { player_first_name: 'Jon', player_last_name: 'Ward', entry_name: 'Morpeth Jamiroquai' },
      byManager,
    ),
    'Suffolk Sméagol',
  )
  assert.equal(
    overlayCurrentSeasonEntryName(
      { player_first_name: 'Nick', player_last_name: 'Mottershead', entry_name: 'Hackney Meat Loaf' },
      byManager,
    ),
    'Mordor SFG',
  )
  assert.equal(
    overlayCurrentSeasonEntryName(
      { player_first_name: 'David', player_last_name: 'Higman', entry_name: 'Crouch End Oashisu' },
      byManager,
    ),
    'Rokesly Regorasu',
  )
  assert.equal(
    overlayCurrentSeasonEntryName(
      { player_first_name: 'Luke', player_last_name: 'Butcher', entry_name: 'Seoul Club 7 🏆' },
      byManager,
    ),
    'Seoul Shire',
  )
  assert.equal(
    overlayCurrentSeasonEntryName(
      { player_first_name: 'Eddy', player_last_name: 'Webster', entry_name: 'Brampton II Men' },
      byManager,
    ),
    'Brampton Balrogs',
  )
})

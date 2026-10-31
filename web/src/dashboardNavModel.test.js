import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MORE_MENU_ITEMS,
  isMovesDashboardView,
  isBookieHubTab,
  moreMenuItemLabel,
  isMoreMenuDestination,
  isMoreMenuItemActive,
  moreMenuDestination,
} from './dashboardNavModel.js'

test('Players is a Moves view so the Moves tab stays selected', () => {
  assert.equal(isMovesDashboardView('teamSelection'), true)
  assert.equal(isMovesDashboardView('players'), true)
  assert.equal(isMovesDashboardView('fplLive'), false)
  assert.equal(isMovesDashboardView('hall'), false)
})

test('Markets covers the slip, the board, and season predictions', () => {
  assert.equal(isBookieHubTab('bookie'), true)
  assert.equal(isBookieHubTab('board'), true)
  assert.equal(isBookieHubTab('predictions'), true)
  assert.equal(isBookieHubTab('recap'), false)
  assert.equal(isBookieHubTab('live'), false)
})

test('More Recap item is Recap or Preview from the gameweek', () => {
  const recap = MORE_MENU_ITEMS.find((i) => i.id === 'recap')
  assert.equal(moreMenuItemLabel(recap, 'live'), 'Preview')
  assert.equal(moreMenuItemLabel(recap, 'idle'), 'Recap')
  assert.equal(moreMenuItemLabel(recap, 'pre-season'), 'Recap')
})

test('More popup lists Recap, Markets, and Heritage', () => {
  assert.deepEqual(
    MORE_MENU_ITEMS.map((i) => ({
      id: i.id,
      label: i.label,
      icon: i.icon,
    })),
    [
      { id: 'recap', label: 'Recap', icon: 'newspaper' },
      { id: 'markets', label: 'Markets', icon: 'dices' },
      { id: 'hall', label: 'Heritage', icon: 'column' },
    ],
  )
  for (const item of MORE_MENU_ITEMS) {
    assert.equal('parent' in item, false)
  }
})

test('More owns Heritage, Markets, and Recap; Scores is the centre', () => {
  assert.equal(isMoreMenuDestination('hall', null, 'live'), true)
  assert.equal(isMoreMenuDestination('settings', null, 'live'), false)
  assert.equal(isMoreMenuDestination('fplLive', 'bookie', 'live'), true)
  assert.equal(isMoreMenuDestination('fplLive', 'board', 'live'), true)
  assert.equal(isMoreMenuDestination('fplLive', 'predictions', 'live'), true)
  assert.equal(isMoreMenuDestination('fplLive', 'recap', 'live'), true)
  assert.equal(isMoreMenuDestination('fplLive', 'live', 'live'), false)
  assert.equal(isMoreMenuDestination('standings', null, 'live'), false)
})

test('More item active state matches the open destination', () => {
  assert.equal(isMoreMenuItemActive('hall', null, 'hall'), true)
  assert.equal(isMoreMenuItemActive('fplLive', 'bookie', 'markets'), true)
  assert.equal(isMoreMenuItemActive('fplLive', 'board', 'markets'), true)
  assert.equal(isMoreMenuItemActive('fplLive', 'predictions', 'markets'), true)
  assert.equal(isMoreMenuItemActive('fplLive', 'recap', 'recap'), true)
  assert.equal(isMoreMenuItemActive('fplLive', 'recap', 'markets'), false)
  assert.equal(isMoreMenuItemActive('fplLive', 'live', 'recap'), false)
  assert.equal(isMoreMenuItemActive('hall', null, 'markets'), false)
})

test('More destinations keep Recap on its tab and Markets on the slip', () => {
  const recap = MORE_MENU_ITEMS.find((i) => i.id === 'recap')
  assert.deepEqual(moreMenuDestination(recap), { view: 'fplLive', tab: 'recap' })
  const markets = MORE_MENU_ITEMS.find((i) => i.id === 'markets')
  assert.deepEqual(moreMenuDestination(markets), { view: 'fplLive', tab: 'bookie' })
})

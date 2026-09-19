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

test('Season Predictions lives under the Bookie hub', () => {
  assert.equal(isBookieHubTab('bookie'), true)
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

test('More popup lists Recap, Bookies, Predictions under Bookies, Heritage', () => {
  assert.deepEqual(
    MORE_MENU_ITEMS.map((i) => ({ id: i.id, parent: i.parent ?? null })),
    [
      { id: 'recap', parent: null },
      { id: 'bookies', parent: null },
      { id: 'predictions', parent: 'bookies' },
      { id: 'hall', parent: null },
    ],
  )
})

test('More owns Heritage, Bookies, and Predictions; Recap only when not the centre', () => {
  assert.equal(isMoreMenuDestination('hall', null, 'recap'), true)
  assert.equal(isMoreMenuDestination('fplLive', 'bookie', 'live'), true)
  assert.equal(isMoreMenuDestination('fplLive', 'predictions', 'live'), true)
  assert.equal(isMoreMenuDestination('fplLive', 'recap', 'recap'), false)
  assert.equal(isMoreMenuDestination('fplLive', 'recap', 'live'), true)
  assert.equal(isMoreMenuDestination('fplLive', 'live', 'live'), false)
  assert.equal(isMoreMenuDestination('standings', null, 'live'), false)
})

test('More item active state matches the open destination', () => {
  assert.equal(isMoreMenuItemActive('hall', null, 'hall'), true)
  assert.equal(isMoreMenuItemActive('fplLive', 'bookie', 'bookies'), true)
  assert.equal(isMoreMenuItemActive('fplLive', 'predictions', 'predictions'), true)
  assert.equal(isMoreMenuItemActive('fplLive', 'recap', 'recap'), true)
  assert.equal(isMoreMenuItemActive('fplLive', 'recap', 'predictions'), false)
  assert.equal(isMoreMenuItemActive('fplLive', 'live', 'recap'), false)
})

test('More destinations keep Recap and Predictions on their own tabs', () => {
  const recap = MORE_MENU_ITEMS.find((i) => i.id === 'recap')
  assert.deepEqual(moreMenuDestination(recap), { view: 'fplLive', tab: 'recap' })
  const predictions = MORE_MENU_ITEMS.find((i) => i.id === 'predictions')
  assert.deepEqual(moreMenuDestination(predictions), {
    view: 'fplLive',
    tab: 'predictions',
  })
  const bookies = MORE_MENU_ITEMS.find((i) => i.id === 'bookies')
  assert.deepEqual(moreMenuDestination(bookies), { view: 'fplLive', tab: 'bookie' })
})

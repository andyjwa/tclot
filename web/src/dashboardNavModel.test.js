import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MORE_MENU_ITEMS,
  isMovesDashboardView,
  isPredictionsLiveTab,
  predictionsTabForStatus,
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

test('Recap lives under Predictions', () => {
  assert.equal(isPredictionsLiveTab('predictions'), true)
  assert.equal(isPredictionsLiveTab('recap'), true)
  assert.equal(isPredictionsLiveTab('bookie'), false)
  assert.equal(isPredictionsLiveTab('live'), false)
})

test('idle weeks open Recap inside Predictions; otherwise Season', () => {
  assert.equal(predictionsTabForStatus('idle'), 'recap')
  assert.equal(predictionsTabForStatus('live'), 'predictions')
  assert.equal(predictionsTabForStatus('pre-season'), 'predictions')
})

test('More popup lists Predictions, Bookies, Heritage', () => {
  assert.deepEqual(
    MORE_MENU_ITEMS.map((i) => i.label),
    ['Predictions', 'Bookies', 'Heritage'],
  )
})

test('More owns Heritage, Bookies, and Predictions that are not the centre slot', () => {
  assert.equal(isMoreMenuDestination('hall', null, 'recap'), true)
  assert.equal(isMoreMenuDestination('fplLive', 'bookie', 'live'), true)
  assert.equal(isMoreMenuDestination('fplLive', 'predictions', 'live'), true)
  assert.equal(isMoreMenuDestination('fplLive', 'recap', 'recap'), false)
  assert.equal(isMoreMenuDestination('fplLive', 'predictions', 'predictions'), false)
  assert.equal(isMoreMenuDestination('fplLive', 'live', 'live'), false)
  assert.equal(isMoreMenuDestination('standings', null, 'live'), false)
})

test('More item active state matches the open destination', () => {
  assert.equal(isMoreMenuItemActive('hall', null, 'hall'), true)
  assert.equal(isMoreMenuItemActive('fplLive', 'bookie', 'bookies'), true)
  assert.equal(isMoreMenuItemActive('fplLive', 'recap', 'predictions'), true)
  assert.equal(isMoreMenuItemActive('fplLive', 'live', 'predictions'), false)
})

test('More → Predictions lands on Recap between gameweeks', () => {
  const item = MORE_MENU_ITEMS.find((i) => i.id === 'predictions')
  assert.deepEqual(moreMenuDestination(item, 'idle'), {
    view: 'fplLive',
    tab: 'recap',
  })
  assert.deepEqual(moreMenuDestination(item, 'live'), {
    view: 'fplLive',
    tab: 'predictions',
  })
  const bookies = MORE_MENU_ITEMS.find((i) => i.id === 'bookies')
  assert.deepEqual(moreMenuDestination(bookies, 'live'), {
    view: 'fplLive',
    tab: 'bookie',
  })
})

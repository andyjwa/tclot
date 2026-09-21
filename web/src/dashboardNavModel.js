/**
 * Shared dashboard IA helpers for the main nav + Moves / More grouping.
 *
 * Players lives under Moves (left of Waivers). The mobile More slot opens a
 * popup above the dock: Recap or Preview (by gameweek), Bookies,
 * Predictions, Heritage, and Settings. Bookie remains the betting hub;
 * season Predictions is a sibling row, not a nested Bookies child.
 */

import { recapMenuLabelForStatus } from './weeklyRecapView.js'

/** @typedef {'waivers' | 'trades' | 'tradeTool' | 'draft' | 'players'} MovesTabId */

/** @typedef {'squads' | 'live' | 'recap' | 'predictions' | 'bookie'} FplLiveTabId */

export const MORE_MENU_ITEMS = /** @type {const} */ ([
  { id: 'recap', label: 'Recap', view: 'fplLive', tab: 'recap', icon: 'newspaper' },
  { id: 'bookies', label: 'Bookies', view: 'fplLive', tab: 'bookie', icon: 'dices' },
  { id: 'predictions', label: 'Predictions', view: 'fplLive', tab: 'predictions', icon: 'sparkle' },
  { id: 'hall', label: 'Heritage', view: 'hall', tab: null, icon: 'column' },
  { id: 'settings', label: 'Settings', view: 'settings', tab: null, icon: 'settings' },
])

/** @param {string | null | undefined} view */
export function isMovesDashboardView(view) {
  return view === 'teamSelection' || view === 'players'
}

/** Season Predictions lives under the Bookie hub. */
export function isBookieHubTab(tab) {
  return tab === 'bookie' || tab === 'predictions'
}

/**
 * More menu label for Recap/Preview follows the gameweek: Preview while a
 * GW is live, Recap otherwise.
 *
 * @param {{ id: string, label: string }} item
 * @param {string | null | undefined} status
 */
export function moreMenuItemLabel(item, status) {
  if (item?.id === 'recap') return recapMenuLabelForStatus(status)
  return item?.label ?? ''
}

/**
 * More is selected for Heritage / Settings / the More page, Bookies,
 * Predictions, and Recap/Preview. The contextual centre is Scores (or
 * Preview in pre-season), so Recap always lives in More.
 *
 * @param {string | null | undefined} view
 * @param {string | null | undefined} tab
 * @param {string | null | undefined} centerTab
 */
export function isMoreMenuDestination(view, tab, centerTab) {
  if (view === 'hall' || view === 'settings' || view === 'more') return true
  if (view !== 'fplLive') return false
  if (isBookieHubTab(tab)) return true
  return tab === 'recap' && tab !== centerTab
}

/**
 * @param {string | null | undefined} view
 * @param {string | null | undefined} tab
 * @param {string} itemId
 */
export function isMoreMenuItemActive(view, tab, itemId) {
  if (itemId === 'hall') return view === 'hall'
  if (itemId === 'settings') return view === 'settings'
  if (itemId === 'bookies') return view === 'fplLive' && tab === 'bookie'
  if (itemId === 'predictions') return view === 'fplLive' && tab === 'predictions'
  if (itemId === 'recap') return view === 'fplLive' && tab === 'recap'
  return false
}

/**
 * @param {{ id: string, view: string, tab: string | null }} item
 * @returns {{ view: string, tab: string | null }}
 */
export function moreMenuDestination(item) {
  if (!item) return { view: 'hall', tab: null }
  return { view: item.view, tab: item.tab ?? null }
}

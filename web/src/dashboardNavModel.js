/**
 * Shared dashboard IA helpers for the main nav + Moves / More grouping.
 *
 * Players lives under Moves (left of Waivers). The mobile More slot opens a
 * popup above the dock: Recap or Preview (by gameweek), Markets, and
 * Heritage. Markets is the betting desk (Slip, Board, Season). Settings
 * lives on the league-info modal, not in this menu.
 */

import { recapMenuLabelForStatus } from './weeklyRecapView.js'

/** @typedef {'waivers' | 'trades' | 'tradeTool' | 'draft' | 'players'} MovesTabId */

/** @typedef {'squads' | 'live' | 'recap' | 'predictions' | 'bookie' | 'board'} FplLiveTabId */

export const MORE_MENU_ITEMS = /** @type {const} */ ([
  { id: 'recap', label: 'Recap', view: 'fplLive', tab: 'recap', icon: 'newspaper' },
  { id: 'markets', label: 'Markets', view: 'fplLive', tab: 'bookie', icon: 'dices' },
  { id: 'hall', label: 'Heritage', view: 'hall', tab: null, icon: 'column' },
])

/** @param {string | null | undefined} view */
export function isMovesDashboardView(view) {
  return view === 'teamSelection' || view === 'players'
}

/** Slip, Board, and Season Predictions share the Markets hub. */
export function isBookieHubTab(tab) {
  return tab === 'bookie' || tab === 'board' || tab === 'predictions'
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
 * More is selected for Heritage, the More page, Markets, and Recap/Preview.
 * The contextual centre is always Scores, so Recap lives in More.
 *
 * @param {string | null | undefined} view
 * @param {string | null | undefined} tab
 * @param {string | null | undefined} centerTab
 */
export function isMoreMenuDestination(view, tab, centerTab) {
  if (view === 'hall' || view === 'more') return true
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
  if (itemId === 'markets') return view === 'fplLive' && isBookieHubTab(tab)
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

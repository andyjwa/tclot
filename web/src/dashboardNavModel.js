/**
 * Shared dashboard IA helpers for the main nav + Moves / Predictions grouping.
 *
 * Players lives under Moves (left of Waivers). The mobile More slot opens a
 * popup to Predictions, Bookies, and Heritage. Recap is a Predictions pane,
 * not a sibling FPL Live tab. Bookie remains the betting hub.
 */

/** @typedef {'waivers' | 'trades' | 'tradeTool' | 'draft' | 'players'} MovesTabId */

/** @typedef {'squads' | 'live' | 'recap' | 'predictions' | 'bookie'} FplLiveTabId */

export const MORE_MENU_ITEMS = /** @type {const} */ ([
  { id: 'predictions', label: 'Predictions', view: 'fplLive', tab: 'predictions' },
  { id: 'bookies', label: 'Bookies', view: 'fplLive', tab: 'bookie' },
  { id: 'hall', label: 'Heritage', view: 'hall', tab: null },
])

/** @param {string | null | undefined} view */
export function isMovesDashboardView(view) {
  return view === 'teamSelection' || view === 'players'
}

/** @param {string | null | undefined} tab */
export function isPredictionsLiveTab(tab) {
  return tab === 'predictions' || tab === 'recap'
}

/**
 * Default Predictions pane: weekly Recap between gameweeks, Season otherwise.
 * @param {string | null | undefined} status
 * @returns {'recap' | 'predictions'}
 */
export function predictionsTabForStatus(status) {
  return status === 'idle' ? 'recap' : 'predictions'
}

/**
 * More is selected for Heritage / Settings / the More page, Bookies, and
 * Predictions — unless that Predictions pane is the contextual centre's
 * current destination (Preview / Recap), in which case the centre owns it.
 *
 * @param {string | null | undefined} view
 * @param {string | null | undefined} tab
 * @param {string | null | undefined} centerTab
 */
export function isMoreMenuDestination(view, tab, centerTab) {
  if (view === 'hall' || view === 'settings' || view === 'more') return true
  if (view !== 'fplLive') return false
  if (tab === 'bookie') return true
  return isPredictionsLiveTab(tab) && tab !== centerTab
}

/**
 * @param {string | null | undefined} view
 * @param {string | null | undefined} tab
 * @param {string} itemId
 */
export function isMoreMenuItemActive(view, tab, itemId) {
  if (itemId === 'hall') return view === 'hall'
  if (itemId === 'bookies') return view === 'fplLive' && tab === 'bookie'
  if (itemId === 'predictions') return view === 'fplLive' && isPredictionsLiveTab(tab)
  return false
}

/**
 * Resolve the FPL Live tab a More item should land on.
 * Predictions follows the season phase so idle weeks open Recap.
 *
 * @param {{ id: string, view: string, tab: string | null }} item
 * @param {string | null | undefined} status
 * @returns {{ view: string, tab: string | null }}
 */
export function moreMenuDestination(item, status) {
  if (!item) return { view: 'hall', tab: null }
  if (item.id === 'predictions') {
    return { view: 'fplLive', tab: predictionsTabForStatus(status) }
  }
  return { view: item.view, tab: item.tab ?? null }
}

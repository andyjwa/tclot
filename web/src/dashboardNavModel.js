/**
 * Shared dashboard IA helpers for the main nav + Moves / More grouping.
 *
 * Players lives under Moves (left of Waivers). The mobile More slot opens a
 * popup above the dock: Predictions (the weekly preview or recap, plus the
 * season model), Markets, and Heritage. Markets is the betting desk (Slip
 * and Board). Settings lives on the league-info modal, not in this menu.
 */

/** @typedef {'waivers' | 'trades' | 'tradeTool' | 'draft' | 'players'} MovesTabId */

/** @typedef {'squads' | 'live' | 'recap' | 'predictions' | 'bookie' | 'board'} FplLiveTabId */

export const MORE_MENU_ITEMS = /** @type {const} */ ([
  { id: 'recap', label: 'Predictions', view: 'fplLive', tab: 'recap', icon: 'newspaper' },
  { id: 'markets', label: 'Markets', view: 'fplLive', tab: 'bookie', icon: 'dices' },
  { id: 'hall', label: 'Heritage', view: 'hall', tab: null, icon: 'column' },
])

/** @param {string | null | undefined} view */
export function isMovesDashboardView(view) {
  return view === 'teamSelection' || view === 'players'
}

/** Slip and Board share the Markets hub. Season lives on Predictions. */
export function isBookieHubTab(tab) {
  return tab === 'bookie' || tab === 'board'
}

/**
 * Weekly preview/recap and the season model share the Predictions page.
 * `predictions` is the old Season markets tab; a saved session still opens
 * this page.
 *
 * @param {string | null | undefined} tab
 */
export function isPredictionsTab(tab) {
  return tab === 'recap' || tab === 'predictions'
}

/**
 * Fold removed and relocated tabs onto the page that replaced them.
 * `vibes` and `forecast` left the Live strip; `predictions` left Markets.
 *
 * @param {string | null | undefined} tab
 */
export function canonicalFplLiveTab(tab) {
  if (tab === 'vibes' || tab === 'forecast') return 'live'
  if (tab === 'predictions') return 'recap'
  return tab ?? null
}

/**
 * @param {{ id: string, label: string }} item
 */
export function moreMenuItemLabel(item) {
  return item?.label ?? ''
}

/**
 * More is selected for Heritage, the More page, Markets, and Predictions.
 * The contextual centre is always Scores, so Predictions lives in More.
 *
 * @param {string | null | undefined} view
 * @param {string | null | undefined} tab
 * @param {string | null | undefined} centerTab
 */
export function isMoreMenuDestination(view, tab, centerTab) {
  if (view === 'hall' || view === 'more') return true
  if (view !== 'fplLive') return false
  if (isBookieHubTab(tab)) return true
  return isPredictionsTab(tab) && tab !== centerTab
}

/**
 * @param {string | null | undefined} view
 * @param {string | null | undefined} tab
 * @param {string} itemId
 */
export function isMoreMenuItemActive(view, tab, itemId) {
  if (itemId === 'hall') return view === 'hall'
  if (itemId === 'markets') return view === 'fplLive' && isBookieHubTab(tab)
  if (itemId === 'recap') return view === 'fplLive' && isPredictionsTab(tab)
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

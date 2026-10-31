/**
 * Session navigation for pull-to-refresh.
 *
 * PTR reloads the document (iOS PWA otherwise stays frozen). React state
 * dies with that reload, so the live scorecard would dump back to the
 * landing tab. We keep the open view in sessionStorage and restore it
 * after boot. Hash / archive deep links still win.
 */

import { FIXTURE_CARD_TABS } from './liveFixtureCardTabs.js'

export const TCLOT_VIEW_STORAGE_KEY = 'tclot:session-view'

export const TCLOT_DASHBOARD_VIEWS = new Set([
  'standings',
  'teamSelection',
  'hall',
  'fplLive',
  'players',
  'more',
  'settings',
])

export const TCLOT_FPL_LIVE_TABS = new Set([
  'squads',
  'live',
  'recap',
  'predictions',
  'bookie',
  'board',
])

export const TCLOT_FIXTURE_TABS = new Set(FIXTURE_CARD_TABS.map((t) => t.id))

/**
 * @typedef {{
 *   dashboardView: string | null,
 *   fplLiveTab: string | null,
 *   liveGw: number | null,
 *   fixture: { homeId: number, awayId: number, gameweek: number } | null,
 *   fixtureTab: string | null,
 * }} TclotViewState
 */

/** @returns {TclotViewState} */
export function emptyTclotViewState() {
  return {
    dashboardView: null,
    fplLiveTab: null,
    liveGw: null,
    fixture: null,
    fixtureTab: null,
  }
}

function parseFixture(raw) {
  if (!raw || typeof raw !== 'object') return null
  const homeId = Number(raw.homeId)
  const awayId = Number(raw.awayId)
  const gameweek = Number(raw.gameweek)
  if (!Number.isFinite(homeId) || homeId <= 0) return null
  if (!Number.isFinite(awayId) || awayId <= 0) return null
  if (!Number.isFinite(gameweek) || gameweek < 1 || gameweek > 38) return null
  return { homeId, awayId, gameweek }
}

/**
 * @param {unknown} raw
 * @returns {TclotViewState}
 */
export function parseTclotViewState(raw) {
  const out = emptyTclotViewState()
  if (!raw || typeof raw !== 'object') return out
  const view = raw.dashboardView
  if (typeof view === 'string' && TCLOT_DASHBOARD_VIEWS.has(view)) {
    out.dashboardView = view
  }
  const tab = raw.fplLiveTab
  if (typeof tab === 'string' && TCLOT_FPL_LIVE_TABS.has(tab)) {
    out.fplLiveTab = tab
  }
  const gw = Number(raw.liveGw)
  if (Number.isFinite(gw) && gw >= 1 && gw <= 38) out.liveGw = gw
  out.fixture = parseFixture(raw.fixture)
  const fxTab = raw.fixtureTab
  if (typeof fxTab === 'string' && TCLOT_FIXTURE_TABS.has(fxTab)) {
    out.fixtureTab = fxTab
  }
  return out
}

/** @returns {TclotViewState} */
export function readTclotViewState() {
  if (typeof window === 'undefined') return emptyTclotViewState()
  try {
    const raw = window.sessionStorage.getItem(TCLOT_VIEW_STORAGE_KEY)
    if (!raw) return emptyTclotViewState()
    return parseTclotViewState(JSON.parse(raw))
  } catch {
    return emptyTclotViewState()
  }
}

/**
 * Merge a patch into the stored view. `undefined` fields are left as-is;
 * pass `null` to clear fixture / tab / gw.
 *
 * @param {Partial<TclotViewState>} patch
 */
export function patchTclotViewState(patch) {
  if (typeof window === 'undefined' || !patch || typeof patch !== 'object') return
  const next = { ...readTclotViewState() }
  if ('dashboardView' in patch) {
    const v = patch.dashboardView
    next.dashboardView =
      typeof v === 'string' && TCLOT_DASHBOARD_VIEWS.has(v) ? v : null
  }
  if ('fplLiveTab' in patch) {
    const t = patch.fplLiveTab
    next.fplLiveTab =
      typeof t === 'string' && TCLOT_FPL_LIVE_TABS.has(t) ? t : null
  }
  if ('liveGw' in patch) {
    const gw = Number(patch.liveGw)
    next.liveGw =
      patch.liveGw == null || !Number.isFinite(gw) || gw < 1 || gw > 38
        ? null
        : gw
  }
  if ('fixture' in patch) {
    next.fixture = parseFixture(patch.fixture)
  }
  if ('fixtureTab' in patch) {
    const t = patch.fixtureTab
    next.fixtureTab =
      typeof t === 'string' && TCLOT_FIXTURE_TABS.has(t) ? t : null
  }
  try {
    window.sessionStorage.setItem(TCLOT_VIEW_STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* Safari private mode / quota */
  }
}

/**
 * Index of the stored fixture in a card-fixture list, or null when the
 * week or pairing no longer matches (stale after a GW roll).
 *
 * @param {Array<{ homeId?: number, awayId?: number }>} fixtures
 * @param {{ homeId?: number, awayId?: number, gameweek?: number } | null} fixture
 * @param {number} gameweek
 * @returns {number | null}
 */
export function fixtureIndexFromViewState(fixtures, fixture, gameweek) {
  if (!fixture || !Array.isArray(fixtures) || fixtures.length === 0) return null
  if (Number(fixture.gameweek) !== Number(gameweek)) return null
  const homeId = Number(fixture.homeId)
  const awayId = Number(fixture.awayId)
  const i = fixtures.findIndex(
    (f) => Number(f.homeId) === homeId && Number(f.awayId) === awayId,
  )
  return i >= 0 ? i : null
}

/** @param {string | null | undefined} tabId */
export function fixtureTabIndexFromId(tabId) {
  const i = FIXTURE_CARD_TABS.findIndex((t) => t.id === tabId)
  return i >= 0 ? i : 0
}

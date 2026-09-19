/**
 * Mobile bottom nav — FotMob-style floating Liquid Glass dock.
 *
 * Four tabs in a frosted pill, plus a separate circular Search button:
 *
 *   Table (standings) · Moves (teamSelection) · [CENTER] · More   |  Search
 *
 * The CENTER slot is contextual on the season phase, derived from the
 * shared brand-header status (`deriveBrandHeaderStatus`, passed in as
 * `liveStatus`):
 *
 *   - PRESEASON (status 'pre-season' / 'unknown'): label "Preview" with a
 *     muted mono "GW{next}" chip. Routes to FPL Live landing on the Season
 *     Predictions sub-tab.
 *   - LIVE GW (status 'live' — deadline passed, GW not finished): a solid
 *     green Geist Mono "LIVE" chip with a subtly blinking tick; label
 *     "Live" (accent). Routes to FPL Live landing on Scores.
 *   - GW OVER (status 'idle' — current GW finalized, between GWs): a muted
 *     mono "FT GW{n}" chip, where {n} is `liveStatus.lastFinishedGw` — the
 *     same field the brand header's "GW {n} complete" strip uses. Falls
 *     back to a bare "FT" when the GW number is unavailable. No pulse;
 *     label "Recap". Routes to FPL Live on the weekly Recap pane inside
 *     Predictions.
 *
 * Players lives under Moves (left of Waivers). More opens a popup above
 * the dock with Recap or Preview (by gameweek), Bookies, Predictions,
 * Heritage, and Settings.
 *
 * Visuals are scoped to the `.mobile-tab-bar` class prefix (see
 * `MobileBottomNav.css`). Desktop (≥1081px) hides the whole thing and uses
 * the top `<DashboardNav variant="top" />`.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { NavIcon } from './NavIcon'
import { requestOpenGlobalSearch } from './GlobalSearch.jsx'
import { useDismissOnOutsidePointer } from './useDismissOnOutsidePointer.js'
import {
  MORE_MENU_ITEMS,
  isMoreMenuDestination,
  isMoreMenuItemActive,
  isMovesDashboardView,
  moreMenuDestination,
  moreMenuItemLabel,
} from './dashboardNavModel.js'
import './MobileBottomNav.css'

/**
 * Collapse the shared brand-header status into the three nav centre states.
 * `'pre-season'` and `'unknown'` (and any missing status) fall back to the
 * Live tab so fixtures are reachable before the first kickoff.
 *
 * @param {'live' | 'idle' | 'pre-season' | 'unknown' | undefined | null} status
 * @returns {'pre' | 'live' | 'over'}
 */
function gwStateFromStatus(status) {
  if (status === 'live') return 'live'
  if (status === 'idle') return 'over'
  return 'pre'
}

const TABS = [
  { id: /** @type {const} */ ('standings'),     label: 'Table', icon: /** @type {const} */ ('bar-chart-3') },
  { id: /** @type {const} */ ('teamSelection'), label: 'Moves', icon: /** @type {const} */ ('users') },
]

/** Per-phase copy + routing for the contextual centre slot. `tab` is the
 * FPL Live sub-tab the button lands on: Scores mid-GW, the weekly Recap
 * between GWs, and Season Predictions before the campaign starts. */
const CENTER_BY_STATE = {
  pre:  { label: 'Preview', view: /** @type {const} */ ('fplLive'), tab: 'predictions', aria: 'Season predictions' },
  live: { label: 'Live',    view: /** @type {const} */ ('fplLive'), tab: 'live',        aria: 'FPL Live scores' },
  over: { label: 'Recap',   view: /** @type {const} */ ('fplLive'), tab: 'recap',     aria: 'Weekly recap' },
}

/**
 * @param {{
 *   dashboardView: string,
 *   fplLiveTab?: string | null,
 *   onSelect: (id: string) => void,
 *   onCenterSelect?: (view: string, tab: string) => void,
 *   liveStatus?: { status?: 'live' | 'idle' | 'pre-season' | 'unknown' } | null,
 *   navLocked?: boolean,
 * }} props
 */
export function MobileBottomNav({
  dashboardView,
  fplLiveTab = null,
  onSelect,
  onCenterSelect,
  liveStatus,
  navLocked = false,
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreBtnRef = useRef(null)
  const moreMenuRef = useRef(null)
  const closeMore = useCallback(() => setMoreOpen(false), [])
  useDismissOnOutsidePointer(moreMenuRef, moreOpen, closeMore, (target) =>
    Boolean(moreBtnRef.current?.contains(target)),
  )
  useEffect(() => {
    if (!moreOpen) return undefined
    const onKey = (ev) => {
      if (ev.key === 'Escape') setMoreOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moreOpen])

  const gwState = gwStateFromStatus(liveStatus?.status)
  const center = CENTER_BY_STATE[gwState]
  const centerActive =
    dashboardView === center.view &&
    (fplLiveTab == null ||
      fplLiveTab === center.tab ||
      (center.tab === 'live' && fplLiveTab === 'squads'))
  const moreActive =
    isMoreMenuDestination(dashboardView, fplLiveTab, center.tab)

  /** Completed-GW number for the FT chip. Sourced from the same
   * `deriveBrandHeaderStatus` result that renders "GW {n} complete" in the
   * brand header, so the two never disagree. Null → bare "FT" chip. */
  const ftGw = Number.isFinite(Number(liveStatus?.lastFinishedGw))
    ? Number(liveStatus.lastFinishedGw)
    : null

  if (navLocked) {
    return (
      <nav
        className="mobile-tab-bar mobile-tab-bar--pre-draft"
        aria-label="App navigation"
        data-gwstate="pre"
      >
        <div className="mobile-tab-bar__dock">
          <div className="mobile-tab-bar__pill">
            <button
              type="button"
              className={
                'mobile-tab-bar__btn' + (dashboardView === 'teamSelection' ? ' is-active' : '')
              }
              onClick={() => onSelect('teamSelection')}
              aria-current={dashboardView === 'teamSelection' ? 'page' : undefined}
              aria-label="Draft board"
            >
              <span className="mobile-tab-bar__ico" aria-hidden>
                <NavIcon name="users" size={22} />
              </span>
              <span className="mobile-tab-bar__label">Draft</span>
            </button>
            <button
              type="button"
              className={
                'mobile-tab-bar__btn' + (dashboardView === 'hall' ? ' is-active' : '')
              }
              onClick={() => onSelect('hall')}
              aria-current={dashboardView === 'hall' ? 'page' : undefined}
              aria-label="TCLOT Heritage"
            >
              <span className="mobile-tab-bar__ico" aria-hidden>
                <NavIcon name="column" size={22} />
              </span>
              <span className="mobile-tab-bar__label">Heritage</span>
            </button>
          </div>
          <SearchButton />
        </div>
      </nav>
    )
  }

  return (
    <nav className="mobile-tab-bar" aria-label="App navigation" data-gwstate={gwState}>
      <div className="mobile-tab-bar__dock">
        <div className="mobile-tab-bar__pill">
          {moreOpen ? (
            <MoreMenu
              menuRef={moreMenuRef}
              dashboardView={dashboardView}
              fplLiveTab={fplLiveTab}
              liveStatus={liveStatus}
              onNavigate={(view, tab) => {
                setMoreOpen(false)
                if (tab && onCenterSelect) onCenterSelect(view, tab)
                else onSelect(view)
              }}
            />
          ) : null}
          {TABS.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              active={
                tab.id === 'teamSelection'
                  ? isMovesDashboardView(dashboardView)
                  : dashboardView === tab.id
              }
              onSelect={onSelect}
            />
          ))}

          <div className="mobile-tab-bar__center">
            <button
              type="button"
              className={
                'mobile-tab-bar__fab' + (centerActive ? ' is-active' : '')
              }
              onClick={() =>
                onCenterSelect
                  ? onCenterSelect(center.view, center.tab)
                  : onSelect(center.view)
              }
              aria-current={centerActive ? 'page' : undefined}
              aria-label={center.aria}
            >
              {gwState === 'pre' ? (
                <span
                  className="mobile-tab-bar__chip mobile-tab-bar__chip--ft"
                  aria-hidden
                >
                  {Number.isFinite(Number(liveStatus?.nextGw)) &&
                  Number(liveStatus.nextGw) >= 1
                    ? `GW${Number(liveStatus.nextGw)}`
                    : '26/27'}
                </span>
              ) : gwState === 'live' ? (
                <span
                  className="mobile-tab-bar__chip mobile-tab-bar__chip--live"
                  aria-hidden
                >
                  <i className="mobile-tab-bar__chip-tick" />
                  LIVE
                </span>
              ) : (
                <span
                  className="mobile-tab-bar__chip mobile-tab-bar__chip--ft"
                  aria-hidden
                >
                  {ftGw != null ? `FT GW${ftGw}` : 'FT'}
                </span>
              )}
            </button>
            <span className="mobile-tab-bar__label">{center.label}</span>
          </div>

          <MoreButton
            buttonRef={moreBtnRef}
            active={moreActive}
            open={moreOpen}
            onToggle={() => setMoreOpen((v) => !v)}
          />
        </div>
        <SearchButton />
      </div>
    </nav>
  )
}

/**
 * @param {{
 *   buttonRef: import('react').RefObject<HTMLButtonElement | null>,
 *   active: boolean,
 *   open: boolean,
 *   onToggle: () => void,
 * }} props
 */
function MoreButton({ buttonRef, active, open, onToggle }) {
  return (
    <div className="mobile-tab-bar__more">
      <button
        ref={buttonRef}
        type="button"
        className={
          'mobile-tab-bar__btn' + (active || open ? ' is-active' : '')
        }
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="mobile-more-menu"
        aria-label="More"
      >
        <span className="mobile-tab-bar__ico" aria-hidden>
          <NavIcon name="more" size={22} />
        </span>
        <span className="mobile-tab-bar__label">More</span>
      </button>
    </div>
  )
}

/**
 * Solid sheet above the dock — same tokens as site popovers (`--surface`,
 * `--border`, line icons). Full pill width so it lines up with the bar.
 *
 * @param {{
 *   menuRef: import('react').RefObject<HTMLDivElement | null>,
 *   dashboardView: string,
 *   fplLiveTab?: string | null,
 *   liveStatus?: { status?: string } | null,
 *   onNavigate: (view: string, tab: string | null) => void,
 * }} props
 */
function MoreMenu({ menuRef, dashboardView, fplLiveTab, liveStatus, onNavigate }) {
  return (
    <div
      id="mobile-more-menu"
      ref={menuRef}
      className="mobile-tab-bar__more-menu"
      role="menu"
      aria-label="More"
    >
      {MORE_MENU_ITEMS.map((item) => {
        const dest = moreMenuDestination(item)
        const itemActive = isMoreMenuItemActive(
          dashboardView,
          fplLiveTab,
          item.id,
        )
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            className={
              'mobile-tab-bar__more-item' +
              (itemActive ? ' is-active' : '')
            }
            onClick={() => onNavigate(dest.view, dest.tab)}
          >
            <span className="mobile-tab-bar__more-ico" aria-hidden>
              <NavIcon name={item.icon} size={20} />
            </span>
            <span className="mobile-tab-bar__more-label">
              {moreMenuItemLabel(item, liveStatus?.status)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function SearchButton() {
  return (
    <button
      type="button"
      className="mobile-tab-bar__search"
      onClick={requestOpenGlobalSearch}
      aria-label="Search players and managers"
      title="Search players & managers"
    >
      <span className="mobile-tab-bar__ico" aria-hidden>
        <NavIcon name="search" size={22} />
      </span>
      <span className="mobile-tab-bar__label">Search</span>
    </button>
  )
}

/**
 * @param {{
 *   tab: { id: string, label: string, icon: 'bar-chart-3' | 'users' },
 *   active: boolean,
 *   onSelect: (id: string) => void,
 * }} props
 */
function TabButton({ tab, active, onSelect }) {
  return (
    <button
      type="button"
      className={'mobile-tab-bar__btn' + (active ? ' is-active' : '')}
      onClick={() => onSelect(tab.id)}
      aria-current={active ? 'page' : undefined}
      aria-label={tab.label}
    >
      <span className="mobile-tab-bar__ico" aria-hidden>
        <NavIcon name={tab.icon} size={22} />
      </span>
      <span className="mobile-tab-bar__label">{tab.label}</span>
    </button>
  )
}

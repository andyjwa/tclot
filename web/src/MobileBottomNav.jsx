/**
 * Mobile bottom nav — persistent tab bar (design option 5e).
 *
 * Replaces the previous corner FAB "speed dial" on mobile (≤1080px) with a
 * frosted, full-width tab bar pinned to the bottom edge. Five slots, in order:
 *
 *   Table (standings) · Moves (teamSelection) · [CENTER] · Players · More
 *
 * The CENTER slot is an inline circle (never raised — nothing pokes above the
 * bar) and is the "what matters now" hero. It is contextual on the season
 * phase, derived from the shared brand-header status (`deriveBrandHeaderStatus`,
 * passed in as `liveStatus`):
 *
 *   - PRESEASON (status 'pre-season' / 'unknown'): a "26/27" skin — film/clapper
 *     icon + label "26/27", NO purple, in line with the other tabs. Routes to
 *     the Preseason hub (`dashboardView 'preseason'`).
 *   - LIVE GW (status 'live' — deadline passed, GW not finished): a solid
 *     green Geist Mono "LIVE" chip with a subtly blinking tick (option D of
 *     the scorestab mockup sheet); label "Live" (accent). Routes to FPL Live
 *     (`dashboardView 'fplLive'`).
 *   - GW OVER (status 'idle' — current GW finalized, between GWs): a muted
 *     mono "FT GW{n}" chip (option E of the sheet), where {n} is
 *     `liveStatus.lastFinishedGw` — the same field the brand header's
 *     "GW {n} complete" strip uses. Falls back to a bare "FT" when the GW
 *     number is unavailable. No pulse; label "Scores" (muted). Routes to FPL
 *     Live (`dashboardView 'fplLive'`).
 *
 * Heritage ('hall') and Settings ('settings') live behind More (the existing
 * `'more'` dashboardView page / DashboardMorePanel).
 *
 * Visuals are scoped to the `.mobile-tab-bar` class prefix (see
 * `MobileBottomNav.css`). Desktop (≥1081px) hides the whole thing and uses the
 * top `<DashboardNav variant="top" />`.
 */

import { NavIcon } from './NavIcon'
import './MobileBottomNav.css'

/**
 * Collapse the shared brand-header status into the three nav centre states.
 * `'pre-season'` and `'unknown'` (and any missing status) fall back to the
 * preseason "26/27" skin so the bar always has a sensible centre.
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
  { id: /** @type {const} */ ('standings'),     label: 'Table',   icon: /** @type {const} */ ('bar-chart-3') },
  { id: /** @type {const} */ ('teamSelection'), label: 'Moves',   icon: /** @type {const} */ ('users') },
  { id: /** @type {const} */ ('players'),       label: 'Players', icon: /** @type {const} */ ('shuffle') },
]

/** Per-phase copy + routing for the contextual centre slot. */
const CENTER_BY_STATE = {
  pre:  { label: '26/27',  view: /** @type {const} */ ('preseason'), aria: '26/27 season hub' },
  live: { label: 'Live',   view: /** @type {const} */ ('fplLive'),   aria: 'FPL Live' },
  over: { label: 'Scores', view: /** @type {const} */ ('fplLive'),   aria: 'FPL Live scores' },
}

/**
 * @param {{
 *   dashboardView: string,
 *   onSelect: (id: string) => void,
 *   liveStatus?: { status?: 'live' | 'idle' | 'pre-season' | 'unknown' } | null,
 *   navLocked?: boolean,
 * }} props
 */
export function MobileBottomNav({ dashboardView, onSelect, liveStatus, navLocked = false }) {
  const gwState = gwStateFromStatus(liveStatus?.status)
  const center = CENTER_BY_STATE[gwState]
  const centerActive = dashboardView === center.view

  /** Completed-GW number for the FT chip. Sourced from the same
   * `deriveBrandHeaderStatus` result that renders "GW {n} complete" in the
   * brand header, so the two never disagree. Null → bare "FT" chip. */
  const ftGw = Number.isFinite(Number(liveStatus?.lastFinishedGw))
    ? Number(liveStatus.lastFinishedGw)
    : null

  // "More" stays lit while the user is on any destination reached through it
  // (the More page itself, Heritage, or Settings).
  const moreActive =
    dashboardView === 'more' ||
    dashboardView === 'hall' ||
    dashboardView === 'settings'

  if (navLocked) {
    return (
      <nav
        className="mobile-tab-bar mobile-tab-bar--pre-draft"
        aria-label="App navigation"
        data-gwstate="pre"
      >
        <div className="mobile-tab-bar__row">
          <button
            type="button"
            className={
              'mobile-tab-bar__btn' + (dashboardView === 'preseason' ? ' is-active' : '')
            }
            onClick={() => onSelect('preseason')}
            aria-current={dashboardView === 'preseason' ? 'page' : undefined}
            aria-label="26/27 season hub"
          >
            <span className="mobile-tab-bar__ico" aria-hidden>
              <NavIcon name="film" size={22} />
            </span>
            <span className="mobile-tab-bar__label">26/27</span>
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
      </nav>
    )
  }

  return (
    <nav className="mobile-tab-bar" aria-label="App navigation" data-gwstate={gwState}>
      <div className="mobile-tab-bar__row">
        {TABS.slice(0, 2).map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            active={dashboardView === tab.id}
            onSelect={onSelect}
          />
        ))}

        <div className="mobile-tab-bar__center">
          <button
            type="button"
            className={
              'mobile-tab-bar__fab' + (centerActive ? ' is-active' : '')
            }
            onClick={() => onSelect(center.view)}
            aria-current={centerActive ? 'page' : undefined}
            aria-label={center.aria}
          >
            {gwState === 'pre' ? (
              <span className="mobile-tab-bar__preicon" aria-hidden>
                <NavIcon name="film" size={20} />
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

        <TabButton
          tab={TABS[2]}
          active={dashboardView === TABS[2].id}
          onSelect={onSelect}
        />

        <button
          type="button"
          className={'mobile-tab-bar__btn' + (moreActive ? ' is-active' : '')}
          onClick={() => onSelect('more')}
          aria-current={moreActive ? 'page' : undefined}
          aria-label="More"
        >
          <span className="mobile-tab-bar__ico" aria-hidden>
            <NavIcon name="more" size={22} />
          </span>
          <span className="mobile-tab-bar__label">More</span>
        </button>
      </div>
    </nav>
  )
}

/**
 * @param {{
 *   tab: { id: string, label: string, icon: 'bar-chart-3' | 'users' | 'shuffle' },
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

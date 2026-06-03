/**
 * Mobile bottom nav — Variant 3 (stacked icon + label, glass pill).
 *
 * Replaces `<DashboardNav variant="bottom" />` on mobile. Design spec lives in
 * `Mockup.jsx` under `WordsGlassNavShowcase` / Variant 3, and the matching
 * `.mockup-wgn--stacked-glass` CSS in `Mockup.css`. This component carries
 * that visual into production, scoped to a unique class prefix
 * (`.glass-bottom-nav`) so it does not collide with the existing
 * `.dashboard-nav--bottom` rules in App.css.
 *
 * Order (left → right): 26/27 · Heritage · Players · More. The remaining
 * top-level tabs (Live, Standings, Moves, Settings) are accessible from
 * the More panel rather than directly from the bottom nav — the goal is
 * to give the preseason hub the lead spot ahead of the 26/27 season,
 * keep the historical archive (Heritage) prominent, and surface the
 * Players wire as a one-tap destination, while keeping the full sitemap
 * one tap away through More.
 *
 * Auto-hide on scroll piggybacks off the existing
 * `data-bottom-nav-hidden="true"` attribute set on the outer `.app.fotmob`
 * element (driven by `useAutoHideBottomNav` in App.jsx) — no rewiring needed.
 */

import { NavIcon } from './NavIcon'
import './MobileBottomNav.css'

const NAV_ITEMS = [
  { id: /** @type {const} */ ('preseason'), label: '26/27',    icon: /** @type {const} */ ('pulsing-dot'), pulse: true },
  { id: /** @type {const} */ ('hall'),      label: 'Heritage', icon: /** @type {const} */ ('column') },
  { id: /** @type {const} */ ('players'),   label: 'Players',  icon: /** @type {const} */ ('shuffle') },
  { id: /** @type {const} */ ('more'),      label: 'More',     icon: /** @type {const} */ ('more') },
]

/**
 * @param {{
 *   dashboardView: string,
 *   onSelect: (id: string) => void,
 * }} props
 */
export function MobileBottomNav({ dashboardView, onSelect }) {
  return (
    <nav
      className="glass-bottom-nav"
      aria-label="App navigation"
    >
      {NAV_ITEMS.map((item) => {
        // The "More" pill should also light up while the user is on any of
        // the demoted sub-pages reached through it (Live, Standings, Moves,
        // Settings). Players has its own slot now, so it's no longer part
        // of the More carve-out.
        const active =
          item.id === 'more'
            ? dashboardView === 'more' ||
              dashboardView === 'settings' ||
              dashboardView === 'fplLive' ||
              dashboardView === 'standings' ||
              dashboardView === 'teamSelection'
            : dashboardView === item.id
        const iconClass =
          'glass-bottom-nav__icon' +
          (item.pulse ? ' glass-bottom-nav__icon--pulse' : '')
        return (
          <button
            key={item.id}
            type="button"
            className={
              'glass-bottom-nav__item' + (active ? ' is-active' : '')
            }
            onClick={() => onSelect(item.id)}
            aria-current={active ? 'page' : undefined}
            aria-label={item.label}
            title={item.label}
          >
            <span className="glass-bottom-nav__icon-wrap" aria-hidden>
              <NavIcon name={item.icon} size={22} className={iconClass} />
            </span>
            <span className="glass-bottom-nav__label">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

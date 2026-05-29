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
 * Order (left → right): Live · Standings · Moves · Players · Heritage.
 * `More` is intentionally dropped — Settings is reachable via the new
 * League Info modal (BrandHeaderWordmark + LeagueInfoModal). The set is kept
 * in sync with the bottom-nav item list in `DashboardNav.jsx` minus the
 * `more` entry; the desktop top nav still goes through DashboardNav.
 *
 * Auto-hide on scroll piggybacks off the existing
 * `data-bottom-nav-hidden="true"` attribute set on the outer `.app.fotmob`
 * element (driven by `useAutoHideBottomNav` in App.jsx) — no rewiring needed.
 */

import { NavIcon } from './NavIcon'
import './MobileBottomNav.css'

const NAV_ITEMS = [
  { id: /** @type {const} */ ('fplLive'),       label: 'Live',         icon: /** @type {const} */ ('pulsing-dot'), pulse: true },
  { id: /** @type {const} */ ('standings'),     label: 'Standings',    icon: /** @type {const} */ ('bar-chart-3') },
  { id: /** @type {const} */ ('teamSelection'), label: 'Moves',        icon: /** @type {const} */ ('users') },
  { id: /** @type {const} */ ('players'),       label: 'Players',      icon: /** @type {const} */ ('shuffle') },
  { id: /** @type {const} */ ('hall'),          label: 'Heritage',     icon: /** @type {const} */ ('column') },
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
        const active = dashboardView === item.id
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

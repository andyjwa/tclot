/**
 * Mobile bottom nav — expanding FAB ("speed dial").
 *
 * Replaces `<DashboardNav variant="bottom" />` on mobile (≤1080px). Instead of
 * a full-width floating pill that auto-hides on scroll, this renders a single
 * circular trigger anchored bottom-right. Tapping it fans the menu items
 * upward as a vertical stack of glass pills; the trigger morphs from a
 * hamburger into an X. The trigger itself never disappears — only the fanned
 * items collapse, which happens on: outside tap, Escape, scroll, or selecting
 * a destination.
 *
 * Order (top → bottom of the fan): 26/27 · Heritage · Players · More. The
 * remaining top-level tabs (Live, Standings, Moves, Settings) live behind the
 * More panel, as before.
 *
 * Visuals are scoped to the `.glass-bottom-nav` class prefix (see
 * `MobileBottomNav.css`) so they do not collide with the legacy
 * `.dashboard-nav--bottom` rules in App.css. Desktop (≥1081px) hides the whole
 * thing and uses the top `<DashboardNav variant="top" />`.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { NavIcon } from './NavIcon'
import { useDismissOnOutsidePointer } from './useDismissOnOutsidePointer'
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
  const [expanded, setExpanded] = useState(false)
  const rootRef = useRef(/** @type {HTMLElement | null} */ (null))

  const collapse = useCallback(() => setExpanded(false), [])

  // Tap anywhere outside the FAB closes the fan (deferred so the opening tap
  // does not immediately dismiss it — handled inside the hook).
  useDismissOnOutsidePointer(rootRef, expanded, collapse)

  // Collapse the fan as soon as the user scrolls — the trigger stays put, so
  // the menu tucks away without the whole nav disappearing.
  useEffect(() => {
    if (!expanded) return undefined
    const onScroll = () => setExpanded(false)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [expanded])

  // Escape closes the fan (keyboard / external keyboard users).
  useEffect(() => {
    if (!expanded) return undefined
    const onKey = (/** @type {KeyboardEvent} */ ev) => {
      if (ev.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded])

  const handleSelect = (/** @type {string} */ id) => {
    setExpanded(false)
    onSelect(id)
  }

  return (
    <nav
      ref={rootRef}
      className="glass-bottom-nav"
      data-expanded={expanded ? 'true' : undefined}
      aria-label="App navigation"
    >
      <div
        className="glass-bottom-nav__items"
        role="menu"
        aria-hidden={expanded ? undefined : true}
      >
        {NAV_ITEMS.map((item) => {
          // "More" stays lit while the user is on any of the demoted sub-pages
          // reached through it (Live, Standings, Moves, Settings).
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
              role="menuitem"
              tabIndex={expanded ? 0 : -1}
              className={
                'glass-bottom-nav__item' + (active ? ' is-active' : '')
              }
              onClick={() => handleSelect(item.id)}
              aria-current={active ? 'page' : undefined}
            >
              <span className="glass-bottom-nav__label">{item.label}</span>
              <span className="glass-bottom-nav__icon-wrap" aria-hidden>
                <NavIcon name={item.icon} size={20} className={iconClass} />
              </span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        className="glass-bottom-nav__trigger"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-haspopup="menu"
        aria-label={expanded ? 'Close menu' : 'Open menu'}
      >
        <NavIcon
          name={expanded ? 'close' : 'menu'}
          size={24}
          className="glass-bottom-nav__trigger-icon"
        />
      </button>
    </nav>
  )
}

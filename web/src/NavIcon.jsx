/**
 * NavIcon — monochrome Lucide-style line icons for the main DashboardNav.
 *
 * SVG paths are duplicated from Mockup.jsx's `LucideIcon` rather than imported
 * because Mockup.jsx is a temporary design spec slated for removal after
 * Phase 2 lands. Eight cases cover the live nav set:
 *
 *   - pulsing-dot  : FPL Live (filled #16a34a circle, no stroke; animated by CSS)
 *   - bar-chart-3  : Standings
 *   - users        : Moves (formerly "Team Selection" / "Transactions")
 *   - shuffle      : Players
 *   - column       : TCLOT Heritage (Doric Greek column — Titans-mythology nod)
 *   - trophy       : retained for backwards compatibility (Mockup spec only;
 *                    no longer wired into the live nav as of TCLOT Heritage
 *                    rename — the heritage tab now uses `column`)
 *   - more         : More menu (three horizontal dots)
 *   - settings     : Settings gear (desktop-only entry on right edge of nav)
 *   - menu         : Hamburger (three lines) — collapsed trigger for the mobile FAB nav
 *   - close        : X — expanded-state trigger for the mobile FAB nav
 *   - film         : Clapperboard/film strip — the "26/27" preseason hub, used by
 *                    the contextual centre slot in the mobile bottom tab bar
 *
 * Stroke color is `currentColor` so the icon inherits CSS color from its
 * surrounding button (active vs. idle). pulsing-dot is the lone exception:
 * its green fill carries meaning and is not theme-dependent.
 */

/**
 * @param {{
 *   name: 'pulsing-dot' | 'bar-chart-3' | 'users' | 'shuffle' | 'column' | 'trophy' | 'more' | 'settings' | 'menu' | 'close' | 'film',
 *   className?: string,
 *   size?: number,
 * }} props
 */
export function NavIcon({ name, className, size = 20 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: false,
    className,
  }
  switch (name) {
    case 'pulsing-dot':
      // The dot's green carries meaning ("Live") while idle. When the FPL
      // Live tab is *active*, the button's selection state (brand purple
      // text colour + tinted pill) clashed with the green fill, leaving a
      // green dot on a purple background. We expose the fill via a CSS
      // custom property (default #16a34a) so `.dashboard-nav__btn--active
      // .dashboard-nav__icon--pulse` in App.css can override it to brand
      // purple — keeping the selected-tab indicator visually consistent
      // with the other nav icons.
      return (
        <svg {...common}>
          <g className="nav-icon__pulse-target">
            <circle
              cx="12"
              cy="12"
              r="5"
              style={{ fill: 'var(--nav-pulse-dot-fill, #16a34a)' }}
              stroke="none"
            />
          </g>
        </svg>
      )
    case 'bar-chart-3':
      return (
        <svg {...common}>
          <path d="M3 3v18h18" />
          <path d="M18 17V9" />
          <path d="M13 17V5" />
          <path d="M8 17v-3" />
        </svg>
      )
    case 'users':
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    case 'shuffle':
      return (
        <svg {...common}>
          <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22" />
          <path d="m18 2 4 4-4 4" />
          <path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2" />
          <path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8" />
          <path d="m18 14 4 4-4 4" />
        </svg>
      )
    case 'trophy':
      return (
        <svg {...common}>
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>
      )
    case 'column':
      // Doric Greek column. Mobile bottom nav renders this at 22px, and the
      // earlier version (capital 16 wide, shaft 14 wide) was too subtle to
      // read as a column. Capital and base now extend a full 18 units
      // (x=3→21), 4 wider than the shaft (x=5→19), giving an obvious
      // overhang on each side. Three flutes at x = 8 / 12 / 16 run the
      // full shaft height.
      return (
        <svg {...common}>
          <path d="M3 4h18" />
          <path d="M5 7h14" />
          <path d="M8 7v10" />
          <path d="M12 7v10" />
          <path d="M16 7v10" />
          <path d="M5 17h14" />
          <path d="M3 20h18" />
        </svg>
      )
    case 'more':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
          <circle cx="5" cy="12" r="1" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    case 'menu':
      return (
        <svg {...common}>
          <path d="M3 6h18" />
          <path d="M3 12h18" />
          <path d="M3 18h18" />
        </svg>
      )
    case 'close':
      return (
        <svg {...common}>
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      )
    case 'film':
      // Clapperboard / film-strip outline (Lucide-style). Paths mirror the
      // `i-film` symbol in the mobile-nav mockup so the shipped 26/27 centre
      // slot matches the approved design.
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M7 4v16" />
          <path d="M17 4v16" />
          <path d="M3 9h4" />
          <path d="M17 9h4" />
          <path d="M3 15h4" />
          <path d="M17 15h4" />
        </svg>
      )
    default:
      return null
  }
}

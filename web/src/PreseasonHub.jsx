import { SeasonOpenerSplash } from './SeasonOpenerSplash.jsx'
import { EndOfSeasonSplash } from './EndOfSeasonSplash.jsx'
import { LeagueRing } from './LeagueRing.jsx'
import './PreseasonHub.css'

/**
 * 26/27 preseason hub — a top-level dashboard view that hosts the
 * league centerpiece (LeagueRing) plus both TCLOT cinematics
 * (Season Opener + End of Season). The cinematics previously lived
 * under FPL Live → Vibes; that sub-tab has been removed and this
 * page is now their permanent home.
 */
export function PreseasonHub() {
  return (
    <section className="preseason-hub" aria-label="Season 26/27 preseason hub">
      <LeagueRing />

      <div className="preseason-hub__cinematics">
        <SeasonOpenerSplash />
        <EndOfSeasonSplash />
      </div>

      <footer className="preseason-hub__footer">
        <p>Tap a cinematic to play. Both rewatch on replay.</p>
      </footer>
    </section>
  )
}

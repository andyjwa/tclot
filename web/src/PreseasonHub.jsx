import { useEffect, useState } from 'react'
import { SeasonOpenerSplash } from './SeasonOpenerSplash.jsx'
import { EndOfSeasonSplash } from './EndOfSeasonSplash.jsx'
import './PreseasonHub.css'

/**
 * Placeholder Premier League 26/27 kickoff (UTC). Update this constant once
 * the real fixture release lands — easiest path is to copy the kickoff
 * timestamp of the official PL opener into this Date literal. The countdown
 * below reads the target every second from the `now` state's tick, so the
 * change picks up on next render after deploy. Times are stored in UTC to
 * sidestep DST / locale ambiguity; the visible countdown is locale-agnostic
 * (Days/Hours/Minutes/Seconds derived from the raw delta in ms).
 */
const SEASON_START = new Date('2026-08-15T11:30:00Z')

const HERO_NOTE =
  'Episode 1 — Lord of the Rings. The path has been chosen. The season is almost upon us.'

/**
 * Split a positive ms delta into days/hours/minutes/seconds. Returns all
 * zeroes once the delta is non-positive so the caller can render the
 * "Season is live!" copy without doing the math itself.
 */
function diffToCountdown(targetMs, nowMs) {
  const delta = targetMs - nowMs
  if (delta <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isLive: true }
  }
  const seconds = Math.floor(delta / 1000) % 60
  const minutes = Math.floor(delta / (1000 * 60)) % 60
  const hours = Math.floor(delta / (1000 * 60 * 60)) % 24
  const days = Math.floor(delta / (1000 * 60 * 60 * 24))
  return { days, hours, minutes, seconds, isLive: false }
}

function CountdownCell({ value, label }) {
  return (
    <div className="preseason-hub__count-cell">
      <span className="preseason-hub__count-value">{value}</span>
      <span className="preseason-hub__count-label">{label}</span>
    </div>
  )
}

function PreseasonCountdown() {
  const [now, setNow] = useState(() => Date.now())
  const targetMs = SEASON_START.getTime()

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const { days, hours, minutes, seconds, isLive } = diffToCountdown(targetMs, now)

  if (isLive) {
    return (
      <div className="preseason-hub__countdown preseason-hub__countdown--live">
        <span className="preseason-hub__live-flag">Season is live!</span>
      </div>
    )
  }

  return (
    <div
      className="preseason-hub__countdown"
      role="timer"
      aria-live="off"
      aria-label={`Countdown to season 26/27: ${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds`}
    >
      <CountdownCell value={days} label="Days" />
      <CountdownCell value={String(hours).padStart(2, '0')} label="Hours" />
      <CountdownCell value={String(minutes).padStart(2, '0')} label="Minutes" />
      <CountdownCell value={String(seconds).padStart(2, '0')} label="Seconds" />
    </div>
  )
}

/**
 * 26/27 preseason hub — a new top-level dashboard view that hosts the
 * countdown to the upcoming Premier League season plus both TCLOT
 * cinematics (Season Opener + End of Season). The cinematics previously
 * lived under FPL Live → Vibes; that sub-tab has been removed and this
 * page is now their permanent home.
 */
export function PreseasonHub() {
  return (
    <section className="preseason-hub" aria-label="Season 26/27 preseason hub">
      <header className="preseason-hub__hero">
        <h1 className="preseason-hub__title">Season 26/27</h1>
        <p className="preseason-hub__note">{HERO_NOTE}</p>
      </header>

      <PreseasonCountdown />

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

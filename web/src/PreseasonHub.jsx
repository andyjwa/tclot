import { useEffect, useState } from 'react'
import { LeagueRing } from './LeagueRing.jsx'
import './PreseasonHub.css'

/**
 * 26/27 draft-return target. 9am Eastern (EDT, UTC-4 in mid-August
 * because Eastern observes DST through early November) on Monday
 * 17 August 2026 — the locked TCLOT draft-return slot.
 *
 * The offset here is EDT (UTC-4). If the target slips to a
 * post-DST date in future seasons, swap to `-05:00`.
 */
const SEASON_KICKOFF_MS = new Date('2026-08-17T09:00:00-04:00').getTime()

/**
 * Days/hours/minutes between two ms timestamps. Returns zeroes +
 * `isLive: true` once the target has passed so the caller can swap
 * to a "TCLOT is live" treatment without re-doing the math.
 */
function diffToCountdown(targetMs, nowMs) {
  const delta = targetMs - nowMs
  if (delta <= 0) {
    return { days: 0, hours: 0, minutes: 0, isLive: true }
  }
  const minutes = Math.floor(delta / (1000 * 60)) % 60
  const hours = Math.floor(delta / (1000 * 60 * 60)) % 24
  const days = Math.floor(delta / (1000 * 60 * 60 * 24))
  return { days, hours, minutes, isLive: false }
}

/**
 * Countdown plate that sits above the LotR header image. Three
 * value cells (days · hours · minutes) flanked by vertical gold
 * dividers — designed to feel like part of the parchment instead of
 * a chrome card; the panel is faintly darker than the page so the
 * gold numbers have something to push against, but the texture and
 * tone family are continuous with the rest of the hub.
 */
function PreseasonCountdown() {
  // Tick once a minute is enough — the smallest unit displayed is
  // minutes, so a 1s interval would burn battery for nothing on
  // mobile. We still seed `now` immediately so the first paint is
  // accurate; subsequent updates flip whenever the minute rolls.
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    // Align the first tick to the next wall-clock minute boundary so
    // the visible minutes value flips exactly when it should.
    const ms = Date.now()
    const msUntilNextMinute = 60_000 - (ms % 60_000)
    let intervalId = null
    const timeoutId = window.setTimeout(() => {
      setNow(Date.now())
      intervalId = window.setInterval(() => setNow(Date.now()), 60_000)
    }, msUntilNextMinute + 50)
    return () => {
      window.clearTimeout(timeoutId)
      if (intervalId != null) window.clearInterval(intervalId)
    }
  }, [])

  const { days, hours, minutes, isLive } = diffToCountdown(
    SEASON_KICKOFF_MS,
    now
  )

  if (isLive) {
    return (
      <div
        className="preseason-countdown preseason-countdown--live"
        role="status"
      >
        <span className="preseason-countdown__live">TCLOT is live</span>
      </div>
    )
  }

  return (
    <div
      className="preseason-countdown"
      role="timer"
      aria-live="off"
      aria-label={`TCLOT returns to draft in ${days} days, ${hours} hours, ${minutes} minutes`}
    >
      <div className="preseason-countdown__label">TCLOT returns to draft in</div>
      <div className="preseason-countdown__display">
        <div className="preseason-countdown__cell">
          <span className="preseason-countdown__value">{days}</span>
          <span className="preseason-countdown__unit">Days</span>
        </div>
        <span className="preseason-countdown__sep" aria-hidden="true" />
        <div className="preseason-countdown__cell">
          <span className="preseason-countdown__value">
            {String(hours).padStart(2, '0')}
          </span>
          <span className="preseason-countdown__unit">Hours</span>
        </div>
        <span className="preseason-countdown__sep" aria-hidden="true" />
        <div className="preseason-countdown__cell">
          <span className="preseason-countdown__value">
            {String(minutes).padStart(2, '0')}
          </span>
          <span className="preseason-countdown__unit">Minutes</span>
        </div>
      </div>
    </div>
  )
}

/**
 * 26/27 preseason hub — a top-level dashboard view that hosts the
 * preseason countdown and the league centerpiece (LeagueRing). The
 * TCLOT cinematics (Season Opener + End of Season) are currently
 * hidden on this surface.
 */
export function PreseasonHub() {
  const baseUrl = import.meta.env.BASE_URL
  // Inline-set the parchment URL through a CSS custom property so the
  // CSS in PreseasonHub.css picks up the BASE_URL-aware path without
  // hardcoding `/TCLOT/` (which only works in production) or `/`
  // (which only works in dev).
  const sectionStyle = {
    '--preseason-bg-image': `url("${baseUrl}brand/tclot-lotr-bg.png")`,
  }
  return (
    <section
      className="preseason-hub"
      aria-label="Season 26/27 preseason hub"
      style={sectionStyle}
    >
      {/* Outer .preseason-hub fills the dashboard content tile (full
       * width, full visible height) and carries the parchment back-
       * drop; the inner wrapper keeps content centred at a comfortable
       * reading width regardless of the surrounding tile size. */}
      <div className="preseason-hub__inner">
        <PreseasonCountdown />

        <LeagueRing />
      </div>
    </section>
  )
}

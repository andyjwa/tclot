import { useEffect, useMemo, useRef, useState } from 'react'
import './LeagueRing.css'

/**
 * Canonical Black Speech inscription from the One Ring. Repeated with a
 * decorative middot separator so the text wraps continuously around the
 * inscription circle — anything past the end of the textPath simply gets
 * clipped by SVG, so over-supplying is safer than coming up short. The
 * inscription is the only "ring" element in the centerpiece: there is no
 * gold band or stroked outline; the glowing letters define the circle.
 */
const BLACK_SPEECH =
  'Ash nazg durbatulûk, ash nazg gimbatul, ash nazg thrakatulûk agh burzum-ishi krimpatul.'
const INSCRIPTION_TEXT = `${BLACK_SPEECH}  ·  ${BLACK_SPEECH}  ·  `

/**
 * Pill auto-dismiss timing. We fade in for 200ms, hold the name for
 * PILL_HOLD_MS, then fade out for PILL_FADE_MS before clearing the active
 * team. Tapping a new badge resets the timers cleanly via the ref.
 */
const PILL_HOLD_MS = 3000
const PILL_FADE_MS = 220

/**
 * Inscription radius in SVG user units. The viewBox is 360×360 so this
 * places the letters at 142/180 ≈ 0.789 of the half-width, leaving room
 * for the soft glow filter to bleed without clipping. Badge centres sit
 * on the same radius (converted to a percentage of the container) so the
 * medallions visually seat themselves on the inscription circle.
 */
const INSCRIPTION_RADIUS = 142
const BADGE_RADIUS_PCT = (INSCRIPTION_RADIUS / 360) * 100

export function LeagueRing() {
  const [teams, setTeams] = useState([])
  const [activeTeam, setActiveTeam] = useState(null)
  const [pillVisible, setPillVisible] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const rootRef = useRef(null)
  const pillHoldTimerRef = useRef(null)
  const pillClearTimerRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const url = import.meta.env.BASE_URL + 'team-logos/preseason-manifest.json'
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Manifest fetch failed: ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        if (Array.isArray(data?.teams)) {
          setTeams(data.teams)
        }
      })
      .catch(() => {
        // Manifest missing or malformed — leave the ring empty rather than
        // throwing; the inscription + brand banner still render the centerpiece.
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const node = rootRef.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      return undefined
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry) setIsVisible(entry.isIntersecting)
      },
      { threshold: 0.05 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    return () => {
      if (pillHoldTimerRef.current) window.clearTimeout(pillHoldTimerRef.current)
      if (pillClearTimerRef.current) window.clearTimeout(pillClearTimerRef.current)
    }
  }, [])

  const badges = useMemo(() => {
    return teams.map((t, i) => {
      const angle = (i * 45 - 90) * (Math.PI / 180)
      const x = 50 + Math.cos(angle) * BADGE_RADIUS_PCT
      const y = 50 + Math.sin(angle) * BADGE_RADIUS_PCT
      return { ...t, x, y }
    })
  }, [teams])

  function handleBadgeTap(name) {
    if (pillHoldTimerRef.current) {
      window.clearTimeout(pillHoldTimerRef.current)
      pillHoldTimerRef.current = null
    }
    if (pillClearTimerRef.current) {
      window.clearTimeout(pillClearTimerRef.current)
      pillClearTimerRef.current = null
    }
    setActiveTeam(name)
    setPillVisible(true)
    pillHoldTimerRef.current = window.setTimeout(() => {
      setPillVisible(false)
      pillHoldTimerRef.current = null
      pillClearTimerRef.current = window.setTimeout(() => {
        setActiveTeam(null)
        pillClearTimerRef.current = null
      }, PILL_FADE_MS)
    }, PILL_HOLD_MS)
  }

  const baseUrl = import.meta.env.BASE_URL
  const isPaused = !isVisible || pillVisible

  return (
    <div className="league-ring-wrap">
      <div
        ref={rootRef}
        className={`league-ring${isPaused ? ' league-ring--paused' : ''}`}
      >
        <div className="league-ring__backdrop" aria-hidden="true" />

        <svg
          className="league-ring__inscription"
          viewBox="0 0 360 360"
          aria-hidden="true"
        >
          <defs>
            <filter id="lr-ember" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.4" />
            </filter>
            <path
              id="lr-inscription-path"
              d={`M ${180 - INSCRIPTION_RADIUS} 180 A ${INSCRIPTION_RADIUS} ${INSCRIPTION_RADIUS} 0 1 1 ${180 + INSCRIPTION_RADIUS} 180 A ${INSCRIPTION_RADIUS} ${INSCRIPTION_RADIUS} 0 1 1 ${180 - INSCRIPTION_RADIUS} 180`}
              fill="none"
            />
          </defs>

          <text
            fill="#ff8c2a"
            fontSize="9"
            letterSpacing="0.5"
            opacity="0.9"
            filter="url(#lr-ember)"
          >
            <textPath href="#lr-inscription-path" startOffset="0">
              {INSCRIPTION_TEXT}
            </textPath>
          </text>
        </svg>

        <img
          className="league-ring__banner"
          src={`${baseUrl}brand/tclot-header.jpg`}
          alt="TCLOT — Tri-Continental League of Titans"
          draggable="false"
        />

        <div className="league-ring__badges">
          {badges.map((b) => (
            <button
              key={b.name}
              type="button"
              className="league-ring__badge"
              onClick={() => handleBadgeTap(b.name)}
              aria-label={b.name}
              style={{ left: `${b.x}%`, top: `${b.y}%` }}
            >
              <span className="league-ring__badge-disc">
                <img
                  src={baseUrl + 'team-logos-web/' + b.file}
                  alt=""
                  loading="lazy"
                  draggable="false"
                />
              </span>
            </button>
          ))}
        </div>
      </div>

      <span
        className={`league-ring__pill${pillVisible ? ' league-ring__pill--visible' : ''}`}
        aria-live="polite"
      >
        {activeTeam || '\u00a0'}
      </span>
    </div>
  )
}

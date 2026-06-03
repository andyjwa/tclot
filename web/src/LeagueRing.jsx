import { useEffect, useMemo, useRef, useState } from 'react'
import './LeagueRing.css'

/**
 * Canonical Black Speech inscription from the One Ring. Repeated with a
 * decorative middot separator so the text wraps continuously around the
 * inner gold band — anything past the end of the textPath simply gets
 * clipped by SVG, so over-supplying is safer than coming up short.
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
        // throwing; the gold band + wordmark still render the centerpiece.
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
      const radiusPct = 38
      const x = 50 + Math.cos(angle) * radiusPct
      const y = 50 + Math.sin(angle) * radiusPct
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
          className="league-ring__svg"
          viewBox="0 0 360 360"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="lr-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#d4a23c" />
              <stop offset="50%" stopColor="#fff4c8" />
              <stop offset="100%" stopColor="#a87a1f" />
            </linearGradient>
            <filter id="lr-ember" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.4" />
            </filter>
            <path
              id="lr-inscription"
              d="M 38 180 A 142 142 0 1 1 322 180 A 142 142 0 1 1 38 180"
              fill="none"
            />
          </defs>

          <circle
            cx="180"
            cy="180"
            r="155"
            fill="none"
            stroke="url(#lr-gold)"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <circle
            cx="180"
            cy="180"
            r="155"
            fill="none"
            stroke="rgba(255, 140, 40, 0.35)"
            strokeWidth="6"
            strokeLinecap="round"
          />

          <text
            fill="#ff8c2a"
            fontSize="9"
            letterSpacing="0.5"
            opacity="0.85"
            filter="url(#lr-ember)"
          >
            <textPath href="#lr-inscription" startOffset="0">
              {INSCRIPTION_TEXT}
            </textPath>
          </text>
        </svg>

        <svg
          className="league-ring__wordmark"
          viewBox="0 0 320 200"
          preserveAspectRatio="xMidYMid meet"
          aria-label="The Tri-Continental League of Titans"
        >
          <defs>
            <linearGradient id="lr-wordmark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e0b04a" />
              <stop offset="50%" stopColor="#fff4c8" />
              <stop offset="100%" stopColor="#b8881e" />
            </linearGradient>
          </defs>
          <g
            fontFamily="'Cinzel Decorative', 'Cinzel', 'Trajan Pro', 'Cormorant Garamond', serif"
            textAnchor="middle"
            fill="url(#lr-wordmark)"
            stroke="rgba(0, 0, 0, 0.65)"
            strokeWidth="0.6"
            paintOrder="stroke fill"
            letterSpacing="0.05em"
          >
            <text x="160" y="28" fontSize="22" fontWeight="900">
              THE
            </text>
            <text x="160" y="62" fontSize="30" fontWeight="900">
              TRI-CONTINENTAL
            </text>
            <text x="160" y="96" fontSize="22" fontWeight="700">
              LEAGUE OF
            </text>
            <text x="160" y="170" fontSize="56" fontWeight="900">
              TITANS
            </text>
          </g>
        </svg>

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

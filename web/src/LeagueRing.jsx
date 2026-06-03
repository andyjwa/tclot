import { useEffect, useState } from 'react'
import './LeagueRing.css'

/*
 * 26/27 preseason hub centerpiece.
 *
 * Two stacked sections, no animation:
 *
 *   1. Header — the LOTR-themed "Tri-Continental League of Titans"
 *      brand image (`/brand/tclot-lotr-header.png`) with a "26/27
 *      SEASON" subtitle overlaid at the bottom-centre, rendered in
 *      the same gold-on-green aesthetic so it reads as part of the
 *      composition rather than a chrome addition.
 *
 *   2. Roster — the 8 contender clubs in a uniform 4×2 grid: badge
 *      logo, team name, manager surname. Reads cleanly on mobile
 *      portrait (cells scale via clamp) and on desktop.
 *
 * Data still ships from `web/public/team-logos/preseason-manifest.json`
 * — the manifest now also carries a `manager` field per team. Empty
 * managers render as a single em-dash so the layout doesn't shift.
 */
export function LeagueRing() {
  const [teams, setTeams] = useState([])

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
        if (Array.isArray(data?.teams)) setTeams(data.teams)
      })
      .catch(() => {
        // Manifest missing or malformed — render the header alone
        // rather than throwing. The page still reads.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const baseUrl = import.meta.env.BASE_URL

  return (
    <div className="league-ring">
      {/*
        Header — the brand image fills the column. The image itself
        carries the wordmark + Tengwar inscription + "26/27 Season"
        designation, so no extra text overlay is needed.
      */}
      <div className="league-ring__header">
        <img
          className="league-ring__header-img"
          src={`${baseUrl}brand/tclot-lotr-header.png`}
          alt="The Tri-Continental League of Titans — 26/27 Season"
          draggable="false"
        />
      </div>

      {/* Roster — uniform 4×2 grid of contender clubs. */}
      <ul className="league-ring__roster" aria-label="2026/27 contenders">
        {teams.map((t) => (
          <li key={t.name} className="league-ring__cell">
            <span className="league-ring__cell-badge">
              <img
                src={`${baseUrl}team-logos-web/${t.file}`}
                alt=""
                loading="lazy"
                draggable="false"
              />
            </span>
            <span className="league-ring__cell-name">
              <span className="league-ring__cell-name-full">{t.name}</span>
              {t.shortName ? (
                <span className="league-ring__cell-name-short">
                  {t.shortName}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

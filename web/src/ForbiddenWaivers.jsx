import { useMemo, useState } from 'react'
import { useIsCeefax } from './useIsCeefax.js'
import { useForbiddenWaivers } from './useForbiddenWaivers.js'
import { filterForbiddenPlayers } from './forbiddenWaiversList.js'
import './ForbiddenWaivers.css'

/** PL club badge for an FPL team `code`. */
function plClubBadgeUrl(code) {
  if (code == null) return null
  return `https://resources.premierleague.com/premierleague/badges/50/t${code}.png`
}

/**
 * Forbidden Waivers — league rule tile. Any player added to the FPL Draft
 * game after the committed baseline (Aug 18, 2026 ~3:30 PM EST) and before
 * the end of GW7 cannot be added by any team. The list regenerates on every
 * deploy from scripts/build-forbidden-waivers.mjs (fresh bootstrap minus the
 * baseline snapshot), so new signings appear here automatically.
 *
 * `takenPickupIds` is the set of element ids claimed in the latest waiver
 * run only. Those rows light up in red. The list stays collapsed; a Taken
 * badge on the summary still flags a breach without opening the fold.
 */
export function ForbiddenWaivers({ takenPickupIds = null }) {
  const { data, players } = useForbiddenWaivers()
  const isCeefax = useIsCeefax()
  const [foldOpen, setFoldOpen] = useState(false)
  const [search, setSearch] = useState('')

  const takenCount = useMemo(() => {
    if (!takenPickupIds || typeof takenPickupIds.has !== 'function') return 0
    let n = 0
    for (const p of players) {
      if (takenPickupIds.has(Number(p.id))) n += 1
    }
    return n
  }, [players, takenPickupIds])

  const visible = useMemo(
    () => filterForbiddenPlayers(players, search, takenPickupIds),
    [players, search, takenPickupIds],
  )

  if (!data) return null

  const closed = data.windowOpen === false
  const query = search.trim()

  return (
    <section
      className={
        'tile tile--compact forbidden-waivers' +
        (takenCount > 0 ? ' forbidden-waivers--breach' : '')
      }
      aria-labelledby="forbidden-waivers-heading"
    >
      <details
        className="forbidden-waivers__fold"
        open={foldOpen}
        onToggle={(e) => setFoldOpen(e.currentTarget.open)}
      >
        <summary className="forbidden-waivers__summary">
          <h2 id="forbidden-waivers-heading" className="tile-title tile-title--sm">
            Forbidden waivers
          </h2>
          {players.length > 0 ? (
            <span className="forbidden-waivers__count tabular">{players.length}</span>
          ) : null}
          {takenCount > 0 ? (
            <span className="forbidden-waivers__taken-count tabular">
              {takenCount} taken
            </span>
          ) : null}
        </summary>
        <p className="tile-hint muted tile-hint--tight">
          {closed
            ? `The GW${data.windowClosesAfterGw} window has closed — this list is final. Players added to the game from now on are fair game.`
            : 'League rule: anyone added to the FPL game after Aug 18 (3:30 PM EST) cannot be picked up by any team until GW8 waivers.'}
        </p>
        {players.length > 0 ? (
          <label className="forbidden-waivers__search">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="forbidden-waivers__search-icon"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              className="forbidden-waivers__search-input"
              placeholder="Search players or clubs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              enterKeyHint="search"
              aria-label="Search forbidden waivers"
              aria-controls="forbidden-waivers-list"
            />
          </label>
        ) : null}
        {players.length === 0 ? (
          <p className="forbidden-waivers__empty">
            No new players have entered the game since the cutoff.
          </p>
        ) : visible.length === 0 ? (
          <p className="forbidden-waivers__empty">
            No forbidden players match "{query}".
          </p>
        ) : (
          <ul id="forbidden-waivers-list" className="forbidden-waivers__list">
            {visible.map((p) => {
              const badge = plClubBadgeUrl(p.teamCode)
              const taken = Boolean(takenPickupIds?.has(Number(p.id)))
              return (
                <li
                  key={p.id}
                  className={
                    'forbidden-waivers__row' +
                    (taken ? ' forbidden-waivers__row--taken' : '')
                  }
                >
                  {isCeefax ? (
                    <span className="forbidden-waivers__badge forbidden-waivers__badge--code">
                      {p.team || ''}
                    </span>
                  ) : badge ? (
                    <img
                      className="forbidden-waivers__badge"
                      src={badge}
                      alt={p.team || ''}
                      loading="lazy"
                      width="20"
                      height="20"
                    />
                  ) : (
                    <span className="forbidden-waivers__badge" aria-hidden />
                  )}
                  <span className="forbidden-waivers__name" title={p.fullName}>
                    {p.fullName || p.webName}
                  </span>
                  {taken ? (
                    <span className="forbidden-waivers__taken-stamp">Taken</span>
                  ) : null}
                  <span
                    className={`forbidden-waivers__pos forbidden-waivers__pos--${p.position.toLowerCase()}`}
                  >
                    {p.position}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </details>
    </section>
  )
}

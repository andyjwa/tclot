import { useMemo } from 'react'
import { useLiveScores } from './useLiveScores'
import { LiveScoreFixtureTicker } from './LiveScoreFixtureTicker.jsx'

/**
 * Shared H2H results ticker for all FPL Live sub-tabs (Live GW, Lineups, Projections).
 */
export function FplLiveGwTickerBar({
  teams,
  matches = [],
  gameweek,
  onBootstrapLiveMeta,
  teamLogoMap,
  kitIndexByEntry,
}) {
  const { squads } = useLiveScores({
    teams,
    gameweek,
    enabled: true,
    onBootstrapLiveMeta,
    pollIntervalMs: 90_000,
  })

  const gwMatches = useMemo(() => {
    if (!Array.isArray(matches) || matches.length === 0) return []
    return matches.filter((m) => Number(m.event) === Number(gameweek))
  }, [matches, gameweek])

  const squadByLeagueEntry = useMemo(() => {
    const m = new Map()
    for (const s of squads) {
      m.set(s.leagueEntryId, s)
    }
    return m
  }, [squads])

  if (!gwMatches.length) return null

  return (
    <div className="live-score-ticker-slot live-score-ticker-slot--section-chrome">
      <LiveScoreFixtureTicker
        gwMatches={gwMatches}
        teams={teams}
        squadByLeagueEntry={squadByLeagueEntry}
        gameweek={gameweek}
        teamLogoMap={teamLogoMap}
        kitIndexByEntry={kitIndexByEntry}
      />
    </div>
  )
}

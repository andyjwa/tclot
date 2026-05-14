import { useMemo } from 'react'
import { TeamAvatar } from './TeamAvatar'
import { liveGwDisplayTotal } from './liveGwTotals.js'

function teamNameForEntry(teams, leagueEntryId) {
  return teams?.find((t) => t.id === leagueEntryId)?.teamName ?? `Team ${leagueEntryId}`
}

const TICKER_NAMES_PER_INSERT = 6

const LIVE_TICKER_STICKER_SRCS = [1, 2, 3].map((i) => {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
  return `${base}live-ticker-stickers/sticker-${i}.png`
})

function ramistSlotForInsertIndex(insertIndex) {
  return insertIndex % 4
}

function ramistNodeForSlot(slot, key) {
  if (slot === 0) {
    return (
      <span key={key} className="live-score-ticker__ramist" aria-hidden="true">
        Tery is a Racist
      </span>
    )
  }
  const src = LIVE_TICKER_STICKER_SRCS[slot - 1]
  return (
    <img
      key={key}
      className="live-score-ticker__sticker"
      src={src}
      alt=""
      aria-hidden="true"
      decoding="async"
      loading="lazy"
    />
  )
}

/**
 * Horizontal marquee of this GW’s H2H live totals.
 */
export function LiveScoreFixtureTicker({
  gwMatches,
  teams,
  squadByLeagueEntry,
  gameweek,
  teamLogoMap,
  kitIndexByEntry,
}) {
  const items = useMemo(() => {
    if (!Array.isArray(gwMatches) || gwMatches.length === 0) return []
    return gwMatches.map((m) => {
      const homeId = Number(m.league_entry_1)
      const awayId = Number(m.league_entry_2)
      const homeName = teamNameForEntry(teams, homeId)
      const awayName = teamNameForEntry(teams, awayId)
      const homeLive = liveGwDisplayTotal(squadByLeagueEntry.get(homeId))
      const awayLive = liveGwDisplayTotal(squadByLeagueEntry.get(awayId))
      const homeLead =
        homeLive != null && awayLive != null && homeLive > awayLive
      const awayLead =
        homeLive != null && awayLive != null && awayLive > homeLive
      return {
        key: `${homeId}-${awayId}-${Number(gameweek)}`,
        homeId,
        awayId,
        homeName,
        awayName,
        homeLive,
        awayLive,
        homeLead,
        awayLead,
      }
    })
  }, [gwMatches, teams, squadByLeagueEntry, gameweek])

  if (!items.length) return null

  const durSec = Math.min(62, Math.max(12, items.length * 9))

  const buildChunk = (keySuffix) => {
    const nodes = []
    let namesSeen = 0
    let insertIndex = 0
    for (const it of items) {
      nodes.push(
        <span key={`${it.key}${keySuffix}`} className="live-score-ticker__fixture-block">
          <span className="live-score-ticker__fixture">
            <span className="live-score-ticker__name-with-badge">
              <span className="live-score-ticker__badge">
                <TeamAvatar
                  entryId={it.homeId}
                  name={it.homeName}
                  size="sm"
                  logoMap={teamLogoMap}
                  kitIndexByEntry={kitIndexByEntry}
                />
              </span>
              <span
                className={`live-score-ticker__team ${it.homeLead ? 'live-score-ticker__team--lead' : ''}`}
              >
                {it.homeName}
              </span>
            </span>
            <span
              className={`live-score-ticker__pts tabular ${it.homeLead ? 'live-score-ticker__pts--lead' : ''}`}
            >
              {it.homeLive ?? '—'}
            </span>
            <span className="live-score-ticker__dash" aria-hidden="true">
              –
            </span>
            <span
              className={`live-score-ticker__pts tabular ${it.awayLead ? 'live-score-ticker__pts--lead' : ''}`}
            >
              {it.awayLive ?? '—'}
            </span>
            <span className="live-score-ticker__name-with-badge">
              <span
                className={`live-score-ticker__team ${it.awayLead ? 'live-score-ticker__team--lead' : ''}`}
              >
                {it.awayName}
              </span>
              <span className="live-score-ticker__badge">
                <TeamAvatar
                  entryId={it.awayId}
                  name={it.awayName}
                  size="sm"
                  logoMap={teamLogoMap}
                  kitIndexByEntry={kitIndexByEntry}
                />
              </span>
            </span>
          </span>
        </span>,
      )
      namesSeen += 2
      if (namesSeen % TICKER_NAMES_PER_INSERT === 0 && namesSeen > 0) {
        const slot = ramistSlotForInsertIndex(insertIndex)
        insertIndex += 1
        nodes.push(
          ramistNodeForSlot(slot, `ramist-${keySuffix}-${insertIndex}-${namesSeen}`),
        )
      }
    }
    return nodes
  }

  return (
    <div
      className="live-score-ticker"
      role="region"
      aria-label={`Gameweek ${Number(gameweek)} live head-to-head scores`}
      style={{ '--live-ticker-duration': `${durSec}s` }}
    >
      <div className="live-score-ticker__viewport" aria-hidden="true">
        <div className="live-score-ticker__track">
          <div className="live-score-ticker__chunk">{buildChunk('')}</div>
          <div className="live-score-ticker__chunk">{buildChunk('-dup')}</div>
        </div>
      </div>
    </div>
  )
}

import {
  countDcThresholdMet,
  countGamesPlayedOver60,
  isSeasonComplete,
  lastFiveGwCards,
  upcomingFixturesNext,
} from './playerDetailDerivations.js'
import { PlayerDetailLastFiveCards } from './PlayerDetailLastFiveCards.jsx'
import { PlayerDetailNextFiveCards } from './PlayerDetailNextFiveCards.jsx'

function PdetailStatTile({ k, v, tone, prefix = '' }) {
  return (
    <div
      className={
        `${prefix}pdetail-tile` + (tone ? ` ${prefix}pdetail-tile--${tone}` : '')
      }
    >
      <div className={`${prefix}pdetail-tile__v`}>{v}</div>
      <div className={`${prefix}pdetail-tile__k`}>{k}</div>
    </div>
  )
}

/**
 * Single-column Overview body — Season tiles → Last 5 GW cards → Next
 * 5 fixture cards, stacked top-to-bottom on both desktop and portrait.
 * Earlier rebuild used a 1.65 : 1 grid with an upcoming-fixtures sidebar;
 * round-2 polish dropped the sidebar entirely so both card strips share
 * the same visual treatment + rhythm. Cards are styled by
 * `PlayerDetailLastFiveCards` and `PlayerDetailNextFiveCards`.
 *
 * @param {{
 *   el: object,
 *   summaryPayload: object | null,
 *   teamById: Map<number, object> | null | undefined,
 *   portrait: boolean,
 *   plFixtures?: Array<object> | null,
 * }} props
 */
export function PlayerDetailOverview({
  el,
  summaryPayload,
  teamById,
  portrait,
  plFixtures = null,
}) {
  const elementType = el?.element_type
  const seasonPoints = Number(el?.total_points) || 0
  const seasonGoals = Number(el?.goals_scored) || 0
  const seasonAssists = Number(el?.assists) || 0
  const seasonCs = Number(el?.clean_sheets) || 0
  const seasonBonus = Number(el?.bonus) || 0
  const history = Array.isArray(summaryPayload?.history) ? summaryPayload.history : []
  const games60 = countGamesPlayedOver60(history)
  const dcQualifyingGames = countDcThresholdMet(history, elementType)

  const last5Cards = lastFiveGwCards(history, elementType, 5, {
    plFixtures,
    playerTeamId: el?.team,
  })
  const upcoming = upcomingFixturesNext(summaryPayload, el?.team, 5)

  const tiles = (
    <>
      <PdetailStatTile k="Points"       v={seasonPoints}        tone="brand" />
      <PdetailStatTile k="60+ mins"     v={games60}             tone="tinted" />
      <PdetailStatTile k="Goals"        v={seasonGoals}         tone="tinted" />
      <PdetailStatTile k="Assists"      v={seasonAssists}       tone="tinted" />
      <PdetailStatTile k="Clean sheets" v={seasonCs}            tone="tinted" />
      <PdetailStatTile k="DC"           v={dcQualifyingGames}   tone="tinted" />
      <PdetailStatTile k="Bonus"        v={seasonBonus}         tone="tinted" />
    </>
  )

  const lastFiveBlock =
    last5Cards.length > 0 ? (
      <section className="pdetail__section">
        <h4 className={portrait ? 'pdetail-p__section-h' : 'pdetail__section-h'}>
          Last 5 gameweeks
        </h4>
        <PlayerDetailLastFiveCards cards={last5Cards} teamById={teamById} />
      </section>
    ) : null

  /*
   * Next-5 block:
   *  - 1-5 upcoming fixtures → 5-card row.
   *  - 0 upcoming AND `summaryPayload.fixtures` is a (loaded) empty array
   *    → render a single full-width "Season complete" placeholder card so
   *    the section reads as intentional rather than missing. Pre-load
   *    state (`summaryPayload == null` or no `fixtures` array yet) hides
   *    the section to avoid a flash before the fetch resolves.
   */
  const seasonOver = isSeasonComplete(summaryPayload)
  let nextFiveBlock = null
  if (upcoming.length > 0) {
    nextFiveBlock = (
      <section className="pdetail__section">
        <h4 className={portrait ? 'pdetail-p__section-h' : 'pdetail__section-h'}>
          Next 5 fixtures
        </h4>
        <PlayerDetailNextFiveCards rows={upcoming} teamById={teamById} />
      </section>
    )
  } else if (seasonOver) {
    nextFiveBlock = (
      <section className="pdetail__section">
        <h4 className={portrait ? 'pdetail-p__section-h' : 'pdetail__section-h'}>
          Next 5 fixtures
        </h4>
        <div
          className="pdetail-l5 pdetail-n5 pdetail-n5--empty"
          role="status"
          aria-live="polite"
        >
          <div className="pdetail-l5__card pdetail-n5__card pdetail-n5__empty-card">
            Season complete — fixtures resume next season
          </div>
        </div>
      </section>
    )
  }

  if (portrait) {
    return (
      <div className="pdetail-p__body">
        <section className="pdetail__section">
          <h4 className="pdetail-p__section-h">Season summary</h4>
          <div className="pdetail-p__tiles">{tiles}</div>
        </section>

        {lastFiveBlock}
        {nextFiveBlock}
      </div>
    )
  }

  return (
    <div className="pdetail__body pdetail__body--stacked">
      <section className="pdetail__section">
        <h4 className="pdetail__section-h">Season summary</h4>
        <div className="pdetail__tiles">{tiles}</div>
      </section>

      {lastFiveBlock}
      {nextFiveBlock}
    </div>
  )
}

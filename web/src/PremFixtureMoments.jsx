import { useMemo, useState } from 'react';
import { TeamAvatar } from './TeamAvatar';
import { ClickablePlayerName } from './PlayerHistoryContext.jsx';
import {
  MATCH_EVENT_KINDS,
  WAIVER_MATCH_EVENT_IDS,
  collectSideEvents,
  matchEventKindActive,
  premFixturePlayerRows,
} from './matchEvents.js';
import './LiveFixtureCard.css';

function EventKindIcon({ kind }) {
  if (kind.card) {
    return (
      <span
        className={`lfc-events__cardico lfc-events__cardico--${kind.card}`}
        role="img"
        aria-label={kind.title}
      />
    );
  }
  return (
    <span
      className={`lfc-events__ico lfc-events__ico--${kind.id}`}
      aria-label={kind.title}
    >
      {kind.glyph}
    </span>
  );
}

function OwnerMark({ entry, teamLogoMap, kitIndexByEntry }) {
  if (entry.onWaiver) {
    return (
      <span className="prem-moments__w" title="On waiver">
        W
      </span>
    );
  }
  if (!entry.owner) return null;
  return (
    <span className="prem-moments__owner" title={entry.owner.teamName}>
      <TeamAvatar
        entryId={entry.owner.leagueEntryId}
        name={entry.owner.teamName}
        size="sm"
        logoMap={teamLogoMap}
        kitIndexByEntry={kitIndexByEntry}
      />
    </span>
  );
}

function EventNames({ entries, teamLogoMap, kitIndexByEntry }) {
  if (!entries.length) {
    return <span className="lfc-events__none">—</span>;
  }
  return entries.map((e, i) => (
    <span key={`${e.element ?? e.name}-${i}`} className="prem-moments__chip">
      <ClickablePlayerName
        element={e.element}
        displayName={e.name}
        web_name={e.name}
      >
        {e.name}
      </ClickablePlayerName>
      {e.tag ? (
        <span
          className={
            'lfc-events__x' +
            (e.bonusConfirmed === false ? ' lfc-events__x--prov' : '')
          }
        >
          {e.tag}
        </span>
      ) : null}
      <OwnerMark
        entry={e}
        teamLogoMap={teamLogoMap}
        kitIndexByEntry={kitIndexByEntry}
      />
    </span>
  ));
}

/**
 * Goals / assists / fantasy moments under a Lineups fixture header.
 * Starts collapsed. Owned players get a fantasy badge; waiver players
 * get a W and only appear on G / A / B.
 */
export function PremFixtureMoments({
  fx,
  ownerByEl,
  elementById,
  liveByElementId,
  liveFullByElementId,
  typeById,
  teamLogoMap,
  kitIndexByEntry,
  claimedElementIds,
}) {
  const [open, setOpen] = useState(false);
  const homeTeamId = Number(fx?.fplFixture?.team_h);
  const awayTeamId = Number(fx?.fplFixture?.team_a);
  const fixtureId = Number(fx?.fplFixture?.id);
  const homeRows = useMemo(
    () =>
      premFixturePlayerRows({
        plTeamId: homeTeamId,
        elementById,
        liveByElementId,
        liveFullByElementId,
        ownerByEl,
        typeById,
        sideLineup: fx?.lineups?.home,
        claimedElementIds,
        fixtureId,
      }),
    [
      homeTeamId,
      elementById,
      liveByElementId,
      liveFullByElementId,
      ownerByEl,
      typeById,
      fx?.lineups?.home,
      claimedElementIds,
      fixtureId,
    ],
  );
  const awayRows = useMemo(
    () =>
      premFixturePlayerRows({
        plTeamId: awayTeamId,
        elementById,
        liveByElementId,
        liveFullByElementId,
        ownerByEl,
        typeById,
        sideLineup: fx?.lineups?.away,
        claimedElementIds,
        fixtureId,
      }),
    [
      awayTeamId,
      elementById,
      liveByElementId,
      liveFullByElementId,
      ownerByEl,
      typeById,
      fx?.lineups?.away,
      claimedElementIds,
      fixtureId,
    ],
  );
  const home = useMemo(
    () => collectSideEvents(homeRows, { waiverKindIds: WAIVER_MATCH_EVENT_IDS }),
    [homeRows],
  );
  const away = useMemo(
    () => collectSideEvents(awayRows, { waiverKindIds: WAIVER_MATCH_EVENT_IDS }),
    [awayRows],
  );
  const kinds = MATCH_EVENT_KINDS.filter((k) => matchEventKindActive(k, home, away));
  if (!kinds.length) return null;
  return (
    <section
      className={'prem-moments lfc-events' + (open ? ' lfc-events--open' : '')}
      aria-label="Match events"
    >
      <button
        type="button"
        className="prem-moments__toggle"
        aria-expanded={open}
        aria-label="Match events"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <span className="prem-moments__title">Match events</span>
        {open ? null : (
          <span className="prem-moments__kinds" aria-hidden="true">
            {kinds.map((k) => (
              <EventKindIcon key={k.id} kind={k} />
            ))}
          </span>
        )}
        <span
          className={
            'prem-moments__chev' + (open ? ' prem-moments__chev--open' : '')
          }
          aria-hidden="true"
        >
          ›
        </span>
      </button>
      {open ? (
        <div className="prem-moments__body lfc-events__body">
          {kinds.map((k) => (
            <div key={k.id} className="lfc-events__row" title={k.title}>
              <span className="lfc-events__side lfc-events__side--home prem-moments__side">
                <EventNames
                  entries={home[k.id]}
                  teamLogoMap={teamLogoMap}
                  kitIndexByEntry={kitIndexByEntry}
                />
              </span>
              <span className="lfc-events__mid">
                <EventKindIcon kind={k} />
              </span>
              <span className="lfc-events__side lfc-events__side--away prem-moments__side">
                <EventNames
                  entries={away[k.id]}
                  teamLogoMap={teamLogoMap}
                  kitIndexByEntry={kitIndexByEntry}
                />
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

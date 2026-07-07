import { useState } from 'react';
import { TeamAvatar } from './TeamAvatar';
import { LiveExpandedFixture } from './LiveExpandedFixture.jsx';
import { LiveStandingsTable } from './LiveStandingsTable.jsx';
import { LiveFixtureKeyStats } from './LiveFixtureKeyStats.jsx';
import { LiveFixtureH2hBars } from './LiveFixtureH2hBars.jsx';
import { LiveFixtureOdds } from './LiveFixtureOdds.jsx';

const TABS = [
  { id: 'lineups', label: 'Lineups' },
  { id: 'stats', label: 'Key Stats' },
  { id: 'odds', label: 'Odds' },
  { id: 'table', label: 'Live Table' },
];

/** Per-side caption beneath the team name in the scorehead. */
function teamSubText(remaining, isLeader, settled) {
  if (remaining != null && remaining > 0) {
    return { text: `${remaining} to play`, live: true };
  }
  if (settled && isLeader) return { text: 'Winner', live: false };
  return { text: '\u00a0', live: false };
}

/**
 * A single live fixture "page" in the swipeable deck: a scorehead whose
 * team badges select which lineup to show (additive highlight), a 4-tab
 * selector (Lineups / Key Stats / Odds / Live Table), and the matching
 * scrollable pane. Key Stats also folds in the season head-to-head; Odds
 * carries the pre-match projection model. Reuses the production lineup table
 * ({@link LiveExpandedFixture}) and {@link LiveStandingsTable}.
 *
 * @param {{ fixture: object, ctx: object }} props
 */
export function LiveFixtureCard({ fixture, ctx }) {
  const [tab, setTab] = useState('lineups');
  const [side, setSide] = useState('home');

  const {
    homeId,
    awayId,
    homeName,
    awayName,
    homeSquad,
    awaySquad,
    homeLive,
    awayLive,
    homeRemaining,
    awayRemaining,
    comp,
  } = fixture;

  const toPlay = (Number(homeRemaining) || 0) + (Number(awayRemaining) || 0);
  const live = toPlay > 0;
  const settled = !live && homeLive != null && awayLive != null && homeLive !== awayLive;
  const homeSub = teamSubText(homeRemaining, homeLive > awayLive, settled);
  const awaySub = teamSubText(awayRemaining, awayLive > homeLive, settled);

  // Selection highlight only reads meaningfully on the Lineups tab.
  const selHome = tab === 'lineups' && side === 'home';
  const selAway = tab === 'lineups' && side === 'away';

  const teamButton = (which) => {
    const isHome = which === 'home';
    const sel = isHome ? selHome : selAway;
    return (
      <button
        type="button"
        className={'lfc-team' + (sel ? ' is-sel' : '')}
        onClick={() => {
          setSide(which);
          if (tab !== 'lineups') setTab('lineups');
        }}
        aria-pressed={sel}
        aria-label={`Show ${isHome ? homeName : awayName} lineup`}
      >
        <span className="lfc-team__score tabular">
          {(isHome ? homeLive : awayLive) ?? '—'}
        </span>
        <span className="lfc-team__badge">
          <TeamAvatar
            entryId={isHome ? homeId : awayId}
            name={isHome ? homeName : awayName}
            size="lg"
            logoMap={ctx.teamLogoMap}
            kitIndexByEntry={ctx.kitIndexByEntry}
          />
        </span>
        <span className="lfc-team__name">{isHome ? homeName : awayName}</span>
        <span
          className={
            'lfc-team__sub' + ((isHome ? homeSub : awaySub).live ? ' lfc-team__sub--live' : '')
          }
        >
          {(isHome ? homeSub : awaySub).text}
        </span>
      </button>
    );
  };

  // Subtle "switch to opponent" control tucked into the blank right side of the
  // BENCH divider row (mid-screen thumb zone). Shows the team you'll switch to.
  const otherSide = side === 'home' ? 'away' : 'home';
  const otherId = otherSide === 'home' ? homeId : awayId;
  const otherName = otherSide === 'home' ? homeName : awayName;
  const benchSwitch = (
    <button
      type="button"
      className="lfc-benchswitch"
      onClick={() => setSide(otherSide)}
      aria-label={`Switch to ${otherName} lineup`}
    >
      <span className="lfc-benchswitch__crest">
        <TeamAvatar
          entryId={otherId}
          name={otherName}
          size="sm"
          logoMap={ctx.teamLogoMap}
          kitIndexByEntry={ctx.kitIndexByEntry}
        />
      </span>
      <span className="lfc-benchswitch__name">{otherName}</span>
      <span className="lfc-benchswitch__chev" aria-hidden="true">›</span>
    </button>
  );

  return (
    <div className="lfc-card">
      <div className="lfc-card__top">
        <div className="lfc-scorehead" role="group" aria-label="Tap a team to view its lineup">
          {teamButton('home')}
          <div className="lfc-mid">
            <span className={'lfc-mid__main' + (live ? ' lfc-mid__main--live' : '')}>
              {live ? '● LIVE' : 'FT'}
            </span>
            {comp ? <span className="lfc-mid__sub">{comp}</span> : null}
          </div>
          {teamButton('away')}
        </div>
        <div className="lfc-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={'lfc-tab' + (tab === t.id ? ' is-active' : '')}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="lfc-pane-wrap">
        <div
          className={
            'lfc-card__scroll lfc-pane' +
            (tab === 'lineups' ? ' lfc-card__scroll--fit' : '')
          }
        >
        {tab === 'lineups' ? (
          <LiveExpandedFixture
            homeSquad={homeSquad}
            awaySquad={awaySquad}
            homeName={homeName}
            awayName={awayName}
            viewport="mobile"
            selectedSide={side}
            onSelectSide={setSide}
            showTabs={false}
            showAutosubs={false}
            onOpenPlayer={ctx.onOpenPlayer}
            benchAccessory={benchSwitch}
          />
        ) : null}
        {tab === 'stats' ? (
          <>
            <LiveFixtureKeyStats homeSquad={homeSquad} awaySquad={awaySquad} />
            <LiveFixtureH2hBars
              matches={ctx.matches}
              homeId={homeId}
              awayId={awayId}
              homeName={homeName}
              awayName={awayName}
            />
          </>
        ) : null}
        {tab === 'odds' ? (
          <LiveFixtureOdds
            homeSquad={homeSquad}
            awaySquad={awaySquad}
            homeId={homeId}
            awayId={awayId}
            homeName={homeName}
            awayName={awayName}
            ctx={ctx}
          />
        ) : null}
        {tab === 'table' ? (
          <LiveStandingsTable
            liveStandingsRows={ctx.liveStandingsRows}
            gwStandingsFrozen={ctx.gwStandingsFrozen}
            gameweek={ctx.gameweek}
            teams={ctx.teams}
            teamLogoMap={ctx.teamLogoMap}
            kitIndexByEntry={ctx.kitIndexByEntry}
            mobile
          />
        ) : null}
        </div>
      </div>
    </div>
  );
}

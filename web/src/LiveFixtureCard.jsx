import { useEffect, useRef, useState } from 'react';
import { TeamAvatar } from './TeamAvatar';
import { LiveExpandedFixture } from './LiveExpandedFixture.jsx';
import { LiveStandingsTable } from './LiveStandingsTable.jsx';
import { LiveFixtureKeyStats } from './LiveFixtureKeyStats.jsx';
import { LiveFixtureH2hBars } from './LiveFixtureH2hBars.jsx';
import { LiveFixtureOdds } from './LiveFixtureOdds.jsx';
import { LiveFixtureMatchSplit } from './LiveFixtureMatchSplit.jsx';
import { FIXTURE_CARD_TABS } from './liveFixtureCardTabs.js';

/** Per-side caption beneath the team name in the scorehead. */
function teamSubText(remaining, isLeader, settled) {
  if (remaining != null && remaining > 0) {
    return { text: `${remaining} to play`, live: true };
  }
  if (settled && isLeader) return { text: 'Winner', live: false };
  return { text: '\u00a0', live: false };
}

/**
 * A single live fixture "page": a scorehead whose team badges select which
 * lineup to show on the Lineups tab, a 5-tab selector
 * (Match / Lineups / Stats / Odds / Table), and a horizontally sliding pane
 * track (FotMob-style — panes slide left/right as tabs change, and the
 * deck's swipe gesture drags the track directly).
 *
 * The Match tab shows BOTH teams as compact split columns; the Lineups tab
 * keeps the detailed one-team stat table (POS · MIN · DC · G · A · B · PTS)
 * with the scorehead badges / bench chip switching sides.
 *
 * Tab state is controlled by the deck when `tab`/`onTabChange` are passed
 * (so the swipe gesture and the tab buttons stay in sync); otherwise it
 * falls back to local state.
 *
 * @param {{
 *   fixture: object,
 *   ctx: object,
 *   tab?: string,
 *   onTabChange?: (id: string) => void,
 *   onBack?: () => void,
 * }} props
 */
export function LiveFixtureCard({ fixture, ctx, tab, onTabChange, onBack }) {
  const [localTab, setLocalTab] = useState('match');
  const [side, setSide] = useState('home');
  const tabsRef = useRef(null);

  const activeTab = tab ?? localTab;
  const setTab = onTabChange ?? setLocalTab;
  const tabIdx = Math.max(
    0,
    FIXTURE_CARD_TABS.findIndex((t) => t.id === activeTab),
  );

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

  // The tab strip has `touch-action: pan-y` (its native horizontal scroll
  // would fight the deck's swipe gesture), so keep the active pill visible
  // programmatically when it changes — matters on narrow phones where the
  // strip overflows by a few px. Scroll the strip's own scrollLeft rather
  // than scrollIntoView: the deck shares tab state across every fixture
  // card, and scrollIntoView from an off-screen card walks ancestor
  // scrollers too — it side-scrolled the overflow-hidden deck viewport.
  useEffect(() => {
    const strip = tabsRef.current;
    if (!strip || strip.scrollWidth <= strip.clientWidth) return;
    const active = strip.querySelector('.lfc-tab.is-active');
    if (!active) return;
    const left = active.offsetLeft;
    const right = left + active.offsetWidth;
    if (left < strip.scrollLeft) {
      strip.scrollTo({ left: left - 8, behavior: 'smooth' });
    } else if (right > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({ left: right - strip.clientWidth + 8, behavior: 'smooth' });
    }
  }, [activeTab]);

  const toPlay = (Number(homeRemaining) || 0) + (Number(awayRemaining) || 0);
  const live = toPlay > 0;
  const settled = !live && homeLive != null && awayLive != null && homeLive !== awayLive;
  const homeSub = teamSubText(homeRemaining, homeLive > awayLive, settled);
  const awaySub = teamSubText(awayRemaining, awayLive > homeLive, settled);

  // Side-selection highlight only reads meaningfully on the Lineups tab.
  const selHome = activeTab === 'lineups' && side === 'home';
  const selAway = activeTab === 'lineups' && side === 'away';

  const teamButton = (which) => {
    const isHome = which === 'home';
    const sel = isHome ? selHome : selAway;
    return (
      <button
        type="button"
        className={'lfc-team' + (sel ? ' is-sel' : '')}
        onClick={() => {
          setSide(which);
          if (activeTab !== 'lineups') setTab('lineups');
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
  const otherName = otherSide === 'home' ? homeName : awayName;
  const benchSwitch = (
    <button
      type="button"
      className="lfc-benchswitch"
      onClick={() => setSide(otherSide)}
      aria-label={`Switch to ${otherName} lineup`}
    >
      <span className="lfc-benchswitch__lead">Switch to</span>
      <span className="lfc-benchswitch__name">{otherName.split(' ')[0]}</span>
      <span className="lfc-benchswitch__chev" aria-hidden="true">›</span>
    </button>
  );

  return (
    <div className="lfc-card">
      <div className="lfc-card__top">
        {onBack ? (
          <div className="lfc-topbar">
            <button
              type="button"
              className="lfc-back"
              aria-label="Back to scores"
              onClick={onBack}
            >
              <span aria-hidden="true">‹</span>
            </button>
          </div>
        ) : null}
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
        <div className="lfc-tabs" role="tablist" ref={tabsRef}>
          {FIXTURE_CARD_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              className={'lfc-tab' + (activeTab === t.id ? ' is-active' : '')}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* All five panes stay mounted side-by-side in a sliding track so tab
          changes (button tap or horizontal swipe) animate FotMob-style. The
          deck's gesture handler drags `.lfc-panes` directly mid-swipe; this
          inline transform is the resting position. */}
      <div className="lfc-pane-wrap">
        <div
          className="lfc-panes"
          style={{ transform: `translateX(${-tabIdx * 100}%)` }}
        >
          <div className="lfc-card__scroll lfc-pane" inert={activeTab !== 'match'}>
            <LiveFixtureMatchSplit
              fixture={fixture}
              ctx={ctx}
              onOpenPlayer={ctx.onOpenPlayer}
            />
          </div>
          <div
            className="lfc-card__scroll lfc-card__scroll--fit lfc-pane"
            inert={activeTab !== 'lineups'}
          >
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
          </div>
          <div className="lfc-card__scroll lfc-pane" inert={activeTab !== 'stats'}>
            <LiveFixtureKeyStats homeSquad={homeSquad} awaySquad={awaySquad} />
            <LiveFixtureH2hBars
              matches={ctx.matches}
              homeId={homeId}
              awayId={awayId}
              homeName={homeName}
              awayName={awayName}
            />
          </div>
          <div className="lfc-card__scroll lfc-pane" inert={activeTab !== 'odds'}>
            <LiveFixtureOdds
              homeSquad={homeSquad}
              awaySquad={awaySquad}
              homeId={homeId}
              awayId={awayId}
              homeName={homeName}
              awayName={awayName}
              ctx={ctx}
            />
          </div>
          <div className="lfc-card__scroll lfc-pane" inert={activeTab !== 'table'}>
            <LiveStandingsTable
              liveStandingsRows={ctx.liveStandingsRows}
              gwStandingsFrozen={ctx.gwStandingsFrozen}
              gameweek={ctx.gameweek}
              teams={ctx.teams}
              teamLogoMap={ctx.teamLogoMap}
              kitIndexByEntry={ctx.kitIndexByEntry}
              mobile
            />
          </div>
        </div>
      </div>
    </div>
  );
}

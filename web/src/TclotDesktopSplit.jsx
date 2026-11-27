import { useEffect, useMemo } from 'react';
import { TeamAvatar } from './TeamAvatar';
import { LiveFixtureDesktopPage } from './LiveFixtureDesktopPage.jsx';
import { PlayerContributions } from './PlayerContributions';

/**
 * Desktop TCLOT master-detail. The left rail is this gameweek's fantasy
 * matchups; the right panel is the existing fixture page (Match / Lineups /
 * Stats / Odds / Table) rendered in place, plus a points feed limited to
 * the two managers when their squads are already loaded.
 */
export function TclotDesktopSplit({
  fixtures,
  activeIndex,
  onSelectFixture,
  ctx,
  initialTabId = null,
  squads = [],
  feedProps = null,
}) {
  const safeIndex = Math.min(
    Math.max(Number(activeIndex) || 0, 0),
    Math.max((fixtures?.length || 1) - 1, 0),
  );
  const fixture = fixtures?.[safeIndex] ?? null;

  useEffect(() => {
    const el = document.querySelector('.tclot-rail__card.is-selected');
    el?.scrollIntoView({ block: 'nearest' });
  }, [safeIndex]);

  const feedSquads = useMemo(() => {
    if (!fixture) return [];
    const ids = new Set([Number(fixture.homeId), Number(fixture.awayId)]);
    return (squads || []).filter((s) => ids.has(Number(s.leagueEntryId)));
  }, [fixture, squads]);

  if (!fixture) return null;

  return (
    <div className="tclot-split">
      <aside className="tclot-rail" aria-label="Fantasy matchups">
        {fixtures.map((fx, i) => {
          const homeLeft = Number(fx.homeRemaining);
          const awayLeft = Number(fx.awayRemaining);
          const live =
            (Number.isFinite(homeLeft) && homeLeft > 0) ||
            (Number.isFinite(awayLeft) && awayLeft > 0);
          const settled =
            (!Number.isFinite(homeLeft) || homeLeft === 0) &&
            (!Number.isFinite(awayLeft) || awayLeft === 0);
          const finished =
            !live &&
            (ctx?.gwFinished === true ||
              (settled && fx.homeLive != null && fx.awayLive != null));
          const selected = i === safeIndex;
          return (
            <button
              key={fx.key ?? `${fx.homeId}-${fx.awayId}-${i}`}
              type="button"
              className={'tclot-rail__card' + (selected ? ' is-selected' : '')}
              aria-current={selected ? 'true' : undefined}
              onClick={() => onSelectFixture(i)}
            >
              <RailSide
                entryId={fx.homeId}
                name={fx.homeName}
                points={fx.homeLive}
                remaining={fx.homeRemaining}
                teamLogoMap={ctx?.teamLogoMap}
                kitIndexByEntry={ctx?.kitIndexByEntry}
              />
              <RailSide
                entryId={fx.awayId}
                name={fx.awayName}
                points={fx.awayLive}
                remaining={fx.awayRemaining}
                teamLogoMap={ctx?.teamLogoMap}
                kitIndexByEntry={ctx?.kitIndexByEntry}
              />
              <span className="tclot-rail__foot">
                <span className={'tclot-rail__state' + (live ? ' is-live' : '')}>
                  {live ? '● LIVE' : finished ? 'FT' : '—'}
                </span>
                {fx.projLabel ? (
                  <span className="tclot-rail__proj">proj {fx.projLabel}</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </aside>
      <div className="tclot-detail">
        <LiveFixtureDesktopPage
          fixtures={fixtures}
          activeIndex={safeIndex}
          onSelectFixture={onSelectFixture}
          ctx={ctx}
          onBack={() => {}}
          initialTabId={initialTabId}
          embedded
        />
        {feedProps && feedSquads.length > 0 ? (
          <section
            className="tile tile--compact player-contrib-tile tclot-split__feed"
            aria-label={`Points feed for ${fixture.homeName} and ${fixture.awayName}`}
          >
            <div className="tile-head-row tile-head-row--tight">
              <h2 className="tile-title tile-title--sm">Points Feed</h2>
            </div>
            <PlayerContributions
              {...feedProps}
              squads={feedSquads}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}

function RailSide({
  entryId,
  name,
  points,
  remaining,
  teamLogoMap,
  kitIndexByEntry,
}) {
  const left = Number(remaining);
  const note =
    Number.isFinite(left) && left > 0 ? `${left} to play` : null;
  return (
    <span className="tclot-rail__side">
      <TeamAvatar
        entryId={entryId}
        name={name}
        size="sm"
        logoMap={teamLogoMap}
        kitIndexByEntry={kitIndexByEntry}
      />
      <span className="tclot-rail__name" title={name}>
        {name}
        {note ? <span className="tclot-rail__left">{note}</span> : null}
      </span>
      <span className="tclot-rail__pts tabular">{points ?? '—'}</span>
    </span>
  );
}

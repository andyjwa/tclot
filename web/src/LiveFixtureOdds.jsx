import { useMemo } from 'react';
import { TeamAvatar } from './TeamAvatar';
import { LiveFixtureCompareRow } from './LiveFixtureKeyStats.jsx';
import { usePredictions } from './usePredictions.js';
import {
  predictionsById,
  teamForecastDistribution,
  h2hWinProbs,
  teamOddsTotals,
  mostLikelyToReturn,
} from './forecastHelpers.js';
import { teamXiElementIds } from './liveFixtureCardDerivations.js';

/** One position pill (GK / DEF / MID / FWD) for the returns list. */
function PosPill({ pos }) {
  if (!pos) return null;
  return <span className="lfc-pick__pos">{pos}</span>;
}

/**
 * Three-segment win-probability bar (home win / draw / away win). Widths are
 * the CLT-approximation percentages; a label is shown when the band is wide
 * enough to fit it.
 */
function WinBar({ probs, homeName, awayName }) {
  const segs = [
    { key: 'h', pct: probs.homeWinPct, cls: 'lfc-win__seg--h' },
    { key: 'd', pct: probs.drawPct, cls: 'lfc-win__seg--d' },
    { key: 'a', pct: probs.awayWinPct, cls: 'lfc-win__seg--a' },
  ];
  return (
    <>
      <div className="lfc-win__teams">
        <span className="lfc-win__team">{homeName}</span>
        <span className="lfc-win__cap">Win probability</span>
        <span className="lfc-win__team">{awayName}</span>
      </div>
      <div className="lfc-win__bar">
        {segs.map((s) => (
          <span
            key={s.key}
            className={'lfc-win__seg ' + s.cls}
            style={{ width: `${s.pct}%` }}
          >
            {s.pct >= 8 ? `${Math.round(s.pct)}%` : ''}
          </span>
        ))}
      </div>
      <div className="lfc-win__legend">
        <span>Win</span>
        <span>Draw</span>
        <span>Win</span>
      </div>
    </>
  );
}

/**
 * Odds pane — pre-match projection model for the matchup. Win probability
 * (CLT approximation over the two XIs' forecast distributions), team expected
 * goals / assists / clean sheets, and the players most likely to return.
 * Joins the live card squads to the static forecast via draft element ids.
 *
 * @param {{ homeSquad: object, awaySquad: object, homeId: number, awayId: number,
 *           homeName: string, awayName: string, ctx: object }} props
 */
export function LiveFixtureOdds({ homeSquad, awaySquad, homeId, awayId, homeName, awayName, ctx }) {
  const { predictions, loading } = usePredictions();

  const model = useMemo(() => {
    if (!predictions?.players?.length) return null;
    const byId = predictionsById(predictions);
    const homeIds = teamXiElementIds(homeSquad);
    const awayIds = teamXiElementIds(awaySquad);
    const homeDist = teamForecastDistribution(byId, homeIds);
    const awayDist = teamForecastDistribution(byId, awayIds);
    if (homeDist.matched === 0 && awayDist.matched === 0) return null;
    return {
      gameweek: predictions.gameweek ?? null,
      probs: h2hWinProbs(homeDist, awayDist),
      homeDist,
      awayDist,
      homeTotals: teamOddsTotals(byId, homeIds),
      awayTotals: teamOddsTotals(byId, awayIds),
      returns: mostLikelyToReturn(byId, homeIds, awayIds, 3),
    };
  }, [predictions, homeSquad, awaySquad]);

  if (loading) {
    return <p className="lfc-h2h__empty">Loading projections…</p>;
  }
  if (!model) {
    return <p className="lfc-h2h__empty">Projections aren’t available for this matchup yet.</p>;
  }

  // The forecast targets one upcoming gameweek; flag when the viewed GW differs.
  const gwMismatch =
    model.gameweek != null && ctx?.gameweek != null && Number(model.gameweek) !== Number(ctx.gameweek);

  const { probs, homeDist, awayDist, homeTotals, awayTotals, returns } = model;
  const sideName = (side) => (side === 'home' ? homeName : awayName);

  return (
    <>
      {gwMismatch ? (
        <p className="lfc-odds__note">Pre-match projections shown are for GW{model.gameweek}.</p>
      ) : null}

      <div className="lfc-block">
        <WinBar probs={probs} homeName={homeName} awayName={awayName} />
      </div>

      <div className="lfc-block">
        <LiveFixtureCompareRow
          label="Projected pts"
          home={homeDist.mu}
          away={awayDist.mu}
          homeText={homeDist.mu.toFixed(1)}
          awayText={awayDist.mu.toFixed(1)}
        />
        <LiveFixtureCompareRow
          label="Expected goals"
          home={homeTotals.expGoals}
          away={awayTotals.expGoals}
          homeText={homeTotals.expGoals.toFixed(1)}
          awayText={awayTotals.expGoals.toFixed(1)}
        />
        <LiveFixtureCompareRow
          label="Expected assists"
          home={homeTotals.expAssists}
          away={awayTotals.expAssists}
          homeText={homeTotals.expAssists.toFixed(1)}
          awayText={awayTotals.expAssists.toFixed(1)}
        />
        <LiveFixtureCompareRow
          label="Expected CS"
          home={homeTotals.expCs}
          away={awayTotals.expCs}
          homeText={homeTotals.expCs.toFixed(1)}
          awayText={awayTotals.expCs.toFixed(1)}
        />
      </div>

      <div className="lfc-block">
        <h3 className="lfc-block__h">Most likely to return</h3>
        {returns.length === 0 ? (
          <p className="lfc-h2h__empty">No projected returns.</p>
        ) : (
          returns.map((r) => (
            <div className="lfc-pick" key={r.id}>
              <span className="lfc-pick__badge">
                <TeamAvatar
                  entryId={r.side === 'home' ? homeId : awayId}
                  name={sideName(r.side)}
                  size="sm"
                  logoMap={ctx?.teamLogoMap}
                  kitIndexByEntry={ctx?.kitIndexByEntry}
                />
              </span>
              <span className="lfc-pick__name">
                {r.name}
                <PosPill pos={r.position} />
              </span>
              <span className="lfc-pick__chip">Return {r.returnPct}%</span>
            </div>
          ))
        )}
      </div>
    </>
  );
}

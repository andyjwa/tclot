import { useMemo, useState } from 'react';
import { TeamAvatar } from './TeamAvatar';
import { LiveFixtureCompareRow } from './LiveFixtureKeyStats.jsx';
import { usePredictions } from './usePredictions.js';
import { predictionsById, h2hWinProbs } from './forecastHelpers.js';
import { effectiveStartersForCard } from './liveFixtureCardDerivations.js';
import { teamProjection, teamReturns, anyFixtureLive } from './liveBlend.js';

/** Route chip glyph + colour class for a player's likeliest return. */
const ROUTE = {
  goal: { text: '⚽', cls: 'lfc-rt--goal' },
  assist: { text: 'A', cls: 'lfc-rt--assist' },
  cs: { text: 'CS', cls: 'lfc-rt--cs' },
};

/** Three-segment win-probability bar (home win / draw / away win). */
function WinBar({ probs, homeName, awayName, live }) {
  const segs = [
    { key: 'h', pct: probs.homeWinPct, cls: 'lfc-win__seg--h' },
    { key: 'd', pct: probs.drawPct, cls: 'lfc-win__seg--d' },
    { key: 'a', pct: probs.awayWinPct, cls: 'lfc-win__seg--a' },
  ];
  return (
    <>
      <div className="lfc-win__teams">
        <span className="lfc-win__team">{homeName}</span>
        <span className="lfc-win__cap">
          {live ? <span className="lfc-win__dot" /> : null}
          Win probability
        </span>
        <span className="lfc-win__team">{awayName}</span>
      </div>
      <div className="lfc-win__bar">
        {segs.map((s) => (
          <span key={s.key} className={'lfc-win__seg ' + s.cls} style={{ width: `${s.pct}%` }}>
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

/** One manager's column in the "most likely to return" grid. */
function ReturnsColumn({ entryId, name, picks, ctx }) {
  return (
    <div className="lfc-ret__col">
      <div className="lfc-ret__team">
        <span className="lfc-ret__badge">
          <TeamAvatar
            entryId={entryId}
            name={name}
            size="sm"
            logoMap={ctx?.teamLogoMap}
            kitIndexByEntry={ctx?.kitIndexByEntry}
          />
        </span>
        <span className="lfc-ret__teamname">{name}</span>
      </div>
      {picks.length === 0 ? (
        <p className="lfc-ret__empty">No likely returns.</p>
      ) : (
        picks.map((p) => {
          const route = ROUTE[p.route] ?? ROUTE.goal;
          return (
            <div className="lfc-ret__row" key={p.id}>
              <span className="lfc-ret__name">{p.name}</span>
              <span className={'lfc-ret__chip ' + route.cls}>
                {route.text} {p.returnPct}%
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}

/**
 * Odds pane — win probability + projection model for the matchup, with a
 * Live / Pre-Match switcher.
 *
 * Before kick-off the switcher defaults to Pre-Match with Live disabled. Once
 * the first fixture goes live it auto-flips to Live (the user can still toggle
 * back). Live numbers blend each player's banked stats with the time-scaled
 * remainder of their forecast (see `liveBlend.js`); Pre-Match is the frozen
 * pre-deadline forecast. Joins the live card squads to the static forecast via
 * the draft element id.
 *
 * @param {{ homeSquad: object, awaySquad: object, homeId: number, awayId: number,
 *           homeName: string, awayName: string, ctx: object }} props
 */
export function LiveFixtureOdds({ homeSquad, awaySquad, homeId, awayId, homeName, awayName, ctx }) {
  const { predictions, loading } = usePredictions();
  const [modeOverride, setModeOverride] = useState(null);

  const model = useMemo(() => {
    if (!predictions?.players?.length) return null;
    const byId = predictionsById(predictions);
    const homeRows = effectiveStartersForCard(homeSquad);
    const awayRows = effectiveStartersForCard(awaySquad);
    const gw = predictions.gameweek ?? null;
    const gwMismatch = gw != null && ctx?.gameweek != null && Number(gw) !== Number(ctx.gameweek);
    const live = !gwMismatch && anyFixtureLive(homeRows, awayRows);
    const build = (mode) => ({
      home: teamProjection(homeRows, byId, mode),
      away: teamProjection(awayRows, byId, mode),
      homeReturns: teamReturns(homeRows, byId, mode, 'home', 3),
      awayReturns: teamReturns(awayRows, byId, mode, 'away', 3),
    });
    const pre = build('prematch');
    if (pre.home.matched === 0 && pre.away.matched === 0) return null;
    return { gameweek: gw, gwMismatch, live, pre, liveData: live ? build('live') : null };
  }, [predictions, homeSquad, awaySquad, ctx]);

  if (loading) {
    return <p className="lfc-h2h__empty">Loading projections…</p>;
  }
  if (!model) {
    return <p className="lfc-h2h__empty">Projections aren’t available for this matchup yet.</p>;
  }

  const liveUnlocked = model.live;
  const mode = modeOverride && (modeOverride === 'prematch' || liveUnlocked)
    ? modeOverride
    : liveUnlocked
      ? 'live'
      : 'prematch';
  const isLive = mode === 'live';
  const data = isLive && model.liveData ? model.liveData : model.pre;
  const probs = h2hWinProbs(data.home, data.away);
  const f1 = (v) => (Number(v) || 0).toFixed(1);

  return (
    <>
      {model.gwMismatch ? (
        <p className="lfc-odds__note">Projections shown are the pre-match forecast for GW{model.gameweek}.</p>
      ) : null}

      <div className="lfc-block">
        <WinBar probs={probs} homeName={homeName} awayName={awayName} live={isLive} />
      </div>

      <div className="lfc-block">
        <div className="lfc-seg" role="tablist" aria-label="Projection mode">
          <button
            type="button"
            role="tab"
            aria-selected={isLive}
            disabled={!liveUnlocked}
            className={
              'lfc-seg__btn' + (isLive ? ' is-active is-live' : '') + (liveUnlocked ? '' : ' is-disabled')
            }
            onClick={() => setModeOverride('live')}
          >
            {liveUnlocked ? '● Live' : 'Live'}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isLive}
            className={'lfc-seg__btn' + (!isLive ? ' is-active' : '')}
            onClick={() => setModeOverride('prematch')}
          >
            Pre-Match
          </button>
        </div>
        {!liveUnlocked ? (
          <p className="lfc-seg__hint">Live updates unlock once the first match kicks off</p>
        ) : null}

        {(() => {
          const accent = isLive ? 'lfc-cmp--live' : undefined;
          return (
            <>
              <LiveFixtureCompareRow
                className={accent}
                label={isLive ? 'Projected pts' : 'Predicted pts'}
                home={data.home.mu}
                away={data.away.mu}
                homeText={f1(data.home.mu)}
                awayText={f1(data.away.mu)}
              />
              <LiveFixtureCompareRow
                className={accent}
                label="Expected goals"
                home={data.home.goals}
                away={data.away.goals}
                homeText={f1(data.home.goals)}
                awayText={f1(data.away.goals)}
              />
              <LiveFixtureCompareRow
                className={accent}
                label="Expected assists"
                home={data.home.assists}
                away={data.away.assists}
                homeText={f1(data.home.assists)}
                awayText={f1(data.away.assists)}
              />
              <LiveFixtureCompareRow
                className={accent}
                label="Expected clean sheets"
                home={data.home.cs}
                away={data.away.cs}
                homeText={f1(data.home.cs)}
                awayText={f1(data.away.cs)}
              />
              <LiveFixtureCompareRow
                className={accent}
                label="Def con points"
                home={data.home.defcon}
                away={data.away.defcon}
                homeText={f1(data.home.defcon)}
                awayText={f1(data.away.defcon)}
              />
            </>
          );
        })()}
      </div>

      <div className="lfc-block">
        <h3 className="lfc-block__h lfc-block__h--left">Most likely to return</h3>
        <div className="lfc-ret__cols">
          <ReturnsColumn entryId={homeId} name={homeName} picks={data.homeReturns} ctx={ctx} />
          <ReturnsColumn entryId={awayId} name={awayName} picks={data.awayReturns} ctx={ctx} />
        </div>
      </div>
    </>
  );
}

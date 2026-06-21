import { useMemo, useState } from 'react';
import { TeamAvatar } from './TeamAvatar';
import { LiveFixtureCompareRow } from './LiveFixtureKeyStats.jsx';
import { usePredictions } from './usePredictions.js';
import { useGwProjectionsHistory } from './useGwProjectionsHistory.js';
import { predictionsById, h2hWinProbs, finishedMatchupOdds } from './forecastHelpers.js';
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
 * Odds pane dispatcher. A finished gameweek is served from the archived
 * per-GW projection snapshot (what was forecast vs how it settled); the current
 * /upcoming gameweek uses the live per-player blend. Kept as a thin wrapper so
 * each branch owns its own hooks (no conditional-hook violations).
 *
 * @param {{ homeSquad: object, awaySquad: object, homeId: number, awayId: number,
 *           homeName: string, awayName: string, ctx: object }} props
 */
export function LiveFixtureOdds(props) {
  if (props.ctx?.gwFinished) {
    return (
      <FinishedGwOdds
        gw={props.ctx?.gameweek}
        homeId={props.homeId}
        awayId={props.awayId}
        homeName={props.homeName}
        awayName={props.awayName}
        ctx={props.ctx}
      />
    );
  }
  return <CurrentGwOdds {...props} />;
}

/**
 * Finished-gameweek Odds — from `projections-history/gw-NN.json`. Defaults to the
 * Final result (projMc win bar collapses to the actual outcome) with a toggle back
 * to the Pre-Match forecast that was made before kick-off.
 */
function FinishedGwOdds({ gw, homeId, awayId, homeName, awayName }) {
  const { history, loading } = useGwProjectionsHistory(gw, true);
  const [view, setView] = useState('final');

  const m = useMemo(() => finishedMatchupOdds(history, homeId, awayId), [history, homeId, awayId]);

  if (loading) {
    return <p className="lfc-h2h__empty">Loading projections…</p>;
  }
  if (!m) {
    return <p className="lfc-h2h__empty">Projections aren’t available for this matchup.</p>;
  }

  const isFinal = view === 'final';
  const d = isFinal ? m.final : m.preMatch;
  const f1 = (v) => (Number(v) || 0).toFixed(1);
  /** Actuals are whole goals/assists/CS/def-con; pre-match are expected decimals. */
  const fmt = isFinal ? (v) => String(Math.round(Number(v) || 0)) : f1;
  const stats = d.stats;

  return (
    <div className="lfc-odds">
      <p className="lfc-odds__note">
        {isFinal ? `Final result for GW${gw}.` : `Pre-match forecast for GW${gw}.`}
      </p>

      <div className="lfc-block">
        <WinBar probs={d.probs} homeName={homeName} awayName={awayName} live={false} />
      </div>

      <div className="lfc-block">
        <div className="lfc-seg" role="tablist" aria-label="Projection view">
          <button
            type="button"
            role="tab"
            aria-selected={isFinal}
            className={'lfc-seg__btn' + (isFinal ? ' is-active' : '')}
            onClick={() => setView('final')}
          >
            Final
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isFinal}
            className={'lfc-seg__btn' + (!isFinal ? ' is-active' : '')}
            onClick={() => setView('prematch')}
          >
            Pre-Match
          </button>
        </div>
        <LiveFixtureCompareRow
          label={isFinal ? 'Final pts' : 'Predicted pts'}
          home={d.homePts}
          away={d.awayPts}
          homeText={f1(d.homePts)}
          awayText={f1(d.awayPts)}
        />
        {stats ? (
          <>
            <LiveFixtureCompareRow
              label={isFinal ? 'Goals' : 'Expected goals'}
              home={stats.goals.home}
              away={stats.goals.away}
              homeText={fmt(stats.goals.home)}
              awayText={fmt(stats.goals.away)}
            />
            <LiveFixtureCompareRow
              label={isFinal ? 'Assists' : 'Expected assists'}
              home={stats.assists.home}
              away={stats.assists.away}
              homeText={fmt(stats.assists.home)}
              awayText={fmt(stats.assists.away)}
            />
            <LiveFixtureCompareRow
              label={isFinal ? 'Clean sheets' : 'Expected clean sheets'}
              home={stats.cs.home}
              away={stats.cs.away}
              homeText={fmt(stats.cs.home)}
              awayText={fmt(stats.cs.away)}
            />
            <LiveFixtureCompareRow
              label="Def con points"
              home={stats.defcon.home}
              away={stats.defcon.away}
              homeText={fmt(stats.defcon.home)}
              awayText={fmt(stats.defcon.away)}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Current / upcoming gameweek Odds — win probability + projection model with a
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
function CurrentGwOdds({ homeSquad, awaySquad, homeId, awayId, homeName, awayName, ctx }) {
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
    <div className="lfc-odds">
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
    </div>
  );
}

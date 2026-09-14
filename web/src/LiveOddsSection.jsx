import { useMemo, useState } from 'react';
import { LiveFixtureCompareRow } from './LiveFixtureKeyStats.jsx';
import { TeamAvatar } from './TeamAvatar';
import { MatchupMeta, MatchupHeader } from './MatchupScorecard.jsx';
import { usePredictions } from './usePredictions.js';
import { useModelCalibration } from './useModelCalibration.js';
import { predictionsById, h2hWinProbs } from './forecastHelpers.js';
import { effectiveStartersForCard } from './liveFixtureCardDerivations.js';
import { teamProjection, teamReturns, anyFixtureLive } from './liveBlend.js';
import { probToFractionalOdds } from './oddsFormat.js';
import './LiveFixtureCard.css';
import './LiveOddsSection.css';

/** Route chip glyph + colour class — mirrors the fixture-card Odds tab. */
const ROUTE = {
  goal: { text: '⚽', cls: 'lfc-rt--goal' },
  assist: { text: 'A', cls: 'lfc-rt--assist' },
  cs: { text: 'CS', cls: 'lfc-rt--cs' },
};

/** Home / draw / away percentages + favourite test, shared by both rows. */
function probParts(probs) {
  const h = Number(probs.homeWinPct) || 0;
  const d = Number(probs.drawPct) || 0;
  const a = Number(probs.awayWinPct) || 0;
  const max = Math.max(h, d, a);
  return { h, d, a, fav: (pct) => max > 0 && pct === max };
}

/**
 * Collapsed-card headline (odds-format mockup "H1"): fair FRACTIONAL ODDS
 * as text at the two ends of the quiet 7px three-segment strip
 * (home / draw / away), the draw price as a small caption in the middle,
 * favourite (highest probability, ties share it) coloured to MATCH the
 * strip's favourite segment. The card carries one bookie-style price per
 * outcome; the percentages behind them move to the expanded body
 * ({@link WinChanceRow}) and the strip still encodes the balance visually.
 */
function OddsStrip({ probs, homeName, awayName }) {
  const { h, d, a, fav } = probParts(probs);
  const fh = probToFractionalOdds(h) ?? '—';
  const fd = probToFractionalOdds(d) ?? '—';
  const fa = probToFractionalOdds(a) ?? '—';
  return (
    <>
      <div
        className="lo-pcts"
        aria-label={`Fair odds — ${homeName} ${fh}, draw ${fd}, ${awayName} ${fa}`}
      >
        <span className={'lo-pcts__side' + (fav(h) ? ' lo-pcts__side--fav' : '')}>
          {fh}
          <span className="lo-pcts__w">win</span>
        </span>
        <span className="lo-pcts__draw">draw {fd}</span>
        <span className={'lo-pcts__side' + (fav(a) ? ' lo-pcts__side--fav' : '')}>
          <span className="lo-pcts__w">win</span>
          {fa}
        </span>
      </div>
      <div className="lo-strip" aria-hidden="true">
        <span
          className={'lo-strip__seg' + (fav(h) ? ' lo-strip__seg--fav' : '')}
          style={{ width: `${h}%` }}
        />
        <span
          className={'lo-strip__seg' + (fav(d) ? ' lo-strip__seg--fav' : '')}
          style={{ width: `${d}%` }}
        />
        <span
          className={'lo-strip__seg' + (fav(a) ? ' lo-strip__seg--fav' : '')}
          style={{ width: `${a}%` }}
        />
      </div>
    </>
  );
}

/**
 * "Win chance" row inside the expanded body — the percentages behind the
 * card's fractional prices, same text treatment as the headline row
 * (favourite in the brand accent, draw as a small centre caption).
 */
function WinChanceRow({ probs, homeName, awayName }) {
  const { h, d, a, fav } = probParts(probs);
  return (
    <div
      className="lo-pcts lo-pcts--body"
      aria-label={`Win chance — ${homeName} ${Math.round(h)}%, draw ${Math.round(d)}%, ${awayName} ${Math.round(a)}%`}
    >
      <span className={'lo-pcts__side' + (fav(h) ? ' lo-pcts__side--fav' : '')}>
        {Math.round(h)}%<span className="lo-pcts__w">win</span>
      </span>
      <span className="lo-pcts__draw">draw {Math.round(d)}%</span>
      <span className={'lo-pcts__side' + (fav(a) ? ' lo-pcts__side--fav' : '')}>
        <span className="lo-pcts__w">win</span>
        {Math.round(a)}%
      </span>
    </div>
  );
}

/** One manager's "most likely to return" column — mirrors the Odds tab. */
function ReturnsColumn({ entryId, name, picks, teamLogoMap, kitIndexByEntry }) {
  return (
    <div className="lfc-ret__col">
      <div className="lfc-ret__team">
        <span className="lfc-ret__badge">
          <TeamAvatar
            entryId={entryId}
            name={name}
            size="sm"
            logoMap={teamLogoMap}
            kitIndexByEntry={kitIndexByEntry}
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
 * "Live Odds" tile for the Scores tab — sits below the Points Feed and
 * collects every H2H matchup's odds in one place.
 *
 * Each matchup renders the mockup-C2 header ({@link MatchupHeader}: crests
 * on the outer edges, fitted last-word team names, centred score with the
 * winner glass pill) over the headline **live** fair fractional odds
 * flanking a quiet hairline strip ({@link OddsStrip}). Tapping a matchup
 * expands it to the "Win chance" percentages ({@link WinChanceRow}),
 * Projected points (Live and Pre-Match compare rows, same accents as the
 * fixture-card Odds tab) and "Most likely to return" route chips (always
 * the pre-match forecast, as on the Odds tab).
 *
 * Before the first kick-off the headline falls back to the pre-match
 * forecast (no live dot, no Live row). Renders nothing for finished
 * gameweeks (the fixture card's Odds tab covers the settled view) or when
 * the forecast payload is missing.
 *
 * @param {{
 *   fixtures: Array<object>,   // cardFixtures rows from LiveScores
 *   gameweek: number | null,
 *   gwFinished: boolean,
 *   teamLogoMap: object,
 *   kitIndexByEntry?: object,
 *   liveRankByEntry?: object,  // entry id → unique live place (1–8)
 * }} props
 */
export function LiveOddsSection({
  fixtures,
  gameweek,
  gwFinished,
  teamLogoMap,
  kitIndexByEntry,
  liveRankByEntry,
}) {
  const { predictions, loading } = usePredictions();
  const sigmaScale = useModelCalibration();
  const [openKeys, setOpenKeys] = useState(() => new Set());

  const computed = useMemo(() => {
    if (gwFinished) return null;
    if (!predictions?.players?.length) return null;
    if (!fixtures?.length) return null;
    const byId = predictionsById(predictions);
    const gw = predictions.gameweek ?? null;
    const gwMismatch =
      gw != null && gameweek != null && Number(gw) !== Number(gameweek);
    const models = new Map();
    for (const f of fixtures) {
      const { homeSquad, awaySquad } = f;
      if (!homeSquad || homeSquad.error || !awaySquad || awaySquad.error) continue;
      const homeRows = effectiveStartersForCard(homeSquad);
      const awayRows = effectiveStartersForCard(awaySquad);
      const live = !gwMismatch && anyFixtureLive(homeRows, awayRows);
      const pre = {
        home: teamProjection(homeRows, byId, 'prematch'),
        away: teamProjection(awayRows, byId, 'prematch'),
      };
      if (pre.home.matched === 0 && pre.away.matched === 0) continue;
      const liveData = live
        ? {
            home: teamProjection(homeRows, byId, 'live'),
            away: teamProjection(awayRows, byId, 'live'),
          }
        : null;
      const headline = liveData ?? pre;
      models.set(f.key, {
        live,
        probs: h2hWinProbs(headline.home, headline.away, 0.5, sigmaScale),
        pre,
        liveData,
        homeReturns: teamReturns(homeRows, byId, 'prematch', 'home', 3),
        awayReturns: teamReturns(awayRows, byId, 'prematch', 'away', 3),
      });
    }
    if (models.size === 0) return null;
    return { gwMismatch, forecastGw: gw, models };
  }, [predictions, fixtures, gameweek, gwFinished, sigmaScale]);

  if (loading || !computed) return null;

  const anyLive = [...computed.models.values()].some((m) => m.live);
  const f1 = (v) => (Number(v) || 0).toFixed(1);
  const toggle = (key) =>
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <section
      className="tile tile--compact live-odds-tile"
      aria-labelledby="live-odds-heading"
    >
      <div className="tile-head-row tile-head-row--tight lo-head-row">
        <h2 id="live-odds-heading" className="tile-title tile-title--sm lo-title">
          {anyLive ? <span className="lo-live-dot" aria-hidden="true" /> : null}
          Live Odds
        </h2>
        <span className="lo-gwcap">
          GW{gameweek}
          {anyLive ? ' · updates live' : ''}
        </span>
      </div>
      {computed.gwMismatch ? (
        <p className="lo-sub muted">
          {`Projections shown are the pre-match forecast for GW${computed.forecastGw}.`}
        </p>
      ) : null}

      {fixtures.map((f) => {
        const model = computed.models.get(f.key);
        if (!model) return null;
        const isOpen = openKeys.has(f.key);
        const bodyId = `lo-body-${f.key}`;
        return (
          <div
            key={f.key}
            className={'lo-matchup' + (isOpen ? ' lo-matchup--open' : '')}
          >
            <button
              type="button"
              className="lo-matchup__head"
              onClick={() => toggle(f.key)}
              aria-expanded={isOpen}
              aria-controls={bodyId}
            >
              <MatchupMeta fixture={f} liveRankByEntry={liveRankByEntry} />
              <MatchupHeader
                fixture={f}
                teamLogoMap={teamLogoMap}
                kitIndexByEntry={kitIndexByEntry}
              />
              <OddsStrip
                probs={model.probs}
                homeName={f.homeName}
                awayName={f.awayName}
              />
            </button>
            {isOpen ? (
              <div className="lo-matchup__body" id={bodyId}>
                <h3 className="lfc-block__h lfc-block__h--left">Win chance</h3>
                <WinChanceRow
                  probs={model.probs}
                  homeName={f.homeName}
                  awayName={f.awayName}
                />
                <h3 className="lfc-block__h lfc-block__h--left">
                  Projected points
                </h3>
                {model.live && model.liveData ? (
                  <LiveFixtureCompareRow
                    className="lfc-cmp--live"
                    label="Live"
                    home={model.liveData.home.mu}
                    away={model.liveData.away.mu}
                    homeText={f1(model.liveData.home.mu)}
                    awayText={f1(model.liveData.away.mu)}
                  />
                ) : null}
                <LiveFixtureCompareRow
                  label="Pre-Match"
                  home={model.pre.home.mu}
                  away={model.pre.away.mu}
                  homeText={f1(model.pre.home.mu)}
                  awayText={f1(model.pre.away.mu)}
                />
                {!model.live ? (
                  <p className="lfc-seg__hint">
                    Live projections unlock once the first match kicks off
                  </p>
                ) : null}
                <h3 className="lfc-block__h lfc-block__h--left lo-matchup__ret-h">
                  Most likely to return
                </h3>
                <div className="lfc-ret__cols">
                  <ReturnsColumn
                    entryId={f.homeId}
                    name={f.homeName}
                    picks={model.homeReturns}
                    teamLogoMap={teamLogoMap}
                    kitIndexByEntry={kitIndexByEntry}
                  />
                  <ReturnsColumn
                    entryId={f.awayId}
                    name={f.awayName}
                    picks={model.awayReturns}
                    teamLogoMap={teamLogoMap}
                    kitIndexByEntry={kitIndexByEntry}
                  />
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

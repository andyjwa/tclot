import { useMemo, useState, useCallback } from 'react';
import { DEFAULT_MODEL_CONFIG } from 'fpl-predictions';
import { TeamAvatar } from './TeamAvatar';
import { fplElementFullName } from './fplElementNames';
import { ClickablePlayerName } from './PlayerHistoryContext.jsx';
import {
  bootstrapElementToPlayer,
  bootstrapTeamToPredictionTeam,
  predictedXpForPickRow,
  sumPredictedXpForPickRows,
  simulateFantasyH2hPercents,
  simulateFantasyH2hPercentsFromProjBlends,
} from './livePredictionMappers.js';
import {
  monteCarloBlendFromLiveBlend,
  projectedGwTotalLiveBlendForElement,
} from './liveGwMidProjection.js';
import { countElementGamesLeftToPlay } from './fplBonusFromBps.js';

const UI_MODEL_CONFIG = {
  ...DEFAULT_MODEL_CONFIG,
  simulationIterations: 450,
};

const H2H_MONTE_CARLO_ITERS = 2000;

/** Deterministic-ish PRNG so live polling does not reshuffle projection cells. */
function rngFor(playerId, fixtureId) {
  let a =
    Math.imul(Number(fixtureId) || 0, 0x9e3779b9) ^
    Math.imul(Number(playerId) || 0, 0x85ebca6b);
  return function rnd() {
    a |= 0;
    a = (a + 0x6d2b79fd) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function formatPct(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${Math.round(n)}%`;
}

function formatXp(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return (Math.round(n * 10) / 10).toFixed(1);
}

/** Projected GW totals: round to nearest whole number for display. */
function formatProj(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return String(Math.round(n));
}

/** "+", "-", or "=" vs model xPts; null when inputs missing. */
function formatVsXpSign(xPts, projFinal) {
  if (!Number.isFinite(xPts) || !Number.isFinite(projFinal)) return null;
  if (projFinal > xPts) return '+';
  if (projFinal < xPts) return '-';
  return '=';
}

function vsXpCellTitle(xPts, projFinal) {
  const sign = formatVsXpSign(xPts, projFinal);
  if (sign === '+') return 'Above expected points (xPts)';
  if (sign === '-') return 'Below expected points (xPts)';
  if (sign === '=') return 'Matched expected points (xPts)';
  return undefined;
}

const POS_ABBREV = { 1: 'G', 2: 'D', 3: 'M', 4: 'F' };

function posLetterAbbrev(pos) {
  if (pos == null) return '—';
  if (typeof pos === 'string') {
    const up = pos.toUpperCase();
    const m = { GK: 'G', G: 'G', DEF: 'D', D: 'D', MID: 'M', M: 'M', FWD: 'F', F: 'F', FORWARD: 'F' };
    const v = m[up];
    if (v) return v;
  }
  const n = Number(pos);
  if (Number.isFinite(n)) return POS_ABBREV[n] ?? '—';
  return '—';
}

function ProjectionPlayerTable({ rows, teamName }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return (
      <p className="muted muted--tight live-fixture-proj-players__empty">
        Starter XI not available — need 11 draft picks with projection data.
      </p>
    );
  }
  const nameCol = teamName?.trim() || 'Team';
  return (
    <div className="table-scroll live-fixture-proj-players">
      <table className="live-fixture-proj-players__table">
        <thead>
          <tr>
            <th scope="col" className="live-fixture-proj-players__th-team">
              {nameCol}
            </th>
            <th className="col-pos tabular" scope="col" title="Position">
              Pos
            </th>
            <th
              className="tabular live-fixture-proj-players__th-num"
              scope="col"
              title="Expected points (model XI)"
            >
              xPts
            </th>
            <th
              className="tabular live-fixture-proj-players__th-num live-fixture-proj-players__th-proj"
              scope="col"
              title="Projected gameweek total — or actual points when the GW is scoring live"
            >
              Proj/Actual
            </th>
            <th
              className="tabular live-fixture-proj-players__th-vs-xp"
              scope="col"
              title="Above (+), below (-), or matched (=) expected points (xPts)"
              aria-label="Versus expected points"
            >
              ±
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.elementId}
              className={
                r.fixtureComplete
                  ? 'live-fixture-proj-players__row live-fixture-proj-players__row--played'
                  : 'live-fixture-proj-players__row live-fixture-proj-players__row--fixture-left'
              }
              title={
                r.fixtureComplete
                  ? 'Club fixture(s) for this GW finished for FPL scoring'
                  : 'Still has club fixture minutes to come this GW'
              }
            >
              <td className="live-fixture-proj-players__name">
                <ClickablePlayerName
                  element={r.elementId}
                  displayName={r.displayName}
                  web_name={r.web_name}
                >
                  {r.displayName}
                </ClickablePlayerName>
              </td>
              <td className="col-pos tabular muted">{posLetterAbbrev(r.pos)}</td>
              <td className="tabular live-fixture-proj-players__num">{formatXp(r.xPts)}</td>
              <td className="tabular live-fixture-proj-players__num">
                {r.projFinal != null && Number.isFinite(r.projFinal) ? formatProj(r.projFinal) : '—'}
              </td>
              <td
                className="tabular live-fixture-proj-players__vs-xp"
                title={vsXpCellTitle(r.xPts, r.projFinal)}
              >
                {formatVsXpSign(r.xPts, r.projFinal) ?? ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Sum full-GW Proj for picks; null if any pick missing from elements or blend throws.
 * @param {object[]} picks
 */
function sumProjForPicks(picks, ctx, teamsById, gw, blendCtx, liveByEl) {
  let sum = 0;
  for (let i = 0; i < picks.length; i++) {
    const pr = picks[i];
    const pid = Number(pr?.element);
    const elPick = ctx.elementById?.[pid];
    if (!elPick) return null;
    try {
      const blend = projectedGwTotalLiveBlendForElement(
        elPick,
        blendCtx,
        teamsById,
        gw,
        UI_MODEL_CONFIG,
        liveByEl[pid],
        rngFor(pid, 990_011 + gw + i * 31 + Math.imul(picks.length, 997)),
        320,
        Number(pr?.fplMultiplier) || 1,
      );
      sum += monteCarloBlendFromLiveBlend(blend, pr).projFinal;
    } catch {
      return null;
    }
  }
  return sum;
}

/**
 * Per-player Proj blends for 11 starters (same construction as Live tab win %).
 * @returns {Array<{ projFinal: number, remaining: number }> | null}
 */
function buildProjBlendsForPicks(picks, ctx, teamsById, gw, blendCtx, liveByEl) {
  if (!Array.isArray(picks) || picks.length !== 11) return null;
  const blends = [];
  for (let i = 0; i < 11; i++) {
    const pid = Number(picks[i]?.element);
    const el = ctx.elementById?.[pid];
    if (!el) return null;
    try {
      const blend = projectedGwTotalLiveBlendForElement(
        el,
        blendCtx,
        teamsById,
        gw,
        UI_MODEL_CONFIG,
        liveByEl[pid],
        rngFor(pid, 990_011 + gw + i * 31),
        320,
        Number(picks[i]?.fplMultiplier) || 1,
      );
      blends.push(monteCarloBlendFromLiveBlend(blend, picks[i]));
    } catch {
      return null;
    }
  }
  return blends;
}

function buildProjectionPlayerLines(starters, ctx, teamsById, gw, blendCtx, liveByEl, gwFxList) {
  if (!Array.isArray(starters) || starters.length !== 11) return [];
  const fixtures = Array.isArray(gwFxList) ? gwFxList : [];
  const out = [];
  for (let i = 0; i < starters.length; i++) {
    const pr = starters[i];
    const pid = Number(pr?.element);
    const el = ctx.elementById?.[pid];
    if (!el) continue;
    const mult = Number(pr.fplMultiplier) || 1;
    const xPtsBase = predictedXpForPickRow(pr, ctx, teamsById, gw, UI_MODEL_CONFIG, i);
    const xPts =
      xPtsBase != null && Number.isFinite(xPtsBase) ? xPtsBase * mult : xPtsBase;
    let projFinal = null;
    try {
      const blend = projectedGwTotalLiveBlendForElement(
        el,
        blendCtx,
        teamsById,
        gw,
        UI_MODEL_CONFIG,
        liveByEl[pid],
        rngFor(pid, 990_011 + gw + i * 31),
        320,
        mult,
      );
      projFinal = monteCarloBlendFromLiveBlend(blend, pr).projFinal;
    } catch {
      /* partial row */
    }
    const pos = bootstrapElementToPlayer(el).position;
    const liveRow = liveByEl[pid];
    const tid = Number(el.team);
    const aggMins = Number(liveRow?.stats?.minutes ?? 0);
    const gamesLeft = countElementGamesLeftToPlay(
      el,
      liveRow,
      fixtures,
      Number.isFinite(tid) ? tid : null,
      aggMins,
    );
    out.push({
      elementId: pid,
      web_name: el.web_name?.trim() || `Player ${pid}`,
      pos,
      xPts,
      projFinal,
      displayName: fplElementFullName(el, pid),
      fixtureComplete: gamesLeft === 0,
    });
  }
  return out;
}

/**
 * @param {{
 *   contributionLiveContext: null | {
 *     elementById: Record<number, object>,
 *     teamById: Record<number, object>,
 *     gwFixtures: object[],
 *     liveFullByElementId?: Record<number, object>,
 *   },
 *   gameweek: number,
 *   gwMatches?: Array<{ league_entry_1: number, league_entry_2: number }>,
 *   squads?: Array<{
 *     leagueEntryId: number,
 *     displayStarters?: object[],
 *   }>,
 *   teams?: Array<{ id: number, teamName: string }>,
 *   teamLogoMap?: Record<string, string>,
 *   kitIndexByEntry?: Record<number | string, number>,
 *   liveRankByEntry?: Record<number | string, number | undefined>,
 * }} props
 */
export function LiveProjectionsPanel({
  contributionLiveContext,
  gameweek,
  gwMatches = [],
  squads = [],
  teams = [],
  teamLogoMap = {},
  kitIndexByEntry,
  liveRankByEntry = {},
}) {
  const payload = useMemo(() => {
    const ctx = contributionLiveContext;
    if (!ctx?.elementById) {
      return { kind: 'empty', reason: 'no-data' };
    }
    const gw = Number(gameweek);
    if (!Number.isFinite(gw)) return { kind: 'empty', reason: 'no-gw' };

    const allFx = Array.isArray(ctx.gwFixtures) ? ctx.gwFixtures : [];
    if (!allFx.length) {
      return { kind: 'empty', reason: 'no-fixtures' };
    }

    const teamsById = new Map();
    for (const t of Object.values(ctx.teamById || {})) {
      const tm = bootstrapTeamToPredictionTeam(t);
      teamsById.set(tm.id, tm);
    }

    const squadByEntry = new Map();
    for (const s of squads) {
      squadByEntry.set(Number(s.leagueEntryId), s);
    }
    const nameByEntry = new Map(
      (teams || []).map((t) => [Number(t.id), t.teamName || `Entry ${t.id}`]),
    );

    const liveByEl = ctx.liveFullByElementId || {};
    const blendCtxH2h = { gwFixtures: allFx };
    /** Win % from live Proj MC only after at least one PL fixture is final this GW; until then, xPts MC. */
    const plGwHasFinishedFixture = allFx.some(
      (f) => f?.finished === true || f?.finished_provisional === true,
    );

    const rankOf = (eid) => {
      const v = liveRankByEntry?.[eid] ?? liveRankByEntry?.[String(eid)];
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    /** @type {{ key: string, homeEntryId: number, awayEntryId: number, homeName: string, awayName: string, homeWinPctXp: number, drawPctXp: number, awayWinPctXp: number, homeWinPctProj: number | null, drawPctProj: number | null, awayWinPctProj: number | null, homeXpLabel: string, awayXpLabel: string, homeProjLabel: string, awayProjLabel: string }[]} */
    const h2hRows = [];
    /** @type {Array<{
     *   key: string,
     *   homeId: number,
     *   awayId: number,
     *   homeName: string,
     *   awayName: string,
     *   homeRank: number | null,
     *   awayRank: number | null,
     *   homeWinPct: number,
     *   awayWinPct: number,
     *   drawPct: number,
     *   winPctIsLive: boolean,
     *   homeXp: number | null,
     *   awayXp: number | null,
     *   homeProj: number | null,
     *   awayProj: number | null,
     *   homePlayers: object[],
     *   awayPlayers: object[],
     * }>} */
    const fixtureProjectionRows = [];

    for (const m of gwMatches || []) {
      const homeId = Number(m.league_entry_1);
      const awayId = Number(m.league_entry_2);
      if (!Number.isFinite(homeId) || !Number.isFinite(awayId)) continue;
      const sqH = squadByEntry.get(homeId);
      const sqA = squadByEntry.get(awayId);
      const stH = sqH?.displayStarters;
      const stA = sqA?.displayStarters;

      let homeXiXp = null;
      let awayXiXp = null;
      if (Array.isArray(stH) && stH.length === 11) {
        homeXiXp = sumPredictedXpForPickRows(stH, ctx, teamsById, gw, UI_MODEL_CONFIG, 11);
      }
      if (Array.isArray(stA) && stA.length === 11) {
        awayXiXp = sumPredictedXpForPickRows(stA, ctx, teamsById, gw, UI_MODEL_CONFIG, 511);
      }
      let homeProjXi = null;
      if (Array.isArray(stH) && stH.length === 11) {
        homeProjXi = sumProjForPicks(stH, ctx, teamsById, gw, blendCtxH2h, liveByEl);
      }
      let awayProjXi = null;
      if (Array.isArray(stA) && stA.length === 11) {
        awayProjXi = sumProjForPicks(stA, ctx, teamsById, gw, blendCtxH2h, liveByEl);
      }

      const rnd = rngFor(homeId, awayId);
      let pctXp = null;
      if (
        Array.isArray(stH) &&
        stH.length === 11 &&
        Array.isArray(stA) &&
        stA.length === 11
      ) {
        pctXp = simulateFantasyH2hPercents(
          stH,
          stA,
          ctx,
          teamsById,
          gw,
          UI_MODEL_CONFIG,
          rnd,
          H2H_MONTE_CARLO_ITERS,
        );
      }

      let pctProj = null;
      if (
        plGwHasFinishedFixture &&
        Array.isArray(stH) &&
        stH.length === 11 &&
        Array.isArray(stA) &&
        stA.length === 11
      ) {
        const hBlends = buildProjBlendsForPicks(
          stH,
          ctx,
          teamsById,
          gw,
          blendCtxH2h,
          liveByEl,
        );
        const aBlends = buildProjBlendsForPicks(
          stA,
          ctx,
          teamsById,
          gw,
          blendCtxH2h,
          liveByEl,
        );
        if (hBlends && aBlends) {
          pctProj = simulateFantasyH2hPercentsFromProjBlends(
            hBlends,
            aBlends,
            rnd,
            H2H_MONTE_CARLO_ITERS,
          );
        }
      }

      if (!pctXp) continue;

      const primaryPct = pctProj ?? pctXp;
      const winPctIsLive = Boolean(pctProj);
      const homeName = nameByEntry.get(homeId) ?? `Entry ${homeId}`;
      const awayName = nameByEntry.get(awayId) ?? `Entry ${awayId}`;
      const rowKey = `${homeId}-${awayId}-${gw}`;

      h2hRows.push({
        key: rowKey,
        homeEntryId: homeId,
        awayEntryId: awayId,
        homeName,
        awayName,
        homeWinPctXp: pctXp.homeWinPct,
        drawPctXp: pctXp.drawPct,
        awayWinPctXp: pctXp.awayWinPct,
        homeWinPctProj: pctProj?.homeWinPct ?? null,
        drawPctProj: pctProj?.drawPct ?? null,
        awayWinPctProj: pctProj?.awayWinPct ?? null,
        homeXpLabel: formatXp(homeXiXp),
        awayXpLabel: formatXp(awayXiXp),
        homeProjLabel: formatProj(homeProjXi),
        awayProjLabel: formatProj(awayProjXi),
      });

      const homePlayers =
        Array.isArray(stH) && stH.length === 11
          ? buildProjectionPlayerLines(stH, ctx, teamsById, gw, blendCtxH2h, liveByEl, allFx)
          : [];
      const awayPlayers =
        Array.isArray(stA) && stA.length === 11
          ? buildProjectionPlayerLines(stA, ctx, teamsById, gw, blendCtxH2h, liveByEl, allFx)
          : [];

      fixtureProjectionRows.push({
        key: rowKey,
        homeId,
        awayId,
        homeName,
        awayName,
        homeRank: rankOf(homeId),
        awayRank: rankOf(awayId),
        homeWinPct: primaryPct.homeWinPct,
        awayWinPct: primaryPct.awayWinPct,
        drawPct: primaryPct.drawPct,
        winPctIsLive,
        homeXp: homeXiXp,
        awayXp: awayXiXp,
        homeProj: homeProjXi,
        awayProj: awayProjXi,
        homePlayers,
        awayPlayers,
      });
    }

    return { kind: 'ok', h2hRows, fixtureProjectionRows, plGwHasFinishedFixture };
  }, [contributionLiveContext, gameweek, gwMatches, squads, teams, liveRankByEntry]);

  const [expandedFixtureProj, setExpandedFixtureProj] = useState(() => new Set());

  const toggleFixtureProjection = useCallback((key) => {
    setExpandedFixtureProj((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  if (payload.kind !== 'ok') {
    if (payload.reason === 'no-data' || payload.reason === 'no-gw') return null;
    const msg =
      payload.reason === 'no-fixtures'
        ? 'No Premier League fixtures listed for this gameweek (wait for live data to load, or pick another GW).'
        : null;
    if (!msg) return null;
    return (
      <section
        className="tile tile--compact live-projections"
        aria-labelledby="live-projections-heading"
      >
        <div className="tile-head-row tile-head-row--tight">
          <h2 id="live-projections-heading" className="tile-title tile-title--sm">
            Game Week Predictions/Projections
          </h2>
        </div>
        <p className="muted muted--tight">{msg}</p>
      </section>
    );
  }

  return (
    <>
      <section
        className="tile tile--compact live-projections"
        aria-labelledby="live-projections-heading"
      >
      <div className="tile-head-row tile-head-row--tight">
        <h2 id="live-projections-heading" className="tile-title tile-title--sm">
          Game Week Predictions/Projections
        </h2>
        <span className="league-pill league-pill--sm">GW {gameweek}</span>
      </div>

      {payload.h2hRows?.length ? (
        <div className="live-projections-h2h-wrap">
          <ul className="live-projections-h2h-cards" aria-label="Head-to-head projections">
            {payload.h2hRows.map((r) => (
              <li key={r.key}>
                <article
                  className="live-projections-h2h-card"
                  title={`Draw ${formatPct(r.drawPctXp)} (xPts MC)${
                    r.drawPctProj != null
                      ? ` · Draw ${formatPct(r.drawPctProj)} (Proj MC)`
                      : ''
                  }`}
                >
                  <div className="live-projections-h2h-card__grid live-projections-h2h-card__grid--head muted">
                    <span className="live-projections-h2h-card__teamcell live-projections-h2h-card__teamcell--head">
                      Team
                    </span>
                    <span
                      className="live-projections-h2h-card__stat tabular live-projections-h2h-card__stat--group-exp"
                      title="Expected XI (model)"
                    >
                      xPts
                    </span>
                    <span
                      className="live-projections-h2h-card__stat tabular live-projections-h2h-card__stat--group-exp live-projections-h2h-card__stat--pct"
                      title="Win % from xPts Monte Carlo"
                    >
                      xWin%
                    </span>
                    <span
                      className="live-projections-h2h-card__stat tabular live-projections-h2h-card__stat--group-proj live-projections-h2h-card__stat--proj-region-start"
                      title="Projected GW total (live blend)"
                    >
                      Proj pts
                    </span>
                    <span
                      className="live-projections-h2h-card__stat tabular live-projections-h2h-card__stat--group-proj live-projections-h2h-card__stat--pct"
                      title="Win % from projected GW totals (Monte Carlo) — shown after a PL fixture is final this GW"
                    >
                      Proj %
                    </span>
                  </div>
                  <div className="live-projections-h2h-card__grid">
                    <span className="live-projections-h2h-card__teamcell">
                      <span className="live-projections-h2h-card__ava">
                        <TeamAvatar
                          entryId={r.homeEntryId}
                          name={r.homeName}
                          size="sm"
                          logoMap={teamLogoMap}
                          kitIndexByEntry={kitIndexByEntry}
                        />
                      </span>
                      <span className="live-projections-h2h-card__teamname">{r.homeName}</span>
                    </span>
                    <span className="live-projections-h2h-card__stat tabular live-projections-h2h-card__stat--group-exp">
                      {r.homeXpLabel}
                    </span>
                    <span className="live-projections-h2h-card__stat tabular live-projections-h2h-card__stat--group-exp live-projections-h2h-card__stat--pct">
                      {formatPct(r.homeWinPctXp)}
                    </span>
                    <span className="live-projections-h2h-card__stat tabular live-projections-h2h-card__stat--group-proj live-projections-h2h-card__stat--proj-region-start">
                      {r.homeProjLabel}
                    </span>
                    <span className="live-projections-h2h-card__stat tabular live-projections-h2h-card__stat--group-proj live-projections-h2h-card__stat--pct">
                      {formatPct(r.homeWinPctProj)}
                    </span>
                  </div>
                  <div className="live-projections-h2h-card__grid">
                    <span className="live-projections-h2h-card__teamcell">
                      <span className="live-projections-h2h-card__ava">
                        <TeamAvatar
                          entryId={r.awayEntryId}
                          name={r.awayName}
                          size="sm"
                          logoMap={teamLogoMap}
                          kitIndexByEntry={kitIndexByEntry}
                        />
                      </span>
                      <span className="live-projections-h2h-card__teamname">{r.awayName}</span>
                    </span>
                    <span className="live-projections-h2h-card__stat tabular live-projections-h2h-card__stat--group-exp">
                      {r.awayXpLabel}
                    </span>
                    <span className="live-projections-h2h-card__stat tabular live-projections-h2h-card__stat--group-exp live-projections-h2h-card__stat--pct">
                      {formatPct(r.awayWinPctXp)}
                    </span>
                    <span className="live-projections-h2h-card__stat tabular live-projections-h2h-card__stat--group-proj live-projections-h2h-card__stat--proj-region-start">
                      {r.awayProjLabel}
                    </span>
                    <span className="live-projections-h2h-card__stat tabular live-projections-h2h-card__stat--group-proj live-projections-h2h-card__stat--pct">
                      {formatPct(r.awayWinPctProj)}
                    </span>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      </section>

      {payload.fixtureProjectionRows?.length ? (
        <section
          className="tile tile--compact live-fixture-projections"
          aria-labelledby="fixture-projections-heading"
        >
          <div className="tile-head-row tile-head-row--tight">
            <h2 id="fixture-projections-heading" className="tile-title tile-title--sm">
              Fixture Projections
            </h2>
            <span className="league-pill league-pill--sm">GW {gameweek}</span>
          </div>
          <div
            className="live-fixture-projections__list"
            role="list"
            aria-label="Projected head-to-head fixtures"
          >
            {payload.fixtureProjectionRows.map((fx) => {
              const lineupOpen = expandedFixtureProj.has(fx.key);
              const fixtureBodyId = `fixture-proj-${fx.key}`;
              const useProjBanner = payload.plGwHasFinishedFixture === true;
              const homeXpLead =
                fx.homeXp != null &&
                fx.awayXp != null &&
                Number(fx.homeXp) > Number(fx.awayXp);
              const awayXpLead =
                fx.homeXp != null &&
                fx.awayXp != null &&
                Number(fx.awayXp) > Number(fx.homeXp);
              const homeProjLead =
                fx.homeProj != null &&
                fx.awayProj != null &&
                Number(fx.homeProj) > Number(fx.awayProj);
              const awayProjLead =
                fx.homeProj != null &&
                fx.awayProj != null &&
                Number(fx.awayProj) > Number(fx.homeProj);
              const homeNameLead = useProjBanner ? homeProjLead : homeXpLead;
              const awayNameLead = useProjBanner ? awayProjLead : awayXpLead;

              return (
                <section
                  key={fx.key}
                  className="tile tile--compact live-fixture-tile live-fixture-tile--projections"
                  role="listitem"
                >
                  <button
                    type="button"
                    className="live-fixture-banner live-fixture-banner--toggle"
                    onClick={() => toggleFixtureProjection(fx.key)}
                    aria-expanded={lineupOpen}
                    aria-controls={fixtureBodyId}
                  >
                    <span className="live-fixture-chevron live-fixture-chevron--desktop" aria-hidden>
                      {lineupOpen ? '▼' : '▶'}
                    </span>
                    <span className="live-fixture-banner__row">
                      <span className="live-fixture-banner__team live-fixture-banner__team--home">
                        <span className="live-fixture-banner__team-cluster live-fixture-banner__team-cluster--home">
                          <span
                            className={
                              'live-fixture-banner__win-pct live-fixture-banner__win-pct--home tabular' +
                              (fx.winPctIsLive ? ' live-fixture-banner__win-pct--live' : '')
                            }
                            title={
                              fx.winPctIsLive
                                ? 'Home win % (live Proj MC)'
                                : 'Home win % (xPts MC)'
                            }
                            aria-label={`Home win ${Math.round(fx.homeWinPct)}%`}
                          >
                            {formatPct(fx.homeWinPct)}
                          </span>
                          <span className="live-fixture-banner__team-avatar">
                            <TeamAvatar
                              entryId={fx.homeId}
                              name={fx.homeName}
                              size="sm"
                              logoMap={teamLogoMap}
                              kitIndexByEntry={kitIndexByEntry}
                            />
                          </span>
                          <span className="live-fixture-banner__team-text live-fixture-banner__team-text--home">
                            <span className="live-fixture-banner__team-inner">
                              <span className="live-fixture-banner__name-line">
                                <span
                                  className={`live-fixture-banner__name ${homeNameLead ? 'live-fixture-banner__name--lead' : ''}`}
                                >
                                  {fx.homeName}
                                </span>
                              </span>
                              {fx.homeRank != null ? (
                                <span className="live-fixture-banner__ltp-line tabular muted">
                                  ({fx.homeRank})
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </span>
                      </span>

                      <span className="live-fixture-banner__vs-sep" aria-hidden="true">
                        vs
                      </span>

                      <span
                        className="live-fixture-banner__scorebox"
                        aria-label={
                          useProjBanner
                            ? 'Projected gameweek totals (XI)'
                            : 'Expected points (XI)'
                        }
                      >
                        <div
                          className={
                            'live-fixture-banner__proj-dual' +
                            (useProjBanner
                              ? ' live-fixture-banner__proj-dual--proj-only'
                              : ' live-fixture-banner__proj-dual--xp-only')
                          }
                        >
                          {!useProjBanner ? (
                            <>
                              <span className="live-fixture-banner__live-score tabular">
                                <span className={homeXpLead ? 'live-fixture-pts--lead' : ''}>
                                  {formatXp(fx.homeXp)}
                                </span>
                                <span className="live-fixture-banner__dash">–</span>
                                <span className={awayXpLead ? 'live-fixture-pts--lead' : ''}>
                                  {formatXp(fx.awayXp)}
                                </span>
                              </span>
                              <span className="muted live-fixture-banner__score-caption">
                                xPts (XI)
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="live-fixture-banner__live-score live-fixture-banner__live-score--proj tabular">
                                <span className={homeProjLead ? 'live-fixture-pts--lead' : ''}>
                                  {formatProj(fx.homeProj)}
                                </span>
                                <span className="live-fixture-banner__dash">–</span>
                                <span className={awayProjLead ? 'live-fixture-pts--lead' : ''}>
                                  {formatProj(fx.awayProj)}
                                </span>
                              </span>
                              <span className="muted live-fixture-banner__score-caption">
                                Proj (GW)
                              </span>
                            </>
                          )}
                        </div>
                      </span>

                      <span className="live-fixture-banner__team live-fixture-banner__team--away">
                        <span className="live-fixture-banner__team-cluster live-fixture-banner__team-cluster--away">
                          <span className="live-fixture-banner__team-text live-fixture-banner__team-text--away">
                            <span className="live-fixture-banner__team-inner">
                              <span className="live-fixture-banner__name-line">
                                <span
                                  className={`live-fixture-banner__name ${awayNameLead ? 'live-fixture-banner__name--lead' : ''}`}
                                >
                                  {fx.awayName}
                                </span>
                              </span>
                              {fx.awayRank != null ? (
                                <span className="live-fixture-banner__ltp-line tabular muted">
                                  ({fx.awayRank})
                                </span>
                              ) : null}
                            </span>
                          </span>
                          <span className="live-fixture-banner__team-avatar">
                            <TeamAvatar
                              entryId={fx.awayId}
                              name={fx.awayName}
                              size="sm"
                              logoMap={teamLogoMap}
                              kitIndexByEntry={kitIndexByEntry}
                            />
                          </span>
                          <span
                            className={
                              'live-fixture-banner__win-pct live-fixture-banner__win-pct--away tabular' +
                              (fx.winPctIsLive ? ' live-fixture-banner__win-pct--live' : '')
                            }
                            title={
                              fx.winPctIsLive
                                ? 'Away win % (live Proj MC)'
                                : 'Away win % (xPts MC)'
                            }
                            aria-label={`Away win ${Math.round(fx.awayWinPct)}%`}
                          >
                            {formatPct(fx.awayWinPct)}
                          </span>
                        </span>
                      </span>
                    </span>
                    <span className="live-fixture-banner__expand-foot">
                      <span className="live-fixture-chevron live-fixture-chevron--mobile" aria-hidden>
                        {!lineupOpen ? '▼' : '▲'}
                      </span>
                    </span>
                  </button>

                  {lineupOpen ? (
                    <div className="live-fixture-expanded-body" id={fixtureBodyId}>
                      <div className="live-fixture-split">
                        <div className="live-fixture-column">
                          <ProjectionPlayerTable rows={fx.homePlayers} teamName={fx.homeName} />
                        </div>
                        <div className="live-fixture-divider" aria-hidden="true" />
                        <div className="live-fixture-column">
                          <ProjectionPlayerTable rows={fx.awayPlayers} teamName={fx.awayName} />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        </section>
      ) : null}
    </>
  );
}

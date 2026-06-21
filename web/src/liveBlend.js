/**
 * Live-blended Odds projections for the live fixture card.
 *
 * The static `predictions.json` forecast is a *pre-deadline* estimate that never
 * changes during the gameweek. These helpers blend it with the live squad rows
 * (banked points + match progress) so the Odds tab can show a projection that
 * tracks the game: points already scored are locked in, and only the remaining
 * portion of each player's match is still modelled.
 *
 * Two modes:
 *   - 'prematch' — pure forecast (ignores live data); mirrors the pre-deadline numbers.
 *   - 'live'     — per-player blend of banked stats + time-scaled remaining forecast.
 *
 * All functions are pure so the blend can be unit-tested without React.
 */
import { dcThresholdReached } from './liveScoresDerivations.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0));
const clamp01 = (v) => clamp(v, 0, 1);

/** CS-point eligible positions (forwards never earn clean-sheet points). */
function csEligible(position) {
  return position === 'GK' || position === 'DEF' || position === 'MID';
}

/**
 * Likeliest return route for a player from their (live or pre-match) expected
 * goal / assist / clean-sheet contributions. Clean sheet is only a candidate
 * for CS-eligible positions.
 */
export function routeOf(goals, assists, cs, position) {
  const opts = [
    ['goal', Number(goals) || 0],
    ['assist', Number(assists) || 0],
  ];
  if (csEligible(position)) opts.push(['cs', Number(cs) || 0]);
  opts.sort((a, b) => b[1] - a[1]);
  return opts[0][0];
}

/**
 * Phase of a player's gameweek from the live row:
 *   - 'upcoming' — club fixture hasn't kicked off (no minutes, still to play)
 *   - 'live'     — on the pitch with minutes still to come
 *   - 'done'     — club fixture(s) finished (or player took no part)
 */
export function playerPhase(row) {
  const mins = Number(row?.minutes) || 0;
  const stillToCome = !!row?.stillYetToPlayPl && row?.clubGwFixturesFinished !== true;
  if (!stillToCome) return 'done';
  return mins > 0 ? 'live' : 'upcoming';
}

/**
 * Blend one player's pre-match forecast with their live row.
 *
 * @param {object|null} row   live squad starter (null/ignored in 'prematch' mode)
 * @param {{ position?: string, forecast?: object }} player prediction player
 * @param {'live'|'prematch'} mode
 * @returns {{ phase: string, points: number, goals: number, assists: number,
 *             cs: number, defcon: number, sigma: number, returnProb: number, route: string }}
 */
export function blendPlayer(row, player, mode = 'live') {
  const f = player?.forecast || {};
  const position = player?.position;
  const bd = f.breakdown || {};
  const prob = f.probabilities || {};
  const out = f.outcomes || {};

  const xpFull = Number(f.totalPoints) || 0;
  const goalLk = clamp01(prob.goalLikelihood);
  const assistLk = clamp01(prob.assistLikelihood);
  const csPct = clamp01((Number(prob.cleanSheetPct) || 0) / 100);
  const csElig = csEligible(position) && csPct > 0;
  const defconFull = Number(bd.defensiveContribution) || 0;
  const p10 = Number(f.percentiles?.p10);
  const p90 = Number(f.percentiles?.p90);
  // p90 − p10 spans ~2.563σ of a normal; fall back to 0 spread when absent.
  const sdFull =
    Number.isFinite(p90) && Number.isFinite(p10) ? Math.max(0, (p90 - p10) / 2.563) : 0;
  const retFull = clamp01(out.returns);

  const preMatch = {
    phase: 'prematch',
    points: xpFull,
    goals: goalLk,
    assists: assistLk,
    cs: csElig ? csPct : 0,
    defcon: defconFull,
    sigma: sdFull,
    returnProb: retFull,
    route: routeOf(goalLk, assistLk, csElig ? csPct : 0, position),
  };

  if (mode === 'prematch' || !row) return preMatch;

  const phase = playerPhase(row);
  if (phase === 'upcoming') return { ...preMatch, phase };

  const mins = Number(row.minutes) || 0;
  const banked = Number(row.total_points) || 0;
  const gActual = Number(row.goalsScored) || 0;
  const aActual = Number(row.assists) || 0;
  const conceded = Number(row.goalsConceded) || 0;
  const dcReached = dcThresholdReached(row.posSingular, row.dcCount);

  const minsLeft = phase === 'done' ? 0 : clamp(90 - mins, 0, 90);
  const rem = minsLeft / 90;

  // Appearance points are essentially banked once a player is on the pitch, so
  // only the variable (event-driven) part of the forecast is scaled by the
  // remaining match time and added on top of what's already scored.
  const variableFull = Math.max(0, xpFull - (Number(bd.minutes) || 0));
  const points = phase === 'done' ? banked : banked + rem * variableFull;

  const goals = phase === 'done' ? gActual : gActual + rem * goalLk;
  const assists = phase === 'done' ? aActual : aActual + rem * assistLk;

  // Time-aware clean sheet: once conceded it's gone; otherwise the chance of
  // holding it rises as the clock runs down. Model remaining goals conceded as
  // Poisson with rate scaled by minutes left, so P(hold) = exp(−λ · rem) and
  // λ is recovered from the pre-match CS probability (csPct = exp(−λ)).
  let cs = 0;
  if (csElig) {
    if (conceded > 0) cs = 0;
    else if (phase === 'done') cs = 1;
    else {
      const lambda = csPct >= 1 ? 0 : -Math.log(csPct);
      cs = Math.exp(-lambda * rem);
    }
  }

  const defcon = dcReached ? 2 : phase === 'done' ? 0 : defconFull;
  const sigma = phase === 'done' ? 0 : rem * sdFull;
  const returnProb = banked >= 6 ? 1 : phase === 'done' ? 0 : clamp01(retFull * rem);

  return {
    phase,
    points,
    goals,
    assists,
    cs,
    defcon,
    sigma,
    returnProb,
    route: routeOf(goals, assists, cs, position),
  };
}

/**
 * Aggregate a team's effective XI into a scoring distribution + expected stat
 * totals for the win bar and compare rows.
 *
 * @param {object[]} rows   effective XI live rows
 * @param {Map<number, object>} byId  predictions player map (id → player)
 * @param {'live'|'prematch'} mode
 * @returns {{ mu:number, sigma:number, goals:number, assists:number, cs:number, defcon:number, matched:number }}
 */
export function teamProjection(rows = [], byId, mode = 'live') {
  let mu = 0;
  let variance = 0;
  let goals = 0;
  let assists = 0;
  let cs = 0;
  let defcon = 0;
  let matched = 0;
  for (const row of rows) {
    const id = Number(row?.element ?? row?.elementId);
    const player = byId?.get(id);
    if (!player?.forecast) continue;
    const b = blendPlayer(row, player, mode);
    mu += b.points;
    variance += b.sigma * b.sigma;
    goals += b.goals;
    assists += b.assists;
    cs += b.cs;
    defcon += b.defcon;
    matched += 1;
  }
  return { mu, sigma: Math.sqrt(variance), goals, assists, cs, defcon, matched };
}

/**
 * Top-N most-likely-to-return players for one team, ranked by return
 * probability (then projected points). Each carries its likeliest route.
 *
 * @returns {Array<{ id:number, side:string, name:string, position:string, returnPct:number, route:string }>}
 */
export function teamReturns(rows = [], byId, mode, side, n = 3) {
  const out = [];
  for (const row of rows) {
    const id = Number(row?.element ?? row?.elementId);
    const player = byId?.get(id);
    if (!player?.forecast) continue;
    const b = blendPlayer(row, player, mode);
    out.push({
      id,
      side,
      name: player.name,
      position: player.position,
      returnPct: Math.round(b.returnProb * 100),
      route: b.route,
      points: b.points,
    });
  }
  out.sort((a, b) => b.returnPct - a.returnPct || b.points - a.points);
  return out.slice(0, n);
}

/**
 * Has the matchup kicked off? True once any XI player has live minutes or their
 * club's gameweek fixture(s) have finished. Drives the Live/Pre-Match default.
 */
export function anyFixtureLive(homeRows = [], awayRows = []) {
  const rows = [...(homeRows || []), ...(awayRows || [])];
  return rows.some(
    (r) => (Number(r?.minutes) || 0) > 0 || r?.clubGwFixturesFinished === true,
  );
}

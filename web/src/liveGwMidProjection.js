/**
 * Mid-GW projected GW total: banked `stats.total_points` + expectation for unfinished
 * club fixtures (full prior before kickoff; scaled incremental MC in-play).
 */
import { buildRateBundle, predictForPlayerFromMap } from 'fpl-predictions';
import {
  bootstrapElementToPlayer,
  classicFixtureToPredictionFixture,
} from './livePredictionMappers.js';
import {
  explainBlocksFromLiveElement,
  fixturesForTeamInGw,
  isFixtureFullyDone,
} from './fplBonusFromBps.js';

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function goalPointsPerGoal(position) {
  if (position === 'GK' || position === 'DEF') return 6;
  if (position === 'MID') return 5;
  return 4;
}

function cleanSheetPointsIfEligible(position) {
  if (position === 'GK' || position === 'DEF') return 4;
  if (position === 'MID') return 1;
  return 0;
}

/** @param {() => number} rnd */
function samplePoisson(lambda, rnd) {
  const L = Math.max(0, lambda);
  if (L <= 0) return 0;
  const em = Math.exp(-L);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rnd();
  } while (p > em && k < 170);
  return k - 1;
}

function sampleBernoulli(p, rnd) {
  const x = Math.max(0, Math.min(1, p));
  return rnd() < x;
}

function sampleBonusWhole(expectedBonus, rnd) {
  const mu = Math.max(0, Math.min(2.5, expectedBonus));
  const p1 = Math.max(0, Math.min(0.55, mu / 3));
  const p2 = p1 * 0.45;
  const p3 = p2 * 0.35;
  const u = rnd();
  if (u < p3) return 3;
  if (u < p3 + p2) return 2;
  if (u < p3 + p2 + p1) return 1;
  return 0;
}

/**
 * Minutes FPL attributes to this classic `fixtureId` (per `explain`); else GW aggregate
 * when the club has only one GW fixture row.
 */
export function minutesPlayerInFixture(liveFullRow, fixtureId, teamId, gwFixtures) {
  const fid = Number(fixtureId);
  if (!Number.isFinite(fid)) return 0;
  for (const b of explainBlocksFromLiveElement(liveFullRow || {})) {
    if (Number(b.fixtureId) === fid) return Number(b.minutes) || 0;
  }
  const mine = fixturesForTeamInGw(gwFixtures || [], teamId);
  if (mine.length === 1) {
    return Number(liveFullRow?.stats?.minutes) || 0;
  }
  return 0;
}

/**
 * ~Share of a single PL match still open for incremental attacking/defensive events.
 */
export function remainingPlayFraction(rawFx, minsInThisFixture) {
  if (rawFx == null || isFixtureFullyDone(rawFx)) return 0;
  if (rawFx.started !== true) return 1;
  const clock = Number(rawFx.minutes) || 0;
  const remClock = Math.max(0, 96 - clock) / 90;
  const m = Number(minsInThisFixture) || 0;
  const remPlayer = m >= 90 ? 0 : Math.max(0, 90 - m) / 90;
  return clamp01(Math.min(remClock, remPlayer));
}

function meanIncrementalFromBundle(player, bundle, remFrac, minsInFx, iterations, rnd) {
  const r = clamp01(remFrac);
  if (r <= 1e-9) return 0;
  const gpg = goalPointsPerGoal(player.position);
  const csPts = cleanSheetPointsIfEligible(player.position);
  let sum = 0;
  const n = iterations;
  const lamG = bundle.lambdaGoals * r;
  const lamA = bundle.lambdaAssists * r;
  const lamSv = bundle.lambdaSaves * r;
  /** CS needs 60+ on pitch; crude weight when already mid-match. */
  const csTimeScale =
    minsInFx >= 60 ? 0 : clamp01(((90 - minsInFx) / 90) * r);
  for (let i = 0; i < n; i++) {
    let pts = 0;
    pts += samplePoisson(lamG, rnd) * gpg;
    pts += samplePoisson(lamA, rnd) * 3;
    if (player.position === 'GK') {
      pts += Math.floor(samplePoisson(lamSv, rnd) / 3);
    }
    if (sampleBernoulli(bundle.dcProbability * r, rnd)) pts += 2;
    if (
      csPts > 0 &&
      csTimeScale > 0 &&
      sampleBernoulli(bundle.cleanSheetProbability * csTimeScale, rnd)
    ) {
      pts += csPts;
    }
    if (sampleBernoulli(bundle.yellowP * r, rnd)) pts -= 1;
    if (sampleBernoulli(bundle.redP * r, rnd)) pts -= 3;
    if (sampleBernoulli(bundle.ownP * r, rnd)) pts -= 2;
    if (sampleBernoulli(bundle.penP * r, rnd)) pts -= 2;
    pts += sampleBonusWhole(bundle.expectedBonus * r, rnd);
    sum += pts;
  }
  return sum / n;
}

/**
 * @param {object} opts
 * @param {object} opts.player — fpl-predictions player
 * @param {Map<number, object>} opts.teamsById
 * @param {number} opts.gameweek
 * @param {object} opts.config
 * @param {{ gwFixtures?: object[] }} opts.ctx
 * @param {object | null | undefined} opts.liveFullRow
 * @param {() => number} opts.rnd
 * @param {number} [opts.incrementalIters=320]
 * @param {number} [opts.fplMultiplier=1] — draft captain (`picks[].multiplier`); scales banked + remaining.
 */
export function projectedGwTotalLiveBlend({
  player,
  teamsById,
  gameweek,
  config,
  ctx,
  liveFullRow,
  rnd,
  incrementalIters = 320,
  fplMultiplier = 1,
}) {
  const st = liveFullRow?.stats || {};
  const banked = Number(st.total_points);
  const bankedN = Number.isFinite(banked) ? banked : 0;
  const tid = player.teamId;
  const gw = Number(gameweek);
  const gwFx = (ctx?.gwFixtures || []).filter((f) => Number(f.event) === gw);
  const mine = fixturesForTeamInGw(gwFx, tid);

  let remaining = 0;
  for (const rawFx of mine) {
    if (isFixtureFullyDone(rawFx)) continue;
    const predFx = classicFixtureToPredictionFixture(rawFx, gw);
    const pt = teamsById.get(tid);
    const oppId =
      tid === predFx.homeTeamId ? predFx.awayTeamId : predFx.homeTeamId;
    const op = teamsById.get(oppId);
    if (!pt || !op) continue;

    const minsFx = minutesPlayerInFixture(liveFullRow, rawFx.id, tid, gwFx);
    const remFrac = remainingPlayFraction(rawFx, minsFx);

    if (remFrac >= 0.999) {
      remaining += predictForPlayerFromMap(
        player,
        predFx,
        teamsById,
        config,
        rnd,
      ).expectedPoints;
    } else if (remFrac > 1e-6) {
      const bundle = buildRateBundle(player, pt, op, predFx, config);
      remaining += meanIncrementalFromBundle(
        player,
        bundle,
        remFrac,
        minsFx,
        incrementalIters,
        rnd,
      );
    }
  }

  const multRaw = Number(fplMultiplier);
  const mult = Number.isFinite(multRaw) && multRaw > 0 ? multRaw : 1;

  return {
    banked: bankedN,
    remaining: remaining * mult,
    projFinal: (bankedN + remaining) * mult,
  };
}

export function projectedGwTotalLiveBlendForElement(
  element,
  ctx,
  teamsById,
  gameweek,
  config,
  liveFullRow,
  rnd,
  incrementalIters = 320,
  fplMultiplier = 1,
) {
  const player = bootstrapElementToPlayer(element);
  return projectedGwTotalLiveBlend({
    player,
    teamsById,
    gameweek,
    config,
    ctx,
    liveFullRow,
    rnd,
    incrementalIters,
    fplMultiplier,
  });
}

/**
 * Headline win-% Monte Carlo uses `{ projFinal, remaining }` per starter. When the Live tab
 * shows **no club fixtures left** for that pick (`playerGamesLeftToPlay` ≤ 0), treat the score
 * as **fully locked**: `remaining = 0` and `projFinal = banked × captain mult` only.
 *
 * Without this, `projectedGwTotalLiveBlend` can still attach small `remaining` while a PL
 * `fixtures` row is slow to flip to `finished` (or DGW edge cases), which puts stray Gaussian
 * noise on a “done” team and yields ~5–15% false hope.
 *
 * @returns {{ projFinal: number, remaining: number, gamesLeft: number }}
 */
export function monteCarloBlendFromLiveBlend(blend, pickRow) {
  const gl = Number(pickRow?.playerGamesLeftToPlay);

  if (!blend || typeof blend !== 'object') {
    return { projFinal: 0, remaining: 0, gamesLeft: gl };
  }

  if (!Number.isFinite(gl) || gl > 0) {
    return {
      projFinal: Number(blend.projFinal) || 0,
      remaining: Number(blend.remaining) || 0,
      gamesLeft: gl,
    };
  }
  const mult = Number(pickRow?.fplMultiplier) || 1;
  const banked = Number(blend.banked);
  const b = Number.isFinite(banked) ? banked : 0;
  return { projFinal: b * mult, remaining: 0, gamesLeft: gl };
}

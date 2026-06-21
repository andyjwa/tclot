/**
 * Map draft/bootstrap FPL payloads into `fpl-predictions` shapes and helpers.
 */
import {
  buildRateBundle,
  simulatePlayerGameweekPoints,
  predictForPlayerFromMap,
  predictMatchFixture,
} from 'fpl-predictions';

const POS_MAP = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };

/** Cache keyed by GW + fixture id + matchup + simulationIterations (single heavy run per slate). */
const matchFixtureProjectionCache = new Map();

/** Clear memoized `predictMatchFixture` results (e.g. after bootstrap swap in tests/hot reload). */
export function clearMatchFixtureProjectionCache() {
  matchFixtureProjectionCache.clear();
}

function matchFixtureProjectionCacheKey(gw, fixtureId, hId, aId, iterations) {
  return `${gw}|${fixtureId}|${hId}|${aId}|${iterations}`;
}

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

function parseNum(v) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Classic GW fixture row for a PL side (prefer in-play, else first unfinished).
 */
export function pickGwFixtureForTeam(teamId, gwFixtures, gameweek) {
  const tid = Number(teamId);
  const gw = Number(gameweek);
  const list = (gwFixtures || []).filter(
    (f) =>
      Number(f.event) === gw &&
      (Number(f.team_h) === tid || Number(f.team_a) === tid),
  );
  if (!list.length) return null;
  const live = list.find(isFixtureConsideredLive);
  if (live) return live;
  const undone = list.find((f) => f?.finished !== true);
  if (undone) return undone;
  return list[0];
}

/**
 * Approximate XI for classic pre-deadline projections: one GK + 10 outfielders ranked by starts then minutes.
 * @param {number} teamId — FPL bootstrap `teams[].id`
 * @param {object} elementById — map bootstrap `elements` keyed by numeric id strings
 * @returns {object[]} 11 bootstrap element rows or `[]` when data is insufficient
 */
export function pickLikelyClassicXiElements(teamId, elementById) {
  const tid = Number(teamId);
  if (!Number.isFinite(tid)) return [];
  const rows = [];
  const src = elementById ?? {};
  for (const v of Object.values(src)) {
    if (!v || v.removed) continue;
    if (Number(v.team) !== tid) continue;
    rows.push(v);
  }
  if (rows.length < 11) return [];
  const gks = rows
    .filter((e) => Number(e.element_type) === 1)
    .sort((a, b) => (Number(b.minutes) || 0) - (Number(a.minutes) || 0));
  const gk = gks[0];
  if (!gk) return [];
  const outfield = rows
    .filter((e) => Number(e.element_type) !== 1)
    .sort((a, b) => {
      const sb = Number(b.starts) || 0;
      const sa = Number(a.starts) || 0;
      if (sb !== sa) return sb - sa;
      return (Number(b.minutes) || 0) - (Number(a.minutes) || 0);
    });
  if (outfield.length < 10) return [];
  return [gk, ...outfield.slice(0, 10)];
}

/**
 * @param {object[]} starters — 11 pick rows (`element` ids)
 * @returns {{ players: object[], bundles: object[] } | null}
 */
export function buildLineupPlayersAndBundles(
  starters,
  ctx,
  teamsById,
  gameweek,
  config,
) {
  if (!Array.isArray(starters) || starters.length !== 11) return null;
  const players = [];
  const bundles = [];
  const gw = Number(gameweek);
  for (const row of starters) {
    const pid = Number(row.element);
    const el = ctx.elementById?.[pid];
    if (!el) return null;
    const player = bootstrapElementToPlayer(el);
    const rawFx = pickGwFixtureForTeam(player.teamId, ctx.gwFixtures, gw);
    if (!rawFx) return null;
    const predFx = classicFixtureToPredictionFixture(rawFx, gw);
    const pt = teamsById.get(player.teamId);
    const oppId =
      player.teamId === predFx.homeTeamId
        ? predFx.awayTeamId
        : predFx.homeTeamId;
    const op = teamsById.get(oppId);
    if (!pt || !op) return null;
    try {
      players.push(player);
      bundles.push(buildRateBundle(player, pt, op, predFx, config));
    } catch {
      return null;
    }
  }
  return { players, bundles };
}

/**
 * Monte Carlo P(side1 win), P(draw), P(side2 win) for draft H2H (no captain double).
 */
export function simulateFantasyH2hPercents(
  homeStarters,
  awayStarters,
  ctx,
  teamsById,
  gameweek,
  config,
  rnd,
  iterations = 2000,
) {
  const home = buildLineupPlayersAndBundles(
    homeStarters,
    ctx,
    teamsById,
    gameweek,
    config,
  );
  const away = buildLineupPlayersAndBundles(
    awayStarters,
    ctx,
    teamsById,
    gameweek,
    config,
  );
  if (!home || !away) return null;
  let wH = 0;
  let dr = 0;
  let wA = 0;
  const n = iterations;
  for (let i = 0; i < n; i++) {
    let sH = 0;
    let sA = 0;
    for (let j = 0; j < 11; j++) {
      sH +=
        simulatePlayerGameweekPoints(
          home.players[j],
          home.bundles[j],
          1,
          rnd,
        )[0] ?? 0;
      sA +=
        simulatePlayerGameweekPoints(
          away.players[j],
          away.bundles[j],
          1,
          rnd,
        )[0] ?? 0;
    }
    if (sH > sA) wH += 1;
    else if (sH < sA) wA += 1;
    else dr += 1;
  }
  return {
    homeWinPct: (wH / n) * 100,
    drawPct: (dr / n) * 100,
    awayWinPct: (wA / n) * 100,
  };
}

export function projectionRng(seedA, seedB) {
  let a =
    Math.imul(Number(seedA) || 0, 0x9e3779b9) ^
    Math.imul(Number(seedB) || 0, 0x85ebca6b);
  return function rnd() {
    a |= 0;
    a = (a + 0x6d2b79fd) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bench slots from squad payload (display effective bench when present). */
export function benchPicksFromSquad(squad) {
  if (!squad) return [];
  if (Array.isArray(squad.displayBench) && squad.displayBench.length > 0) {
    return squad.displayBench;
  }
  return Array.isArray(squad.bench) ? squad.bench : [];
}

/**
 * Full model `Prediction` for a single pick this GW (uses each player’s PL
 * fixture like the lineup sim). Prefers the match-level Monte Carlo when both
 * XIs can be reconstructed (bonus + correlated goals/clean sheets), else the
 * marginal predictor. Returns null on failure.
 * @param {number} salt — offsets RNG vs other rolls for the same player.
 */
export function predictionForPickRow(row, ctx, teamsById, gameweek, config, salt = 0) {
  try {
    const pid = Number(row?.element);
    if (!Number.isFinite(pid)) return null;
    const el = ctx.elementById?.[pid];
    if (!el) return null;
    const player = bootstrapElementToPlayer(el);
    const gw = Number(gameweek);
    const rawFx = pickGwFixtureForTeam(player.teamId, ctx.gwFixtures, gw);
    if (!rawFx) return null;
    const predFx = classicFixtureToPredictionFixture(rawFx, gw);
    const rnd = projectionRng(player.id + Number(salt) * 65_521, predFx.id);

    /** Match-level MC when we can reconstruct ~XI for both sides (bonus + correlated goals). */
    try {
      const hId = Number(predFx.homeTeamId);
      const aId = Number(predFx.awayTeamId);
      if (Number.isFinite(hId) && Number.isFinite(aId)) {
        const xiH = pickLikelyClassicXiElements(hId, ctx.elementById);
        const xiA = pickLikelyClassicXiElements(aId, ctx.elementById);
        if (xiH.length === 11 && xiA.length === 11) {
          const homePlayers = xiH.map(bootstrapElementToPlayer);
          const awayPlayers = xiA.map(bootstrapElementToPlayer);
          const iters = config?.simulationIterations ?? 8000;
          const ck = matchFixtureProjectionCacheKey(
            gw,
            predFx.id,
            hId,
            aId,
            iters,
          );
          let matchPreds = matchFixtureProjectionCache.get(ck);
          if (!matchPreds) {
            const matchRng = projectionRng(
              Number(predFx.id) + gw * 997,
              hId * 7919 + aId,
            );
            matchPreds = predictMatchFixture(
              homePlayers,
              awayPlayers,
              predFx,
              teamsById,
              config,
              matchRng,
            );
            matchFixtureProjectionCache.set(ck, matchPreds);
          }
          const picked = matchPreds.find((p) => p.playerId === pid);
          if (
            picked != null &&
            typeof picked.expectedPoints === 'number' &&
            Number.isFinite(picked.expectedPoints)
          )
            return picked;
        }
      }
    } catch {
      /* fall through to marginal predictor */
    }

    return predictForPlayerFromMap(player, predFx, teamsById, config, rnd);
  } catch {
    return null;
  }
}

/**
 * Single-pick model xPts for this GW (uses each player’s PL fixture like lineup sim).
 * @param {number} salt — offsets RNG vs other rolls for the same player.
 */
export function predictedXpForPickRow(row, ctx, teamsById, gameweek, config, salt = 0) {
  const pred = predictionForPickRow(row, ctx, teamsById, gameweek, config, salt);
  return pred != null && Number.isFinite(pred.expectedPoints) ? pred.expectedPoints : null;
}

/** Positions that can earn clean-sheet points (forwards never do). */
const STATS_CS_POSITIONS = new Set(['GK', 'DEF', 'MID']);

/**
 * Single-pick expected stat contributions for this GW, from the same model
 * Prediction as {@link predictedXpForPickRow}. Used to aggregate team-level
 * pre-match expected goals / assists / clean sheets / defensive-contribution
 * points for the archived projection snapshots.
 *
 * @returns {{ xp:number, goals:number, assists:number, cs:number, defcon:number } | null}
 */
export function predictedStatsForPickRow(row, ctx, teamsById, gameweek, config, salt = 0) {
  const pred = predictionForPickRow(row, ctx, teamsById, gameweek, config, salt);
  if (!pred) return null;
  const el = ctx.elementById?.[Number(row?.element)];
  const pos = POS_MAP[Number(el?.element_type)] ?? 'MID';
  const csEligible = STATS_CS_POSITIONS.has(pos);
  return {
    xp: Number(pred.expectedPoints) || 0,
    goals: Number(pred.goalProbability) || 0,
    assists: Number(pred.assistProbability) || 0,
    cs: csEligible ? Number(pred.cleanSheetProbability) || 0 : 0,
    defcon: Number(pred.breakdown?.defensiveContribution) || 0,
  };
}

export function sumPredictedXpForPickRows(
  picks,
  ctx,
  teamsById,
  gameweek,
  config,
  salt = 0,
) {
  if (!Array.isArray(picks) || !picks.length) return 0;
  let sum = 0;
  for (let i = 0; i < picks.length; i++) {
    const v = predictedXpForPickRow(picks[i], ctx, teamsById, gameweek, config, salt + i);
    if (v != null) sum += v;
  }
  return sum;
}

/** @param {object} bootTeam */
export function bootstrapTeamToPredictionTeam(bootTeam) {
  const id = Number(bootTeam.id);
  const name = bootTeam.name || `Team ${id}`;
  return {
    id,
    name,
    xGForPer90: 1.15,
    xGAgainstPer90: 1.15,
    goalsForPer90: 1.15,
    goalsAgainstPer90: 1.15,
    shotsForPer90: 12,
    shotsAgainstPer90: 12,
    cleanSheetRate: 0.28,
    homeAttackStrength: 1.05,
    awayAttackStrength: 0.95,
    homeDefenceStrength: 1.05,
    awayDefenceStrength: 0.95,
  };
}

/**
 * FPL classic bootstrap often sends `chance_of_playing_this_round: null` for available players.
 * `Number(null) === 0` would falsely treat them as maximally doubtful and crush xP / minutes.
 *
 * @param {object | null | undefined} el — bootstrap-style element (`status`, `chance_of_playing_this_round`)
 */
export function injuryDoubtScoreFromClassicElement(el) {
  if (el?.status === 'i') return 3;
  const raw = el?.chance_of_playing_this_round;
  if (raw === null || raw === undefined || raw === '') return 0;
  const c = Number(raw);
  if (!Number.isFinite(c)) return 0;
  if (c < 0 || c > 100) return 0;
  if (c < 100) return (100 - c) / 28;
  return 0;
}

/** @param {object} el — draft bootstrap element */
export function bootstrapElementToPlayer(el) {
  const mins = Math.max(1, Number(el.minutes) || 1);
  const ninety = mins / 90;
  const starts = Number(el.starts) || 0;
  const posId = Number(el.element_type);
  const position = POS_MAP[posId] ?? 'MID';
  const creativity = parseNum(el.creativity);
  const threat = parseNum(el.threat);
  const ict = parseNum(el.ict_index);
  const cbit = Number(el.clearances_blocks_interceptions) || 0;
  const tackles = Number(el.tackles) || 0;
  const rec = Number(el.recoveries) || 0;
  const yellows = Number(el.yellow_cards) || 0;
  const reds = Number(el.red_cards) || 0;
  const saves = Number(el.saves) || 0;
  const matchesPlayed = clamp(starts / 19, 0.05, 1);

  return {
    id: Number(el.id),
    name: String(el.web_name || el.first_name || `Player ${el.id}`),
    teamId: Number(el.team),
    position,
    price: 50,
    selectedByPercent: 0,
    recentStartRate: clamp(matchesPlayed, 0.05, 0.98),
    startsLast6: Math.round(starts * (6 / 19)),
    minutesLast6: Math.round(mins * (6 / 19)),
    xGPer90: parseNum(el.expected_goals) / ninety,
    xAPer90: parseNum(el.expected_assists) / ninety,
    shotsPer90: clamp((threat / 10 + creativity / 15) / ninety, 0, 8),
    shotsOnTargetPer90: clamp(threat / 25 / ninety, 0, 5),
    keyPassesPer90: clamp(creativity / 30 / ninety, 0, 6),
    ictPer90: ict / ninety,
    seasonIctPer90: ict / ninety,
    yellowCardsPer90: yellows / ninety,
    redCardsPer90: reds / ninety,
    savesPer90: saves / ninety,
    defensiveActionsPer90: (cbit + tackles * 0.6) / ninety,
    clearancesBlocksInterceptionsTacklesPer90: (cbit + tackles) / ninety,
    ballRecoveriesPer90: rec / ninety,
    injuryDoubtScore: injuryDoubtScoreFromClassicElement(el),
  };
}

/** Classic `fixtures` API row → prediction fixture. */
export function classicFixtureToPredictionFixture(f, gameweek) {
  return {
    id: Number(f.id),
    homeTeamId: Number(f.team_h),
    awayTeamId: Number(f.team_a),
    gameweek: Number(gameweek),
    kickoffTime: f.kickoff_time || new Date().toISOString(),
    homeWinOdds: f.team_h_odds ?? undefined,
    drawOdds: f.draw_odds ?? undefined,
    awayWinOdds: f.team_a_odds ?? undefined,
    over25Odds: f.over25_odds ?? undefined,
    under25Odds: f.under25_odds ?? undefined,
  };
}

export function isFixtureConsideredLive(f) {
  return f?.started === true && f?.finished !== true;
}

/** Box-Muller standard normal sample. */
function sampleStdGaussian(rnd) {
  const u1 = Math.max(1e-10, rnd());
  const u2 = rnd();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Monte Carlo H2H win % from per-player projected GW totals (live blend).
 * Each player's total is sampled as Normal(projFinal, sigma) where
 * sigma scales with **expected points still to come** (`remaining`), except
 * when classic fixtures/`explain` lag: if `gamesLeft` > 0 but `remaining` ≈ 0,
 * we keep a small minimum sigma so a side is not treated as mathematically dead
 * while the UI still shows fixtures to play.
 *
 * **Deterministic 100/0** is used only when **every** starter on **both** teams
 * has `gamesLeft` ≤ 0 (finite) and `remaining` noise is zero — i.e. same bar
 * as “no club fixtures left” on the Live tab, not merely `remaining` ≈ 0.
 *
 * If `opts.homeXiFixturesLeft` / `awayXiFixturesLeft` are set (effective XI
 * fixture slots remaining, same as banner `leftToPlayCount`), deterministic
 * mode is **skipped** when either is &gt; 0. That covers cases where per-pick
 * `playerGamesLeftToPlay` is wrong but the aggregate count is right.
 *
 * @param {Array<{projFinal: number, remaining: number, gamesLeft?: number}>} homeProjBlends
 * @param {Array<{projFinal: number, remaining: number, gamesLeft?: number}>} awayProjBlends
 * @param {() => number} rnd
 * @param {number} [iterations]
 * @param {{ homeXiFixturesLeft?: number | null, awayXiFixturesLeft?: number | null }} [opts]
 */
export function simulateFantasyH2hPercentsFromProjBlends(
  homeProjBlends,
  awayProjBlends,
  rnd,
  iterations = 1500,
  opts,
) {
  const nh = homeProjBlends.length;
  const na = awayProjBlends.length;
  if (nh === 0 || na === 0) return null;
  const n = iterations;
  let wH = 0;
  let dr = 0;
  let wA = 0;

  /** @param {number} gamesLeft — from `pick.playerGamesLeftToPlay` when available */
  const sigmaFor = (remaining, gamesLeft) => {
    const r = Math.max(0, Number(remaining) || 0);
    const gl = Number(gamesLeft);
    if (Number.isFinite(gl) && gl > 0 && r < 1e-3) {
      return Math.sqrt(1.5);
    }
    if (r < 1e-3) return 0;
    return Math.sqrt(r + 1.5);
  };

  const xiFullyDeterministic = (blends) => {
    if (!Array.isArray(blends) || blends.length === 0) return false;
    for (const b of blends) {
      const gl = Number(b.gamesLeft);
      if (!Number.isFinite(gl)) return false;
      if (gl > 0) return false;
      if (sigmaFor(Number(b.remaining) || 0, gl) > 0) return false;
    }
    return true;
  };

  let detH = 0;
  let detA = 0;
  for (let j = 0; j < nh; j++) {
    detH += homeProjBlends[j].projFinal;
  }
  for (let j = 0; j < na; j++) {
    detA += awayProjBlends[j].projFinal;
  }

  let allLocked = xiFullyDeterministic(homeProjBlends) && xiFullyDeterministic(awayProjBlends);
  if (opts && typeof opts === 'object') {
    const hLtp = Number(opts.homeXiFixturesLeft);
    const aLtp = Number(opts.awayXiFixturesLeft);
    if (Number.isFinite(hLtp) && hLtp > 0) allLocked = false;
    if (Number.isFinite(aLtp) && aLtp > 0) allLocked = false;
  }

  if (allLocked) {
    if (detH > detA) return { homeWinPct: 100, drawPct: 0, awayWinPct: 0 };
    if (detA > detH) return { homeWinPct: 0, drawPct: 0, awayWinPct: 100 };
    return { homeWinPct: 0, drawPct: 100, awayWinPct: 0 };
  }

  for (let i = 0; i < n; i++) {
    let sH = 0;
    let sA = 0;
    for (let j = 0; j < nh; j++) {
      const { projFinal, remaining, gamesLeft } = homeProjBlends[j];
      const sigma = sigmaFor(remaining, gamesLeft);
      sH += projFinal + sampleStdGaussian(rnd) * sigma;
    }
    for (let j = 0; j < na; j++) {
      const { projFinal, remaining, gamesLeft } = awayProjBlends[j];
      const sigma = sigmaFor(remaining, gamesLeft);
      sA += projFinal + sampleStdGaussian(rnd) * sigma;
    }
    if (sH > sA) wH += 1;
    else if (sA > sH) wA += 1;
    else dr += 1;
  }
  return {
    homeWinPct: (wH / n) * 100,
    drawPct: (dr / n) * 100,
    awayWinPct: (wA / n) * 100,
  };
}

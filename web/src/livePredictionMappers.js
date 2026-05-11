/**
 * Map draft/bootstrap FPL payloads into `fpl-predictions` shapes and helpers.
 */
import {
  buildRateBundle,
  simulatePlayerGameweekPoints,
  predictForPlayerFromMap,
} from 'fpl-predictions';

const POS_MAP = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };

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
 * Single-pick model xPts for this GW (uses each player’s PL fixture like lineup sim).
 * @param {number} salt — offsets RNG vs other rolls for the same player.
 */
export function predictedXpForPickRow(row, ctx, teamsById, gameweek, config, salt = 0) {
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
    return predictForPlayerFromMap(player, predFx, teamsById, config, rnd).expectedPoints;
  } catch {
    return null;
  }
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

function injuryDoubtFromElement(el) {
  if (el?.status === 'i') return 3;
  const c = Number(el.chance_of_playing_this_round);
  if (Number.isFinite(c) && c < 100) return (100 - c) / 28;
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
    injuryDoubtScore: injuryDoubtFromElement(el),
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
 * sigma = sqrt(max(remaining, 0) + 1.5) — scales with remaining uncertainty.
 *
 * @param {Array<{projFinal: number, remaining: number}>} homeProjBlends
 * @param {Array<{projFinal: number, remaining: number}>} awayProjBlends
 * @param {() => number} rnd
 * @param {number} [iterations]
 */
export function simulateFantasyH2hPercentsFromProjBlends(
  homeProjBlends,
  awayProjBlends,
  rnd,
  iterations = 1500,
) {
  const nh = homeProjBlends.length;
  const na = awayProjBlends.length;
  if (nh === 0 || na === 0) return null;
  const n = iterations;
  let wH = 0;
  let dr = 0;
  let wA = 0;
  for (let i = 0; i < n; i++) {
    let sH = 0;
    let sA = 0;
    for (let j = 0; j < nh; j++) {
      const { projFinal, remaining } = homeProjBlends[j];
      const sigma = Math.sqrt(Math.max(remaining, 0) + 1.5);
      sH += projFinal + sampleStdGaussian(rnd) * sigma;
    }
    for (let j = 0; j < na; j++) {
      const { projFinal, remaining } = awayProjBlends[j];
      const sigma = Math.sqrt(Math.max(remaining, 0) + 1.5);
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

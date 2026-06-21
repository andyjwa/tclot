import test from 'node:test';
import assert from 'node:assert/strict';
import {
  predictionsById,
  filterAndSortPlayers,
  teamsInPredictions,
  breakdownSegments,
  sumTeamForecastXp,
  matchupLean,
  tierFor,
  rangeFor,
  outcomeOdds,
  outcomeBar,
  isTwoWorld,
  twoWorldView,
  adjustForecastForRole,
  applyConfirmedRolesToPlayers,
  teamForecastDistribution,
  h2hWinProbs,
  teamOddsTotals,
  mostLikelyToReturn,
  finishedMatchupOdds,
} from './forecastHelpers.js';

const fixture = {
  players: [
    { id: 1, name: 'Salah', fullName: 'Mohamed Salah', team: 'Liverpool', teamShortName: 'LIV', position: 'MID', price: 13, ownership: 40, forecast: { totalPoints: 6.3, probabilities: { projectedMins: 83, goalLikelihood: 0.43, assistLikelihood: 0.27, cleanSheetPct: 19 }, percentiles: { p90: 14 } } },
    { id: 2, name: 'Haaland', fullName: 'Erling Haaland', team: 'Man City', teamShortName: 'MCI', position: 'FWD', price: 14, ownership: 55, forecast: { totalPoints: 7.1, probabilities: { projectedMins: 85, goalLikelihood: 0.6, assistLikelihood: 0.18, cleanSheetPct: 22 }, percentiles: { p90: 16 } } },
    { id: 3, name: 'Saliba', fullName: 'William Saliba', team: 'Arsenal', teamShortName: 'ARS', position: 'DEF', price: 6, ownership: 30, forecast: { totalPoints: 4.5, probabilities: { projectedMins: 88, goalLikelihood: 0.08, assistLikelihood: 0.05, cleanSheetPct: 45 }, percentiles: { p90: 9 } } },
  ],
};

test('predictionsById indexes by numeric id', () => {
  const m = predictionsById(fixture);
  assert.equal(m.get(2).name, 'Haaland');
  assert.equal(m.size, 3);
});

test('filterAndSortPlayers sorts by totalPoints desc by default', () => {
  const rows = filterAndSortPlayers(fixture.players);
  assert.deepEqual(rows.map((r) => r.name), ['Haaland', 'Salah', 'Saliba']);
});

test('filterAndSortPlayers filters by position and team', () => {
  assert.deepEqual(filterAndSortPlayers(fixture.players, { position: 'DEF' }).map((r) => r.name), ['Saliba']);
  assert.deepEqual(filterAndSortPlayers(fixture.players, { team: 'Man City' }).map((r) => r.name), ['Haaland']);
});

test('filterAndSortPlayers query matches name/team (accent-insensitive)', () => {
  assert.deepEqual(filterAndSortPlayers(fixture.players, { query: 'liverpool' }).map((r) => r.name), ['Salah']);
  assert.deepEqual(filterAndSortPlayers(fixture.players, { query: 'haal' }).map((r) => r.name), ['Haaland']);
});

test('filterAndSortPlayers honors sortKey + asc/desc', () => {
  assert.deepEqual(
    filterAndSortPlayers(fixture.players, { sortKey: 'cleanSheet', sortDir: 'desc' }).map((r) => r.name),
    ['Saliba', 'Haaland', 'Salah'],
  );
  assert.deepEqual(
    filterAndSortPlayers(fixture.players, { sortKey: 'name', sortDir: 'asc' }).map((r) => r.name),
    ['Haaland', 'Salah', 'Saliba'],
  );
});

test('teamsInPredictions returns sorted distinct teams', () => {
  assert.deepEqual(teamsInPredictions(fixture), ['Arsenal', 'Liverpool', 'Man City']);
});

test('breakdownSegments drops ~zero segments and flags negatives', () => {
  const segs = breakdownSegments({
    breakdown: { minutes: 1.7, goals: 2.8, assists: 0.9, cleanSheet: 0.16, saves: 0, bonus: 0.24, defensiveContribution: 0, cards: -0.04, ownGoals: -0.01 },
  });
  const keys = segs.map((s) => s.key);
  assert.ok(keys.includes('minutes') && keys.includes('goals') && keys.includes('cleanSheet'));
  assert.ok(!keys.includes('saves')); // zero dropped
  assert.ok(!keys.includes('cards')); // |0.04| < 0.05 dropped
  assert.ok(!keys.includes('ownGoals'));
});

test('breakdownSegments keeps a material negative and flags it', () => {
  const segs = breakdownSegments({ breakdown: { minutes: 2, cards: -1 } });
  const cards = segs.find((s) => s.key === 'cards');
  assert.ok(cards);
  assert.equal(cards.negative, true);
});

test('sumTeamForecastXp sums matched ids and counts misses', () => {
  const byId = predictionsById(fixture);
  const r = sumTeamForecastXp(byId, [1, 2, 999]);
  assert.equal(r.xp, 13.4);
  assert.equal(r.matched, 2);
  assert.equal(r.missing, 1);
});

test('matchupLean reports favorite + margin', () => {
  assert.deepEqual(matchupLean(50.2, 47.1), { favorite: 'home', diff: 3.1 });
  assert.deepEqual(matchupLean(40, 44.5), { favorite: 'away', diff: 4.5 });
  assert.deepEqual(matchupLean(40, 40), { favorite: 'level', diff: 0 });
});

test('tierFor maps expected points to ranked tiers', () => {
  assert.equal(tierFor({ totalPoints: 7.2 }).key, 'elite');
  assert.equal(tierFor({ totalPoints: 5.1 }).key, 'strong');
  assert.equal(tierFor({ totalPoints: 3.5 }).key, 'solid');
  assert.equal(tierFor({ totalPoints: 2.0 }).key, 'risky');
  assert.equal(tierFor({ totalPoints: 0.8 }).key, 'fringe');
  assert.equal(tierFor({}).key, 'unknown');
  assert.ok(tierFor({ totalPoints: 7 }).rank < tierFor({ totalPoints: 3 }).rank);
});

test('rangeFor rounds percentile floor/median/ceiling', () => {
  assert.deepEqual(rangeFor({ percentiles: { p10: 1.4, p50: 4.6, p90: 12.2 } }), { low: 1, mid: 5, high: 12 });
  assert.deepEqual(rangeFor({}), { low: null, mid: null, high: null });
});

test('outcomeOdds returns integer percents for blank/return/haul', () => {
  assert.deepEqual(outcomeOdds({ outcomes: { blank: 0.385, returns: 0.245, haul: 0.007 } }), {
    blank: 39,
    returns: 25,
    haul: 1,
  });
});

test('outcomeBar yields three mutually-exclusive bands summing to ~100', () => {
  const bands = outcomeBar({ outcomes: { blank: 0.4, haul: 0.15 } });
  const byKey = Object.fromEntries(bands.map((b) => [b.key, b.pct]));
  assert.equal(byKey.blank, 40);
  assert.equal(byKey.haul, 15);
  assert.equal(byKey.mid, 45);
  assert.equal(byKey.blank + byKey.mid + byKey.haul, 100);
});

test('outcomeBar renormalises when blank+haul exceed 1', () => {
  const bands = outcomeBar({ outcomes: { blank: 0.8, haul: 0.6 } });
  const total = bands.reduce((a, b) => a + b.pct, 0);
  assert.ok(total >= 99 && total <= 101);
  assert.equal(bands.find((b) => b.key === 'mid').pct, 0);
});

test('isTwoWorld is true for GK/DEF only', () => {
  assert.equal(isTwoWorld('GK'), true);
  assert.equal(isTwoWorld('DEF'), true);
  assert.equal(isTwoWorld('MID'), false);
  assert.equal(isTwoWorld('FWD'), false);
});

const rolePlayer = () => ({
  id: 10,
  position: 'MID',
  forecast: {
    totalPoints: 5.0,
    breakdown: { minutes: 2, goals: 1.5, assists: 0.8, cleanSheet: 0.1, saves: 0, bonus: 0.4, defensiveContribution: 0.2, cards: -0.1, ownGoals: 0, penaltyMiss: 0 },
    probabilities: { projectedMins: 60, goalLikelihood: 0.3, assistLikelihood: 0.2, cleanSheetPct: 20 },
    percentiles: { p10: 2, p50: 4, p90: 11 },
    outcomes: { blank: 0.3, returns: 0.5, haul: 0.25, monster: 0.1 },
  },
});

test('adjustForecastForRole absent → all zero with full negative delta', () => {
  const adj = adjustForecastForRole(rolePlayer(), 'absent');
  assert.equal(adj.totalPoints, 0);
  assert.equal(adj.probabilities.projectedMins, 0);
  assert.equal(adj.outcomes.blank, 1);
  assert.equal(adj.baselineXp, 5.0);
  assert.equal(adj.xpDelta, -5.0);
});

test('adjustForecastForRole bench collapses below baseline (cameo)', () => {
  const adj = adjustForecastForRole(rolePlayer(), 'bench');
  assert.ok(adj.totalPoints < 5.0);
  assert.ok(adj.totalPoints > 0);
  assert.equal(adj.breakdown.cleanSheet, 0);
  assert.equal(adj.breakdown.saves, 0);
  assert.ok(adj.xpDelta < 0);
});

test('adjustForecastForRole xi lifts a low-minutes player and caps the uplift', () => {
  const adj = adjustForecastForRole(rolePlayer(), 'xi');
  assert.ok(adj.totalPoints >= 5.0); // rotation discount removed
  assert.ok(adj.probabilities.projectedMins >= 60);
  // capped: factor <= 1.4, so no runaway swing
  assert.ok(adj.totalPoints <= 5.0 * 1.4 + 0.5);
});

test('applyConfirmedRolesToPlayers only touches mapped ids', () => {
  const players = [rolePlayer(), { id: 99, position: 'FWD', forecast: { totalPoints: 3 } }];
  const map = new Map([[10, 'absent']]);
  const out = applyConfirmedRolesToPlayers(players, map);
  assert.equal(out[0].confirmedRole, 'absent');
  assert.equal(out[0].forecast.totalPoints, 0);
  assert.equal(out[1].confirmedRole, undefined);
  assert.equal(out[1].forecast.totalPoints, 3);
});

test('applyConfirmedRolesToPlayers no-ops on empty map', () => {
  const players = [rolePlayer()];
  assert.equal(applyConfirmedRolesToPlayers(players, new Map()), players);
  assert.equal(applyConfirmedRolesToPlayers(players, null), players);
});

test('teamForecastDistribution sums mean, range and pools variance', () => {
  const byId = new Map([
    [1, { forecast: { totalPoints: 5, percentiles: { p10: 2, p90: 12 } } }],
    [2, { forecast: { totalPoints: 3, percentiles: { p10: 1, p90: 7 } } }],
  ]);
  const d = teamForecastDistribution(byId, [1, 2, 999]);
  assert.equal(d.mu, 8);
  assert.equal(d.low, 3);
  assert.equal(d.high, 19);
  assert.equal(d.matched, 2);
  assert.equal(d.missing, 1);
  assert.ok(d.sigma > 0);
});

test('h2hWinProbs favors the higher mean and sums to ~100', () => {
  const home = { mu: 55, sigma: 8 };
  const away = { mu: 45, sigma: 8 };
  const p = h2hWinProbs(home, away);
  assert.ok(p.homeWinPct > p.awayWinPct);
  assert.ok(p.homeWinPct > 60);
  const total = p.homeWinPct + p.drawPct + p.awayWinPct;
  assert.ok(Math.abs(total - 100) <= 0.5);
});

test('h2hWinProbs near-even teams split roughly evenly', () => {
  const p = h2hWinProbs({ mu: 50, sigma: 9 }, { mu: 50, sigma: 9 });
  assert.ok(Math.abs(p.homeWinPct - p.awayWinPct) < 2);
});

test('h2hWinProbs degenerate (no variance) returns a certain result', () => {
  assert.deepEqual(h2hWinProbs({ mu: 50, sigma: 0 }, { mu: 40, sigma: 0 }), {
    homeWinPct: 100,
    drawPct: 0,
    awayWinPct: 0,
  });
});

const historyRow = {
  h2h: [
    {
      league_entry_1: 111,
      league_entry_2: 222,
      xPtsXi1: 42.7,
      xPtsXi2: 40.1,
      actualXiPts1: 27,
      actualXiPts2: 50,
      xPtsMc: { homeWinPct: 57, drawPct: 4, awayWinPct: 39 },
      projMc: { homeWinPct: 0, drawPct: 0, awayWinPct: 100 },
      plHadFinishedFixtureForMc: true,
    },
  ],
};

test('finishedMatchupOdds: same orientation maps pre-match + final correctly', () => {
  const m = finishedMatchupOdds(historyRow, 111, 222);
  assert.ok(m);
  assert.equal(m.settled, true);
  // pre-match: forecast points + xPtsMc
  assert.deepEqual(m.preMatch.probs, { homeWinPct: 57, drawPct: 4, awayWinPct: 39 });
  assert.equal(m.preMatch.homePts, 42.7);
  assert.equal(m.preMatch.awayPts, 40.1);
  // final: actual points + projMc collapsed to the real outcome
  assert.deepEqual(m.final.probs, { homeWinPct: 0, drawPct: 0, awayWinPct: 100 });
  assert.equal(m.final.homePts, 27);
  assert.equal(m.final.awayPts, 50);
});

test('finishedMatchupOdds: reversed orientation swaps sides for probs and points', () => {
  const m = finishedMatchupOdds(historyRow, 222, 111);
  assert.ok(m);
  // home is now entry_2, so win pcts/points flip
  assert.deepEqual(m.preMatch.probs, { homeWinPct: 39, drawPct: 4, awayWinPct: 57 });
  assert.equal(m.preMatch.homePts, 40.1);
  assert.equal(m.preMatch.awayPts, 42.7);
  assert.deepEqual(m.final.probs, { homeWinPct: 100, drawPct: 0, awayWinPct: 0 });
  assert.equal(m.final.homePts, 50);
  assert.equal(m.final.awayPts, 27);
});

test('finishedMatchupOdds: no matching row or empty history → null', () => {
  assert.equal(finishedMatchupOdds(historyRow, 111, 999), null);
  assert.equal(finishedMatchupOdds(null, 111, 222), null);
  assert.equal(finishedMatchupOdds({ h2h: [] }, 111, 222), null);
});

test('finishedMatchupOdds: schemaVersion 1 rows (no stat fields) → stats null', () => {
  const m = finishedMatchupOdds(historyRow, 111, 222);
  assert.equal(m.preMatch.stats, null);
  assert.equal(m.final.stats, null);
});

const historyRowWithStats = {
  h2h: [
    {
      league_entry_1: 111,
      league_entry_2: 222,
      xPtsXi1: 42.7,
      xPtsXi2: 40.1,
      actualXiPts1: 27,
      actualXiPts2: 50,
      xPtsMc: { homeWinPct: 57, drawPct: 4, awayWinPct: 39 },
      projMc: { homeWinPct: 0, drawPct: 0, awayWinPct: 100 },
      plHadFinishedFixtureForMc: true,
      xGoals1: 2.1, xGoals2: 1.8,
      xAssists1: 1.4, xAssists2: 1.1,
      xCs1: 0.9, xCs2: 0.6,
      xDefcon1: 3.2, xDefcon2: 2.0,
      actualGoals1: 1, actualGoals2: 3,
      actualAssists1: 0, actualAssists2: 2,
      actualCs1: 1, actualCs2: 0,
      actualDefcon1: 4, actualDefcon2: 6,
    },
  ],
};

test('finishedMatchupOdds: stat blocks map pre-match expected + final actual', () => {
  const m = finishedMatchupOdds(historyRowWithStats, 111, 222);
  assert.deepEqual(m.preMatch.stats.goals, { home: 2.1, away: 1.8 });
  assert.deepEqual(m.preMatch.stats.assists, { home: 1.4, away: 1.1 });
  assert.deepEqual(m.preMatch.stats.cs, { home: 0.9, away: 0.6 });
  assert.deepEqual(m.preMatch.stats.defcon, { home: 3.2, away: 2.0 });
  assert.deepEqual(m.final.stats.goals, { home: 1, away: 3 });
  assert.deepEqual(m.final.stats.assists, { home: 0, away: 2 });
  assert.deepEqual(m.final.stats.cs, { home: 1, away: 0 });
  assert.deepEqual(m.final.stats.defcon, { home: 4, away: 6 });
});

test('finishedMatchupOdds: stat blocks swap sides for reversed orientation', () => {
  const m = finishedMatchupOdds(historyRowWithStats, 222, 111);
  assert.deepEqual(m.preMatch.stats.goals, { home: 1.8, away: 2.1 });
  assert.deepEqual(m.final.stats.goals, { home: 3, away: 1 });
  assert.deepEqual(m.final.stats.defcon, { home: 6, away: 4 });
});

test('teamOddsTotals sums goal/assist/CS probabilities over the XI', () => {
  const byId = predictionsById(fixture);
  const t = teamOddsTotals(byId, [1, 2, 3, 999]);
  // goals: 0.43 + 0.6 + 0.08 = 1.11 → 1.1
  assert.equal(t.expGoals, 1.1);
  // assists: 0.27 + 0.18 + 0.05 = 0.5
  assert.equal(t.expAssists, 0.5);
  // CS: (19 + 22 + 45) / 100 = 0.86 → 0.9
  assert.equal(t.expCs, 0.9);
  assert.equal(t.matched, 3);
});

test('mostLikelyToReturn ranks across both sides by return %', () => {
  const byId = new Map([
    [1, { name: 'A', position: 'FWD', teamId: 10, forecast: { totalPoints: 7, outcomes: { returns: 0.71 } } }],
    [2, { name: 'B', position: 'MID', teamId: 11, forecast: { totalPoints: 6, outcomes: { returns: 0.55 } } }],
    [3, { name: 'C', position: 'DEF', teamId: 12, forecast: { totalPoints: 5, outcomes: { returns: 0.4 } } }],
  ]);
  const top = mostLikelyToReturn(byId, [1], [2, 3], 2);
  assert.deepEqual(top.map((r) => r.name), ['A', 'B']);
  assert.deepEqual(top.map((r) => r.side), ['home', 'away']);
  assert.equal(top[0].returnPct, 71);
});

test('twoWorldView splits CS and no-CS worlds for a defender', () => {
  const player = {
    position: 'DEF',
    forecast: { totalPoints: 5.5, breakdown: { cleanSheet: 1.6 }, probabilities: { cleanSheetPct: 40 } },
  };
  const w = twoWorldView(player);
  assert.equal(w.csProb, 0.4);
  assert.equal(w.noCsProb, 0.6);
  // CS world adds the full ~4pt clean sheet on top of the shared 3.9.
  assert.ok(w.csPoints > w.noCsPoints);
  assert.ok(Math.abs(w.noCsPoints - 3.9) < 0.05);
});

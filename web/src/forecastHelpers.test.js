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

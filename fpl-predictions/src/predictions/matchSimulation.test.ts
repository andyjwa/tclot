import { describe, expect, it } from 'vitest';
import type { Fixture, Player, Team } from './types.js';
import { DEFAULT_MODEL_CONFIG } from './config.js';
import { multinomialCounts, simulateFixtureMatchSamples } from './matchSimulation.js';
import type { RateBundle } from './simulation.js';
import { createSeedRandom } from './stats.js';
import { predictMatchFixture } from './index.js';

function mkPlayer(id: number, teamId: number, pos: Player['position']): Player {
  return {
    id,
    teamId,
    position: pos,
    name: `p${id}`,
    price: 50,
    selectedByPercent: 0,
    recentStartRate: 1,
    startsLast6: 6,
    minutesLast6: 540,
    xGPer90: 0.3,
    xAPer90: 0.2,
    shotsPer90: 2,
    shotsOnTargetPer90: 1,
    keyPassesPer90: 2,
    ictPer90: 8,
    seasonIctPer90: 8,
    yellowCardsPer90: 0.05,
    redCardsPer90: 0.01,
    savesPer90: 2,
    defensiveActionsPer90: 12,
    clearancesBlocksInterceptionsTacklesPer90: 12,
    ballRecoveriesPer90: 5,
    injuryDoubtScore: 0,
  };
}

function mkMinimalBundle(opts: Partial<RateBundle>): RateBundle {
  return {
    P_start: 1,
    P_bench_cameo: 0.02,
    lambdaGoals: 0,
    lambdaAssists: 0,
    cleanSheetProbability: 0,
    dcProbability: 0,
    lambdaSaves: 0,
    yellowP: 0,
    redP: 0,
    ownP: 0,
    penP: 0,
    expectedBonus: 0,
    ...opts,
  };
}

const baseTeam: Team = {
  id: 0,
  name: 't',
  xGForPer90: 1.2,
  xGAgainstPer90: 1.15,
  goalsForPer90: 1.2,
  goalsAgainstPer90: 1.15,
  shotsForPer90: 12,
  shotsAgainstPer90: 12,
  cleanSheetRate: 0.28,
  homeAttackStrength: 1,
  awayAttackStrength: 0.97,
  homeDefenceStrength: 1.02,
  awayDefenceStrength: 0.98,
};

describe('multinomialCounts', () => {
  it('sums to n for positive weights', () => {
    const rng = createSeedRandom(912345678);
    const c = multinomialCounts(37, [1, 2, 9], (): number => rng.next());
    expect(c.reduce((s, x) => s + x, 0)).toBe(37);
    expect(c.length).toBe(3);
  });
});

describe('simulateFixtureMatchSamples', () => {
  const homeTeam = { ...baseTeam, id: 41, name: 'Home' };
  const awayTeam = { ...baseTeam, id: 42, name: 'Away' };
  const fx: Fixture = {
    id: 9001,
    homeTeamId: 41,
    awayTeamId: 42,
    gameweek: 8,
    kickoffTime: '',
  };

  const teams = new Map<number, Team>([
    [homeTeam.id, homeTeam],
    [awayTeam.id, awayTeam],
  ]);

  it('predictMatchFixture runs for two tiny squads without throwing', () => {
    /** Two goalkeepers nearly no goals conceded — exercise CS coupling + bonus slate. */
    const h = mkPlayer(101, 41, 'GK');
    const a = mkPlayer(102, 42, 'GK');
    const b = mkMinimalBundle({ lambdaGoals: 0.01, lambdaAssists: 0.05, lambdaSaves: 2.5 });

    const preds = predictMatchFixture([h], [a], fx, teams, {
      ...DEFAULT_MODEL_CONFIG,
      simulationIterations: 200,
    });

    expect(preds.length).toBe(2);
    expect(preds[0]!.expectedPoints).toBeGreaterThan(0);
    expect(Number.isFinite(preds[1]!.expectedPoints)).toBe(true);
  });

  it('couples two strikers attacking rates into shared draw', () => {
    const h = mkPlayer(201, 41, 'FWD');
    const a = mkPlayer(202, 42, 'FWD');
    const strike = mkMinimalBundle({ lambdaGoals: 0.55, lambdaAssists: 0.15 });

    const n = 2500;
    const samp = simulateFixtureMatchSamples(
      [{ player: h, bundle: strike }],
      [{ player: a, bundle: strike }],
      n,
      Math.random,
    );
    expect(samp.size).toBe(2);
    const mH =
      samp.get(201)?.reduce((s, x) => s + x, 0) ?? 0;
    expect(mH / n).toBeGreaterThan(2);
  });
});

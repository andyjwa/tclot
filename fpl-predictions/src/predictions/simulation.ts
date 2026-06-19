import type { Player } from './types.js';
import {
  clamp,
  sampleBernoulli,
  samplePoisson,
} from './stats.js';
import { fplPointsFromOutcomes, type ScoringOutcomes } from './fplScoring.js';

export interface RateBundle {
  P_start: number;
  P_bench_cameo: number;
  lambdaGoals: number;
  lambdaAssists: number;
  cleanSheetProbability: number;
  dcProbability: number;
  lambdaSaves: number;
  yellowP: number;
  redP: number;
  ownP: number;
  penP: number;
  expectedBonus: number;
}

/** Sample minutes for one gameweek from start / bench / DNP mixture. */
export function sampleMinutesFromBundle(bundle: RateBundle, rnd: () => number): number {
  if (rnd() < bundle.P_start) {
    const u = rnd();
    if (u < 0.55) return 90;
    if (u < 0.8) return 75 + Math.floor(rnd() * 12);
    if (u < 0.92) return 58 + Math.floor(rnd() * 10);
    return 42 + Math.floor(rnd() * 12);
  }
  if (rnd() < bundle.P_bench_cameo) {
    return 12 + Math.floor(rnd() * 24);
  }
  return 0;
}

function sampleBonusWhole(expectedBonus: number, rnd: () => number): number {
  const mu = clamp(expectedBonus, 0, 2.5);
  const p1 = clamp(mu / 3, 0, 0.55);
  const p2 = p1 * 0.45;
  const p3 = p2 * 0.35;
  const u = rnd();
  if (u < p3) return 3;
  if (u < p3 + p2) return 2;
  if (u < p3 + p2 + p1) return 1;
  return 0;
}

export function simulatePlayerGameweekPoints(
  player: Player,
  bundle: RateBundle,
  iterations: number,
  rnd: () => number,
): number[] {
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const minutes = sampleMinutesFromBundle(bundle, rnd);
    const goals = samplePoisson(bundle.lambdaGoals, rnd);
    const assists = samplePoisson(bundle.lambdaAssists, rnd);
    const cleanSheet =
      minutes >= 60 && sampleBernoulli(bundle.cleanSheetProbability, rnd);
    const saves =
      player.position === 'GK' ? samplePoisson(bundle.lambdaSaves, rnd) : 0;
    const dcPts = sampleBernoulli(bundle.dcProbability, rnd) ? 2 : 0;
    const yellowCard = sampleBernoulli(bundle.yellowP, rnd);
    const redCard = sampleBernoulli(bundle.redP, rnd);
    const ownGoal = sampleBernoulli(bundle.ownP, rnd);
    const penaltyMiss = sampleBernoulli(bundle.penP, rnd);
    const bonusWhole = sampleBonusWhole(bundle.expectedBonus, rnd);

    const o: ScoringOutcomes = {
      minutes,
      goals,
      assists,
      cleanSheet,
      saves,
      defensiveContributionPoints: dcPts,
      yellowCard,
      redCard,
      ownGoal,
      penaltyMiss,
      bonusWhole,
    };
    samples.push(fplPointsFromOutcomes(player.position, o));
  }
  return samples;
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = clamp(Math.floor(p * (sorted.length - 1)), 0, sorted.length - 1);
  return sorted[idx]!;
}

export function summarizeSamples(samples: number[]): {
  mean: number;
  p10: number;
  p50: number;
  p90: number;
  p2OrLess: number;
  p6: number;
  p10h: number;
  p15: number;
} {
  const s = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((a, b) => a + b, 0) / Math.max(1, samples.length);
  let cBlank = 0,
    c6 = 0,
    c10 = 0,
    c15 = 0;
  for (const x of samples) {
    if (x <= 2) cBlank += 1;
    if (x >= 6) c6 += 1;
    if (x >= 10) c10 += 1;
    if (x >= 15) c15 += 1;
  }
  const n = samples.length || 1;
  return {
    mean,
    p10: percentile(s, 0.1),
    p50: percentile(s, 0.5),
    p90: percentile(s, 0.9),
    p2OrLess: cBlank / n,
    p6: c6 / n,
    p10h: c10 / n,
    p15: c15 / n,
  };
}

/** Eleven starters mapped into players[] / bundles[] indices; captain doubled. */
export function simulateTeamGameweek(
  players: Player[],
  bundles: RateBundle[],
  lineupIndices: number[],
  captainIdx: number,
  iterations: number,
  rnd: () => number,
): import('./types.js').TeamSimulationResult {
  if (lineupIndices.length !== 11 || lineupIndices.some((i) => i < 0 || i >= players.length)) {
    throw new Error('Expected 11 valid lineup indices');
  }
  const teamSamples = new Array<number>(iterations).fill(0);
  for (let i = 0; i < iterations; i++) {
    let total = 0;
    for (let s = 0; s < 11; s++) {
      const pi = lineupIndices[s]!;
      const p = players[pi]!;
      const b = bundles[pi]!;
      const one = simulatePlayerGameweekPoints(p, b, 1, rnd);
      const pts = one[0] ?? 0;
      const mult = pi === captainIdx ? 2 : 1;
      total += pts * mult;
    }
    teamSamples[i] = total;
  }
  const sum = summarizeSamples(teamSamples);
  return {
    expectedPoints: sum.mean,
    p10: sum.p10,
    p50: sum.p50,
    p90: sum.p90,
    samples: iterations,
  };
}

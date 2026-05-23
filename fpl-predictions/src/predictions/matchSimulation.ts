/**
 * Match-level Monte Carlo: coupled team goals/clean sheets + single 3/2/1 bonus slate per fixture.
 * Complements independent `simulatePlayerGameweekPoints`.
 */
import type { FplPosition, Player } from './types.js';
import { clamp, sampleBernoulli, samplePoisson } from './stats.js';
import type { RateBundle } from './simulation.js';
import { sampleMinutesFromBundle } from './simulation.js';
import {
  fplPointsFromOutcomes,
  type ScoringOutcomes,
} from './fplScoring.js';

export interface MatchSideEntry {
  player: Player;
  bundle: RateBundle;
}

function sumNonNeg(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += Math.max(0, x);
  return s;
}

/** n categorical draws with replacement, weight[i] proportional to P(category i). */
export function multinomialCounts(
  n: number,
  weights: number[],
  rnd: () => number,
): number[] {
  const k = weights.length;
  const out = new Array<number>(k).fill(0);
  if (n <= 0 || k === 0) return out;
  const w = weights.map((x) => Math.max(0, x));
  let s = sumNonNeg(w);
  if (s <= 1e-12) {
    for (let t = 0; t < n; t++) {
      out[Math.floor(rnd() * k)]! += 1;
    }
    return out;
  }
  for (let t = 0; t < n; t++) {
    let r = rnd() * s;
    for (let i = 0; i < k; i++) {
      r -= w[i]!;
      if (r <= 0) {
        out[i]! += 1;
        break;
      }
    }
  }
  return out;
}

/** Monotone BPS-ish score for bonus ordering (not official BPS). */
function bonusStandingsScore(
  o: {
    minutes: number;
    goals: number;
    assists: number;
    saves: number;
    defensiveContributionPoints: number;
    position: FplPosition;
    concededByOwnTeam: number;
    yellowCard: boolean;
    redCard: boolean;
  },
  tieBreak: number,
): number {
  if (o.minutes < 58) return -1e9 - tieBreak;
  let s =
    o.goals * 220 +
    o.assists * 160 +
    o.defensiveContributionPoints * 44 +
    tieBreak;
  if (o.position === 'GK') {
    s += Math.floor(Math.max(0, o.saves) / 3) * 38;
  }
  if (o.concededByOwnTeam === 0) {
    if (o.position === 'GK') s += 155;
    else if (o.position === 'DEF') s += 148;
    else if (o.position === 'MID') s += 95;
    else s += 34;
  }
  if (o.yellowCard) s -= 32;
  if (o.redCard) s -= 85;
  return s;
}

type Working = {
  player: Player;
  bundle: RateBundle;
  minutes: number;
  goals: number;
  assists: number;
  saves: number;
  dcPts: number;
  yellowCard: boolean;
  redCard: boolean;
  ownGoal: boolean;
  penaltyMiss: boolean;
  cleanSheet: boolean;
};

function runOneFixtureIteration(
  home: MatchSideEntry[],
  away: MatchSideEntry[],
  rnd: () => number,
): Map<number, number> {
  const hW: Working[] = home.map((h) => ({
    player: h.player,
    bundle: h.bundle,
    minutes: 0,
    goals: 0,
    assists: 0,
    saves: 0,
    dcPts: 0,
    yellowCard: false,
    redCard: false,
    ownGoal: false,
    penaltyMiss: false,
    cleanSheet: false,
  }));
  const aW: Working[] = away.map((a) => ({
    player: a.player,
    bundle: a.bundle,
    minutes: 0,
    goals: 0,
    assists: 0,
    saves: 0,
    dcPts: 0,
    yellowCard: false,
    redCard: false,
    ownGoal: false,
    penaltyMiss: false,
    cleanSheet: false,
  }));

  for (const w of hW) {
    w.minutes = sampleMinutesFromBundle(w.bundle, rnd);
  }
  for (const w of aW) {
    w.minutes = sampleMinutesFromBundle(w.bundle, rnd);
  }

  const wGh = hW.map((w) => (w.minutes > 0 ? w.bundle.lambdaGoals : 0));
  const wGa = aW.map((w) => (w.minutes > 0 ? w.bundle.lambdaGoals : 0));
  const lamH = sumNonNeg(wGh);
  const lamA = sumNonNeg(wGa);

  const gh = samplePoisson(lamH, rnd);
  const ga = samplePoisson(lamA, rnd);

  const gCountH = multinomialCounts(gh, wGh, rnd);
  const gCountA = multinomialCounts(ga, wGa, rnd);
  for (let i = 0; i < hW.length; i++) hW[i]!.goals = gCountH[i] ?? 0;
  for (let j = 0; j < aW.length; j++) aW[j]!.goals = gCountA[j] ?? 0;

  const wAh = hW.map((w) => (w.minutes > 0 ? w.bundle.lambdaAssists : 0));
  const wAa = aW.map((w) => (w.minutes > 0 ? w.bundle.lambdaAssists : 0));
  const lamAH = sumNonNeg(wAh);
  const lamAA = sumNonNeg(wAa);

  const assH = samplePoisson(lamAH, rnd);
  const assA = samplePoisson(lamAA, rnd);

  const aCountH = multinomialCounts(assH, wAh, rnd);
  const aCountA = multinomialCounts(assA, wAa, rnd);
  for (let i = 0; i < hW.length; i++) hW[i]!.assists = aCountH[i] ?? 0;
  for (let j = 0; j < aW.length; j++) aW[j]!.assists = aCountA[j] ?? 0;

  for (const w of hW) {
    const m = clamp(Math.round(w.minutes), 0, 95);
    /** Team CS iff opponent scores 0 in this simulation draw. */
    const teamBlankedOpp = ga === 0;
    w.cleanSheet =
      teamBlankedOpp &&
      m >= 60 &&
      (w.player.position === 'GK' ||
        w.player.position === 'DEF' ||
        w.player.position === 'MID');
  }
  for (const w of aW) {
    const m = clamp(Math.round(w.minutes), 0, 95);
    const teamBlankedOpp = gh === 0;
    w.cleanSheet =
      teamBlankedOpp &&
      m >= 60 &&
      (w.player.position === 'GK' ||
        w.player.position === 'DEF' ||
        w.player.position === 'MID');
  }
  for (const w of hW) {
    w.saves =
      w.player.position === 'GK'
        ? samplePoisson(w.bundle.lambdaSaves, rnd)
        : 0;
    w.dcPts = sampleBernoulli(w.bundle.dcProbability, rnd) ? 2 : 0;
    w.yellowCard = sampleBernoulli(w.bundle.yellowP, rnd);
    w.redCard = sampleBernoulli(w.bundle.redP, rnd);
    w.ownGoal = sampleBernoulli(w.bundle.ownP, rnd);
    w.penaltyMiss = sampleBernoulli(w.bundle.penP, rnd);
  }
  for (const w of aW) {
    w.saves =
      w.player.position === 'GK'
        ? samplePoisson(w.bundle.lambdaSaves, rnd)
        : 0;
    w.dcPts = sampleBernoulli(w.bundle.dcProbability, rnd) ? 2 : 0;
    w.yellowCard = sampleBernoulli(w.bundle.yellowP, rnd);
    w.redCard = sampleBernoulli(w.bundle.redP, rnd);
    w.ownGoal = sampleBernoulli(w.bundle.ownP, rnd);
    w.penaltyMiss = sampleBernoulli(w.bundle.penP, rnd);
  }

  /** Bonus slate across both squads — top three eligible by proxy score share 3,2,1. */
  type RankRow = {
    pid: number;
    score: number;
    tieBreak: number;
  };
  const contenders: RankRow[] = [];

  for (const w of hW) {
    const tb = rnd() * 1e-6;
    contenders.push({
      pid: w.player.id,
      score: bonusStandingsScore(
        {
          minutes: w.minutes,
          goals: w.goals,
          assists: w.assists,
          saves: w.saves,
          defensiveContributionPoints: w.dcPts,
          position: w.player.position,
          concededByOwnTeam: ga,
          yellowCard: w.yellowCard,
          redCard: w.redCard,
        },
        tb,
      ),
      tieBreak: tb,
    });
  }
  for (const w of aW) {
    const tb = rnd() * 1e-6;
    contenders.push({
      pid: w.player.id,
      score: bonusStandingsScore(
        {
          minutes: w.minutes,
          goals: w.goals,
          assists: w.assists,
          saves: w.saves,
          defensiveContributionPoints: w.dcPts,
          position: w.player.position,
          concededByOwnTeam: gh,
          yellowCard: w.yellowCard,
          redCard: w.redCard,
        },
        tb,
      ),
      tieBreak: tb,
    });
  }

  const eligibleBP = contenders.filter((c) => c.score > -500);
  eligibleBP.sort((a, b) => b.score - a.score || a.tieBreak - b.tieBreak);

  const bonusByPid = new Map<number, number>();
  const tiers = [3, 2, 1] as const;
  for (let b = 0; b < Math.min(3, eligibleBP.length); b++) {
    bonusByPid.set(eligibleBP[b]!.pid, tiers[b]!);
  }

  const out = new Map<number, number>();

  const scoreOne = (w: Working): number => {
    const bp = bonusByPid.get(w.player.id) ?? 0;
    const o: ScoringOutcomes = {
      minutes: w.minutes,
      goals: w.goals,
      assists: w.assists,
      cleanSheet: w.cleanSheet,
      saves: w.saves,
      defensiveContributionPoints: w.dcPts,
      yellowCard: w.yellowCard,
      redCard: w.redCard,
      ownGoal: w.ownGoal,
      penaltyMiss: w.penaltyMiss,
      bonusWhole: bp,
    };
    return fplPointsFromOutcomes(w.player.position, o);
  };

  for (const w of hW) {
    out.set(w.player.id, scoreOne(w));
  }
  for (const w of aW) {
    out.set(w.player.id, scoreOne(w));
  }

  return out;
}

/** Run `iterations` match-level simulations; returns raw GW point samples per `player.id`. */
export function simulateFixtureMatchSamples(
  home: MatchSideEntry[],
  away: MatchSideEntry[],
  iterations: number,
  rnd: () => number,
): Map<number, number[]> {
  const acc = new Map<number, number[]>();
  const ids = new Set<number>();
  for (const h of home) ids.add(h.player.id);
  for (const a of away) ids.add(a.player.id);
  for (const id of ids) acc.set(id, []);

  const n = Math.max(1, iterations);
  for (let i = 0; i < n; i++) {
    const pts = runOneFixtureIteration(home, away, rnd);
    for (const id of ids) {
      acc.get(id)!.push(pts.get(id) ?? 0);
    }
  }
  return acc;
}

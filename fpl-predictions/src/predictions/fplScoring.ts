import type { FplPosition, PointsBreakdown } from './types.js';
import { clamp } from './stats.js';
import { cleanSheetPointsIfEligible, goalPointsPerGoal } from './bonusModel.js';

export interface ScoringOutcomes {
  minutes: number;
  goals: number;
  assists: number;
  cleanSheet: boolean;
  saves: number;
  defensiveContributionPoints: number;
  yellowCard: boolean;
  redCard: boolean;
  ownGoal: boolean;
  penaltyMiss: boolean;
  bonusWhole: number;
}

/** Official-style FPL points for one gameweek given integer outcomes. */
export function fplPointsFromOutcomes(position: FplPosition, o: ScoringOutcomes): number {
  let pts = 0;
  const m = clamp(Math.round(o.minutes), 0, 95);
  if (m > 0 && m < 60) pts += 1;
  if (m >= 60) pts += 2;

  const gpg = goalPointsPerGoal(position);
  pts += o.goals * gpg;
  pts += o.assists * 3;

  if (m >= 60 && o.cleanSheet) {
    pts += cleanSheetPointsIfEligible(position);
  }

  if (position === 'GK') {
    pts += Math.floor(Math.max(0, o.saves) / 3);
  }

  pts += o.defensiveContributionPoints;

  if (o.yellowCard) pts -= 1;
  if (o.redCard) pts -= 3;
  if (o.ownGoal) pts -= 2;
  if (o.penaltyMiss) pts -= 2;

  pts += clamp(Math.round(o.bonusWhole), 0, 3);
  return pts;
}

export function analyticExpectedBreakdown(
  position: FplPosition,
  args: {
    expectedMinutes: number;
    PSixtyPlus: number;
    expectedGoals: number;
    expectedAssists: number;
    cleanSheetProbability: number;
    dcProbability: number;
    expectedSaves: number;
    yellowP: number;
    redP: number;
    ownP: number;
    penP: number;
    expectedBonus: number;
  },
): PointsBreakdown {
  const pSixty = clamp(args.PSixtyPlus, 0, 1);
  const pPlayShort = clamp(args.expectedMinutes / 90 - pSixty * 0.9, 0, 1) * 0.35;
  const appearancePts = pPlayShort * 1 + pSixty * 2;

  const goals = args.expectedGoals * goalPointsPerGoal(position);
  const assists = args.expectedAssists * 3;
  const csPts = cleanSheetPointsIfEligible(position);
  const cleanSheet = args.cleanSheetProbability * csPts * pSixty;

  const saves =
    position === 'GK' ? Math.floor(Math.max(0, args.expectedSaves) / 3) : 0;

  const dc = args.dcProbability * 2;
  const cards = args.yellowP * -1 + args.redP * -3;
  const ownGoals = args.ownP * -2;
  const penaltyMiss = args.penP * -2;
  const bonus = args.expectedBonus;

  return {
    appearance: appearancePts,
    goals,
    assists,
    cleanSheet,
    saves,
    defensiveContribution: dc,
    ownGoals,
    penaltyMiss,
    cards,
    bonus,
  };
}

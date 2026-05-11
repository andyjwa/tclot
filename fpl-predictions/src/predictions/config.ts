import type { FplPosition } from './types.js';

/**
 * Central, tunable constants. Adjust league-wide without touching model code.
 */
export interface ModelConfig {
  /** Monte Carlo iterations per player. */
  simulationIterations: number;
  /** DEF / GKP defensive-contribution threshold (FPL 2025/26 style). */
  dcThresholdDef: number;
  /** MID / FWD threshold including recoveries. */
  dcThresholdMidFwd: number;
  /** Saves per FPL save point (floor division in official scoring). */
  savesPerPoint: number;
  /** Max expected goals cap per player GW (numerical stability). */
  maxExpectedGoals: number;
  /** Max expected assists cap per player GW. */
  maxExpectedAssists: number;
  /** ICT form multiplier bounds. */
  ictFormMin: number;
  ictFormMax: number;
  /** Weight on ICT-derived form multiplier for xG/xA. */
  ictFormWeight: number;
  /** When no betting CS odds: shrink CS prob toward this from implied goals heuristic. */
  cleanSheetFallbackShrink: number;
  /** Card probability hard cap per GW. */
  yellowCardProbCap: number;
  redCardProbCap: number;
  /** Default opponent defence factor when data missing (1 = league average). */
  defaultOpponentDefenceFactor: number;
  defaultOpponentAttackFactor: number;
  /** Bench appearance: mean minutes if named but not starting. */
  benchCameoMeanMinutes: number;
  /** Probability of any minutes when not starting (sub). */
  probMinutesWhenBenched: number;
  /** Bonus model scale (keep conservative < 1). */
  bonusScale: number;
  leagueAverageXG: number;
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  simulationIterations: 8000,
  dcThresholdDef: 10,
  dcThresholdMidFwd: 12,
  savesPerPoint: 3,
  maxExpectedGoals: 2.5,
  maxExpectedAssists: 2.2,
  ictFormMin: 0.75,
  ictFormMax: 1.25,
  ictFormWeight: 1,
  cleanSheetFallbackShrink: 0.92,
  yellowCardProbCap: 0.45,
  redCardProbCap: 0.06,
  defaultOpponentDefenceFactor: 1,
  defaultOpponentAttackFactor: 1,
  benchCameoMeanMinutes: 22,
  probMinutesWhenBenched: 0.35,
  bonusScale: 0.35,
  leagueAverageXG: 1.35,
};

/** ICT blend weights by position: Threat / Creativity / Influence shares (sum 1). */
export function ictPositionWeights(position: FplPosition): [number, number, number] {
  switch (position) {
    case 'FWD':
      return [0.55, 0.3, 0.15];
    case 'MID':
      return [0.4, 0.4, 0.2];
    case 'DEF':
    case 'GK':
      return [0.2, 0.2, 0.6];
    default:
      return [0.33, 0.33, 0.34];
  }
}

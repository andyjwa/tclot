import type { ModelConfig } from './config.js';
import type { FplPosition, Player, Team } from './types.js';
import { clamp } from './stats.js';

/**
 * Conservative bonus expectation: tiny prior from ICT + attacking volume + saves.
 */
export function expectedBonusPoints(
  player: Player,
  _playerTeam: Team,
  expectedGoals: number,
  expectedAssists: number,
  cleanSheetProbability: number,
  expectedSaves: number,
  config: ModelConfig,
): number {
  const ict = player.ictPer90 / 6;
  const atk = (expectedGoals * 4.5 + expectedAssists * 3.2) * 0.15;
  const cs = player.position === 'DEF' || player.position === 'GK' ? cleanSheetProbability * 0.45 : 0;
  const csMid = player.position === 'MID' ? cleanSheetProbability * 0.18 : 0;
  const sv = player.position === 'GK' ? Math.min(expectedSaves / 35, 0.9) * 0.4 : 0;
  const raw = ict * 0.08 + atk + cs + csMid + sv;
  return clamp(raw * config.bonusScale, 0, 2.2);
}

export function goalPointsPerGoal(position: FplPosition): number {
  if (position === 'GK' || position === 'DEF') return 6;
  if (position === 'MID') return 5;
  return 4;
}

export function cleanSheetPointsIfEligible(position: FplPosition): number {
  if (position === 'GK' || position === 'DEF') return 4;
  if (position === 'MID') return 1;
  return 0;
}

import type { ModelConfig } from './config.js';
import type { Player, Team } from './types.js';
import { clamp } from './stats.js';

function opponentCardFactor(opponent: Team): number {
  const ga = opponent.goalsAgainstPer90 || 1.2;
  return clamp(0.85 + (ga - 1.2) * 0.25, 0.75, 1.3);
}

export function cardProbabilities(
  player: Player,
  opponent: Team,
  expectedMinutes: number,
  config: ModelConfig,
): { yellow: number; red: number; ownGoal: number; penaltyMiss: number } {
  const frac = expectedMinutes / 90;
  const opp = opponentCardFactor(opponent);
  const y = clamp(player.yellowCardsPer90 * frac * opp * 1.15, 0, config.yellowCardProbCap);
  const r = clamp(player.redCardsPer90 * frac * opp * 1.25, 0, config.redCardProbCap);
  const og = clamp(0.004 * frac, 0, 0.04);
  const pen =
    player.position === 'FWD' || player.position === 'MID' ? clamp(0.01 * frac, 0, 0.08) : 0;
  return { yellow: y, red: r, ownGoal: og, penaltyMiss: pen };
}

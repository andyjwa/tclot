import type { ModelConfig } from './config.js';
import type { Player, Team } from './types.js';
import { clamp, poissonTailGe } from './stats.js';

/** Opp attack volume increases defensive workload for the defending side. */
function opponentPressureFactor(opponent: Team): number {
  const sh = opponent.shotsForPer90 || 12;
  const lev = 12;
  return clamp(sh / lev, 0.75, 1.35);
}

/**
 * Expected count of "DC counting" actions this GW, then P(cross threshold) via Poisson tail.
 */
export function defensiveContributionProbability(
  player: Player,
  opponent: Team,
  expectedMinutes: number,
  config: ModelConfig,
): { lambda: number; probability: number } {
  const mins = expectedMinutes / 90;
  const press = opponentPressureFactor(opponent);

  let ratePer90 = 0;
  let threshold = 10;

  if (player.position === 'DEF' || player.position === 'GK') {
    ratePer90 =
      player.clearancesBlocksInterceptionsTacklesPer90 > 0
        ? player.clearancesBlocksInterceptionsTacklesPer90
        : player.defensiveActionsPer90;
    threshold = config.dcThresholdDef;
  } else {
    ratePer90 =
      player.clearancesBlocksInterceptionsTacklesPer90 + player.ballRecoveriesPer90;
    threshold = config.dcThresholdMidFwd;
  }

  const lambda = Math.max(0, ratePer90 * mins * press);
  const probability = poissonTailGe(lambda, threshold);
  return { lambda, probability: clamp(probability, 0, 0.85) };
}

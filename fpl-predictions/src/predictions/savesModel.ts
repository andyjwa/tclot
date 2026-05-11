import type { Player, Team } from './types.js';
import { clamp } from './stats.js';

/** Opponent attacking volume lifts save opportunities for opposing GK. */
export function expectedSaves(
  player: Player,
  opponent: Team,
  expectedMinutes: number,
): number {
  if (player.position !== 'GK') return 0;
  const sotProxy = (opponent.shotsForPer90 || 12) * 0.32;
  const lev = 12 * 0.32;
  const factor = clamp(sotProxy / lev, 0.7, 1.45);
  const mins = expectedMinutes / 90;
  return Math.max(0, player.savesPer90 * factor * mins);
}

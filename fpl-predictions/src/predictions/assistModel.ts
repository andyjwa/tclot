import type { ModelConfig } from './config.js';
import type { Fixture, Player, Team } from './types.js';
import { clamp, poissonAtLeastOne } from './stats.js';

function ictFormMultiplier(player: Player, config: ModelConfig): number {
  const base = player.seasonIctPer90 > 1e-6 ? player.ictPer90 / player.seasonIctPer90 : 1;
  return clamp(base, config.ictFormMin, config.ictFormMax);
}

/** Opponent “chance conceded” for creative play — weaker defence → more room for assists. */
function opponentChanceConcededFactor(opponent: Team, isHome: boolean): number {
  const xgc = opponent.xGAgainstPer90 || 1.2;
  const shots = isHome ? opponent.shotsAgainstPer90 : opponent.shotsAgainstPer90;
  const levX = 1.2;
  const levS = 14;
  const a = clamp(xgc / levX, 0.6, 1.5);
  const b = clamp((shots || levS) / levS, 0.75, 1.35);
  return clamp(a * 0.65 + b * 0.35, 0.55, 1.55);
}

function teamAttackFactor(playerTeam: Team, isHome: boolean, config: ModelConfig): number {
  const xg = playerTeam.xGForPer90 || config.leagueAverageXG;
  const lev = config.leagueAverageXG;
  const base = clamp(xg / lev, 0.55, 1.55);
  const homeAway = isHome ? playerTeam.homeAttackStrength : playerTeam.awayAttackStrength;
  return clamp(base * homeAway, 0.45, 1.75);
}

export function expectedAssistsRate(
  player: Player,
  playerTeam: Team,
  opponent: Team,
  fixture: Fixture,
  expectedMinutes: number,
  config: ModelConfig,
): { lambda: number; assistProbability: number } {
  const isHome = player.teamId === fixture.homeTeamId;
  const oppCh = opponentChanceConcededFactor(opponent, isHome);
  const atk = teamAttackFactor(playerTeam, isHome, config);
  const ict = ictFormMultiplier(player, config);
  const mins = expectedMinutes / 90;
  let lambda = player.xAPer90 * oppCh * atk * ict * mins;
  lambda = clamp(lambda, 0, config.maxExpectedAssists);
  return { lambda, assistProbability: poissonAtLeastOne(lambda) };
}

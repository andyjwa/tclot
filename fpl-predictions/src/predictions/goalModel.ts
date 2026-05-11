import type { ModelConfig } from './config.js';
import { ictPositionWeights } from './config.js';
import type { Fixture, Player, Team } from './types.js';
import { impliedTotalGoalsFromOu, splitImpliedGoals } from './odds.js';
import { clamp, poissonAtLeastOne } from './stats.js';

function ictFormMultiplier(player: Player, config: ModelConfig): number {
  const base = player.seasonIctPer90 > 1e-6 ? player.ictPer90 / player.seasonIctPer90 : 1;
  const w = ictPositionWeights(player.position);
  const blend =
    w[0]! * (player.shotsOnTargetPer90 / (player.xGPer90 + 0.15 + 1e-6)) * 0.4 +
    w[1]! * base +
    w[2]! * base;
  const m = 0.5 + 0.5 * blend;
  const raw = 1 + config.ictFormWeight * (m - 1);
  return clamp(raw, config.ictFormMin, config.ictFormMax);
}

function teamImpliedGoalsForSide(
  _team: Team,
  isHome: boolean,
  fixture: Fixture,
  _config: ModelConfig,
): number {
  if (isHome && fixture.homeImpliedGoals != null) return fixture.homeImpliedGoals;
  if (!isHome && fixture.awayImpliedGoals != null) return fixture.awayImpliedGoals;

  const { meanGoals } = impliedTotalGoalsFromOu(fixture.over25Odds, fixture.under25Odds);
  const split = splitImpliedGoals(
    meanGoals,
    fixture.homeWinOdds,
    fixture.drawOdds,
    fixture.awayWinOdds,
  );
  return isHome ? split.home : split.away;
}

function opponentDefenceFactor(_playerTeamId: number, opponent: Team, isHome: boolean): number {
  const att = isHome ? opponent.awayAttackStrength : opponent.homeAttackStrength;
  const def = isHome ? opponent.homeDefenceStrength : opponent.awayDefenceStrength;
  const xga = opponent.xGAgainstPer90 || 1.15;
  const league = 1.15;
  const concede = clamp(xga / league, 0.55, 1.55);
  const shape = (def + att * 0.35) / 1.35;
  return clamp(concede * shape, 0.5, 1.65);
}

function teamAttackFactor(playerTeam: Team, isHome: boolean, config: ModelConfig): number {
  const xg = playerTeam.xGForPer90 || config.leagueAverageXG;
  const lev = config.leagueAverageXG;
  const base = clamp(xg / lev, 0.55, 1.55);
  const homeAway = isHome ? playerTeam.homeAttackStrength : playerTeam.awayAttackStrength;
  return clamp(base * homeAway, 0.45, 1.75);
}

/**
 * Poisson rate for goals this GW (single-match assumption).
 * λ = xG_per_90 * (opp defence) * (team attack) * (home/away) * ICT_form * minutes/90
 */
export function expectedGoalsRate(
  player: Player,
  playerTeam: Team,
  opponent: Team,
  fixture: Fixture,
  expectedMinutes: number,
  config: ModelConfig,
): { lambda: number; goalProbability: number } {
  const isHome = player.teamId === fixture.homeTeamId;
  const opp = opponent;
  const oppDef = opponentDefenceFactor(player.teamId, opp, isHome);
  const atk = teamAttackFactor(playerTeam, isHome, config);
  const ict = ictFormMultiplier(player, config);
  const mins = expectedMinutes / 90;
  let lambda = player.xGPer90 * oppDef * atk * ict * mins;
  lambda = clamp(lambda, 0, config.maxExpectedGoals);
  return { lambda, goalProbability: poissonAtLeastOne(lambda) };
}

export function resolveOpponentForPlayer(
  player: Player,
  fixture: Fixture,
  teamsById: Map<number, Team>,
): Team {
  const isHome = player.teamId === fixture.homeTeamId;
  const oppId = isHome ? fixture.awayTeamId : fixture.homeTeamId;
  const t = teamsById.get(oppId);
  if (!t) throw new Error(`Opponent team ${oppId} not in teams map`);
  return t;
}

/** Expose implied goals for explanations / clean sheet. */
export function fixtureImpliedGoalsForTeam(
  playerTeam: Team,
  fixture: Fixture,
  config: ModelConfig,
): number {
  const isHome = playerTeam.id === fixture.homeTeamId;
  return teamImpliedGoalsForSide(playerTeam, isHome, fixture, config);
}

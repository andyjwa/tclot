import type { Fixture, Player, Team } from './predictions/types.js';

export const mockTeams: Team[] = [
  {
    id: 10,
    name: 'North FC',
    xGForPer90: 1.55,
    xGAgainstPer90: 1.05,
    goalsForPer90: 1.6,
    goalsAgainstPer90: 1.0,
    shotsForPer90: 14,
    shotsAgainstPer90: 11,
    cleanSheetRate: 0.38,
    homeAttackStrength: 1.08,
    awayAttackStrength: 1.02,
    homeDefenceStrength: 1.05,
    awayDefenceStrength: 1.0,
  },
  {
    id: 11,
    name: 'South United',
    xGForPer90: 1.2,
    xGAgainstPer90: 1.35,
    goalsForPer90: 1.1,
    goalsAgainstPer90: 1.4,
    shotsForPer90: 11,
    shotsAgainstPer90: 14,
    cleanSheetRate: 0.22,
    homeAttackStrength: 1.0,
    awayAttackStrength: 0.96,
    homeDefenceStrength: 0.94,
    awayDefenceStrength: 0.92,
  },
];

export const mockFixture: Fixture = {
  id: 9001,
  homeTeamId: 10,
  awayTeamId: 11,
  gameweek: 24,
  kickoffTime: '2026-02-07T15:00:00Z',
  homeWinOdds: 1.85,
  drawOdds: 3.6,
  awayWinOdds: 4.2,
  over25Odds: 1.72,
  under25Odds: 2.1,
  bttsYesOdds: 1.65,
  homeCleanSheetOdds: 2.9,
  awayCleanSheetOdds: 4.5,
};

function basePlayer(
  overrides: Partial<Player> & Pick<Player, 'id' | 'name' | 'teamId' | 'position'>,
): Player {
  return {
    price: 75,
    selectedByPercent: 12,
    recentStartRate: 0.85,
    startsLast6: 5,
    minutesLast6: 520,
    xGPer90: 0.25,
    xAPer90: 0.18,
    shotsPer90: 2.8,
    shotsOnTargetPer90: 1.1,
    keyPassesPer90: 1.5,
    ictPer90: 6.2,
    seasonIctPer90: 5.5,
    yellowCardsPer90: 0.12,
    redCardsPer90: 0.01,
    savesPer90: 2.8,
    defensiveActionsPer90: 5,
    clearancesBlocksInterceptionsTacklesPer90: 4.2,
    ballRecoveriesPer90: 4.5,
    ...overrides,
  };
}

export const mockPlayers: Player[] = [
  basePlayer({
    id: 101,
    name: 'Example Midfielder',
    teamId: 10,
    position: 'MID',
    xGPer90: 0.18,
    xAPer90: 0.22,
    ballRecoveriesPer90: 5.2,
  }),
  basePlayer({
    id: 102,
    name: 'Example Striker',
    teamId: 10,
    position: 'FWD',
    xGPer90: 0.48,
    xAPer90: 0.12,
  }),
  basePlayer({
    id: 103,
    name: 'Example Fullback',
    teamId: 10,
    position: 'DEF',
    clearancesBlocksInterceptionsTacklesPer90: 7.5,
    ballRecoveriesPer90: 3,
  }),
  basePlayer({
    id: 104,
    name: 'Example Keeper',
    teamId: 11,
    position: 'GK',
    savesPer90: 3.4,
    xGPer90: 0,
    xAPer90: 0.02,
  }),
  basePlayer({
    id: 105,
    name: 'Away Winger',
    teamId: 11,
    position: 'MID',
    xGPer90: 0.12,
    xAPer90: 0.28,
    recentStartRate: 0.65,
  }),
];

export function mockTeamsById(): Map<number, Team> {
  return new Map(mockTeams.map((t) => [t.id, t]));
}

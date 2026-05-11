/** FPL positions as used in this model. */
export type FplPosition = 'GK' | 'DEF' | 'MID' | 'FWD';

export interface Player {
  id: number;
  name: string;
  teamId: number;
  position: FplPosition;
  price: number;
  selectedByPercent: number;
  /** Approximate share of last 6 GWs the player started (0–1). */
  recentStartRate: number;
  startsLast6: number;
  minutesLast6: number;
  xGPer90: number;
  xAPer90: number;
  shotsPer90: number;
  shotsOnTargetPer90: number;
  keyPassesPer90: number;
  ictPer90: number;
  /** Rolling / season ICT per 90 for form ratio. */
  seasonIctPer90: number;
  yellowCardsPer90: number;
  redCardsPer90: number;
  savesPer90: number;
  /** Generic defensive actions: CBIT-style where relevant. */
  defensiveActionsPer90: number;
  clearancesBlocksInterceptionsTacklesPer90: number;
  ballRecoveriesPer90: number;
  /** Optional flags: 0 = none, higher = more doubt. */
  injuryDoubtScore?: number;
}

export interface Team {
  id: number;
  name: string;
  xGForPer90: number;
  xGAgainstPer90: number;
  goalsForPer90: number;
  goalsAgainstPer90: number;
  shotsForPer90: number;
  shotsAgainstPer90: number;
  cleanSheetRate: number;
  homeAttackStrength: number;
  awayAttackStrength: number;
  homeDefenceStrength: number;
  awayDefenceStrength: number;
}

export interface Fixture {
  id: number;
  homeTeamId: number;
  awayTeamId: number;
  gameweek: number;
  kickoffTime: string;
  homeWinOdds?: number;
  drawOdds?: number;
  awayWinOdds?: number;
  over25Odds?: number;
  under25Odds?: number;
  bttsYesOdds?: number;
  homeCleanSheetOdds?: number;
  awayCleanSheetOdds?: number;
  /** Pre-computed if you push odds pipeline; else derived. */
  homeImpliedGoals?: number;
  awayImpliedGoals?: number;
}

/** Intermediate + final outputs for one player–fixture. */
export interface Prediction {
  playerId: number;
  fixtureId: number;
  P_start: number;
  P_sixty_plus_minutes: number;
  expectedMinutes: number;
  expectedGoals: number;
  goalProbability: number;
  expectedAssists: number;
  assistProbability: number;
  cleanSheetProbability: number;
  expectedSaves: number;
  savePointsProbability: number;
  defensiveContributionProbability: number;
  yellowCardProbability: number;
  redCardProbability: number;
  ownGoalProbability: number;
  penaltyMissProbability: number;
  expectedBonus: number;
  expectedPoints: number;
  p10: number;
  p50: number;
  p90: number;
  probabilitySixPlus: number;
  probabilityTenPlus: number;
  probabilityFifteenPlus: number;
  breakdown: PointsBreakdown;
  explanation: string[];
}

export interface PointsBreakdown {
  appearance: number;
  goals: number;
  assists: number;
  cleanSheet: number;
  saves: number;
  defensiveContribution: number;
  cards: number;
  ownGoals: number;
  penaltyMiss: number;
  bonus: number;
}

export interface TeamSimulationResult {
  expectedPoints: number;
  p10: number;
  p50: number;
  p90: number;
  samples: number;
}

export interface SimulatedLineup {
  /** FPL element ids in starting XI order (11 players). */
  playerIds: number[];
  captainId: number;
}

/** RNG interface for tests (inject deterministic PRNG). */
export interface RandomSource {
  /** Uniform on [0, 1). */
  next(): number;
}

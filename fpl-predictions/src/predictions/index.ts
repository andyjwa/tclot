import { DEFAULT_MODEL_CONFIG, type ModelConfig } from './config.js';
import type { Fixture, Player, Prediction, Team } from './types.js';
import { estimateMinutes } from './minutesModel.js';
import { expectedGoalsRate, resolveOpponentForPlayer } from './goalModel.js';
import { expectedAssistsRate } from './assistModel.js';
import { cleanSheetProbabilityForPlayer } from './cleanSheetModel.js';
import { defensiveContributionProbability } from './defensiveContributionModel.js';
import { cardProbabilities } from './cardsModel.js';
import { expectedBonusPoints } from './bonusModel.js';
import { expectedSaves } from './savesModel.js';
import { analyticExpectedBreakdown } from './fplScoring.js';
import { applyExplanation } from './explainPrediction.js';
import type { RateBundle } from './simulation.js';
import { simulatePlayerGameweekPoints, summarizeSamples } from './simulation.js';
import { poissonTailGe } from './stats.js';
import {
  simulateFixtureMatchSamples,
  type MatchSideEntry,
} from './matchSimulation.js';

export { DEFAULT_MODEL_CONFIG, type ModelConfig } from './config.js';
export * from './types.js';
export * from './odds.js';
export * from './simulation.js';
export * from './fplScoring.js';
export {
  simulateFixtureMatchSamples,
  multinomialCounts,
  type MatchSideEntry,
} from './matchSimulation.js';

/** When set, skips independent MC and summarizes these samples into `Prediction`. */
export interface PredictPlayerGameweekOptions {
  overrideSamples?: number[];
}

export function buildRateBundle(
  player: Player,
  playerTeam: Team,
  opponent: Team,
  fixture: Fixture,
  config: ModelConfig,
): RateBundle {
  const mins = estimateMinutes(player, playerTeam, fixture, config);
  // No expected minutes (e.g. confirmed absent) → cannot accumulate anything.
  if (mins.expectedMinutes <= 0) {
    return {
      P_start: 0,
      P_bench_cameo: 0,
      lambdaGoals: 0,
      lambdaAssists: 0,
      cleanSheetProbability: 0,
      dcProbability: 0,
      lambdaSaves: 0,
      yellowP: 0,
      redP: 0,
      ownP: 0,
      penP: 0,
      expectedBonus: 0,
    };
  }
  const { lambda: lambdaGoals } = expectedGoalsRate(
    player,
    playerTeam,
    opponent,
    fixture,
    mins.expectedMinutes,
    config,
  );
  const { lambda: lambdaAssists } = expectedAssistsRate(
    player,
    playerTeam,
    opponent,
    fixture,
    mins.expectedMinutes,
    config,
  );
  const cs = cleanSheetProbabilityForPlayer(
    player,
    playerTeam,
    opponent,
    fixture,
    mins.P_sixty_plus,
    config,
  );
  const dc = defensiveContributionProbability(player, opponent, mins.expectedMinutes, config);
  const cards = cardProbabilities(player, opponent, mins.expectedMinutes, config);
  const expSaves = expectedSaves(player, opponent, mins.expectedMinutes);
  const lambdaSaves = Math.max(0, expSaves);
  const xpBonus = expectedBonusPoints(
    player,
    playerTeam,
    lambdaGoals,
    lambdaAssists,
    cs,
    expSaves,
    config,
  );
  return {
    P_start: mins.P_start,
    P_bench_cameo: Math.max(0.02, mins.P_bench_cameo),
    lambdaGoals,
    lambdaAssists,
    cleanSheetProbability: cs,
    dcProbability: dc.probability,
    lambdaSaves,
    yellowP: cards.yellow,
    redP: cards.red,
    ownP: cards.ownGoal,
    penP: cards.penaltyMiss,
    expectedBonus: xpBonus,
  };
}

export function predictPlayerGameweek(
  player: Player,
  playerTeam: Team,
  opponent: Team,
  fixture: Fixture,
  config: ModelConfig = DEFAULT_MODEL_CONFIG,
  rnd: () => number = Math.random,
  options?: PredictPlayerGameweekOptions,
): Prediction {
  const mins = estimateMinutes(player, playerTeam, fixture, config);
  const { lambda: eg, goalProbability } = expectedGoalsRate(
    player,
    playerTeam,
    opponent,
    fixture,
    mins.expectedMinutes,
    config,
  );
  const { lambda: ea, assistProbability } = expectedAssistsRate(
    player,
    playerTeam,
    opponent,
    fixture,
    mins.expectedMinutes,
    config,
  );
  const csP = cleanSheetProbabilityForPlayer(
    player,
    playerTeam,
    opponent,
    fixture,
    mins.P_sixty_plus,
    config,
  );
  const dc = defensiveContributionProbability(player, opponent, mins.expectedMinutes, config);
  const cards = cardProbabilities(player, opponent, mins.expectedMinutes, config);
  const expSaves = expectedSaves(player, opponent, mins.expectedMinutes);
  const savePtsProb =
    player.position === 'GK' ? poissonTailGe(Math.max(0.01, expSaves), 3) : 0;
  const xb = expectedBonusPoints(player, playerTeam, eg, ea, csP, expSaves, config);

  const breakdown = analyticExpectedBreakdown(player.position, {
    expectedMinutes: mins.expectedMinutes,
    PSixtyPlus: mins.P_sixty_plus,
    expectedGoals: eg,
    expectedAssists: ea,
    cleanSheetProbability: csP,
    dcProbability: dc.probability,
    expectedSaves: expSaves,
    yellowP: cards.yellow,
    redP: cards.red,
    ownP: cards.ownGoal,
    penP: cards.penaltyMiss,
    expectedBonus: xb,
  });

  const bundle = buildRateBundle(player, playerTeam, opponent, fixture, config);
  const samples =
    options?.overrideSamples != null && options.overrideSamples.length > 0
      ? options.overrideSamples
      : simulatePlayerGameweekPoints(
          player,
          bundle,
          config.simulationIterations,
          rnd,
        );
  const sum = summarizeSamples(samples);

  const pred: Prediction = {
    playerId: player.id,
    fixtureId: fixture.id,
    P_start: mins.P_start,
    P_sixty_plus_minutes: mins.P_sixty_plus,
    expectedMinutes: mins.expectedMinutes,
    expectedGoals: eg,
    goalProbability,
    expectedAssists: ea,
    assistProbability,
    cleanSheetProbability: csP,
    expectedSaves: expSaves,
    savePointsProbability: savePtsProb,
    defensiveContributionProbability: dc.probability,
    yellowCardProbability: cards.yellow,
    redCardProbability: cards.red,
    ownGoalProbability: cards.ownGoal,
    penaltyMissProbability: cards.penaltyMiss,
    expectedBonus: xb,
    expectedPoints: sum.mean,
    p10: sum.p10,
    p50: sum.p50,
    p90: sum.p90,
    probabilityTwoOrLess: sum.p2OrLess,
    probabilitySixPlus: sum.p6,
    probabilityTenPlus: sum.p10h,
    probabilityFifteenPlus: sum.p15,
    breakdown,
    explanation: [],
  };

  return applyExplanation(pred);
}

export function predictForPlayerFromMap(
  player: Player,
  fixture: Fixture,
  teamsById: Map<number, Team>,
  config?: ModelConfig,
  rnd?: () => number,
  options?: PredictPlayerGameweekOptions,
): Prediction {
  const playerTeam = teamsById.get(player.teamId);
  if (!playerTeam) throw new Error('Missing player team in map');
  const opponent = resolveOpponentForPlayer(player, fixture, teamsById);
  return predictPlayerGameweek(
    player,
    playerTeam,
    opponent,
    fixture,
    config,
    rnd,
    options,
  );
}

/**
 * Match-level Monte Carlo for one fixture: pooled team goals/clean sheets and a joint 3/2/1 bonus slate.
 * Returns one `Prediction` per player in `{ home, away }` order (`homeIds` ∪ `away` order preserved).
 */
export function predictMatchFixture(
  home: Player[],
  away: Player[],
  fixture: Fixture,
  teamsById: Map<number, Team>,
  config: ModelConfig = DEFAULT_MODEL_CONFIG,
  rnd: () => number = Math.random,
): Prediction[] {
  const ht = teamsById.get(fixture.homeTeamId);
  const at = teamsById.get(fixture.awayTeamId);
  if (!ht || !at) {
    throw new Error('predictMatchFixture: missing homeTeamId or awayTeamId in teamsById map');
  }

  const homeEntries: MatchSideEntry[] = home.map((p) => ({
    player: p,
    bundle: buildRateBundle(p, ht, at, fixture, config),
  }));
  const awayEntries: MatchSideEntry[] = away.map((p) => ({
    player: p,
    bundle: buildRateBundle(p, at, ht, fixture, config),
  }));

  const sampleMap = simulateFixtureMatchSamples(
    homeEntries,
    awayEntries,
    config.simulationIterations,
    rnd,
  );

  const out: Prediction[] = [];
  for (const player of home) {
    const s = sampleMap.get(player.id);
    if (!s?.length)
      throw new Error(`predictMatchFixture: missing samples for player ${player.id}`);
    out.push(
      predictPlayerGameweek(player, ht, at, fixture, config, rnd, {
        overrideSamples: s,
      }),
    );
  }
  for (const player of away) {
    const s = sampleMap.get(player.id);
    if (!s?.length)
      throw new Error(`predictMatchFixture: missing samples for player ${player.id}`);
    out.push(
      predictPlayerGameweek(player, at, ht, fixture, config, rnd, {
        overrideSamples: s,
      }),
    );
  }
  return out;
}

export function formatPredictionRecord(p: Prediction, playerName: string) {
  return {
    playerId: p.playerId,
    playerName,
    expectedPoints: Math.round(p.expectedPoints * 10) / 10,
    p10: p.p10,
    p50: p.p50,
    p90: p.p90,
    probabilities: {
      goal: Math.round(p.goalProbability * 1000) / 1000,
      assist: Math.round(p.assistProbability * 1000) / 1000,
      cleanSheet: Math.round(p.cleanSheetProbability * 1000) / 1000,
      defensiveContribution: Math.round(p.defensiveContributionProbability * 1000) / 1000,
      yellowCard: Math.round(p.yellowCardProbability * 1000) / 1000,
      sixPlusPoints: Math.round(p.probabilitySixPlus * 1000) / 1000,
      tenPlusPoints: Math.round(p.probabilityTenPlus * 1000) / 1000,
    },
    breakdown: {
      appearance: Math.round(p.breakdown.appearance * 100) / 100,
      goals: Math.round(p.breakdown.goals * 100) / 100,
      assists: Math.round(p.breakdown.assists * 100) / 100,
      cleanSheet: Math.round(p.breakdown.cleanSheet * 100) / 100,
      defensiveContribution: Math.round(p.breakdown.defensiveContribution * 100) / 100,
      cards: Math.round(p.breakdown.cards * 100) / 100,
      bonus: Math.round(p.breakdown.bonus * 100) / 100,
    },
    explanation: p.explanation,
  };
}

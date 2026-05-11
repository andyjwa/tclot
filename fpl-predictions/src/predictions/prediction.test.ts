import { describe, expect, it } from 'vitest';
import {
  predictForPlayerFromMap,
  fplPointsFromOutcomes,
  formatPredictionRecord,
  DEFAULT_MODEL_CONFIG,
} from './index.js';
import { mockFixture, mockPlayers, mockTeamsById } from '../mockData.js';
import { createSeedRandom } from './stats.js';

describe('fplPointsFromOutcomes', () => {
  it('awards appearance and goal for forward', () => {
    const pts = fplPointsFromOutcomes('FWD', {
      minutes: 77,
      goals: 1,
      assists: 0,
      cleanSheet: false,
      saves: 0,
      defensiveContributionPoints: 0,
      yellowCard: false,
      redCard: false,
      ownGoal: false,
      penaltyMiss: false,
      bonusWhole: 0,
    });
    expect(pts).toBe(2 + 4);
  });
});

describe('predictPlayerGameweek', () => {
  it('returns stable shape with seeded RNG', () => {
    const teams = mockTeamsById();
    const mid = mockPlayers.find((p) => p.id === 101)!;
    const cfg = { ...DEFAULT_MODEL_CONFIG, simulationIterations: 500 };
    const rng = createSeedRandom(99);
    const pred = predictForPlayerFromMap(mid, mockFixture, teams, cfg, () => rng.next());

    expect(pred.playerId).toBe(101);
    expect(pred.fixtureId).toBe(mockFixture.id);
    expect(pred.expectedPoints).toBeGreaterThan(0);
    expect(pred.p10).toBeLessThanOrEqual(pred.p50);
    expect(pred.p50).toBeLessThanOrEqual(pred.p90);
    expect(pred.probabilitySixPlus).toBeGreaterThanOrEqual(0);
    expect(pred.probabilitySixPlus).toBeLessThanOrEqual(1);
    expect(pred.explanation.length).toBeGreaterThan(0);

    const rec = formatPredictionRecord(pred, mid.name);
    expect(rec.playerName).toBe('Example Midfielder');
    expect(rec).toHaveProperty('probabilities');
    expect(rec).toHaveProperty('breakdown');
  });
});

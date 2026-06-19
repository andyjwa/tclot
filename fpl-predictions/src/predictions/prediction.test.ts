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

    expect(pred.probabilityTwoOrLess).toBeGreaterThanOrEqual(0);
    expect(pred.probabilityTwoOrLess).toBeLessThanOrEqual(1);

    const rec = formatPredictionRecord(pred, mid.name);
    expect(rec.playerName).toBe('Example Midfielder');
    expect(rec).toHaveProperty('probabilities');
    expect(rec).toHaveProperty('breakdown');
  });
});

describe('confirmedRole minutes override', () => {
  const teams = mockTeamsById();
  const cfg = { ...DEFAULT_MODEL_CONFIG, simulationIterations: 1500 };
  const base = mockPlayers.find((p) => p.id === 101)!;

  it('absent → zero expected points and high blank probability', () => {
    const rng = createSeedRandom(7);
    const pred = predictForPlayerFromMap(
      { ...base, confirmedRole: 'absent' },
      mockFixture,
      teams,
      cfg,
      () => rng.next(),
    );
    expect(pred.expectedMinutes).toBe(0);
    expect(pred.expectedPoints).toBe(0);
    expect(pred.probabilityTwoOrLess).toBe(1);
  });

  it('confirmed xi scores higher than confirmed bench', () => {
    const xiRng = createSeedRandom(11);
    const benchRng = createSeedRandom(11);
    const xi = predictForPlayerFromMap(
      { ...base, confirmedRole: 'xi' },
      mockFixture,
      teams,
      cfg,
      () => xiRng.next(),
    );
    const bench = predictForPlayerFromMap(
      { ...base, confirmedRole: 'bench' },
      mockFixture,
      teams,
      cfg,
      () => benchRng.next(),
    );
    expect(xi.expectedMinutes).toBeGreaterThan(bench.expectedMinutes);
    expect(xi.expectedPoints).toBeGreaterThan(bench.expectedPoints);
  });
});

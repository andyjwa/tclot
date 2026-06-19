import type { ModelConfig } from './config.js';
import type { Fixture, Player, Team } from './types.js';
import { clamp } from './stats.js';

export interface MinutesEstimate {
  P_start: number;
  P_sixty_plus: number;
  expectedMinutes: number;
  P_bench_cameo: number;
}

/**
 * P(start): blend recent start rate with minutes share; down-weight injury doubt.
 * expected_minutes = P_start * E[min|start] + (1-P_start) * E[min|bench]
 * P(60+): conditional on play, rough logistic from E[min].
 */
export function estimateMinutes(
  player: Player,
  _team: Team,
  _fixture: Fixture,
  config: ModelConfig,
): MinutesEstimate {
  // Confirmed lineup overrides the historical estimate (see Player.confirmedRole).
  if (player.confirmedRole === 'absent') {
    return { P_start: 0, P_sixty_plus: 0, expectedMinutes: 0, P_bench_cameo: 0 };
  }

  let P_start: number;
  if (player.confirmedRole === 'xi') {
    // Confirmed starter: remove rotation/doubt discount, but keep early-sub variance below.
    P_start = 0.99;
  } else if (player.confirmedRole === 'bench') {
    // Named sub: only cameo minutes if introduced.
    P_start = 0.02;
  } else {
    const doubt = player.injuryDoubtScore ?? 0;
    const doubtAdj = clamp(1 - doubt * 0.08, 0.55, 1);
    const startFromRate = clamp(player.recentStartRate, 0.05, 0.98);
    const startFromMinutes =
      player.minutesLast6 > 0 ? clamp(player.minutesLast6 / (6 * 90), 0.05, 0.98) : startFromRate;
    P_start = clamp((0.6 * startFromRate + 0.4 * startFromMinutes) * doubtAdj, 0.02, 0.99);
  }

  // If starting: mixture of full match, early hook, small injury break.
  const EminGivenStart = 0.72 * 90 + 0.18 * 78 + 0.1 * 62;
  const EminGivenBench =
    config.probMinutesWhenBenched > 0
      ? config.benchCameoMeanMinutes * config.probMinutesWhenBenched
      : 0;
  const expectedMinutes = P_start * EminGivenStart + (1 - P_start) * EminGivenBench;

  // P(60+): approximate from E[min] conditional on any positive minutes
  const P_play = P_start + (1 - P_start) * config.probMinutesWhenBenched;
  const EminCondPlay = P_play > 0 ? expectedMinutes / P_play : 0;
  const P_sixty_plus = P_play * clamp((EminCondPlay - 55) / 35, 0.08, 0.92);

  const P_bench_cameo = (1 - P_start) * config.probMinutesWhenBenched;

  return {
    P_start: P_start,
    P_sixty_plus: clamp(P_sixty_plus, 0, 1),
    expectedMinutes: clamp(expectedMinutes, 0, 90),
    P_bench_cameo,
  };
}

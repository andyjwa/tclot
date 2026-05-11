import type { ModelConfig } from './config.js';
import type { Fixture, Player, Team } from './types.js';
import { impliedProbFromDecimalOdds, removeVigProportional } from './odds.js';
import { clamp } from './stats.js';
import { fixtureImpliedGoalsForTeam } from './goalModel.js';

/**
 * Clean sheet probability for the *player's team* this fixture.
 * Prefer de-vigged implied prob from bookmaker CS odds; else shrink Poisson-style heuristic from implied goals conceded.
 */
export function cleanSheetProbabilityForPlayer(
  player: Player,
  _playerTeam: Team,
  opponent: Team,
  fixture: Fixture,
  P_sixty_plus: number,
  config: ModelConfig,
): number {
  const defendingHome = player.teamId === fixture.homeTeamId;
  const odds = defendingHome ? fixture.homeCleanSheetOdds : fixture.awayCleanSheetOdds;
  let p = NaN;
  if (odds != null && Number.isFinite(odds)) {
    const ho = fixture.homeCleanSheetOdds;
    const ao = fixture.awayCleanSheetOdds;
    if (ho != null && ao != null) {
      const ph = impliedProbFromDecimalOdds(ho);
      const pa = impliedProbFromDecimalOdds(ao);
      const nv = removeVigProportional([ph, pa]);
      const nh = nv[0]!;
      const na = nv[1]!;
      if (Number.isFinite(nh) && Number.isFinite(na)) {
        p = defendingHome ? nh : na;
      }
    } else {
      p = impliedProbFromDecimalOdds(odds);
    }
  }

  if (!Number.isFinite(p)) {
    const oppGoals = fixtureImpliedGoalsForTeam(opponent, fixture, config);
    const lambda = Math.max(0.35, oppGoals);
    p = Math.exp(-lambda);
    p *= config.cleanSheetFallbackShrink;
  }

  p = clamp(p, 0.02, 0.72);
  // Only outfield relevant for CS points if likely to play 60+
  const minutesFactor = 0.15 + 0.85 * clamp(P_sixty_plus, 0, 1);
  return clamp(p * minutesFactor, 0.01, 0.7);
}

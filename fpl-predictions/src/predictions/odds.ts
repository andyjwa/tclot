/**
 * Convert decimal odds to implied probability (includes overround).
 */
export function impliedProbFromDecimalOdds(decimalOdds: number): number {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) return NaN;
  return 1 / decimalOdds;
}

/**
 * Remove overround proportionally (normalise to sum to 1).
 * Use for 1X2 or BTTS yes/no pairs.
 */
export function removeVigProportional(probs: number[]): number[] {
  const cleaned = probs.map((p) => (Number.isFinite(p) && p > 0 ? p : 0));
  const sum = cleaned.reduce((a, b) => a + b, 0);
  if (sum <= 0) return probs.map(() => NaN);
  return cleaned.map((p) => p / sum);
}

/**
 * Pair: over 2.5 / under 2.5 decimal odds → implied total goals heuristic
 * (not exact; good enough for model priors).
 */
export function impliedTotalGoalsFromOu(
  overDecimal?: number,
  underDecimal?: number,
): { meanGoals: number; trust: number } {
  const po = overDecimal != null ? impliedProbFromDecimalOdds(overDecimal) : NaN;
  const pu = underDecimal != null ? impliedProbFromDecimalOdds(underDecimal) : NaN;
  if (!Number.isFinite(po) || !Number.isFinite(pu)) {
    return { meanGoals: 2.7, trust: 0 };
  }
  const [pOver] = removeVigProportional([po, pu]);
  if (!Number.isFinite(pOver)) return { meanGoals: 2.7, trust: 0 };
  const meanGoals = 1.8 + 2.2 * pOver;
  return { meanGoals, trust: 0.8 };
}

/**
 * Split total goals between teams using moneyline implied strength (optional).
 */
export function splitImpliedGoals(
  totalGoals: number,
  homeWinOdds?: number,
  drawOdds?: number,
  awayWinOdds?: number,
): { home: number; away: number } {
  const ph = homeWinOdds != null ? impliedProbFromDecimalOdds(homeWinOdds) : NaN;
  const pd = drawOdds != null ? impliedProbFromDecimalOdds(drawOdds) : NaN;
  const pa = awayWinOdds != null ? impliedProbFromDecimalOdds(awayWinOdds) : NaN;
  if (![ph, pd, pa].every((x) => Number.isFinite(x))) {
    return { home: totalGoals * 0.53, away: totalGoals * 0.47 };
  }
  const [nh, nd, na] = removeVigProportional([ph, pd, pa]);
  if (![nh, nd, na].every((x) => Number.isFinite(x))) {
    return { home: totalGoals * 0.53, away: totalGoals * 0.47 };
  }
  const drawShare = nd * 0.5;
  const homeShare = nh + drawShare * 0.5;
  const awayShare = na + drawShare * 0.5;
  const s = homeShare + awayShare;
  return {
    home: (totalGoals * homeShare) / s,
    away: (totalGoals * awayShare) / s,
  };
}

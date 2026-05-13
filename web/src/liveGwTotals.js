/** Shared live GW totals for lineups (LiveScores, charts, etc.). */

/** @param {{ total_points?: number }[]} starters */
export function sumStarterPoints(starters) {
  return starters.reduce((acc, r) => acc + (Number(r.total_points) || 0), 0);
}

/** Use post-autosub XI when we have a full 11 from `buildEffectiveLineup`. */
export function effectiveStartersForDisplay(squad) {
  if (!squad || squad.error) return null;
  const nBench = squad.bench?.length ?? 0;
  if (
    squad.displayStarters?.length === 11 &&
    squad.displayBench?.length === nBench
  ) {
    return squad.displayStarters;
  }
  return squad.starters?.length ? squad.starters : null;
}

/**
 * GW total for banners: reconcile FPL `entry_history.points` (autosubs, official total) with the
 * sum of effective XI `total_points` (live element stats + captain multiplier). During a live GW
 * the APIs can briefly disagree — one updates before the other — so a naive “pick only one”
 * source shows totals below the real app and skews win %.
 */
export function liveGwDisplayTotal(squad) {
  if (!squad || squad.error) return null;
  const xs = effectiveStartersForDisplay(squad);
  const sumXi = xs?.length ? sumStarterPoints(xs) : null;
  const official =
    typeof squad.gwPoints === 'number' && Number.isFinite(squad.gwPoints)
      ? squad.gwPoints
      : null;
  if (official != null && sumXi != null) {
    return Math.max(official, sumXi);
  }
  if (official != null) return official;
  if (sumXi != null) return sumXi;
  return null;
}

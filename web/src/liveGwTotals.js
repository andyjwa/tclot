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
 * GW total for banners: prefer FPL `entry_history.points` (includes autosubs). If missing, sum
 * effective XI points (after projected/official autosub display rows).
 */
export function liveGwDisplayTotal(squad) {
  if (!squad || squad.error) return null;
  if (typeof squad.gwPoints === 'number') return squad.gwPoints;
  const xs = effectiveStartersForDisplay(squad);
  if (!xs?.length) return null;
  return sumStarterPoints(xs);
}

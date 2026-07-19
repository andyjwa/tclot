/**
 * Effective starters/bench (post-autosub when the display lineup is
 * complete) — the single source of truth for the "displayStarters complete →
 * use post-autosub lineup" rule. Shared by the expanded fixture table, the
 * mobile fixture card's Match / Lineups / Odds views, the Key Stats
 * aggregation, and the live-scores XI derivations; lives in its own module
 * so the component files stay fast-refreshable.
 */
export function effectiveStarters(squad) {
  if (!squad || squad.error) return [];
  const nBench = squad.bench?.length ?? 0;
  if (
    squad.displayStarters?.length === 11 &&
    squad.displayBench?.length === nBench
  ) {
    return squad.displayStarters;
  }
  return squad.starters ?? [];
}

export function effectiveBench(squad) {
  if (!squad || squad.error) return [];
  const nBench = squad.bench?.length ?? 0;
  if (
    squad.displayStarters?.length === 11 &&
    squad.displayBench?.length === nBench
  ) {
    return squad.displayBench;
  }
  return squad.bench ?? [];
}

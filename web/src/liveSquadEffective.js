/**
 * Effective starters/bench (post-autosub when available) — mirror of the
 * helper in `LiveScores.jsx`. Shared by the expanded fixture table and the
 * mobile fixture card's Match / Lineups views; lives in its own module so
 * the component files stay fast-refreshable.
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

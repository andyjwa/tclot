/**
 * Anchoring helper for the (flagged, currently disabled) OpenFPL inference add-on.
 *
 * OpenFPL (arXiv:2508.09992) is an FPL+Understat-only ML model that produces a headline expected
 * points per player. The integration plan is to *anchor* our Monte Carlo engine's `totalPoints`
 * toward OpenFPL's xP via a weight, once the model is trained on backfilled history. Until then
 * the anchor weight defaults to 0 (engine output is authoritative) and the whole step is disabled.
 *
 * This module is pure + tested so the blend math is locked down before the feature is switched on.
 */

/**
 * Blend the engine's expected points with OpenFPL's headline xP.
 * @param {number} engineXp  our Monte Carlo expected points (authoritative source)
 * @param {number} openFplXp OpenFPL headline xP (anchor); ignored if not finite
 * @param {number} weight    anchor weight in [0,1]; 0 = pure engine, 1 = pure OpenFPL
 * @returns {number} blended expected points
 */
export function blendAnchorXp(engineXp, openFplXp, weight) {
  const e = Number(engineXp);
  const base = Number.isFinite(e) ? e : 0;
  // Guard null/undefined explicitly: Number(null) === 0 would otherwise read as a valid anchor.
  if (openFplXp == null) return base;
  const o = Number(openFplXp);
  if (!Number.isFinite(o)) return base;
  let w = Number(weight);
  if (!Number.isFinite(w)) w = 0;
  w = Math.min(1, Math.max(0, w));
  return w * o + (1 - w) * base;
}

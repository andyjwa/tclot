/**
 * Feature flags — small, runtime-resolvable toggles for opt-in UI variants.
 *
 * Each flag resolves in this priority order so it can be flipped without a
 * redeploy *or* baked in at build time for launch day:
 *   1. Build-time env (`import.meta.env.VITE_*`) — wins so a deploy can hard-set it.
 *   2. localStorage override — lets us preview a variant in a live browser.
 *   3. Hard-coded default.
 *
 * Component code stays in `.jsx`; this module is plain JS so
 * `react-refresh/only-export-components` is happy.
 */

/* ----- Live-scores face-off layout ------------------------------------- */

/** localStorage key for the live-scores layout override. */
export const LIVE_SCORE_LAYOUT_KEY = 'tclot:flags:live-score-layout'

/** Build-time env var that hard-sets the layout (overrides storage). */
const LIVE_SCORE_LAYOUT_ENV = 'VITE_LIVE_SCORE_LAYOUT'

/**
 * Layout variants for the live face-off rows:
 *  - `shirts`: the shipped default — a shrinking cluster of jersey glyphs under
 *    each team name (one shirt per starter still to play, `FT` once done).
 *  - `bars`:   mockup "Variation 3" — names + score read clean on top while two
 *    muted progress bars run full-width along the bottom of the tile, filling
 *    inward, with `FT` / a to-play count at the outer ends.
 */
export const LIVE_SCORE_LAYOUTS = /** @type {const} */ ({
  SHIRTS: 'shirts',
  BARS: 'bars',
})

export const LIVE_SCORE_LAYOUT_DEFAULT = LIVE_SCORE_LAYOUTS.SHIRTS

const VALID_LAYOUTS = new Set(Object.values(LIVE_SCORE_LAYOUTS))

/**
 * Resolve the active live-scores layout. Env → localStorage → default.
 * Always returns a valid layout id, falling back on miss/garbage.
 *
 * Flip it for launch day with `VITE_LIVE_SCORE_LAYOUT=bars` in the build env,
 * or preview live in a browser with:
 *   localStorage.setItem('tclot:flags:live-score-layout', 'bars')
 *
 * @returns {'shirts' | 'bars'}
 */
export function readLiveScoreLayout() {
  try {
    const env = String(import.meta.env?.[LIVE_SCORE_LAYOUT_ENV] ?? '').trim()
    if (VALID_LAYOUTS.has(env)) return env
  } catch { /* import.meta.env unavailable — ignore */ }

  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(LIVE_SCORE_LAYOUT_KEY)
      if (stored && VALID_LAYOUTS.has(stored)) return stored
    } catch { /* storage blocked — ignore */ }
  }

  return LIVE_SCORE_LAYOUT_DEFAULT
}

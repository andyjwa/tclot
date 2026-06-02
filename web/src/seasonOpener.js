/**
 * Season Opener metadata — single source of truth for the cinematic
 * "Season Opener" splash mounted on the FPL Live → Vibes sub-tab.
 *
 * The TCLOT league brands each season as a numbered "Episode" with a
 * pop-culture theme (the chosen "nomenclature"). The opener cinematic
 * announces the upcoming season's theme alongside the eight managers'
 * named dots walking through a Hobbiton-inspired tableau toward the
 * round green door of Bag End — where, on Vader's cue, the season's
 * theme is revealed.
 *
 * Future seasons re-skin by:
 *   1. Bumping `EPISODE_NUMBER`,
 *   2. Updating `SEASON_THEME` + `SEASON_THEME_HOOK_LINES`,
 *   3. Optionally swapping the SVG scene file (Hobbiton → Tatooine →
 *      Hogwarts → etc.) by importing a different `<*Scene>` component
 *      into `SeasonOpenerSplash.jsx`.
 *
 * The 8 manager dots are colour-coded for THIS cinematic only — the
 * palette is hand-picked for high contrast on a Hobbiton-green
 * background and on Vader's deep-purple backdrop. It intentionally
 * does NOT reuse `teamKitStyles.js` kit indices because (a) the kit
 * palette skews muted/jersey-realistic, (b) a fresh palette tracks
 * with the "themed-season re-skin" cadence, and (c) the season-opener
 * is a one-off cinematic rather than a persistent identity surface.
 */

/**
 * Episode number rendered in the Vader speech ("Welcome to Episode N.").
 * Bumped at the start of each new TCLOT themed season — stays at 1 for
 * the inaugural Lord of the Rings season.
 */
export const EPISODE_NUMBER = 1;

/**
 * Season-theme display name. Surfaces in the Vader speech ("X has been
 * chosen.") and any future copy that announces the theme. Capitalised
 * the way it should appear on screen.
 */
export const SEASON_THEME = 'Lord of the Rings';

/**
 * Lower-third caption stack delivered in Vader's voice during the final
 * scene. Order matters — captions cross-fade in sequence with a small
 * stagger so each line has time to be read. The opening "Welcome…" and
 * closing "Who will…?" lines are the bookends; the middle two lines
 * carry the season metadata so a re-skin doesn't need any code changes
 * outside this module.
 */
export const VADER_LINES = [
  `Welcome to Episode ${EPISODE_NUMBER}.`,
  'A season awaits.',
  `${SEASON_THEME} has been chosen.`,
  'Who will win the Ring?',
];

/**
 * League-entry IDs + colour assignments for the eight TCLOT managers,
 * in the order their dots enter the dark forest scene. The `id` values
 * mirror the `id` field in `web/public/league-data/details.json`
 * (NOT `entry_id`) — the same convention `championOfRecord.js` and
 * `EndOfSeasonSplash.OUTRO_BADGES` use.
 *
 * Each `colour` is hand-picked for:
 *   - High contrast on Hobbiton green (#6ab64a / #4a8a3a) AND on the
 *     deep-purple Vader backdrop (#1a0a14),
 *   - Mutual distinguishability when all eight dots are visible at
 *     once on screen (no two adjacent hues),
 *   - Surface-level evocation of LOTR fellowship colour cues (bright
 *     red for the boldest, royal blue for noble, gold for the
 *     champion, cream for the wise/elder, etc.) — but only loosely,
 *     since the cinematic is meant to be playful not allegorical.
 *
 * `surname` is the standout label rendered under each dot. "Ward" is
 * disambiguated as "J Ward" / "A Ward" because the league has two
 * managers with the same surname.
 */
export const SEASON_OPENER_MANAGERS = [
  { id: 26587, surname: 'Goodacre',     colour: '#ff3b3b' }, // cardinal red
  { id: 26675, surname: 'Mottershead',  colour: '#ff8c2a' }, // deep orange
  { id: 27370, surname: 'Higman',       colour: '#ffd23f' }, // saffron yellow (champion-coded)
  { id: 31076, surname: 'Butcher',      colour: '#00d1b2' }, // teal
  { id: 39078, surname: 'Sutton',       colour: '#2196f3' }, // royal blue
  { id: 39219, surname: 'J Ward',       colour: '#9c27b0' }, // violet
  { id: 40206, surname: 'A Ward',       colour: '#f06292' }, // pink
  { id: 72086, surname: 'Webster',      colour: '#f4eaff' }, // cream / pale lilac
];

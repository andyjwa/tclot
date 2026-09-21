/**
 * Shared team-name display helpers.
 *
 * Mobile surfaces outside Standings and Weekly waivers (Live GW fixture
 * rows, draft board, etc.) collapse full team names to a curated short
 * label from {@link MOBILE_SHORT_NAMES}, else the first word —
 * `firstWord('Crouch End Oashisu') === 'Crouch'`.
 *
 * Mobile Standings and Weekly waivers dropped that first-word collapse:
 * without a manager subtitle there is room for the full club name. The
 * one exception is MSFG, which renders as `Mordor SFG` even when the FPL
 * entry is the long Mordorlicious / Mordor S.F.G form. Use
 * {@link standingsMobileTeamName} for those surfaces.
 */

/** Curated mobile labels for the 2026-27 squads, keyed by full `entry_name`. */
const MOBILE_SHORT_NAMES = new Map([
  ['Atlético Bilbo', 'Atleti Bilbo'],
  ['Toronto Gimli', 'To. Gimli'],
  ['Suffolk Sméagol', 'Sméagol'],
  ['Rokesly Regorasu', 'Regorasu'],
  ['Hackney Rohirrim', 'Rohirrim'],
  ['Mordor S.F.G', 'MSFG'],
  ['Mordor SFG', 'MSFG'],
  ['Seoul Shire', 'Seoul Shire'],
  ['Brampton Balrogs', 'Balrogs'],
]);

/**
 * Short display label for a team name: curated override when known, otherwise
 * the first whitespace-delimited word (or empty string when the input is
 * missing). Pure helper — no DOM access; safe in tests.
 *
 * @param {string | null | undefined} name
 * @returns {string}
 */
export function firstWord(name) {
  if (name == null) return '';
  const trimmed = String(name).trim();
  const curated = MOBILE_SHORT_NAMES.get(trimmed);
  if (curated) return curated;
  return trimmed.split(/\s+/)[0] ?? '';
}

/** Mobile Standings label for Mr Mordorlicious School for Girls. */
export const MSFG_STANDINGS_LABEL = 'Mordor SFG'

/**
 * Face-off row fallback label when the full club name doesn't fit its slot:
 * the LAST word of the name (`'Toronto Gimli'` → `'Gimli'`,
 * `'Hackney Rohirrim'` → `'Rohirrim'`), except MSFG which reads best as
 * `'Mordor'`. Pure helper — no DOM access; safe in tests.
 *
 * @param {string | null | undefined} name
 * @returns {string}
 */
export function lastWordTeamName(name) {
  if (name == null) return ''
  const trimmed = String(name).trim()
  if (!trimmed) return ''
  if (isMsfgTeamName(trimmed)) return 'Mordor'
  const words = trimmed.split(/\s+/)
  return words[words.length - 1] ?? ''
}

/**
 * Three-letter code for the tightest slots, built from the same last word as
 * {@link lastWordTeamName} so the two labels stay recognisably related:
 * `'Toronto Gimli'` → `'GIM'`, `'Suffolk Sméagol'` → `'SME'`. Accents are
 * folded so the code is plain ASCII. Pure helper — no DOM access.
 *
 * @param {string | null | undefined} name
 * @returns {string}
 */
export function threeLetterTeamName(name) {
  const word = lastWordTeamName(name)
  if (!word) return ''
  const ascii = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const letters = ascii.replace(/[^A-Za-z0-9]/g, '')
  return (letters || ascii).slice(0, 3).toUpperCase()
}

/**
 * Whether a team name is the MSFG club (long form, "Mr. MSFG", or "MSFG").
 *
 * @param {string | null | undefined} name
 * @returns {boolean}
 */
export function isMsfgTeamName(name) {
  const n = String(name ?? '').trim().toLowerCase()
  if (!n) return false
  if (n.includes('mordorlicious')) return true
  const compact = n.replace(/[^a-z0-9]/g, '')
  return compact === 'msfg' || compact === 'mrmsfg' || compact === 'mordorsfg'
}

/**
 * Team name shown on mobile Standings (hero + table, and Live Table)
 * and Weekly waivers (All Swaps, By team, desktop swap table).
 * Full name for every club except MSFG, which always renders as
 * `Mordor SFG`.
 *
 * @param {string | null | undefined} name
 * @returns {string}
 */
export function standingsMobileTeamName(name) {
  if (name == null) return ''
  const trimmed = String(name).trim()
  if (!trimmed) return ''
  if (isMsfgTeamName(trimmed)) return MSFG_STANDINGS_LABEL
  return trimmed
}

/** Banner copy when the two lowest GW scores drew with each other. */
export const COUPLE_OF_VILLAINS_LINE = 'couple of villains!'

/**
 * Scorecard / schedule banner copy for a villain victory. Always pass the
 * full club name — {@link firstWord} applies the curated short label
 * (`Rokesly Regorasu` → `Regorasu is a villain!`).
 *
 * @param {string | null | undefined} fullName
 * @returns {string}
 */
export function villainVictoryLine(fullName) {
  const short = firstWord(fullName)
  if (!short) return 'Villain victory'
  return `${short} is a villain!`
}

/**
 * Matchup banner: a lone villain is named; a bottom-table draw is
 * {@link COUPLE_OF_VILLAINS_LINE}.
 *
 * @param {{ homeName?: string | null, awayName?: string | null, homeVillain?: boolean, awayVillain?: boolean }} sides
 * @returns {string | null}
 */
export function matchupVillainVictoryLine({
  homeName,
  awayName,
  homeVillain = false,
  awayVillain = false,
} = {}) {
  if (homeVillain && awayVillain) return COUPLE_OF_VILLAINS_LINE
  if (homeVillain) return villainVictoryLine(homeName)
  if (awayVillain) return villainVictoryLine(awayName)
  return null
}

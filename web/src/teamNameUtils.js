/**
 * Shared team-name display helpers.
 *
 * Mobile surfaces outside Standings (Live GW fixture rows, waivers,
 * draft board, etc.) collapse full team names to a curated short label
 * from {@link MOBILE_SHORT_NAMES}, else the first word —
 * `firstWord('Crouch End Oashisu') === 'Crouch'`.
 *
 * Mobile Standings dropped that first-word collapse: without the
 * manager subtitle there is room for the full club name. The one
 * exception is MSFG, which renders as `Mordor SFG` even when the FPL
 * entry is the long Mordorlicious / Mordor S.F.G form.
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
 * Team name shown on mobile Standings (hero + table, and Live Table).
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

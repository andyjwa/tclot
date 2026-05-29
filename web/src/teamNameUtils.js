/**
 * Shared team-name display helpers.
 *
 * Mobile surfaces (Standings hero/table, Live GW fixture rows, etc.) collapse
 * full team names down to the first word so they fit on a phone without
 * `text-overflow: ellipsis` truncating mid-word. Co-locating the helper here
 * keeps that mapping consistent across screens — `firstWord('Crouch End
 * Oashisu') === 'Crouch'`, `firstWord('Hanson of York AFC') === 'Hanson'`.
 */

/**
 * First whitespace-delimited word of a team name (or empty string when the
 * input is missing). Pure helper — no DOM access; safe in tests.
 *
 * @param {string | null | undefined} name
 * @returns {string}
 */
export function firstWord(name) {
  if (name == null) return '';
  const parts = String(name).trim().split(/\s+/);
  return parts[0] ?? '';
}

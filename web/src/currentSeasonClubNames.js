import { isMsfgTeamName } from './teamNameUtils.js'

/** Data-level entry name for the MSFG club — desktop and mobile both show
 * `Mordor SFG` (mobile's `standingsMobileTeamName` re-label is a no-op on it);
 * tight surfaces still collapse it to `MSFG` via `firstWord`. */
const MSFG_ENTRY_NAME = 'Mordor SFG'

const FIRST_ALIASES = {
  michael: 'mike',
  terry: 'eddy',
  tery: 'eddy',
}

const LAST_ALIASES = {
  buther: 'butcher',
}

function foldToken(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
}

function canonicalFirst(value) {
  const folded = foldToken(value)
  return FIRST_ALIASES[folded] ?? folded
}

function canonicalLast(value) {
  const folded = foldToken(value)
  return LAST_ALIASES[folded] ?? folded
}

/**
 * Stable manager key: canonical first + last.
 * Handles roster typos (Buther/Butcher, Tery/Eddy, Michael/Mike).
 *
 * @param {string | null | undefined} first
 * @param {string | null | undefined} last
 * @returns {string}
 */
export function managerMatchKey(first, last) {
  const f = canonicalFirst(first)
  const l = canonicalLast(last)
  if (!f && !l) return ''
  return `${f}|${l}`
}

/**
 * @param {string | null | undefined} fullName
 * @returns {string}
 */
export function managerMatchKeyFromFull(fullName) {
  const parts = String(fullName ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return managerMatchKey(parts[0], '')
  return managerMatchKey(parts[0], parts[parts.length - 1])
}

/**
 * Club label for the live Table / league UI.
 * MSFG stays `MSFG`; every other club uses the full 26/27 name.
 *
 * @param {{ name?: string, shortName?: string } | null | undefined} club
 * @returns {string}
 */
export function currentSeasonClubLabel(club) {
  const full = String(club?.name ?? '').trim()
  const short = String(club?.shortName ?? '').trim()
  if (isMsfgTeamName(full) || isMsfgTeamName(short)) return MSFG_ENTRY_NAME
  return full
}

/**
 * Map manager-match-key → 26/27 club label from the preseason roster.
 *
 * @param {{ teams?: Array<{ name?: string, shortName?: string, manager?: string }> } | null | undefined} manifest
 * @returns {Map<string, string>}
 */
export function currentSeasonNameByManagerKey(manifest) {
  const out = new Map()
  const teams = Array.isArray(manifest?.teams) ? manifest.teams : []
  for (const club of teams) {
    const key = managerMatchKeyFromFull(club?.manager)
    const label = currentSeasonClubLabel(club)
    if (key && label) out.set(key, label)
  }
  return out
}

/**
 * Prefer the 26/27 club name when this manager is on the new roster.
 *
 * @param {{
 *   player_first_name?: string,
 *   player_last_name?: string,
 *   entry_name?: string,
 * }} entry
 * @param {Map<string, string> | null | undefined} byManager
 * @returns {string | null}
 */
export function overlayCurrentSeasonEntryName(entry, byManager) {
  if (!byManager || byManager.size === 0) return null
  const key = managerMatchKey(entry?.player_first_name, entry?.player_last_name)
  if (!key) return null
  return byManager.get(key) ?? null
}

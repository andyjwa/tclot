/**
 * Reigning champion — the league_entry `id` (NOT `entry_id`) of the manager
 * who lifted the previous season's trophy. Used by surfaces that ceremonially
 * mark the champion: the GW1 "Guard of Honour" splash, the persistent champion
 * marker on the live face-off row, the Hall of Champions hero card, etc.
 *
 * 2025/26 champion: David Higman · Crouch End Oashisu.
 *
 * NB: the `entry_id` for this team is `27870` (FPL global) — that's the wrong
 * one. Internal H2H records, `gwMatches[*].league_entry_1`/`_2`, and the
 * `squad.leagueEntryId` field all use the `id` field (`27370`).
 */
export const REIGNING_CHAMPION_LEAGUE_ENTRY_ID = 27370;

/** Manager surname rendered as the standout label on the splash. */
export const REIGNING_CHAMPION_MANAGER_SURNAME = 'Higman';

/** Team name surfaced in screen-reader labels and dismiss confirmations. */
export const REIGNING_CHAMPION_TEAM_NAME = 'Crouch End Oashisu';

/** Season label rendered in the ribbon caption. */
export const REIGNING_CHAMPION_SEASON_LABEL = '2025/26 CHAMPION';

/**
 * Manager surname for the league "wooden spoon" recipient — the manager whose
 * end-of-season punishment is to assemble a jigsaw puzzle in a tiny enclosed
 * space (the long-running league forfeit). Used as the standout label on the
 * bathroom puzzle scene of the End-of-Season splash, the same way
 * `REIGNING_CHAMPION_MANAGER_SURNAME` labels Higman on the Guard of Honour.
 */
export const WOODEN_SPOON_MANAGER_SURNAME = 'Tery';

/**
 * Pull the surname (last whitespace-separated token) out of a manager's full
 * display name. Falls back to the full name when there's only one token (no
 * surname). Returns null for empty / nullish input so callers can branch.
 *
 * @param {string | null | undefined} fullName
 * @returns {string | null}
 */
export function managerSurnameFromFullName(fullName) {
  const s = String(fullName ?? '').trim();
  if (!s) return null;
  const tokens = s.split(/\s+/);
  return tokens[tokens.length - 1];
}

/**
 * Locate the champion's fixture inside a list of GW H2H matches and return
 * both league_entry ids so the caller can resolve the home / away squads.
 *
 * Returns null when the champion isn't on either side of any match (blank
 * GW, schedule not loaded, or fixture data is for a different league).
 *
 * @param {Array<{ league_entry_1?: number, league_entry_2?: number }> | null | undefined} gwMatches
 * @param {number} championLeagueEntryId
 * @returns {{ championLeagueEntryId: number, opponentLeagueEntryId: number, championIsHome: boolean } | null}
 */
export function findChampionFixture(gwMatches, championLeagueEntryId) {
  if (!Array.isArray(gwMatches) || gwMatches.length === 0) return null;
  const champ = Number(championLeagueEntryId);
  if (!Number.isFinite(champ)) return null;
  for (const m of gwMatches) {
    const h = Number(m?.league_entry_1);
    const a = Number(m?.league_entry_2);
    if (h === champ) {
      return { championLeagueEntryId: champ, opponentLeagueEntryId: a, championIsHome: true };
    }
    if (a === champ) {
      return { championLeagueEntryId: champ, opponentLeagueEntryId: h, championIsHome: false };
    }
  }
  return null;
}

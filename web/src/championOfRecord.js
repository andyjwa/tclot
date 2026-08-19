/**
 * Reigning champion — the league_entry `id` (NOT `entry_id`) of the manager
 * who lifted the previous season's trophy. Used by surfaces that ceremonially
 * mark the champion: the GW1 "Guard of Honour" splash, the persistent champion
 * marker on the live face-off row, the Hall of Champions hero card, etc.
 *
 * 2025/26 champion: David Higman — won the title as Crouch End Oashisu,
 * rebranded to Rokesly Regorasu for 2026/27.
 *
 * IMPORTANT: draft leagues mint NEW league_entry ids every season, so this id
 * (and the team name below) must be refreshed from the new season's
 * `details.json` on every rollover or the GW1 fixture lookup silently fails
 * and the splash never renders. 2026/27 id for Higman: `6849`.
 *
 * NB: the `entry_id` for this team is `6845` (FPL global) — that's the wrong
 * one. Internal H2H records, `gwMatches[*].league_entry_1`/`_2`, and the
 * `squad.leagueEntryId` field all use the `id` field (`6849`).
 */
export const REIGNING_CHAMPION_LEAGUE_ENTRY_ID = 6849;

/** Manager surname rendered as the standout label on the splash. */
export const REIGNING_CHAMPION_MANAGER_SURNAME = 'Higman';

/** Current-season team name, surfaced in screen-reader labels. */
export const REIGNING_CHAMPION_TEAM_NAME = 'Rokesly Regorasu';

/** Team name the title was actually WON under (pre-rebrand). The
 * collapsed Guard of Honour strip honours the champion by this name —
 * "Guard of Honour for the Crouch End Oashisu" — since that's the club
 * on the 2025/26 trophy engraving. */
export const REIGNING_CHAMPION_TITLE_TEAM_NAME = 'Crouch End Oashisu';

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
 * Should the Guard of Honour splash render COLLAPSED by default?
 *
 * The splash stays fully expanded (auto-playing the cinematic) through the
 * end of the gameweek's DEADLINE DAY in the viewer's local time — for GW1
 * 2026/27 that's opening Friday — and auto-collapses to the slim strip from
 * the next local midnight onward (Saturday / Sunday of the gameweek), so the
 * ceremony gets out of the way once matches are actually being played.
 *
 * Returns false (stay expanded) when the deadline is missing/unparseable so
 * a data hiccup degrades to the celebratory state, not a hidden one.
 *
 * @param {string | null | undefined} deadlineTimeIso — the GW's
 *   `deadline_time` from the draft bootstrap (e.g. `2026-08-21T17:30:00Z`).
 * @param {number} [nowMs] — injection point for tests; defaults to now.
 * @returns {boolean}
 */
export function championSplashAutoCollapsed(deadlineTimeIso, nowMs = Date.now()) {
  const t = Date.parse(String(deadlineTimeIso ?? ''));
  if (!Number.isFinite(t)) return false;
  const d = new Date(t);
  // Local midnight AFTER the deadline day.
  const endOfDeadlineDay = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + 1,
  ).getTime();
  return nowMs >= endOfDeadlineDay;
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

/**
 * Shared "Match events" rows used by the Scores fixture card and the
 * Lineups fixture header: G / A / DC / CS / SV / cards / B, home left
 * and away right around a centre kind chip.
 */
import {
  dcThresholdReached,
  isCleanSheetEligible,
  svEventTag,
} from './liveScoresDerivations.js';
import {
  defensiveContributionCountFromLiveRow,
  penaltiesSavedFromLiveRow,
} from './fplBonusFromBps.js';
import { fplElementWebName } from './fplElementNames.js';

/** Letter-chip kinds and coloured card swatches, in display order. */
export const MATCH_EVENT_KINDS = [
  { id: 'g', glyph: 'G', title: 'Goals' },
  { id: 'a', glyph: 'A', title: 'Assists' },
  { id: 'dc', glyph: 'DC', title: 'Defensive contribution' },
  { id: 'cs', glyph: 'CS', title: 'Clean sheets' },
  { id: 'sv', glyph: 'SV', title: 'Save points' },
  { id: 'y', card: 'y', title: 'Yellow cards' },
  { id: 'r', card: 'r', title: 'Red cards' },
  { id: 'b', glyph: 'B', title: 'Bonus points' },
];

/** Waiver / unowned players only appear on these rows. */
export const WAIVER_MATCH_EVENT_IDS = new Set(['g', 'a', 'b']);

const POS_BY_TYPE = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };

export function emptyMatchEvents() {
  return { g: [], a: [], dc: [], cs: [], sv: [], y: [], r: [], b: [] };
}

/**
 * Per-kind entries for one player row (same tags as the Scores card).
 * @param {object} row
 * @returns {ReturnType<typeof emptyMatchEvents>}
 */
export function playerMatchEventEntries(row) {
  const ev = emptyMatchEvents();
  const name = row.displayName ?? row.web_name ?? `#${row.element}`;
  const played = (Number(row.minutes) || 0) > 0;
  const goals = Number(row.goalsScored) || 0;
  const assists = Number(row.assists) || 0;
  const dc = Number(row.dcCount) || 0;
  const cleanSheets = Number(row.cleanSheets) || 0;
  const saves = Number(row.saves) || 0;
  const penaltiesSaved = Number(row.penaltiesSaved) || 0;
  const yellows = Number(row.yellowCards) || 0;
  const reds = Number(row.redCards) || 0;
  const bonus = Number(row.bonus) || 0;
  const bonusConfirmed = row.bonusConfirmed === true;
  const mark = (id, tag, extra = {}) => {
    ev[id].push({ name, tag, element: row.element, ...extra });
  };
  if (goals > 0) mark('g', goals > 1 ? `×${goals}` : '');
  if (assists > 0) mark('a', assists > 1 ? `×${assists}` : '');
  if (played && dcThresholdReached(row.posSingular, dc)) {
    mark('dc', `(${dc})`);
  }
  if (played && cleanSheets > 0 && isCleanSheetEligible(row.posSingular)) {
    mark('cs', '');
  }
  const svTag = svEventTag(saves, penaltiesSaved);
  if (svTag) mark('sv', svTag);
  if (yellows > 0) mark('y', yellows > 1 ? `×${yellows}` : '');
  if (reds > 0) mark('r', '');
  if (bonus > 0) {
    mark('b', bonusConfirmed ? `+${bonus}` : `~+${bonus}`, {
      bonus,
      bonusConfirmed,
    });
  }
  return ev;
}

/**
 * Fold player rows into per-kind lists. When `waiverKindIds` is set,
 * unowned players (`row.owner == null`) only contribute those kinds.
 * @param {object[]} rows
 * @param {{ waiverKindIds?: Set<string> | null }} [opts]
 */
export function collectSideEvents(rows, opts = {}) {
  const ev = emptyMatchEvents();
  const waiverKindIds = opts.waiverKindIds ?? null;
  for (const row of rows || []) {
    const owned = row?.owner != null;
    const entries = playerMatchEventEntries(row);
    for (const id of Object.keys(ev)) {
      if (!owned && waiverKindIds && !waiverKindIds.has(id)) continue;
      for (const e of entries[id]) {
        ev[id].push({
          ...e,
          owner: row.owner ?? null,
          onWaiver: !owned,
        });
      }
    }
  }
  ev.b.sort((x, y) => (Number(y.bonus) || 0) - (Number(x.bonus) || 0));
  return ev;
}

function liveStatsMapGet(map, id) {
  if (!map) return null;
  return map[id] ?? map[String(id)] ?? null;
}

/**
 * FPL live stats for one element. GW totals — fine for SGW; DGW still
 * shows the player's GW line on every club fixture they play.
 */
export function liveRowToMatchPlayer(el, liveByElementId, liveFullByElementId) {
  const id = Number(el?.id);
  if (!Number.isFinite(id)) return null;
  const st =
    liveStatsMapGet(liveByElementId, id) ||
    liveStatsMapGet(liveFullByElementId, id)?.stats ||
    {};
  const liveRow =
    liveStatsMapGet(liveFullByElementId, id) ||
    (st && Object.keys(st).length ? { stats: st } : null);
  const bonus = Number(st.bonus) || 0;
  return {
    element: id,
    goalsScored: Number(st.goals_scored) || 0,
    assists: Number(st.assists) || 0,
    dcCount: defensiveContributionCountFromLiveRow(liveRow),
    cleanSheets: Number(st.clean_sheets) || 0,
    saves: Number(st.saves) || 0,
    penaltiesSaved:
      penaltiesSavedFromLiveRow(liveRow) || Number(st.penalties_saved) || 0,
    yellowCards: Number(st.yellow_cards) || 0,
    redCards: Number(st.red_cards) || 0,
    bonus,
    bonusConfirmed: bonus > 0,
    minutes: Number(st.minutes) || 0,
  };
}

/**
 * Every draft element on a PL club, with live stats + fantasy owner.
 * @returns {object[]}
 */
export function premFixturePlayerRows({
  plTeamId,
  elementById,
  liveByElementId,
  liveFullByElementId,
  ownerByEl,
  typeById,
}) {
  const tid = Number(plTeamId);
  if (!Number.isFinite(tid) || !elementById) return [];
  const out = [];
  for (const el of Object.values(elementById)) {
    if (Number(el?.team) !== tid) continue;
    const stats = liveRowToMatchPlayer(el, liveByElementId, liveFullByElementId);
    if (!stats) continue;
    const type = typeById?.[Number(el.element_type)];
    const posSingular =
      type?.singular_name_short || POS_BY_TYPE[Number(el.element_type)] || '—';
    const ownerId = Number(stats.element);
    const owner = ownerByEl?.get(ownerId) ?? ownerByEl?.get(String(ownerId)) ?? null;
    out.push({
      ...stats,
      displayName: fplElementWebName(el, stats.element),
      web_name: el.web_name,
      posSingular,
      owner,
    });
  }
  out.sort((a, b) =>
    String(a.displayName).localeCompare(String(b.displayName), undefined, {
      sensitivity: 'base',
    }),
  );
  return out;
}

/** True when either side has at least one name on this kind. */
export function matchEventKindActive(kind, home, away) {
  return Boolean(home?.[kind.id]?.length || away?.[kind.id]?.length);
}

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

function elementFromById(elementById, id) {
  if (!elementById) return null;
  return elementById[id] ?? elementById[String(id)] ?? null;
}

const EXPLAIN_STAT_TO_FIELD = {
  goals_scored: 'goalsScored',
  assists: 'assists',
  clean_sheets: 'cleanSheets',
  saves: 'saves',
  penalties_saved: 'penaltiesSaved',
  yellow_cards: 'yellowCards',
  red_cards: 'redCards',
  bonus: 'bonus',
  minutes: 'minutes',
  defensive_contribution: 'dcCount',
};

/**
 * Per-fixture live `explain` values for one element.
 * `null` — no explain blocks at all (use GW totals).
 * `{ otherFixture: true }` — explain exists but not for this fixture (do not leak).
 * otherwise a sparse map of known stat fields.
 */
export function explainStatValuesForFixture(liveRow, fixtureId) {
  const fid = Number(fixtureId);
  const ex = liveRow?.explain;
  if (!Number.isFinite(fid) || !Array.isArray(ex) || ex.length === 0) return null;
  const first = ex[0];
  let statList = null;
  let sawBlock = false;

  if (Array.isArray(first) && first.length === 2 && typeof first[1] === 'number') {
    sawBlock = true;
    for (const pair of ex) {
      if (Number(pair[1]) === fid) {
        statList = pair[0];
        break;
      }
    }
  } else if (first && first.fixture != null) {
    sawBlock = true;
    for (const block of ex) {
      if (Number(block.fixture) === fid) {
        statList = block.stats;
        break;
      }
    }
  }

  if (!sawBlock) return null;
  if (!statList) return { otherFixture: true };

  const out = {};
  for (const s of statList || []) {
    const key = s?.stat ?? s?.identifier;
    const dest = EXPLAIN_STAT_TO_FIELD[key];
    if (!dest) continue;
    out[dest] = (Number(out[dest]) || 0) + (Number(s.value) || 0);
  }
  return out;
}

function emptyMatchPlayerStats(id) {
  return {
    element: id,
    goalsScored: 0,
    assists: 0,
    dcCount: 0,
    cleanSheets: 0,
    saves: 0,
    penaltiesSaved: 0,
    yellowCards: 0,
    redCards: 0,
    bonus: 0,
    bonusConfirmed: false,
    minutes: 0,
  };
}

/**
 * FPL live stats for one element. Prefers the `explain` block for
 * `fixtureId` so DGW / loan / club-id mismatches do not leak another
 * match's G/A/cards onto this fixture. GW totals when explain is empty.
 */
export function liveRowToMatchPlayer(
  el,
  liveByElementId,
  liveFullByElementId,
  opts = {},
) {
  const id = Number(el?.id ?? el?.element);
  if (!Number.isFinite(id)) return null;
  const st =
    liveStatsMapGet(liveByElementId, id) ||
    liveStatsMapGet(liveFullByElementId, id)?.stats ||
    {};
  const liveRow =
    liveStatsMapGet(liveFullByElementId, id) ||
    (st && Object.keys(st).length ? { stats: st } : null);
  const explained = explainStatValuesForFixture(liveRow, opts.fixtureId);
  if (explained?.otherFixture) return emptyMatchPlayerStats(id);
  if (explained) {
    const bonus = Number(explained.bonus) || 0;
    return {
      element: id,
      goalsScored: Number(explained.goalsScored) || 0,
      assists: Number(explained.assists) || 0,
      dcCount: Number(explained.dcCount) || 0,
      cleanSheets: Number(explained.cleanSheets) || 0,
      saves: Number(explained.saves) || 0,
      penaltiesSaved: Number(explained.penaltiesSaved) || 0,
      yellowCards: Number(explained.yellowCards) || 0,
      redCards: Number(explained.redCards) || 0,
      bonus,
      bonusConfirmed: bonus > 0,
      minutes: Number(explained.minutes) || 0,
    };
  }
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

/** Announced XI + bench FPL element ids for one PremWindow side. */
export function lineupElementIds(sideLineup) {
  const ids = [];
  for (const p of [...(sideLineup?.xi || []), ...(sideLineup?.bench || [])]) {
    const id = Number(p?.elementId);
    if (Number.isFinite(id) && id > 0) ids.push(id);
  }
  return ids;
}

/** Every announced lineup element id across a PremWindow row list. */
export function claimedLineupElementIds(premWindowRows) {
  const s = new Set();
  for (const row of premWindowRows || []) {
    for (const id of lineupElementIds(row?.lineups?.home)) s.add(id);
    for (const id of lineupElementIds(row?.lineups?.away)) s.add(id);
  }
  return s;
}

/**
 * Players on this fixture side: announced lineup first, then the rest of
 * the PL club who are not listed in any announced lineup this GW.
 */
export function sideElementIds({
  plTeamId,
  elementById,
  sideLineup,
  claimedElementIds,
}) {
  const ids = new Set(lineupElementIds(sideLineup));
  const claimed =
    claimedElementIds instanceof Set
      ? claimedElementIds
      : new Set(claimedElementIds || []);
  const tid = Number(plTeamId);
  if (Number.isFinite(tid) && elementById) {
    for (const el of Object.values(elementById)) {
      const id = Number(el?.id);
      if (!Number.isFinite(id)) continue;
      if (Number(el.team) !== tid) continue;
      if (claimed.has(id) && !ids.has(id)) continue;
      ids.add(id);
    }
  }
  return [...ids];
}

/**
 * Every draft element on a fixture side, with live stats + fantasy owner.
 * @returns {object[]}
 */
export function premFixturePlayerRows({
  plTeamId,
  elementById,
  liveByElementId,
  liveFullByElementId,
  ownerByEl,
  typeById,
  sideLineup,
  claimedElementIds,
  fixtureId,
}) {
  const ids = sideElementIds({
    plTeamId,
    elementById,
    sideLineup,
    claimedElementIds,
  });
  const out = [];
  for (const id of ids) {
    const el = elementFromById(elementById, id);
    const stats = liveRowToMatchPlayer(
      el || { id },
      liveByElementId,
      liveFullByElementId,
      { fixtureId },
    );
    if (!stats) continue;
    const type = typeById?.[Number(el?.element_type)];
    const posSingular =
      type?.singular_name_short || POS_BY_TYPE[Number(el?.element_type)] || '—';
    const owner = ownerByEl?.get(id) ?? ownerByEl?.get(String(id)) ?? null;
    const lineupName = [...(sideLineup?.xi || []), ...(sideLineup?.bench || [])]
      .find((p) => Number(p?.elementId) === id);
    out.push({
      ...stats,
      displayName:
        (el ? fplElementWebName(el, id) : null) ||
        lineupName?.fplWebName ||
        lineupName?.name ||
        `#${id}`,
      web_name: el?.web_name,
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

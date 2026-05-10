import {
  activeExplainBlocks,
  defensiveContributionPointsFromLiveRow,
  explainBlocksFromLiveElement,
  fixturesForTeamInGw,
} from './fplBonusFromBps.js';

/** FPL element_type id for goalkeepers */
const ELEMENT_TYPE_GKP = 1;

/**
 * Fantasy points from saves (1 pt per 3 saves) — goalkeepers only.
 * @param {number | null | undefined} saves
 * @param {number | null | undefined} elementTypeId
 */
export function saveFantasyPointsFromSaves(saves, elementTypeId) {
  if (Number(elementTypeId) !== ELEMENT_TYPE_GKP) return 0;
  const s = Number(saves) || 0;
  return Math.floor(s / 3);
}

/**
 * English ordinals: 1st, 2nd, 3rd, 4th, …
 * @param {number} n
 */
export function englishOrdinal(n) {
  const i = Math.floor(Math.abs(Number(n)));
  if (i < 1 || !Number.isFinite(i)) return String(n);
  if (i % 100 >= 11 && i % 100 <= 13) return `${i}th`;
  switch (i % 10) {
    case 1:
      return `${i}st`;
    case 2:
      return `${i}nd`;
    case 3:
      return `${i}rd`;
    default:
      return `${i}th`;
  }
}

/**
 * From FPL `stableId` `${gw}:${el}:(goal|assist):totN` (cumulative in GW), a short
 * label for the 2nd+ such event, e.g. "2nd assist" / "3rd goal". Null for 1st or
 * non-FPL rows (ESPN, FotMob, cards).
 * @param {string | null | undefined} stableId
 * @param {string} kind
 * @returns {string | null}
 */
export function fplCumulativeEventOrdinalLabel(stableId, kind) {
  if (kind !== 'goal' && kind !== 'assist') return null;
  const s = String(stableId || '');
  const m = s.match(/^\d+:\d+:(goal|assist):tot(\d+)$/);
  if (!m) return null;
  if (m[1] !== kind) return null;
  const tot = Number(m[2]);
  if (!Number.isFinite(tot) || tot < 2) return null;
  return `${englishOrdinal(tot)} ${kind === 'goal' ? 'goal' : 'assist'}`;
}

function statsOf(liveRow) {
  return liveRow?.stats || {};
}

/**
 * True if FPL shows the player has on-pitch time this GW (GW `stats.minutes` or per-fixture
 * `explain` block minutes). Goal/assist/DC/save feed rows are only created when this is true
 * (including every live poll, not just the first) so 0-minute placeholder stats never become events.
 * @param {object | null | undefined} liveRow
 */
function hasMeaningfulMinutesOnPitch(liveRow) {
  if (!liveRow) return false;
  const m = Number(liveRow.stats?.minutes);
  if (Number.isFinite(m) && m > 0) return true;
  for (const b of explainBlocksFromLiveElement(liveRow)) {
    if (Number(b.minutes) > 0) return true;
  }
  return false;
}

/**
 * Cumulative N from FPL `stableId` `…:totN` (goals, assists, DC/save **points** tiers, etc.).
 */
function fplTotSuffixN(stableId) {
  const m = String(stableId || '').match(/:tot(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Dropped when current FPL live **stats** do not back this `…:totN` row. Handles stale
 * `localStorage` or bad rows for players with real minutes (previously they were never
 * pruned because we only treated 0-minute ghosts as invalid).
 * @param {object} ev
 * @param {object | null | undefined} liveRow
 * @param {number | null | undefined} elementTypeId
 */
export function fplTotalFeedEventContradictsLive(ev, liveRow, elementTypeId) {
  if (!ev) return false;
  if (!/^\d+:\d+:(goal|assist|dc_points|save_points):tot/.test(String(ev.stableId || '')))
    return false;
  if (!liveRow) return false;
  const N = fplTotSuffixN(ev.stableId);
  if (N == null || N < 0) return false;
  const s = statsOf(liveRow);
  if (ev.kind === 'goal') {
    return (Number(s.goals_scored) || 0) < N;
  }
  if (ev.kind === 'assist') {
    return (Number(s.assists) || 0) < N;
  }
  if (ev.kind === 'dc_points') {
    return defensiveContributionPointsFromLiveRow(liveRow) < N;
  }
  if (ev.kind === 'save_points') {
    return saveFantasyPointsFromSaves(s.saves, elementTypeId) < N;
  }
  return false;
}

/**
 * Full `event/live` element (stats + `explain`) is used for FPL :tot… validation; if that
 * id is missing from `liveFull` (e.g. keying quirks) fall back to the same payload’s
 * `liveBy` stats map.
 *
 * @param {Record<number, object> | null | undefined} liveFullById
 * @param {Record<number, object> | null | undefined} liveById — per-element `stats` only
 * @param {number | null | undefined} elementId
 */
export function liveElementRowForFeedValidation(
  liveFullById,
  liveById,
  elementId
) {
  const eid = Number(elementId);
  if (!Number.isFinite(eid)) return null;
  if (liveFullById && liveFullById[eid] != null) return liveFullById[eid];
  if (liveById && liveById[eid] != null) {
    return { stats: liveById[eid] };
  }
  return null;
}

/**
 * Clock proxy for this appearance: `explain` minutes for `fixtureId`, else GW `stats.minutes`.
 * `stats.minutes` alone is a poor timeline key after FT (often 90 for everyone) and can
 * double-count oddly on DGW without per-fixture explain.
 */
function minutesOnFixtureForTimeline(nextRow, fixtureId) {
  const agg = Number(statsOf(nextRow).minutes) || 0;
  if (
    nextRow &&
    fixtureId != null &&
    Number.isFinite(Number(fixtureId))
  ) {
    const fid = Number(fixtureId);
    const blocks = explainBlocksFromLiveElement(nextRow);
    for (const b of blocks) {
      if (Number(b.fixtureId) === fid && Number(b.minutes) > 0) {
        return Number(b.minutes);
      }
    }
  }
  return agg;
}

/**
 * Draft `explain`: `[ [ stats[], fixtureId ], … ]`; classic: `[ { fixture, stats }, … ]`.
 * @param {object | null | undefined} raw — full live element row
 * @returns {number[]}
 */
export function explainFixtureIdsFromLiveRow(raw) {
  const ex = raw?.explain;
  if (!Array.isArray(ex) || !ex.length) return [];
  const first = ex[0];
  if (Array.isArray(first) && first.length === 2 && typeof first[1] === 'number') {
    return ex.map((pair) => Number(pair[1])).filter((n) => Number.isFinite(n));
  }
  if (first && first.fixture != null) {
    return ex.map((b) => Number(b.fixture)).filter((n) => Number.isFinite(n));
  }
  return [];
}

function teamPlaysFixture(teamId, fx) {
  const t = Number(teamId);
  return Number(fx.team_h) === t || Number(fx.team_a) === t;
}

/**
 * Fixture row for this player’s GW appearance (explain when possible; else sole team fixture).
 * @param {object} nextRow — full `event/live` element
 * @param {number | null | undefined} teamId — `elements[].team`
 * @param {object[]} gwFixtures — classic `fixtures?event=…`
 */
export function primaryFixtureForContribution(nextRow, teamId, gwFixtures) {
  const list = gwFixtures || [];
  const t = Number(teamId);
  if (!Number.isFinite(t)) return null;
  for (const fid of explainFixtureIdsFromLiveRow(nextRow)) {
    const fx = list.find((f) => Number(f.id) === fid && teamPlaysFixture(t, f));
    if (fx) return fx;
  }
  const mine = list.filter((f) => teamPlaysFixture(t, f));
  if (mine.length > 1) {
    const withMin = activeExplainBlocks(nextRow).filter((b) => b.minutes > 0);
    if (withMin.length === 1) {
      const fx = list.find(
        (f) => Number(f.id) === withMin[0].fixtureId && teamPlaysFixture(t, f)
      );
      if (fx) return fx;
    }
  }
  if (mine.length === 1) return mine[0];
  if (mine.length > 1) {
    return [...mine].sort((a, b) => {
      const ta = Date.parse(String(a.kickoff_time || ''));
      const tb = Date.parse(String(b.kickoff_time || ''));
      if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
      return String(a.kickoff_time || '').localeCompare(String(b.kickoff_time || ''));
    })[0];
  }
  return null;
}

/**
 * Sub-minute ordering when FPL only gives whole minutes (goal before assist on same clock).
 * Small ms offsets — keep below one in-game minute (60_000 ms).
 */
const KIND_BIAS_MS = {
  goal: 0,
  assist: 3,
  dc_points: 6,
  save_points: 9,
  yellow_card: 12,
  red_card: 15,
};

/**
 * Per-batch emission order — keep total nudge (seq×4 + element id) well below 60_000 ms
 * so ordering never crosses real match-clock minutes.
 */
const EMIT_SEQUENCE_WEIGHT_MS = 4;

/**
 * Approximate real-world ordering: kickoff + clock proxy minutes + kind tie-break + element id + emit sequence.
 * Uses per-fixture `explain` minutes when available; otherwise `stats.minutes`.
 * @param {number | null | undefined} [elementId] — breaks ties when two players score same minute
 * @param {number} [sequenceIndex] — monotonic index within one diff batch (ties within same clock minute)
 * @returns {number} 0 → unknown; caller should fall back to `recordedAt`.
 */
export function contributionApproxTimelineSortKey(
  nextRow,
  element,
  kind,
  gwFixtures,
  elementId,
  sequenceIndex = 0
) {
  const fx = primaryFixtureForContribution(nextRow, element?.team, gwFixtures);
  const kickMs = fx?.kickoff_time ? Date.parse(String(fx.kickoff_time)) : NaN;
  if (!Number.isFinite(kickMs) || kickMs <= 0) return 0;
  const fid = fx?.id != null ? Number(fx.id) : NaN;
  let playerMin = minutesOnFixtureForTimeline(nextRow, fid);
  playerMin = Math.min(Math.max(0, playerMin), 130);
  const base = kickMs + playerMin * 60_000;
  const kb = KIND_BIAS_MS[kind] ?? 20;
  const el =
    elementId != null && Number.isFinite(Number(elementId))
      ? Number(elementId)
      : Number(element?.id);
  const seq = Number(sequenceIndex) || 0;
  const elSlot = Number.isFinite(el) ? el : 0;
  // Integer-safe: base ~1e12 + small offsets; avoid sub-ms fractions that double precision erases.
  return base + kb + seq * EMIT_SEQUENCE_WEIGHT_MS + elSlot;
}

/** Latest in-fixture event first (top of feed); then `recordedAt`; then `stableId`. */
export function compareContributionEventsDesc(a, b) {
  const ka = Number(a?.sortKey);
  const kb = Number(b?.sortKey);
  const aOk = Number.isFinite(ka) && ka > 0;
  const bOk = Number.isFinite(kb) && kb > 0;
  if (aOk && bOk && ka !== kb) return kb - ka;
  if (aOk && !bOk) return -1;
  if (!aOk && bOk) return 1;
  const t = String(b?.recordedAt || '').localeCompare(String(a?.recordedAt || ''));
  if (t !== 0) return t;
  return String(b?.stableId || '').localeCompare(String(a?.stableId || ''));
}

/**
 * Match timeline order: earlier events first (bottom of feed if latest is top). Unknown `sortKey` (0) sorts last among keyed rows.
 */
export function compareContributionEventsAsc(a, b) {
  const ka = Number(a?.sortKey);
  const kb = Number(b?.sortKey);
  const aOk = Number.isFinite(ka) && ka > 0;
  const bOk = Number.isFinite(kb) && kb > 0;
  if (aOk && bOk && ka !== kb) return ka - kb;
  if (aOk && !bOk) return -1;
  if (!aOk && bOk) return 1;
  const t = String(a?.recordedAt || '').localeCompare(String(b?.recordedAt || ''));
  if (t !== 0) return t;
  return String(a?.stableId || '').localeCompare(String(b?.stableId || ''));
}

/** {@link contributionApproxTimelineSortKey} adds real kickoff ms — values below are placeholders. */
const MIN_SANE_FPL_TIMELINE_SORT_KEY = 1e12;

/**
 * Sort key for merged feed: FotMob/ESPN keep `ev.sortKey` (wall time). FPL diff rows prefer a
 * **sane frozen** `sortKey` captured when the event was emitted. Recomputing from the **current**
 * live row replaces in-game clock with FT minutes (often 90′ for everyone), which pushes older
 * goals/assists back to the top of a latest-first feed on every poll.
 *
 * When `sortKey` is missing or tiny, fall back to live + fixtures (hydration / tests).
 *
 * @param {{ liveFullByElementId?: Record<number, object>, elementById?: Record<number, object>, gwFixtures?: object[] }} sortCtx
 */
export function effectiveContributionSortKey(ev, sortCtx) {
  if (!ev || !sortCtx) return Number(ev?.sortKey) || 0;
  const sid = String(ev?.stableId || '');
  if (sid.startsWith('fotmob:') || sid.startsWith('espn:')) {
    return Number(ev.sortKey) || 0;
  }
  const stored = Number(ev.sortKey) || 0;
  if (stored >= MIN_SANE_FPL_TIMELINE_SORT_KEY) {
    return stored;
  }
  const elid = Number(ev.elementId);
  const kind = ev.kind;
  if (!Number.isFinite(elid) || !kind) return stored;
  const liveRow = sortCtx.liveFullByElementId?.[elid];
  const el = sortCtx.elementById?.[elid];
  const gwf = sortCtx.gwFixtures || [];
  if (liveRow && el && gwf.length) {
    const k = contributionApproxTimelineSortKey(
      liveRow,
      el,
      kind,
      gwf,
      elid,
      0
    );
    if (Number.isFinite(k) && k > 0) return k;
  }
  return stored;
}

/**
 * Descending compare using {@link effectiveContributionSortKey} — use for render + merge when
 * `liveFullByElementId` / `gwFixtures` are available.
 *
 * @param {{ liveFullByElementId?: Record<number, object>, elementById?: Record<number, object>, gwFixtures?: object[] }} sortCtx
 */
function comparePrimaryKeys(ka, kb) {
  if (ka === kb) return 0;
  return ka < kb ? -1 : 1;
}

/** Tie-break when primary keys collide (e.g. float edge) or recompute dropped emit slot. */
function compareStoredSortKeys(a, b) {
  const sa = Number(a?.sortKey) || 0;
  const sb = Number(b?.sortKey) || 0;
  if (sa === sb) return 0;
  return sa < sb ? -1 : 1;
}

export function compareContributionEventsDescWithContext(sortCtx) {
  return (a, b) => {
    const ka = effectiveContributionSortKey(a, sortCtx);
    const kb = effectiveContributionSortKey(b, sortCtx);
    const aOk = Number.isFinite(ka) && ka > 0;
    const bOk = Number.isFinite(kb) && kb > 0;
    if (aOk && bOk) {
      const pk = comparePrimaryKeys(kb, ka);
      if (pk !== 0) return pk;
      const sk = compareStoredSortKeys(b, a);
      if (sk !== 0) return sk;
    } else {
      if (aOk && !bOk) return -1;
      if (!aOk && bOk) return 1;
    }
    const t = String(b?.recordedAt || '').localeCompare(String(a?.recordedAt || ''));
    if (t !== 0) return t;
    return String(b?.stableId || '').localeCompare(String(a?.stableId || ''));
  };
}

/**
 * Ascending compare using {@link effectiveContributionSortKey} — earliest real-world event first
 * (top of feed, read down chronologically).
 *
 * @param {{ liveFullByElementId?: Record<number, object>, elementById?: Record<number, object>, gwFixtures?: object[] }} sortCtx
 */
export function compareContributionEventsAscWithContext(sortCtx) {
  return (a, b) => {
    const ka = effectiveContributionSortKey(a, sortCtx);
    const kb = effectiveContributionSortKey(b, sortCtx);
    const aOk = Number.isFinite(ka) && ka > 0;
    const bOk = Number.isFinite(kb) && kb > 0;
    if (aOk && bOk) {
      const pk = comparePrimaryKeys(ka, kb);
      if (pk !== 0) return pk;
      const sk = compareStoredSortKeys(a, b);
      if (sk !== 0) return sk;
    } else {
      if (aOk && !bOk) return -1;
      if (!aOk && bOk) return 1;
    }
    const t = String(a?.recordedAt || '').localeCompare(String(b?.recordedAt || ''));
    if (t !== 0) return t;
    return String(a?.stableId || '').localeCompare(String(b?.stableId || ''));
  };
}

/**
 * Element ids on all squads (starters ∪ bench).
 * @param {object[]} squads
 * @returns {Set<number>}
 */
export function elementIdsFromSquads(squads) {
  const s = new Set();
  for (const q of squads || []) {
    for (const r of q?.starters || []) {
      if (r?.element != null) s.add(Number(r.element));
    }
    for (const r of q?.bench || []) {
      if (r?.element != null) s.add(Number(r.element));
    }
  }
  return s;
}

/**
 * `element_out` from waiver / FA rows (players who left a roster).
 * @param {object[]} waiverOutGwRows
 * @returns {Set<number>}
 */
export function elementIdsFromWaiverDrops(waiverOutGwRows) {
  const s = new Set();
  for (const r of waiverOutGwRows || []) {
    const o = r?.element_out;
    if (o != null && Number.isFinite(Number(o))) s.add(Number(o));
  }
  return s;
}

/**
 * Tracked players: anyone rostered this GW or ever listed as dropped in waiver/FA feed.
 * @param {object[]} squads
 * @param {object[]} waiverOutGwRows
 */
export function buildTrackedElementIdSet(squads, waiverOutGwRows) {
  const s = elementIdsFromSquads(squads);
  for (const id of elementIdsFromWaiverDrops(waiverOutGwRows)) s.add(id);
  return s;
}

/**
 * Every draft element whose PL club plays this gameweek (from classic fixtures).
 * Ensures e.g. goals in MUN–LEE appear even if no fantasy manager owns the scorer.
 * @param {Record<number, object>} elementById
 * @param {number[] | null | undefined} gwTeamIds — FPL `team` ids with a fixture this GW
 */
export function elementIdsFromGwFixtureTeams(elementById, gwTeamIds) {
  const s = new Set();
  const teams = new Set(
    (gwTeamIds || [])
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n))
  );
  if (!teams.size) return s;
  for (const el of Object.values(elementById || {})) {
    const tid = Number(el?.team);
    if (!Number.isFinite(tid) || !teams.has(tid)) continue;
    const id = Number(el.id);
    if (Number.isFinite(id)) s.add(id);
  }
  return s;
}

/**
 * Roster + waiver drops + all players on clubs with a GW fixture.
 */
export function buildTrackedElementIdSetWithFixtures(
  squads,
  waiverOutGwRows,
  elementById,
  gwTeamIds
) {
  const s = buildTrackedElementIdSet(squads, waiverOutGwRows);
  for (const id of elementIdsFromGwFixtureTeams(elementById, gwTeamIds)) {
    s.add(id);
  }
  return s;
}

/**
 * @param {object[]} squads
 * @returns {Map<number, { leagueEntryId: number, teamName: string }>}
 */
export function buildOwnerByElementId(squads) {
  const m = new Map();
  for (const q of squads || []) {
    if (q?.error) continue;
    const lid = Number(q.leagueEntryId);
    const name = String(q.teamName ?? '').trim() || `Team ${lid}`;
    for (const r of [...(q.starters || []), ...(q.bench || [])]) {
      const e = r?.element;
      if (e == null || !Number.isFinite(Number(e))) continue;
      const id = Number(e);
      if (!m.has(id)) m.set(id, { leagueEntryId: lid, teamName: name });
    }
  }
  return m;
}

/**
 * Latest drop (by GW desc, then transactionId desc) per element_out.
 * @param {object[]} waiverOutGwRows
 * @returns {Map<number, { teamName: string, gameweek: number, leagueEntryId: number }>}
 */
export function buildLatestDropByElementOut(waiverOutGwRows) {
  const rows = [...(waiverOutGwRows || [])].filter(
    (r) => r?.element_out != null && r?.entry != null
  );
  rows.sort((a, b) => {
    const g = Number(b.gameweek) - Number(a.gameweek);
    if (g !== 0) return g;
    return Number(b.transactionId) - Number(a.transactionId);
  });
  const m = new Map();
  for (const r of rows) {
    const el = Number(r.element_out);
    if (!Number.isFinite(el) || m.has(el)) continue;
    m.set(el, {
      teamName: String(r.teamName ?? `Team ${r.entry}`).trim(),
      gameweek: Number(r.gameweek) || 0,
      leagueEntryId: Number(r.entry),
    });
  }
  return m;
}

/**
 * Stable key for “ESPN already covered this contribution” — includes FPL fixture id so a
 * player can have one assist from ESPN in fixture A and a second from FPL in fixture B (DGW),
 * or FPL-only assists when ESPN omits them (e.g. some own-goal assist rules).
 * @param {number} elementId
 * @param {string} kind
 * @param {number | null | undefined} fplFixtureId
 */
export function contributionCoverageKey(elementId, kind, fplFixtureId) {
  const el = Number(elementId);
  const k = String(kind || '');
  const fx =
    fplFixtureId != null && Number.isFinite(Number(fplFixtureId))
      ? Number(fplFixtureId)
      : 'na';
  return `${el}:${k}:${fx}`;
}

/**
 * @param {Set<string>} coverageSet
 * @param {number} el
 * @param {string} kind
 * @returns {number[]} distinct numeric fixture ids present in the set
 */
function numericFixtureIdsInCoverageSet(coverageSet, el, kind) {
  const p = `${Number(el)}:${String(kind)}:`;
  if (!Number.isFinite(Number(el))) return [];
  const fids = [];
  for (const k of coverageSet) {
    const s = String(k);
    if (!s.startsWith(p)) continue;
    const rest = s.slice(p.length);
    if (rest === 'na') continue;
    if (!/^\d+$/.test(rest)) continue;
    fids.push(Number(rest));
  }
  return [...new Set(fids)];
}

/**
 * True if ESPN/FotMob {@link buildTimelineCoverageSet} already covers this FPL row.
 * Matches exact `fplFixtureId` or, for goal/assist, the same slot on a **single** team fixture
 * this GW when the row has `:na` or a mismatched id (common SGW + wrong `primaryFixture`).
 *
 * Also, when the coverage set has a single numeric (el, kind) id and the row has
 * `:na` fpl, or the row’s id disagrees with the one real SGW fixture for the player’s
 * team (and ESPN’s set key matches that fixture), the FPL row is dropped.
 * If ESPN’s key does not match the SGW (wrong fixture in feed), the FPL row is kept
 * (see `diffContributionEvents` test: omit key wrong fixture). DGW: two team fixtures
 * in `gw` falls through to the SGW `mine.length === 1` check below, not the fids+sgwFid
 * line above, so a second-future game is not incorrectly hidden.
 */
export function contributionCoveredByTimelineOmit(
  coverageSet,
  elementId,
  kind,
  fplFixtureId,
  teamId,
  gwFixtures
) {
  if (!coverageSet || coverageSet.size === 0) return false;
  if (coverageSet.has(contributionCoverageKey(elementId, kind, fplFixtureId)))
    return true;
  if (kind !== 'goal' && kind !== 'assist') return false;

  const fids = numericFixtureIdsInCoverageSet(
    coverageSet,
    Number(elementId),
    kind
  );
  if (fids.length === 1) {
    const fromOmit = fids[0];
    const fp =
      fplFixtureId != null && Number.isFinite(Number(fplFixtureId))
        ? Number(fplFixtureId)
        : null;
    if (fp == null) {
      return true;
    }
    const tForMine = Number(teamId);
    if (Array.isArray(gwFixtures) && gwFixtures.length > 0 && Number.isFinite(tForMine)) {
      const m = fixturesForTeamInGw(gwFixtures, tForMine);
      if (m.length === 1 && m[0]?.id != null) {
        const sgwFid = Number(m[0].id);
        if (fromOmit === sgwFid && fp !== sgwFid) {
          return true;
        }
        if (fromOmit !== sgwFid) {
          return false;
        }
      }
    }
  }

  const t = Number(teamId);
  if (!Number.isFinite(t)) return false;
  const mine = fixturesForTeamInGw(gwFixtures || [], t);
  if (mine.length !== 1) return false;
  const onlyId = mine[0]?.id;
  if (onlyId == null) return false;
  return coverageSet.has(
    contributionCoverageKey(elementId, kind, Number(onlyId))
  );
}

/**
 * True if a feed row belongs to the selected gameweek. Rows from a previous GW can
 * remain in `displayed` for a few ticks after the user changes GW (before `hydrate` runs);
 * the feed should never show them.
 *
 * FPL `stableId` is `${gw}:…`; ESPN/FotMob rows must set `gameweek`.
 */
export function contributionEventMatchesGameweek(ev, gameweek) {
  const gwN = Number(gameweek);
  if (!Number.isFinite(gwN)) return true;
  const g = Number(ev?.gameweek);
  if (Number.isFinite(g)) return g === gwN;
  const sid = String(ev?.stableId || '');
  const m = sid.match(/^(\d+):/);
  if (m) return Number(m[1]) === gwN;
  if (sid.startsWith('espn:') || sid.startsWith('fotmob:')) return false;
  return true;
}

/**
 * Compare two live snapshots; emit positive deltas only. Goals, assists, DC fantasy points, and
 * save fantasy points require {@link hasMeaningfulMinutesOnPitch} on `nextRow` on every tick, so
 * 0-minute placeholder or inconsistent API state never creates rows. Yellow/red still require
 * `!bootstrap` to avoid double-counting with match-feed sources.
 *
 * @param {{
 *   prevLiveByElementId: Record<number, object> | null,
 *   nextLiveByElementId: Record<number, object> | null,
 *   elementById: Record<number, object>,
 *   trackedElementIds: Set<number>,
 *   gameweek: number,
 *   nowIso: string,
 *   gwFixtures?: object[],
 *   omitKinds?: Set<string> | null — skip these kinds from FPL diffs globally (e.g. FotMob owns all yellow/red ordering)
 *   omitByElementKind?: Set<string> | null — keys from {@link contributionCoverageKey}; ESPN covered this slot
 * }} p
 * @returns {object[]}
 */
export function diffContributionEvents({
  prevLiveByElementId,
  nextLiveByElementId,
  elementById,
  trackedElementIds,
  gameweek,
  nowIso,
  gwFixtures = [],
  omitKinds = null,
  omitByElementKind = null,
}) {
  const isOmitted = (elid, kind, fplFixtureId) => {
    if (omitKinds && omitKinds.has(kind)) return true;
    if (omitByElementKind && omitByElementKind.size > 0) {
      const el = elementById?.[elid];
      if (
        contributionCoveredByTimelineOmit(
          omitByElementKind,
          elid,
          kind,
          fplFixtureId,
          el?.team,
          gwFixtures
        )
      )
        return true;
    }
    return false;
  };
  /** @type {ReturnType<typeof diffContributionEvents> extends (infer U)[] ? U : never} */
  const out = [];
  if (!nextLiveByElementId || !trackedElementIds || trackedElementIds.size === 0) {
    return out;
  }

  const gw = Number(gameweek);
  if (!Number.isFinite(gw)) return out;

  const bootstrap = prevLiveByElementId == null;

  const ids = [...trackedElementIds].filter((n) => Number.isFinite(Number(n))).sort((a, b) => a - b);

  /** Disambiguate same-tick events (identical `recordedAt` and same-minute keys). Later index → newer in batch. */
  let emitSeq = 0;

  for (const elid of ids) {
    const prevRow = bootstrap ? null : prevLiveByElementId[elid];
    const nextRow = nextLiveByElementId[elid];
    if (!nextRow) continue;
    const el = elementById?.[elid];
    const et = el?.element_type;
    const fxRow = primaryFixtureForContribution(nextRow, el?.team, gwFixtures);
    const fplFixtureId = fxRow?.id != null ? Number(fxRow.id) : null;

    const ps = statsOf(prevRow);
    const ns = statsOf(nextRow);

    const g0 = Number(ps.goals_scored) || 0;
    const g1 = Number(ns.goals_scored) || 0;
    const canEmitGoalAssistDcSaves = hasMeaningfulMinutesOnPitch(nextRow);
    if (
      canEmitGoalAssistDcSaves &&
      !isOmitted(elid, 'goal', fplFixtureId) &&
      g1 > g0
    ) {
      const d = g1 - g0;
      out.push({
        stableId: `${gw}:${elid}:goal:tot${g1}`,
        kind: 'goal',
        elementId: elid,
        gameweek: gw,
        delta: d,
        recordedAt: nowIso,
        sortKey: contributionApproxTimelineSortKey(
          nextRow,
          el,
          'goal',
          gwFixtures,
          elid,
          emitSeq++
        ),
        source: 'fpl',
        fplFixtureId,
      });
    }

    const a0 = Number(ps.assists) || 0;
    const a1 = Number(ns.assists) || 0;
    if (
      canEmitGoalAssistDcSaves &&
      !isOmitted(elid, 'assist', fplFixtureId) &&
      a1 > a0
    ) {
      out.push({
        stableId: `${gw}:${elid}:assist:tot${a1}`,
        kind: 'assist',
        elementId: elid,
        gameweek: gw,
        delta: a1 - a0,
        recordedAt: nowIso,
        sortKey: contributionApproxTimelineSortKey(
          nextRow,
          el,
          'assist',
          gwFixtures,
          elid,
          emitSeq++
        ),
        source: 'fpl',
        fplFixtureId,
      });
    }

    const dc0 = defensiveContributionPointsFromLiveRow(prevRow);
    const dc1 = defensiveContributionPointsFromLiveRow(nextRow);
    if (canEmitGoalAssistDcSaves && dc1 > dc0) {
      out.push({
        stableId: `${gw}:${elid}:dc_points:tot${dc1}`,
        kind: 'dc_points',
        elementId: elid,
        gameweek: gw,
        delta: dc1 - dc0,
        recordedAt: nowIso,
        sortKey: contributionApproxTimelineSortKey(
          nextRow,
          el,
          'dc_points',
          gwFixtures,
          elid,
          emitSeq++
        ),
        source: 'fpl',
        fplFixtureId,
      });
    }

    const s0 = saveFantasyPointsFromSaves(ps.saves, et);
    const s1 = saveFantasyPointsFromSaves(ns.saves, et);
    if (canEmitGoalAssistDcSaves && s1 > s0) {
      out.push({
        stableId: `${gw}:${elid}:save_points:tot${s1}`,
        kind: 'save_points',
        elementId: elid,
        gameweek: gw,
        delta: s1 - s0,
        recordedAt: nowIso,
        sortKey: contributionApproxTimelineSortKey(
          nextRow,
          el,
          'save_points',
          gwFixtures,
          elid,
          emitSeq++
        ),
        source: 'fpl',
        fplFixtureId,
      });
    }

    const y0 = Number(ps.yellow_cards) || 0;
    const y1 = Number(ns.yellow_cards) || 0;
    if (!bootstrap && !isOmitted(elid, 'yellow_card', fplFixtureId) && y1 > y0) {
      out.push({
        stableId: `${gw}:${elid}:yellow_card:tot${y1}`,
        kind: 'yellow_card',
        elementId: elid,
        gameweek: gw,
        delta: y1 - y0,
        recordedAt: nowIso,
        sortKey: contributionApproxTimelineSortKey(
          nextRow,
          el,
          'yellow_card',
          gwFixtures,
          elid,
          emitSeq++
        ),
        source: 'fpl',
        fplFixtureId,
      });
    }

    const rc0 = Number(ps.red_cards) || 0;
    const rc1 = Number(ns.red_cards) || 0;
    if (!bootstrap && !isOmitted(elid, 'red_card', fplFixtureId) && rc1 > rc0) {
      out.push({
        stableId: `${gw}:${elid}:red_card:tot${rc1}`,
        kind: 'red_card',
        elementId: elid,
        gameweek: gw,
        delta: rc1 - rc0,
        recordedAt: nowIso,
        sortKey: contributionApproxTimelineSortKey(
          nextRow,
          el,
          'red_card',
          gwFixtures,
          elid,
          emitSeq++
        ),
        source: 'fpl',
        fplFixtureId,
      });
    }
  }

  return out;
}

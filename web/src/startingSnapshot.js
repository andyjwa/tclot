/**
 * Who's starting for the fantasy league, from sheets that are out.
 *
 * A club counts as announced when that side's sheet is confirmed with at least
 * one resolved player id. The Fixture menu picks a scope:
 *   - full game week (`gw`): every announced sheet this gameweek, including
 *     matches already kicked off or finished, so the totals are the week;
 *   - upcoming (`upcoming`): announced sheets whose match has not kicked off;
 *   - one fixture: that match only.
 * The legacy `open` scope (no fixture selected) is the old "all out" list:
 * not full time, and owned players on a scheduled club are "waiting" only when
 * some sheet is already out. A confirmed sheet whose player ids failed to
 * resolve is waiting, never "out".
 */

export const STARTING_SCOPE_GW = 'gw';
export const STARTING_SCOPE_UPCOMING = 'upcoming';

import { fplElementWebName } from './fplElementNames.js';

const POS_LABEL = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const POS_RANK = { GK: 0, DEF: 1, MID: 2, FWD: 3 };

function elementIdOf(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

function isFullTime(fx) {
  if (fx?.score?.finished) return true;
  const f = fx?.fplFixture;
  return Boolean(f?.finished || f?.finished_provisional);
}

function isLive(fx) {
  return Boolean(fx?.score?.started) && !isFullTime(fx);
}

/** Kickoff has happened: in play, full time, or the feed has marked it started. */
function hasKickedOff(fx) {
  if (isFullTime(fx) || isLive(fx)) return true;
  if (fx?.score?.started === true) return true;
  if (fx?.fplFixture?.started === true) return true;
  const minutes = Number(fx?.fplFixture?.minutes);
  return Number.isFinite(minutes) && minutes > 0;
}

/** Resolved ids on one side. `xi` is the starters; `bench` is everyone else named on the sheet. */
function sideIndex(side) {
  const xi = new Set();
  const bench = new Set();
  for (const player of side?.xi || []) {
    const id = elementIdOf(player?.elementId);
    if (id != null) xi.add(id);
  }
  for (const player of side?.bench || []) {
    const id = elementIdOf(player?.elementId);
    if (id != null && !xi.has(id)) bench.add(id);
  }
  return { xi, bench, usable: xi.size + bench.size > 0 };
}

/**
 * Sheet state for one club, whether or not the match is over.
 * @returns {'sheet'|'unresolved'|'scheduled'}
 */
function sheetKind(side) {
  if (side?.confirmed !== true) return 'scheduled';
  return sideIndex(side).usable ? 'sheet' : 'unresolved';
}

/**
 * @returns {'sheet'|'unresolved'|'scheduled'|null}
 * null means the match is full time and the club is out of the legacy snapshot.
 */
function clubSlotKind(fx, side) {
  if (isFullTime(fx)) return null;
  return sheetKind(side);
}

function clubMeta(teamById, id) {
  const team = teamById?.[id] ?? teamById?.[String(id)];
  const code = Number(team?.code);
  return {
    short: team?.short_name || team?.name || '—',
    name: team?.name || team?.short_name || '—',
    code: Number.isFinite(code) && code > 0 ? code : null,
  };
}

function fixtureIdOf(fx) {
  const id = Number(fx?.fplFixture?.id);
  return Number.isFinite(id) ? id : null;
}

function kickoffOf(fx) {
  return fx?.score?.kickoffIso || fx?.fplFixture?.kickoff_time || null;
}

/**
 * Every fixture in the gameweek, for the Fixture menu.
 * Announced means at least one side has a usable sheet, including after full time.
 */
export function listGameweekFixtures(fixtures, teamById) {
  const out = [];
  for (const fx of fixtures || []) {
    const id = fixtureIdOf(fx);
    if (id == null) continue;
    const homeKind = sheetKind(fx?.lineups?.home);
    const awayKind = sheetKind(fx?.lineups?.away);
    const home = clubMeta(teamById, fx?.fplFixture?.team_h);
    const away = clubMeta(teamById, fx?.fplFixture?.team_a);
    const minute = fx?.score?.liveMinute;
    out.push({
      id,
      homeShort: home.short,
      awayShort: away.short,
      homeName: home.name,
      awayName: away.name,
      homeCode: home.code,
      awayCode: away.code,
      live: isLive(fx),
      fullTime: isFullTime(fx),
      kickedOff: hasKickedOff(fx),
      announced: homeKind === 'sheet' || awayKind === 'sheet',
      minute: minute ? String(minute) : null,
      kickoffIso: kickoffOf(fx),
    });
  }
  out.sort(
    (a, b) => String(a.kickoffIso || '').localeCompare(String(b.kickoffIso || '')) || a.id - b.id,
  );
  return out;
}

/** Announced fixtures for the Fixture menu: a sheet is out and the match is still to play or live. */
export function listAnnouncedFixtures(fixtures, teamById) {
  const out = [];
  for (const fx of fixtures || []) {
    if (isFullTime(fx)) continue;
    const id = fixtureIdOf(fx);
    if (id == null) continue;
    const homeKind = clubSlotKind(fx, fx?.lineups?.home);
    const awayKind = clubSlotKind(fx, fx?.lineups?.away);
    if (homeKind !== 'sheet' && awayKind !== 'sheet') continue;
    const home = clubMeta(teamById, fx.fplFixture.team_h);
    const away = clubMeta(teamById, fx.fplFixture.team_a);
    const minute = fx?.score?.liveMinute;
    out.push({
      id,
      homeShort: home.short,
      awayShort: away.short,
      homeName: home.name,
      awayName: away.name,
      homeCode: home.code,
      awayCode: away.code,
      live: isLive(fx),
      minute: minute ? String(minute) : null,
      kickoffIso: kickoffOf(fx),
    });
  }
  out.sort(
    (a, b) => String(a.kickoffIso || '').localeCompare(String(b.kickoffIso || '')) || a.id - b.id,
  );
  return out;
}

function posOf(el) {
  return POS_LABEL[Number(el?.element_type)] || '';
}

function ownedElementIds(squad) {
  const ids = [];
  const seen = new Set();
  for (const row of [...(squad?.starters || []), ...(squad?.bench || [])]) {
    const id = elementIdOf(row?.element);
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/** Same rule as the Lineups chair: pick 1–11 is the fantasy XI. */
function fantasyBenchIds(squad) {
  const ids = new Map();
  const mark = (rows, fromBenchList) => {
    for (const row of rows || []) {
      const id = elementIdOf(row?.element);
      if (id == null) continue;
      const pickPos = Number(row?.pickPosition);
      const onBench =
        Number.isFinite(pickPos) && pickPos > 0 ? pickPos > 11 : fromBenchList === true;
      if (!ids.has(id) || !onBench) ids.set(id, onBench);
    }
  };
  mark(squad?.starters, false);
  mark(squad?.bench, true);
  return ids;
}

function comparePlayers(a, b) {
  return a.posRank - b.posRank || a.name.localeCompare(b.name) || a.fixtureId - b.fixtureId;
}

/**
 * @param {{
 *   fixtures: any[] | null | undefined,
 *   squads: any[] | null | undefined,
 *   elementById: Record<string, any> | null | undefined,
 *   teamById: Record<string, any> | null | undefined,
 *   teamId?: number | null,
 *   fixtureId?: number | null,
 *   scope?: 'open' | 'gw' | 'upcoming' | 'fixture',
 * }} args
 */
export function buildStartingSnapshot({
  fixtures,
  squads,
  elementById,
  teamById,
  teamId = null,
  fixtureId = null,
  scope = 'open',
}) {
  const rows = Array.isArray(fixtures) ? fixtures : [];
  const selectedFixture = fixtureId == null ? null : Number(fixtureId);
  const selectedTeam = teamId == null ? null : Number(teamId);
  const mode = selectedFixture != null ? 'fixture' : scope;
  const someSheet = rows.some((fx) => {
    if (isFullTime(fx)) return false;
    return (
      sheetKind(fx?.lineups?.home) === 'sheet' || sheetKind(fx?.lineups?.away) === 'sheet'
    );
  });

  /** @type {Map<number, object[]>} */
  const slotsByClub = new Map();
  let announcedCount = 0;

  for (const fx of rows) {
    const id = fixtureIdOf(fx);
    if (id == null) continue;
    if (selectedFixture != null && id !== selectedFixture) continue;
    if (mode === 'upcoming' && hasKickedOff(fx)) continue;
    if (mode === 'open' && isFullTime(fx)) continue;
    const homeId = Number(fx?.fplFixture?.team_h);
    const awayId = Number(fx?.fplFixture?.team_a);
    const sides = [
      { clubId: homeId, side: fx?.lineups?.home, oppId: awayId },
      { clubId: awayId, side: fx?.lineups?.away, oppId: homeId },
    ];
    for (const { clubId, side, oppId } of sides) {
      if (!Number.isFinite(clubId)) continue;
      const kind = mode === 'open' ? clubSlotKind(fx, side) : sheetKind(side);
      if (!kind) continue;
      if (mode !== 'open' && kind !== 'sheet') continue;
      if (kind === 'sheet') announcedCount += 1;
      const indexed = sideIndex(side);
      const club = clubMeta(teamById, clubId);
      const opp = clubMeta(teamById, oppId);
      const list = slotsByClub.get(clubId) || [];
      list.push({
        fixtureId: id,
        kind,
        xi: indexed.xi,
        bench: indexed.bench,
        clubShort: club.short,
        clubCode: club.code,
        oppShort: opp.short,
        live: isLive(fx),
        fullTime: isFullTime(fx),
        minute: fx?.score?.liveMinute ? String(fx.score.liveMinute) : null,
        kickoffIso: kickoffOf(fx),
      });
      slotsByClub.set(clubId, list);
    }
  }

  const groups = [];
  let starting = 0;
  let notStarting = 0;
  let waiting = 0;

  for (const squad of squads || []) {
    if (!squad || squad.error) continue;
    const leagueEntryId = Number(squad.leagueEntryId);
    if (selectedTeam != null && leagueEntryId !== selectedTeam) continue;

    const bucket = { starting: [], notStarting: [], waiting: [] };
    const onBench = fantasyBenchIds(squad);
    for (const elementId of ownedElementIds(squad)) {
      const el = elementById?.[elementId] ?? elementById?.[String(elementId)];
      const clubId = Number(el?.team);
      if (!el || !Number.isFinite(clubId)) continue;
      for (const slot of slotsByClub.get(clubId) || []) {
        const showWaiting =
          mode === 'open' &&
          (slot.kind === 'unresolved' ||
            (slot.kind === 'scheduled' && someSheet && selectedFixture == null));
        if (slot.kind !== 'sheet' && !showWaiting) continue;
        const pos = posOf(el);
        const player = {
          elementId,
          name: fplElementWebName(el, elementId),
          pos,
          posRank: POS_RANK[pos] ?? 9,
          clubShort: slot.clubShort,
          clubCode: slot.clubCode,
          oppShort: slot.oppShort,
          live: slot.live,
          fullTime: slot.fullTime === true,
          minute: slot.minute,
          kickoffIso: slot.kickoffIso,
          fixtureId: slot.fixtureId,
          role: 'wait',
          onFantasyBench: onBench.get(elementId) === true,
        };
        if (slot.kind === 'sheet' && slot.xi.has(elementId)) {
          player.role = 'xi';
          bucket.starting.push(player);
        } else if (slot.kind === 'sheet') {
          player.role = slot.bench.has(elementId) ? 'bench' : 'nis';
          bucket.notStarting.push(player);
        } else {
          bucket.waiting.push(player);
        }
      }
    }

    if (!bucket.starting.length && !bucket.notStarting.length && !bucket.waiting.length) continue;
    bucket.starting.sort(comparePlayers);
    bucket.notStarting.sort(comparePlayers);
    bucket.waiting.sort(comparePlayers);
    starting += bucket.starting.length;
    notStarting += bucket.notStarting.length;
    waiting += bucket.waiting.length;
    groups.push({
      leagueEntryId,
      teamName: squad.teamName || 'Team',
      fplEntryId: squad.fplEntryId ?? null,
      ...bucket,
    });
  }

  return {
    groups,
    announcedCount,
    totals: { starting, notStarting, waiting },
  };
}

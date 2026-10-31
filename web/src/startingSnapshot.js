/**
 * Who's starting for the fantasy league, from sheets that are out.
 *
 * A club counts as announced when that side's sheet has at least one resolved
 * player id. Played matches stay in the snapshot, so a finished gameweek still
 * shows who started. A match that is still to come counts only once the sheet
 * is confirmed. Owned players on a scheduled club are "waiting" only when some
 * still-to-play sheet is already out and no fixture is selected — otherwise the
 * page would list the whole league before any team news. A confirmed sheet
 * whose player ids failed to resolve is waiting, never "out".
 */

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
 * @returns {'sheet'|'unresolved'|'scheduled'|null}
 * null means this side has no lineup we can trust. A finished match with a
 * resolved XI is a sheet, so past gameweeks stay visible.
 */
function clubSlotKind(fx, side) {
  const usable = sideIndex(side).usable;
  if (isFullTime(fx)) return usable ? 'sheet' : null;
  if (side?.confirmed !== true) return 'scheduled';
  return usable ? 'sheet' : 'unresolved';
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

/** Fixtures for the Fixture menu: a sheet is out, including matches that have already been played. */
export function listAnnouncedFixtures(fixtures, teamById) {
  const out = [];
  for (const fx of fixtures || []) {
    const id = fixtureIdOf(fx);
    if (id == null) continue;
    const homeKind = clubSlotKind(fx, fx?.lineups?.home);
    const awayKind = clubSlotKind(fx, fx?.lineups?.away);
    if (homeKind !== 'sheet' && awayKind !== 'sheet') continue;
    const home = clubMeta(teamById, fx.fplFixture.team_h);
    const away = clubMeta(teamById, fx.fplFixture.team_a);
    const minute = fx?.score?.liveMinute;
    const finished = isFullTime(fx);
    out.push({
      id,
      homeShort: home.short,
      awayShort: away.short,
      homeName: home.name,
      awayName: away.name,
      homeCode: home.code,
      awayCode: away.code,
      live: isLive(fx),
      finished,
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
 * }} args
 */
export function buildStartingSnapshot({
  fixtures,
  squads,
  elementById,
  teamById,
  teamId = null,
  fixtureId = null,
}) {
  const rows = Array.isArray(fixtures) ? fixtures : [];
  const selectedFixture = fixtureId == null ? null : Number(fixtureId);
  const selectedTeam = teamId == null ? null : Number(teamId);
  const someSheet = rows.some((fx) => {
    if (isFullTime(fx)) return false;
    return (
      clubSlotKind(fx, fx?.lineups?.home) === 'sheet' ||
      clubSlotKind(fx, fx?.lineups?.away) === 'sheet'
    );
  });

  /** @type {Map<number, object[]>} */
  const slotsByClub = new Map();
  let announcedCount = 0;

  for (const fx of rows) {
    const id = fixtureIdOf(fx);
    if (id == null) continue;
    if (selectedFixture != null && id !== selectedFixture) continue;
    const homeId = Number(fx?.fplFixture?.team_h);
    const awayId = Number(fx?.fplFixture?.team_a);
    const sides = [
      { clubId: homeId, side: fx?.lineups?.home, oppId: awayId },
      { clubId: awayId, side: fx?.lineups?.away, oppId: homeId },
    ];
    for (const { clubId, side, oppId } of sides) {
      if (!Number.isFinite(clubId)) continue;
      const kind = clubSlotKind(fx, side);
      if (!kind) continue;
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
        finished: isFullTime(fx),
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
    for (const elementId of ownedElementIds(squad)) {
      const el = elementById?.[elementId] ?? elementById?.[String(elementId)];
      const clubId = Number(el?.team);
      if (!el || !Number.isFinite(clubId)) continue;
      for (const slot of slotsByClub.get(clubId) || []) {
        const showWaiting =
          slot.kind === 'unresolved' ||
          (slot.kind === 'scheduled' && someSheet && selectedFixture == null);
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
          finished: slot.finished,
          minute: slot.minute,
          kickoffIso: slot.kickoffIso,
          fixtureId: slot.fixtureId,
          role: 'wait',
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

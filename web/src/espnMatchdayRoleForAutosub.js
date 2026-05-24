import { fixturesForTeamInGw } from './fplBonusFromBps.js';

/**
 * Threshold for strong lineup coverage (@see MIN_RESOLVED_IDS_FOR_ABSENT) alongside **every**
 * Published XI+bench row resolving to an FPL `elementId` before we infer **absent**; otherwise
 * unknown (`null`) so ESPN→FPL name gaps never mark a listed player absent.
 */
const MIN_RESOLVED_IDS_FOR_ABSENT = 16;

/**
 * ESPN Prem lineups (enriched with `elementId`) classify FPL draft picks for live **projected**
 * autosub: `xi` / `bench` / `absent` / `null` (unknown or DGW / no data).
 *
 * Only used when the club has **exactly one** PL fixture this GW (single-gameweek); for doubles
 * we return `null` so we do not guess across two matchday squads.
 *
 * @param {Array<{ fplFixture: object, lineups: { home: object, away: object } | null }>} espnPremRows
 * @param {object[]} gwFixtures — classic GW fixtures for this event
 * @param {number} elementId — FPL element id
 * @param {number | null} teamId — FPL team id from bootstrap
 * @returns {'xi' | 'bench' | 'absent' | null}
 */
function lineupSlotHasFplId(p) {
  const raw = p?.elementId;
  /** `Number(null) === 0` — exclude nullish so unresolved rows aren't treated as element 0. */
  if (raw == null || raw === '') return false;
  return Number.isFinite(Number(raw));
}

export function computeEspnMatchdayRole(espnPremRows, gwFixtures, elementId, teamId) {
  const eid = Number(elementId);
  const tid = Number(teamId);
  if (!Number.isFinite(eid) || !Number.isFinite(tid)) return null;
  const mine = fixturesForTeamInGw(gwFixtures || [], tid);
  if (mine.length !== 1) return null;
  const fplFxId = Number(mine[0].id);
  if (!Number.isFinite(fplFxId)) return null;
  const row = (espnPremRows || []).find((r) => Number(r?.fplFixture?.id) === fplFxId);
  const lu = row?.lineups;
  if (!lu?.home || !lu?.away) return null;
  if (!lu.home.confirmed || !lu.away.confirmed) return null;

  const th = Number(row.fplFixture?.team_h);
  const ta = Number(row.fplFixture?.team_a);
  const side = tid === th ? lu.home : tid === ta ? lu.away : null;
  if (!side) return null;

  const xi = Array.isArray(side.xi) ? side.xi : [];
  const bench = Array.isArray(side.bench) ? side.bench : [];
  /** Every published squad slot — used to detect unresolved ESPN→FPL name rows. */
  const squad = [...xi, ...bench];

  if (
    xi.some((p) => lineupSlotHasFplId(p) && Number(p.elementId) === eid)
  )
    return 'xi';
  if (
    bench.some((p) => lineupSlotHasFplId(p) && Number(p.elementId) === eid)
  )
    return 'bench';

  const resolved = squad.filter((p) => lineupSlotHasFplId(p)).length;
  /** If any roster row lacks an element id, players not matched by id might still sit in those rows. */
  const unresolvedSlots = squad.length - resolved;

  if (
    resolved >= MIN_RESOLVED_IDS_FOR_ABSENT &&
    unresolvedSlots === 0
  )
    return 'absent';

  return null;
}

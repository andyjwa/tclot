/**
 * PremWindow: score, match events, and lineups from ESPN eng.1 (scoreboard + summary).
 * Replaces the FotMob path (Turnstile-gated match details).
 */

import { espnResourceUrl } from './espnUrl.js';
import { fetchProxyJson } from './proxyJsonFetch.js';
import { enrichWithFplElements } from './fotmobPremWindow.js';
import {
  classifyEspnEvent,
  collectDayMatches,
  findEspnMatchForFixture,
  harvestTeams,
  isEspnOwnGoalEvent,
  mapEspnTeamsToFpl,
  yyyymmddUtc,
} from './espnPremTimeline.js';

function coerceInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function fetchEspnJson(pathAndQuery) {
  const url = espnResourceUrl(pathAndQuery);
  return fetchProxyJson(url, `ESPN ${pathAndQuery}`);
}

/**
 * Map ESPN competition header to the same `parseScore` shape the Prem UI expects (FPL home/away).
 * @param {object} summary — `summary?event=…` JSON
 * @param {object} fplFixture — FPL `fixtures` row
 * @param {Map<number, number>} espnToFpl — ESPN team id → FPL team id
 * @returns {ReturnType<import('./fotmobPremWindow.js').parseScore> | null}
 */
export function parseEspnScoreForFplFixture(summary, fplFixture, espnToFpl) {
  const comp = summary?.header?.competitions?.[0];
  if (!comp) return null;
  const th = Number(fplFixture?.team_h);
  const ta = Number(fplFixture?.team_a);
  if (!Number.isFinite(th) || !Number.isFinite(ta)) return null;

  let homeScore = null;
  let awayScore = null;
  for (const c of comp.competitors || []) {
    const eid = Number(c?.team?.id);
    if (!Number.isFinite(eid)) continue;
    const fplT = espnToFpl.get(eid);
    const raw = c?.score;
    const s =
      raw != null && raw !== '' ? parseInt(String(raw), 10) : NaN;
    const n = Number.isFinite(s) ? s : null;
    if (fplT === th) homeScore = n;
    if (fplT === ta) awayScore = n;
  }

  const st = comp.status;
  const type = st?.type;
  const state = type?.state;
  const name = type?.name != null ? String(type.name) : '';
  const started = state === 'in' || state === 'post';
  const finished = type?.completed === true || name === 'STATUS_FULL_TIME';
  const statusText =
    (typeof type?.shortDetail === 'string' && type.shortDetail) ||
    (typeof type?.description === 'string' && type.description) ||
    null;
  const liveMinute = state === 'in' ? statusText : null;
  const kickoffIso = typeof comp.date === 'string' ? comp.date : null;

  return {
    started,
    finished,
    statusText,
    liveMinute,
    homeScore,
    awayScore,
    kickoffIso,
  };
}

/**
 * ESPN `clock.value` is seconds in match; we use it for sort order. Display uses `displayValue` when set.
 * @param {object} ev — keyEvent row
 * @returns {{ minute: number | null, stoppage: number, label: string }}
 */
function espnClockToMinute(ev) {
  const c = ev?.clock;
  const display =
    (typeof c?.displayValue === 'string' && c.displayValue.trim()
      ? c.displayValue
      : null) || '—';
  if (c && Number.isFinite(Number(c.value)) && Number(c.value) > 0) {
    const total = Number(c.value);
    const baseMin = Math.floor(total / 60);
    const sec = total % 60;
    if (sec === 0) {
      return { minute: baseMin, stoppage: 0, label: display };
    }
  }
  return { minute: null, stoppage: 0, label: display };
}

/**
 * Build PremWindow-shaped events (same as `fotmobPremWindow` `parseEvents` output) from `keyEvents`.
 * @param {object} summary
 * @param {object} fplFixture
 * @param {Map<number, number>} espnToFpl
 */
export function parseEspnKeyEventsForPrem(
  summary,
  fplFixture,
  espnToFpl
) {
  const keyEvents = Array.isArray(summary?.keyEvents) ? summary.keyEvents : [];
  const th = Number(fplFixture?.team_h);
  const ta = Number(fplFixture?.team_a);
  if (!Number.isFinite(th) || !Number.isFinite(ta)) return [];

  /** @type {Array<{ kind: string, teamSide: 'home' | 'away' | null, minuteLabel: string, minute: number | null, stoppage: number, playerName: string | null, isOwnGoal: boolean, isPenalty: boolean, eventId: number | null, wallclock: number }>} */
  const work = [];
  for (const ev of keyEvents) {
    const kind = classifyEspnEvent(ev);
    if (!kind) continue;
    const ttype = String(ev?.type?.type || '').toLowerCase();
    if (ttype === 'kickoff' || ttype === 'substitution' || ttype === 'end') continue;

    const teamEspn = Number(ev?.team?.id);
    if (!Number.isFinite(teamEspn)) continue;
    const fplT = espnToFpl.get(teamEspn);
    if (fplT == null) continue;
    let teamSide = null;
    if (fplT === th) teamSide = 'home';
    else if (fplT === ta) teamSide = 'away';

    const p0 = ev?.participants?.[0]?.athlete;
    const p1 = ev?.participants?.[1]?.athlete;
    const name0 =
      p0 && typeof p0.displayName === 'string' ? p0.displayName.trim() : null;
    const textBlob = `${ev?.text || ''} ${ev?.shortText || ''}`;
    const isOwnGoal = kind === 'goal' && isEspnOwnGoalEvent(ev);
    const isPenalty = kind === 'goal' && /\bpenalt/i.test(textBlob);
    const mm = espnClockToMinute(ev);
    const w = Date.parse(String(ev?.wallclock || ''));
    const eventId = coerceInt(ev?.id);
    if (name0) {
      work.push({
        kind,
        teamSide,
        minuteLabel: mm.label,
        minute: mm.minute,
        stoppage: mm.stoppage,
        playerName: name0,
        isOwnGoal,
        isPenalty,
        eventId,
        wallclock: Number.isFinite(w) ? w : 0,
      });
    }
    if (
      kind === 'goal' &&
      !isOwnGoal &&
      p1 &&
      typeof p1.displayName === 'string' &&
      p1.displayName.trim()
    ) {
      work.push({
        kind: 'assist',
        teamSide,
        minuteLabel: mm.label,
        minute: mm.minute,
        stoppage: mm.stoppage,
        playerName: p1.displayName.trim(),
        isOwnGoal: false,
        isPenalty: false,
        eventId,
        wallclock: Number.isFinite(w) ? w : 0,
      });
    }
  }

  work.sort((a, b) => {
    if (a.wallclock !== b.wallclock) return a.wallclock - b.wallclock;
    const am = Number.isFinite(a.minute) ? a.minute : 9999;
    const bm = Number.isFinite(b.minute) ? b.minute : 9999;
    if (am !== bm) return am - bm;
    const aid = a.eventId ?? 0;
    const bid = b.eventId ?? 0;
    return aid - bid;
  });

  return work.map((x) => ({
    kind: x.kind,
    teamSide: x.teamSide,
    minuteLabel: x.minuteLabel,
    minute: x.minute,
    stoppage: x.stoppage,
    playerName: x.playerName,
    isOwnGoal: x.isOwnGoal,
    isPenalty: x.isPenalty,
    eventId: x.eventId,
  }));
}

function rosterRowToPlayer(r) {
  const ath = r?.athlete;
  if (!ath) return null;
  const id = coerceInt(ath.id);
  const name =
    typeof ath.displayName === 'string' && ath.displayName.trim()
      ? ath.displayName.trim()
      : null;
  const shirt = coerceInt(r.jersey) ?? null;
  const pos =
    (typeof r.position?.abbreviation === 'string' && r.position.abbreviation) ||
    (typeof r.position?.name === 'string' && r.position.name) ||
    null;
  return {
    fotmobPlayerId: id,
    name,
    shirt,
    usualPosition: pos,
  };
}

/**
 * @returns {import('./fotmobPremWindow.js').parseLineups extends Function ? Awaited<ReturnType<...>> : never}
 */
function mapEspnRosterToSide(sideBlock) {
  if (!sideBlock?.roster || !Array.isArray(sideBlock.roster)) return null;
  const formation =
    (typeof sideBlock.formation === 'string' && sideBlock.formation) || null;
  const xi = sideBlock.roster
    .filter((r) => r.starter)
    .map(rosterRowToPlayer)
    .filter(Boolean);
  const bench = sideBlock.roster
    .filter((r) => r && !r.starter)
    .map(rosterRowToPlayer)
    .filter(Boolean);
  const confirmed = xi.length === 11;
  return { formation, confirmed, xi, bench, coach: null, teamId: Number(sideBlock.team?.id) };
}

/**
 * @returns {ReturnType<import('./fotmobPremWindow.js').parseLineups> | null}
 */
export function parseEspnLineups(summary, fplFixture, espnToFpl) {
  const rlist = summary?.rosters;
  if (!Array.isArray(rlist) || rlist.length < 2) return null;
  const th = Number(fplFixture?.team_h);
  const ta = Number(fplFixture?.team_a);
  let homeB = null;
  let awayB = null;
  for (const rb of rlist) {
    const eid = Number(rb?.team?.id);
    if (!Number.isFinite(eid)) continue;
    const fplT = espnToFpl.get(eid);
    if (fplT === th) homeB = rb;
    else if (fplT === ta) awayB = rb;
  }
  const home = homeB ? mapEspnRosterToSide(homeB) : null;
  const away = awayB ? mapEspnRosterToSide(awayB) : null;
  if (!home || !away) return null;
  return { home, away };
}

/**
 * One row per FPL fixture: ESPN event id, score, match events, lineups (when API lists starters).
 * @param {{ gwFixtures: object[], teamById: Record<number, object>, elementById: Record<number, object>, signal?: AbortSignal }} args
 */
export async function fetchEspnPremWindow({
  gwFixtures,
  teamById,
  elementById,
  signal,
}) {
  const fxList = Array.isArray(gwFixtures) ? gwFixtures : [];
  if (!fxList.length) return [];

  const dates = new Set();
  for (const fx of fxList) {
    const d = yyyymmddUtc(fx.kickoff_time);
    if (d) dates.add(d);
  }
  if (!dates.size) return [];

  /** @type {Map<string, ReturnType<typeof collectDayMatches>>} */
  const byDate = new Map();
  /** @type {Array<{ id: number, abbreviation: string, displayName: string }>} */
  const espnTeamRoster = [];
  const seenTeam = new Set();
  for (const d of dates) {
    if (signal?.aborted) break;
    try {
      const sb = await fetchEspnJson(`scoreboard?dates=${d}`);
      byDate.set(d, collectDayMatches(sb));
      harvestTeams(sb, espnTeamRoster, seenTeam);
    } catch {
      byDate.set(d, []);
    }
  }

  const espnToFpl = mapEspnTeamsToFpl(teamById, espnTeamRoster);
  if (!espnToFpl.size) {
    return fxList.map((fx) => ({
      fplFixture: fx,
      matchId: null,
      homeEspnTeamId: null,
      awayEspnTeamId: null,
      score: null,
      events: [],
      lineups: null,
      fetchError: null,
      detailsBlockedReason: null,
    }));
  }

  const out = [];
  for (const fx of fxList) {
    if (signal?.aborted) break;
    const d = yyyymmddUtc(fx.kickoff_time);
    const dayRows = d ? (byDate.get(d) || []) : [];
    const match = d ? findEspnMatchForFixture(fx, espnToFpl, dayRows) : null;
    if (!match) {
      out.push({
        fplFixture: fx,
        matchId: null,
        homeEspnTeamId: null,
        awayEspnTeamId: null,
        score: null,
        events: [],
        lineups: null,
        fetchError: null,
        detailsBlockedReason: null,
      });
      continue;
    }

    const eventId = match.eventId;
    let score = null;
    let events = [];
    let lineups = null;
    let fetchError = null;
    let summary;
    try {
      summary = await fetchEspnJson(`summary?event=${eventId}`);
    } catch (e) {
      fetchError = e?.message || String(e);
    }
    if (summary) {
      score = parseEspnScoreForFplFixture(summary, fx, espnToFpl);
      events = parseEspnKeyEventsForPrem(summary, fx, espnToFpl);
      lineups = parseEspnLineups(summary, fx, espnToFpl);
    }

    const enriched = enrichWithFplElements({
      fplFixture: fx,
      events,
      lineups,
      elementById,
    });
    out.push({
      fplFixture: fx,
      matchId: eventId,
      homeEspnTeamId: match.homeId,
      awayEspnTeamId: match.awayId,
      score: score || null,
      events: enriched.events,
      lineups: enriched.lineups,
      fetchError,
      detailsBlockedReason: null,
    });
  }
  return out;
}

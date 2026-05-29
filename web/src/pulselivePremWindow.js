/**
 * Pulselive (PL official) `fixtures/{id}` → full PremWindow row, mirroring the shape that
 * `fetchEspnPremWindow` produces so consumers can treat them interchangeably.
 *
 * Pulselive's single-fixture payload bundles **everything** we need:
 *   - `teamLists[]` — formation + `lineup` (XI) + `substitutes`; no explicit `confirmed`
 *     flag, so we derive one (both XIs == 11 starters → confirmed)
 *   - `events[]` — `G` goals (with `assistId`), `B:Y` yellows, `B:YR` second-yellow reds,
 *     `O` own goals, `P` penalties (annotation; the goal itself comes from a `G` event),
 *     `S:ON`/`S:OFF` substitution pairs (we skip subs from the project event-list since
 *     downstream consumers track them via lineups). Each event has true wallclock UTC
 *     `time.millis`, so chronological sort matches ESPN's wallclock ordering.
 *   - `teams[].score` + `status` — the canonical PL scoreline + match state.
 *
 * Players are referenced in `events[]` by Pulselive `personId` (Opta), which is **not** the
 * same id space as FPL `element.code`. We build a `personId → playerName` map from the
 * fixture's own `teamLists[]` and then let the standard `matchFplElementId` name-matcher
 * (used by ESPN today) attach `elementId` via `enrichWithFplElements`.
 */

import { enrichWithFplElements } from './fotmobPremWindow.js';
import {
  collectPulseliveFixtures,
  fetchPulseliveJson,
  findPulseliveMatchForFixture,
  harvestTeams,
  mapPulseliveTeamsToFpl,
  pickCurrentCompSeasonId,
  PL_COMP_ID,
} from './pulselivePremTimeline.js';

function coerceInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickPlayerName(playerNode) {
  if (!playerNode || typeof playerNode !== 'object') return null;
  const name = playerNode.name;
  if (name && typeof name === 'object') {
    if (typeof name.display === 'string' && name.display.trim()) {
      return name.display.trim();
    }
    const parts = [name.first, name.last].filter(
      (s) => typeof s === 'string' && s.trim(),
    );
    if (parts.length) return parts.join(' ').trim();
  }
  if (typeof playerNode.displayName === 'string' && playerNode.displayName.trim()) {
    return playerNode.displayName.trim();
  }
  return null;
}

function normalizeLineupRow(row) {
  if (!row || typeof row !== 'object') return null;
  const name = pickPlayerName(row);
  if (!name) return null;
  return {
    name,
    shirt: coerceInt(row.matchShirtNumber) ?? coerceInt(row.shirtNumber),
    usualPosition:
      (typeof row.matchPosition === 'string' && row.matchPosition) ||
      (typeof row.info?.position === 'string' && row.info.position) ||
      null,
    pulselivePlayerId: coerceInt(row.id) ?? coerceInt(row.playerId),
    captain: row.captain === true,
  };
}

function formationLabel(formationNode) {
  if (!formationNode || typeof formationNode !== 'object') return null;
  if (typeof formationNode.label === 'string' && formationNode.label.trim()) {
    return formationNode.label.trim();
  }
  if (typeof formationNode.name === 'string' && formationNode.name.trim()) {
    return formationNode.name.trim();
  }
  return null;
}

/**
 * One side of a Pulselive `teamLists[]` block → standard side shape. `confirmed` is set by
 * the caller (`parsePulseliveLineups`) once it knows both sides have full XIs.
 */
function parseTeamListNode(node) {
  if (!node || typeof node !== 'object') return null;
  const teamId = coerceInt(node.teamId);
  const lineupField = Array.isArray(node.lineup) ? node.lineup : [];
  const benchField = Array.isArray(node.substitutes) ? node.substitutes : [];
  const xi = lineupField.map(normalizeLineupRow).filter(Boolean);
  const bench = benchField.map(normalizeLineupRow).filter(Boolean);
  return {
    teamId,
    formation: formationLabel(node.formation),
    /** Provisional; finalised in `parsePulseliveLineups` once both sides known. */
    confirmed: false,
    coach: null,
    xi,
    bench,
  };
}

/**
 * Convert a Pulselive single-fixture payload into the project-standard `{ home, away }`
 * shape. Pulselive emits team lists *as soon as a team submits* — the home team can be
 * out before the away team — so we only set `confirmed: true` when both lists have
 * exactly 11 starters.
 *
 * @param {object} fixtureJson — raw `/fixtures/{id}` body
 * @param {object} fplFixture — used to pick which Pulselive teamList is home/away via team id
 * @param {Map<number, number>} pulseToFpl — pulselive team id → FPL team id
 * @returns {{ home: object, away: object } | null}
 */
export function parsePulseliveLineups(fixtureJson, fplFixture, pulseToFpl) {
  if (!fixtureJson || typeof fixtureJson !== 'object') return null;
  const teamLists = Array.isArray(fixtureJson.teamLists)
    ? fixtureJson.teamLists
    : [];
  if (teamLists.length < 2) return null;

  const fplHome = Number(fplFixture?.team_h);
  const fplAway = Number(fplFixture?.team_a);
  if (!Number.isFinite(fplHome) || !Number.isFinite(fplAway)) return null;

  const parsed = teamLists.slice(0, 2).map(parseTeamListNode).filter(Boolean);
  if (parsed.length < 2) return null;

  let homeSide = null;
  let awaySide = null;
  for (const side of parsed) {
    const fplTeam = pulseToFpl?.get?.(Number(side.teamId));
    if (fplTeam === fplHome) homeSide = side;
    else if (fplTeam === fplAway) awaySide = side;
  }
  /** Fall back to source order if the map didn't resolve — best-effort. */
  if (!homeSide || !awaySide) {
    homeSide = homeSide || parsed[0];
    awaySide = awaySide || parsed[1];
    if (homeSide === awaySide) return null;
  }

  const bothFullXi =
    Array.isArray(homeSide.xi) &&
    homeSide.xi.length === 11 &&
    Array.isArray(awaySide.xi) &&
    awaySide.xi.length === 11;

  /**
   * Pulselive doesn't expose a `confirmed` flag, so a full XI on **both** sides is our
   * stand-in. Bench-only or single-side rosters publish a few minutes before kickoff but
   * we don't want them lighting up the "Confirmed" badge prematurely.
   */
  const confirmed = bothFullXi;
  homeSide.confirmed = confirmed;
  awaySide.confirmed = confirmed;

  /** Empty payloads should be treated as no data, not a confirmed empty XI. */
  if (
    homeSide.xi.length + homeSide.bench.length === 0 &&
    awaySide.xi.length + awaySide.bench.length === 0
  ) {
    return null;
  }

  return { home: homeSide, away: awaySide };
}

/**
 * Pulselive `event.clock.label` is `"MM'SS"` (`23'00`) or stoppage-time `"45+4'00"`. Map
 * to the `{ minute, stoppage, label }` shape ESPN events use so the downstream sort key
 * matches what `parseEspnKeyEventsForPrem` produces.
 */
function parsePulseliveClock(clockNode) {
  const label =
    (typeof clockNode?.label === 'string' && clockNode.label.trim()) || '—';
  const m = /^(\d+)(?:\+(\d+))?'(\d{2})$/.exec(label);
  if (!m) {
    /** Fallback to `.secs` if the label doesn't fit (e.g. period-start markers). */
    const secs = Number(clockNode?.secs);
    if (Number.isFinite(secs) && secs > 0) {
      const baseMin = Math.floor(secs / 60);
      return { minute: baseMin, stoppage: 0, label };
    }
    return { minute: null, stoppage: 0, label };
  }
  return {
    minute: Number(m[1]),
    stoppage: Number(m[2] || 0),
    label,
  };
}

/**
 * Build `personId → displayName` from a fixture's own `teamLists`. Used to resolve event
 * payloads (which carry `personId` only) to the names the existing `matchFplElementId`
 * helper expects.
 */
function buildPersonIdNameMap(fixtureJson) {
  const out = new Map();
  const teamLists = Array.isArray(fixtureJson?.teamLists)
    ? fixtureJson.teamLists
    : [];
  for (const tl of teamLists) {
    for (const list of [tl?.lineup, tl?.substitutes, tl?.unavailable]) {
      if (!Array.isArray(list)) continue;
      for (const row of list) {
        const pid = coerceInt(row?.id) ?? coerceInt(row?.playerId);
        const name = pickPlayerName(row);
        if (pid != null && name) out.set(pid, name);
      }
    }
  }
  return out;
}

/** Classify a Pulselive event into our project kind, or `null` to drop it. */
function classifyPulseliveEvent(ev) {
  const type = String(ev?.type || '').toUpperCase();
  const desc = String(ev?.description || '').toUpperCase();
  /** Substitutions, period markers, VAR etc. are dropped from the player-events list. */
  if (type === 'G') return 'goal';
  if (type === 'O') return 'goal'; // own-goal — `isOwnGoal` flag set by caller
  if (type === 'P') return null; // penalty marker — the actual goal arrives as a paired `G` event
  if (type === 'B' && desc === 'Y') return 'yellow';
  if (type === 'B' && (desc === 'YR' || desc === 'R')) return 'red';
  if (type === 'B' && desc === '') return null;
  return null;
}

/**
 * Convert a Pulselive single-fixture payload into the same event-array shape as
 * `parseEspnKeyEventsForPrem`. Wallclock (`time.millis`) drives chronological sort but
 * is stripped from the returned objects so downstream consumers see the same fields
 * regardless of source.
 *
 * @param {object} fixtureJson — raw `/fixtures/{id}` body
 * @param {object} fplFixture — for home/away team-id binding
 * @param {Map<number, number>} pulseToFpl — pulselive team id → FPL team id
 * @returns {Array<{
 *   kind: 'goal' | 'assist' | 'yellow' | 'red',
 *   teamSide: 'home' | 'away' | null,
 *   minuteLabel: string,
 *   minute: number | null,
 *   stoppage: number,
 *   playerName: string | null,
 *   isOwnGoal: boolean,
 *   isPenalty: boolean,
 *   eventId: number | null,
 * }>}
 */
export function parsePulseliveEvents(fixtureJson, fplFixture, pulseToFpl) {
  if (!fixtureJson || typeof fixtureJson !== 'object') return [];
  const events = Array.isArray(fixtureJson.events) ? fixtureJson.events : [];
  if (!events.length) return [];

  const th = Number(fplFixture?.team_h);
  const ta = Number(fplFixture?.team_a);
  if (!Number.isFinite(th) || !Number.isFinite(ta)) return [];

  const personIdToName = buildPersonIdNameMap(fixtureJson);

  /**
   * `parsePulseliveClock` returns 1-based minutes; ESPN reports the equivalent shape so
   * the downstream sort uses identical fields when sources are interleaved.
   */
  const work = [];
  for (const ev of events) {
    const kind = classifyPulseliveEvent(ev);
    if (!kind) continue;

    const teamPulse = Number(ev?.teamId);
    if (!Number.isFinite(teamPulse)) continue;
    const fplT = pulseToFpl?.get?.(teamPulse);
    let teamSide = null;
    if (fplT === th) teamSide = 'home';
    else if (fplT === ta) teamSide = 'away';

    const isOwnGoal = String(ev?.type || '').toUpperCase() === 'O';
    const isPenalty =
      kind === 'goal' &&
      !isOwnGoal &&
      /^P/i.test(String(ev?.description || ''));

    const personId = coerceInt(ev?.personId);
    const playerName = personId != null ? personIdToName.get(personId) || null : null;
    if (!playerName) continue;

    const clock = parsePulseliveClock(ev?.clock);
    const wallclock = coerceInt(ev?.time?.millis) ?? 0;
    const eventId = coerceInt(ev?.id);

    work.push({
      kind,
      teamSide,
      minuteLabel: clock.label,
      minute: clock.minute,
      stoppage: clock.stoppage,
      playerName,
      isOwnGoal,
      isPenalty,
      eventId,
      wallclock,
    });

    /**
     * Pulselive bundles assist credit onto the goal event (`assistId`). Mirror ESPN's
     * behaviour of emitting a separate `assist` event for non-OG goals only.
     */
    if (kind === 'goal' && !isOwnGoal) {
      const assistPid = coerceInt(ev?.assistId);
      if (assistPid != null) {
        const assistName = personIdToName.get(assistPid) || null;
        if (assistName) {
          work.push({
            kind: 'assist',
            teamSide,
            minuteLabel: clock.label,
            minute: clock.minute,
            stoppage: clock.stoppage,
            playerName: assistName,
            isOwnGoal: false,
            isPenalty: false,
            eventId,
            wallclock,
          });
        }
      }
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

/**
 * Pulselive `status` is single-letter (`U`=upcoming, `L`=live, `H`=half-time, `C`=complete,
 * `A`=abandoned). `phase` adds detail (`1`=first half, `H`=halftime, `2`=second half,
 * `F`=full-time). Translate to the started/finished/statusText flags ESPN exposes so the
 * UI's status pill renders identically for either source.
 */
function pulseliveStatusLabel(status, phase) {
  switch (status) {
    case 'U':
      return 'Scheduled';
    case 'L':
      if (phase === 'H' || phase === 'HT') return 'Half Time';
      return 'Live';
    case 'H':
      return 'Half Time';
    case 'C':
      return 'FT';
    case 'A':
      return 'Abandoned';
    case 'P':
      return 'Postponed';
    default:
      return null;
  }
}

/**
 * Map Pulselive fixture into the score / status shape the Live UI expects (matches
 * `parseEspnScoreForFplFixture`).
 *
 * @param {object} fixtureJson — raw `/fixtures/{id}` body
 * @param {object} fplFixture — used to determine which Pulselive team is home/away
 * @param {Map<number, number>} pulseToFpl
 * @returns {{
 *   started: boolean,
 *   finished: boolean,
 *   statusText: string | null,
 *   liveMinute: string | null,
 *   homeScore: number | null,
 *   awayScore: number | null,
 *   kickoffIso: string | null,
 * } | null}
 */
export function parsePulseliveScore(fixtureJson, fplFixture, pulseToFpl) {
  if (!fixtureJson || typeof fixtureJson !== 'object') return null;
  const teams = Array.isArray(fixtureJson.teams) ? fixtureJson.teams : [];
  if (teams.length < 2) return null;

  const th = Number(fplFixture?.team_h);
  const ta = Number(fplFixture?.team_a);
  if (!Number.isFinite(th) || !Number.isFinite(ta)) return null;

  let homeScore = null;
  let awayScore = null;
  for (const t of teams) {
    const teamPulse = coerceInt(t?.team?.id) ?? coerceInt(t?.teamId);
    if (teamPulse == null) continue;
    const fplT = pulseToFpl?.get?.(teamPulse);
    const raw = t?.score;
    const n = Number.isFinite(Number(raw)) ? Number(raw) : null;
    if (fplT === th) homeScore = n;
    else if (fplT === ta) awayScore = n;
  }

  const status = typeof fixtureJson.status === 'string' ? fixtureJson.status : null;
  const phase = typeof fixtureJson.phase === 'string' ? fixtureJson.phase : null;
  const statusText = pulseliveStatusLabel(status, phase);
  const started = status === 'L' || status === 'H' || status === 'C';
  const finished = status === 'C' || phase === 'F';
  const liveMinute =
    status === 'L' && fixtureJson.clock?.label
      ? String(fixtureJson.clock.label)
      : null;

  const kickoffMs = coerceInt(fixtureJson.kickoff?.millis);
  const kickoffIso = kickoffMs != null ? new Date(kickoffMs).toISOString() : null;

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
 * Full Prem window from Pulselive for every FPL fixture in a GW. Returns the same row
 * shape as `fetchEspnPremWindow` so a downstream merger can pick rows per fixture without
 * any source-specific branching.
 *
 * @param {{
 *   gwFixtures: object[],
 *   teamById: Record<number, object>,
 *   elementById: Record<number, object>,
 *   signal?: AbortSignal,
 * }} args
 * @returns {Promise<Array<{
 *   fplFixture: object,
 *   matchId: number | null,
 *   score: object | null,
 *   events: object[],
 *   lineups: { home: object, away: object } | null,
 *   fetchError: string | null,
 *   detailsBlockedReason: null,
 * }>>}
 */
export async function fetchPulselivePremWindow({
  gwFixtures,
  teamById,
  elementById,
  signal,
}) {
  const fxList = Array.isArray(gwFixtures) ? gwFixtures : [];
  if (!fxList.length) return [];

  /**
   * Pulselive's only effective date filter on `/fixtures` is `compSeasons={id}`; the
   * `fromDate`/`toDate` query params are silently ignored. Discover the current season
   * id from `/competitions/1/compseasons` (latest-first) using one of the GW kickoffs
   * to pick the right season label (e.g. `2025/26`).
   */
  let compSeasonId = null;
  try {
    const seasonsJson = await fetchPulseliveJson(
      `competitions/${PL_COMP_ID}/compseasons?page=0&pageSize=10`,
    );
    const firstKickoffMs = (() => {
      for (const fx of fxList) {
        const t = Date.parse(String(fx?.kickoff_time || ''));
        if (Number.isFinite(t)) return t;
      }
      return null;
    })();
    compSeasonId = pickCurrentCompSeasonId(seasonsJson, firstKickoffMs);
  } catch {
    return [];
  }
  if (!compSeasonId || signal?.aborted) return [];

  let listJson;
  try {
    const query = `fixtures?comps=${PL_COMP_ID}&compSeasons=${compSeasonId}&page=0&pageSize=400&sort=asc&statuses=U,L,C`;
    listJson = await fetchPulseliveJson(query);
  } catch {
    return [];
  }
  if (signal?.aborted) return [];

  const pulseFixtures = collectPulseliveFixtures(listJson);
  const pulseTeams = harvestTeams(listJson);
  const pulseToFpl = mapPulseliveTeamsToFpl(teamById, pulseTeams);
  if (!pulseToFpl.size) {
    return fxList.map((fx) => ({
      fplFixture: fx,
      matchId: null,
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
    const match = findPulseliveMatchForFixture(fx, pulseToFpl, pulseFixtures);
    if (!match) {
      out.push({
        fplFixture: fx,
        matchId: null,
        score: null,
        events: [],
        lineups: null,
        fetchError: null,
        detailsBlockedReason: null,
      });
      continue;
    }

    let fixtureJson;
    let fetchError = null;
    try {
      fixtureJson = await fetchPulseliveJson(`fixtures/${match.fixtureId}`);
    } catch (e) {
      fetchError = e?.message || String(e);
    }
    let score = null;
    let events = [];
    let lineups = null;
    if (fixtureJson) {
      score = parsePulseliveScore(fixtureJson, fx, pulseToFpl);
      events = parsePulseliveEvents(fixtureJson, fx, pulseToFpl);
      lineups = parsePulseliveLineups(fixtureJson, fx, pulseToFpl);
    }

    const enriched = enrichWithFplElements({
      fplFixture: fx,
      events,
      lineups,
      elementById,
    });
    out.push({
      fplFixture: fx,
      matchId: match.fixtureId,
      score: score || null,
      events: enriched.events,
      lineups: enriched.lineups,
      fetchError,
      detailsBlockedReason: null,
    });
  }
  return out;
}

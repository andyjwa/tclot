/**
 * ESPN soccer (eng.1) as the clock source for goal / assist / yellow-card / red-card ordering.
 *
 * Per GW:
 *   1. For every unique UTC date a fixture kicks off on, pull `scoreboard?dates=YYYYMMDD`
 *      — that gives us ESPN's event id + team ids + abbreviations.
 *   2. Build an ESPN-team-id → FPL-team-id map via short-name (with the two known exceptions:
 *      MNC↔MCI, MAN↔MUN).
 *   3. For each GW fixture we can pair with an ESPN event, pull `summary?event=ID` and walk
 *      `keyEvents[]`. ESPN supplies `wallclock` (real-world ISO timestamp) on every event,
 *      so `sortKey = Date.parse(wallclock)` gives true cross-fixture chronological ordering
 *      without kickoff+minute arithmetic.
 *
 * Unlike FotMob's `matchDetails`, ESPN is an open feed — no signed header, no rate-limit gate.
 */

import { espnResourceUrl } from './espnUrl.js';
import { matchFplElementId } from './fotmobPremTimeline.js';

export { matchFplElementId };

export function yyyymmddUtc(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${mo}${day}`;
}

async function fetchEspn(pathAndQuery) {
  const url = espnResourceUrl(pathAndQuery);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`ESPN ${pathAndQuery} HTTP ${r.status}`);
  return r.json();
}

/**
 * ESPN soccer uses 3-letter abbreviations that mostly align with FPL's `short_name`.
 * The only two we've seen diverge on a Premier League roster are the Manchester clubs.
 */
const ESPN_TO_FPL_SHORT = new Map([
  ['MNC', 'MCI'],
  ['MAN', 'MUN'],
]);

/**
 * Normalize a club name for cross-source matching: lower-case, strip punctuation and the
 * `AFC` / `FC` noise words, collapse whitespace. Mirrors the helpers in
 * `pulselivePremTimeline` / `fotmobPremWindow` so ESPN gets the same name fallback they
 * already have.
 * @param {unknown} s
 */
function normalizeTeamName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[.'`]/g, '')
    .replace(/\b(afc|fc)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build espnTeamId → fplTeamId.
 *
 * ESPN's 3-letter `abbreviation` usually equals FPL's `short_name`, but clubs that rarely
 * appear in ESPN's PL dataset (e.g. newly-promoted sides) can carry a code that diverges
 * from FPL's. Abbreviation-only matching silently drops those fixtures (no `matchId` → no
 * lineups), even though ESPN's own site shows them. So we mirror the Pulselive / FotMob
 * mappers: try the abbreviation (with the known Manchester aliases) first, then fall back
 * to a normalized `displayName` match — exact first, then a unique-substring match so
 * "Bournemouth" resolves to "AFC Bournemouth" without ever ambiguously matching
 * "Manchester".
 *
 * @param {Record<number, object>} teamById — FPL `teams` keyed by id
 * @param {Array<{ id: number, abbreviation?: string, displayName?: string }>} espnTeams
 * @returns {Map<number, number>} espnTeamId → fplTeamId
 */
export function mapEspnTeamsToFpl(teamById, espnTeams) {
  const fplByShort = new Map();
  /** @type {Array<{ id: number, name: string }>} normalized FPL names for fallback */
  const fplNameRows = [];
  for (const [k, pl] of Object.entries(teamById || {})) {
    const id = Number(k);
    if (!Number.isFinite(id)) continue;
    const sh = String(pl?.short_name || '').toUpperCase();
    if (sh) fplByShort.set(sh, id);
    const nm = normalizeTeamName(pl?.name);
    if (nm) fplNameRows.push({ id, name: nm });
  }

  const out = new Map();
  for (const t of espnTeams || []) {
    const espnId = Number(t?.id);
    if (!Number.isFinite(espnId)) continue;

    let abbr = String(t?.abbreviation || '').toUpperCase();
    if (ESPN_TO_FPL_SHORT.has(abbr)) abbr = ESPN_TO_FPL_SHORT.get(abbr);
    const fplFromAbbr = abbr ? fplByShort.get(abbr) : null;
    if (fplFromAbbr != null) {
      out.set(espnId, fplFromAbbr);
      continue;
    }

    /** Name fallback — only when the abbreviation didn't resolve. */
    const name = normalizeTeamName(t?.displayName);
    if (!name) continue;
    const exact = fplNameRows.find((r) => r.name === name);
    if (exact) {
      out.set(espnId, exact.id);
      continue;
    }
    const subs = fplNameRows.filter(
      (r) => r.name.includes(name) || name.includes(r.name),
    );
    if (subs.length === 1) out.set(espnId, subs[0].id);
  }
  return out;
}

export function classifyEspnEvent(ev) {
  const t = String(ev?.type?.type || '').toLowerCase();
  // ESPN uses `own-goal` (not `goal`) for OGs, e.g. "Own Goal by James Hill, Bournemouth."
  if (t === 'goal' || t === 'own-goal' || t === 'owngoal') return 'goal';
  if (t === 'yellow-card') return 'yellow_card';
  if (t === 'red-card') return 'red_card';
  return null;
}

/** True when the feed marks an own goal (separate `type` and/or text). */
export function isEspnOwnGoalEvent(ev) {
  const t = String(ev?.type?.type || '').toLowerCase();
  if (t === 'own-goal' || t === 'owngoal') return true;
  const textBlob = `${ev?.text || ''} ${ev?.shortText || ''}`;
  return /own goal/i.test(textBlob);
}

/**
 * Same clock logic as `espnPremWindow` — for Player Points’ match-minute column.
 * @param {object} ev — ESPN `keyEvents[]` entry
 * @returns {{ label: string }}
 */
function espnClockToMinute(ev) {
  const c = ev?.clock;
  const display =
    (typeof c?.displayValue === 'string' && c.displayValue.trim()
      ? c.displayValue
      : null) || '—';
  return { label: display };
}

/**
 * Extract the list of matches from an ESPN scoreboard payload.
 * @returns {Array<{ eventId: number, homeId: number, awayId: number, homeAbbr: string, awayAbbr: string }>}
 */
export function collectDayMatches(scoreboardJson) {
  const out = [];
  const seen = new Set();
  const events = scoreboardJson?.events;
  if (!Array.isArray(events)) return out;
  for (const ev of events) {
    const eid = Number(ev?.id);
    const competitors = ev?.competitions?.[0]?.competitors;
    if (!Number.isFinite(eid) || seen.has(eid)) continue;
    if (!Array.isArray(competitors) || competitors.length !== 2) continue;
    const home = competitors.find(
      (c) => String(c?.homeAway || '').toLowerCase() === 'home'
    );
    const away = competitors.find(
      (c) => String(c?.homeAway || '').toLowerCase() === 'away'
    );
    if (!home || !away) continue;
    const homeId = Number(home?.team?.id);
    const awayId = Number(away?.team?.id);
    if (!Number.isFinite(homeId) || !Number.isFinite(awayId)) continue;
    seen.add(eid);
    out.push({
      eventId: eid,
      homeId,
      awayId,
      homeAbbr: String(home?.team?.abbreviation || ''),
      awayAbbr: String(away?.team?.abbreviation || ''),
    });
  }
  return out;
}

export function harvestTeams(scoreboardJson, roster, seenId) {
  const events = scoreboardJson?.events;
  if (!Array.isArray(events)) return;
  for (const ev of events) {
    const competitors = ev?.competitions?.[0]?.competitors || [];
    for (const c of competitors) {
      const t = c?.team;
      const id = Number(t?.id);
      if (!Number.isFinite(id) || seenId.has(id)) continue;
      seenId.add(id);
      roster.push({
        id,
        abbreviation: String(t?.abbreviation || ''),
        displayName: String(t?.displayName || ''),
      });
    }
  }
}

export function findEspnMatchForFixture(fx, espnToFpl, dayRows) {
  const th = Number(fx?.team_h);
  const ta = Number(fx?.team_a);
  if (!Number.isFinite(th) || !Number.isFinite(ta)) return null;
  for (const row of dayRows) {
    const h = espnToFpl.get(row.homeId);
    const a = espnToFpl.get(row.awayId);
    if (h === th && a === ta) return row;
    if (h === ta && a === th) return row;
  }
  return null;
}

/**
 * @param {{
 *   gameweek: number,
 *   gwFixtures: object[],
 *   elementById: Record<number, object>,
 *   teamById: Record<number, object>,
 *   trackedElementIds: Set<number>,
 * }} p
 * @returns {Promise<object[]>} contribution-shaped events with `sortKey` = epoch ms of `wallclock`
 */
export async function fetchEspnContributionTimeline({
  gameweek,
  gwFixtures,
  elementById,
  teamById,
  trackedElementIds,
}) {
  const gw = Number(gameweek);
  if (!Number.isFinite(gw) || !Array.isArray(gwFixtures) || !gwFixtures.length) {
    return [];
  }

  const dates = new Set();
  for (const fx of gwFixtures) {
    const d = yyyymmddUtc(fx.kickoff_time);
    if (d) dates.add(d);
  }
  if (!dates.size) return [];

  /** @type {Map<string, ReturnType<collectDayMatches>>} */
  const byDate = new Map();
  /** @type {Array<{ id: number, abbreviation: string, displayName: string }>} */
  const espnTeamRoster = [];
  const seenTeam = new Set();

  for (const d of dates) {
    try {
      const sb = await fetchEspn(`scoreboard?dates=${d}`);
      byDate.set(d, collectDayMatches(sb));
      harvestTeams(sb, espnTeamRoster, seenTeam);
    } catch {
      byDate.set(d, []);
    }
  }

  if (!espnTeamRoster.length) return [];

  const espnToFpl = mapEspnTeamsToFpl(teamById, espnTeamRoster);
  if (!espnToFpl.size) return [];

  const tracked = trackedElementIds instanceof Set
    ? trackedElementIds
    : new Set(Array.from(trackedElementIds || []).map((n) => Number(n)));

  const out = [];

  for (const fx of gwFixtures) {
    const d = yyyymmddUtc(fx.kickoff_time);
    if (!d) continue;
    const dayRows = byDate.get(d) || [];
    const match = findEspnMatchForFixture(fx, espnToFpl, dayRows);
    if (!match) continue;

    let summary;
    try {
      summary = await fetchEspn(`summary?event=${match.eventId}`);
    } catch {
      continue;
    }

    const keyEvents = Array.isArray(summary?.keyEvents) ? summary.keyEvents : [];

    for (let idx = 0; idx < keyEvents.length; idx++) {
      const ev = keyEvents[idx];
      const kind = classifyEspnEvent(ev);
      if (!kind) continue;

      const wallclock = Date.parse(String(ev?.wallclock || ''));
      if (!Number.isFinite(wallclock)) continue;

      const espnTeamId = Number(ev?.team?.id);
      const teamFplId = espnToFpl.get(espnTeamId);
      if (!Number.isFinite(teamFplId)) continue;

      const participants = Array.isArray(ev?.participants) ? ev.participants : [];
      const primaryAthlete = participants[0]?.athlete;
      if (!primaryAthlete?.displayName) continue;

      const isOwnGoal = kind === 'goal' && isEspnOwnGoalEvent(ev);

      /** @type {number | null} */
      let primaryId;
      if (kind === 'goal' && isOwnGoal) {
        const thF = Number(fx?.team_h);
        const taF = Number(fx?.team_a);
        primaryId =
          (Number.isFinite(thF)
            ? matchFplElementId(thF, primaryAthlete.displayName, elementById)
            : null) ??
          (Number.isFinite(taF)
            ? matchFplElementId(taF, primaryAthlete.displayName, elementById)
            : null);
      } else {
        primaryId = matchFplElementId(
          teamFplId,
          primaryAthlete.displayName,
          elementById
        );
      }

      const mm = espnClockToMinute(ev);
      const pushOne = (k, elid, extraMs = 0, meta = {}) => {
        if (elid == null || !tracked.has(elid)) return;
        const key = wallclock + extraMs;
        out.push({
          stableId: `espn:${match.eventId}:${ev.id}:${k}:${elid}`,
          kind: k,
          elementId: elid,
          gameweek: gw,
          delta: 1,
          recordedAt: new Date(key).toISOString(),
          sortKey: key,
          source: 'espn',
          minuteLabel: mm.label,
          fplFixtureId:
            fx?.id != null && Number.isFinite(Number(fx.id)) ? Number(fx.id) : null,
          ...meta,
        });
      };

      if (kind === 'goal') {
        pushOne('goal', primaryId, 0, isOwnGoal ? { isOwnGoal: true } : {});
        if (!isOwnGoal) {
          const assistAthlete = participants[1]?.athlete;
          if (assistAthlete?.displayName) {
            const assistId = matchFplElementId(
              teamFplId,
              assistAthlete.displayName,
              elementById
            );
            // `+1` ms so the assist sorts immediately after its goal when `wallclock` is identical.
            pushOne('assist', assistId, 1);
          }
        }
      } else {
        pushOne(kind, primaryId, 0);
      }
    }
  }

  out.sort((a, b) => (Number(b.sortKey) || 0) - (Number(a.sortKey) || 0));
  return out;
}

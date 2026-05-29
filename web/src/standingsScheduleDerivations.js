/**
 * Derivations for the Standings → Schedule sub-tab (Phase 2 redesign).
 *
 * Two surfaces:
 *  1. All-teams view: per-GW grouped fixture list (latest GW first).
 *  2. Team-filtered view: header summary (W-L-T, streak, avg pts) + compact GW rows.
 *
 * Pure functions — kept separate from `useLeagueData` because the schedule sub-tab
 * is a presentation-time concern (filter state lives in the subview), and these helpers
 * accept either an entry-id-keyed name map or fall back to "Team N".
 */

/**
 * Group all matches into per-GW buckets, sorted by GW number descending (latest first).
 *
 * @param {object[]} matches Raw `details.matches` array.
 * @param {Record<number, string>} idToName league_entry id → team name lookup.
 * @returns {Array<{
 *   event: number,
 *   finished: boolean,
 *   fixtures: Array<{
 *     event: number,
 *     finished: boolean,
 *     homeId: number,
 *     awayId: number,
 *     homeName: string,
 *     awayName: string,
 *     homePts: number | null,
 *     awayPts: number | null,
 *   }>,
 * }>}
 */
export function groupScheduleByGw(matches, idToName) {
  const idName = idToName ?? {};
  const buckets = new Map();
  for (const m of matches || []) {
    const ev = Number(m?.event);
    if (!Number.isFinite(ev) || ev < 1) continue;
    const homeId = m.league_entry_1;
    const awayId = m.league_entry_2;
    if (!buckets.has(ev)) buckets.set(ev, []);
    buckets.get(ev).push({
      event: ev,
      finished: !!m.finished,
      homeId,
      awayId,
      homeName: idName[homeId] ?? `Team ${homeId}`,
      awayName: idName[awayId] ?? `Team ${awayId}`,
      homePts: m.finished ? (m.league_entry_1_points ?? null) : null,
      awayPts: m.finished ? (m.league_entry_2_points ?? null) : null,
    });
  }
  const out = [];
  const sortedGws = [...buckets.keys()].sort((a, b) => b - a);
  for (const ev of sortedGws) {
    const fixtures = buckets.get(ev);
    const finished = fixtures.length > 0 && fixtures.every((f) => f.finished);
    out.push({ event: ev, finished, fixtures });
  }
  return out;
}

/**
 * Per-GW rows for one team in chronological order (GW asc).
 *
 * Returned `result` is `'W' | 'L' | 'D' | null` (null for upcoming).
 *
 * @param {number} teamId
 * @param {object[]} matches
 * @param {Record<number, string>} idToName
 */
export function buildTeamScheduleRows(teamId, matches, idToName) {
  const tid = Number(teamId);
  if (!Number.isFinite(tid)) return [];
  const idName = idToName ?? {};
  const rows = [];
  for (const m of matches || []) {
    const ev = Number(m?.event);
    if (!Number.isFinite(ev) || ev < 1) continue;
    const e1 = Number(m.league_entry_1);
    const e2 = Number(m.league_entry_2);
    if (e1 !== tid && e2 !== tid) continue;
    const isHome = e1 === tid;
    const oppId = isHome ? e2 : e1;
    const oppName = idName[oppId] ?? `Team ${oppId}`;
    const finished = !!m.finished;
    let myPts = null;
    let oppPts = null;
    let result = null;
    if (finished) {
      const p1 = Number(m.league_entry_1_points);
      const p2 = Number(m.league_entry_2_points);
      if (Number.isFinite(p1) && Number.isFinite(p2)) {
        myPts = isHome ? p1 : p2;
        oppPts = isHome ? p2 : p1;
        if (myPts > oppPts) result = 'W';
        else if (myPts < oppPts) result = 'L';
        else result = 'D';
      }
    }
    rows.push({
      event: ev,
      finished,
      location: isHome ? 'H' : 'A',
      opponentId: oppId,
      opponentName: oppName,
      myPoints: myPts,
      oppPoints: oppPts,
      result,
    });
  }
  rows.sort((a, b) => a.event - b.event);
  return rows;
}

/**
 * Aggregate W/L/D, streak, and average points-for from per-team schedule rows.
 *
 * Streak is read from the latest finished GW backward — `W3`, `L1`, `D2` etc.
 * Average is the mean of `myPoints` across finished GWs only (rounded to 1 dp).
 *
 * @param {ReturnType<typeof buildTeamScheduleRows>} rows
 */
export function summarizeTeamSchedule(rows) {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let pointsTotal = 0;
  let pointsCount = 0;
  for (const r of rows || []) {
    if (!r.finished || r.result == null) continue;
    if (r.result === 'W') wins += 1;
    else if (r.result === 'L') losses += 1;
    else if (r.result === 'D') draws += 1;
    if (typeof r.myPoints === 'number' && Number.isFinite(r.myPoints)) {
      pointsTotal += r.myPoints;
      pointsCount += 1;
    }
  }
  let streakLetter = null;
  let streakCount = 0;
  for (let i = (rows?.length ?? 0) - 1; i >= 0; i -= 1) {
    const r = rows[i];
    if (!r.finished || r.result == null) continue;
    if (streakLetter == null) {
      streakLetter = r.result;
      streakCount = 1;
    } else if (r.result === streakLetter) {
      streakCount += 1;
    } else {
      break;
    }
  }
  const avg =
    pointsCount > 0 ? Math.round((pointsTotal / pointsCount) * 10) / 10 : null;
  return {
    wins,
    losses,
    draws,
    streakLetter,
    streakCount,
    streakLabel: streakLetter ? `${streakLetter}${streakCount}` : null,
    avgPoints: avg,
    finishedCount: pointsCount,
  };
}

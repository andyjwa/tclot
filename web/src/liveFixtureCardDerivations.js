/**
 * Derivations for the mobile live fixture card: per-team Key Stats
 * aggregates (over the effective starting XI) and season head-to-head
 * bar metrics between the two managers. Kept framework-free and pure so
 * they can be unit-tested without React.
 */

/**
 * Effective starters (post-autosub when the display lineup is complete),
 * mirroring the helper in `LiveExpandedFixture.jsx` / `LiveScores.jsx`.
 */
export function effectiveStartersForCard(squad) {
  if (!squad || squad.error) return [];
  const nBench = squad.bench?.length ?? 0;
  if (
    squad.displayStarters?.length === 11 &&
    squad.displayBench?.length === nBench
  ) {
    return squad.displayStarters;
  }
  return squad.starters ?? [];
}

const num = (v) => Number(v) || 0;

/**
 * Aggregate one team's effective XI into the Key Stats totals.
 * @param {object} squad
 * @returns {{ players60: number, goals: number, assists: number, defcon: number, cleanSheets: number, yellow: number, red: number }}
 */
export function teamKeyStatTotals(squad) {
  const xi = effectiveStartersForCard(squad);
  const totals = {
    players60: 0,
    goals: 0,
    assists: 0,
    defcon: 0,
    cleanSheets: 0,
    yellow: 0,
    red: 0,
  };
  for (const r of xi) {
    if (num(r.minutes) >= 60) totals.players60 += 1;
    totals.goals += num(r.goalsScored);
    totals.assists += num(r.assists);
    totals.defcon += num(r.dcCount);
    totals.cleanSheets += num(r.cleanSheets);
    totals.yellow += num(r.yellowCards);
    totals.red += num(r.redCards);
  }
  return totals;
}

/**
 * Key Stats rows for the card, in the user-specified order:
 * Players 60+, Goals, Assists, Def Con, Clean Sheets, Yellow Cards, Red Cards.
 * @returns {Array<{ key: string, label: string, home: number, away: number }>}
 */
export function keyStatRows(homeSquad, awaySquad) {
  const h = teamKeyStatTotals(homeSquad);
  const a = teamKeyStatTotals(awaySquad);
  return [
    { key: 'players60', label: 'Players 60+', home: h.players60, away: a.players60 },
    { key: 'goals', label: 'Goals', home: h.goals, away: a.goals },
    { key: 'assists', label: 'Assists', home: h.assists, away: a.assists },
    { key: 'defcon', label: 'Def Con', home: h.defcon, away: a.defcon },
    { key: 'cleanSheets', label: 'Clean Sheets', home: h.cleanSheets, away: a.cleanSheets },
    { key: 'yellow', label: 'Yellow Cards', home: h.yellow, away: a.yellow },
    { key: 'red', label: 'Red Cards', home: h.red, away: a.red },
  ];
}

/**
 * Season head-to-head summary between two managers, derived from the
 * full `matches` list. Only counts meetings with valid recorded points
 * (finished GWs); the current live GW is intentionally excluded so the
 * summary reads as the settled season record.
 *
 * @param {Array<{ event:number, league_entry_1:number, league_entry_2:number, league_entry_1_points?:number, league_entry_2_points?:number }>} matches
 * @param {number} homeId
 * @param {number} awayId
 * @returns {{ meetings:number, homeWins:number, awayWins:number, draws:number, homePts:number, awayPts:number, homeAvg:number, awayAvg:number }}
 */
export function h2hSeasonSummary(matches, homeId, awayId) {
  const h = Number(homeId);
  const a = Number(awayId);
  let meetings = 0;
  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  let homePts = 0;
  let awayPts = 0;
  for (const m of matches || []) {
    const e1 = Number(m.league_entry_1);
    const e2 = Number(m.league_entry_2);
    if (!Number.isFinite(e1) || !Number.isFinite(e2)) continue;
    if ((e1 !== h || e2 !== a) && (e1 !== a || e2 !== h)) continue;
    const p1 = Number(m.league_entry_1_points);
    const p2 = Number(m.league_entry_2_points);
    if (!Number.isFinite(p1) || !Number.isFinite(p2)) continue;
    // Treat an unplayed 0-0 row as not-yet-met.
    if (p1 === 0 && p2 === 0) continue;
    const hp = e1 === h ? p1 : p2;
    const ap = e1 === h ? p2 : p1;
    meetings += 1;
    homePts += hp;
    awayPts += ap;
    if (hp > ap) homeWins += 1;
    else if (ap > hp) awayWins += 1;
    else draws += 1;
  }
  const round1 = (n) => Math.round(n * 10) / 10;
  return {
    meetings,
    homeWins,
    awayWins,
    draws,
    homePts,
    awayPts,
    homeAvg: meetings ? round1(homePts / meetings) : 0,
    awayAvg: meetings ? round1(awayPts / meetings) : 0,
  };
}

/**
 * Bar rows for the H2H tab. Each row carries raw numeric home/away
 * values (for bar proportions) plus display text.
 * @param {ReturnType<typeof h2hSeasonSummary>} summary
 * @returns {Array<{ key:string, label:string, home:number, away:number, homeText:string, awayText:string }>}
 */
export function h2hBarRows(summary) {
  const s = summary || h2hSeasonSummary([], 0, 0);
  return [
    {
      key: 'wins',
      label: 'H2H wins',
      home: s.homeWins,
      away: s.awayWins,
      homeText: String(s.homeWins),
      awayText: String(s.awayWins),
    },
    {
      key: 'avg',
      label: 'Avg points',
      home: s.homeAvg,
      away: s.awayAvg,
      homeText: s.homeAvg.toFixed(1),
      awayText: s.awayAvg.toFixed(1),
    },
    {
      key: 'total',
      label: 'Total points',
      home: s.homePts,
      away: s.awayPts,
      homeText: String(s.homePts),
      awayText: String(s.awayPts),
    },
  ];
}

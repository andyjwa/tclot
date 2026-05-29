/**
 * Per-opponent H2H aggregates for one team from finished `matches` rows.
 */

/**
 * @param {Array<{ event?: number, finished?: boolean, league_entry_1: number, league_entry_2: number, league_entry_1_points?: number, league_entry_2_points?: number }>} matches
 * @param {Record<number, string>} idToName
 * @param {number} teamId
 * @returns {Array<{ opponentId: number, opponentName: string, p: number, w: number, d: number, l: number, record: string, for: number | string, against: number | string, lastLabel: string }>}
 */
export function buildH2hRivalsForTeam(matches, idToName, teamId) {
  const tid = Number(teamId);
  if (!Number.isFinite(tid) || !idToName || typeof idToName !== 'object') return [];

  const opponentIds = Object.keys(idToName)
    .map(Number)
    .filter((id) => Number.isFinite(id) && id !== tid)
    .sort((a, b) => {
      const na = (idToName[a] ?? '').toLowerCase();
      const nb = (idToName[b] ?? '').toLowerCase();
      return na.localeCompare(nb) || a - b;
    });

  /** @type {Map<number, { w: number, d: number, l: number, for: number, against: number, lastGw: number, lastMe: number, lastOpp: number }>} */
  const agg = new Map();
  for (const oid of opponentIds) {
    agg.set(oid, {
      w: 0,
      d: 0,
      l: 0,
      for: 0,
      against: 0,
      lastGw: -1,
      lastMe: 0,
      lastOpp: 0,
    });
  }

  for (const m of matches || []) {
    if (!m.finished) continue;
    const e1 = Number(m.league_entry_1);
    const e2 = Number(m.league_entry_2);
    if (e1 !== tid && e2 !== tid) continue;
    const opp = e1 === tid ? e2 : e1;
    if (!agg.has(opp)) continue;

    const p1 = Number(m.league_entry_1_points);
    const p2 = Number(m.league_entry_2_points);
    if (!Number.isFinite(p1) || !Number.isFinite(p2)) continue;

    const me = e1 === tid ? p1 : p2;
    const them = e1 === tid ? p2 : p1;
    const gw = Number(m.event);
    const gwSafe = Number.isFinite(gw) ? gw : 0;

    const row = agg.get(opp);
    row.for += me;
    row.against += them;
    if (me > them) row.w += 1;
    else if (me < them) row.l += 1;
    else row.d += 1;

    if (gwSafe > row.lastGw) {
      row.lastGw = gwSafe;
      row.lastMe = me;
      row.lastOpp = them;
    }
  }

  return opponentIds.map((oid) => {
    const row = agg.get(oid);
    const played = row.w + row.d + row.l;
    let lastLabel = '—';
    if (played > 0 && row.lastGw >= 0) {
      let letter = 'D';
      if (row.lastMe > row.lastOpp) letter = 'W';
      else if (row.lastMe < row.lastOpp) letter = 'L';
      lastLabel = `GW${row.lastGw} · ${row.lastMe}–${row.lastOpp} (${letter})`;
    }
    return {
      opponentId: oid,
      opponentName: idToName[oid] ?? `Team ${oid}`,
      p: played,
      w: row.w,
      d: row.d,
      l: row.l,
      record: played > 0 ? `${row.w}–${row.d}–${row.l}` : '—',
      for: played > 0 ? row.for : '—',
      against: played > 0 ? row.against : '—',
      lastLabel,
    };
  });
}

/**
 * Per-GW raw FPL points league table (1 = highest) and season totals where
 * finish position 1 → 1 point … 8 → 8 points (lower total = better weeks).
 * Villain / hero counts match LiveScores H2H + ordinal rules on the same GW points.
 */

/**
 * @param {Map<number, number> | Record<number, number>} pointsByEntryId
 * @returns {Map<number, number>}
 */
export function fplGwScoreOrdinalFromPointsMap(pointsByEntryId) {
  const rows = [];
  const iter =
    pointsByEntryId instanceof Map
      ? pointsByEntryId.entries()
      : Object.entries(pointsByEntryId || {});
  for (const [idRaw, ptsRaw] of iter) {
    const id = Number(idRaw);
    const pts = Number(ptsRaw);
    if (!Number.isFinite(id) || !Number.isFinite(pts)) continue;
    rows.push({ id, pts });
  }
  rows.sort((a, b) => {
    const d = b.pts - a.pts;
    if (d !== 0) return d;
    return a.id - b.id;
  });
  const m = new Map();
  rows.forEach((r, idx) => {
    m.set(r.id, idx + 1);
  });
  return m;
}

/**
 * Entries that won H2H while 7th in that GW's raw FPL table, plus both
 * sides of a draw that sits at the lowest score of a full 8-team table.
 *
 * @param {Map<number, number>} pointsByEntryId
 * @param {object[]} gwMatches
 * @returns {Set<number>}
 */
export function villainVictoryEntryIds(pointsByEntryId, gwMatches) {
  const ordinalById = fplGwScoreOrdinalFromPointsMap(pointsByEntryId);
  const out = new Set();

  for (const m of gwMatches || []) {
    const homeId = Number(m.league_entry_1);
    const awayId = Number(m.league_entry_2);
    if (!Number.isFinite(homeId) || !Number.isFinite(awayId)) continue;

    const homePts = pointsByEntryId.get(homeId);
    const awayPts = pointsByEntryId.get(awayId);
    if (!Number.isFinite(homePts) || !Number.isFinite(awayPts)) continue;

    const h = Number(homePts);
    const a = Number(awayPts);

    if (h > a) {
      if (ordinalById.get(homeId) === 7) out.add(homeId);
    } else if (a > h) {
      if (ordinalById.get(awayId) === 7) out.add(awayId);
    } else if (pointsByEntryId.size >= 8) {
      /* Draw at the bottom of a full 8-team GW table: both are villains. */
      let minPts = Infinity;
      for (const pts of pointsByEntryId.values()) {
        if (pts < minPts) minPts = pts;
      }
      if (h === minPts) {
        out.add(homeId);
        out.add(awayId);
      }
    }
  }
  return out;
}

/**
 * Villain set for one GW of schedule-shaped fixtures (`homeId` / `homePts`
 * or draft-match `league_entry_*`). Needs a full 8-team score table so
 * "7th in raw GW points" is well-defined; otherwise returns empty.
 *
 * @param {object[]} fixtures
 * @returns {Set<number>}
 */
export function villainVictoryEntryIdsFromGwFixtures(fixtures) {
  const pointsByEntryId = new Map();
  const gwMatches = [];
  for (const fx of fixtures || []) {
    const homeId = Number(fx.homeId ?? fx.league_entry_1);
    const awayId = Number(fx.awayId ?? fx.league_entry_2);
    const homePts = Number(fx.homePts ?? fx.league_entry_1_points);
    const awayPts = Number(fx.awayPts ?? fx.league_entry_2_points);
    if (!Number.isFinite(homeId) || !Number.isFinite(awayId)) continue;
    if (!Number.isFinite(homePts) || !Number.isFinite(awayPts)) continue;
    pointsByEntryId.set(homeId, homePts);
    pointsByEntryId.set(awayId, awayPts);
    gwMatches.push({ league_entry_1: homeId, league_entry_2: awayId });
  }
  if (pointsByEntryId.size < 8) return new Set();
  return villainVictoryEntryIds(pointsByEntryId, gwMatches);
}

/**
 * @param {Map<number, number>} pointsByEntryId
 * @param {object[]} gwMatches
 * @returns {Set<number>}
 */
export function heroDefeatEntryIds(pointsByEntryId, gwMatches) {
  const ordinalById = fplGwScoreOrdinalFromPointsMap(pointsByEntryId);
  const out = new Set();

  for (const m of gwMatches || []) {
    const homeId = Number(m.league_entry_1);
    const awayId = Number(m.league_entry_2);
    if (!Number.isFinite(homeId) || !Number.isFinite(awayId)) continue;

    const homePts = pointsByEntryId.get(homeId);
    const awayPts = pointsByEntryId.get(awayId);
    if (!Number.isFinite(homePts) || !Number.isFinite(awayPts)) continue;

    const h = Number(homePts);
    const a = Number(awayPts);

    if (h < a) {
      if (ordinalById.get(homeId) === 2) out.add(homeId);
    } else if (a < h) {
      if (ordinalById.get(awayId) === 2) out.add(awayId);
    }
  }
  return out;
}

/**
 * @param {{ id: number, pts: number }[]} rows — mutated with rank + rankPts
 * @param {number} teamCount
 */
export function assignGwFinishRankAndPositionPoints(rows, teamCount) {
  rows.sort((a, b) => b.pts - a.pts || a.id - b.id);
  let i = 0;
  while (i < rows.length) {
    let j = i + 1;
    while (j < rows.length && rows[j].pts === rows[i].pts) j++;
    const rankStart = i + 1;
    const rankEnd = j;
    const count = j - i;
    const avgRank = (rankStart + rankEnd) / 2;
    let sumPts = 0;
    for (let r = rankStart; r <= rankEnd; r++) sumPts += r;
    const avgPts = sumPts / count;
    for (let k = i; k < j; k++) {
      rows[k].rank = avgRank;
      rows[k].positionPoints = avgPts;
    }
    i = j;
  }
  if (rows.length !== teamCount) {
    for (const r of rows) {
      if (r.rank == null) {
        r.rank = teamCount;
        r.positionPoints = teamCount;
      }
    }
  }
  return rows;
}

/**
 * @param {object[]} matchList
 * @param {object[]} leagueEntries
 * @param {Record<number, { entry_name?: string }>} teams — mutated for missing ids
 */
export function buildGwRawPointsRankSeasonTotals(matchList, leagueEntries, teams) {
  const idSet = new Set();
  for (const e of leagueEntries || []) {
    if (e?.id != null) idSet.add(e.id);
  }
  const finished = (matchList || []).filter((m) => m.finished);
  for (const m of finished) {
    idSet.add(m.league_entry_1);
    idSet.add(m.league_entry_2);
  }
  const ids = [...idSet].filter((x) => x != null).sort((a, b) => a - b);
  const teamCount = ids.length;
  if (teamCount === 0) {
    return { gwRawPointsRankMeta: { maxGw: 0, teamCount: 0 }, gwRawPointsRankRows: [] };
  }
  for (const id of ids) {
    if (!teams[id]) {
      teams[id] = { id, entry_id: id, entry_name: `Team ${id}` };
    }
  }

  const gws = [...new Set(finished.map((m) => Number(m.event) || 0))].filter((g) => g > 0);
  gws.sort((a, b) => a - b);
  const maxGw = gws.length ? gws[gws.length - 1] : 0;

  const acc = Object.fromEntries(
    ids.map((id) => [
      id,
      {
        league_entry: id,
        teamName: teams[id]?.entry_name ?? `Team ${id}`,
        totalPositionPoints: 0,
        sumFinishRank: 0,
        gwCount: 0,
        villainVictories: 0,
        heroDefeats: 0,
      },
    ]),
  );

  for (const gw of gws) {
    const gwMatches = finished.filter((m) => Number(m.event) === gw);
    const pointsByEntryId = new Map();
    for (const m of gwMatches) {
      pointsByEntryId.set(m.league_entry_1, m.league_entry_1_points ?? 0);
      pointsByEntryId.set(m.league_entry_2, m.league_entry_2_points ?? 0);
    }
    if (pointsByEntryId.size !== teamCount) continue;

    const rows = [...pointsByEntryId.entries()].map(([id, pts]) => ({ id, pts }));
    assignGwFinishRankAndPositionPoints(rows, teamCount);

    const villains = villainVictoryEntryIds(pointsByEntryId, gwMatches);
    const heroes = heroDefeatEntryIds(pointsByEntryId, gwMatches);

    for (const r of rows) {
      const t = acc[r.id];
      t.totalPositionPoints += r.positionPoints;
      t.sumFinishRank += r.rank;
      t.gwCount += 1;
      if (villains.has(r.id)) t.villainVictories += 1;
      if (heroes.has(r.id)) t.heroDefeats += 1;
    }
  }

  const gwRawPointsRankRows = ids
    .map((id) => {
      const t = acc[id];
      const gwCount = t.gwCount || 0;
      return {
        league_entry: id,
        teamName: t.teamName,
        totalPositionPoints: t.totalPositionPoints,
        avgFinishRank: gwCount ? t.sumFinishRank / gwCount : null,
        villainVictories: t.villainVictories,
        heroDefeats: t.heroDefeats,
        gwCount,
      };
    })
    .filter((r) => r.gwCount > 0)
    .sort(
      (a, b) =>
        a.totalPositionPoints - b.totalPositionPoints ||
        (a.avgFinishRank ?? 99) - (b.avgFinishRank ?? 99) ||
        a.teamName.localeCompare(b.teamName, undefined, { sensitivity: 'base' }),
    )
    .map((r, idx) => ({ ...r, listRank: idx + 1 }));

  return {
    gwRawPointsRankMeta: { maxGw, teamCount },
    gwRawPointsRankRows,
  };
}

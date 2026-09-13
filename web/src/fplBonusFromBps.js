/**
 * FPL bonus points from BPS tiers + tie rules (mirrors official tie-breaking).
 * Provisional until FPL publishes stats.bonus; use selectDisplayBonus() for one column.
 */

/**
 * @param {Array<{ id: number, bps: number }>} players
 * @returns {Array<Array<{ id: number, bps: number }>>}
 */
export function groupByBpsDesc(players) {
  const sorted = [...players].sort((a, b) => b.bps - a.bps);
  const groups = [];
  for (const p of sorted) {
    const last = groups[groups.length - 1];
    if (!last || last[0].bps !== p.bps) groups.push([p]);
    else last.push(p);
  }
  return groups;
}

/**
 * @param {Array<Array<{ id: number }>>} groups — same BPS, best group first
 * @returns {Map<number, number>} element id → bonus (0–3) for this fixture only
 */
export function bonusFromBpsGroups(groups) {
  const m = new Map();
  const g = (i) => groups[i] || [];
  const give = (idx, pts) => {
    for (const p of g(idx)) m.set(p.id, pts);
  };

  if (!groups.length) return m;

  const n0 = g(0).length;
  if (n0 >= 3) {
    give(0, 3);
    return m;
  }
  if (n0 === 2) {
    give(0, 3);
    if (g(1).length) {
      for (const p of g(1)) m.set(p.id, 1);
    }
    return m;
  }

  give(0, 3);
  if (!g(1).length) return m;

  const n1 = g(1).length;
  if (n1 >= 3) {
    give(1, 2);
    return m;
  }
  if (n1 === 2) {
    give(1, 2);
    return m;
  }

  give(1, 2);
  if (!g(2).length) return m;

  const n2 = g(2).length;
  if (n2 >= 3) {
    give(2, 1);
    return m;
  }
  if (n2 === 2) {
    give(2, 1);
    return m;
  }

  give(2, 1);
  return m;
}

/**
 * Draft: explain is [ [ [ { stat, value, ... } ], fixtureId ], ... ]
 * Classic: [ { fixture, stats: [ { identifier, value } ] }, ... ]
 *
 * @param {object} raw — live row (not just .stats)
 * @returns {Array<{ fixtureId: number, minutes: number }>}
 */
export function explainBlocksFromLiveElement(raw) {
  const ex = raw?.explain;
  if (!Array.isArray(ex) || ex.length === 0) return [];

  const first = ex[0];
  if (Array.isArray(first) && first.length === 2 && typeof first[1] === 'number') {
    return ex.map((pair) => {
      const [statList, fixtureId] = pair;
      let minutes = 0;
      for (const s of statList || []) {
        if (s.stat === 'minutes') minutes = Number(s.value) || 0;
      }
      return { fixtureId: Number(fixtureId), minutes };
    });
  }

  if (first && first.fixture != null) {
    return ex.map((block) => {
      let minutes = 0;
      for (const s of block.stats || []) {
        if (s.identifier === 'minutes') minutes = Number(s.value) || 0;
      }
      return { fixtureId: Number(block.fixture), minutes };
    });
  }

  return [];
}

/** FPL live `explain` identifier / draft `stat` for outfield defensive returns. */
const DEFENSIVE_CONTRIBUTION_KEY = 'defensive_contribution';

/**
 * FPL 25/26: actions needed in the GW tally for one defensive-contribution fantasy point, by position.
 * @param {number | null | undefined} elementTypeId — 1 GKP, 2 DEF, 3 MID, 4 FWD
 * @returns {10 | 12 | null} null if position unknown — callers should show raw action count, not 🪖
 */
export function defensiveContributionPointThreshold(elementTypeId) {
  const t = Number(elementTypeId);
  if (!Number.isFinite(t)) return null;
  if (t === 1 || t === 2) return 10;
  if (t === 3 || t === 4) return 12;
  return null;
}

const PENALTIES_SAVED_KEY = 'penalties_saved';

/**
 * Penalty saves this GW. Prefer `stats.penalties_saved`; else sum explain
 * lines (draft `[stats, fixtureId]` pairs and classic `{ identifier }` blocks).
 *
 * @param {object | null | undefined} raw — full live element row
 * @returns {number}
 */
export function penaltiesSavedFromLiveRow(raw) {
  const st = raw?.stats;
  const direct = st?.penalties_saved ?? st?.penaltiesSaved;
  if (Number.isFinite(Number(direct))) return Math.max(0, Number(direct));

  const ex = raw?.explain;
  if (!Array.isArray(ex) || ex.length === 0) return 0;
  let sum = 0;
  const first = ex[0];

  if (Array.isArray(first) && first.length === 2 && typeof first[1] === 'number') {
    for (const pair of ex) {
      for (const s of pair[0] || []) {
        if (s.stat === PENALTIES_SAVED_KEY && Number.isFinite(Number(s.value))) {
          sum += Number(s.value);
        }
      }
    }
    return Math.max(0, sum);
  }

  if (first && first.fixture != null) {
    for (const block of ex) {
      for (const s of block.stats || []) {
        if (s.identifier === PENALTIES_SAVED_KEY && Number.isFinite(Number(s.value))) {
          sum += Number(s.value);
        }
      }
    }
  }
  return Math.max(0, sum);
}

/**
 * Live GW count of defensive contribution **actions** (FPL stat), not fantasy points.
 * Prefer `stats.defensive_contribution` from `event/live`; else sum `value` from explain lines.
 * @param {object | null | undefined} raw — full live element row
 * @returns {number}
 */
export function defensiveContributionCountFromLiveRow(raw) {
  const st = raw?.stats;
  const direct = st?.defensive_contribution;
  if (Number.isFinite(Number(direct))) return Number(direct);

  const ex = raw?.explain;
  if (!Array.isArray(ex) || ex.length === 0) return 0;
  let sum = 0;
  const first = ex[0];

  if (Array.isArray(first) && first.length === 2 && typeof first[1] === 'number') {
    for (const pair of ex) {
      for (const s of pair[0] || []) {
        if (s.stat === DEFENSIVE_CONTRIBUTION_KEY && Number.isFinite(Number(s.value))) {
          sum += Number(s.value);
        }
      }
    }
    return sum;
  }

  if (first && first.fixture != null) {
    for (const block of ex) {
      for (const s of block.stats || []) {
        if (s.identifier === DEFENSIVE_CONTRIBUTION_KEY && Number.isFinite(Number(s.value))) {
          sum += Number(s.value);
        }
      }
    }
  }
  return sum;
}

/**
 * Sum of points from the defensive-contribution line in `event/live` explain (draft + classic).
 * @param {object | null | undefined} raw — full live element row
 * @returns {number}
 */
export function defensiveContributionPointsFromLiveRow(raw) {
  const ex = raw?.explain;
  if (!Array.isArray(ex) || ex.length === 0) return 0;
  let sum = 0;
  const first = ex[0];

  if (Array.isArray(first) && first.length === 2 && typeof first[1] === 'number') {
    for (const pair of ex) {
      for (const s of pair[0] || []) {
        if (s.stat === DEFENSIVE_CONTRIBUTION_KEY && Number.isFinite(Number(s.points))) {
          sum += Number(s.points);
        }
      }
    }
    return sum;
  }

  if (first && first.fixture != null) {
    for (const block of ex) {
      for (const s of block.stats || []) {
        if (s.identifier === DEFENSIVE_CONTRIBUTION_KEY && Number.isFinite(Number(s.points))) {
          sum += Number(s.points);
        }
      }
    }
  }
  return sum;
}

/** @param {object | null | undefined} raw */
export function hasTwoDefensiveContributionPoints(raw) {
  return defensiveContributionPointsFromLiveRow(raw) === 2;
}

/** @param {object} liveRow */
export function activeExplainBlocks(liveRow) {
  return explainBlocksFromLiveElement(liveRow).filter((b) => b.minutes > 0);
}

/**
 * BPS for one fixture from `explain` only (draft + classic). Does not use aggregate
 * `stats.bps`, which is GW-wide and must not be compared inside a single fixture’s pool
 * when the player’s club has a double.
 *
 * @returns {number | null | 'pending'} fixture BPS; `null` if no minutes in this fixture;
 *   `'pending'` if minutes are logged but no `bps` line is present yet.
 */
export function bpsForFixtureFromExplain(liveRow, fixtureId) {
  const fid = Number(fixtureId);
  if (!Number.isFinite(fid)) return null;
  const ex = liveRow?.explain;
  if (!Array.isArray(ex) || ex.length === 0) return null;
  const first = ex[0];

  const scanStats = (statsArr) => {
    let minutes = 0;
    let bpsSum = null;
    for (const s of statsArr || []) {
      const id = s.identifier ?? s.stat;
      const val = s.value;
      if (id === 'minutes') minutes = Number(val) || 0;
      if (id === 'bps') {
        bpsSum = (bpsSum ?? 0) + (Number(val) || 0);
      }
    }
    if (minutes <= 0) return null;
    if (bpsSum !== null) return bpsSum;
    return 'pending';
  };

  if (Array.isArray(first) && first.length === 2 && typeof first[1] === 'number') {
    let pending = false;
    for (const pair of ex) {
      const [statList, f] = pair;
      if (Number(f) !== fid) continue;
      const r = scanStats(statList);
      if (typeof r === 'number') return r;
      if (r === 'pending') pending = true;
    }
    return pending ? 'pending' : null;
  }

  if (first && first.fixture != null) {
    let pending = false;
    for (const block of ex) {
      if (Number(block.fixture) !== fid) continue;
      const r = scanStats(block.stats);
      if (typeof r === 'number') return r;
      if (r === 'pending') pending = true;
    }
    return pending ? 'pending' : null;
  }

  return null;
}

/**
 * BPS for a fixture’s bonus race: use aggregate stats.bps only when the player
 * has minutes in exactly one GW fixture (avoids wrong splits on DGW).
 *
 * @returns {number | null} null → skip provisional for this player in this fixture
 */
export function bpsForFixturePool(liveRow, fixtureId) {
  const active = activeExplainBlocks(liveRow);
  const inFixture = active.filter((b) => b.fixtureId === fixtureId && b.minutes > 0);
  if (inFixture.length === 0) return null;
  if (active.length !== 1) return null;
  return Number(liveRow?.stats?.bps ?? 0);
}

/**
 * @param {Array<{ id: number, team_h: number, team_a: number, event?: number }>} gwFixtures
 * @param {number} teamId
 */
export function fixturesForTeamInGw(gwFixtures, teamId) {
  return gwFixtures.filter(
    (f) => Number(f.team_h) === teamId || Number(f.team_a) === teamId
  );
}

/**
 * Every PL fixture this club has this GW has `finished === true` (hard full-time, not
 * only `finished_provisional`). When FPL keeps `stats.bonus` at **0** after that, the
 * game has settled “no bonus”; our BPS-based estimate may still show +1/+2 briefly or
 * incorrectly — so {@link selectDisplayBonus} can trust API zero.
 *
 * @param {number | null | undefined} teamId
 * @param {object[]} gwFixtures
 */
export function gwTeamFixturesAllHardFinished(teamId, gwFixtures) {
  const tid = Number(teamId);
  if (!Number.isFinite(tid)) return false;
  if (!Array.isArray(gwFixtures) || !gwFixtures.length) return false;
  const mine = fixturesForTeamInGw(gwFixtures, tid);
  if (!mine.length) return false;
  return mine.every((f) => f?.finished === true);
}

/** Match is over for live / LTP purposes (`finished` and/or `finished_provisional`). */
export function isFixtureFullyDone(f) {
  if (f == null) return true;
  if (f.finished_provisional === true) return true;
  if (f.finished === true) return true;
  return false;
}

/**
 * Fixtures this GW this player could still score from (one per single gameweek; two before a DGW is done).
 * Uses live `explain` per-fixture minutes when present; otherwise heuristics for common DGW/SGW cases.
 *
 * @param {object | null | undefined} el — bootstrap element
 * @param {object | null | undefined} liveRow — full draft/classic live row
 * @param {object[]} gwFixtures — fixtures for this event only
 * @param {number | null} teamId
 * @param {number} aggregateMinutes — `stats.minutes` (GW total)
 * @returns {number}
 */
export function countElementGamesLeftToPlay(
  el,
  liveRow,
  gwFixtures,
  teamId,
  aggregateMinutes
) {
  if (teamId == null || !Number.isFinite(teamId)) return 0;
  const mins = Number(aggregateMinutes) || 0;

  if (!Array.isArray(gwFixtures) || !gwFixtures.length) {
    return mins === 0 ? 1 : 0;
  }

  const mine = fixturesForTeamInGw(gwFixtures, teamId);
  const unfinished = mine.filter((f) => !isFixtureFullyDone(f));
  if (!unfinished.length) return 0;

  if (mins === 0) {
    return unfinished.length;
  }

  const playedIds = new Set(
    participatingFixtureIdsForElement(el, liveRow, gwFixtures)
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id))
  );

  if (playedIds.size > 0) {
    let c = 0;
    for (const f of unfinished) {
      const fid = Number(f.id);
      if (!Number.isFinite(fid)) continue;
      if (!playedIds.has(fid)) c++;
    }
    return c;
  }

  const finished = mine.filter((f) => isFixtureFullyDone(f));

  if (unfinished.length === 1) {
    if (finished.length === 0) {
      return 0;
    }
    return 1;
  }

  return Math.max(0, unfinished.length - 1);
}

/**
 * When explain is empty but minutes > 0, attribute to the only GW fixture for this team.
 *
 * @returns {number | null} fixture id
 */
export function fallbackSingleFixtureId(el, liveRow, gwFixtures) {
  const mins = Number(liveRow?.stats?.minutes ?? 0);
  if (mins <= 0) return null;
  const teamId = Number(el?.team);
  if (!Number.isFinite(teamId)) return null;
  const tf = fixturesForTeamInGw(gwFixtures, teamId);
  if (tf.length !== 1) return null;
  return Number(tf[0].id);
}

/**
 * Fixture ids this element has minutes in, or fallback single-team fixture.
 *
 * @param {object} el — bootstrap element
 * @param {object | null} liveRow
 * @param {object[]} gwFixtures
 * @returns {number[]}
 */
export function participatingFixtureIdsForElement(el, liveRow, gwFixtures) {
  if (!liveRow) return [];
  const active = activeExplainBlocks(liveRow);
  if (active.length > 0) {
    return [...new Set(active.map((b) => b.fixtureId))];
  }
  const fb = fallbackSingleFixtureId(el, liveRow, gwFixtures);
  return fb != null ? [fb] : [];
}

/**
 * BPS for bonus pool: explain path or single-fixture fallback.
 *
 * @returns {number | null}
 */
export function bpsForElementInFixture(el, liveRow, fixtureId, gwFixtures) {
  if (!liveRow) return null;
  const tid = Number(el?.team);
  const tfLen =
    Number.isFinite(tid) && Array.isArray(gwFixtures)
      ? fixturesForTeamInGw(gwFixtures, tid).length
      : 0;
  const dgw = tfLen > 1;

  const exBps = bpsForFixtureFromExplain(liveRow, fixtureId);
  if (typeof exBps === 'number') return exBps;
  if (exBps === 'pending') {
    if (dgw) return null;
  }

  if (dgw) {
    return null;
  }

  const direct = bpsForFixturePool(liveRow, fixtureId);
  if (direct != null) return direct;
  const fb = fallbackSingleFixtureId(el, liveRow, gwFixtures);
  if (fb === fixtureId) return Number(liveRow?.stats?.bps ?? 0);
  return null;
}

/**
 * Official `bonus` line for one fixture from `explain` (draft + classic).
 *
 * @returns {number | null} null if that fixture block has no bonus identifier
 */
export function bonusForFixtureFromExplain(liveRow, fixtureId) {
  const fid = Number(fixtureId);
  if (!Number.isFinite(fid)) return null;
  const ex = liveRow?.explain;
  if (!Array.isArray(ex) || ex.length === 0) return null;
  const first = ex[0];

  const scanStats = (statsArr) => {
    let found = null;
    for (const s of statsArr || []) {
      const id = s.identifier ?? s.stat;
      if (id !== 'bonus') continue;
      found = (found ?? 0) + (Number(s.value) || 0);
    }
    return found;
  };

  if (Array.isArray(first) && first.length === 2 && typeof first[1] === 'number') {
    for (const pair of ex) {
      const [statList, f] = pair;
      if (Number(f) !== fid) continue;
      const r = scanStats(statList);
      if (r != null) return r;
    }
    return null;
  }

  if (first && first.fixture != null) {
    for (const block of ex) {
      if (Number(block.fixture) !== fid) continue;
      const r = scanStats(block.stats);
      if (r != null) return r;
    }
  }
  return null;
}

/**
 * Official bonus slate from classic `fixtures[]`.stats (`identifier: "bonus"`).
 * @param {object | null | undefined} fx
 * @returns {Map<number, number>}
 */
export function officialBonusFromFixtureStats(fx) {
  const m = new Map();
  const blocks = fx?.stats;
  if (!Array.isArray(blocks)) return m;
  for (const block of blocks) {
    if ((block?.identifier ?? block?.stat) !== 'bonus') continue;
    for (const side of ['h', 'a']) {
      for (const row of block[side] || []) {
        const id = Number(row.element);
        const val = Number(row.value) || 0;
        if (!Number.isFinite(id) || val <= 0) continue;
        m.set(id, (m.get(id) || 0) + val);
      }
    }
  }
  return m;
}

/**
 * Sum official fixture-stats bonus per element across the GW.
 * @param {object[]} gwFixtures
 * @returns {Map<number, number>}
 */
export function officialGwBonusByElementId(gwFixtures) {
  const m = new Map();
  for (const fx of gwFixtures || []) {
    for (const [id, pts] of officialBonusFromFixtureStats(fx)) {
      m.set(id, (m.get(id) || 0) + pts);
    }
  }
  return m;
}

/**
 * True once FPL has published official bonus for this fixture — the 3/2/1
 * slate on `fixtures[].stats`, a live `explain` bonus line, or (single-fixture
 * GW) a teammate/opponent with `stats.bonus > 0`.
 *
 * BPS estimates must not keep awarding medals to everyone else after that
 * (Collins still on a BPS +2 after Schade’s official 3).
 *
 * @param {object} fx
 * @param {object[]} bootElements
 * @param {Record<number, object>} liveFullByElementId
 * @param {object[]} gwFixtures
 */
export function fixtureHasOfficialBonus(
  fx,
  bootElements,
  liveFullByElementId,
  gwFixtures
) {
  if (officialBonusFromFixtureStats(fx).size > 0) return true;
  const fid = Number(fx?.id);
  const fh = Number(fx?.team_h);
  const fa = Number(fx?.team_a);
  if (!Number.isFinite(fid) || !Number.isFinite(fh) || !Number.isFinite(fa)) {
    return false;
  }

  for (const el of bootElements || []) {
    const tid = Number(el.team);
    if (tid !== fh && tid !== fa) continue;
    const id = Number(el.id);
    const liveRow = liveFullByElementId?.[id];
    if (!liveRow) continue;

    const fromExplain = bonusForFixtureFromExplain(liveRow, fid);
    if (typeof fromExplain === 'number' && fromExplain > 0) return true;

    const api = Number(liveRow?.stats?.bonus) || 0;
    if (api <= 0) continue;
    const played = participatingFixtureIdsForElement(el, liveRow, gwFixtures);
    if (played.length === 1 && played[0] === fid) return true;
    if (played.length === 0) {
      const tf = fixturesForTeamInGw(gwFixtures, tid);
      if (tf.length === 1 && Number(tf[0].id) === fid) return true;
    }
  }
  return false;
}

/**
 * Sum provisional bonus per element across all fixtures in the GW.
 *
 * Skips fixtures that already have an official bonus slate so BPS ranks
 * cannot overwrite or sit alongside confirmed medals.
 *
 * @param {object[]} bootElements — bootstrap.elements
 * @param {Record<number, object>} liveFullByElementId — id → full live row
 * @param {object[]} gwFixtures — fixtures for this event only
 * @returns {Map<number, number>}
 */
export function computeProvisionalGwBonusByElementId(
  bootElements,
  liveFullByElementId,
  gwFixtures
) {
  const provisional = new Map();

  for (const fx of gwFixtures) {
    const fh = Number(fx.team_h);
    const fa = Number(fx.team_a);
    if (!Number.isFinite(fh) || !Number.isFinite(fa)) continue;
    if (fixtureHasOfficialBonus(fx, bootElements, liveFullByElementId, gwFixtures)) {
      continue;
    }

    const pool = [];
    for (const el of bootElements || []) {
      const tid = Number(el.team);
      if (tid !== fh && tid !== fa) continue;
      const id = Number(el.id);
      const liveRow = liveFullByElementId[id];
      const bps = bpsForElementInFixture(el, liveRow, Number(fx.id), gwFixtures);
      if (bps == null) continue;
      pool.push({ id, bps });
    }

    if (!pool.length) continue;
    const alloc = bonusFromBpsGroups(groupByBpsDesc(pool));
    for (const [eid, pts] of alloc) {
      provisional.set(eid, (provisional.get(eid) || 0) + pts);
    }
  }

  return provisional;
}

/**
 * @param {number[]} fixtureIds
 * @param {Map<number, object>} fixtureById — id → fixture row
 */
export function allFixturesFinished(fixtureIds, fixtureById) {
  if (!fixtureIds.length) return false;
  return fixtureIds.every((id) => fixtureById.get(id)?.finished_provisional === true);
}

/**
 * One column: prefer FPL `stats.bonus` / fixture-stats slate once it is non-zero;
 * otherwise keep BPS-based projection while matches are live or in provisional
 * full-time. Once **all** of the player’s club’s GW fixtures are hard-finished
 * (`finished === true`) and FPL still reports `bonus === 0`, or official bonus
 * has already been posted on that fixture, stop showing stale BPS bonus.
 *
 * @param {number} apiBonus — stats.bonus or fixture-stats official value
 * @param {number} provisionalSum — sum across GW fixtures from BPS tiers
 * @param {{ trustApiZero?: boolean }} [opts]
 */
export function selectDisplayBonus(apiBonus, provisionalSum, opts = {}) {
  const api = Number(apiBonus);
  const safeApi = Number.isFinite(api) ? api : 0;
  if (safeApi > 0) return safeApi;
  if (opts.trustApiZero && safeApi === 0) return 0;
  const p = Number(provisionalSum);
  return Number.isFinite(p) ? p : 0;
}

/**
 * Apply the live Bonus column + fold it into `total_points`.
 * `bonusConfirmed` is true only when the displayed value comes from FPL’s
 * official bonus (player `stats.bonus` or fixture-stats slate), not a BPS guess.
 *
 * @param {object[]} rows
 * @param {Map<number, number>} provisionalByElement
 * @param {Record<number, object> | null | undefined} elementById
 * @param {object[]} gwFixtures
 * @param {Map<number, number>} [officialByElement] — fixture-stats slate
 * @returns {object[]}
 */
export function applyBonusColumn(
  rows,
  provisionalByElement,
  elementById,
  gwFixtures,
  officialByElement = new Map()
) {
  return (rows || []).map((r) => {
    const official = officialByElement.get(r.element);
    const apiBonus =
      official != null ? Number(official) || 0 : Number(r.bonusApi) || 0;
    const prov = provisionalByElement.get(r.element) ?? 0;
    const el = elementById?.[r.element];
    const trustApiZero =
      official != null ||
      (el != null &&
        gwTeamFixturesAllHardFinished(el.team, gwFixtures) &&
        apiBonus === 0);
    const display = selectDisplayBonus(apiBonus, prov, { trustApiZero });
    const bonusConfirmed = display > 0 && apiBonus === display;
    const total_points =
      Number(r.total_points) - (Number(r.bonusApi) || 0) + Number(display);
    return { ...r, bonus: display, bonusConfirmed, total_points };
  });
}

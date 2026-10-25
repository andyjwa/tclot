/**
 * "Game week closed" detection for the H2H league.
 *
 * FPL Draft only flips `details.matches[].finished` (and the event-level
 * `finished` / `data_checked` flags) after its post-gameweek "data checked" step,
 * which lags the actual football by many hours — sometimes more than a day. Every
 * results / standings / form / schedule path in the app gates on
 * `m.finished === true`, so in that gap a closed gameweek renders as if nothing
 * happened: no scores, no standings movement, no form update.
 *
 * These helpers bridge that gap. A gameweek's H2H matches are treated as
 * effectively final as soon as all of that GW's Premier League fixtures are
 * complete — `finished` OR `finished_provisional` in the classic `fixtures.json` —
 * but only once official `standings.points_for` has absorbed the gameweek.
 * Until then the draft match row is often still Saturday's total (Sunday's
 * points never landed). Promoting that row freezes the scoreboard and the
 * table on the leftover. Leave it unfinished so Live keeps the player feed.
 * When the table is already ahead of those leftovers, lift the scoreline up
 * to official FOR before deriving.
 */

/**
 * Event ids FPL has already marked `finished` on draft/classic bootstrap.
 * The brand header uses this same flag for "GW N complete", so standings and
 * recaps must honour it even when a stale `fixtures.json` still has one
 * Monday-night row as not started.
 *
 * @param {object | object[] | null | undefined} bootstrapOrEvents
 *   `bootstrap-static` / `bootstrap_draft.json`, `{ data: [] }`, or a bare list.
 * @returns {Set<number>}
 */
export function finishedEventIdsFromEvents(bootstrapOrEvents) {
  const ev = bootstrapOrEvents?.events ?? bootstrapOrEvents;
  const list = Array.isArray(ev) ? ev : Array.isArray(ev?.data) ? ev.data : [];
  const out = new Set();
  for (const e of list) {
    if (e?.finished !== true) continue;
    const id = Number(e?.id);
    if (Number.isFinite(id) && id >= 1) out.add(id);
  }
  return out;
}

/**
 * GW ids whose Premier League football is complete: the GW has at least one
 * fixture and every fixture for it is finished or provisionally finished.
 *
 * Optional `extraFinishedGws` (typically {@link finishedEventIdsFromEvents})
 * is unioned in so a live `events[].finished` flag can close a week when the
 * ingested fixture list is still a few hours behind.
 *
 * @param {object[] | null | undefined} fixtures Classic `fixtures.json` array.
 * @param {Iterable<number> | null | undefined} extraFinishedGws
 * @returns {Set<number>}
 */
export function completedFootballGameweeks(fixtures, extraFinishedGws) {
  const byGw = new Map();
  for (const f of Array.isArray(fixtures) ? fixtures : []) {
    const ev = Number(f?.event);
    if (!Number.isFinite(ev) || ev < 1) continue;
    const done = f?.finished === true || f?.finished_provisional === true;
    const prevAllDone = byGw.get(ev);
    byGw.set(ev, prevAllDone === undefined ? done : prevAllDone && done);
  }
  const out = new Set();
  for (const [ev, allDone] of byGw) {
    if (allDone) out.add(ev);
  }
  if (extraFinishedGws) {
    for (const raw of extraFinishedGws) {
      const ev = Number(raw);
      if (Number.isFinite(ev) && ev >= 1) out.add(ev);
    }
  }
  return out;
}

/**
 * Whether one H2H match should count as final for results / standings / form.
 *
 * True when FPL already marked it finished, or when its gameweek's football is
 * complete and both sides carry finite points (guards against unplayed rows).
 *
 * @param {object} m A `details.matches[]` row.
 * @param {Set<number>} completedGws Output of {@link completedFootballGameweeks}.
 * @returns {boolean}
 */
export function matchEffectivelyFinished(m, completedGws) {
  if (!m) return false;
  if (m.finished === true) return true;
  if (!(completedGws instanceof Set)) return false;
  if (!completedGws.has(Number(m.event))) return false;
  if (m.started !== true) return false;
  const p1 = Number(m.league_entry_1_points);
  const p2 = Number(m.league_entry_2_points);
  return Number.isFinite(p1) && Number.isFinite(p2);
}

/**
 * Return the matches array with `finished` promoted to `true` for every row whose
 * gameweek has effectively closed. Rows that are already finished (or not yet
 * complete) are returned unchanged, so the result is safe to feed to every
 * existing consumer of `details.matches`.
 *
 * @param {object[] | null | undefined} matches `details.matches` array.
 * @param {object[] | null | undefined} fixtures Classic `fixtures.json` array.
 * @param {Iterable<number> | null | undefined} extraFinishedGws
 *   Bootstrap event ids already marked finished (see {@link finishedEventIdsFromEvents}).
 * @returns {object[]}
 */
export function normalizeMatchesFinished(matches, fixtures, extraFinishedGws) {
  const list = Array.isArray(matches) ? matches : [];
  const completed = completedFootballGameweeks(fixtures, extraFinishedGws);
  if (completed.size === 0) return list;
  return list.map((m) =>
    m && m.finished !== true && matchEffectivelyFinished(m, completed)
      ? { ...m, finished: true }
      : m,
  );
}

function matchPairKey(m) {
  const ev = Number(m?.event);
  const a = Number(m?.league_entry_1);
  const b = Number(m?.league_entry_2);
  const lo = a < b ? a : b;
  const hi = a < b ? b : a;
  return `${ev}:${lo}-${hi}`;
}

/**
 * Undo promotions whose points the official table has not absorbed.
 *
 * Football being over is not enough. Draft `league_entry_*_points` often stop
 * at Saturday while Sunday's returns are already in `event/live`. Marking
 * those rows finished makes the scoreboard and the derived table prefer the
 * leftover (higher than last week's FOR, so the merge keeps it) and Live
 * stops adding the player feed.
 *
 * A promotion stays only when each side's points fit in the gap between
 * official `points_for` and the matches FPL itself already marked finished.
 * {@link reconcileMatchPointsFromStandings} then tops a short scoreline up
 * to that official total.
 *
 * @param {object[] | null | undefined} originalMatches Rows before promotion
 *   (`finished` still as FPL sent it).
 * @param {object[] | null | undefined} promotedMatches Rows after promotion
 *   and the official-FOR lift.
 * @param {object[] | null | undefined} officialStandings
 * @returns {object[]}
 */
export function dropUnconfirmedMatchPromotions(
  originalMatches,
  promotedMatches,
  officialStandings,
) {
  const original = Array.isArray(originalMatches) ? originalMatches : [];
  const promoted = Array.isArray(promotedMatches) ? promotedMatches : [];
  if (!promoted.length) return promoted;
  if (!Array.isArray(officialStandings) || officialStandings.length === 0) {
    return promoted;
  }

  const officialPf = new Map();
  for (const s of officialStandings) {
    const id = Number(s.league_entry);
    if (!Number.isFinite(id)) continue;
    officialPf.set(id, Number(s.points_for) || 0);
  }

  const originalByKey = new Map();
  for (const m of original) {
    if (!m) continue;
    originalByKey.set(matchPairKey(m), m);
  }

  /** @type {number[]} */
  const promotedEvents = [];
  for (const m of promoted) {
    if (!m || m.finished !== true) continue;
    const prev = originalByKey.get(matchPairKey(m));
    if (prev && prev.finished === true) continue;
    const ev = Number(m.event);
    if (!Number.isFinite(ev) || promotedEvents.includes(ev)) continue;
    promotedEvents.push(ev);
  }
  if (promotedEvents.length === 0) return promoted;
  promotedEvents.sort((a, b) => a - b);

  const basePf = pointsForFromFinishedMatches(
    original.filter((m) => m?.finished === true),
  );
  const headroom = new Map();
  for (const id of new Set([...officialPf.keys(), ...basePf.keys()])) {
    const room = (officialPf.get(id) || 0) - (basePf.get(id) || 0);
    headroom.set(id, room > 0 ? room : 0);
  }

  const revert = new Set();
  for (const ev of promotedEvents) {
    const rows = promoted.filter(
      (m) => m?.finished === true && Number(m.event) === ev,
    );
    const add = new Map();
    for (const m of rows) {
      const id1 = Number(m.league_entry_1);
      const id2 = Number(m.league_entry_2);
      const p1 = Number(m.league_entry_1_points) || 0;
      const p2 = Number(m.league_entry_2_points) || 0;
      if (Number.isFinite(id1)) add.set(id1, (add.get(id1) || 0) + p1);
      if (Number.isFinite(id2)) add.set(id2, (add.get(id2) || 0) + p2);
    }
    let fits = true;
    for (const [id, pts] of add) {
      if (pts > (headroom.get(id) || 0)) {
        fits = false;
        break;
      }
    }
    const anyPoints = [...add.values()].some((n) => n > 0);
    const anyRoom = [...add.keys()].some((id) => (headroom.get(id) || 0) > 0);
    if (!fits || (!anyPoints && !anyRoom)) {
      revert.add(ev);
      continue;
    }
    for (const [id, pts] of add) {
      headroom.set(id, (headroom.get(id) || 0) - pts);
    }
  }
  if (revert.size === 0) return promoted;

  return promoted.map((m) => {
    if (!m || !revert.has(Number(m.event))) return m;
    const prev = originalByKey.get(matchPairKey(m));
    if (prev && prev.finished === true) return m;
    return prev ? { ...prev } : { ...m, finished: false };
  });
}

/**
 * Official FPL Draft H2H order: league points, then game points (points for).
 * Draft help: "If teams are level on league points … the team with the most
 * game points will be positioned higher." There is no points-against / GD
 * step — remaining ties share a rank in the official app, and we list them
 * A–Z by team name so the table matches that display (GW3: Seoul, Suffolk,
 * Toronto — not Suffolk first on a better PA).
 *
 * @param {number} aPts
 * @param {number} bPts
 * @param {number} aFor
 * @param {number} bFor
 * @param {string | null | undefined} aName
 * @param {string | null | undefined} bName
 * @returns {number}
 */
export function compareH2hStandingsKeys(aPts, bPts, aFor, bFor, aName, bName) {
  const pts = (Number(bPts) || 0) - (Number(aPts) || 0);
  if (pts !== 0) return pts;
  const pf = (Number(bFor) || 0) - (Number(aFor) || 0);
  if (pf !== 0) return pf;
  return String(aName ?? '').localeCompare(String(bName ?? ''), 'en', {
    sensitivity: 'base',
  });
}

/**
 * In-place official H2H sort. `getName(row)` supplies the A–Z key after PTS/PF.
 *
 * @param {object[]} rows
 * @param {(row: object) => string | null | undefined} [getName]
 * @returns {object[]}
 */
export function sortH2hStandingsRows(rows, getName) {
  const nameOf =
    typeof getName === 'function' ? getName : (r) => r?.teamName ?? r?.entry_name;
  rows.sort((a, b) =>
    compareH2hStandingsKeys(
      a.total,
      b.total,
      a.points_for,
      b.points_for,
      nameOf(a),
      nameOf(b),
    ),
  );
  return rows;
}

/**
 * Rebuild H2H standings rows from finished matches (official PTS → PF → name
 * order, same as `useLeagueData.deriveStandingsFromMatches`). Used at build
 * time so `details.json` standings are not left as FPL's all-zero / stale
 * snapshot after we promote `matches[].finished`.
 *
 * @param {object[]} leagueEntries
 * @param {object[]} matches Normalized matches (with effective `finished`).
 * @returns {object[]}
 */
export function deriveStandingsFromFinishedMatches(leagueEntries, matches) {
  const idSet = new Set();
  for (const e of leagueEntries || []) {
    if (e?.id != null) idSet.add(e.id);
  }
  for (const m of matches || []) {
    if (!m?.finished) continue;
    idSet.add(m.league_entry_1);
    idSet.add(m.league_entry_2);
  }
  const ids = [...idSet].filter((x) => x != null).sort((a, b) => a - b);
  if (ids.length === 0) return [];

  const st = Object.fromEntries(
    ids.map((id) => [id, { league_entry: id, w: 0, d: 0, l: 0, pf: 0, pa: 0 }]),
  );
  for (const m of matches || []) {
    if (!m?.finished) continue;
    const id1 = m.league_entry_1;
    const id2 = m.league_entry_2;
    const p1 = m.league_entry_1_points ?? 0;
    const p2 = m.league_entry_2_points ?? 0;
    if (!st[id1] || !st[id2]) continue;
    st[id1].pf += p1;
    st[id1].pa += p2;
    st[id2].pf += p2;
    st[id2].pa += p1;
    if (p1 > p2) {
      st[id1].w += 1;
      st[id2].l += 1;
    } else if (p2 > p1) {
      st[id2].w += 1;
      st[id1].l += 1;
    } else {
      st[id1].d += 1;
      st[id2].d += 1;
    }
  }
  const nameById = new Map();
  for (const e of leagueEntries || []) {
    if (e?.id != null) nameById.set(e.id, e.entry_name ?? '');
  }
  const rows = ids.map((id) => {
    const s = st[id];
    const total = s.w * 3 + s.d;
    return {
      league_entry: id,
      rank: 0,
      total,
      matches_won: s.w,
      matches_drawn: s.d,
      matches_lost: s.l,
      matches_played: s.w + s.d + s.l,
      points_for: s.pf,
      points_against: s.pa,
    };
  });
  sortH2hStandingsRows(
    rows,
    (r) => nameById.get(r.league_entry) || `Team ${r.league_entry}`,
  );
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });
  return rows;
}

/**
 * Official FPL Draft H2H order: league PTS, then FOR (game points), then
 * team name A–Z. Draft help does not use points against / GD / waivers —
 * the official app lists a 3pts/131 PF three-way Seoul, Suffolk, Toronto.
 */
export function compareStandingsRows(a, b) {
  return compareH2hStandingsKeys(
    a.total,
    b.total,
    a.points_for,
    b.points_for,
    a.teamName ?? a.entry_name,
    b.teamName ?? b.entry_name,
  );
}

export function pointsForFromFinishedMatches(matches) {
  const pf = new Map();
  for (const m of matches || []) {
    if (!m?.finished) continue;
    const id1 = Number(m.league_entry_1);
    const id2 = Number(m.league_entry_2);
    pf.set(id1, (pf.get(id1) || 0) + (Number(m.league_entry_1_points) || 0));
    pf.set(id2, (pf.get(id2) || 0) + (Number(m.league_entry_2_points) || 0));
  }
  return pf;
}

export function latestFinishedEvent(matches) {
  let latest = 0;
  for (const m of matches || []) {
    if (m?.finished) latest = Math.max(latest, Number(m.event) || 0);
  }
  return latest;
}

/**
 * When official `standings.points_for` is ahead of summed H2H leftovers,
 * add the missing points onto the latest finished GW so FOR, recap, form,
 * and PA stay in lockstep with the draft website.
 *
 * @param {object[]} matches
 * @param {object[] | null | undefined} officialStandings
 * @returns {object[]}
 */
export function reconcileMatchPointsFromStandings(matches, officialStandings) {
  const list = Array.isArray(matches) ? matches : [];
  if (!list.length || !Array.isArray(officialStandings) || officialStandings.length === 0) {
    return list;
  }
  const derivedPf = pointsForFromFinishedMatches(list);
  const delta = new Map();
  for (const s of officialStandings) {
    const id = Number(s.league_entry);
    if (!Number.isFinite(id)) continue;
    const extra = (Number(s.points_for) || 0) - (derivedPf.get(id) || 0);
    if (extra > 0) delta.set(id, extra);
  }
  if (delta.size === 0) return list;
  const latest = latestFinishedEvent(list);
  if (!latest) return list;

  let changed = false;
  const out = list.map((m) => {
    if (!m?.finished || Number(m.event) !== latest) return m;
    const d1 = delta.get(Number(m.league_entry_1)) || 0;
    const d2 = delta.get(Number(m.league_entry_2)) || 0;
    if (!d1 && !d2) return m;
    changed = true;
    return {
      ...m,
      league_entry_1_points: (Number(m.league_entry_1_points) || 0) + d1,
      league_entry_2_points: (Number(m.league_entry_2_points) || 0) + d2,
    };
  });
  return changed ? out : list;
}

/**
 * Per-match max() of static ingest vs a live `league/{id}/details` fetch so a
 * stale Vercel bake cannot keep Saturday leftovers on screen.
 */
export function overlayFresherMatchPoints(baseMatches, liveMatches) {
  const base = Array.isArray(baseMatches) ? baseMatches : [];
  if (!Array.isArray(liveMatches) || liveMatches.length === 0) return base;
  const liveByPair = new Map();
  for (const m of liveMatches) {
    const ev = Number(m?.event);
    const a = Number(m?.league_entry_1);
    const b = Number(m?.league_entry_2);
    if (!Number.isFinite(ev) || !Number.isFinite(a) || !Number.isFinite(b)) continue;
    const key = `${ev}:${a < b ? `${a}-${b}` : `${b}-${a}`}`;
    liveByPair.set(key, m);
  }
  let changed = false;
  const out = base.map((m) => {
    const ev = Number(m?.event);
    const a = Number(m?.league_entry_1);
    const b = Number(m?.league_entry_2);
    const live = liveByPair.get(`${ev}:${a < b ? `${a}-${b}` : `${b}-${a}`}`);
    if (!live) return m;
    const same = Number(live.league_entry_1) === a;
    const liveP1 = Number(same ? live.league_entry_1_points : live.league_entry_2_points);
    const liveP2 = Number(same ? live.league_entry_2_points : live.league_entry_1_points);
    const baseP1 = Number(m.league_entry_1_points) || 0;
    const baseP2 = Number(m.league_entry_2_points) || 0;
    const p1 = Number.isFinite(liveP1) ? Math.max(baseP1, liveP1) : baseP1;
    const p2 = Number.isFinite(liveP2) ? Math.max(baseP2, liveP2) : baseP2;
    const finished = m.finished === true || live.finished === true;
    const started = m.started === true || live.started === true;
    if (
      p1 === baseP1 &&
      p2 === baseP2 &&
      finished === Boolean(m.finished) &&
      started === Boolean(m.started)
    ) {
      return m;
    }
    changed = true;
    return {
      ...m,
      league_entry_1_points: p1,
      league_entry_2_points: p2,
      finished,
      started,
    };
  });
  return changed ? out : base;
}

/** Per team, keep the snapshot with the higher FOR (website-fresh). */
export function mergeStandingsPreferringHigherFor(a, b) {
  const mapA = new Map((Array.isArray(a) ? a : []).map((s) => [Number(s.league_entry), s]));
  const mapB = new Map((Array.isArray(b) ? b : []).map((s) => [Number(s.league_entry), s]));
  const ids = new Set([...mapA.keys(), ...mapB.keys()]);
  const rows = [];
  for (const id of ids) {
    if (!Number.isFinite(id)) continue;
    const sa = mapA.get(id);
    const sb = mapB.get(id);
    if (!sa) {
      rows.push({ ...sb });
      continue;
    }
    if (!sb) {
      rows.push({ ...sa });
      continue;
    }
    const pfa = Number(sa.points_for) || 0;
    const pfb = Number(sb.points_for) || 0;
    const fresher = pfb > pfa ? sb : sa;
    rows.push({
      ...fresher,
      points_for: Math.max(pfa, pfb),
      points_against: Math.max(Number(sa.points_against) || 0, Number(sb.points_against) || 0),
    });
  }
  rows.sort(compareStandingsRows);
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });
  return rows;
}

/**
 * One pipeline: overlay live details → promote finished → lift leftover
 * scores to official FOR → derive the table.
 */
export function applyLeagueResults(details, fixtures, extraFinishedGws, liveDetails) {
  const baseMatches = overlayFresherMatchPoints(details?.matches, liveDetails?.matches);
  const official = mergeStandingsPreferringHigherFor(
    details?.standings,
    liveDetails?.standings,
  );
  const promoted = normalizeMatchesFinished(baseMatches, fixtures, extraFinishedGws);
  const reconciled = reconcileMatchPointsFromStandings(promoted, official);
  const matches = dropUnconfirmedMatchPromotions(baseMatches, reconciled, official);
  const derived = deriveStandingsFromFinishedMatches(details?.league_entries, matches);
  const standings =
    derived.length > 0 ? mergeStandingsPreferringHigherFor(derived, official) : official;
  const nameById = new Map();
  for (const e of details?.league_entries || []) {
    if (e?.id != null) nameById.set(e.id, e.entry_name ?? '');
  }
  if (nameById.size > 0 && standings.length > 0) {
    sortH2hStandingsRows(
      standings,
      (r) => nameById.get(r.league_entry) || r.teamName || r.entry_name,
    );
    standings.forEach((r, i) => {
      r.rank = i + 1;
    });
  }
  return { matches, standings };
}

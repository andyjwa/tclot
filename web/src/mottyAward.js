/**
 * The Motty — a win that only exists because a bench player came in.
 *
 * A side qualifies when all three are true:
 *   1. They are ahead on the score shown for the fixture.
 *   2. At least one bench player has been autosubbed in (official when
 *      FPL has posted it, otherwise the projected sub the lineup is
 *      already showing) and those players have scored points.
 *   3. Subtracting those bench points leaves them level or behind.
 *      Without the bench they would not have won.
 */

/**
 * Autosubs the squad is currently displaying: official first, then the
 * projected list used when FPL has not posted subs yet.
 *
 * @param {object | null | undefined} squad
 * @returns {Array<{ element_in?: number, element_out?: number }>}
 */
export function activeAutoSubs(squad) {
  if (!squad || squad.error) return [];
  if (squad.autosubSource === 'official' && squad.autoSubs?.length) {
    return squad.autoSubs;
  }
  if (squad.autosubSource === 'projected' && squad.projectedAutoSubs?.length) {
    return squad.projectedAutoSubs;
  }
  return [];
}

/**
 * Points banked by players who came off the bench. Uses each row's
 * `total_points`, which already includes the captain multiplier, so a
 * vice-captain who inherited the armband is counted at the points that
 * actually hit the total.
 *
 * @param {object | null | undefined} squad
 * @returns {number}
 */
export function benchComeInPoints(squad) {
  const subs = activeAutoSubs(squad);
  if (!subs.length) return 0;
  const byEl = new Map();
  for (const r of [
    ...(squad.starters || []),
    ...(squad.bench || []),
    ...(squad.displayStarters || []),
  ]) {
    const id = Number(r?.element);
    if (Number.isFinite(id) && !byEl.has(id)) byEl.set(id, r);
  }
  let sum = 0;
  const seen = new Set();
  for (const s of subs) {
    const id = Number(s.element_in);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    sum += Number(byEl.get(id)?.total_points) || 0;
  }
  return sum;
}

/**
 * @param {object | null | undefined} squad
 * @param {number | null | undefined} ownPts
 * @param {number | null | undefined} oppPts
 * @returns {boolean}
 */
export function isMottyWin(squad, ownPts, oppPts) {
  const own = Number(ownPts);
  const opp = Number(oppPts);
  if (!Number.isFinite(own) || !Number.isFinite(opp) || !(own > opp)) return false;
  const benchPts = benchComeInPoints(squad);
  if (!(benchPts > 0)) return false;
  return own - benchPts <= opp;
}

/**
 * @param {Array<{ homeId?: number, awayId?: number, homeSquad?: object, awaySquad?: object, homeLive?: number, awayLive?: number, homePts?: number, awayPts?: number }>} fixtures
 * @returns {Set<number>}
 */
export function mottyEntryIdsFromFixtures(fixtures) {
  const out = new Set();
  for (const f of fixtures || []) {
    const homeId = Number(f.homeId);
    const awayId = Number(f.awayId);
    const homePts = f.homeLive ?? f.homePts;
    const awayPts = f.awayLive ?? f.awayPts;
    if (Number.isFinite(homeId) && isMottyWin(f.homeSquad, homePts, awayPts)) {
      out.add(homeId);
    }
    if (Number.isFinite(awayId) && isMottyWin(f.awaySquad, awayPts, homePts)) {
      out.add(awayId);
    }
  }
  return out;
}

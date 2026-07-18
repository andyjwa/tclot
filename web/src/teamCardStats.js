/**
 * Team-card stat computation — ported verbatim from the approved mockup
 * (`web/public/team-card-options.html`) so the production team card renders
 * exactly the numbers that were signed off.
 *
 * All stats are derived from raw league entries + finished H2H matches
 * (the same `leagueEntries` / `matches` that `useLeagueData` already exposes),
 * keeping this module free of any fetch/side-effect concerns.
 */

/** Win/loss margin → bucket key (mockup scheme: 1 / 2 / 3-5 / 6-10 / 10+). */
function bucket(m) {
  if (m === 1) return '1'
  if (m === 2) return '2'
  if (m >= 3 && m <= 5) return '3-5'
  if (m >= 6 && m <= 10) return '6-10'
  return '10+'
}

export const MARGIN_BUCKET_KEYS = ['1', '2', '3-5', '6-10', '10+']
export const MARGIN_BUCKET_LABELS = {
  '1': 'by 1',
  '2': 'by 2',
  '3-5': 'by 3-5',
  '6-10': 'by 6-10',
  '10+': 'by 10+',
}

const STREAK_LABEL = { W: 'Win streak', L: 'Loss streak', D: 'Draw streak' }

/** English ordinal, e.g. 1 → "1st", 3 → "3rd". */
export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/** Trailing run of identical results at the end of the season (seq is GW order). */
export function currentStreak(rawSeq) {
  const seq = [...(rawSeq || [])].sort((a, b) => a.gw - b.gw)
  if (!seq.length) return { n: 0, res: null, label: 'Streak' }
  const last = seq[seq.length - 1].res
  let n = 0
  for (let i = seq.length - 1; i >= 0; i--) {
    if (seq[i].res === last) n++
    else break
  }
  return {
    n,
    res: last,
    label: STREAK_LABEL[last] || 'Streak',
    fromGw: seq[seq.length - n].gw,
    toGw: seq[seq.length - 1].gw,
  }
}

/**
 * Compute every team-card figure from league entries + matches.
 *
 * @param {object[]} leagueEntries Raw `details.league_entries`.
 * @param {object[]} allMatches Raw `details.matches` (finished + upcoming).
 */
export function computeTeamCardData(leagueEntries, allMatches) {
  const entries = Array.isArray(leagueEntries) ? leagueEntries : []
  if (!entries.length) return null
  const matches = (Array.isArray(allMatches) ? allMatches : []).filter((m) => m.finished)

  const idToName = {}
  const idToMgr = {}
  const idToShort = {}
  for (const e of entries) {
    idToName[e.id] = e.entry_name
    idToMgr[e.id] = `${e.player_first_name ?? ''} ${e.player_last_name ?? ''}`.trim()
    idToShort[e.id] = e.short_name
  }
  const ids = entries.map((e) => e.id)

  const gwPts = {}
  const gwOpp = {}
  for (const id of ids) {
    gwPts[id] = {}
    gwOpp[id] = {}
  }

  const S = {}
  for (const id of ids) {
    S[id] = {
      id,
      name: idToName[id],
      mgr: idToMgr[id],
      w: 0,
      d: 0,
      l: 0,
      pf: 0,
      pa: 0,
      high: -1,
      highGw: 0,
      highOpp: null,
      low: 999,
      lowGw: 0,
      bwM: -1,
      bwGw: 0,
      bwOpp: null,
      bwSc: '',
      blM: -1,
      blGw: 0,
      blOpp: null,
      blSc: '',
      mw: { '1': 0, '2': 0, '3-5': 0, '6-10': 0, '10+': 0 },
      ml: { '1': 0, '2': 0, '3-5': 0, '6-10': 0, '10+': 0 },
      seq: [],
    }
  }

  for (const m of matches) {
    const a = m.league_entry_1
    const b = m.league_entry_2
    const pa = m.league_entry_1_points
    const pb = m.league_entry_2_points
    const gw = m.event
    for (const [me, opp, my, op] of [
      [a, b, pa, pb],
      [b, a, pb, pa],
    ]) {
      const s = S[me]
      if (!s) continue
      s.pf += my
      s.pa += op
      gwPts[me][gw] = my
      gwOpp[me][gw] = op
      if (my > s.high) {
        s.high = my
        s.highGw = gw
        s.highOpp = opp
      }
      if (my < s.low) {
        s.low = my
        s.lowGw = gw
      }
      let res
      if (my > op) {
        res = 'W'
        s.w++
        const mg = my - op
        s.mw[bucket(mg)]++
        if (mg > s.bwM) {
          s.bwM = mg
          s.bwGw = gw
          s.bwOpp = opp
          s.bwSc = `${my}\u2013${op}`
        }
      } else if (my < op) {
        res = 'L'
        s.l++
        const mg = op - my
        s.ml[bucket(mg)]++
        if (mg > s.blM) {
          s.blM = mg
          s.blGw = gw
          s.blOpp = opp
          s.blSc = `${my}\u2013${op}`
        }
      } else {
        res = 'D'
        s.d++
      }
      s.seq.push({ gw, res, me: my, opp: op, oppId: opp })
    }
  }

  /** Counterfactual league points if this team had played `ow`'s schedule. */
  function lp(sq, ow) {
    let w = 0
    let d = 0
    for (const gw of Object.keys(gwOpp[ow])) {
      const my = gwPts[sq][gw]
      const op = gwOpp[ow][gw]
      if (my == null || op == null) continue
      if (my > op) w++
      else if (my === op) d++
    }
    return w * 3 + d
  }

  const luck = {}
  for (const id of ids) {
    let sum = 0
    for (const ow of ids) sum += lp(id, ow)
    const avg = sum / ids.length
    luck[id] = { actual: S[id].w * 3 + S[id].d, avg, delta: S[id].w * 3 + S[id].d - avg }
  }
  const luckRank = [...ids].sort((x, y) => luck[y].delta - luck[x].delta)
  const luckIdx = {}
  luckRank.forEach((id, i) => (luckIdx[id] = i + 1))

  const table = [...ids].sort((x, y) => {
    const tx = S[x].w * 3 + S[x].d
    const ty = S[y].w * 3 + S[y].d
    return ty - tx || S[y].pf - S[x].pf || S[x].pa - S[y].pa
  })
  const rankOf = {}
  table.forEach((id, i) => (rankOf[id] = i + 1))

  /*
   * Hero defeats / Villain victories — canonical site definition from
   * gwRawPointsRankSeason.js. Per GW, rank all teams by raw points (desc, ties
   * broken by lower id) into ordinals 1..N.
   *  - Hero defeat  = ordinal === 2 (2nd-highest scorer that GW) AND lost its H2H.
   *  - Villain victory = ordinal === 7 (2nd-lowest scorer that GW) AND won its H2H.
   */
  const heroDef = {}
  const vilVic = {}
  for (const id of ids) {
    heroDef[id] = 0
    vilVic[id] = 0
  }
  {
    const byEvent = {}
    for (const m of matches) (byEvent[m.event] || (byEvent[m.event] = [])).push(m)
    for (const ev of Object.keys(byEvent)) {
      const gwMatches = byEvent[ev]
      const pts = new Map()
      for (const m of gwMatches) {
        pts.set(Number(m.league_entry_1), Number(m.league_entry_1_points) || 0)
        pts.set(Number(m.league_entry_2), Number(m.league_entry_2_points) || 0)
      }
      const rows = [...pts.entries()].map(([id, p]) => ({ id, p }))
      rows.sort((x, y) => y.p - x.p || x.id - y.id)
      const ord = new Map()
      rows.forEach((r, i) => ord.set(r.id, i + 1))
      for (const m of gwMatches) {
        const hId = Number(m.league_entry_1)
        const aId = Number(m.league_entry_2)
        const h = m.league_entry_1_points
        const a = m.league_entry_2_points
        if (h < a) {
          if (ord.get(hId) === 2) heroDef[hId]++
        } else if (a < h) {
          if (ord.get(aId) === 2) heroDef[aId]++
        }
        if (h > a) {
          if (ord.get(hId) === 7) vilVic[hId]++
        } else if (a > h) {
          if (ord.get(aId) === 7) vilVic[aId]++
        }
      }
    }
  }

  /** Per-opponent H2H aggregate for one team, sorted best net record first. */
  function rivalsFor(id) {
    const map = {}
    for (const o of ids) if (o !== id) map[o] = { w: 0, d: 0, l: 0, pf: 0, pa: 0 }
    for (const m of matches) {
      if (m.league_entry_1 !== id && m.league_entry_2 !== id) continue
      const f = m.league_entry_1 === id
      const opp = f ? m.league_entry_2 : m.league_entry_1
      const my = f ? m.league_entry_1_points : m.league_entry_2_points
      const op = f ? m.league_entry_2_points : m.league_entry_1_points
      const r = map[opp]
      if (!r) continue
      r.pf += my
      r.pa += op
      if (my > op) r.w++
      else if (my < op) r.l++
      else r.d++
    }
    const arr = Object.entries(map).map(([oid, r]) => ({
      oid: Number(oid),
      ...r,
      net: r.w - r.l,
    }))
    arr.sort((x, y) => y.net - x.net || y.pf - y.pa - (x.pf - x.pa))
    return arr
  }

  return {
    ids,
    table,
    rankOf,
    S,
    luck,
    luckIdx,
    heroDef,
    vilVic,
    idToName,
    idToMgr,
    idToShort,
    rivalsFor,
  }
}

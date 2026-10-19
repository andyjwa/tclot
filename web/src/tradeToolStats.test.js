import test from 'node:test'
import assert from 'node:assert/strict'
import {
  TRADE_MIN_STATS,
  TRADE_MAX_STATS,
  DEFAULT_TRADE_STAT_IDS,
  seasonShortLabel,
  normalizeTradeStatSelection,
  readTradeStat,
  indexElementsByCode,
  joinPriorByCode,
  seasonStatValue,
  aggregateSideStats,
  normalizeRadarPair,
  buildRadarAxes,
  radarVertex,
  polygonPath,
  formatTradeStat,
  toggleTradeStat,
  tradePositionCounts,
  tradeSideCovers,
  tradePositionsMatch,
  canAddTradePosition,
  missingTradePositions,
  formatTradePositionNeeds,
  filterSquadForTrade,
  filterSquadByPosition,
  filterSquadByQuery,
  applyTradePick,
  encodeTradeSource,
  parseTradeSource,
} from './tradeToolStats.js'

const CURRENT = {
  id: 10,
  code: 111,
  total_points: 24,
  goals_scored: 3,
  assists: 1,
  clean_sheets: 0,
  bonus: 4,
  expected_goals: '2.4',
  minutes: 270,
  saves: 0,
}

const PRIOR = {
  id: 77,
  code: 111,
  total_points: 180,
  goals_scored: 18,
  assists: 8,
  clean_sheets: 2,
  bonus: 12,
  expected_goals: '16.1',
  minutes: 3100,
  saves: 0,
}

test('seasonShortLabel — 2026-27 → 26/27', () => {
  assert.equal(seasonShortLabel('2026-27'), '26/27')
  assert.equal(seasonShortLabel('2025-26'), '25/26')
  assert.equal(seasonShortLabel(''), '')
})

test('normalizeTradeStatSelection — fills to min, caps at max, drops unknown', () => {
  assert.deepEqual(normalizeTradeStatSelection([]), DEFAULT_TRADE_STAT_IDS.slice(0, TRADE_MIN_STATS))
  assert.equal(normalizeTradeStatSelection(['pts', 'bogus', 'goals']).length >= TRADE_MIN_STATS, true)
  const tooMany = ['pts', 'goals', 'assists', 'cs', 'bonus', 'xg', 'xa', 'minutes', 'starts']
  assert.equal(normalizeTradeStatSelection(tooMany).length, TRADE_MAX_STATS)
})

test('readTradeStat — element fields, decimals, summary, save points', () => {
  assert.equal(readTradeStat(CURRENT, null, 'pts'), 24)
  assert.equal(readTradeStat(CURRENT, null, 'xg'), 2.4)
  assert.equal(readTradeStat(CURRENT, { gamesPlayed: 5, sixtyPlus: 4, defConHits: 1 }, 'gp'), 5)
  assert.equal(readTradeStat({ saves: 10 }, null, 'savePts'), 3)
  assert.equal(readTradeStat(null, null, 'pts'), 0)
})

test('joinPriorByCode — Opta code match, miss returns null', () => {
  const byCode = indexElementsByCode([PRIOR, { id: 1, code: 222, total_points: 9 }])
  assert.equal(joinPriorByCode(CURRENT, byCode), PRIOR)
  assert.equal(joinPriorByCode({ code: 999 }, byCode), null)
  assert.equal(joinPriorByCode({}, byCode), null)
})

test('seasonStatValue — current / prior / combined', () => {
  const cur = seasonStatValue(CURRENT, PRIOR, null, null, 'pts', 'current')
  assert.equal(cur.value, 24)
  const prior = seasonStatValue(CURRENT, PRIOR, null, null, 'pts', 'prior')
  assert.equal(prior.value, 180)
  const both = seasonStatValue(CURRENT, PRIOR, null, null, 'pts', 'combined')
  assert.equal(both.value, 204)
  const noPrior = seasonStatValue(CURRENT, null, null, null, 'pts', 'combined')
  assert.equal(noPrior.value, 24)
  assert.equal(noPrior.hasPrior, false)
  const priorMissing = seasonStatValue(CURRENT, null, null, null, 'pts', 'prior')
  assert.equal(priorMissing.value, 0)
})

test('aggregateSideStats — sums two players; missing prior skipped in prior mode', () => {
  const a = {
    currentEl: CURRENT,
    priorEl: PRIOR,
  }
  const b = {
    currentEl: { ...CURRENT, id: 11, code: 333, total_points: 10, goals_scored: 2 },
    priorEl: null,
  }
  const current = aggregateSideStats([a, b], ['pts', 'goals', 'assists'], 'current')
  assert.equal(current.pts, 34)
  assert.equal(current.goals, 5)
  const prior = aggregateSideStats([a, b], ['pts', 'goals', 'assists'], 'prior')
  assert.equal(prior.pts, 180)
  assert.equal(prior.goals, 18)
  const combined = aggregateSideStats([a, b], ['pts'], 'combined')
  assert.equal(combined.pts, 24 + 180 + 10)
})

test('normalizeRadarPair — leader on the rim; lower-is-better inverts', () => {
  assert.deepEqual(normalizeRadarPair(10, 5), { aNorm: 1, bNorm: 0.5 })
  assert.deepEqual(normalizeRadarPair(0, 0), { aNorm: 0, bNorm: 0 })
  const gc = normalizeRadarPair(2, 10, { lowerIsBetter: true })
  assert.ok(gc.aNorm > gc.bNorm)
  assert.equal(gc.bNorm, 0)
})

test('buildRadarAxes — delta positive when A leads; GC delta flips', () => {
  const axes = buildRadarAxes(
    ['pts', 'gc'],
    { pts: 40, gc: 2 },
    { pts: 10, gc: 8 },
  )
  const pts = axes.find((x) => x.id === 'pts')
  const gc = axes.find((x) => x.id === 'gc')
  assert.equal(pts.delta, 30)
  assert.equal(gc.lowerIsBetter, true)
  assert.equal(gc.delta, 6)
  assert.ok(pts.aNorm > pts.bNorm)
  assert.ok(gc.aNorm > gc.bNorm)
})

test('radarVertex — first axis is straight up; polygonPath closes', () => {
  const [x, y] = radarVertex(0, 6, 1, 200, 200, 100)
  assert.ok(Math.abs(x - 200) < 1e-6)
  assert.ok(Math.abs(y - 100) < 1e-6)
  const pts = [
    radarVertex(0, 4, 1, 0, 0, 10),
    radarVertex(1, 4, 1, 0, 0, 10),
    radarVertex(2, 4, 1, 0, 0, 10),
    radarVertex(3, 4, 1, 0, 0, 10),
  ]
  const d = polygonPath(pts)
  assert.match(d, /^M/)
  assert.match(d, /Z$/)
  assert.equal(polygonPath([]), '')
})

test('formatTradeStat — int vs one-decimal xG', () => {
  assert.equal(formatTradeStat('pts', 24), '24')
  assert.equal(formatTradeStat('xg', 2.41), '2.4')
  assert.equal(formatTradeStat('pts', Number.NaN), '—')
})

test('toggleTradeStat — respects min and max', () => {
  const minned = DEFAULT_TRADE_STAT_IDS.slice(0, TRADE_MIN_STATS)
  assert.deepEqual(toggleTradeStat(minned, minned[0]), minned)
  const added = toggleTradeStat(minned, 'xa')
  assert.ok(added.includes('xa'))
  const atMax = ['pts', 'goals', 'assists', 'cs', 'bonus', 'xg', 'xa', 'minutes']
  assert.equal(toggleTradeStat(atMax, 'starts').length, TRADE_MAX_STATS)
})

test('trade position counts — mixed sides must match as a multiset', () => {
  const midFwd = tradePositionCounts([
    { positionType: 3 },
    { positionType: 4 },
    { positionType: 3 },
  ])
  assert.deepEqual(midFwd, { 1: 0, 2: 0, 3: 2, 4: 1 })
  const other = tradePositionCounts([{ positionType: 3 }, { positionType: 4 }])
  assert.equal(tradeSideCovers(midFwd, other), true)
  assert.equal(tradeSideCovers(other, midFwd), false)
  assert.equal(tradePositionsMatch(midFwd, other), false)
  assert.equal(
    tradePositionsMatch(midFwd, { 1: 0, 2: 0, 3: 2, 4: 1 }),
    true,
  )
  assert.equal(canAddTradePosition(other, midFwd, 3), true)
  assert.equal(canAddTradePosition(other, midFwd, 4), false)
  assert.equal(canAddTradePosition(other, midFwd, 2), false)
  assert.equal(canAddTradePosition(midFwd, other, 1), true)
  assert.deepEqual(missingTradePositions(other, midFwd), [3])
  assert.equal(
    formatTradePositionNeeds(missingTradePositions(other, midFwd), (t) =>
      ({ 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' })[t],
    ),
    'MID',
  )
  assert.equal(
    formatTradePositionNeeds([3, 4, 3], (t) =>
      ({ 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' })[t],
    ),
    '2 MID, FWD',
  )
})

test('filterSquadByPosition — keeps one slot; blank or unknown leaves list', () => {
  const squad = [
    { element: 1, positionType: 1 },
    { element: 2, positionType: 2 },
    { element: 3, positionType: 1 },
    { element: 4, positionType: 4 },
  ]
  assert.deepEqual(filterSquadByPosition(squad, null), squad)
  assert.deepEqual(filterSquadByPosition(squad, ''), squad)
  assert.deepEqual(filterSquadByPosition(squad, 'all'), squad)
  assert.deepEqual(
    filterSquadByPosition(squad, 4).map((p) => p.element),
    [4],
  )
  assert.deepEqual(
    filterSquadByPosition(squad, '2').map((p) => p.element),
    [2],
  )
})

test('filterSquadForTrade — catching-up side only lists positions still owed', () => {
  const squad = [
    { element: 1, positionType: 1 },
    { element: 2, positionType: 2 },
    { element: 3, positionType: 3 },
    { element: 4, positionType: 4 },
    { element: 5, positionType: 3 },
  ]
  const open = { 1: 0, 2: 0, 3: 0, 4: 0 }
  assert.deepEqual(filterSquadForTrade(squad), squad)
  assert.deepEqual(
    filterSquadForTrade(squad, { sideCounts: open, otherCounts: open }).map(
      (p) => p.element,
    ),
    [1, 2, 3, 4, 5],
  )
  const needMidFwd = { 1: 0, 2: 0, 3: 1, 4: 1 }
  assert.deepEqual(
    filterSquadForTrade(squad, {
      sideCounts: open,
      otherCounts: needMidFwd,
      selectedIds: [2],
    }).map((p) => p.element),
    [2, 3, 4, 5],
  )
})

test('filterSquadByQuery — matches player name, ignores blank query', () => {
  const squad = [
    { name: 'Raya' },
    { name: 'Haaland' },
    { name: 'Donnarumma' },
  ]
  assert.deepEqual(filterSquadByQuery(squad, ''), squad)
  assert.deepEqual(
    filterSquadByQuery(squad, 'haal').map((p) => p.name),
    ['Haaland'],
  )
  assert.equal(filterSquadByQuery(squad, 'zzz').length, 0)
})

test('applyTradePick — any mix on one side, other side matches positions', () => {
  const midA = { element: 10, positionType: 3 }
  const fwdA = { element: 11, positionType: 4 }
  const defA = { element: 12, positionType: 2 }
  const midA2 = { element: 13, positionType: 3 }
  const fwdB = { element: 20, positionType: 4 }
  const midB = { element: 21, positionType: 3 }
  const defB = { element: 22, positionType: 2 }
  const squadA = [midA, fwdA, defA, midA2]
  const squadB = [fwdB, midB, defB]

  const pickMid = applyTradePick({
    idsA: [],
    idsB: [],
    squadA,
    squadB,
    side: 'a',
    elementId: 10,
  })
  assert.deepEqual(pickMid, { idsA: [10], idsB: [] })

  const pickFwd = applyTradePick({
    ...pickMid,
    squadA,
    squadB,
    side: 'a',
    elementId: 11,
  })
  assert.deepEqual(pickFwd, { idsA: [10, 11], idsB: [] })

  const rejectDefOnB = applyTradePick({
    ...pickFwd,
    squadA,
    squadB,
    side: 'b',
    elementId: 22,
  })
  assert.deepEqual(rejectDefOnB, { idsA: [10, 11], idsB: [] })

  const pickFwdFirstOnB = applyTradePick({
    ...pickFwd,
    squadA,
    squadB,
    side: 'b',
    elementId: 20,
  })
  assert.deepEqual(pickFwdFirstOnB, { idsA: [10, 11], idsB: [20] })

  const pickMidOnB = applyTradePick({
    ...pickFwdFirstOnB,
    squadA,
    squadB,
    side: 'b',
    elementId: 21,
  })
  assert.deepEqual(pickMidOnB, { idsA: [10, 11], idsB: [20, 21] })

  const extendWithAnotherMid = applyTradePick({
    ...pickMidOnB,
    squadA,
    squadB,
    side: 'a',
    elementId: 13,
  })
  assert.deepEqual(extendWithAnotherMid, { idsA: [10, 11, 13], idsB: [20, 21] })

  const bCannotAddDefWhileShort = applyTradePick({
    ...extendWithAnotherMid,
    squadA,
    squadB,
    side: 'b',
    elementId: 22,
  })
  assert.deepEqual(bCannotAddDefWhileShort, {
    idsA: [10, 11, 13],
    idsB: [20, 21],
  })

  const deselect = applyTradePick({
    idsA: [10, 11],
    idsB: [20, 21],
    squadA,
    squadB,
    side: 'a',
    elementId: 10,
  })
  assert.deepEqual(deselect, { idsA: [11], idsB: [20, 21] })

  const onlyFillTheGap = applyTradePick({
    ...deselect,
    squadA,
    squadB,
    side: 'a',
    elementId: 12,
  })
  assert.deepEqual(onlyFillTheGap, { idsA: [11], idsB: [20, 21] })

  const fillMid = applyTradePick({
    ...deselect,
    squadA,
    squadB,
    side: 'a',
    elementId: 10,
  })
  assert.deepEqual(fillMid, { idsA: [11, 10], idsB: [20, 21] })
})

test('encodeTradeSource / parseTradeSource — entry vs club keys', () => {
  assert.equal(encodeTradeSource('entry', 42), 'entry:42')
  assert.equal(encodeTradeSource('club', 14), 'club:14')
  assert.equal(encodeTradeSource('club', Number.NaN), '')
  assert.deepEqual(parseTradeSource('entry:42'), { kind: 'entry', id: 42 })
  assert.deepEqual(parseTradeSource('club:14'), { kind: 'club', id: 14 })
  assert.equal(parseTradeSource('42'), null)
  assert.equal(parseTradeSource(''), null)
})

test('applyTradePick — same element cannot sit on both sides', () => {
  const gk = { element: 10, positionType: 1 }
  const next = applyTradePick({
    idsA: [10],
    idsB: [],
    squadA: [gk],
    squadB: [gk],
    side: 'b',
    elementId: 10,
  })
  assert.deepEqual(next, { idsA: [10], idsB: [] })
})

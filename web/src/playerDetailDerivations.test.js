import assert from 'node:assert/strict'
import test from 'node:test'
import {
  countDcThresholdMet,
  countGamesPlayedOver60,
  DEFAULT_PERFORMANCE_COL_IDS,
  fdrTone,
  fixtureScoreForGw,
  formatPerformanceStat,
  historyScoreFromPerspective,
  isSeasonComplete,
  lastFiveGwCards,
  lastNHistoryRows,
  miniBarTone,
  performanceStatCatalog,
  performanceStatValue,
  performanceTableRows,
  statCellTone,
  summarizeRecentPoints,
  upcomingFixturesNext,
} from './playerDetailDerivations.js'

test('fdrTone — clamps inputs to the 1..5 ramp tokens', () => {
  assert.equal(fdrTone(1), 1)
  assert.equal(fdrTone(2), 2)
  assert.equal(fdrTone(3), 3)
  assert.equal(fdrTone(4), 4)
  assert.equal(fdrTone(5), 5)
  assert.equal(fdrTone(0), 1)
  assert.equal(fdrTone(-1), 1)
  assert.equal(fdrTone(7), 5)
  assert.equal(fdrTone(null), 3)
  assert.equal(fdrTone(undefined), 3)
  assert.equal(fdrTone('not-a-number'), 3)
})

test('lastNHistoryRows — returns trailing rows in order', () => {
  const rows = [
    { round: 1 },
    { round: 2 },
    { round: 3 },
    { round: 4 },
    { round: 5 },
    { round: 6 },
    { round: 7 },
  ]
  assert.deepEqual(lastNHistoryRows(rows, 5).map((r) => r.round), [3, 4, 5, 6, 7])
  assert.deepEqual(lastNHistoryRows(rows, 2).map((r) => r.round), [6, 7])
  assert.equal(lastNHistoryRows([], 5).length, 0)
  assert.equal(lastNHistoryRows(null, 5).length, 0)
  assert.equal(lastNHistoryRows(rows, 0).length, 0)
})

test('summarizeRecentPoints — avg / last / total', () => {
  assert.deepEqual(summarizeRecentPoints([2, 4, 6, 8, 10]), { avg: 6, last: 10, total: 30 })
  assert.deepEqual(summarizeRecentPoints([]), { avg: 0, last: 0, total: 0 })
  assert.deepEqual(summarizeRecentPoints([5]), { avg: 5, last: 5, total: 5 })
  assert.deepEqual(summarizeRecentPoints([null, 2, 'x']), { avg: 2 / 3, last: 0, total: 2 })
})

test('miniBarTone — pos / neg / neutral around the running average', () => {
  assert.equal(miniBarTone(10, 5), 'pos')
  assert.equal(miniBarTone(2, 6), 'neg')
  assert.equal(miniBarTone(5, 5), 'neutral')
  assert.equal(miniBarTone(5.4, 5), 'neutral')
  assert.equal(miniBarTone(5.6, 5), 'pos')
})

test('statCellTone — LiveScores-style colouring rules', () => {
  // G / A / BNS — green when > 0
  assert.equal(statCellTone('g', 1, 3), 'good')
  assert.equal(statCellTone('g', 0, 3), 'neutral')
  assert.equal(statCellTone('a', 2, 3), 'good')
  assert.equal(statCellTone('bns', 3, 3), 'good')
  assert.equal(statCellTone('bns', 0, 3), 'neutral')

  // CS — green only when position-eligible (GK/DEF/MID); FWD always neutral
  assert.equal(statCellTone('cs', 1, 1 /* GK */), 'good')
  assert.equal(statCellTone('cs', 1, 2 /* DEF */), 'good')
  assert.equal(statCellTone('cs', 1, 3 /* MID */), 'good')
  assert.equal(statCellTone('cs', 1, 4 /* FWD */), 'neutral')
  assert.equal(statCellTone('cs', 0, 2), 'neutral')

  // DC — green at/above defensive-contribution threshold for the position
  assert.equal(statCellTone('dc', 9,  2 /* DEF; t=10 */), 'neutral')
  assert.equal(statCellTone('dc', 10, 2 /* DEF; t=10 */), 'good')
  assert.equal(statCellTone('dc', 11, 3 /* MID; t=12 */), 'neutral')
  assert.equal(statCellTone('dc', 12, 3 /* MID; t=12 */), 'good')
  assert.equal(statCellTone('dc', 12, 4 /* FWD; t=12 */), 'good')

  // Other stats — always neutral
  assert.equal(statCellTone('pts', 99, 3), 'neutral')
  assert.equal(statCellTone('min', 90, 3), 'neutral')
  assert.equal(statCellTone('xg', 1.5, 3), 'neutral')
})

test('performanceStatCatalog — 15 ids; default visible set is 6 (MIN PTS G A DC BNS, no FDR)', () => {
  const cat = performanceStatCatalog()
  assert.equal(cat.length, 15)
  const ids = cat.map((c) => c.id)
  for (const id of DEFAULT_PERFORMANCE_COL_IDS) {
    assert.ok(ids.includes(id), `default id ${id} missing from catalog`)
  }
  assert.deepEqual(DEFAULT_PERFORMANCE_COL_IDS, ['min', 'pts', 'g', 'a', 'dc', 'bns'])
  assert.ok(!DEFAULT_PERFORMANCE_COL_IDS.includes('fdr'), 'FDR must NOT be in defaults')
})

test('performanceStatValue / formatPerformanceStat — pulls + formats', () => {
  const h = {
    total_points: 12,
    minutes: 90,
    goals_scored: 1,
    assists: 0,
    clean_sheets: 1,
    defensive_contribution: 14,
    bonus: 3,
    bps: 38,
    expected_goals: '0.65',
    expected_assists: '0.12',
    saves: 0,
    goals_conceded: 1,
    yellow_cards: 0,
    red_cards: 0,
  }
  assert.equal(performanceStatValue('pts', h), 12)
  assert.equal(performanceStatValue('min', h), 90)
  assert.equal(performanceStatValue('g',   h), 1)
  assert.equal(performanceStatValue('xg',  h), 0.65)
  assert.equal(performanceStatValue('xa',  h), 0.12)
  assert.equal(performanceStatValue('fdr', h), null)
  assert.equal(performanceStatValue('pts', null), null)

  assert.equal(formatPerformanceStat('pts', 12), '12')
  assert.equal(formatPerformanceStat('xg',  0.65), '0.65')
  assert.equal(formatPerformanceStat('xa',  0.1), '0.10')
  assert.equal(formatPerformanceStat('pts', null), '—')
})

test('performanceTableRows — past + future merged, DGW collapsed into extras', () => {
  const summary = {
    history: [
      { round: 1, total_points: 6 },
      { round: 2, total_points: 9 },
      { round: 4, total_points: 7 }, // DGW slot a
      { round: 4, total_points: 2 }, // DGW slot b
    ],
    fixtures: [
      { event: 5, team_h: 1, team_a: 2, is_home: true, difficulty: 3 },
      { event: 6, team_h: 1, team_a: 2, is_home: true, difficulty: 4 },
    ],
  }
  const rows = performanceTableRows(summary)
  assert.deepEqual(
    rows.map((r) => ({ gw: r.gw, kind: r.kind, extras: r.extras.length })),
    [
      { gw: 1, kind: 'past',   extras: 0 },
      { gw: 2, kind: 'past',   extras: 0 },
      { gw: 4, kind: 'past',   extras: 1 }, // second leg of DGW captured
      { gw: 5, kind: 'future', extras: 0 },
      { gw: 6, kind: 'future', extras: 0 },
    ],
  )
})

test('isSeasonComplete — true only when summary loaded with zero upcoming fixtures', () => {
  // Pre-load state — must NOT trip the "season complete" placeholder
  assert.equal(isSeasonComplete(null), false)
  assert.equal(isSeasonComplete(undefined), false)
  assert.equal(isSeasonComplete({}), false) // payload exists but `fixtures` not yet present
  assert.equal(isSeasonComplete({ fixtures: null }), false)
  assert.equal(isSeasonComplete({ fixtures: undefined }), false)

  // Loaded with upcoming fixtures → still mid-season
  assert.equal(
    isSeasonComplete({ fixtures: [{ event: 38, team_h: 1, team_a: 2 }] }),
    false,
  )

  // Loaded with no upcoming fixtures → season complete
  assert.equal(isSeasonComplete({ fixtures: [] }), true)
  assert.equal(isSeasonComplete({ history: [{ round: 38 }], fixtures: [] }), true)
})

test('upcomingFixturesNext — first 5, opponent + home flag derived from team ids', () => {
  const summary = {
    fixtures: [
      { event: 5, team_h: 1, team_a: 2, is_home: true,  difficulty: 2 },
      { event: 6, team_h: 3, team_a: 1, is_home: false, difficulty: 4 },
      { event: 7, team_h: 1, team_a: 4, is_home: true,  difficulty: 1 },
      { event: 8, team_h: 5, team_a: 1, is_home: false, difficulty: 3 },
      { event: 9, team_h: 6, team_a: 1, is_home: false, difficulty: 5 },
      { event: 10, team_h: 1, team_a: 7, is_home: true, difficulty: 2 },
    ],
  }
  const next = upcomingFixturesNext(summary, 1, 5)
  assert.equal(next.length, 5)
  assert.deepEqual(next[0], { gw: 5, teamId: 2, home: true,  difficulty: 2 })
  assert.deepEqual(next[1], { gw: 6, teamId: 3, home: false, difficulty: 4 })
  assert.deepEqual(next[2], { gw: 7, teamId: 4, home: true,  difficulty: 1 })

  assert.equal(upcomingFixturesNext({ fixtures: [] }, 1).length, 0)
  assert.equal(upcomingFixturesNext({}, 1).length, 0)
  assert.equal(upcomingFixturesNext(null, 1).length, 0)
})

test('countGamesPlayedOver60 — counts GWs with minutes >= 60', () => {
  const rows = [
    { round: 1, minutes: 90 },
    { round: 2, minutes: 60 },
    { round: 3, minutes: 59 },
    { round: 4, minutes: 0 },
    { round: 5, minutes: null },
    { round: 6, minutes: 73 },
  ]
  assert.equal(countGamesPlayedOver60(rows), 3)
  assert.equal(countGamesPlayedOver60([]), 0)
  assert.equal(countGamesPlayedOver60(null), 0)
})

test('countDcThresholdMet — counts qualifying DC games per position', () => {
  // DEF threshold = 10, MID/FWD threshold = 12, GK has no threshold
  const rows = [
    { round: 1, defensive_contribution: 14 },
    { round: 2, defensive_contribution: 11 },
    { round: 3, defensive_contribution: 9 },
    { round: 4, defensive_contribution: 10 },
    { round: 5, defensive_contribution: 0 },
  ]
  assert.equal(countDcThresholdMet(rows, 2 /* DEF; t=10 */), 3) // 14, 11, 10
  assert.equal(countDcThresholdMet(rows, 3 /* MID; t=12 */), 1) // 14 only
  assert.equal(countDcThresholdMet(rows, 4 /* FWD; t=12 */), 1)
  assert.equal(countDcThresholdMet(rows, 1 /* GK; no threshold */), 0)
  assert.equal(countDcThresholdMet([], 2), 0)
  assert.equal(countDcThresholdMet(null, 2), 0)
})

test('historyScoreFromPerspective — formats W/D/L from player club POV', () => {
  // Home win
  assert.deepEqual(
    historyScoreFromPerspective({ was_home: true, team_h_score: 2, team_a_score: 1 }),
    { score: '2-1', result: 'W', wasHome: true },
  )
  // Away win
  assert.deepEqual(
    historyScoreFromPerspective({ was_home: false, team_h_score: 1, team_a_score: 3 }),
    { score: '3-1', result: 'W', wasHome: false },
  )
  // Draw
  assert.deepEqual(
    historyScoreFromPerspective({ was_home: true, team_h_score: 0, team_a_score: 0 }),
    { score: '0-0', result: 'D', wasHome: true },
  )
  // Away loss
  assert.deepEqual(
    historyScoreFromPerspective({ was_home: false, team_h_score: 4, team_a_score: 1 }),
    { score: '1-4', result: 'L', wasHome: false },
  )
  // Missing scores → null (caller should fall back to plFixtures)
  assert.equal(historyScoreFromPerspective({ was_home: true }), null)
  assert.equal(historyScoreFromPerspective(null), null)
})

test('fixtureScoreForGw — derives score from bootstrap plFixtures fallback', () => {
  const fixtures = [
    { event: 35, team_h: 12, team_a: 5, team_h_score: 1, team_a_score: 0 }, // LIV home win
    { event: 36, team_h: 7,  team_a: 12, team_h_score: 2, team_a_score: 2 }, // LIV away draw
    { event: 37, team_h: 12, team_a: 9, team_h_score: null, team_a_score: null }, // unfinished
    { event: 38, team_h: 11, team_a: 12, team_h_score: 3, team_a_score: 1 }, // LIV away loss
  ]
  // GW35: LIV (12) at home vs 5 → 1-0 W
  assert.deepEqual(
    fixtureScoreForGw(fixtures, 35, 12),
    { score: '1-0', result: 'W', wasHome: true },
  )
  // GW36: LIV away vs 7 → 2-2 D from LIV POV
  assert.deepEqual(
    fixtureScoreForGw(fixtures, 36, 12),
    { score: '2-2', result: 'D', wasHome: false },
  )
  // GW38: LIV away vs 11 → 1-3 L from LIV POV
  assert.deepEqual(
    fixtureScoreForGw(fixtures, 38, 12),
    { score: '1-3', result: 'L', wasHome: false },
  )
  // Unfinished fixture → null
  assert.equal(fixtureScoreForGw(fixtures, 37, 12), null)
  // No fixtures
  assert.equal(fixtureScoreForGw(null, 35, 12), null)
  assert.equal(fixtureScoreForGw([], 35, 12), null)
  // Player club not in any fixture for that GW
  assert.equal(fixtureScoreForGw(fixtures, 35, 99), null)
})

test('lastFiveGwCards — returns crest-card model with score + tone', () => {
  // 7 GWs, season avg = (5+6+8+0+10+2+9)/7 ≈ 5.71
  const history = [
    { round: 1, opponent_team: 11, was_home: true,  team_h_score: 1, team_a_score: 0, minutes: 90, total_points: 5 },
    { round: 2, opponent_team: 12, was_home: false, team_h_score: 0, team_a_score: 1, minutes: 88, total_points: 6 },
    { round: 3, opponent_team: 13, was_home: true,  team_h_score: 3, team_a_score: 1, minutes: 90, total_points: 8 },
    { round: 4, opponent_team: 14, was_home: false, team_h_score: 2, team_a_score: 0, minutes: 0,  total_points: 0 }, // DNP
    { round: 5, opponent_team: 15, was_home: true,  team_h_score: 4, team_a_score: 2, minutes: 90, total_points: 10 },
    { round: 6, opponent_team: 16, was_home: false, team_h_score: 1, team_a_score: 1, minutes: 67, total_points: 2 },
    { round: 7, opponent_team: 17, was_home: true,  team_h_score: 2, team_a_score: 0, minutes: 90, total_points: 9 },
  ]
  const cards = lastFiveGwCards(history, 3 /* MID */, 5)
  assert.equal(cards.length, 5)
  // Last 5 = rounds 3..7
  assert.deepEqual(cards.map((c) => c.gw), [3, 4, 5, 6, 7])
  // GW3: home win 3-1, 8 pts (above season avg ~5.71 → pos)
  assert.equal(cards[0].score, '3-1')
  assert.equal(cards[0].result, 'W')
  assert.equal(cards[0].tone, 'pos')
  // GW4: DNP, 0 minutes
  assert.equal(cards[1].dnp, true)
  assert.equal(cards[1].minutes, 0)
  assert.equal(cards[1].tone, 'neutral')
  // GW5: home win 4-2, 10 pts (well above avg → pos)
  assert.equal(cards[2].score, '4-2')
  assert.equal(cards[2].result, 'W')
  assert.equal(cards[2].tone, 'pos')
  // GW6: away draw 1-1, 2 pts (below avg → neg)
  assert.equal(cards[3].score, '1-1')
  assert.equal(cards[3].result, 'D')
  assert.equal(cards[3].tone, 'neg')
  // GW7: home win 2-0, 9 pts → pos
  assert.equal(cards[4].score, '2-0')
  assert.equal(cards[4].result, 'W')
  assert.equal(cards[4].tone, 'pos')
})

test('lastFiveGwCards — falls back to plFixtures when history rows lack scores', () => {
  // Draft-API-style history rows: no team_h_score / team_a_score / was_home
  const history = [
    { event: 36, opponent_team: 5,  minutes: 90, total_points: 8 },
    { event: 37, opponent_team: 11, minutes: 73, total_points: 1 },
    { event: 38, opponent_team: 4,  minutes: 90, total_points: 6 },
  ]
  // Player team = 12 (Liverpool)
  const fixtures = [
    { event: 36, team_h: 12, team_a: 5,  team_h_score: 3, team_a_score: 1 },
    { event: 37, team_h: 11, team_a: 12, team_h_score: 1, team_a_score: 1 },
    { event: 38, team_h: 12, team_a: 4,  team_h_score: 2, team_a_score: 2 },
  ]
  const cards = lastFiveGwCards(history, 3, 5, { plFixtures: fixtures, playerTeamId: 12 })
  assert.equal(cards.length, 3)
  // GW36: home win 3-1
  assert.equal(cards[0].gw, 36)
  assert.equal(cards[0].score, '3-1')
  assert.equal(cards[0].result, 'W')
  assert.equal(cards[0].home, true)
  // GW37: away draw 1-1
  assert.equal(cards[1].score, '1-1')
  assert.equal(cards[1].result, 'D')
  assert.equal(cards[1].home, false)
  // GW38: home draw 2-2
  assert.equal(cards[2].score, '2-2')
  assert.equal(cards[2].result, 'D')
  assert.equal(cards[2].home, true)
})

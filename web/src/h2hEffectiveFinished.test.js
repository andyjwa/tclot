import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyLeagueResults,
  compareH2hStandingsKeys,
  compareStandingsRows,
  completedFootballGameweeks,
  deriveStandingsFromFinishedMatches,
  dropUnconfirmedMatchPromotions,
  finishedEventIdsFromEvents,
  matchEffectivelyFinished,
  mergeStandingsPreferringHigherFor,
  normalizeMatchesFinished,
  overlayFresherMatchPoints,
  reconcileMatchPointsFromStandings,
  sortH2hStandingsRows,
} from './h2hEffectiveFinished.js'
import { displayedSidePoints } from './liveGwTotals.js'

const fixturesGw1Done = [
  { event: 1, finished: false, finished_provisional: true },
  { event: 1, finished: true, finished_provisional: true },
  { event: 2, finished: false, finished_provisional: false },
  { event: 2, finished: false, finished_provisional: true },
]

const matches = [
  {
    event: 1,
    finished: false,
    started: true,
    league_entry_1: 10,
    league_entry_2: 20,
    league_entry_1_points: 40,
    league_entry_2_points: 23,
  },
  {
    event: 1,
    finished: false,
    started: true,
    league_entry_1: 30,
    league_entry_2: 40,
    league_entry_1_points: 35,
    league_entry_2_points: 53,
  },
  {
    event: 2,
    finished: false,
    started: true,
    league_entry_1: 10,
    league_entry_2: 30,
    league_entry_1_points: 10,
    league_entry_2_points: 12,
  },
  {
    event: 3,
    finished: false,
    started: false,
    league_entry_1: 10,
    league_entry_2: 40,
    league_entry_1_points: 0,
    league_entry_2_points: 0,
  },
]

test('completedFootballGameweeks — only GWs where every fixture is done', () => {
  const set = completedFootballGameweeks(fixturesGw1Done)
  assert.equal(set.has(1), true)
  assert.equal(set.has(2), false)
})

test('completedFootballGameweeks — empty / bad input', () => {
  assert.equal(completedFootballGameweeks(null).size, 0)
  assert.equal(completedFootballGameweeks([]).size, 0)
  assert.equal(completedFootballGameweeks([{ event: null }]).size, 0)
})

test('matchEffectivelyFinished — promotes when football done + points present', () => {
  const done = completedFootballGameweeks(fixturesGw1Done)
  assert.equal(matchEffectivelyFinished(matches[0], done), true)
  assert.equal(matchEffectivelyFinished(matches[2], done), false) // GW2 incomplete
  assert.equal(matchEffectivelyFinished(matches[3], done), false) // not started
})

test('matchEffectivelyFinished — trusts FPL finished flag regardless of fixtures', () => {
  assert.equal(
    matchEffectivelyFinished({ event: 9, finished: true, started: false }, new Set()),
    true,
  )
})

test('matchEffectivelyFinished — refuses rows without finite points', () => {
  const done = new Set([1])
  assert.equal(
    matchEffectivelyFinished(
      { event: 1, finished: false, started: true, league_entry_1_points: null },
      done,
    ),
    false,
  )
})

test('normalizeMatchesFinished — promotes GW1 rows only', () => {
  const out = normalizeMatchesFinished(matches, fixturesGw1Done)
  assert.equal(out[0].finished, true)
  assert.equal(out[1].finished, true)
  assert.equal(out[2].finished, false)
  assert.equal(out[3].finished, false)
  // Original array left untouched
  assert.equal(matches[0].finished, false)
})

test('normalizeMatchesFinished — no-op when no fixtures complete', () => {
  const out = normalizeMatchesFinished(matches, [
    { event: 1, finished: false, finished_provisional: false },
  ])
  assert.equal(out, matches)
})

test('finishedEventIdsFromEvents — highest finished ids from bootstrap shapes', () => {
  const fromObj = finishedEventIdsFromEvents({
    events: {
      current: 3,
      data: [
        { id: 1, finished: true },
        { id: 2, finished: true },
        { id: 3, finished: false },
      ],
    },
  })
  assert.equal(fromObj.has(1), true)
  assert.equal(fromObj.has(2), true)
  assert.equal(fromObj.has(3), false)
  const fromList = finishedEventIdsFromEvents([{ id: 2, finished: true }])
  assert.equal(fromList.has(2), true)
  assert.equal(finishedEventIdsFromEvents(null).size, 0)
})

test('completedFootballGameweeks — bootstrap finished closes a GW fixtures still show open', () => {
  const set = completedFootballGameweeks(fixturesGw1Done, [2])
  assert.equal(set.has(1), true)
  assert.equal(set.has(2), true)
})

test('normalizeMatchesFinished — event.finished promotes GW2 even if one PL fixture lags', () => {
  const staleMondayNight = [
    { event: 2, finished: false, finished_provisional: true },
    { event: 2, finished: false, finished_provisional: false, started: false },
  ]
  const out = normalizeMatchesFinished(matches, staleMondayNight, new Set([2]))
  assert.equal(out[2].finished, true)
  assert.equal(out[3].finished, false)
})

test('compareH2hStandingsKeys — official PTS then PF; name after a PF tie (no PA)', () => {
  assert.ok(compareH2hStandingsKeys(6, 9, 154, 163, 'Mordor', 'Rokesly') > 0)
  assert.ok(compareH2hStandingsKeys(6, 6, 154, 136, 'Mordor', 'Brampton') < 0)
  // Same PTS + PF: Seoul before Suffolk even though Suffolk has the better PA.
  assert.ok(
    compareH2hStandingsKeys(3, 3, 131, 131, 'Seoul Shire', 'Suffolk Sméagol') < 0,
  )
  assert.ok(
    compareH2hStandingsKeys(3, 3, 131, 131, 'Suffolk Sméagol', 'Toronto Gimli') < 0,
  )
})

test('sortH2hStandingsRows — GW3 three-way 3pts/131 PF lists Seoul then Suffolk then Toronto', () => {
  const rows = [
    { league_entry: 5220, total: 3, points_for: 131, points_against: 132, teamName: 'Suffolk Sméagol' },
    { league_entry: 4898, total: 3, points_for: 131, points_against: 149, teamName: 'Toronto Gimli' },
    { league_entry: 30728, total: 3, points_for: 131, points_against: 135, teamName: 'Seoul Shire' },
    { league_entry: 44904, total: 6, points_for: 136, points_against: 148, teamName: 'Brampton Balrogs' },
    { league_entry: 6849, total: 9, points_for: 163, points_against: 116, teamName: 'Rokesly Regorasu' },
    { league_entry: 18279, total: 6, points_for: 154, points_against: 105, teamName: 'Mordor S.F.G' },
    { league_entry: 4259, total: 3, points_for: 114, points_against: 145, teamName: 'Atlético Bilbo' },
    { league_entry: 10173, total: 3, points_for: 110, points_against: 140, teamName: 'Hackney Rohirrim' },
  ]
  sortH2hStandingsRows(rows)
  assert.deepEqual(
    rows.map((r) => r.teamName),
    [
      'Rokesly Regorasu',
      'Mordor S.F.G',
      'Brampton Balrogs',
      'Seoul Shire',
      'Suffolk Sméagol',
      'Toronto Gimli',
      'Atlético Bilbo',
      'Hackney Rohirrim',
    ],
  )
})

test('deriveStandingsFromFinishedMatches — W/L/PF from finished H2H rows', () => {
  const finished = normalizeMatchesFinished(matches, fixturesGw1Done)
  const entries = [{ id: 10 }, { id: 20 }, { id: 30 }, { id: 40 }]
  const rows = deriveStandingsFromFinishedMatches(entries, finished)
  assert.equal(rows.length, 4)
  assert.equal(rows[0].league_entry, 40) // 53 pts win
  assert.equal(rows[0].matches_won, 1)
  assert.equal(rows[0].matches_played, 1)
  assert.equal(rows[0].points_for, 53)
  assert.equal(rows[0].total, 3)
  const loser = rows.find((r) => r.league_entry === 20)
  assert.equal(loser.matches_lost, 1)
  assert.equal(loser.points_for, 23)
  assert.equal(loser.total, 0)
})

test('deriveStandingsFromFinishedMatches — same PTS+PF sorts A–Z, ignores PA', () => {
  const entries = [
    { id: 1, entry_name: 'Suffolk Sméagol' },
    { id: 2, entry_name: 'Seoul Shire' },
    { id: 3, entry_name: 'Toronto Gimli' },
    { id: 4, entry_name: 'Dummy High' },
    { id: 5, entry_name: 'Dummy Low' },
  ]
  const finished = [
    { finished: true, league_entry_1: 2, league_entry_2: 4, league_entry_1_points: 70, league_entry_2_points: 10 },
    { finished: true, league_entry_1: 2, league_entry_2: 5, league_entry_1_points: 11, league_entry_2_points: 60 },
    { finished: true, league_entry_1: 1, league_entry_2: 4, league_entry_1_points: 70, league_entry_2_points: 40 },
    { finished: true, league_entry_1: 1, league_entry_2: 5, league_entry_1_points: 11, league_entry_2_points: 51 },
    { finished: true, league_entry_1: 3, league_entry_2: 4, league_entry_1_points: 70, league_entry_2_points: 30 },
    { finished: true, league_entry_1: 3, league_entry_2: 5, league_entry_1_points: 11, league_entry_2_points: 41 },
  ]
  // Trio: 1-0-1, 81 PF. PA: Seoul 70, Toronto 71, Suffolk 91.
  const rows = deriveStandingsFromFinishedMatches(entries, finished)
  const trio = rows.filter((r) => r.total === 3)
  assert.deepEqual(
    trio.map((r) => r.league_entry),
    [2, 1, 3],
  )
  assert.equal(trio[0].points_for, 81)
  assert.equal(trio[0].points_against, 70)
  assert.equal(trio[1].points_against, 91)
})

test('compareStandingsRows — official FPL order is PTS, FOR, then name (not PA or waivers)', () => {
  const suffolk = {
    total: 3,
    points_for: 131,
    points_against: 132,
    waiver_pick: 4,
    teamName: 'Suffolk Sméagol',
  }
  const seoul = {
    total: 3,
    points_for: 131,
    points_against: 135,
    waiver_pick: 5,
    teamName: 'Seoul Shire',
  }
  const toronto = {
    total: 3,
    points_for: 131,
    points_against: 149,
    waiver_pick: 3,
    teamName: 'Toronto Gimli',
  }
  const rows = [toronto, suffolk, seoul].sort(compareStandingsRows)
  assert.deepEqual(
    rows.map((r) => r.teamName),
    ['Seoul Shire', 'Suffolk Sméagol', 'Toronto Gimli'],
  )
})

test('reconcileMatchPointsFromStandings — lifts Saturday leftovers to official FOR', () => {
  const matches = [
    {
      event: 1,
      finished: true,
      league_entry_1: 30728,
      league_entry_2: 10173,
      league_entry_1_points: 47,
      league_entry_2_points: 31,
    },
    {
      event: 2,
      finished: true,
      league_entry_1: 6849,
      league_entry_2: 30728,
      league_entry_1_points: 61,
      league_entry_2_points: 44,
    },
    {
      event: 2,
      finished: true,
      league_entry_1: 4259,
      league_entry_2: 5220,
      league_entry_1_points: 40,
      league_entry_2_points: 38,
    },
    {
      event: 1,
      finished: true,
      league_entry_1: 4259,
      league_entry_2: 18279,
      league_entry_1_points: 31,
      league_entry_2_points: 50,
    },
    {
      event: 3,
      finished: true,
      league_entry_1: 30728,
      league_entry_2: 4259,
      league_entry_1_points: 9,
      league_entry_2_points: 31,
    },
  ]
  const official = [
    { league_entry: 30728, points_for: 131 },
    { league_entry: 4259, points_for: 114 },
  ]
  const gw3In = matches.find((m) => m.event === 3)
  const out = reconcileMatchPointsFromStandings(matches, official)
  const gw3 = out.find((m) => m.event === 3)
  assert.equal(gw3.league_entry_1_points, 40)
  assert.equal(gw3.league_entry_2_points, 43)
  assert.equal(gw3In.league_entry_1_points, 9, 'input left untouched')
})

test('overlayFresherMatchPoints — live details win when they have more points', () => {
  const base = [
    {
      event: 3,
      finished: true,
      started: true,
      league_entry_1: 30728,
      league_entry_2: 4259,
      league_entry_1_points: 9,
      league_entry_2_points: 31,
    },
  ]
  const live = [
    {
      event: 3,
      finished: true,
      started: true,
      league_entry_1: 4259,
      league_entry_2: 30728,
      league_entry_1_points: 43,
      league_entry_2_points: 40,
    },
  ]
  const out = overlayFresherMatchPoints(base, live)
  assert.equal(out[0].league_entry_1_points, 40)
  assert.equal(out[0].league_entry_2_points, 43)
})

test('applyLeagueResults — official FOR beats leftover H2H and rewrites the table', () => {
  const details = {
    league_entries: [{ id: 30728 }, { id: 4259 }],
    matches: [
      {
        event: 3,
        finished: true,
        started: true,
        league_entry_1: 30728,
        league_entry_2: 4259,
        league_entry_1_points: 9,
        league_entry_2_points: 31,
      },
    ],
    standings: [
      { league_entry: 30728, points_for: 40, points_against: 43, total: 0 },
      { league_entry: 4259, points_for: 43, points_against: 40, total: 3 },
    ],
  }
  const { matches, standings } = applyLeagueResults(details, [], new Set())
  assert.equal(matches[0].league_entry_1_points, 40)
  assert.equal(matches[0].league_entry_2_points, 43)
  const seoul = standings.find((s) => s.league_entry === 30728)
  const bilbo = standings.find((s) => s.league_entry === 4259)
  assert.equal(seoul.points_for, 40)
  assert.equal(bilbo.points_for, 43)
  assert.equal(bilbo.total, 3)
  assert.equal(seoul.total, 0)
})

test('applyLeagueResults — does not freeze Saturday leftovers once Sunday has been played', () => {
  const fixturesGw8Done = [
    { event: 8, finished: false, finished_provisional: true },
    { event: 8, finished: false, finished_provisional: true },
  ]
  const details = {
    league_entries: [{ id: 1, entry_name: 'Mordor' }, { id: 2, entry_name: 'Bilbo' }],
    matches: [
      {
        event: 7,
        finished: true,
        started: true,
        league_entry_1: 1,
        league_entry_2: 2,
        league_entry_1_points: 59,
        league_entry_2_points: 68,
      },
      {
        event: 8,
        finished: false,
        started: true,
        league_entry_1: 1,
        league_entry_2: 2,
        league_entry_1_points: 26,
        league_entry_2_points: 40,
      },
    ],
    standings: [
      { league_entry: 1, points_for: 59, points_against: 68, total: 0 },
      { league_entry: 2, points_for: 68, points_against: 59, total: 3 },
    ],
  }
  const { matches, standings } = applyLeagueResults(details, fixturesGw8Done, new Set())
  const gw8 = matches.find((m) => m.event === 8)
  assert.equal(gw8.finished, false)
  assert.equal(gw8.league_entry_1_points, 26)
  assert.equal(gw8.league_entry_2_points, 40)
  const mordor = standings.find((s) => s.league_entry === 1)
  const bilbo = standings.find((s) => s.league_entry === 2)
  assert.equal(mordor.points_for, 59)
  assert.equal(bilbo.points_for, 68)
  assert.equal(mordor.total, 0)
  assert.equal(bilbo.total, 3)
})

test('applyLeagueResults — still lifts leftovers once official FOR includes the gameweek', () => {
  const fixturesGw8Done = [{ event: 8, finished: false, finished_provisional: true }]
  const details = {
    league_entries: [{ id: 1, entry_name: 'Mordor' }, { id: 2, entry_name: 'Bilbo' }],
    matches: [
      {
        event: 7,
        finished: true,
        started: true,
        league_entry_1: 1,
        league_entry_2: 2,
        league_entry_1_points: 100,
        league_entry_2_points: 80,
      },
      {
        event: 8,
        finished: false,
        started: true,
        league_entry_1: 1,
        league_entry_2: 2,
        league_entry_1_points: 26,
        league_entry_2_points: 30,
      },
    ],
    standings: [
      { league_entry: 1, points_for: 149, points_against: 121, total: 0 },
      { league_entry: 2, points_for: 121, points_against: 149, total: 3 },
    ],
  }
  const { matches, standings } = applyLeagueResults(details, fixturesGw8Done, new Set())
  const gw8 = matches.find((m) => m.event === 8)
  assert.equal(gw8.finished, true)
  assert.equal(gw8.league_entry_1_points, 49)
  assert.equal(gw8.league_entry_2_points, 41)
  assert.equal(standings.find((s) => s.league_entry === 1).points_for, 149)
  assert.equal(standings.find((s) => s.league_entry === 2).points_for, 121)
})

test('dropUnconfirmedMatchPromotions — a 0-0 with no table movement stays unfinished', () => {
  const original = [
    {
      event: 7,
      finished: true,
      started: true,
      league_entry_1: 1,
      league_entry_2: 2,
      league_entry_1_points: 10,
      league_entry_2_points: 12,
    },
    {
      event: 8,
      finished: false,
      started: true,
      league_entry_1: 1,
      league_entry_2: 2,
      league_entry_1_points: 0,
      league_entry_2_points: 0,
    },
  ]
  const promoted = original.map((m) => (m.event === 8 ? { ...m, finished: true } : m))
  const out = dropUnconfirmedMatchPromotions(original, promoted, [
    { league_entry: 1, points_for: 10 },
    { league_entry: 2, points_for: 12 },
  ])
  assert.equal(out.find((m) => m.event === 8).finished, false)
  assert.equal(out.find((m) => m.event === 7).finished, true)
})

test('displayedSidePoints — a frozen Saturday total does not hide a higher live XI', () => {
  assert.equal(displayedSidePoints(true, 26, 49), 49)
  assert.equal(displayedSidePoints(true, 49, 40), 49)
  assert.equal(displayedSidePoints(false, 26, 49), 49)
  assert.equal(displayedSidePoints(false, 26, null), null)
  assert.equal(displayedSidePoints(true, 26, null), 26)
})

test('mergeStandingsPreferringHigherFor — keeps the website-fresh FOR', () => {
  const baked = [{ league_entry: 30728, points_for: 100, points_against: 104, total: 3 }]
  const live = [{ league_entry: 30728, points_for: 131, points_against: 135, total: 3 }]
  const out = mergeStandingsPreferringHigherFor(baked, live)
  assert.equal(out[0].points_for, 131)
  assert.equal(out[0].points_against, 135)
})

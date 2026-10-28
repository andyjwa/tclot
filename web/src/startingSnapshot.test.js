import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStartingSnapshot, listAnnouncedFixtures } from './startingSnapshot.js';

const teamById = {
  10: { name: 'Arsenal', short_name: 'ARS', code: 3 },
  11: { name: 'Liverpool', short_name: 'LIV', code: 14 },
  20: { name: 'Man City', short_name: 'MCI', code: 43 },
  21: { name: 'Man Utd', short_name: 'MUN', code: 1 },
  30: { name: 'Newcastle', short_name: 'NEW', code: 4 },
  31: { name: 'Brighton', short_name: 'BRI', code: 36 },
};

const elementById = {
  1: { web_name: 'Saliba', team: 10, element_type: 2 },
  2: { web_name: 'Haaland', team: 20, element_type: 4 },
  3: { web_name: 'Trent', team: 10, element_type: 2 },
  4: { web_name: 'Gordon', team: 30, element_type: 3 },
  5: { web_name: 'Raya', team: 10, element_type: 1 },
  6: { web_name: 'Saka', team: 10, element_type: 3 },
  7: { web_name: 'Watkins', team: 40, element_type: 4 },
};

function side(confirmed, xi, bench = []) {
  return {
    confirmed,
    xi: xi.map((elementId) => ({ elementId })),
    bench: bench.map((elementId) => ({ elementId })),
  };
}

function match({ id, home, away, kickoff, score = {}, homeSide, awaySide, finished = false }) {
  return {
    fplFixture: {
      id,
      team_h: home,
      team_a: away,
      kickoff_time: kickoff,
      finished,
      finished_provisional: false,
    },
    score: {
      started: false,
      finished,
      liveMinute: null,
      kickoffIso: kickoff,
      ...score,
    },
    lineups: { home: homeSide, away: awaySide },
  };
}

const fixtures = [
  match({
    id: 100,
    home: 10,
    away: 11,
    kickoff: '2026-04-12T16:30:00Z',
    homeSide: side(true, [1, 5], [3]),
    awaySide: side(true, [], []),
  }),
  match({
    id: 200,
    home: 20,
    away: 21,
    kickoff: '2026-04-12T18:30:00Z',
    homeSide: side(false, [], []),
    awaySide: side(false, [], []),
  }),
  match({
    id: 300,
    home: 30,
    away: 31,
    kickoff: '2026-04-12T13:00:00Z',
    score: { started: true, finished: false, liveMinute: "67'" },
    homeSide: side(true, [4], []),
    awaySide: side(true, [8], []),
  }),
  match({
    id: 400,
    home: 10,
    away: 30,
    kickoff: '2026-04-11T14:00:00Z',
    finished: true,
    score: { started: true, finished: true },
    homeSide: side(true, [1], []),
    awaySide: side(true, [4], []),
  }),
];

const squads = [
  {
    leagueEntryId: 1,
    fplEntryId: 11,
    teamName: 'Crouch End',
    starters: [{ element: 1 }, { element: 2 }, { element: 4 }, { element: 6 }],
    bench: [{ element: 3 }],
  },
  {
    leagueEntryId: 2,
    fplEntryId: 22,
    teamName: 'Hanson',
    error: 'missing',
    starters: [{ element: 5 }],
    bench: [],
  },
];

function names(list) {
  return list.map((p) => p.name);
}

function byName(list, name) {
  return list.find((p) => p.name === name);
}

test('everyone sees starters, bench, left-out, waiting, and played sheets', () => {
  const snap = buildStartingSnapshot({ fixtures, squads, elementById, teamById });
  assert.equal(snap.groups.length, 1);
  assert.equal(snap.groups[0].teamName, 'Crouch End');
  assert.deepEqual(
    snap.groups[0].starting.map((p) => [p.name, p.fixtureId, Boolean(p.finished)]),
    [
      ['Saliba', 100, false],
      ['Saliba', 400, true],
      ['Gordon', 300, false],
      ['Gordon', 400, true],
    ],
  );
  assert.equal(byName(snap.groups[0].starting, 'Gordon').live, true);
  assert.equal(byName(snap.groups[0].starting, 'Gordon').minute, "67'");
  assert.equal(byName(snap.groups[0].starting, 'Saliba').pos, 'DEF');
  assert.equal(byName(snap.groups[0].starting, 'Saliba').oppShort, 'LIV');
  const not = snap.groups[0].notStarting;
  assert.deepEqual(
    not.map((p) => [p.name, p.role, p.fixtureId]),
    [
      ['Trent', 'bench', 100],
      ['Trent', 'nis', 400],
      ['Saka', 'nis', 100],
      ['Saka', 'nis', 400],
    ],
  );
  assert.deepEqual(names(snap.groups[0].waiting), ['Haaland']);
  assert.equal(names(snap.groups[0].starting).includes('Raya'), false);
  const menu = listAnnouncedFixtures(fixtures, teamById);
  assert.deepEqual(menu.map((f) => f.id), [400, 300, 100]);
  assert.equal(menu.some((f) => f.id === 200), false);
  assert.equal(menu.find((f) => f.id === 400).finished, true);
  assert.equal(menu.find((f) => f.id === 300).live, true);
});

test('a fixture filter drops other matches and every waiting row', () => {
  const snap = buildStartingSnapshot({
    fixtures,
    squads,
    elementById,
    teamById,
    fixtureId: 100,
  });
  assert.deepEqual(names(snap.groups[0].starting), ['Saliba']);
  assert.deepEqual(names(snap.groups[0].notStarting), ['Trent', 'Saka']);
  assert.deepEqual(snap.groups[0].waiting, []);
  assert.equal(names(snap.groups[0].starting).includes('Gordon'), false);
});

test('team and fixture together are the intersection', () => {
  const snap = buildStartingSnapshot({
    fixtures,
    squads,
    elementById,
    teamById,
    teamId: 1,
    fixtureId: 300,
  });
  assert.deepEqual(names(snap.groups[0].starting), ['Gordon']);
  assert.deepEqual(snap.groups[0].notStarting, []);
  assert.deepEqual(snap.groups[0].waiting, []);
  const other = buildStartingSnapshot({
    fixtures,
    squads,
    elementById,
    teamById,
    teamId: 99,
    fixtureId: 300,
  });
  assert.deepEqual(other.groups, []);
});

test('before any sheet is out, scheduled players are not dumped in as waiting', () => {
  const onlyScheduled = [fixtures[1]];
  const snap = buildStartingSnapshot({
    fixtures: onlyScheduled,
    squads,
    elementById,
    teamById,
  });
  assert.equal(snap.announcedCount, 0);
  assert.deepEqual(snap.groups, []);
  assert.deepEqual(listAnnouncedFixtures(onlyScheduled, teamById), []);
});

test('a finished gameweek still shows who started', () => {
  const played = [fixtures[3]];
  const snap = buildStartingSnapshot({
    fixtures: played,
    squads,
    elementById,
    teamById,
  });
  assert.deepEqual(names(snap.groups[0].starting), ['Saliba', 'Gordon']);
  assert.equal(byName(snap.groups[0].starting, 'Saliba').finished, true);
  assert.equal(byName(snap.groups[0].starting, 'Gordon').oppShort, 'ARS');
  assert.deepEqual(
    snap.groups[0].notStarting.map((p) => [p.name, p.role]),
    [
      ['Trent', 'nis'],
      ['Saka', 'nis'],
    ],
  );
  assert.deepEqual(snap.groups[0].waiting, []);
  const menu = listAnnouncedFixtures(played, teamById);
  assert.deepEqual(menu.map((f) => [f.id, f.finished]), [[400, true]]);
});

test('a confirmed sheet with no resolved ids is waiting, not out', () => {
  const unresolved = [
    match({
      id: 100,
      home: 10,
      away: 11,
      kickoff: '2026-04-12T16:30:00Z',
      homeSide: side(true, [1], [3]),
      awaySide: side(true, [], []),
    }),
    match({
      id: 500,
      home: 30,
      away: 31,
      kickoff: '2026-04-12T13:00:00Z',
      homeSide: { confirmed: true, xi: [{ elementId: null }], bench: [] },
      awaySide: { confirmed: true, xi: [], bench: [] },
    }),
  ];
  const snap = buildStartingSnapshot({ fixtures: unresolved, squads, elementById, teamById });
  assert.deepEqual(names(snap.groups[0].starting), ['Saliba']);
  const gordon = snap.groups[0].waiting.find((p) => p.name === 'Gordon');
  assert.ok(gordon);
  assert.equal(gordon.role, 'wait');
  assert.equal(
    snap.groups[0].notStarting.some((p) => p.name === 'Gordon'),
    false,
  );
});

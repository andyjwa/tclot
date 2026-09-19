import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAIVER_MATCH_EVENT_IDS,
  claimedLineupElementIds,
  collectSideEvents,
  explainStatValuesForFixture,
  liveRowToMatchPlayer,
  playerMatchEventEntries,
  premFixturePlayerRows,
} from './matchEvents.js';

function row(partial) {
  return {
    element: 1,
    displayName: 'Dunk',
    posSingular: 'DEF',
    minutes: 90,
    goalsScored: 0,
    assists: 0,
    dcCount: 0,
    cleanSheets: 0,
    saves: 0,
    penaltiesSaved: 0,
    yellowCards: 0,
    redCards: 0,
    bonus: 0,
    bonusConfirmed: true,
    owner: { leagueEntryId: 1, teamName: 'Suffolk' },
    ...partial,
  };
}

test('playerMatchEventEntries — G / A / DC / CS / cards / B', () => {
  const ev = playerMatchEventEntries(
    row({
      goalsScored: 2,
      assists: 1,
      dcCount: 15,
      cleanSheets: 1,
      yellowCards: 1,
      bonus: 3,
    }),
  );
  assert.equal(ev.g[0].tag, '×2');
  assert.equal(ev.a[0].tag, '');
  assert.equal(ev.dc[0].tag, '(15)');
  assert.equal(ev.cs.length, 1);
  assert.equal(ev.y.length, 1);
  assert.equal(ev.b[0].tag, '+3');
});

test('collectSideEvents — waiver players only keep G / A / B', () => {
  const owned = row({
    element: 10,
    displayName: 'Buendía',
    posSingular: 'MID',
    yellowCards: 1,
    dcCount: 12,
    owner: { leagueEntryId: 5220, teamName: 'Suffolk Sméagol' },
  });
  const waiverGoal = row({
    element: 20,
    displayName: 'Watkins',
    posSingular: 'FWD',
    goalsScored: 1,
    yellowCards: 1,
    dcCount: 12,
    owner: null,
  });
  const waiverCardOnly = row({
    element: 21,
    displayName: 'Konsa',
    posSingular: 'DEF',
    yellowCards: 1,
    cleanSheets: 1,
    owner: null,
  });
  const ev = collectSideEvents([owned, waiverGoal, waiverCardOnly], {
    waiverKindIds: WAIVER_MATCH_EVENT_IDS,
  });
  assert.deepEqual(
    ev.g.map((e) => e.name),
    ['Watkins'],
  );
  assert.equal(ev.g[0].onWaiver, true);
  assert.deepEqual(
    ev.y.map((e) => e.name),
    ['Buendía'],
  );
  assert.equal(ev.dc[0].name, 'Buendía');
  assert.equal(ev.cs.length, 0);
});

test('collectSideEvents — owned starter keeps yellow and DC', () => {
  const ev = collectSideEvents(
    [
      row({
        displayName: 'N.Jackson',
        posSingular: 'FWD',
        yellowCards: 1,
        dcCount: 12,
        owner: { leagueEntryId: 4259, teamName: 'Atlético Bilbo' },
      }),
    ],
    { waiverKindIds: WAIVER_MATCH_EVENT_IDS },
  );
  assert.equal(ev.y[0].name, 'N.Jackson');
  assert.equal(ev.y[0].onWaiver, false);
  assert.equal(ev.dc[0].tag, '(12)');
});

test('premFixturePlayerRows — splits owners and live stats by club', () => {
  const elementById = {
    41: { id: 41, web_name: 'Buendía', team: 2, element_type: 3 },
    166: { id: 166, web_name: 'N.Jackson', team: 2, element_type: 4 },
    99: { id: 99, web_name: 'Watkins', team: 2, element_type: 4 },
    7: { id: 7, web_name: 'Salah', team: 14, element_type: 3 },
  };
  const liveByElementId = {
    41: { minutes: 90, goals_scored: 0, assists: 1, yellow_cards: 0, bonus: 0 },
    166: { minutes: 70, goals_scored: 0, yellow_cards: 1, bonus: 0 },
    99: { minutes: 90, goals_scored: 1, yellow_cards: 1, bonus: 2 },
  };
  const ownerByEl = new Map([
    [41, { leagueEntryId: 5220, teamName: 'Suffolk Sméagol' }],
    [166, { leagueEntryId: 4259, teamName: 'Atlético Bilbo', onFantasyBench: true }],
  ]);
  const rows = premFixturePlayerRows({
    plTeamId: 2,
    elementById,
    liveByElementId,
    liveFullByElementId: {},
    ownerByEl,
  });
  assert.equal(rows.length, 3);
  assert.equal(rows.find((r) => r.element === 7), undefined);
  const buendia = rows.find((r) => r.element === 41);
  const jackson = rows.find((r) => r.element === 166);
  const watkins = rows.find((r) => r.element === 99);
  assert.equal(buendia.assists, 1);
  assert.equal(buendia.owner.teamName, 'Suffolk Sméagol');
  assert.equal(jackson.yellowCards, 1);
  assert.equal(watkins.owner, null);
  assert.equal(watkins.goalsScored, 1);
  assert.equal(watkins.bonus, 2);
});

test('premFixturePlayerRows — announced lineup wins over bootstrap club', () => {
  const elementById = {
    166: { id: 166, web_name: 'N.Jackson', team: 6, element_type: 4 },
    28: { id: 28, web_name: 'Martinez', team: 2, element_type: 1 },
    200: { id: 200, web_name: 'Lacroix', team: 6, element_type: 2 },
  };
  const liveByElementId = {
    166: { minutes: 48, yellow_cards: 1 },
    28: { minutes: 90, saves: 3 },
    200: { minutes: 90, defensive_contribution: 12 },
  };
  const ownerByEl = new Map([
    [166, { leagueEntryId: 4259, teamName: 'Atlético Bilbo' }],
    [28, { leagueEntryId: 4259, teamName: 'Atlético Bilbo' }],
  ]);
  const villaLineup = { xi: [{ elementId: 166 }, { elementId: 28 }], bench: [] };
  const claimed = new Set([166, 28]);
  const villaRows = premFixturePlayerRows({
    plTeamId: 2,
    elementById,
    liveByElementId,
    liveFullByElementId: {},
    ownerByEl,
    sideLineup: villaLineup,
    claimedElementIds: claimed,
    fixtureId: 501,
  });
  assert.ok(villaRows.find((r) => r.element === 166));
  assert.equal(villaRows.find((r) => r.element === 166).yellowCards, 1);
  assert.equal(villaRows.find((r) => r.element === 28).saves, 3);
  const cheRows = premFixturePlayerRows({
    plTeamId: 6,
    elementById,
    liveByElementId,
    liveFullByElementId: {},
    ownerByEl,
    sideLineup: { xi: [], bench: [] },
    claimedElementIds: claimed,
    fixtureId: 502,
  });
  assert.equal(cheRows.find((r) => r.element === 166), undefined);
  assert.ok(cheRows.find((r) => r.element === 200));
});

test('explainStatValuesForFixture — other fixture does not leak', () => {
  const liveRow = {
    stats: { minutes: 90, yellow_cards: 1, saves: 3 },
    explain: [
      [[{ stat: 'minutes', value: 90 }, { stat: 'yellow_cards', value: 1 }], 502],
    ],
  };
  assert.deepEqual(explainStatValuesForFixture(liveRow, 501), { otherFixture: true });
  const mine = explainStatValuesForFixture(liveRow, 502);
  assert.equal(mine.yellowCards, 1);
  assert.equal(mine.minutes, 90);
});

test('liveRowToMatchPlayer — explain for another fixture zeros events', () => {
  const el = { id: 166 };
  const liveFull = {
    166: {
      stats: { minutes: 90, yellow_cards: 1 },
      explain: [
        [[{ stat: 'minutes', value: 90 }, { stat: 'yellow_cards', value: 1 }], 502],
      ],
    },
  };
  const leaked = liveRowToMatchPlayer(el, {}, liveFull, { fixtureId: 501 });
  assert.equal(leaked.yellowCards, 0);
  assert.equal(leaked.minutes, 0);
  const home = liveRowToMatchPlayer(el, {}, liveFull, { fixtureId: 502 });
  assert.equal(home.yellowCards, 1);
});

test('collectSideEvents — owned keeper save points stay; waiver cards drop', () => {
  const ev = collectSideEvents(
    [
      row({
        element: 28,
        displayName: 'Martinez',
        posSingular: 'GKP',
        saves: 3,
        owner: { leagueEntryId: 4259, teamName: 'Atlético Bilbo' },
      }),
      row({
        element: 53,
        displayName: 'Manzambi',
        posSingular: 'MID',
        goalsScored: 1,
        yellowCards: 1,
        bonus: 3,
        owner: null,
      }),
    ],
    { waiverKindIds: WAIVER_MATCH_EVENT_IDS },
  );
  assert.equal(ev.sv[0].name, 'Martinez');
  assert.equal(ev.sv[0].tag, '(3)');
  assert.deepEqual(ev.g.map((e) => e.name), ['Manzambi']);
  assert.equal(ev.g[0].onWaiver, true);
  assert.equal(ev.y.length, 0);
  assert.equal(ev.b[0].name, 'Manzambi');
});

test('claimedLineupElementIds — both sides of every row', () => {
  const s = claimedLineupElementIds([
    {
      lineups: {
        home: { xi: [{ elementId: 1 }], bench: [{ elementId: 2 }] },
        away: { xi: [{ elementId: 3 }], bench: [] },
      },
    },
  ]);
  assert.deepEqual([...s].sort((a, b) => a - b), [1, 2, 3]);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bpsForElementInFixture,
  bpsForFixtureFromExplain,
  computeProvisionalGwBonusByElementId,
  gwTeamFixturesAllHardFinished,
  selectDisplayBonus,
} from './fplBonusFromBps.js';

test('selectDisplayBonus — trust API zero when all club fixtures hard-finished', () => {
  assert.equal(
    selectDisplayBonus(0, 2, { trustApiZero: true }),
    0,
    'drop stale BPS provisional when FPL confirms 0 bonus'
  );
  assert.equal(selectDisplayBonus(0, 2, { trustApiZero: false }), 2);
  assert.equal(selectDisplayBonus(0, 2, {}), 2);
  assert.equal(selectDisplayBonus(3, 2, { trustApiZero: true }), 3);
});

test('gwTeamFixturesAllHardFinished', () => {
  const team = 1;
  assert.equal(
    gwTeamFixturesAllHardFinished(team, [
      { team_h: team, team_a: 2, finished: true },
      { team_h: 3, team_a: team, finished: false },
    ]),
    false
  );
  assert.equal(
    gwTeamFixturesAllHardFinished(team, [
      { team_h: team, team_a: 2, finished: true },
      { team_h: 3, team_a: team, finished: true },
    ]),
    true
  );
});

test('bpsForFixtureFromExplain — classic + draft shapes', () => {
  const fid = 9001;
  const classic = {
    explain: [
      {
        fixture: fid,
        stats: [
          { identifier: 'minutes', value: '90' },
          { identifier: 'bps', value: '41' },
        ],
      },
    ],
  };
  assert.equal(bpsForFixtureFromExplain(classic, fid), 41);
  assert.equal(bpsForFixtureFromExplain(classic, 9999), null);

  const draft = {
    explain: [
      [
        [
          { stat: 'minutes', value: 90 },
          { stat: 'bps', value: 52 },
        ],
        fid,
      ],
    ],
  };
  assert.equal(bpsForFixtureFromExplain(draft, fid), 52);
});

test('DGW — do not use GW aggregate stats.bps inside one fixture pool', () => {
  const mci = 12;
  const cry = 5;
  const el = { id: 1, team: mci };
  const fixtureA = { id: 101, team_h: mci, team_a: 3 };
  const fixtureB = { id: 102, team_h: mci, team_a: cry };
  const gwFixtures = [fixtureA, fixtureB];

  const liveRow = {
    stats: { minutes: 180, bps: 84, bonus: 0 },
    explain: [
      {
        fixture: fixtureA.id,
        stats: [
          { identifier: 'minutes', value: '90' },
          { identifier: 'bps', value: '25' },
        ],
      },
      {
        fixture: fixtureB.id,
        stats: [
          { identifier: 'minutes', value: '90' },
          { identifier: 'bps', value: '59' },
        ],
      },
    ],
  };

  assert.equal(bpsForElementInFixture(el, liveRow, fixtureA.id, gwFixtures), 25);
  assert.equal(bpsForElementInFixture(el, liveRow, fixtureB.id, gwFixtures), 59);

  const liveRowExplainMissingBpsForB = {
    stats: { minutes: 180, bps: 84, bonus: 0 },
    explain: [
      {
        fixture: fixtureA.id,
        stats: [
          { identifier: 'minutes', value: '90' },
          { identifier: 'bps', value: '25' },
        ],
      },
      {
        fixture: fixtureB.id,
        stats: [{ identifier: 'minutes', value: '90' }],
      },
    ],
  };
  assert.equal(
    bpsForElementInFixture(el, liveRowExplainMissingBpsForB, fixtureB.id, gwFixtures),
    null,
    'DGW + minutes but no bps line yet must not fall back to aggregate 84'
  );

  const liveRowWrongSingleBlock = {
    stats: { minutes: 90, bps: 84, bonus: 0 },
    explain: [
      {
        fixture: fixtureB.id,
        stats: [
          { identifier: 'minutes', value: '90' },
          { identifier: 'bps', value: '30' },
        ],
      },
    ],
  };
  assert.equal(
    bpsForElementInFixture(el, liveRowWrongSingleBlock, fixtureB.id, gwFixtures),
    30
  );
  assert.equal(
    bpsForElementInFixture(el, liveRowWrongSingleBlock, fixtureA.id, gwFixtures),
    null
  );
  assert.equal(
    bpsForElementInFixture(el, { stats: { minutes: 90, bps: 84 } }, fixtureB.id, gwFixtures),
    null,
    'DGW with empty explain must not use aggregate BPS'
  );
});

test('computeProvisionalGwBonusByElementId ranks DGW pool on per-fixture BPS only', () => {
  const mci = 12;
  const cry = 5;
  const opp = 3;
  const fidA = 201;
  const fidB = 202;
  const gwFixtures = [
    { id: fidA, team_h: mci, team_a: opp },
    { id: fidB, team_h: mci, team_a: cry },
  ];
  const bootElements = [
    { id: 1, team: mci },
    { id: 2, team: cry },
    { id: 99, team: opp },
  ];
  const liveFullByElementId = {
    99: {
      stats: { bps: 100 },
      explain: [
        {
          fixture: fidA,
          stats: [
            { identifier: 'minutes', value: '90' },
            { identifier: 'bps', value: '100' },
          ],
        },
      ],
    },
    1: {
      stats: { bps: 80 },
      explain: [
        {
          fixture: fidA,
          stats: [
            { identifier: 'minutes', value: '90' },
            { identifier: 'bps', value: '70' },
          ],
        },
        {
          fixture: fidB,
          stats: [
            { identifier: 'minutes', value: '90' },
            { identifier: 'bps', value: '10' },
          ],
        },
      ],
    },
    2: {
      stats: { bps: 40 },
      explain: [
        {
          fixture: fidB,
          stats: [
            { identifier: 'minutes', value: '90' },
            { identifier: 'bps', value: '40' },
          ],
        },
      ],
    },
  };
  const prov = computeProvisionalGwBonusByElementId(
    bootElements,
    liveFullByElementId,
    gwFixtures
  );
  assert.equal(
    prov.get(1),
    4,
    'two fixtures: 2nd in A on 70 vs 100, 2nd in B on 10 vs 40'
  );
  assert.equal(prov.get(2), 3, 'tops fixture B on 40 vs 10, not GW aggregate 80');
  assert.equal(prov.get(99), 3);
});

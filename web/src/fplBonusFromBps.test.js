import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyBonusColumn,
  penaltiesSavedFromLiveRow,
  bonusForFixtureFromExplain,
  bpsForElementInFixture,
  bpsForFixtureFromExplain,
  computeProvisionalGwBonusByElementId,
  fixtureHasOfficialBonus,
  gwTeamFixturesAllHardFinished,
  officialBonusFromFixtureStats,
  officialGwBonusByElementId,
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

function liveMinutesBpsBonus(fid, minutes, bps, bonus) {
  const stats = [{ identifier: 'minutes', value: String(minutes) }];
  if (bps != null) stats.push({ identifier: 'bps', value: String(bps) });
  if (bonus != null) stats.push({ identifier: 'bonus', value: String(bonus) });
  return {
    stats: { minutes, bps: bps ?? 0, bonus: bonus ?? 0 },
    explain: [{ fixture: fid, stats }],
  };
}

test('bonusForFixtureFromExplain — classic + draft', () => {
  const fid = 77;
  assert.equal(
    bonusForFixtureFromExplain(
      {
        explain: [
          {
            fixture: fid,
            stats: [
              { identifier: 'minutes', value: '90' },
              { identifier: 'bonus', value: '3' },
            ],
          },
        ],
      },
      fid
    ),
    3
  );
  assert.equal(
    bonusForFixtureFromExplain(
      {
        explain: [
          [
            [
              { stat: 'minutes', value: 90 },
              { stat: 'bonus', value: 2 },
            ],
            fid,
          ],
        ],
      },
      fid
    ),
    2
  );
  assert.equal(bonusForFixtureFromExplain({ explain: [] }, fid), null);
});

test('officialBonusFromFixtureStats reads the classic bonus slate', () => {
  const fx = {
    id: 1,
    stats: [
      {
        identifier: 'bonus',
        h: [
          { value: 3, element: 94 },
          { value: 1, element: 12 },
        ],
        a: [{ value: 2, element: 80 }],
      },
    ],
  };
  const m = officialBonusFromFixtureStats(fx);
  assert.equal(m.get(94), 3);
  assert.equal(m.get(80), 2);
  assert.equal(m.get(12), 1);
  assert.equal(officialGwBonusByElementId([fx]).get(94), 3);
});

test('Schade official 3 locks the fixture — Collins does not keep a BPS medal', () => {
  const bre = 4;
  const opp = 16;
  const fid = 500;
  const schade = 94;
  const collins = 84;
  const shaw = 423;
  const gwFixtures = [
    {
      id: fid,
      team_h: bre,
      team_a: opp,
      finished: false,
      finished_provisional: true,
      stats: [],
    },
  ];
  const bootElements = [
    { id: schade, team: bre },
    { id: collins, team: bre },
    { id: shaw, team: opp },
  ];
  const liveFullByElementId = {
    [schade]: liveMinutesBpsBonus(fid, 90, 28, 3),
    [collins]: liveMinutesBpsBonus(fid, 90, 41, 0),
    [shaw]: liveMinutesBpsBonus(fid, 90, 22, 0),
  };

  assert.equal(
    fixtureHasOfficialBonus(gwFixtures[0], bootElements, liveFullByElementId, gwFixtures),
    true,
    'Schade stats.bonus=3 means official slate is posted'
  );

  const prov = computeProvisionalGwBonusByElementId(
    bootElements,
    liveFullByElementId,
    gwFixtures
  );
  assert.equal(prov.get(collins), undefined, 'do not award Collins a BPS 3/2/1');
  assert.equal(prov.get(shaw), undefined);
  assert.equal(prov.get(schade), undefined);

  const rows = applyBonusColumn(
    [
      { element: schade, bonusApi: 3, total_points: 8 },
      { element: collins, bonusApi: 0, total_points: 6 },
      { element: shaw, bonusApi: 0, total_points: 2 },
    ],
    prov,
    Object.fromEntries(bootElements.map((e) => [e.id, e])),
    gwFixtures
  );
  const byId = Object.fromEntries(rows.map((r) => [r.element, r]));
  assert.equal(byId[schade].bonus, 3);
  assert.equal(byId[schade].bonusConfirmed, true);
  assert.equal(byId[collins].bonus, 0);
  assert.equal(byId[collins].bonusConfirmed, false);
  assert.equal(byId[shaw].bonus, 0);
});

test('fixture.stats slate beats a stale BPS ranking (Shaw/Mbeumo still live elsewhere)', () => {
  const bre = 4;
  const mun = 16;
  const breFx = {
    id: 601,
    team_h: bre,
    team_a: 3,
    finished: false,
    finished_provisional: true,
    stats: [
      {
        identifier: 'bonus',
        h: [{ value: 3, element: 94 }],
        a: [
          { value: 2, element: 7 },
          { value: 1, element: 8 },
        ],
      },
    ],
  };
  const munFx = {
    id: 602,
    team_h: mun,
    team_a: 1,
    finished: false,
    finished_provisional: false,
    stats: [],
  };
  const gwFixtures = [breFx, munFx];
  const bootElements = [
    { id: 94, team: bre },
    { id: 84, team: bre },
    { id: 7, team: 3 },
    { id: 8, team: 3 },
    { id: 423, team: mun },
    { id: 427, team: mun },
    { id: 9, team: 1 },
  ];
  const liveFullByElementId = {
    94: liveMinutesBpsBonus(601, 90, 20, 0),
    84: liveMinutesBpsBonus(601, 90, 50, 0),
    7: liveMinutesBpsBonus(601, 90, 18, 0),
    8: liveMinutesBpsBonus(601, 90, 10, 0),
    423: liveMinutesBpsBonus(602, 70, 40, 0),
    427: liveMinutesBpsBonus(602, 70, 31, 0),
    9: liveMinutesBpsBonus(602, 70, 12, 0),
  };

  const official = officialGwBonusByElementId(gwFixtures);
  assert.equal(official.get(94), 3);
  assert.equal(official.get(84), undefined);

  const prov = computeProvisionalGwBonusByElementId(
    bootElements,
    liveFullByElementId,
    gwFixtures
  );
  assert.equal(prov.get(84), undefined, 'Brentford fixture locked by official slate');
  assert.equal(prov.get(423), 3, 'Man Utd still live — BPS estimate ok');
  assert.equal(prov.get(427), 2);

  const rows = applyBonusColumn(
    [
      { element: 94, bonusApi: 0, total_points: 5 },
      { element: 84, bonusApi: 0, total_points: 6 },
      { element: 423, bonusApi: 0, total_points: 2 },
      { element: 427, bonusApi: 0, total_points: 2 },
    ],
    prov,
    Object.fromEntries(bootElements.map((e) => [e.id, e])),
    gwFixtures,
    official
  );
  const byId = Object.fromEntries(rows.map((r) => [r.element, r]));
  assert.equal(byId[94].bonus, 3);
  assert.equal(byId[94].bonusConfirmed, true);
  assert.equal(byId[94].total_points, 8, 'official 3 folded into pts when live stats.bonus still 0');
  assert.equal(byId[84].bonus, 0);
  assert.equal(byId[423].bonus, 3);
  assert.equal(byId[423].bonusConfirmed, false, 'BPS estimate is not confirmed');
  assert.equal(byId[427].bonus, 2);
  assert.equal(byId[427].bonusConfirmed, false);
});

test('penaltiesSavedFromLiveRow — stats first, then draft or classic explain', () => {
  assert.equal(penaltiesSavedFromLiveRow({ stats: { penalties_saved: 1 } }), 1);
  assert.equal(penaltiesSavedFromLiveRow({ stats: { penalties_saved: 0 } }), 0);
  assert.equal(
    penaltiesSavedFromLiveRow({
      explain: [[[{ stat: 'penalties_saved', value: 1 }], 10]],
    }),
    1,
  );
  assert.equal(
    penaltiesSavedFromLiveRow({
      explain: [{ fixture: 4, stats: [{ identifier: 'penalties_saved', value: 2 }] }],
    }),
    2,
  );
  assert.equal(penaltiesSavedFromLiveRow(null), 0);
});

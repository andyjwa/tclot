import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bootstrapElementToPlayer,
  injuryDoubtScoreFromClassicElement,
  pickLikelyClassicXiElements,
  bootstrapTeamToPredictionTeam,
  predictedStatsForPickRow,
} from './livePredictionMappers.js';

/** Minimal bootstrap row for mapper smoke tests */
function stubElement(overrides) {
  return {
    id: 624,
    web_name: 'Stub',
    first_name: 'Test',
    team: 19,
    element_type: 4,
    minutes: 2689,
    starts: 30,
    creativity: '100',
    threat: '200',
    ict_index: '150',
    clearances_blocks_interceptions: 20,
    tackles: 20,
    recoveries: 50,
    yellow_cards: 2,
    red_cards: 0,
    saves: 0,
    expected_goals: '6',
    expected_assists: '4',
    status: 'a',
    ...overrides,
  };
}

test('injuryDoubtScoreFromClassicElement — null chance is not treated as 0%', () => {
  assert.equal(injuryDoubtScoreFromClassicElement({ status: 'a', chance_of_playing_this_round: null }), 0);
});

test('injuryDoubtScoreFromClassicElement — undefined / empty treated as healthy', () => {
  assert.equal(injuryDoubtScoreFromClassicElement({ status: 'a', chance_of_playing_this_round: undefined }), 0);
  assert.equal(injuryDoubtScoreFromClassicElement({ status: 'a', chance_of_playing_this_round: '' }), 0);
});

test('injuryDoubtScoreFromClassicElement — partial percentages add doubt', () => {
  const d75 = injuryDoubtScoreFromClassicElement({ status: 'a', chance_of_playing_this_round: 75 });
  assert.ok(d75 > 0 && d75 <= 100 / 28);
});

test('injuryDoubtScoreFromClassicElement — injured status caps path', () => {
  assert.equal(injuryDoubtScoreFromClassicElement({ status: 'i', chance_of_playing_this_round: 100 }), 3);
});

test('bootstrapElementToPlayer passes through fixed doubt score on null chance_of_playing', () => {
  const p = bootstrapElementToPlayer(
    stubElement({ chance_of_playing_this_round: null }),
  );
  assert.equal(p.injuryDoubtScore, 0);
});

test('bootstrapElementToPlayer — explicit 75% scales doubt', () => {
  const p = bootstrapElementToPlayer(
    stubElement({ chance_of_playing_this_round: 75 }),
  );
  assert.ok(p.injuryDoubtScore > 0);
});

test('pickLikelyClassicXiElements returns 11 rows with exactly one GK', () => {
  const elementById = {};
  elementById[1] = {
    id: 1,
    team: 7,
    removed: false,
    element_type: 1,
    starts: 30,
    minutes: 3000,
  };
  /** 13 outfield depth so top-10 outfield selection always fills */
  for (let i = 0; i < 13; i++) {
    const id = i + 2;
    elementById[String(id)] = {
      id,
      team: 7,
      removed: false,
      element_type: 2 + (i % 3),
      starts: 25 - Math.floor(i / 4),
      minutes: 2000 - i,
    };
  }

  const xi = pickLikelyClassicXiElements(7, elementById);
  assert.equal(xi.length, 11);
  assert.equal(xi[0].element_type, 1);
  assert.equal(xi[0].id, 1);
  assert.ok(xi.slice(1).every((e) => Number(e.element_type) !== 1));
  assert.equal(new Set(xi.map((e) => e.id)).size, 11);
});

/** Two-team bootstrap with a single GW fixture, enough for the match-MC path. */
function statsCtxFixture() {
  const elementById = {};
  const addSquad = (teamId, base) => {
    // 1 GK (type 1), 4 DEF (2), 4 MID (3), 4 FWD (4) = 13 depth.
    const types = [1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4];
    types.forEach((t, i) => {
      const id = base + i;
      elementById[String(id)] = {
        id,
        web_name: `P${id}`,
        team: teamId,
        element_type: t,
        minutes: 2200,
        starts: 26,
        creativity: '120',
        threat: t === 4 ? '260' : '90',
        ict_index: '140',
        clearances_blocks_interceptions: 24,
        tackles: 22,
        recoveries: 48,
        yellow_cards: 2,
        red_cards: 0,
        saves: t === 1 ? 90 : 0,
        expected_goals: t === 4 ? '8' : t === 3 ? '3' : '0.5',
        expected_assists: t === 3 ? '4' : '1',
        status: 'a',
      };
    });
  };
  addSquad(7, 1);
  addSquad(8, 101);
  const teamsById = new Map();
  for (const id of [7, 8]) {
    const tm = bootstrapTeamToPredictionTeam({ id, name: `Team ${id}` });
    teamsById.set(tm.id, tm);
  }
  const gwFixtures = [
    { event: 3, id: 500, team_h: 7, team_a: 8, kickoff_time: '2026-01-01T15:00:00Z' },
  ];
  return { ctx: { elementById, gwFixtures }, teamsById };
}

test('predictedStatsForPickRow returns finite stat contributions; FWD never gets CS', () => {
  const { ctx, teamsById } = statsCtxFixture();
  const config = { simulationIterations: 200 };

  // id 10 is a FWD on team 7 (base 1 + index 9).
  const fwd = predictedStatsForPickRow({ element: 10 }, ctx, teamsById, 3, config, 1);
  assert.ok(fwd, 'expected a stats object for the FWD');
  // `Number(x) || 0` keeps every field finite even if the model returns NaN.
  for (const k of ['xp', 'goals', 'assists', 'cs', 'defcon']) {
    assert.ok(Number.isFinite(fwd[k]) && fwd[k] >= 0, `${k} should be a non-negative finite number`);
  }
  assert.equal(fwd.cs, 0, 'forwards must not contribute clean-sheet expectation');

  // A CS-eligible defender still returns a finite, non-negative cs contribution.
  const def = predictedStatsForPickRow({ element: 2 }, ctx, teamsById, 3, config, 2);
  assert.ok(def);
  assert.ok(Number.isFinite(def.cs) && def.cs >= 0);
});

test('predictedStatsForPickRow returns null when the pick has no GW fixture', () => {
  const { ctx, teamsById } = statsCtxFixture();
  ctx.gwFixtures = [];
  assert.equal(predictedStatsForPickRow({ element: 10 }, ctx, teamsById, 3, {}, 0), null);
});

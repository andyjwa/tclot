import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bootstrapElementToPlayer,
  injuryDoubtScoreFromClassicElement,
  pickLikelyClassicXiElements,
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

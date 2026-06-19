import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseKey, buildReconciliationMaps } from './reconcilePlayerIds.js';

test('normaliseKey strips accents, punctuation and lowercases', () => {
  assert.equal(normaliseKey('Kevin', 'De Bruyne', 11), 'kevin_debruyne_11'); // spaces stripped
  assert.equal(normaliseKey('Mathias', 'Jörgensen', 5), 'mathias_jorgensen_5');
  assert.equal(normaliseKey("Conor", "O'Brien", 3), 'conor_obrien_3');
  assert.equal(normaliseKey('Amad', 'Diallo-Williams', 14), 'amad_diallowilliams_14');
});

test('normaliseKey tolerates missing parts', () => {
  assert.equal(normaliseKey(undefined, 'Solo', 1), '_solo_1');
});

test('buildReconciliationMaps: code is the primary join and surfaces id-space divergence', () => {
  const regular = [
    { id: 1, code: 100, first_name: 'A', second_name: 'One', team: 1, web_name: 'One' },
    { id: 2, code: 200, first_name: 'B', second_name: 'Two', team: 1, web_name: 'Two' },
  ];
  const draft = [
    { id: 1, code: 100, first_name: 'A', second_name: 'One', team: 1, web_name: 'One' },
    // same player (code 200) but different draft id → divergence
    { id: 9, code: 200, first_name: 'B', second_name: 'Two', team: 1, web_name: 'Two' },
  ];
  const r = buildReconciliationMaps(regular, draft);
  assert.equal(r.regularToDraftMap[2], 9);
  assert.equal(r.draftToRegularMap[9], 2);
  assert.equal(r.counts.codeMatched, 2);
  assert.equal(r.counts.idSpaceDivergences, 1);
  assert.equal(r.idSpaceDivergences[0].regularId, 2);
  assert.equal(r.idSpaceDivergences[0].draftId, 9);
  assert.equal(r.idSpaceDivergences[0].matchedBy, 'code');
});

test('buildReconciliationMaps: name fallback when code missing/unmatched', () => {
  const regular = [
    { id: 5, code: 999, first_name: 'Carlos', second_name: 'Núñez', team: 7, web_name: 'Núñez' },
  ];
  const draft = [
    // no code 999; matched by normalised name+team
    { id: 42, code: 555, first_name: 'Carlos', second_name: 'Nunez', team: 7, web_name: 'Nunez' },
  ];
  const r = buildReconciliationMaps(regular, draft);
  assert.equal(r.regularToDraftMap[5], 42);
  assert.equal(r.counts.nameFallbackMatches, 1);
  assert.equal(r.counts.codeMatched, 0);
  assert.equal(r.nameFallbackMatches[0].draftId, 42);
});

test('buildReconciliationMaps: unmatched regular players are reported', () => {
  const regular = [
    { id: 8, code: 1, first_name: 'Ghost', second_name: 'Player', team: 2, web_name: 'Ghost' },
  ];
  const draft = [
    { id: 1, code: 2, first_name: 'Other', second_name: 'Guy', team: 3, web_name: 'Other' },
  ];
  const r = buildReconciliationMaps(regular, draft);
  assert.equal(r.counts.unmatchedRegular, 1);
  assert.equal(r.unmatchedRegular[0].regularId, 8);
  assert.deepEqual(r.regularToDraftMap, {});
});

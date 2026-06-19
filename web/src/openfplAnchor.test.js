import test from 'node:test';
import assert from 'node:assert/strict';
import { blendAnchorXp } from './openfplAnchor.js';

test('weight 0 returns pure engine xP (anchor off / default)', () => {
  assert.equal(blendAnchorXp(6.3, 8.0, 0), 6.3);
});

test('weight 1 returns pure OpenFPL xP', () => {
  assert.equal(blendAnchorXp(6.3, 8.0, 1), 8.0);
});

test('weight 0.5 averages the two', () => {
  assert.equal(blendAnchorXp(6.0, 8.0, 0.5), 7.0);
});

test('non-finite OpenFPL xP falls back to engine xP', () => {
  assert.equal(blendAnchorXp(6.3, NaN, 0.5), 6.3);
  assert.equal(blendAnchorXp(6.3, undefined, 0.5), 6.3);
  assert.equal(blendAnchorXp(6.3, null, 0.5), 6.3);
});

test('weight is clamped to [0,1] and non-finite weight ⇒ 0', () => {
  assert.equal(blendAnchorXp(6, 10, 2), 10); // clamped to 1
  assert.equal(blendAnchorXp(6, 10, -1), 6); // clamped to 0
  assert.equal(blendAnchorXp(6, 10, NaN), 6); // treated as 0
});

test('non-finite engine xP treated as 0', () => {
  assert.equal(blendAnchorXp(undefined, 8, 1), 8);
  assert.equal(blendAnchorXp(NaN, 8, 0.5), 4);
});

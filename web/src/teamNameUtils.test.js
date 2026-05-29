import test from 'node:test';
import assert from 'node:assert/strict';
import { firstWord } from './teamNameUtils.js';

test('firstWord — multi-word names collapse to leading token', () => {
  assert.equal(firstWord('Crouch End Oashisu'), 'Crouch');
  assert.equal(firstWord('Hanson of York AFC'), 'Hanson');
  assert.equal(firstWord('Toronto Wiggum'), 'Toronto');
});

test('firstWord — single-word names pass through unchanged', () => {
  assert.equal(firstWord('Brampton'), 'Brampton');
  assert.equal(firstWord('Hackney'), 'Hackney');
});

test('firstWord — null/empty/whitespace inputs return empty string', () => {
  assert.equal(firstWord(null), '');
  assert.equal(firstWord(undefined), '');
  assert.equal(firstWord(''), '');
  assert.equal(firstWord('   '), '');
});

test('firstWord — leading whitespace is trimmed before splitting', () => {
  assert.equal(firstWord('  Toronto Wiggum'), 'Toronto');
  assert.equal(firstWord('\tHanson of York AFC'), 'Hanson');
});

test('firstWord — non-string inputs are coerced via String()', () => {
  assert.equal(firstWord(42), '42');
});

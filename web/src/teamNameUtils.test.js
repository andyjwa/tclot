import test from 'node:test';
import assert from 'node:assert/strict';
import {
  firstWord,
  isMsfgTeamName,
  standingsMobileTeamName,
} from './teamNameUtils.js';

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

test('firstWord — 2026-27 squads use curated mobile labels', () => {
  assert.equal(firstWord('Atlético Bilbo'), 'Atleti Bilbo');
  assert.equal(firstWord('Toronto Gimli'), 'To. Gimli');
  assert.equal(firstWord('Suffolk Sméagol'), 'Sméagol');
  assert.equal(firstWord('Rokesly Regorasu'), 'Regorasu');
  assert.equal(firstWord('Hackney Rohirrim'), 'Rohirrim');
  assert.equal(firstWord('Mordor S.F.G'), 'MSFG');
  assert.equal(firstWord('Mordor SFG'), 'MSFG');
  assert.equal(firstWord('Seoul Shire'), 'Seoul Shire');
  assert.equal(firstWord('Brampton Balrogs'), 'Balrogs');
});

test('firstWord — curated labels match on trimmed input', () => {
  assert.equal(firstWord('  Toronto Gimli  '), 'To. Gimli');
});

test('isMsfgTeamName — long form, Mr. MSFG, and MSFG', () => {
  assert.equal(isMsfgTeamName('Mr Mordorlicious School for Girls'), true);
  assert.equal(isMsfgTeamName('Mr. MSFG'), true);
  assert.equal(isMsfgTeamName('MSFG'), true);
  assert.equal(isMsfgTeamName('msfg'), true);
  assert.equal(isMsfgTeamName('Mordor S.F.G'), true);
  assert.equal(isMsfgTeamName('Hackney Rohirrim'), false);
  assert.equal(isMsfgTeamName(''), false);
  assert.equal(isMsfgTeamName(null), false);
});

test('standingsMobileTeamName — full names, MSFG renders as Mordor SFG', () => {
  assert.equal(standingsMobileTeamName('Atlético Bilbo'), 'Atlético Bilbo');
  assert.equal(standingsMobileTeamName('Toronto Gimli'), 'Toronto Gimli');
  assert.equal(standingsMobileTeamName('Hackney Rohirrim'), 'Hackney Rohirrim');
  assert.equal(standingsMobileTeamName('Suffolk Sméagol'), 'Suffolk Sméagol');
  assert.equal(standingsMobileTeamName('Rokesly Regorasu'), 'Rokesly Regorasu');
  assert.equal(standingsMobileTeamName('Seoul Shire'), 'Seoul Shire');
  assert.equal(standingsMobileTeamName('Brampton Balrogs'), 'Brampton Balrogs');
  assert.equal(standingsMobileTeamName('Crouch End Oashisu'), 'Crouch End Oashisu');
  assert.equal(standingsMobileTeamName('Mr Mordorlicious School for Girls'), 'Mordor SFG');
  assert.equal(standingsMobileTeamName('Mordor S.F.G'), 'Mordor SFG');
  assert.equal(standingsMobileTeamName('Mr. MSFG'), 'Mordor SFG');
  assert.equal(standingsMobileTeamName('MSFG'), 'Mordor SFG');
  assert.equal(standingsMobileTeamName(null), '');
  assert.equal(standingsMobileTeamName('  '), '');
});

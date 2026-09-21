import test from 'node:test';
import assert from 'node:assert/strict';
import {
  firstWord,
  isMsfgTeamName,
  lastWordTeamName,
  standingsMobileTeamName,
  threeLetterTeamName,
  villainVictoryLine,
  matchupVillainVictoryLine,
  COUPLE_OF_VILLAINS_LINE,
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

test('lastWordTeamName — last word of the club name, MSFG reads Mordor', () => {
  assert.equal(lastWordTeamName('Toronto Gimli'), 'Gimli');
  assert.equal(lastWordTeamName('Atlético Bilbo'), 'Bilbo');
  assert.equal(lastWordTeamName('Hackney Rohirrim'), 'Rohirrim');
  assert.equal(lastWordTeamName('Suffolk Sméagol'), 'Sméagol');
  assert.equal(lastWordTeamName('Rokesly Regorasu'), 'Regorasu');
  assert.equal(lastWordTeamName('Brampton Balrogs'), 'Balrogs');
  assert.equal(lastWordTeamName('Seoul Shire'), 'Shire');
  assert.equal(lastWordTeamName('Crouch End Oashisu'), 'Oashisu');
  assert.equal(lastWordTeamName('Shire'), 'Shire');
  assert.equal(lastWordTeamName('Mordor SFG'), 'Mordor');
  assert.equal(lastWordTeamName('Mordor S.F.G'), 'Mordor');
  assert.equal(lastWordTeamName('Mr Mordorlicious School for Girls'), 'Mordor');
  assert.equal(lastWordTeamName(null), '');
  assert.equal(lastWordTeamName('  '), '');
});

test('threeLetterTeamName — ASCII code from the last word, MSFG reads MOR', () => {
  assert.equal(threeLetterTeamName('Toronto Gimli'), 'GIM');
  assert.equal(threeLetterTeamName('Atlético Bilbo'), 'BIL');
  assert.equal(threeLetterTeamName('Hackney Rohirrim'), 'ROH');
  assert.equal(threeLetterTeamName('Rokesly Regorasu'), 'REG');
  assert.equal(threeLetterTeamName('Brampton Balrogs'), 'BAL');
  assert.equal(threeLetterTeamName('Seoul Shire'), 'SHI');
  assert.equal(threeLetterTeamName('Mordor SFG'), 'MOR');
  assert.equal(threeLetterTeamName('Mr Mordorlicious School for Girls'), 'MOR');
});

test('threeLetterTeamName — accents fold to plain ASCII', () => {
  assert.equal(threeLetterTeamName('Suffolk Sméagol'), 'SME');
  assert.equal(threeLetterTeamName('Café'), 'CAF');
});

test('threeLetterTeamName — short and empty names degrade gracefully', () => {
  assert.equal(threeLetterTeamName('FC'), 'FC');
  assert.equal(threeLetterTeamName(null), '');
  assert.equal(threeLetterTeamName('   '), '');
});

test('threeLetterTeamName — the 2026-27 league has no colliding codes', () => {
  const clubs = [
    'Atlético Bilbo',
    'Toronto Gimli',
    'Suffolk Sméagol',
    'Rokesly Regorasu',
    'Hackney Rohirrim',
    'Mordor SFG',
    'Seoul Shire',
    'Brampton Balrogs',
  ];
  const codes = clubs.map(threeLetterTeamName);
  assert.equal(new Set(codes).size, clubs.length, `collision in ${codes.join(', ')}`);
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

test('villainVictoryLine — curated short name, never a mid-word clip', () => {
  assert.equal(villainVictoryLine('Rokesly Regorasu'), 'Regorasu is a villain!');
  assert.equal(villainVictoryLine('Hackney Rohirrim'), 'Rohirrim is a villain!');
  assert.equal(villainVictoryLine('Toronto Gimli'), 'To. Gimli is a villain!');
  assert.equal(villainVictoryLine('Mordor SFG'), 'MSFG is a villain!');
  assert.equal(villainVictoryLine(null), 'Villain victory');
  assert.equal(villainVictoryLine('  '), 'Villain victory');
});

test('matchupVillainVictoryLine — couple of villains when both sides qualify', () => {
  assert.equal(
    matchupVillainVictoryLine({
      homeName: 'Rokesly Regorasu',
      awayName: 'Hackney Rohirrim',
      homeVillain: true,
      awayVillain: true,
    }),
    COUPLE_OF_VILLAINS_LINE,
  );
  assert.equal(
    matchupVillainVictoryLine({
      homeName: 'Rokesly Regorasu',
      awayName: 'Hackney Rohirrim',
      homeVillain: true,
      awayVillain: false,
    }),
    'Regorasu is a villain!',
  );
  assert.equal(
    matchupVillainVictoryLine({
      homeName: 'Rokesly Regorasu',
      awayName: 'Hackney Rohirrim',
      homeVillain: false,
      awayVillain: true,
    }),
    'Rohirrim is a villain!',
  );
  assert.equal(
    matchupVillainVictoryLine({
      homeName: 'Rokesly Regorasu',
      awayName: 'Hackney Rohirrim',
    }),
    null,
  );
});

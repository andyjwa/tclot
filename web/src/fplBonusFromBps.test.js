import assert from 'node:assert/strict';
import test from 'node:test';
import {
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

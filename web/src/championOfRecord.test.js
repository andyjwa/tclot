import test from 'node:test';
import assert from 'node:assert/strict';
import {
  championSplashAutoCollapsed,
  findChampionFixture,
} from './championOfRecord.js';

/** GW1 2026/27 deadline — Friday evening UTC. */
const GW1_DEADLINE_ISO = '2026-08-21T17:30:00Z';

/**
 * Local midnight AFTER the deadline day, computed the same way the helper
 * does so assertions hold in any test-runner timezone.
 */
function endOfDeadlineDayMs(iso) {
  const d = new Date(Date.parse(iso));
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
}

test('championSplashAutoCollapsed', async (t) => {
  await t.test('stays expanded before and during the deadline day', () => {
    const boundary = endOfDeadlineDayMs(GW1_DEADLINE_ISO);
    // Two days before the deadline (pre-season build-up).
    assert.equal(
      championSplashAutoCollapsed(
        GW1_DEADLINE_ISO,
        Date.parse(GW1_DEADLINE_ISO) - 2 * 24 * 3600 * 1000,
      ),
      false,
    );
    // At the deadline itself.
    assert.equal(
      championSplashAutoCollapsed(GW1_DEADLINE_ISO, Date.parse(GW1_DEADLINE_ISO)),
      false,
    );
    // Last millisecond of the deadline day (local).
    assert.equal(championSplashAutoCollapsed(GW1_DEADLINE_ISO, boundary - 1), false);
  });

  await t.test('collapses from local midnight after the deadline day', () => {
    const boundary = endOfDeadlineDayMs(GW1_DEADLINE_ISO);
    assert.equal(championSplashAutoCollapsed(GW1_DEADLINE_ISO, boundary), true);
    // Saturday afternoon / Sunday of the gameweek.
    assert.equal(
      championSplashAutoCollapsed(GW1_DEADLINE_ISO, boundary + 36 * 3600 * 1000),
      true,
    );
  });

  await t.test('missing / unparseable deadline degrades to expanded', () => {
    assert.equal(championSplashAutoCollapsed(null), false);
    assert.equal(championSplashAutoCollapsed(undefined), false);
    assert.equal(championSplashAutoCollapsed(''), false);
    assert.equal(championSplashAutoCollapsed('not-a-date'), false);
  });
});

test('findChampionFixture', async (t) => {
  // 2026/27 GW1 shape: Brampton Balrogs (44904) host Rokesly Regorasu (6849).
  const gw1Matches = [
    { league_entry_1: 18279, league_entry_2: 4259 },
    { league_entry_1: 30728, league_entry_2: 10173 },
    { league_entry_1: 44904, league_entry_2: 6849 },
    { league_entry_1: 4898, league_entry_2: 5220 },
  ];

  await t.test('finds the champion on the away side', () => {
    assert.deepEqual(findChampionFixture(gw1Matches, 6849), {
      championLeagueEntryId: 6849,
      opponentLeagueEntryId: 44904,
      championIsHome: false,
    });
  });

  await t.test('finds the champion on the home side', () => {
    assert.deepEqual(findChampionFixture(gw1Matches, 44904), {
      championLeagueEntryId: 44904,
      opponentLeagueEntryId: 6849,
      championIsHome: true,
    });
  });

  await t.test('returns null when the champion id is not in any match', () => {
    // The stale 2025/26 id — the exact failure mode this guards against.
    assert.equal(findChampionFixture(gw1Matches, 27370), null);
    assert.equal(findChampionFixture([], 6849), null);
    assert.equal(findChampionFixture(null, 6849), null);
  });
});

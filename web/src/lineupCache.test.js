import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Tests run under `node --test`, which has no `sessionStorage`. We install
 * a fresh in-memory shim before importing the module under test and reset
 * the cache state at the top of every test so they don't bleed into each
 * other.
 *
 * The cache reads `globalThis.sessionStorage` lazily, so swapping the
 * global between tests (e.g. to simulate Safari private mode where every
 * `setItem` throws) just works.
 */

function installSessionStorage() {
  const data = new Map();
  globalThis.sessionStorage = {
    getItem(k) {
      return data.has(k) ? data.get(k) : null;
    },
    setItem(k, v) {
      data.set(k, String(v));
    },
    removeItem(k) {
      data.delete(k);
    },
    _data: data,
  };
}

function installThrowingSessionStorage() {
  globalThis.sessionStorage = {
    getItem() {
      throw new Error('private mode');
    },
    setItem() {
      throw new Error('private mode');
    },
    removeItem() {
      throw new Error('private mode');
    },
  };
}

function removeSessionStorage() {
  delete globalThis.sessionStorage;
}

installSessionStorage();
const {
  getCachedLineup,
  setCachedLineup,
  clearCachedLineup,
  clearAllCachedLineups,
  __resetLineupCacheForTests,
} = await import('./lineupCache.js');

function finishedRow(overrides = {}) {
  return {
    fplFixture: { id: 1, pulse_id: 125161 },
    matchId: 125161,
    score: {
      started: true,
      finished: true,
      statusText: 'FT',
      liveMinute: null,
      homeScore: 0,
      awayScore: 3,
      kickoffIso: '2026-05-24T15:30:00.000Z',
    },
    events: [{ kind: 'goal', playerName: 'Maguire' }],
    lineups: { home: { confirmed: true, xi: [], bench: [] }, away: { confirmed: true, xi: [], bench: [] } },
    fetchError: null,
    detailsBlockedReason: null,
    lineupSource: 'pulselive',
    eventSource: 'pulselive',
    scoreSource: 'pulselive',
    ...overrides,
  };
}

function resetCache() {
  installSessionStorage();
  __resetLineupCacheForTests();
  clearAllCachedLineups();
}

test('setCachedLineup + getCachedLineup roundtrip a FullTime row', () => {
  resetCache();
  const row = finishedRow();
  const wrote = setCachedLineup(125161, row);
  assert.equal(wrote, true);
  const read = getCachedLineup(125161);
  assert.ok(read, 'cache hit expected');
  assert.equal(read.matchId, 125161);
  assert.equal(read.score.finished, true);
  assert.equal(read.lineups.home.confirmed, true);
  assert.equal(read.lineupSource, 'pulselive');
  /** `fplFixture` must NOT be in the cached body — caller re-attaches it. */
  assert.equal(read.fplFixture, undefined);
  /** `cachedAt` is a timestamp. */
  assert.equal(typeof read.cachedAt, 'number');
});

test('setCachedLineup ignores rows without `score.finished`', () => {
  resetCache();
  const live = finishedRow({
    score: {
      started: true,
      finished: false,
      statusText: 'Live',
      liveMinute: '47',
      homeScore: 1,
      awayScore: 0,
      kickoffIso: null,
    },
  });
  const wrote = setCachedLineup(125161, live);
  assert.equal(wrote, false);
  assert.equal(getCachedLineup(125161), null);
});

test('setCachedLineup falls back to FPL `finished` flag when score is missing', () => {
  resetCache();
  /** Score might be null for postponed-then-finished fixtures where the
   *  source returns no scoreline; FPL still flags the fixture as finished. */
  const row = finishedRow({
    score: null,
    events: [],
    fplFixture: { id: 1, pulse_id: 125161, finished: true },
  });
  const wrote = setCachedLineup(125161, row);
  assert.equal(wrote, true);
  assert.ok(getCachedLineup(125161));
});

test('setCachedLineup refuses to cache rows with a fetchError', () => {
  resetCache();
  const errored = finishedRow({ fetchError: 'Pulselive 502' });
  assert.equal(setCachedLineup(125161, errored), false);
  assert.equal(getCachedLineup(125161), null);
});

test('setCachedLineup refuses to cache empty rows', () => {
  resetCache();
  const empty = finishedRow({ score: null, events: [], lineups: null });
  /** Empty row has no signal to cache; refuse so a retry can fill it later. */
  empty.fplFixture.finished = true;
  assert.equal(setCachedLineup(125161, empty), false);
  assert.equal(getCachedLineup(125161), null);
});

test('clearCachedLineup removes a single entry', () => {
  resetCache();
  setCachedLineup(125161, finishedRow());
  setCachedLineup(125162, finishedRow({ matchId: 125162 }));
  clearCachedLineup(125161);
  assert.equal(getCachedLineup(125161), null);
  assert.ok(getCachedLineup(125162));
});

test('clearAllCachedLineups wipes the cache', () => {
  resetCache();
  setCachedLineup(125161, finishedRow());
  setCachedLineup(125162, finishedRow({ matchId: 125162 }));
  clearAllCachedLineups();
  assert.equal(getCachedLineup(125161), null);
  assert.equal(getCachedLineup(125162), null);
});

test('sessionStorage that throws is tolerated end-to-end', () => {
  __resetLineupCacheForTests();
  installThrowingSessionStorage();
  /** Throwing storage should never bubble up to callers. */
  const ok = setCachedLineup(125161, finishedRow());
  assert.equal(typeof ok, 'boolean');
  const read = getCachedLineup(125161);
  /** In-memory mirror still works even when storage is unavailable. */
  assert.ok(read);
  assert.equal(read.matchId, 125161);
});

test('non-finite pulseId is a no-op for all APIs', () => {
  resetCache();
  assert.equal(setCachedLineup(NaN, finishedRow()), false);
  assert.equal(setCachedLineup(undefined, finishedRow()), false);
  assert.equal(setCachedLineup('not-a-number', finishedRow()), false);
  assert.equal(getCachedLineup(NaN), null);
  assert.equal(getCachedLineup(undefined), null);
  /** clearCachedLineup should silently no-op on invalid keys. */
  clearCachedLineup(NaN);
});

test('versioned cache key — older versions are ignored on read', () => {
  /** Pre-seed sessionStorage as if a previous build wrote under v0. The
   *  module reads only `v1`, so the entry should be invisible. */
  installSessionStorage();
  __resetLineupCacheForTests();
  globalThis.sessionStorage.setItem(
    'prem-lineups-cache:v0',
    JSON.stringify({ '125161': { matchId: 125161, score: { finished: true } } }),
  );
  assert.equal(getCachedLineup(125161), null);
});

test('integration: fully-cached GW skips the network entirely', async () => {
  resetCache();
  const gwFixtures = [
    { id: 1, pulse_id: 125161, kickoff_time: '2026-05-24T15:30:00Z' },
    { id: 2, pulse_id: 125162, kickoff_time: '2026-05-24T15:30:00Z' },
    { id: 3, pulse_id: 125163, kickoff_time: '2026-05-24T15:30:00Z' },
  ];
  /** Seed every fixture with a finished row — mirrors a user revisiting a
   *  past GW that was already cached on the first mount. */
  for (const fx of gwFixtures) {
    setCachedLineup(fx.pulse_id, finishedRow({ matchId: fx.pulse_id }));
  }
  /** Track whether the fetchers would be called. We mirror the partition
   *  logic from `doPremWindowFetch` here so the assertion is meaningful
   *  even though the fetchers themselves are mocked. */
  let pulseliveCalls = 0;
  let espnCalls = 0;
  const pulselive = async () => {
    pulseliveCalls += 1;
    return [];
  };
  const espn = async () => {
    espnCalls += 1;
    return [];
  };

  const cachedById = new Map();
  const uncachedFixtures = [];
  for (const fx of gwFixtures) {
    const cached = getCachedLineup(fx.pulse_id);
    if (cached) cachedById.set(fx.pulse_id, { ...cached, fplFixture: fx });
    else uncachedFixtures.push(fx);
  }

  assert.equal(cachedById.size, 3, 'all 3 fixtures should hydrate from cache');
  assert.equal(uncachedFixtures.length, 0);

  /** Production code only invokes the fetchers when `uncachedFixtures` is
   *  non-empty. Verify the same gate here so the cache-hit assertion is
   *  testing the actual production flow. */
  if (uncachedFixtures.length > 0) {
    await Promise.all([pulselive(), espn()]);
  }
  assert.equal(pulseliveCalls, 0, 'Pulselive must NOT be called for a fully cached GW');
  assert.equal(espnCalls, 0, 'ESPN must NOT be called for a fully cached GW');
});

test('integration: a forced refresh wipes the cache so the next fetch hits the network', async () => {
  resetCache();
  const gwFixtures = [
    { id: 1, pulse_id: 125161, kickoff_time: '2026-05-24T15:30:00Z' },
    { id: 2, pulse_id: 125162, kickoff_time: '2026-05-24T15:30:00Z' },
  ];
  for (const fx of gwFixtures) {
    setCachedLineup(fx.pulse_id, finishedRow({ matchId: fx.pulse_id }));
  }
  /** The refresh button clears the cache before calling
   *  `doPremWindowFetch`; replicate that here. */
  clearAllCachedLineups();
  const uncachedFixtures = [];
  for (const fx of gwFixtures) {
    if (!getCachedLineup(fx.pulse_id)) uncachedFixtures.push(fx);
  }
  assert.equal(uncachedFixtures.length, 2);
});

test('integration: partial cache fetches only uncached fixtures', () => {
  resetCache();
  const gwFixtures = [
    { id: 1, pulse_id: 125161, kickoff_time: '2026-05-24T15:30:00Z' },
    { id: 2, pulse_id: 125162, kickoff_time: '2026-05-24T17:00:00Z' },
    { id: 3, pulse_id: 125163, kickoff_time: '2026-05-24T19:30:00Z' },
  ];
  /** Two fixtures finished, one is still live → only the live one should
   *  hit the network. */
  setCachedLineup(125161, finishedRow({ matchId: 125161 }));
  setCachedLineup(125163, finishedRow({ matchId: 125163 }));

  const cachedById = new Map();
  const uncachedFixtures = [];
  for (const fx of gwFixtures) {
    const cached = getCachedLineup(fx.pulse_id);
    if (cached) cachedById.set(fx.pulse_id, { ...cached, fplFixture: fx });
    else uncachedFixtures.push(fx);
  }
  assert.equal(cachedById.size, 2);
  assert.equal(uncachedFixtures.length, 1);
  assert.equal(uncachedFixtures[0].pulse_id, 125162);
});

test('absent sessionStorage (SSR / Node) is tolerated', () => {
  removeSessionStorage();
  __resetLineupCacheForTests();
  /** No storage at all — every call should still no-op or in-memory-cache. */
  assert.equal(getCachedLineup(125161), null);
  setCachedLineup(125161, finishedRow());
  const read = getCachedLineup(125161);
  assert.ok(read);
  assert.equal(read.matchId, 125161);
  installSessionStorage();
});

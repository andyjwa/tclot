import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSeasonString,
  getSeasonLabel,
  seasonFormsFromStartYear,
  seasonStartYearFromDate,
  seasonStartYearFromDeadline,
  resolveSeasonFromBootstrap,
} from './seasonString.js';

test('seasonFormsFromStartYear builds compact + label forms', () => {
  assert.deepEqual(seasonFormsFromStartYear(2025), {
    startYear: 2025,
    endYear: 2026,
    string: '2526',
    label: '2025-26',
  });
});

test('getSeasonString / getSeasonLabel: August onward is the new season', () => {
  // 1 Aug 2025 → 2025-26
  const aug = new Date('2025-08-01T12:00:00Z');
  assert.equal(getSeasonString(aug), '2526');
  assert.equal(getSeasonLabel(aug), '2025-26');
});

test('getSeasonString / getSeasonLabel: spring stays in the season that began last August', () => {
  // Feb 2026 is still 2025-26
  const feb = new Date('2026-02-15T12:00:00Z');
  assert.equal(getSeasonString(feb), '2526');
  assert.equal(getSeasonLabel(feb), '2025-26');
});

test('getSeasonLabel: offseason June labels the season that just finished', () => {
  // June 2026 → 2025-26 (rolls to 2026-27 only once July/August arrives)
  assert.equal(getSeasonLabel(new Date('2026-06-19T12:00:00Z')), '2025-26');
  assert.equal(getSeasonLabel(new Date('2026-08-10T12:00:00Z')), '2026-27');
});

test('seasonStartYearFromDate threshold is July', () => {
  assert.equal(seasonStartYearFromDate(new Date('2025-07-01T00:00:00Z')), 2025);
  assert.equal(seasonStartYearFromDate(new Date('2025-06-30T00:00:00Z')), 2024);
});

test('seasonStartYearFromDeadline parses ISO deadline', () => {
  assert.equal(seasonStartYearFromDeadline('2025-08-15T17:30:00Z'), 2025);
  assert.equal(seasonStartYearFromDeadline('not-a-date'), null);
  assert.equal(seasonStartYearFromDeadline(undefined), null);
});

test('resolveSeasonFromBootstrap uses earliest event deadline', () => {
  const boot = {
    events: [
      { id: 2, deadline_time: '2025-08-22T17:30:00Z' },
      { id: 1, deadline_time: '2025-08-15T17:30:00Z' },
      { id: 3, deadline_time: '2025-08-29T17:30:00Z' },
    ],
  };
  assert.deepEqual(resolveSeasonFromBootstrap(boot), {
    startYear: 2025,
    endYear: 2026,
    string: '2526',
    label: '2025-26',
  });
});

test('resolveSeasonFromBootstrap handles { data: [] } and empties', () => {
  assert.equal(resolveSeasonFromBootstrap({ events: [] }), null);
  assert.equal(resolveSeasonFromBootstrap({}), null);
  assert.deepEqual(
    resolveSeasonFromBootstrap({ events: { data: [{ deadline_time: '2026-08-14T17:30:00Z' }] } }),
    seasonFormsFromStartYear(2026),
  );
});

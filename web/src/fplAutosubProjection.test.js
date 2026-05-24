import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEffectiveLineup, projectAutosubFromLive } from './fplAutosubProjection.js';

/**
 * @param {number} pick
 * @param {string} pos
 * @param {number} element
 * @param {number} min
 * @param {object} [opt]
 */
function r(pick, pos, element, min, opt = {}) {
  return {
    element,
    pickPosition: pick,
    posSingular: pos,
    minutes: min,
    clubGwFixturesFinished: opt.clubGwFixturesFinished,
    hasGwFixture: opt.hasGwFixture,
    stillYetToPlayPl: opt.stillYetToPlayPl,
    teamGwFixtureCount: opt.teamGwFixtureCount,
    teamSingleFixtureLiveOrDone: opt.teamSingleFixtureLiveOrDone,
    espnMatchdayRole: opt.espnMatchdayRole ?? null,
  };
}

test('no GW fixture: bench DEF (not played yet) can replace BGW starter MID; formation stays valid', () => {
  const xi = [
    r(1, 'GKP', 1, 90, { clubGwFixturesFinished: true, hasGwFixture: true }),
    r(2, 'DEF', 2, 90, { hasGwFixture: true }),
    r(3, 'DEF', 3, 90, { hasGwFixture: true }),
    r(4, 'DEF', 4, 90, { hasGwFixture: true }),
    r(5, 'MID', 5, 0, { hasGwFixture: false, clubGwFixturesFinished: false, stillYetToPlayPl: false }),
    r(6, 'MID', 6, 90, { hasGwFixture: true }),
    r(7, 'MID', 7, 90, { hasGwFixture: true }),
    r(8, 'MID', 8, 90, { hasGwFixture: true }),
    r(9, 'FWD', 9, 90, { hasGwFixture: true }),
    r(10, 'FWD', 10, 90, { hasGwFixture: true }),
    r(11, 'FWD', 11, 90, { hasGwFixture: true }),
  ];
  const bench = [
    r(12, 'DEF', 12, 0, {
      hasGwFixture: true,
      stillYetToPlayPl: true,
    }),
    r(13, 'MID', 13, 0, { hasGwFixture: true, stillYetToPlayPl: true }),
  ];
  const { displayStarters, projectedAutoSubs } = projectAutosubFromLive(xi, bench);
  const ids = new Set(displayStarters.map((x) => x.element));
  assert.ok(!ids.has(5), 'BGW mid should be out of XI');
  assert.ok(ids.has(12), 'bench DEF with fixture should come in for BGW mid');
  assert.equal(projectedAutoSubs.length, 1);
  assert.equal(projectedAutoSubs[0].element_out, 5);
  assert.equal(projectedAutoSubs[0].element_in, 12);
});

test('DNP GKP with no reserve GKP: still processes BGW / DNP outfield', () => {
  const xi = [
    r(1, 'GKP', 1, 0, { clubGwFixturesFinished: true, hasGwFixture: true }),
    r(2, 'DEF', 2, 90, { hasGwFixture: true }),
    r(3, 'DEF', 3, 90, { hasGwFixture: true }),
    r(4, 'DEF', 4, 90, { hasGwFixture: true }),
    r(5, 'MID', 5, 0, { hasGwFixture: false, clubGwFixturesFinished: false, stillYetToPlayPl: false }),
    r(6, 'MID', 6, 90, { hasGwFixture: true }),
    r(7, 'MID', 7, 90, { hasGwFixture: true }),
    r(8, 'MID', 8, 90, { hasGwFixture: true }),
    r(9, 'FWD', 9, 90, { hasGwFixture: true }),
    r(10, 'FWD', 10, 90, { hasGwFixture: true }),
    r(11, 'FWD', 11, 90, { hasGwFixture: true }),
  ];
  const bench = [
    r(12, 'DEF', 12, 0, { hasGwFixture: true, stillYetToPlayPl: true }),
  ];
  const { displayStarters, projectedAutoSubs } = projectAutosubFromLive(xi, bench);
  const ids = new Set(displayStarters.map((x) => x.element));
  assert.equal(projectedAutoSubs[0].element_in, 12);
  assert.ok(!ids.has(5));
  assert.ok(ids.has(12));
  assert.ok(ids.has(1), 'GKP with no sub stays when no reserve keeper');
});

test('ESPN bench: 0-min starter stays in XI while fixture live (wait for club GW to finish)', () => {
  const xi = [
    r(1, 'GKP', 1, 90, {
      clubGwFixturesFinished: false,
      hasGwFixture: true,
      teamGwFixtureCount: 1,
      teamSingleFixtureLiveOrDone: true,
      espnMatchdayRole: 'xi',
    }),
    r(2, 'DEF', 2, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true, espnMatchdayRole: 'xi' }),
    r(3, 'DEF', 3, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true, espnMatchdayRole: 'xi' }),
    r(4, 'DEF', 4, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true, espnMatchdayRole: 'xi' }),
    r(5, 'MID', 5, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true, espnMatchdayRole: 'xi' }),
    r(6, 'MID', 6, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true, espnMatchdayRole: 'xi' }),
    r(7, 'MID', 7, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true, espnMatchdayRole: 'xi' }),
    r(8, 'MID', 8, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true, espnMatchdayRole: 'xi' }),
    r(9, 'FWD', 9, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true, espnMatchdayRole: 'xi' }),
    r(10, 'FWD', 10, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true, espnMatchdayRole: 'xi' }),
    r(11, 'FWD', 11, 0, {
      clubGwFixturesFinished: false,
      hasGwFixture: true,
      teamGwFixtureCount: 1,
      teamSingleFixtureLiveOrDone: true,
      stillYetToPlayPl: true,
      espnMatchdayRole: 'bench',
    }),
  ];
  const bench = [
    r(12, 'FWD', 12, 0, {
      hasGwFixture: true,
      stillYetToPlayPl: true,
      teamGwFixtureCount: 1,
      teamSingleFixtureLiveOrDone: true,
      espnMatchdayRole: 'xi',
    }),
  ];
  const { displayStarters, projectedAutoSubs } = projectAutosubFromLive(xi, bench);
  assert.equal(projectedAutoSubs.length, 0);
  assert.ok(displayStarters.some((x) => x.element === 11));
});

test('ESPN absent: 0-min starter swaps off immediately (unplayed bench allowed)', () => {
  const xi = [
    r(1, 'GKP', 1, 90, {
      clubGwFixturesFinished: false,
      hasGwFixture: true,
      teamGwFixtureCount: 1,
      teamSingleFixtureLiveOrDone: true,
      espnMatchdayRole: 'xi',
    }),
    r(2, 'DEF', 2, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true, espnMatchdayRole: 'xi' }),
    r(3, 'DEF', 3, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true, espnMatchdayRole: 'xi' }),
    r(4, 'DEF', 4, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true, espnMatchdayRole: 'xi' }),
    r(5, 'MID', 5, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true, espnMatchdayRole: 'xi' }),
    r(6, 'MID', 6, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true, espnMatchdayRole: 'xi' }),
    r(7, 'MID', 7, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true, espnMatchdayRole: 'xi' }),
    r(8, 'MID', 8, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true, espnMatchdayRole: 'xi' }),
    r(9, 'FWD', 9, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true, espnMatchdayRole: 'xi' }),
    r(10, 'FWD', 10, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true, espnMatchdayRole: 'xi' }),
    r(11, 'FWD', 11, 0, {
      clubGwFixturesFinished: false,
      hasGwFixture: true,
      teamGwFixtureCount: 1,
      teamSingleFixtureLiveOrDone: true,
      stillYetToPlayPl: true,
      espnMatchdayRole: 'absent',
    }),
  ];
  const bench = [
    r(12, 'FWD', 12, 0, {
      hasGwFixture: true,
      stillYetToPlayPl: true,
      teamGwFixtureCount: 1,
      teamSingleFixtureLiveOrDone: true,
      espnMatchdayRole: 'bench',
    }),
  ];
  const { displayStarters, projectedAutoSubs } = projectAutosubFromLive(xi, bench);
  const ids = new Set(displayStarters.map((x) => x.element));
  assert.ok(!ids.has(11));
  assert.ok(ids.has(12));
  assert.equal(projectedAutoSubs.length, 1);
});

test('ESPN xi: 0-min starter does not use SGW live fallback', () => {
  const xi = [
    r(1, 'GKP', 1, 90, {
      clubGwFixturesFinished: false,
      hasGwFixture: true,
      teamGwFixtureCount: 1,
      teamSingleFixtureLiveOrDone: true,
      espnMatchdayRole: 'xi',
    }),
    r(2, 'DEF', 2, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true, espnMatchdayRole: 'xi' }),
    r(3, 'DEF', 3, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true, espnMatchdayRole: 'xi' }),
    r(4, 'DEF', 4, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true, espnMatchdayRole: 'xi' }),
    r(5, 'MID', 5, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true, espnMatchdayRole: 'xi' }),
    r(6, 'MID', 6, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true, espnMatchdayRole: 'xi' }),
    r(7, 'MID', 7, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true, espnMatchdayRole: 'xi' }),
    r(8, 'MID', 8, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true, espnMatchdayRole: 'xi' }),
    r(9, 'FWD', 9, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true, espnMatchdayRole: 'xi' }),
    r(10, 'FWD', 10, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true, espnMatchdayRole: 'xi' }),
    r(11, 'FWD', 11, 0, {
      clubGwFixturesFinished: false,
      hasGwFixture: true,
      teamGwFixtureCount: 1,
      teamSingleFixtureLiveOrDone: true,
      stillYetToPlayPl: true,
      espnMatchdayRole: 'xi',
    }),
  ];
  const bench = [
    r(12, 'FWD', 12, 45, {
      hasGwFixture: true,
      stillYetToPlayPl: false,
      teamGwFixtureCount: 1,
      teamSingleFixtureLiveOrDone: true,
      espnMatchdayRole: 'xi',
    }),
  ];
  const { projectedAutoSubs } = projectAutosubFromLive(xi, bench);
  assert.equal(projectedAutoSubs.length, 0);
});

test('541 SGW unknown role: two 0-min DEF starters do not ping-pong with bench FWD', () => {
  const sgw = {
    clubGwFixturesFinished: false,
    hasGwFixture: true,
    teamGwFixtureCount: 1,
    teamSingleFixtureLiveOrDone: true,
    stillYetToPlayPl: true,
  };
  const xiBase = { ...sgw, espnMatchdayRole: 'xi' };
  const xi = [
    r(1, 'GKP', 1, 90, xiBase),
    r(2, 'DEF', 2, 90, xiBase),
    r(3, 'DEF', 3, 90, xiBase),
    r(4, 'DEF', 4, 90, xiBase),
    r(5, 'DEF', 500, 0, { ...sgw }),
    r(6, 'DEF', 600, 0, { ...sgw }),
    r(7, 'MID', 7, 90, xiBase),
    r(8, 'MID', 8, 90, xiBase),
    r(9, 'MID', 9, 90, xiBase),
    r(10, 'MID', 10, 90, xiBase),
    r(11, 'FWD', 11, 90, xiBase),
  ];
  const bench = [
    r(12, 'FWD', 12, 0, {
      ...sgw,
    }),
  ];
  const { projectedAutoSubs } = projectAutosubFromLive(xi, bench);
  assert.ok(
    projectedAutoSubs.length < 8,
    `expected no long swap chain, got ${projectedAutoSubs.length} steps`,
  );
  assert.equal(projectedAutoSubs.length, 2);
});

test('bench pool skips absent / finished-GW DNP picks so a lower slot can replace a pending-out starter', () => {
  const sgwLive = {
    clubGwFixturesFinished: false,
    hasGwFixture: true,
    teamGwFixtureCount: 1,
    teamSingleFixtureLiveOrDone: true,
    stillYetToPlayPl: true,
  };
  const xiBase = { ...sgwLive, espnMatchdayRole: 'xi' };
  const xi = [
    r(1, 'GKP', 1, 90, xiBase),
    r(2, 'DEF', 2, 90, xiBase),
    r(3, 'DEF', 3, 90, xiBase),
    r(4, 'DEF', 4, 90, xiBase),
    r(5, 'MID', 5, 90, xiBase),
    r(6, 'MID', 6, 90, xiBase),
    r(7, 'MID', 7, 90, xiBase),
    r(8, 'MID', 8, 90, xiBase),
    r(9, 'FWD', 9, 90, xiBase),
    r(10, 'FWD', 10, 90, xiBase),
    r(11, 'FWD', 511, 0, { ...sgwLive }),
  ];
  const bench = [
    r(12, 'FWD', 1200, 0, {
      hasGwFixture: true,
      clubGwFixturesFinished: true,
      stillYetToPlayPl: false,
      espnMatchdayRole: 'absent',
    }),
    r(13, 'MID', 1300, 0, {
      ...sgwLive,
    }),
  ];
  const { displayStarters, projectedAutoSubs } = projectAutosubFromLive(xi, bench);
  assert.equal(projectedAutoSubs.length, 1);
  assert.equal(projectedAutoSubs[0].element_out, 511);
  assert.equal(projectedAutoSubs[0].element_in, 1300);
  assert.ok(displayStarters.some((x) => x.element === 1300));
  assert.ok(!displayStarters.some((x) => x.element === 1200));
});

test('SGW fixture live: 0-min starter projects out for bench pick not yet played (not in squad / DNP live)', () => {
  const xi = [
    r(1, 'GKP', 1, 90, {
      clubGwFixturesFinished: false,
      hasGwFixture: true,
      teamGwFixtureCount: 1,
      teamSingleFixtureLiveOrDone: true,
    }),
    r(2, 'DEF', 2, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true }),
    r(3, 'DEF', 3, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true }),
    r(4, 'DEF', 4, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true }),
    r(5, 'MID', 5, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true }),
    r(6, 'MID', 6, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true }),
    r(7, 'MID', 7, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true }),
    r(8, 'MID', 8, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true }),
    r(9, 'FWD', 9, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true }),
    r(10, 'FWD', 10, 90, { hasGwFixture: true, teamGwFixtureCount: 1, teamSingleFixtureLiveOrDone: true }),
    r(11, 'FWD', 11, 0, {
      clubGwFixturesFinished: false,
      hasGwFixture: true,
      teamGwFixtureCount: 1,
      teamSingleFixtureLiveOrDone: true,
      stillYetToPlayPl: true,
    }),
  ];
  const bench = [
    r(12, 'FWD', 12, 0, {
      hasGwFixture: true,
      stillYetToPlayPl: true,
      teamGwFixtureCount: 1,
      teamSingleFixtureLiveOrDone: true,
    }),
  ];
  const { displayStarters, projectedAutoSubs } = projectAutosubFromLive(xi, bench);
  const ids = new Set(displayStarters.map((x) => x.element));
  assert.ok(!ids.has(11), '0-min FWD should autosub off while match is live');
  assert.ok(ids.has(12));
  assert.equal(projectedAutoSubs.length, 1);
  assert.equal(projectedAutoSubs[0].element_out, 11);
  assert.equal(projectedAutoSubs[0].element_in, 12);
});

test('DGW: two club fixtures — 0-min starter does not use live-single-fixture path before GW closes', () => {
  const xi = [
    r(1, 'GKP', 1, 90, {
      clubGwFixturesFinished: false,
      hasGwFixture: true,
      teamGwFixtureCount: 2,
      teamSingleFixtureLiveOrDone: false,
    }),
    r(2, 'DEF', 2, 90, { hasGwFixture: true, teamGwFixtureCount: 2, teamSingleFixtureLiveOrDone: false }),
    r(3, 'DEF', 3, 90, { hasGwFixture: true, teamGwFixtureCount: 2, teamSingleFixtureLiveOrDone: false }),
    r(4, 'DEF', 4, 90, { hasGwFixture: true, teamGwFixtureCount: 2, teamSingleFixtureLiveOrDone: false }),
    r(5, 'MID', 5, 90, { hasGwFixture: true, teamGwFixtureCount: 2, teamSingleFixtureLiveOrDone: false }),
    r(6, 'MID', 6, 90, { hasGwFixture: true, teamGwFixtureCount: 2, teamSingleFixtureLiveOrDone: false }),
    r(7, 'MID', 7, 90, { hasGwFixture: true, teamGwFixtureCount: 2, teamSingleFixtureLiveOrDone: false }),
    r(8, 'MID', 8, 90, { hasGwFixture: true, teamGwFixtureCount: 2, teamSingleFixtureLiveOrDone: false }),
    r(9, 'FWD', 9, 90, { hasGwFixture: true, teamGwFixtureCount: 2, teamSingleFixtureLiveOrDone: false }),
    r(10, 'FWD', 10, 90, { hasGwFixture: true, teamGwFixtureCount: 2, teamSingleFixtureLiveOrDone: false }),
    r(11, 'FWD', 11, 0, {
      clubGwFixturesFinished: false,
      hasGwFixture: true,
      teamGwFixtureCount: 2,
      teamSingleFixtureLiveOrDone: false,
      stillYetToPlayPl: true,
    }),
  ];
  const bench = [
    r(12, 'FWD', 12, 0, {
      hasGwFixture: true,
      stillYetToPlayPl: true,
      teamGwFixtureCount: 2,
      teamSingleFixtureLiveOrDone: false,
    }),
  ];
  const { displayStarters, projectedAutoSubs } = projectAutosubFromLive(xi, bench);
  assert.equal(projectedAutoSubs.length, 0);
  assert.ok(displayStarters.some((x) => x.element === 11));
});

test('classic DNP: bench with 0 min and game still to come does not sub in (must have played)', () => {
  const xi = [
    r(1, 'GKP', 1, 0, { clubGwFixturesFinished: true, hasGwFixture: true }),
    r(2, 'DEF', 2, 90, { hasGwFixture: true }),
    r(3, 'DEF', 3, 90, { hasGwFixture: true }),
    r(4, 'DEF', 4, 90, { hasGwFixture: true }),
    r(5, 'MID', 5, 0, { clubGwFixturesFinished: true, hasGwFixture: true }),
    r(6, 'MID', 6, 90, { hasGwFixture: true }),
    r(7, 'MID', 7, 90, { hasGwFixture: true }),
    r(8, 'MID', 8, 90, { hasGwFixture: true }),
    r(9, 'FWD', 9, 90, { hasGwFixture: true }),
    r(10, 'FWD', 10, 90, { hasGwFixture: true }),
    r(11, 'FWD', 11, 90, { hasGwFixture: true }),
  ];
  const bench = [
    r(12, 'DEF', 12, 0, { hasGwFixture: true, stillYetToPlayPl: true }),
  ];
  const { displayStarters, projectedAutoSubs } = projectAutosubFromLive(xi, bench);
  const ids = displayStarters.map((x) => x.element);
  assert.ok(ids.includes(5), 'DNP mid stays until bench has actually played');
  assert.equal(projectedAutoSubs.length, 0);
});

test('no GW fixture GKP: reserve GKP with upcoming fixture can replace first-team GKP', () => {
  const xi = [
    r(1, 'GKP', 1, 0, { hasGwFixture: false, clubGwFixturesFinished: false, stillYetToPlayPl: false }),
    r(2, 'DEF', 2, 90, { hasGwFixture: true }),
    r(3, 'DEF', 3, 90, { hasGwFixture: true }),
    r(4, 'DEF', 4, 90, { hasGwFixture: true }),
    r(5, 'MID', 5, 90, { hasGwFixture: true }),
    r(6, 'MID', 6, 90, { hasGwFixture: true }),
    r(7, 'MID', 7, 90, { hasGwFixture: true }),
    r(8, 'MID', 8, 90, { hasGwFixture: true }),
    r(9, 'FWD', 9, 90, { hasGwFixture: true }),
    r(10, 'FWD', 10, 90, { hasGwFixture: true }),
    r(11, 'FWD', 11, 90, { hasGwFixture: true }),
  ];
  const bench = [
    r(12, 'GKP', 12, 0, { hasGwFixture: true, stillYetToPlayPl: true }),
    r(13, 'DEF', 13, 0, { hasGwFixture: true, stillYetToPlayPl: true }),
  ];
  const { displayStarters, projectedAutoSubs } = projectAutosubFromLive(xi, bench);
  const gk = displayStarters.find((x) => x.posSingular === 'GKP');
  assert.equal(gk?.element, 12);
  assert.equal(projectedAutoSubs[0].element_in, 12);
  assert.equal(projectedAutoSubs[0].element_out, 1);
});

test('official automatic_subs bypasses projection', () => {
  const s = [
    r(1, 'GKP', 101, 90, { hasGwFixture: true }),
    r(2, 'DEF', 102, 0, { clubGwFixturesFinished: true, hasGwFixture: true }),
    r(3, 'DEF', 103, 90, { hasGwFixture: true }),
    r(4, 'DEF', 104, 90, { hasGwFixture: true }),
    r(5, 'MID', 105, 90, { hasGwFixture: true }),
    r(6, 'MID', 106, 90, { hasGwFixture: true }),
    r(7, 'MID', 107, 90, { hasGwFixture: true }),
    r(8, 'MID', 108, 90, { hasGwFixture: true }),
    r(9, 'FWD', 109, 90, { hasGwFixture: true }),
    r(10, 'FWD', 110, 90, { hasGwFixture: true }),
    r(11, 'FWD', 111, 90, { hasGwFixture: true }),
  ];
  const bench = [r(12, 'DEF', 201, 90, { hasGwFixture: true })];
  const out = buildEffectiveLineup({
    starters: s,
    bench,
    autoSubs: [{ element_out: 102, element_in: 201 }],
  });
  assert.equal(out.autosubSource, 'official');
  assert.equal(out.projectedAutoSubs.length, 0);
  const ids = out.displayStarters.map((x) => x.element);
  assert.ok(!ids.includes(102));
  assert.ok(ids.includes(201));
});

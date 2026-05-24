import assert from 'node:assert/strict';
import test from 'node:test';
import { computeEspnMatchdayRole } from './espnMatchdayRoleForAutosub.js';

const gwFx = [
  {
    id: 9001,
    event: 12,
    team_h: 14,
    team_a: 3,
    finished: false,
    started: true,
    minutes: 45,
  },
];

test('computeEspnMatchdayRole — xi and bench', () => {
  const rows = [
    {
      fplFixture: { id: 9001, team_h: 14, team_a: 3 },
      lineups: {
        home: {
          confirmed: true,
          xi: [{ elementId: 101 }, { elementId: 102 }],
          bench: [{ elementId: 103 }],
        },
        away: {
          confirmed: true,
          xi: Array.from({ length: 11 }, (_, i) => ({ elementId: 200 + i })),
          bench: [{ elementId: 250 }],
        },
      },
    },
  ];
  assert.equal(computeEspnMatchdayRole(rows, gwFx, 101, 14), 'xi');
  assert.equal(computeEspnMatchdayRole(rows, gwFx, 103, 14), 'bench');
});

test('computeEspnMatchdayRole — absent when resolved coverage is high', () => {
  const xi = Array.from({ length: 11 }, (_, i) => ({ elementId: 300 + i }));
  const bench = Array.from({ length: 7 }, (_, i) => ({ elementId: 320 + i }));
  const rows = [
    {
      fplFixture: { id: 9001, team_h: 14, team_a: 3 },
      lineups: {
        home: { confirmed: true, xi, bench },
        away: {
          confirmed: true,
          xi: Array.from({ length: 11 }, (_, i) => ({ elementId: 400 + i })),
          bench: Array.from({ length: 7 }, (_, i) => ({ elementId: 420 + i })),
        },
      },
    },
  ];
  assert.equal(computeEspnMatchdayRole(rows, gwFx, 99999, 14), 'absent');
});

test('computeEspnMatchdayRole — unknown when any squad row lacks elementId (name coverage gap)', () => {
  const xi = Array.from({ length: 11 }, (_, i) => ({ elementId: 300 + i }));
  const bench = [
    { elementId: 315 },
    { elementId: null },
    ...Array.from({ length: 5 }, (_, i) => ({ elementId: 316 + i })),
  ];
  const rows = [
    {
      fplFixture: { id: 9001, team_h: 14, team_a: 3 },
      lineups: {
        home: {
          confirmed: true,
          xi,
          bench,
        },
        away: {
          confirmed: true,
          xi: Array.from({ length: 11 }, (_, i) => ({ elementId: 400 + i })),
          bench: Array.from({ length: 7 }, (_, i) => ({ elementId: 420 + i })),
        },
      },
    },
  ];
  assert.equal(computeEspnMatchdayRole(rows, gwFx, 99999, 14), null);
});

test('computeEspnMatchdayRole — unknown when not enough resolved ids', () => {
  const rows = [
    {
      fplFixture: { id: 9001, team_h: 14, team_a: 3 },
      lineups: {
        home: {
          confirmed: true,
          xi: Array.from({ length: 11 }, () => ({ elementId: null })),
          bench: [],
        },
        away: {
          confirmed: true,
          xi: Array.from({ length: 11 }, (_, i) => ({ elementId: 500 + i })),
          bench: Array.from({ length: 7 }, (_, i) => ({ elementId: 520 + i })),
        },
      },
    },
  ];
  assert.equal(computeEspnMatchdayRole(rows, gwFx, 101, 14), null);
});

test('computeEspnMatchdayRole — null for DGW (two fixtures for club)', () => {
  const dgw = [
    { id: 1, event: 12, team_h: 14, team_a: 3 },
    { id: 2, event: 12, team_h: 10, team_a: 14 },
  ];
  assert.equal(computeEspnMatchdayRole([], dgw, 101, 14), null);
});

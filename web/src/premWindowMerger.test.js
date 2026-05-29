import test from 'node:test';
import assert from 'node:assert/strict';

import { mergePremWindowSources, pickPreferredRow } from './premWindowMerger.js';

const LABELS = { primaryLabel: 'pulselive', fallbackLabel: 'espn' };

/** Helper: build a side `{ confirmed, xi, bench }` with N starters / M subs. */
function side(confirmed, nXi = 11, nBench = 7) {
  return {
    confirmed,
    xi: Array.from({ length: nXi }, (_, i) => ({ name: `p${i}` })),
    bench: Array.from({ length: nBench }, (_, i) => ({ name: `s${i}` })),
  };
}

function row(fxId, { lineups = null, events = [], score = null, matchId = null } = {}) {
  return {
    fplFixture: { id: fxId, team_h: 1, team_a: 2 },
    matchId,
    score,
    events,
    lineups,
    fetchError: null,
    detailsBlockedReason: null,
  };
}

test('pickPreferredRow — primary confirmed wins over fallback confirmed', () => {
  const p = row(1, { lineups: { home: side(true), away: side(true) }, matchId: 100 });
  const f = row(1, { lineups: { home: side(true), away: side(true) }, matchId: 200 });
  const merged = pickPreferredRow(p, f, LABELS);
  assert.equal(merged.lineupSource, 'pulselive');
  assert.equal(merged.matchId, 100);
});

test('pickPreferredRow — fallback confirmed wins when primary only has unconfirmed', () => {
  const p = row(1, { lineups: { home: side(false, 4), away: side(false, 4) }, matchId: 100 });
  const f = row(1, { lineups: { home: side(true), away: side(true) }, matchId: 200 });
  const merged = pickPreferredRow(p, f, LABELS);
  assert.equal(merged.lineupSource, 'espn');
  assert.equal(merged.matchId, 200);
});

test('pickPreferredRow — unconfirmed-with-players primary beats no fallback', () => {
  const p = row(1, { lineups: { home: side(false, 4), away: side(false, 3) }, matchId: 100 });
  const f = row(1, { lineups: null, matchId: 200 });
  const merged = pickPreferredRow(p, f, LABELS);
  assert.equal(merged.lineupSource, 'pulselive');
  assert.equal(merged.matchId, 100);
});

test('pickPreferredRow — events: primary non-empty wins', () => {
  const p = row(1, { events: [{ kind: 'goal', playerName: 'A' }], matchId: 100 });
  const f = row(1, { events: [{ kind: 'goal', playerName: 'B' }], matchId: 200 });
  const merged = pickPreferredRow(p, f, LABELS);
  assert.equal(merged.eventSource, 'pulselive');
  assert.deepEqual(merged.events, [{ kind: 'goal', playerName: 'A' }]);
});

test('pickPreferredRow — events: fallback used when primary empty', () => {
  const p = row(1, { events: [], matchId: 100 });
  const f = row(1, { events: [{ kind: 'goal', playerName: 'B' }], matchId: 200 });
  const merged = pickPreferredRow(p, f, LABELS);
  assert.equal(merged.eventSource, 'espn');
  assert.deepEqual(merged.events, [{ kind: 'goal', playerName: 'B' }]);
});

test('pickPreferredRow — score: 0–0 from primary still wins over null fallback', () => {
  const p = row(1, { score: { homeScore: 0, awayScore: 0, statusText: 'HT' }, matchId: 100 });
  const f = row(1, { score: null, matchId: 200 });
  const merged = pickPreferredRow(p, f, LABELS);
  assert.equal(merged.scoreSource, 'pulselive');
  assert.equal(merged.score.statusText, 'HT');
});

test('pickPreferredRow — matchId follows the strongest signal source (lineups > events > score)', () => {
  /** Lineups confirmed on fallback, events on primary, score on primary —
   *  lineups wins, so matchId is from fallback. */
  const p = row(1, {
    lineups: null,
    events: [{ kind: 'goal' }],
    score: { homeScore: 1, awayScore: 0 },
    matchId: 100,
  });
  const f = row(1, {
    lineups: { home: side(true), away: side(true) },
    events: [],
    score: null,
    matchId: 200,
  });
  const merged = pickPreferredRow(p, f, LABELS);
  assert.equal(merged.lineupSource, 'espn');
  assert.equal(merged.eventSource, 'pulselive');
  assert.equal(merged.scoreSource, 'pulselive');
  assert.equal(merged.matchId, 200);
});

test('pickPreferredRow — both rows empty → all sources "none"', () => {
  const merged = pickPreferredRow(row(1), row(1), LABELS);
  assert.equal(merged.lineupSource, 'none');
  assert.equal(merged.eventSource, 'none');
  assert.equal(merged.scoreSource, 'none');
  assert.equal(merged.matchId, null);
  assert.equal(merged.lineups, null);
  assert.deepEqual(merged.events, []);
});

test('pickPreferredRow — primary null falls through to fallback', () => {
  const f = row(1, {
    lineups: { home: side(true), away: side(true) },
    events: [{ kind: 'red' }],
    score: { homeScore: 2, awayScore: 1 },
    matchId: 200,
  });
  const merged = pickPreferredRow(null, f, LABELS);
  assert.equal(merged.lineupSource, 'espn');
  assert.equal(merged.eventSource, 'espn');
  assert.equal(merged.scoreSource, 'espn');
  assert.equal(merged.matchId, 200);
});

test('mergePremWindowSources — primary order is preserved', () => {
  const primary = [
    row(11, { lineups: { home: side(true), away: side(true) } }),
    row(12, { lineups: { home: side(true), away: side(true) } }),
    row(13, { lineups: { home: side(true), away: side(true) } }),
  ];
  const fallback = [
    row(13, { lineups: { home: side(true), away: side(true) } }),
    row(11, { lineups: { home: side(true), away: side(true) } }),
  ];
  const merged = mergePremWindowSources(primary, fallback, LABELS);
  assert.deepEqual(
    merged.map((r) => r.fplFixture.id),
    [11, 12, 13],
  );
  for (const r of merged) assert.equal(r.lineupSource, 'pulselive');
});

test('mergePremWindowSources — fallback-only rows appended at end', () => {
  const primary = [row(11, { lineups: { home: side(true), away: side(true) } })];
  const fallback = [
    row(11, { lineups: { home: side(true), away: side(true) } }),
    row(99, { lineups: { home: side(true), away: side(true) } }),
  ];
  const merged = mergePremWindowSources(primary, fallback, LABELS);
  assert.deepEqual(
    merged.map((r) => r.fplFixture.id),
    [11, 99],
  );
  assert.equal(merged[0].lineupSource, 'pulselive');
  assert.equal(merged[1].lineupSource, 'espn');
});

test('mergePremWindowSources — primary empty falls through entirely to fallback', () => {
  const fallback = [
    row(5, { lineups: { home: side(true), away: side(true) } }),
    row(6, { lineups: { home: side(true), away: side(true) } }),
  ];
  const merged = mergePremWindowSources([], fallback, LABELS);
  assert.equal(merged.length, 2);
  for (const r of merged) assert.equal(r.lineupSource, 'espn');
});

test('mergePremWindowSources — both empty returns empty', () => {
  assert.deepEqual(mergePremWindowSources([], [], LABELS), []);
  assert.deepEqual(mergePremWindowSources(null, null, LABELS), []);
});

test('mergePremWindowSources — primary partial confirms + fallback fills the gaps', () => {
  const primary = [
    row(1, { lineups: { home: side(true), away: side(true) }, events: [], score: { homeScore: 0, awayScore: 0 } }),
    row(2, { lineups: { home: side(false, 4), away: side(false, 4) }, events: [], score: null }),
  ];
  const fallback = [
    row(1, { lineups: { home: side(true), away: side(true) }, events: [{ kind: 'goal' }], score: { homeScore: 1, awayScore: 1 } }),
    row(2, { lineups: { home: side(true), away: side(true) }, events: [{ kind: 'yellow' }], score: { homeScore: 0, awayScore: 0, statusText: 'Live' } }),
  ];
  const merged = mergePremWindowSources(primary, fallback, LABELS);
  assert.equal(merged[0].lineupSource, 'pulselive');
  assert.equal(merged[0].eventSource, 'espn'); /** primary had no events */
  assert.equal(merged[0].scoreSource, 'pulselive'); /** 0-0 still counts as "has score" */
  /** Row 2: primary lineups unconfirmed, fallback confirmed → fallback lineups; events + score also fallback. */
  assert.equal(merged[1].lineupSource, 'espn');
  assert.equal(merged[1].eventSource, 'espn');
  assert.equal(merged[1].scoreSource, 'espn');
});

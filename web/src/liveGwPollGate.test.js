import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldPollLiveGw } from './liveGwPollGate.js';

const DEADLINE = '2026-08-21T17:30:00Z';
const beforeDeadline = Date.parse('2026-08-21T17:00:00Z');
const afterDeadline = Date.parse('2026-08-21T17:45:00Z');

test('shouldPollLiveGw — is_current match polls', () => {
  const events = [{ id: 1, is_current: true, finished: false, deadline_time: DEADLINE }];
  assert.equal(
    shouldPollLiveGw({ events, gameweek: 1, nowMs: beforeDeadline }),
    true,
  );
});

test('shouldPollLiveGw — deadline passed but is_current still on "next" polls', () => {
  // Real GW1 shape right after the deadline: FPL hasn't flipped current yet.
  const events = [
    { id: 1, is_current: false, is_next: true, finished: false, deadline_time: DEADLINE },
    { id: 2, is_current: false, is_next: false, finished: false, deadline_time: '2026-08-28T17:30:00Z' },
  ];
  assert.equal(
    shouldPollLiveGw({ events, gameweek: 1, nowMs: afterDeadline }),
    true,
  );
});

test('shouldPollLiveGw — before the deadline does not poll', () => {
  const events = [{ id: 1, is_current: false, finished: false, deadline_time: DEADLINE }];
  assert.equal(
    shouldPollLiveGw({ events, gameweek: 1, nowMs: beforeDeadline }),
    false,
  );
});

test('shouldPollLiveGw — finished GW never polls', () => {
  const events = [{ id: 1, is_current: true, finished: true, deadline_time: DEADLINE }];
  assert.equal(
    shouldPollLiveGw({ events, gameweek: 1, nowMs: afterDeadline }),
    false,
  );
  assert.equal(
    shouldPollLiveGw({
      events: [{ id: 1, is_current: false, finished: false, deadline_time: DEADLINE }],
      eventSnapshot: { id: 1, finished: true },
      gameweek: 1,
      nowMs: afterDeadline,
    }),
    false,
  );
});

test('shouldPollLiveGw — deadline read from eventSnapshot when events list lacks it', () => {
  assert.equal(
    shouldPollLiveGw({
      events: [],
      eventSnapshot: { id: 1, finished: false, deadline_time: DEADLINE },
      gameweek: 1,
      nowMs: afterDeadline,
    }),
    true,
  );
});

test('shouldPollLiveGw — invalid / missing inputs are safe', () => {
  assert.equal(shouldPollLiveGw({ events: null, gameweek: null }), false);
  assert.equal(shouldPollLiveGw({ events: [], gameweek: 1 }), false);
  assert.equal(shouldPollLiveGw({}), false);
  assert.equal(
    shouldPollLiveGw({
      events: [{ id: 1, deadline_time: 'not-a-date', finished: false }],
      gameweek: 1,
      nowMs: afterDeadline,
    }),
    false,
  );
});

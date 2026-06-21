import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  coldStartWeight,
  buildHistoricalRates,
  priorRatesFor,
  applyColdStartPriors,
  HARDCODED_BASELINES,
  FADE_MATCHES,
} from './coldStartPriors.js';

const approx = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('coldStartWeight: 1.0 at zero minutes, fades linearly to 0 by FADE_MATCHES', () => {
  assert.equal(coldStartWeight(0), 1);
  assert.ok(approx(coldStartWeight(90 * FADE_MATCHES * 0.5), 0.5));
  assert.equal(coldStartWeight(90 * FADE_MATCHES), 0);
  assert.equal(coldStartWeight(90 * FADE_MATCHES + 500), 0);
  assert.equal(coldStartWeight(-50), 1); // guards negative
});

test('coldStartWeight: respects a custom fadeMatches', () => {
  assert.ok(approx(coldStartWeight(90, 2), 0.5));
  assert.equal(coldStartWeight(180, 2), 0);
});

/** Minimal draft-bootstrap element. xGPer90 = expected_goals / (minutes/90). */
function el(over = {}) {
  return {
    id: over.id ?? 1,
    code: over.code ?? 100,
    element_type: over.element_type ?? 3,
    team: over.team ?? 1,
    web_name: over.web_name ?? 'Test',
    minutes: over.minutes ?? 900,
    starts: over.starts ?? 30,
    expected_goals: over.expected_goals ?? '0.00',
    expected_assists: over.expected_assists ?? '0.00',
    threat: over.threat ?? '0.0',
    creativity: over.creativity ?? '0.0',
    ict_index: over.ict_index ?? '0.0',
    tackles: over.tackles ?? 0,
    clearances_blocks_interceptions: over.clearances_blocks_interceptions ?? 0,
    recoveries: over.recoveries ?? 0,
    saves: over.saves ?? 0,
    yellow_cards: over.yellow_cards ?? 0,
    red_cards: over.red_cards ?? 0,
    ...over,
  };
}

test('buildHistoricalRates: indexes by code and computes position-median baselines', () => {
  const boot = {
    elements: [
      el({ id: 1, code: 100, element_type: 3, minutes: 900, expected_goals: '1.0' }), // xG90 0.1
      el({ id: 2, code: 101, element_type: 3, minutes: 900, expected_goals: '2.0' }), // xG90 0.2
      el({ id: 3, code: 102, element_type: 3, minutes: 900, expected_goals: '3.0' }), // xG90 0.3
      // low-minute MID: in byCode but excluded from baseline samples
      el({ id: 4, code: 103, element_type: 3, minutes: 100, expected_goals: '5.0' }),
      // skipped: removed + missing code
      el({ id: 5, code: 104, element_type: 3, removed: true }),
      el({ id: 6, code: null, element_type: 3 }),
    ],
  };
  const h = buildHistoricalRates(boot);
  assert.equal(h.count, 4); // 4 with codes (removed + null-code skipped)
  assert.ok(h.byCode.has(100) && h.byCode.has(103));
  assert.ok(!h.byCode.has(104)); // removed
  // Median of {0.1, 0.2, 0.3} (low-minute 0.45 excluded) = 0.2
  assert.ok(approx(h.baselineByPosition.MID.xGPer90, 0.2, 1e-6));
});

test('buildHistoricalRates: falls back to hardcoded baseline for positions with no starters', () => {
  const boot = { elements: [el({ id: 1, code: 100, element_type: 3, minutes: 900 })] };
  const h = buildHistoricalRates(boot);
  // No GK/DEF/FWD samples → hardcoded
  assert.deepEqual(h.baselineByPosition.GK, HARDCODED_BASELINES.GK);
  assert.deepEqual(h.baselineByPosition.FWD, HARDCODED_BASELINES.FWD);
});

test('buildHistoricalRates: null prior bootstrap yields hardcoded baselines, empty index', () => {
  const h = buildHistoricalRates(null);
  assert.equal(h.count, 0);
  assert.deepEqual(h.baselineByPosition.MID, HARDCODED_BASELINES.MID);
});

test('priorRatesFor: returns history when code matches, else baseline', () => {
  const historical = {
    byCode: new Map([[100, { position: 'MID', xGPer90: 0.4 }]]),
    baselineByPosition: { MID: { xGPer90: 0.15 } },
  };
  assert.deepEqual(priorRatesFor({ position: 'MID' }, 100, historical), {
    rates: { position: 'MID', xGPer90: 0.4 },
    source: 'history',
  });
  assert.equal(priorRatesFor({ position: 'MID' }, 999, historical).source, 'baseline');
  assert.equal(priorRatesFor({ position: 'MID' }, null, historical).source, 'baseline');
});

test('priorRatesFor: no historical at all → hardcoded baseline for the position', () => {
  const r = priorRatesFor({ position: 'FWD' }, 5, null);
  assert.equal(r.source, 'baseline');
  assert.deepEqual(r.rates, HARDCODED_BASELINES.FWD);
});

const historical = () => ({
  byCode: new Map([
    [
      100,
      {
        position: 'MID',
        xGPer90: 0.4,
        xAPer90: 0.3,
        recentStartRate: 0.9,
        startsLast6: 6,
        minutesLast6: 540,
      },
    ],
  ]),
  baselineByPosition: { MID: { xGPer90: 0.15, xAPer90: 0.1 } },
});

const coldPlayer = () => ({
  id: 1,
  position: 'MID',
  xGPer90: 0,
  xAPer90: 0,
  recentStartRate: 0.05,
  startsLast6: 0,
  minutesLast6: 0,
});

test('applyColdStartPriors: weight 0 (enough minutes) returns player unchanged', () => {
  const p = coldPlayer();
  const out = applyColdStartPriors(p, { code: 100, currentMinutes: 90 * FADE_MATCHES, historical: historical() });
  assert.equal(out.weight, 0);
  assert.equal(out.source, 'current');
  assert.equal(out.player, p); // same reference, no copy
});

test('applyColdStartPriors: GW1 returning player adopts prior rates AND minutes signals', () => {
  const out = applyColdStartPriors(coldPlayer(), { code: 100, currentMinutes: 0, historical: historical() });
  assert.equal(out.weight, 1);
  assert.equal(out.source, 'history');
  assert.ok(approx(out.player.xGPer90, 0.4));
  assert.ok(approx(out.player.recentStartRate, 0.9)); // minutes field carried over for history
  assert.ok(approx(out.player.minutesLast6, 540));
});

test('applyColdStartPriors: GW1 new player uses baseline rates but keeps current minutes signal', () => {
  const out = applyColdStartPriors(coldPlayer(), { code: 999, currentMinutes: 0, historical: historical() });
  assert.equal(out.source, 'baseline');
  assert.ok(approx(out.player.xGPer90, 0.15)); // baseline rate
  assert.ok(approx(out.player.recentStartRate, 0.05)); // NOT promoted to starter
  assert.ok(approx(out.player.startsLast6, 0));
});

test('applyColdStartPriors: partial minutes blends proportionally', () => {
  const out = applyColdStartPriors(coldPlayer(), {
    code: 100,
    currentMinutes: 90 * FADE_MATCHES * 0.5, // weight 0.5
    historical: historical(),
  });
  assert.ok(approx(out.weight, 0.5));
  // 0.5 * 0.4 (prior) + 0.5 * 0 (current) = 0.2
  assert.ok(approx(out.player.xGPer90, 0.2));
});

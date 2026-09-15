import { test } from 'node:test'
import assert from 'node:assert/strict'
import { predictionsById, h2hWinProbs } from './forecastHelpers.js'
import { teamProjection } from './liveBlend.js'
import {
  calibrationSigmaScale,
  starterElementIds,
  xiPredictionOdds,
  resolvePreviewOdds,
} from './weeklyPreviewOdds.js'

const player = (id, xp, p10, p90) => ({
  id,
  forecast: { totalPoints: xp, percentiles: { p10, p90 } },
})

test('calibrationSigmaScale uses applied inflation, else 1', () => {
  assert.equal(calibrationSigmaScale({ applied: true, sigmaInflation: 1.059 }), 1.059)
  assert.equal(calibrationSigmaScale({ applied: false, sigmaInflation: 1.4 }), 1)
  assert.equal(calibrationSigmaScale(null), 1)
  assert.equal(calibrationSigmaScale({ applied: true, sigmaInflation: 0 }), 1)
})

test('starterElementIds reads id / element / elementId', () => {
  assert.deepEqual(
    starterElementIds([{ id: 10 }, { element: 11 }, { elementId: 12 }, { id: 'x' }]),
    [10, 11, 12],
  )
  assert.deepEqual(starterElementIds(null), [])
})

test('xiPredictionOdds matches Live Odds pre-match h2hWinProbs', () => {
  const byId = predictionsById({
    players: [
      player(1, 6.0, 2, 12),
      player(2, 5.0, 1, 10),
      player(3, 4.0, 1, 8),
      player(4, 3.0, 0, 7),
    ],
  })
  const homeIds = [1, 2]
  const awayIds = [3, 4]
  const sigma = 1.059
  const expected = h2hWinProbs(
    teamProjection(
      homeIds.map((id) => ({ element: id })),
      byId,
      'prematch',
    ),
    teamProjection(
      awayIds.map((id) => ({ element: id })),
      byId,
      'prematch',
    ),
    0.5,
    sigma,
  )
  const out = xiPredictionOdds(byId, homeIds, awayIds, sigma)
  assert.equal(out.source, 'engine')
  assert.equal(out.hw, expected.homeWinPct)
  assert.equal(out.dw, expected.drawPct)
  assert.equal(out.aw, expected.awayWinPct)
  assert.ok(out.hw > out.aw, 'higher-xP XI is favoured')
  assert.ok(out.dw > 0, 'forecast bar includes a draw')
})

test('xiPredictionOdds is null without a forecast match', () => {
  assert.equal(xiPredictionOdds(new Map(), [1], [2], 1), null)
  const byId = predictionsById({ players: [player(1, 5, 1, 9)] })
  assert.equal(xiPredictionOdds(byId, [99], [88], 1), null)
})

test('resolvePreviewOdds prefers frozen archive over XI forecast', () => {
  const out = resolvePreviewOdds({
    archiveMc: { homeWinPct: 70, drawPct: 4, awayWinPct: 26 },
    archiveHomeIsMatchHome: true,
    xiOdds: { hw: 51, dw: 6, aw: 43 },
    bookieProbs: { home: 0.4, draw: 0, away: 0.6 },
    strength: { homePct: 40, awayPct: 60, source: 'strength' },
  })
  assert.deepEqual(out, { hw: 70, dw: 4, aw: 26, source: 'engine', arch: true })
})

test('resolvePreviewOdds prefers locked Preview freeze over archive', () => {
  const out = resolvePreviewOdds({
    previewFreeze: { hw: 41, dw: 5, aw: 54, homeMu: 36, awayMu: 40 },
    archiveMc: { homeWinPct: 70, drawPct: 4, awayWinPct: 26 },
    xiOdds: { hw: 51, dw: 6, aw: 43 },
  })
  assert.equal(out.source, 'preview')
  assert.equal(out.frozen, true)
  assert.equal(out.hw, 41)
  assert.equal(out.aw, 54)
})

test('resolvePreviewOdds flips archive when the stored row is swapped', () => {
  const out = resolvePreviewOdds({
    archiveMc: { homeWinPct: 70, drawPct: 4, awayWinPct: 26 },
    archiveHomeIsMatchHome: false,
  })
  assert.equal(out.hw, 26)
  assert.equal(out.aw, 70)
})

test('resolvePreviewOdds uses XI forecast before strength/bookie', () => {
  const out = resolvePreviewOdds({
    xiOdds: { hw: 54.2, dw: 5.1, aw: 40.7, homeMu: 34.1, awayMu: 33 },
    bookieProbs: { home: 0.4, draw: 0, away: 0.6 },
    strength: { homePct: 40, awayPct: 60, source: 'strength' },
  })
  assert.equal(out.source, 'engine')
  assert.equal(out.hw, 54.2)
  assert.equal(out.dw, 5.1)
  assert.equal(out.aw, 40.7)
  assert.equal(out.arch, false)
})

test('resolvePreviewOdds falls back to bookie then strength', () => {
  const bookie = resolvePreviewOdds({
    bookieProbs: { home: 0.4, draw: 0.02, away: 0.58 },
    strength: { homePct: 45, awayPct: 55, source: 'strength' },
  })
  assert.equal(bookie.source, 'strength')
  assert.equal(bookie.hw, 40)
  assert.equal(bookie.aw, 58)
  const strength = resolvePreviewOdds({
    strength: { homePct: 45, awayPct: 55, source: 'strength' },
  })
  assert.deepEqual(strength, { hw: 45, dw: 0, aw: 55, source: 'strength', arch: false })
  assert.equal(resolvePreviewOdds({}), null)
})

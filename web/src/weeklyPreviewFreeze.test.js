import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  isLockQualitySource,
  unorderedPairKey,
  freezeRowFromPreviewMatchup,
  freezeRowFromRecapMatchup,
  freezeRowsFromPreview,
  ingestWeeklyRecaps,
  findFreezeRow,
  orientFreezeRow,
  favoriteFromOriented,
  scoreOrientedCall,
  applyFreezeToRecapOdds,
  freezeToResolveInput,
  mergeFreezeRow,
} from './weeklyPreviewFreeze.js'
import { resolvePreviewOdds } from './weeklyPreviewOdds.js'

const previewMatch = (homeId, awayId, odds, predicted) => ({
  home: { entryId: homeId, name: `T${homeId}` },
  away: { entryId: awayId, name: `T${awayId}` },
  odds,
  predicted,
})

test('lock-quality sources are the published Preview, not the post-GW archive', () => {
  assert.equal(isLockQualitySource('xi'), true)
  assert.equal(isLockQualitySource('live'), true)
  assert.equal(isLockQualitySource('preview'), true)
  assert.equal(isLockQualitySource('archive'), false)
  assert.equal(isLockQualitySource('engine'), false)
})

test('freeze row comes from the Preview card the league actually saw', () => {
  const row = freezeRowFromPreviewMatchup(
    previewMatch(
      4898,
      6849,
      { home: 58, draw: 4, away: 38, favoriteSide: 'home', favoritePct: 58, source: 'engine' },
      { home: 41.2, away: 36.8 },
    ),
  )
  assert.deepEqual(row, {
    home: 4898,
    away: 6849,
    homeWinPct: 58,
    drawPct: 4,
    awayWinPct: 38,
    predHome: 41.2,
    predAway: 36.8,
  })
})

test('archive recap matchups are not frozen (that is the GW4 bug)', () => {
  const row = freezeRowFromRecapMatchup({
    home: { entryId: 6849 },
    away: { entryId: 4898 },
    odds: { favoriteSide: 'home', favoritePct: 54, source: 'engine' },
    predicted: { home: 25.7, away: 23.7 },
  })
  assert.equal(row, null)
})

test('recap matchups tagged preview are frozen, including 3-way odds', () => {
  const row = freezeRowFromRecapMatchup({
    home: { entryId: 1 },
    away: { entryId: 2 },
    odds: {
      home: 58,
      draw: 4,
      away: 38,
      favoriteSide: 'home',
      favoritePct: 58,
      source: 'preview',
    },
    predicted: { home: 40, away: 33 },
  })
  assert.equal(row.homeWinPct, 58)
  assert.equal(row.awayWinPct, 38)
  assert.equal(row.predHome, 40)
})

test('ingest prefers the lock-quality Preview and ignores archive reconstructions', () => {
  const map = new Map()
  ingestWeeklyRecaps(map, {
    previews: [
      {
        gw: 4,
        source: 'archive',
        matchups: [
          previewMatch(6849, 4898, { home: 54, draw: 4, away: 42 }, { home: 25.7, away: 23.7 }),
        ],
      },
      {
        gw: 4,
        source: 'xi',
        matchups: [
          previewMatch(6849, 4898, { home: 41, draw: 5, away: 54 }, { home: 36.1, away: 39.8 }),
        ],
      },
    ],
    gameweeks: [
      {
        gw: 4,
        matchups: [
          {
            home: { entryId: 6849 },
            away: { entryId: 4898 },
            odds: { favoriteSide: 'home', favoritePct: 54, source: 'engine' },
          },
        ],
      },
    ],
  })
  const row = findFreezeRow(map.get(4), 6849, 4898)
  assert.equal(row.homeWinPct, 41)
  assert.equal(row.awayWinPct, 54)
  assert.equal(row.predAway, 39.8)
})

test('first freeze wins so a later archive rebuild cannot flip the favourite', () => {
  const map = new Map()
  mergeFreezeRow(map, 4, {
    home: 6849,
    away: 4898,
    homeWinPct: 41,
    drawPct: 5,
    awayWinPct: 54,
    predHome: 36,
    predAway: 40,
  })
  ingestWeeklyRecaps(map, {
    previews: [
      {
        gw: 4,
        source: 'xi',
        matchups: [
          previewMatch(6849, 4898, { home: 90, draw: 0, away: 10 }, { home: 10, away: 10 }),
        ],
      },
    ],
  })
  const row = findFreezeRow(map.get(4), 6849, 4898)
  assert.equal(row.awayWinPct, 54, 'Gimli stays the locked favourite')
})

test('orientFreezeRow flips percents when the stored home/away is swapped', () => {
  const row = {
    home: 4898,
    away: 6849,
    homeWinPct: 54,
    drawPct: 4,
    awayWinPct: 42,
    predHome: 40,
    predAway: 36,
  }
  const oriented = orientFreezeRow(row, 6849, 4898)
  assert.equal(oriented.homeWinPct, 42)
  assert.equal(oriented.awayWinPct, 54)
  assert.equal(oriented.predHome, 36)
  assert.equal(oriented.predAway, 40)
})

test('recap scores the locked Preview favourite, not a post-GW reconstruction', () => {
  const row = {
    home: 6849,
    away: 4898,
    homeWinPct: 41,
    drawPct: 5,
    awayWinPct: 54,
    predHome: 36.1,
    predAway: 39.8,
  }
  const oriented = orientFreezeRow(row, 6849, 4898)
  const call = favoriteFromOriented(oriented, 6849, 4898)
  assert.equal(call.favorite, 4898, 'Gimli is the Preview favourite')
  assert.equal(call.source, 'preview')
  assert.equal(scoreOrientedCall(oriented, 6849, 4898, 37, 53), 'hit')
  const recap = applyFreezeToRecapOdds(row, 6849, 4898, 37, 53)
  assert.equal(recap.odds.outcome, 'hit')
  assert.equal(recap.odds.favoriteSide, 'away')
  assert.equal(recap.odds.favoritePct, 54)
  assert.equal(recap.odds.source, 'preview')
  assert.deepEqual(recap.predicted, { home: 36.1, away: 39.8 })
})

test('resolvePreviewOdds uses the locked Preview over archive xPtsMc', () => {
  const freeze = freezeToResolveInput(
    {
      home: 6849,
      away: 4898,
      homeWinPct: 41,
      drawPct: 5,
      awayWinPct: 54,
      predHome: 36,
      predAway: 40,
    },
    6849,
    4898,
  )
  const out = resolvePreviewOdds({
    previewFreeze: freeze,
    archiveMc: { homeWinPct: 54, drawPct: 4, awayWinPct: 42 },
    archiveHomeIsMatchHome: true,
    xiOdds: { hw: 50, dw: 5, aw: 45 },
  })
  assert.equal(out.hw, 41)
  assert.equal(out.aw, 54)
  assert.equal(out.frozen, true)
  assert.equal(out.source, 'preview')
})

test('unorderedPairKey is orientation-agnostic', () => {
  assert.equal(unorderedPairKey(10, 2), unorderedPairKey(2, 10))
})

test('freezeRowsFromPreview skips archive look-forwards', () => {
  assert.deepEqual(
    freezeRowsFromPreview({
      source: 'archive',
      matchups: [previewMatch(1, 2, { home: 70, draw: 0, away: 30 })],
    }),
    [],
  )
})

test('recovered GW4 freeze scores the locked XI Preview, not the archive rebuild', () => {
  const doc = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../public/league-data/preview-odds/gw-04.json'),
      'utf8',
    ),
  )
  const byPair = new Map(doc.matches.map((row) => [unorderedPairKey(row.home, row.away), row]))
  const score = (home, away, homePts, awayPts) =>
    scoreOrientedCall(orientFreezeRow(byPair.get(unorderedPairKey(home, away)), home, away), home, away, homePts, awayPts)
  const gimli = findFreezeRow(byPair, 6849, 4898)
  assert.equal(gimli.awayWinPct, 52)
  assert.equal(favoriteFromOriented(orientFreezeRow(gimli, 6849, 4898), 6849, 4898).favorite, 4898)
  assert.equal(score(4259, 5220, 38, 32), 'miss')
  assert.equal(score(6849, 4898, 37, 53), 'hit')
  assert.equal(score(10173, 44904, 50, 62), 'hit')
  assert.equal(score(18279, 30728, 70, 49), 'miss')
})

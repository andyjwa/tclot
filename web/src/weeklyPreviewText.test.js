import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  matchupPreviewSentences,
  oddsPercents,
  watchPlayersFromXi,
  formFromXi,
  bookiePrecall,
  isVeganManager,
} from './weeklyPreviewText.js'
import { isMottyVeganLine } from './blurbEngine.js'

const team = (over = {}) => ({
  entryId: 1,
  name: 'Mordor S.F.G',
  manager: 'Nick Mottershead',
  rank: 3,
  record: { w: 1, d: 0, l: 0 },
  titlePct: 28.5,
  titlePrice: '9/4',
  lastPct: 1.8,
  lastPrice: '50/1',
  keys: [{ id: 10, name: 'João Pedro', pos: 'FWD', xp: 6.4 }],
  ...over,
})

const base = {
  gw: 2,
  home: team(),
  away: team({
    entryId: 2,
    name: 'Atlético Bilbo',
    manager: 'Nick Goodacre',
    rank: 8,
    record: { w: 0, d: 0, l: 1 },
    titlePct: 0.8,
    titlePrice: '100/1',
    lastPct: 41.6,
    lastPrice: '6/5',
    keys: [
      { id: 20, name: 'Enzo', pos: 'MID', xp: 5.3 },
      { id: 21, name: 'Mbeumo', pos: 'MID', xp: 5.1 },
    ],
  }),
  odds: { favoriteSide: 'home', favoritePct: 74, home: 74, draw: 3, away: 23 },
  bookie: { home: '1/4', draw: '33/1', away: '10/3' },
  predicted: { home: 44, away: 31 },
  h2h: { games: 1, homeWins: 1, awayWins: 0, draws: 0 },
}

test('oddsPercents rounds fractions and percents to a 100-sum triple', () => {
  const fromFrac = oddsPercents({ home: 0.74, draw: 0.03, away: 0.23 })
  assert.equal(fromFrac.home + fromFrac.draw + fromFrac.away, 100)
  assert.ok(fromFrac.home > fromFrac.away)
  const fromPct = oddsPercents({ home: 58.72, draw: 2.41, away: 38.87 })
  assert.equal(fromPct.home + fromPct.draw + fromPct.away, 100)
  assert.equal(oddsPercents({ home: 0, draw: 0, away: 0 }).home + oddsPercents({}).away, 100)
})

test('watchPlayersFromXi sorts by xP and keeps the top N', () => {
  const xi = [
    { id: 1, name: 'Shaw', pos: 'DEF', xp: 5.1 },
    { id: 2, name: 'Isak', pos: 'FWD', xp: 1.2 },
    { id: 3, name: 'Enzo', pos: 'MID', xp: 4.1 },
  ]
  assert.deepEqual(
    watchPlayersFromXi(xi, 2).map((p) => p.name),
    ['Shaw', 'Enzo'],
  )
  assert.deepEqual(watchPlayersFromXi(null), [])
})

test('formFromXi picks last-week over and under performers', () => {
  const form = formFromXi([
    { name: 'João Pedro', pts: 11, xp: 5.2 },
    { name: 'Shaw', pts: 1, xp: 5.1 },
    { name: 'Enzo', pts: 5, xp: 5.3 },
  ])
  assert.equal(form.over.name, 'João Pedro')
  assert.equal(form.over.pts, 11)
  assert.equal(form.under.name, 'Shaw')
  assert.equal(form.under.pts, 1)
  assert.equal(formFromXi([{ name: 'Saka', pts: 6, xp: 6.1 }]), null)
})

test('bookiePrecall prefers sheet fractions over model percents', () => {
  assert.deepEqual(bookiePrecall(base), { home: '1/4', draw: '33/1', away: '10/3' })
  const fromModel = bookiePrecall({ odds: { home: 74, draw: 3, away: 23 } })
  assert.match(fromModel.home, /^\d+\/\d+$/)
  assert.match(fromModel.away, /^\d+\/\d+$/)
})

test('preview sentences are deterministic, short, and skip a final score', () => {
  const a = matchupPreviewSentences(base)
  const b = matchupPreviewSentences(base)
  assert.deepEqual(a, b)
  assert.ok(a.length >= 1 && a.length <= 2)
  const joined = a.join(' ')
  assert.match(joined, /Mordor/)
  assert.match(joined, /Bilbo/)
  assert.doesNotMatch(joined, /Projected points/)
  assert.doesNotMatch(joined, /\d+–\d+/, 'preview must not leak a final score')
})

test('heavy favourite gets a book price, not a wall of projected stats', () => {
  const out = matchupPreviewSentences(base)
  const joined = out.join(' ')
  assert.match(joined, /1\/4|10\/3|74%|favourite|lean|book/i)
  assert.doesNotMatch(joined, /44 to 31|Projected points/)
  assert.doesNotMatch(joined, /% of the|% of their/)
})

test('tight matchup is called a coin flip, not a clear favourite', () => {
  const out = matchupPreviewSentences({
    ...base,
    odds: { favoriteSide: 'away', favoritePct: 52, home: 46, draw: 2, away: 52 },
    bookie: { home: '11/10', draw: '40/1', away: '4/5' },
    predicted: { home: 40, away: 41 },
    home: team({ lastPct: 5, rank: 3, record: { w: 1, d: 0, l: 0 } }),
    away: team({
      entryId: 2,
      name: 'Atlético Bilbo',
      manager: 'Nick Goodacre',
      rank: 4,
      record: { w: 1, d: 0, l: 0 },
      titlePct: 11,
      lastPct: 6,
      keys: [{ id: 20, name: 'Enzo', pos: 'MID', xp: 5.3 }],
    }),
  })
  const joined = out.join(' ')
  assert.match(joined, /tight|coin-flip|toss-up|11\/10|4\/5/i)
  assert.doesNotMatch(joined, /short |clear favourite/i)
})

test('named fixture leads the preview', () => {
  const out = matchupPreviewSentences({
    ...base,
    home: team({ name: 'Toronto Gimli', manager: 'Andy Ward' }),
    away: team({
      entryId: 2,
      name: 'Suffolk Sméagol',
      manager: 'Jon Ward',
      keys: [{ name: 'Palmer', xp: 6.1 }],
    }),
  })
  assert.match(out.join(' '), /Battle of Warderloo/)
  assert.ok(out.length <= 2)
})

test('Bad Blood Derby leads when Andy plays Nick Goodacre', () => {
  const out = matchupPreviewSentences({
    ...base,
    home: team({ name: 'Toronto Gimli', manager: 'Andy Ward' }),
    away: team({
      entryId: 2,
      name: 'Atlético Bilbo',
      manager: 'Nick Goodacre',
      rank: 8,
      record: { w: 0, d: 0, l: 1 },
      lastPct: 41.6,
      lastPrice: '6/5',
      keys: [{ name: 'Enzo', xp: 5.3 }],
    }),
  })
  assert.match(out.join(' '), /Bad Blood Derby/)
})

test('Mottershead preview always has a vegan line from the preview bank', () => {
  for (let gw = 1; gw <= 16; gw++) {
    const lines = matchupPreviewSentences({ ...base, gw })
    assert.ok(lines.length <= 2)
    assert.equal(isMottyVeganLine(lines[1], 'preview'), true, lines[1])
  }
  assert.equal(isVeganManager('Nick Mottershead'), true)
  assert.equal(isVeganManager('Nick Goodacre'), false)
})

test('Mottershead stays at two sentences even when the week hooks him', () => {
  const hooked = matchupPreviewSentences({
    ...base,
    home: team({ recentPickups: [{ name: 'Schade', kind: 'w' }, { name: 'Tel', kind: 'w' }] }),
  })
  assert.equal(hooked.length, 2)
  assert.equal(isMottyVeganLine(hooked[1], 'preview'), true)
})

test('no vegan joke when Mottershead is not playing', () => {
  const out = matchupPreviewSentences({
    ...base,
    home: team({ manager: 'David Higman', name: 'Rokesly Regorasu', lastPct: 1.5, rank: 1 }),
    away: team({
      entryId: 2,
      name: 'Seoul Shire',
      manager: 'Luke Butcher',
      rank: 4,
      record: { w: 1, d: 0, l: 0 },
      titlePct: 5.1,
      lastPct: 13.9,
      keys: [{ name: 'Saka', xp: 6.8 }],
    }),
    h2h: null,
  })
  assert.doesNotMatch(out.join(' '), /vegan|tofu|plant|oat milk/i)
  assert.ok(out.length <= 2)
})

test('East Asian Derby always names the brand; lore is not a two-manager checklist', () => {
  const out = matchupPreviewSentences({
    ...base,
    gw: 2,
    home: team({ manager: 'David Higman', name: 'Rokesly Regorasu', lastPct: 1.5, rank: 1 }),
    away: team({
      entryId: 2,
      name: 'Seoul Shire',
      manager: 'Luke Butcher',
      rank: 4,
      record: { w: 1, d: 0, l: 0 },
      titlePct: 5.1,
      lastPct: 13.9,
      keys: [{ name: 'Saka', xp: 6.8 }],
    }),
    h2h: null,
  })
  assert.match(out.join(' '), /East Asian Derby/)
  assert.ok(out.length <= 2)
})

test('waiver claim can be the one preview angle', () => {
  const out = matchupPreviewSentences({
    ...base,
    home: team({
      manager: 'Eddy Webster',
      name: 'Brampton Balrogs',
      recentPickups: [{ name: 'Schade', kind: 'w', gw: 1 }],
    }),
  })
  const joined = out.join(' ')
  assert.match(joined, /Schade/)
  assert.match(joined, /Bilbo/)
  assert.ok(out.length <= 2)
})

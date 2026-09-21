import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchupRecapSentences, variantIndex, ordinal, recapWeekWrapSentences } from './weeklyRecapText.js'
import { isMottyVeganLine } from './blurbEngine.js'

const team = (over = {}) => ({
  entryId: 1,
  name: 'Mordor S.F.G',
  points: 61,
  rank: 2,
  prevRank: 4,
  record: { w: 2, d: 0, l: 1 },
  streak: { type: 'W', len: 2 },
  seasonAvg: 52.3,
  isSeasonHigh: false,
  isWeekHigh: false,
  titleOdds: null,
  ...over,
})

const base = {
  gw: 3,
  home: team(),
  away: team({
    entryId: 2,
    name: 'Seoul Shire',
    points: 45,
    rank: 7,
    prevRank: 6,
    record: { w: 1, d: 0, l: 2 },
    streak: { type: 'L', len: 1 },
    seasonAvg: 47.0,
  }),
  odds: { favoriteSide: 'home', favoritePct: 62 },
  leagueAvg: 52,
}

const joined = (m) => matchupRecapSentences(m).join(' ')

test('deterministic recap copy, at most two sentences', () => {
  const a = matchupRecapSentences(base)
  const b = matchupRecapSentences(base)
  assert.deepEqual(a, b)
  assert.ok(a.length >= 1 && a.length <= 2, `unexpected length ${a.length}: ${JSON.stringify(a)}`)
  for (const s of a) assert.ok(s.length > 10, `sentence too short: "${s}"`)
})

test('no pre-match call still produces a recap', () => {
  const out = matchupRecapSentences({ ...base, odds: null })
  assert.ok(out.length >= 1 && out.length <= 2)
  assert.match(out.join(' '), /61|45|Mordor|Seoul/)
})

test('lead names the winner and the score', () => {
  const [lead] = matchupRecapSentences(base)
  assert.match(lead, /61–45|61|45/)
  assert.ok(lead.indexOf('Mordor') < lead.indexOf('Seoul'), `winner named first: "${lead}"`)
})

test('draw uses a stalemate fact line', () => {
  const drawn = matchupRecapSentences({
    ...base,
    home: team({ points: 50 }),
    away: { ...base.away, points: 50 },
  })
  assert.match(drawn[0], /50–50|stalemate|draw|split|cancel/i)
})

test('named fixture leads the recap every time the pair meets', () => {
  const warderloo = {
    ...base,
    home: team({ name: 'Toronto Gimli', manager: 'Andy Ward' }),
    away: { ...base.away, name: 'Suffolk Sméagol', manager: 'Jon Ward' },
  }
  const first = matchupRecapSentences({ ...warderloo, h2h: { games: 1, homeWins: 1, awayWins: 0, draws: 0 } })
  assert.match(first.join(' '), /Battle of Warderloo/)
  const second = matchupRecapSentences({ ...warderloo, h2h: { games: 2, homeWins: 1, awayWins: 1, draws: 0 } })
  assert.match(second.join(' '), /Battle of Warderloo/)
  assert.ok(first.length <= 2)
})

test('named fixture: Andy vs Goodacre is the Bad Blood Derby', () => {
  const text = joined({
    ...base,
    home: team({ name: 'Toronto Gimli', manager: 'Andy Ward' }),
    away: { ...base.away, name: 'Atlético Bilbo', manager: 'Nick Goodacre' },
  })
  assert.match(text, /Bad Blood Derby/)
})

test('named fixture: Higman vs Sutton is the Respect Derby', () => {
  const text = joined({
    ...base,
    home: team({ name: 'Rokesly Regorasu', manager: 'David Higman' }),
    away: { ...base.away, name: 'Hackney Rohirrim', manager: 'Mike Sutton' },
  })
  assert.match(text, /Respect Derby/)
})

test('no named-fixture lead for an ordinary pairing', () => {
  const [lead] = matchupRecapSentences({
    ...base,
    home: team({ manager: 'Nick Mottershead' }),
    away: { ...base.away, manager: 'Mike Sutton' },
  })
  assert.doesNotMatch(lead, /Battle|derby/i)
})

test('Mottershead recap always has a recap-bank vegan line', () => {
  for (let gw = 1; gw <= 16; gw++) {
    const quiet = matchupRecapSentences({
      ...base,
      gw,
      home: team({ manager: 'Nick Mottershead' }),
    })
    assert.equal(quiet.length, 2)
    assert.equal(isMottyVeganLine(quiet[1], 'recap'), true, quiet[1])
    assert.deepEqual(quiet, matchupRecapSentences({ ...base, gw, home: team({ manager: 'Nick Mottershead' }) }))
  }
})

test('waiver haul can be the recap angle', () => {
  const text = joined({
    ...base,
    home: team({
      manager: 'Eddy Webster',
      players: { top: { id: 42, name: 'Mbeumo', pts: 16 }, share: 0.28, haul: { id: 42, name: 'Mbeumo', pts: 16 }, flop: null },
      pickup: { star: { name: 'Mbeumo', pts: 16, kind: 'w', gw: 3, recent: true, wasHaul: true } },
    }),
  })
  assert.match(text, /Mbeumo|61|Mordor|Seoul/)
  assert.doesNotMatch(text, /% of the|the dud for/)
})

test('no fingerprint stack of both top scorers plus share plus total', () => {
  const text = joined({
    ...base,
    home: team({
      points: 55,
      players: { top: { name: 'Salah', pts: 24 }, share: 0.436, haul: { name: 'Salah', pts: 24 }, flop: null },
    }),
    away: {
      ...base.away,
      players: { top: { name: 'Watkins', pts: 8 }, share: 0.18, haul: null, flop: null },
    },
  })
  assert.doesNotMatch(text, /% of the|% of their/)
})

test('variantIndex is stable and in range', () => {
  for (const key of ['a', 'b', 'team-1-gw3', '']) {
    const v = variantIndex(key, 3)
    assert.equal(v, variantIndex(key, 3))
    assert.ok(v >= 0 && v < 3)
  }
})

test('ordinal', () => {
  assert.equal(ordinal(1), '1st')
  assert.equal(ordinal(2), '2nd')
  assert.equal(ordinal(3), '3rd')
  assert.equal(ordinal(4), '4th')
  assert.equal(ordinal(11), '11th')
  assert.equal(ordinal(21), '21st')
})

test('week wrap always names derbies on the card', () => {
  const wrap = recapWeekWrapSentences({
    gw: 2,
    matchups: [
      {
        home: { manager: 'Andy Ward', rank: 4, record: { w: 1, d: 0, l: 0 } },
        away: { manager: 'Nick Goodacre', rank: 8, record: { w: 0, d: 0, l: 1 } },
      },
      {
        home: { manager: 'David Higman', rank: 1, record: { w: 1, d: 0, l: 0 } },
        away: { manager: 'Luke Butcher', rank: 3, record: { w: 1, d: 0, l: 0 } },
      },
    ],
  })
  const text = wrap.join(' ')
  assert.match(text, /Bad Blood Derby/)
  assert.match(text, /East Asian Derby/)
})

test('week wrap is empty when there are no named fixtures or hooks', () => {
  const wrap = recapWeekWrapSentences({
    gw: 99,
    matchups: [
      {
        home: { manager: 'Mike Sutton', rank: 3, record: { w: 2, d: 0, l: 0 } },
        away: { manager: 'Luke Butcher', rank: 4, record: { w: 1, d: 0, l: 1 } },
      },
    ],
  })
  assert.deepEqual(wrap, [])
})

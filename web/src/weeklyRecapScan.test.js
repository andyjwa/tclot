import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  fixtureStoryLines,
  glanceFixture,
  glanceTiles,
  personalityRecap,
  recapStem,
  themeSupport,
} from './weeklyRecapScan.js'
import { indexRecapSite } from './recapSiteContext.js'

const recapGw = {
  model: {
    hits: 3,
    misses: 1,
    upset: { winnerName: 'Seoul Shire', loserName: 'Hackney Rohirrim', winnerPct: 23 },
  },
  superlatives: {
    weekHigh: { name: 'Rokesly Regorasu', points: 55 },
    starPlayer: { name: 'Stach', pts: 13 },
    bestWaiver: { name: 'Barry', pts: 8 },
    dud: { name: 'Watkins', pts: 0, overallPick: 8 },
  },
}

const recapMatch = {
  gw: 1,
  home: {
    entryId: 18279,
    name: 'Mordor S.F.G',
    manager: 'Nick Mottershead',
    points: 51,
    rank: 3,
    record: { w: 1, d: 0, l: 0 },
    seasonAvg: 51,
    players: {
      top: { id: 165, name: 'João Pedro', pts: 11 },
      share: 0.216,
      flop: { id: 529, name: 'Roefs', pts: 1, xp: 5.4 },
    },
    titleOdds: { before: 8.2, after: 11.6 },
  },
  away: {
    entryId: 4259,
    name: 'Atlético Bilbo',
    manager: 'Nick Goodacre',
    points: 24,
    rank: 8,
    record: { w: 0, d: 0, l: 1 },
    seasonAvg: 24,
    players: {
      top: { id: 230, name: 'Branthwaite', pts: 6 },
      share: 0.25,
      flop: { id: 423, name: 'Shaw', pts: 1, xp: 5.1 },
    },
    titleOdds: { before: 6.4, after: 4.1 },
  },
  odds: { favoriteSide: 'home', favoritePct: 74, outcome: 'hit' },
  predicted: { home: 38.4, away: 30.6 },
  margin: 27,
}

test('glanceTiles header adds model dots and top scorer', () => {
  const tiles = glanceTiles({
    recapGw: {
      ...recapGw,
      model: {
        ...recapGw.model,
        calls: [
          { outcome: 'hit' },
          { outcome: 'miss' },
          { outcome: 'hit' },
          { outcome: 'hit' },
        ],
      },
    },
    preview: false,
    decided: 4,
  })
  assert.deepEqual(
    tiles.map((t) => t.label),
    ['GW scorer', 'Best waiver', 'Dud', 'Model', 'Top scorer'],
  )
  assert.equal(tiles[0].value, '55')
  assert.equal(tiles[1].value, '8')
  assert.equal(tiles[2].value, '0')
  const model = tiles.find((t) => t.label === 'Model')
  assert.deepEqual(model.dots, ['win', 'loss', 'win', 'win'])
  assert.equal(model.value, '3/4')
  assert.equal(tiles.find((t) => t.label === 'Top scorer')?.value, '13')
  assert.equal(tiles.find((t) => t.label === 'Top scorer')?.sub, 'Stach')
})

test('preview header is fav, underdog, top scorer, waiver and potential dud', () => {
  const tiles = glanceTiles({
    preview: true,
    previewGw: {
      superlatives: {
        favourite: { name: 'Hackney Rohirrim', pct: 77 },
        topScorer: null,
        bestWaiver: { name: 'Schade', xp: 4.2 },
        dud: { name: 'Isak', xp: 1.2, overallPick: 3 },
      },
      matchups: [
        {
          home: { name: 'Mordor S.F.G', keys: [{ name: 'Verbruggen', xp: 3.9 }] },
          away: { name: 'Atlético Bilbo', keys: [{ name: 'Donnarumma', xp: 4.9 }] },
          odds: { home: 73, away: 24, favoriteSide: 'home', favoritePct: 73 },
        },
        {
          home: { name: 'Seoul Shire', keys: [{ name: 'Salah', xp: 6.1 }] },
          away: { name: 'Hackney Rohirrim', keys: [{ name: 'Haaland', xp: 5.5 }] },
          odds: { home: 21, away: 77, favoriteSide: 'away', favoritePct: 77 },
        },
      ],
    },
  })
  assert.deepEqual(
    tiles.map((t) => t.label),
    ['Biggest fav', 'Biggest underdog', 'Top scorer', 'Best waiver', 'Potential dud'],
  )
  assert.equal(tiles[0].value, '77%')
  assert.equal(tiles[0].sub, 'Hackney Rohirrim')
  assert.equal(tiles[1].value, '21%')
  assert.equal(tiles[1].sub, 'Seoul Shire')
  assert.equal(tiles[2].value, '6.1')
  assert.equal(tiles[2].sub, 'Salah')
  assert.equal(tiles[3].value, '4.2')
  assert.equal(tiles[3].sub, 'Schade')
  assert.equal(tiles[4].value, '1.2')
  assert.equal(tiles[4].sub, 'Isak · pick 3')
})

test('preview header derives favourite and underdog from matchup odds', () => {
  const tiles = glanceTiles({
    preview: true,
    previewGw: {
      superlatives: {
        bestWaiver: { name: 'Schade', xp: 4.2 },
        dud: { name: 'Isak', xp: 1.2 },
      },
      matchups: [
        {
          home: { name: 'Mordor S.F.G', keys: [{ name: 'Roefs', xp: 5.4 }] },
          away: { name: 'Atlético Bilbo' },
          odds: { home: 73, away: 24, favoriteSide: 'home', favoritePct: 73 },
        },
      ],
    },
  })
  assert.equal(tiles.find((t) => t.label === 'Biggest fav')?.value, '73%')
  assert.equal(tiles.find((t) => t.label === 'Biggest fav')?.sub, 'Mordor SFG')
  assert.equal(tiles.find((t) => t.label === 'Biggest underdog')?.value, '24%')
  assert.equal(tiles.find((t) => t.label === 'Biggest underdog')?.sub, 'Atlético Bilbo')
})

test('preview brief names both teams', () => {
  const lines = personalityRecap(
    {
      gw: 2,
      home: {
        entryId: 18279,
        name: 'Mordor S.F.G',
        manager: 'Nick Mottershead',
        keys: [{ name: 'Roefs', xp: 5.4 }],
        titlePrice: '9/4',
      },
      away: {
        entryId: 4259,
        name: 'Atlético Bilbo',
        manager: 'Nick Goodacre',
        keys: [{ name: 'Shaw', xp: 5.1 }],
        recentPickups: [{ name: 'Dorgu', kind: 'w' }],
        titlePrice: '100/1',
      },
      odds: { home: 73, away: 24, favoriteSide: 'home', favoritePct: 73 },
      bookie: { home: '4/11', away: '3/1' },
      predicted: { home: 38.4, away: 30.6 },
    },
    true,
  )
  assert.ok(lines.length >= 1 && lines.length <= 2)
  const blob = lines.join(' ')
  assert.match(blob, /Mordor/)
  assert.match(blob, /Bilbo/)
  assert.equal(lines.kinds.includes('vegan'), true)
})

test('every preview card names both teams even after leads repeat', () => {
  const matchups = [
    {
      gw: 1,
      home: { entryId: 1, name: 'Mordor S.F.G', manager: 'Nick Mottershead', keys: [{ name: 'Roefs', xp: 5.4 }] },
      away: { entryId: 2, name: 'Atlético Bilbo', manager: 'Nick Goodacre', keys: [{ name: 'Shaw', xp: 5.1 }] },
      odds: { home: 73, away: 24 },
      bookie: { home: '4/11', away: '3/1' },
      predicted: { home: 38.4, away: 30.6 },
    },
    {
      gw: 1,
      home: { entryId: 3, name: 'Seoul Shire', manager: 'Luke Butcher', keys: [{ name: 'Saka', xp: 6.1 }] },
      away: { entryId: 4, name: 'Hackney Rohirrim', manager: 'Mike Sutton', keys: [{ name: 'Gabriel', xp: 5.6 }] },
      odds: { home: 21, away: 77 },
      bookie: { home: '4/1', away: '3/10' },
      predicted: { home: 35.5, away: 45.6 },
    },
    {
      gw: 1,
      home: { entryId: 5, name: 'Brampton Balrogs', manager: 'Eddy Webster', keys: [{ name: 'Semenyo', xp: 5.2 }] },
      away: { entryId: 6, name: 'Rokesly Regorasu', manager: 'David Higman', keys: [{ name: 'Calafiori', xp: 5.5 }] },
      odds: { home: 48, away: 50 },
      bookie: { home: '11/10', away: 'Evs' },
      predicted: { home: 39.1, away: 39.6 },
    },
    {
      gw: 1,
      home: { entryId: 7, name: 'Toronto Gimli', manager: 'Jon Ward', keys: [{ name: 'White', xp: 4.8 }] },
      away: { entryId: 8, name: 'Suffolk Sméagol', manager: 'Andy Ward', keys: [{ name: 'Haaland', xp: 5.8 }] },
      odds: { home: 40, away: 58 },
      bookie: { home: '6/4', away: '4/6' },
      predicted: { home: 36.2, away: 41.6 },
    },
  ]
  const used = { lines: [], kinds: [], stems: [] }
  for (const m of matchups) {
    const { recap } = glanceFixture(m, { preview: true, used })
    used.lines.push(...recap)
    used.kinds.push(...(recap.kinds || []))
    used.stems.push(...(recap.stems || []))
    const blob = recap.join(' ')
    assert.match(blob, new RegExp(m.home.name.split(/\s/)[0], 'i'))
    assert.match(blob, new RegExp(m.away.name.split(/\s/)[0].replace('é', 'é'), 'i'))
    assert.ok(recap.length >= 1 && recap.length <= 2)
  }
})

test('personalityRecap is vegan for Mottershead and not a two-manager checklist', () => {
  const a = personalityRecap(recapMatch)
  const b = personalityRecap(recapMatch)
  assert.ok(a.length >= 1 && a.length <= 2)
  assert.deepEqual(a, b)
  assert.ok(a.kinds.includes('vegan'))
  assert.match(a.join(' '), /Mordor|SFG/i)
  assert.match(a.join(' '), /Bilbo|Atlético/i)
})

test('fixture stories cover waiver, projected, scorer, dud, streak and bad record', () => {
  const recap = fixtureStoryLines(
    {
      home: {
        name: 'Toronto Gimli',
        manager: 'Jon Ward',
        rank: 8,
        record: { w: 0, d: 0, l: 4 },
        streak: { type: 'L', len: 3 },
        pickup: { name: 'Schade', pts: 2, xp: 5.1, kind: 'w' },
        players: { top: { name: 'White', pts: 11 }, flop: { name: 'Isak', pts: 1, xp: 6.2 } },
      },
      away: {
        name: 'Hackney Rohirrim',
        manager: 'Mike Sutton',
        record: { w: 5, d: 0, l: 0 },
        streak: { type: 'W', len: 5 },
        players: { top: { name: 'Stach', pts: 13 } },
      },
    },
    false,
    'recap-stories',
  )
  const blob = recap.join(' ')
  assert.match(blob, /Schade|waiver/i)
  assert.match(blob, /White|Stach/i)
  assert.match(blob, /Isak|dud/i)
  assert.match(blob, /3-game losing|5-game winning/i)
  assert.match(blob, /0-0-4|first win|8th/i)

  const preview = fixtureStoryLines(
    {
      home: {
        name: 'Seoul Shire',
        manager: 'Luke Butcher',
        recentPickups: [{ name: 'Tel', kind: 'w' }],
        keys: [{ name: 'Saka', xp: 6.1 }],
      },
      away: {
        name: 'Atlético Bilbo',
        manager: 'Nick Goodacre',
        keys: [{ name: 'Petrović', xp: 4.8 }],
      },
    },
    true,
    'preview-stories',
  )
  const pre = preview.join(' ')
  assert.match(pre, /Tel|waiver/i)
  assert.match(pre, /Saka|Petrović/i)
})

test('recap fixture: model, top scorer, both title odds', () => {
  const out = glanceFixture(recapMatch)
  assert.deepEqual(
    out.stats.map((t) => [t.label, t.value]),
    [
      ['Model', 'Right'],
      ['Top scorer', '11'],
      ['Mordor', '11.6%'],
      ['Bilbo', '4.1%'],
    ],
  )
  assert.equal(out.stats[2].sub, 'title')
  assert.equal(out.stats[2].tone, 'win')
  assert.equal(out.stats[3].tone, 'loss')
  assert.ok(out.recap.length >= 1 && out.recap.length <= 2)
})

test('preview fixture is two team book squares plus top scorer', () => {
  const out = glanceFixture(
    {
      gw: 1,
      home: {
        entryId: 1,
        name: 'Seoul Shire',
        manager: 'Jon Ward',
        keys: [{ name: 'Verbruggen', xp: 3.9 }],
      },
      away: {
        entryId: 2,
        name: 'Atlético Bilbo',
        manager: 'Mike Sutton',
        keys: [{ name: 'Petrović', xp: 4.8 }],
      },
      odds: { favoriteSide: 'away', favoritePct: 53 },
      bookie: { home: '11/8', draw: '25/1', away: '10/11' },
    },
    { preview: true },
  )
  assert.deepEqual(
    out.stats.map((t) => [t.label, t.value]),
    [
      ['Seoul', '11/8'],
      ['Bilbo', '10/11'],
      ['Top scorer', '4.8'],
    ],
  )
  assert.ok(!out.stats.some((t) => String(t.value).includes('25/1')))
  assert.equal(out.stats[1].tone, 'win')
  assert.equal(out.stats[2].sub, 'Petrović')
  assert.ok(out.recap.length >= 1 && out.recap.length <= 2)
})

function accumulate(matchups, preview) {
  const used = { lines: [], kinds: [], stems: [] }
  return matchups.map((m) => {
    const out = glanceFixture(m, { preview, used })
    used.lines.push(...out.recap)
    used.kinds.push(...out.kinds)
    used.stems.push(...out.stems)
    return out
  })
}

test('four recap cards do not reuse a stem or joke line', () => {
  const matchups = [
    recapMatch,
    {
      gw: 1,
      home: {
        entryId: 3,
        name: 'Seoul Shire',
        manager: 'Luke Butcher',
        points: 47,
        players: { top: { name: 'Saka', pts: 9 }, flop: { name: 'Maguire', pts: 1, xp: 5.6 } },
      },
      away: {
        entryId: 4,
        name: 'Hackney Rohirrim',
        manager: 'Mike Sutton',
        points: 31,
        players: { top: { name: 'Stach', pts: 8 }, flop: { name: 'Wood', pts: 2, xp: 4.9 } },
      },
      odds: { favoriteSide: 'away', favoritePct: 61, outcome: 'miss' },
    },
    {
      gw: 1,
      home: {
        entryId: 5,
        name: 'Brampton Balrogs',
        manager: 'David Higman',
        points: 38,
        rank: 8,
        record: { w: 0, d: 0, l: 4 },
        streak: { type: 'L', len: 3 },
        pickup: { name: 'Schade', pts: 2, xp: 5.1, kind: 'w' },
        players: { top: { name: 'Palmer', pts: 7 }, flop: { name: 'Isak', pts: 1, xp: 6.2 } },
      },
      away: {
        entryId: 6,
        name: 'Rokesly Regorasu',
        manager: 'Eddy Webster',
        points: 55,
        players: { top: { name: 'Gakpo', pts: 12 } },
      },
      odds: { favoriteSide: 'away', favoritePct: 58, outcome: 'hit' },
    },
    {
      gw: 1,
      home: {
        entryId: 7,
        name: 'Toronto Gimli',
        manager: 'Jon Ward',
        points: 39,
        players: { top: { name: 'White', pts: 11 }, flop: { name: 'Lammens', pts: 1, xp: 5.7 } },
      },
      away: {
        entryId: 8,
        name: 'Suffolk Sméagol',
        manager: 'Andy Ward',
        points: 52,
        players: { top: { name: 'Haaland', pts: 10 } },
      },
      odds: { favoriteSide: 'home', favoritePct: 55, outcome: 'miss' },
    },
  ]
  const boxes = accumulate(matchups, false)
  const stems = boxes.flatMap((b) => b.stems.filter((s) => s !== 'vegan'))
  assert.equal(new Set(stems).size, stems.length)
  const pairRe = [
    [/Mordor|SFG/i, /Bilbo|Atlético/i],
    [/Seoul|Shire/i, /Hackney|Rohirrim/i],
    [/Brampton|Balrogs/i, /Rokesly|Regorasu/i],
    [/Toronto|Gimli/i, /Suffolk|Sméagol/i],
  ]
  boxes.forEach((b, i) => {
    const blob = b.recap.join(' ')
    assert.match(blob, pairRe[i][0], `card ${i} missing home`)
    assert.match(blob, pairRe[i][1], `card ${i} missing away`)
  })
  const lines = boxes.flatMap((b) => b.recap.map((s) => s.toLowerCase()))
  assert.equal(new Set(lines).size, lines.length)
  const newsKinds = boxes.map((b) => b.kinds.find((k) => k !== 'vegan' && k !== 'joke'))
  assert.ok(newsKinds.every(Boolean))
  assert.ok(boxes[0].kinds.includes('vegan'))
})

test('same fixture recap and preview do not share a news stem', () => {
  const m = {
    gw: 2,
    home: {
      entryId: 1,
      name: 'Seoul Shire',
      manager: 'Luke Butcher',
      points: 44,
      keys: [{ name: 'Saka', xp: 6.1 }],
      players: { top: { name: 'Saka', pts: 9 }, flop: { name: 'Maguire', pts: 1, xp: 5.6 } },
    },
    away: {
      entryId: 2,
      name: 'Hackney Rohirrim',
      manager: 'Mike Sutton',
      points: 30,
      keys: [{ name: 'Gabriel', xp: 5.6 }],
      players: { top: { name: 'Stach', pts: 8 } },
    },
    odds: { favoriteSide: 'home', favoritePct: 62, outcome: 'hit' },
  }
  const recap = personalityRecap(m, false)
  const preview = personalityRecap(m, true)
  const recapNews = recap.stems.filter((s) => s !== 'vegan' && s !== 'joke')
  const previewNews = preview.stems.filter((s) => s !== 'vegan' && s !== 'joke')
  assert.ok(recapNews.every((s) => !previewNews.includes(s)))
  assert.ok(!/projected stack|hinge is/i.test(recap.join(' ')))
  assert.ok(!/led .+ with|biggest return|the dud for/i.test(preview.join(' ')))
})

test('a joke line used on the first card does not return on the second', () => {
  const first = glanceFixture({
    gw: 3,
    home: {
      entryId: 1,
      name: 'Toronto Gimli',
      manager: 'Jon Ward',
      points: 40,
      players: { top: { name: 'White', pts: 11 } },
    },
    away: {
      entryId: 2,
      name: 'Hackney Rohirrim',
      manager: 'Mike Sutton',
      points: 33,
      players: { top: { name: 'Stach', pts: 8 } },
    },
    odds: { favoriteSide: 'home', favoritePct: 54, outcome: 'hit' },
  })
  const second = glanceFixture(
    {
      gw: 3,
      home: {
        entryId: 1,
        name: 'Toronto Gimli',
        manager: 'Jon Ward',
        points: 28,
        players: { top: { name: 'Saliba', pts: 6 } },
      },
      away: {
        entryId: 3,
        name: 'Seoul Shire',
        manager: 'Luke Butcher',
        points: 41,
        players: { top: { name: 'Saka', pts: 10 } },
      },
      odds: { favoriteSide: 'away', favoritePct: 57, outcome: 'hit' },
    },
    {
      used: {
        lines: [...first.recap],
        kinds: [...first.kinds],
        stems: [...first.stems],
      },
    },
  )
  for (const line of first.recap) {
    assert.ok(!second.recap.some((s) => s.toLowerCase() === line.toLowerCase()))
  }
  assert.equal(recapStem('The projected stack for Seoul runs through Saka (6.1)'), 'projected-stack')
})

test('recap waiver theme still names the other team', () => {
  const lines = personalityRecap({
    gw: 3,
    home: {
      entryId: 1,
      name: 'Toronto Gimli',
      manager: 'Jon Ward',
      points: 38,
      players: { top: { name: 'Saka', pts: 8 } },
    },
    away: {
      entryId: 2,
      name: 'Hackney Rohirrim',
      manager: 'Mike Sutton',
      points: 50,
      pickup: { name: 'King', pts: 10, xp: 4.1, kind: 'w' },
      players: { top: { name: 'King', pts: 10 } },
      record: { w: 1, d: 0, l: 2 },
      rank: 8,
    },
    odds: { favoriteSide: 'home', favoritePct: 61, outcome: 'miss' },
    predicted: { home: 41.2, away: 26.1 },
    winner: 2,
    margin: 12,
  })
  const blob = lines.join(' ')
  assert.match(blob, /Gimli|Toronto/i)
  assert.match(blob, /Hackney|Rohirrim/i)
})

test('recap streak theme still names the other team', () => {
  const lines = personalityRecap({
    gw: 3,
    home: {
      entryId: 8,
      name: 'Suffolk Sméagol',
      manager: 'Andy Ward',
      points: 34,
      players: { top: { name: 'Haaland', pts: 7 } },
    },
    away: {
      entryId: 6,
      name: 'Rokesly Regorasu',
      manager: 'David Higman',
      points: 47,
      streak: { type: 'W', len: 3 },
      record: { w: 3, d: 0, l: 0 },
      rank: 1,
      players: { top: { name: 'Gakpo', pts: 11 } },
    },
    odds: { favoriteSide: 'away', favoritePct: 70, outcome: 'hit' },
    winner: 6,
    margin: 13,
  })
  const blob = lines.join(' ')
  assert.match(blob, /Suffolk|Sméagol/i)
  assert.match(blob, /Rokesly|Regorasu/i)
})

test('themeSupport stays on a haul and quotes share, projection and prior week', () => {
  const news = {
    kind: 'haul',
    text: 'João Pedro led Mordor with 11',
    stem: 'led-with',
    about: {
      side: recapMatch.home,
      opp: recapMatch.away,
      player: recapMatch.home.players.top,
    },
  }
  const site = indexRecapSite({
    historyByGw: {
      1: {
        h2h: [
          {
            xi1: [{ id: 165, name: 'João Pedro', pts: 4 }],
            xi2: [],
          },
        ],
      },
    },
    benchPoints: {
      teams: [
        {
          leagueEntryId: 18279,
          weeks: [
            {
              gw: 1,
              benchLeft: 11,
              leftOnBench: [{ id: 68, name: 'Tavernier', pts: 10 }],
            },
          ],
        },
      ],
    },
  })
  const lines = themeSupport(
    { ...recapMatch, gw: 2 },
    news,
    { site, key: 'haul-support' },
  )
  const blob = lines.join(' ')
  assert.ok(lines.length >= 2)
  assert.match(blob, /22%|38\.4|up from 4|Tavernier/)
})

test('two Mottershead cards both keep vegan and stay at two sentences', () => {
  const used = { lines: [], kinds: [], stems: [] }
  const first = glanceFixture(recapMatch, { used })
  used.lines.push(...first.recap)
  used.kinds.push(...first.kinds)
  used.stems.push(...first.stems)
  const second = glanceFixture(
    {
      ...recapMatch,
      home: { ...recapMatch.away, manager: 'Nick Mottershead', name: 'Hackney Rohirrim' },
    },
    { used },
  )
  assert.ok(first.recap.length >= 1 && first.recap.length <= 2)
  assert.ok(second.recap.length >= 1 && second.recap.length <= 2)
  assert.ok(first.kinds.includes('vegan'))
  assert.ok(second.kinds.includes('vegan'))
})

test('preview waiver brief skips a 0-0-0 table line', () => {
  const side = {
    entryId: 10173,
    name: 'Hackney Rohirrim',
    manager: 'Mike Mottershead',
    record: { w: 0, d: 0, l: 0 },
    rank: 0,
  }
  const lines = themeSupport(
    {
      gw: 1,
      home: side,
      away: { name: 'Seoul Shire', entryId: 44904 },
      predicted: { home: 45.6, away: 35.5 },
    },
    {
      kind: 'waiver',
      text: 'Mike claimed Dorgu on the waiver',
      stem: 'claimed',
      about: { side, pickup: { name: 'Dorgu' } },
    },
    { preview: true, key: 'waiver-empty' },
  )
  assert.doesNotMatch(lines.join(' '), /0th|0-0-0/)
  assert.match(lines.join(' '), /45\.6/)
})

test('streak brief uses table and title-model numbers from the site', () => {
  const side = {
    entryId: 6849,
    name: 'Rokesly Regorasu',
    manager: 'David Higman',
    points: 55,
    rank: 1,
    prevRank: 3,
    record: { w: 3, d: 0, l: 0 },
    streak: { type: 'W', len: 3 },
    seasonAvg: 44,
  }
  const news = {
    kind: 'streak',
    text: 'David is on a 3-game winning streak',
    stem: 'streak',
    about: { side, opp: recapMatch.away },
  }
  const site = indexRecapSite({
    seasonPredictions: {
      current: {
        teams: [{ leagueEntryId: 6849, titlePct: 31.9, lastPct: 1.5, avgFinish: 2.8 }],
      },
    },
  })
  const lines = themeSupport(
    {
      gw: 3,
      home: side,
      away: recapMatch.away,
      predicted: { home: 40, away: 30 },
      margin: 12,
      winner: 6849,
    },
    news,
    { site, key: 'streak-support' },
  )
  const blob = lines.join(' ')
  assert.match(blob, /1st|3-0-0|31\.9%|40|season clip/)
})

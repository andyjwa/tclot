import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  generateGwBlurbs,
  generateMatchupBlurb,
  isMottyVeganLine,
  emptyBlurbState,
  createGwContext,
  previewConfig,
  recapConfig,
} from './blurbEngine.js'
import { matchupPreviewSentences } from './weeklyPreviewText.js'
import { matchupRecapSentences } from './weeklyRecapText.js'

const team = (over = {}) => ({
  entryId: 1,
  name: 'Mordor S.F.G',
  manager: 'Nick Mottershead',
  points: 61,
  rank: 2,
  record: { w: 2, d: 0, l: 1 },
  ...over,
})

const recapBase = {
  gw: 3,
  home: team(),
  away: team({
    entryId: 2,
    name: 'Seoul Shire',
    manager: 'Luke Butcher',
    points: 45,
    rank: 7,
    record: { w: 1, d: 0, l: 2 },
  }),
  odds: { favoriteSide: 'home', favoritePct: 62, home: 62, away: 35, outcome: 'hit' },
}

const previewBase = {
  gw: 2,
  home: team({ points: undefined, keys: [{ name: 'João Pedro', xp: 6.4 }] }),
  away: team({
    entryId: 2,
    name: 'Atlético Bilbo',
    manager: 'Nick Goodacre',
    rank: 8,
    record: { w: 0, d: 0, l: 1 },
    keys: [{ name: 'Enzo', xp: 5.3 }],
  }),
  odds: { favoriteSide: 'home', favoritePct: 74, home: 74, draw: 3, away: 23 },
  bookie: { home: '1/4', draw: '33/1', away: '10/3' },
  predicted: { home: 44, away: 31 },
}

function countSentences(lines) {
  const t = lines
    .join(' ')
    .replace(/S\.F\.G/gi, 'SFG')
    .replace(/\b[A-Z]\./g, 'X')
    .replace(/\d+\.\d+/g, 'n')
  return t.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean).length
}

test('recap emits at most two sentences and is deterministic', () => {
  const a = matchupRecapSentences(recapBase)
  const b = matchupRecapSentences(recapBase)
  assert.deepEqual(a, b)
  assert.ok(a.length >= 1 && a.length <= 2)
  assert.ok(countSentences(a) <= 2)
  assert.match(a.join(' '), /61|45|Mordor|Seoul/)
})

test('recap Motty always gets a line from the recap vegan bank', () => {
  for (let gw = 1; gw <= 12; gw++) {
    const lines = matchupRecapSentences({ ...recapBase, gw })
    assert.ok(lines.length === 2, `gw ${gw} ${JSON.stringify(lines)}`)
    assert.equal(isMottyVeganLine(lines[1], 'recap'), true, lines[1])
  }
})

test('preview Motty always gets a line from the preview vegan bank', () => {
  for (let gw = 1; gw <= 8; gw++) {
    const lines = matchupPreviewSentences({ ...previewBase, gw })
    assert.ok(lines.length === 2)
    assert.equal(isMottyVeganLine(lines[1], 'preview'), true, lines[1])
    assert.ok(countSentences(lines) <= 2)
  }
})

test('non-Motty preview is fact-line only (no vegan)', () => {
  const lines = matchupPreviewSentences({
    ...previewBase,
    home: team({ manager: 'David Higman', name: 'Rokesly Regorasu' }),
    away: team({
      entryId: 2,
      name: 'Seoul Shire',
      manager: 'Luke Butcher',
      keys: [{ name: 'Saka', xp: 6.8 }],
    }),
  })
  assert.ok(lines.length <= 2)
  assert.equal(isMottyVeganLine(lines[1] || '', 'preview'), false)
  assert.doesNotMatch(lines.join(' '), /oat milk|tempeh|seitan/i)
})

test('named rivalry brand is required on preview and recap', () => {
  const preview = matchupPreviewSentences({
    ...previewBase,
    home: team({ name: 'Toronto Gimli', manager: 'Andy Ward' }),
    away: team({
      entryId: 2,
      name: 'Suffolk Sméagol',
      manager: 'Jon Ward',
      keys: [{ name: 'Palmer', xp: 6.1 }],
    }),
  })
  assert.match(preview.join(' '), /Battle of Warderloo/)
  assert.ok(preview.length <= 2)

  const recap = matchupRecapSentences({
    ...recapBase,
    home: team({ name: 'Toronto Gimli', manager: 'Andy Ward' }),
    away: {
      ...recapBase.away,
      name: 'Atlético Bilbo',
      manager: 'Nick Goodacre',
    },
  })
  assert.match(recap.join(' '), /Bad Blood Derby/)
})

test('four recap fixtures: one angle each, Motty vegan, rare lore', () => {
  const matchups = [
    {
      ...recapBase,
      home: team({ name: 'Mordor S.F.G', manager: 'Nick Mottershead', points: 51 }),
      away: team({
        entryId: 2,
        name: 'Atlético Bilbo',
        manager: 'Nick Goodacre',
        points: 24,
      }),
      margin: 27,
    },
    {
      gw: 3,
      home: {
        entryId: 3,
        name: 'Seoul Shire',
        manager: 'Luke Butcher',
        points: 47,
      },
      away: {
        entryId: 4,
        name: 'Hackney Rohirrim',
        manager: 'Mike Sutton',
        points: 31,
      },
      odds: { favoriteSide: 'away', favoritePct: 61, outcome: 'miss' },
    },
    {
      gw: 3,
      home: {
        entryId: 5,
        name: 'Brampton Balrogs',
        manager: 'Eddy Webster',
        points: 38,
      },
      away: {
        entryId: 6,
        name: 'Rokesly Regorasu',
        manager: 'David Higman',
        points: 40,
      },
      odds: { favoriteSide: 'home', favoritePct: 55, outcome: 'miss' },
    },
    {
      gw: 3,
      home: {
        entryId: 7,
        name: 'Toronto Gimli',
        manager: 'Andy Ward',
        points: 42,
      },
      away: {
        entryId: 8,
        name: 'Suffolk Sméagol',
        manager: 'Jon Ward',
        points: 40,
      },
      odds: { favoriteSide: 'home', favoritePct: 58, outcome: 'hit' },
    },
  ]
  const results = generateGwBlurbs(matchups, { surface: 'recap', gw: 3 })
  assert.equal(results.length, 4)
  const loreCount = results.filter((r) => r.loreLineId).length
  assert.ok(loreCount <= 1, `lore on ${loreCount} cards`)
  const templates = results.map((r) => r.templateId)
  assert.equal(new Set(templates).size, templates.length)
  assert.equal(isMottyVeganLine(results[0].sentences[1], 'recap'), true)
  assert.match(results[3].blurb, /Battle of Warderloo/)
  for (const r of results) {
    assert.ok(r.sentences.length <= 2)
    assert.doesNotMatch(r.blurb, /% of the|% of their|the dud for|led with/i)
  }
})

test('preview answers one claim and names both teams', () => {
  const lines = matchupPreviewSentences(previewBase)
  const blob = lines.join(' ')
  assert.match(blob, /Mordor/)
  assert.match(blob, /Bilbo/)
  assert.ok(lines.length <= 2)
  assert.doesNotMatch(blob, /\d+–\d+/, 'preview must not leak a final score')
})

test('blowout recap uses a margin angle when eligible', () => {
  const r = generateMatchupBlurb(
    {
      ...recapBase,
      home: team({ manager: 'Eddy Webster', points: 70 }),
      away: { ...recapBase.away, points: 40 },
      margin: 30,
    },
    { surface: 'recap' },
  )
  assert.ok(['margin_blowout', 'model_hit', 'fallback_result'].includes(r.angleId))
  assert.match(r.blurb, /70|40|30/)
})

test('cooldowns skip a Motty recap line already used this season', () => {
  const state = emptyBlurbState()
  const ctx = createGwContext(1, 'recap')
  const first = generateMatchupBlurb({ ...recapBase, gw: 1 }, { surface: 'recap', state, gwContext: ctx })
  const second = generateMatchupBlurb(
    { ...recapBase, gw: 2 },
    { surface: 'recap', state, gwContext: createGwContext(2, 'recap') },
  )
  assert.ok(first.mottyLineId)
  assert.ok(second.mottyLineId)
  assert.notEqual(first.mottyLineId, second.mottyLineId)
})

test('fact-line templates are a single sentence', () => {
  for (const [surface, cfg] of [
    ['preview', previewConfig],
    ['recap', recapConfig],
  ]) {
    for (const [pack, tpls] of Object.entries(cfg.templatePacks || {})) {
      for (const tpl of tpls) {
        const dummy = String(tpl.text || '').replace(/\{[^}]+\}/g, 'Slot')
        assert.ok(
          countSentences([dummy]) <= 1,
          `${surface} ${pack} ${tpl.id}: ${tpl.text}`,
        )
      }
    }
  }
})

test('preview does not stack odds and a waiver in one graf', () => {
  const lines = matchupPreviewSentences({
    gw: 4,
    home: {
      entryId: 10,
      name: 'Suffolk Sméagol',
      manager: 'Andrew Ward',
      pickup: { name: 'Mykolenko' },
    },
    away: {
      entryId: 11,
      name: 'Brampton Balrogs',
      manager: 'Eddy Webster',
    },
    odds: { favoriteSide: 'away', favoritePct: 49, home: 48, away: 49, draw: 3 },
    bookie: { home: '4/5', away: '11/10' },
  })
  assert.equal(countSentences(lines), 1, JSON.stringify(lines))
  const blob = lines.join(' ')
  const odds = /%|\d\/\d/.test(blob)
  const waiver = /wire|waiver|brought in|claimed|added/i.test(blob)
  assert.ok(!(odds && waiver), blob)
  assert.match(blob, /Suffolk|Brampton/)
})

test('rivalry overlay keeps a leading player name capitalised', () => {
  const r = generateMatchupBlurb(
    {
      gw: 6,
      home: {
        entryId: 20,
        name: 'Rokesly Regorasu',
        manager: 'David Higman',
        pickup: { name: 'Tel' },
      },
      away: {
        entryId: 21,
        name: 'Seoul Shire',
        manager: 'Luke Butcher',
      },
      odds: { favoriteSide: 'home', favoritePct: 59, home: 59, away: 39, draw: 2 },
    },
    { surface: 'preview' },
  )
  assert.match(r.blurb, /East Asian Derby/)
  assert.doesNotMatch(r.blurb, /: tel\b/)
})

test('emptyBlurbState serialises events after a GW', () => {
  const state = emptyBlurbState()
  generateGwBlurbs(
    [
      recapBase,
      {
        ...recapBase,
        home: team({ entryId: 3, manager: 'Mike Sutton', name: 'Hackney Rohirrim', points: 40 }),
        away: { ...recapBase.away, entryId: 4, points: 33 },
      },
    ],
    { surface: 'recap', gw: 3, state },
  )
  assert.ok(state.events.length >= 2)
  assert.ok(state.events.every((e) => e.templateId && e.angleId))
})

#!/usr/bin/env node
/**
 * Weekly recaps + pre-match look-forwards (web/public/league-data/weekly-recaps.json).
 *
 * Recap entries (`gameweeks`) — one per finished gameweek:
 *  - `model`: odds vs reality for the week
 *  - `matchups`: score, pre-match call, template recap paragraph, table context
 *  - `superlatives`: week high, closest match, star player, best waiver, dud
 *  - `wrap`: short week headline (named derbies, occasional personality)
 *  - `derby` on each matchup when the pairing has a nickname
 *
 * Preview entries (`previews`) — one per finished GW (locked Preview odds)
 * and the next unfinished GW only after that GW's lineup deadline:
 *  - win/draw/win percents from the locked XI + predictions.json forecast as
 *    Live Odds; those percents are frozen at first publish so the recap is a
 *    score of that Preview, not a post-GW reconstruction; projected XI points;
 *    watch-list from the locked 11
 *  - bookie fractions, recent waivers, last-week form
 *  - injuries / bench-vs-XI questions when they actually change the week
 *  - template look-forward paragraph (bookie lean / stakes / XI / lore)
 *
 * Recap winner-calls reuse the locked Preview freeze (`preview-odds/gw-NN.json`
 * plus the live site's published upcoming board). Post-GW engine archives are
 * only a fallback when no Preview freeze exists.
 *
 * Run AFTER build-upcoming-lineups.mjs + build-season-predictions.mjs
 * (and bookie-markets when present):
 *   node scripts/build-weekly-recaps.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  recapFactsForGw,
  findArchivedH2hRow,
  archivedXi,
  sidePlayerFacts,
  reconcileTeamPoints,
  h2hSeriesAsOf,
  ranksAsOf,
  bankedTable,
  streakAsOf,
  matchFavorite,
} from '../src/seasonPredictionsModel.js'
import { recapWeekWrapSentences } from '../src/weeklyRecapText.js'
import { namedFixtureFor } from '../src/leagueLore.js'
import {
  oddsPercents,
  watchPlayersFromXi,
  formFromXi,
} from '../src/weeklyPreviewText.js'
import {
  emptyBlurbState,
  generateGwBlurbs,
  serializeBlurbState,
  stateSlices,
} from '../src/blurbEngine.js'
import {
  calibrationSigmaScale,
  resolvePreviewOdds,
  starterElementIds,
  xiPredictionOdds,
} from '../src/weeklyPreviewOdds.js'
import {
  applyFreezeToRecapOdds,
  findFreezeRow,
  freezeRowsFromPreview,
  freezeToResolveInput,
  loadPreviewFreezeMap,
  mergeFreezeRow,
  persistFreezeGw,
} from '../src/weeklyPreviewFreeze.js'
import {
  playerAvailability,
  lineupFromPriorXi,
  pickInjuryImpacts,
  pickBenchBlunder,
  sumStarterXp,
  watchableXi,
} from '../src/weeklyPreviewLineup.js'
import { gwDeadlineHasPassed } from '../src/weeklyRecapView.js'
import {
  finishedEventIdsFromEvents,
  applyLeagueResults,
} from '../src/h2hEffectiveFinished.js'
import { decimalOddsToFraction, probToFractionalOdds } from '../src/oddsFormat.js'
import {
  pickTopScorer,
  pickBestWaiver,
  pickDraftDud,
} from '../src/weeklyRecapSuperlatives.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = join(root, 'public/league-data')
const read = (f) => JSON.parse(readFileSync(join(dataDir, f), 'utf8'))

/* Fail soft: no inputs → no tab, but never a broken deploy. */
let details
let predictions
try {
  details = read('details.json')
  predictions = read('season-predictions.json')
} catch (err) {
  console.warn('build-weekly-recaps: skip —', err.message)
  process.exit(0)
}
if (!predictions?.current?.teams?.length) {
  console.warn('build-weekly-recaps: skip — season-predictions.json has no teams')
  process.exit(0)
}

let fixtures = []
try {
  fixtures = read('fixtures.json')
} catch {
  fixtures = []
}
let bootstrapDraft = null
try {
  bootstrapDraft = read('bootstrap_draft.json')
} catch {
  bootstrapDraft = null
}
const { matches } = applyLeagueResults(
  details,
  fixtures,
  finishedEventIdsFromEvents(bootstrapDraft),
)
const entryIds = predictions.current.teams.map((t) => Number(t.leagueEntryId))
const nameById = new Map(
  predictions.current.teams.map((t) => [Number(t.leagueEntryId), t.name]),
)

/* Manager (human) names + the FPL entry-id bridge. details.json league_entries
 * carry both the league id (`id`) and the FPL entry id (`entry_id`) plus the
 * manager's name — transactions key off the FPL entry id, recaps off the
 * league id, so we need the map in both directions. */
const leagueEntries = details.league_entries ?? []
const managerById = new Map()
const leagueIdByFplEntry = new Map()
for (const e of leagueEntries) {
  const leagueId = Number(e.id)
  const fplEntry = Number(e.entry_id)
  const first = (e.player_first_name ?? '').trim()
  const last = (e.player_last_name ?? '').trim()
  const manager = [first, last].filter(Boolean).join(' ') || null
  if (Number.isFinite(leagueId)) managerById.set(leagueId, manager)
  if (Number.isFinite(fplEntry) && Number.isFinite(leagueId)) {
    leagueIdByFplEntry.set(fplEntry, leagueId)
  }
}

/* Successful waiver ('w') / free-agent ('f') pickups, grouped by league id.
 * Each entry records the element added, the GW it landed, and the channel so
 * the recap can say "waiver pickup" vs "free-agent punt". Fail soft: no file
 * or an empty list just means no pickup storylines. */
function loadAcquisitions() {
  let raw
  try {
    raw = read('transactions.json')
  } catch {
    return new Map()
  }
  const txs = Array.isArray(raw?.transactions) ? raw.transactions : []
  const byLeagueId = new Map()
  for (const tx of txs) {
    if (tx.result !== 'a') continue
    const elementIn = tx.element_in == null ? null : Number(tx.element_in)
    if (!Number.isFinite(elementIn)) continue
    const leagueId = leagueIdByFplEntry.get(Number(tx.entry))
    if (!Number.isFinite(leagueId)) continue
    if (!byLeagueId.has(leagueId)) byLeagueId.set(leagueId, [])
    byLeagueId.get(leagueId).push({
      elementIn,
      gw: Number(tx.event) || 0,
      kind: tx.kind === 'f' ? 'f' : 'w',
    })
  }
  return byLeagueId
}
const acquisitionsByLeagueId = loadAcquisitions()

/** The most relevant acquisition for `elementId` on `leagueId` at or before
 * `gw` — latest landing wins (a re-add resets the "recent" clock). Null when
 * the player wasn't picked up off waivers/free agency (e.g. drafted). */
function acquisitionFor(leagueId, elementId, gw) {
  if (elementId == null) return null
  const list = acquisitionsByLeagueId.get(Number(leagueId))
  if (!list) return null
  let best = null
  for (const a of list) {
    if (a.elementIn !== Number(elementId) || a.gw > gw) continue
    if (!best || a.gw > best.gw) best = a
  }
  return best
}

/** Pickup storyline for one side: does its standout (haul/top) or its flop
 * trace back to a waiver/free-agent move? `recent` flags a move made this GW
 * or the one before, when the decision is freshest. */
function sidePickupFacts(side, gw) {
  const players = side.players
  if (!players) return null
  const out = {}
  const star = players.haul ?? players.top
  if (star && star.id != null) {
    const acq = acquisitionFor(side.entryId, star.id, gw)
    if (acq) {
      out.star = {
        name: star.name,
        pts: star.pts,
        kind: acq.kind,
        gw: acq.gw,
        recent: gw - acq.gw <= 1,
        wasHaul: players.haul != null && players.haul.id === star.id,
      }
    }
  }
  if (players.flop && players.flop.id != null) {
    const acq = acquisitionFor(side.entryId, players.flop.id, gw)
    if (acq) {
      out.flop = {
        name: players.flop.name,
        pts: players.flop.pts,
        xp: players.flop.xp,
        kind: acq.kind,
        gw: acq.gw,
        recent: gw - acq.gw <= 1,
      }
    }
  }
  return out.star || out.flop ? out : null
}
const snapshotByGw = new Map(predictions.snapshots.map((s) => [s.asOfGw, s]))
const recordByGw = new Map(
  (predictions.modelRecord?.gameweeks ?? []).map((g) => [g.gw, g]),
)
const freezeByGw = await loadPreviewFreezeMap(dataDir)
for (const [gw, pairs] of freezeByGw) {
  persistFreezeGw(dataDir, gw, [...pairs.values()])
}

function loadHistory(gw) {
  const p = join(dataDir, 'projections-history', `gw-${String(gw).padStart(2, '0')}.json`)
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

function titleOddsAt(asOfGw, entryId) {
  const snap = snapshotByGw.get(asOfGw)
  const row = snap?.teams.find((t) => Number(t.leagueEntryId) === Number(entryId))
  return row ? Number(row.titlePct) : null
}

function lastPctAt(asOfGw, entryId) {
  const snap = snapshotByGw.get(asOfGw)
  const row = snap?.teams.find((t) => Number(t.leagueEntryId) === Number(entryId))
  return row ? Number(row.lastPct) : null
}

function teamOut(facts, gw) {
  const before = titleOddsAt(gw - 1, facts.entryId)
  const after = titleOddsAt(gw, facts.entryId)
  return {
    entryId: facts.entryId,
    name: facts.name,
    manager: managerById.get(facts.entryId) ?? null,
    points: facts.points,
    rank: facts.rank,
    prevRank: facts.prevRank,
    record: facts.record,
    streak: facts.streak,
    seasonAvg: facts.seasonAvg,
    isSeasonHigh: facts.isSeasonHigh,
    isWeekHigh: facts.isWeekHigh,
    titleOdds:
      Number.isFinite(before) && Number.isFinite(after) ? { before, after } : null,
  }
}

const lastFinishedGw = matches.reduce(
  (max, m) => (m.finished && Number(m.event) > max ? Number(m.event) : max),
  0,
)

const blurbState = emptyBlurbState()

const gameweeks = []
for (let gw = 1; gw <= lastFinishedGw; gw++) {
  const facts = recapFactsForGw(matches, entryIds, nameById, gw)
  if (!facts) continue
  const gwRecord = recordByGw.get(gw)
  const history = loadHistory(gw)
  const recordRows = new Map(
    (gwRecord?.matches ?? []).map((r) => [`${r.home}-${r.away}`, r]),
  )
  const leagueAvg =
    facts.matches.reduce((s, r) => s + r.homePts + r.awayPts, 0) /
    (facts.matches.length * 2)

  const matchups = facts.matches.map((row) => {
    const home = teamOut(facts.teams.get(row.home), gw)
    const away = teamOut(facts.teams.get(row.away), gw)
    const archRow = findArchivedH2hRow(history, row.home, row.away)
    const homeXi = archivedXi(archRow, row.home)
    const awayXi = archivedXi(archRow, row.away)
    home.players = sidePlayerFacts(homeXi)
    away.players = sidePlayerFacts(awayXi)
    home.points = reconcileTeamPoints(home.points, { players: home.players, xi: homeXi })
    away.points = reconcileTeamPoints(away.points, { players: away.players, xi: awayXi })
    home.pickup = sidePickupFacts(home, gw)
    away.pickup = sidePickupFacts(away, gw)
    const series = h2hSeriesAsOf(matches, row.home, row.away, gw)
    const h2h = series
      ? {
          games: series.games,
          homeWins: series.aWins,
          awayWins: series.bWins,
          draws: series.draws,
        }
      : null
    const rec = recordRows.get(`${row.home}-${row.away}`)
    const freezeRow = findFreezeRow(freezeByGw.get(gw), row.home, row.away)
    const frozen = freezeRow
      ? applyFreezeToRecapOdds(freezeRow, row.home, row.away, home.points, away.points)
      : null
    const odds = frozen
      ? frozen.odds
      : rec && Number.isFinite(rec.homeWinPct) && rec.favorite != null
        ? {
            favoriteSide: rec.favorite === row.home ? 'home' : 'away',
            favoritePct: rec.favorite === row.home ? rec.homeWinPct : rec.awayWinPct,
            source: rec.favoriteSource,
            outcome: rec.outcome,
          }
        : null
    const predicted = frozen?.predicted
      ? frozen.predicted
      : rec && Number.isFinite(rec.predHome) && Number.isFinite(rec.predAway)
        ? { home: rec.predHome, away: rec.predAway }
        : null
    return {
      gw,
      home,
      away,
      winner:
        home.points > away.points
          ? home.entryId
          : away.points > home.points
            ? away.entryId
            : null,
      margin: Math.abs(home.points - away.points),
      odds,
      predicted,
      h2h,
      derby: namedFixtureFor(home.manager, away.manager),
      leagueAvg,
    }
  })
  const recapBlurbs = generateGwBlurbs(matchups, {
    surface: 'recap',
    gw,
    state: blurbState,
  })
  matchups.forEach((m, i) => {
    const b = recapBlurbs[i]
    m.sentences = b.sentences
    m.blurb = {
      angleId: b.angleId,
      templateId: b.templateId,
      loreLineId: b.loreLineId,
      mottyLineId: b.mottyLineId,
    }
  })

  // Star of the week: the top player score across every archived XI.
  let starPlayer = null
  for (const m of matchups) {
    for (const side of [m.home, m.away]) {
      const top = side.players?.top
      if (top && (!starPlayer || top.pts > starPlayer.pts)) {
        starPlayer = { name: top.name, pts: top.pts, teamName: side.name }
      }
    }
  }

  // Odds vs reality summary: every decided pre-match call, plus the upset the
  // model rated least likely.
  const calls = matchups
    .filter((m) => m.odds)
    .map((m) => {
      const fav = m.odds.favoriteSide === 'home' ? m.home : m.away
      return {
        homeName: m.home.name,
        awayName: m.away.name,
        favoriteName: fav.name,
        favoritePct: Math.round(m.odds.favoritePct),
        outcome: m.odds.outcome,
      }
    })
  let upset = null
  for (const m of matchups) {
    if (!m.odds || m.odds.outcome !== 'miss' || m.winner == null) continue
    const winnerSide = m.winner === m.home.entryId ? m.home : m.away
    const winnerPct = Math.round(
      100 - (Number.isFinite(m.odds.favoritePct) ? m.odds.favoritePct : 50),
    )
    if (!upset || winnerPct < upset.winnerPct) {
      upset = {
        winnerName: winnerSide.name,
        loserName: (m.winner === m.home.entryId ? m.away : m.home).name,
        winnerPct,
      }
    }
  }

  let hits = 0
  let misses = 0
  let draws = 0
  let errSum = 0
  let errCount = 0
  for (const m of matchups) {
    if (m.odds?.outcome === 'hit') hits++
    else if (m.odds?.outcome === 'miss') misses++
    else if (m.odds?.outcome === 'draw') draws++
    if (m.predicted) {
      if (Number.isFinite(m.predicted.home) && Number.isFinite(m.home.points)) {
        errSum += Math.abs(m.predicted.home - m.home.points)
        errCount++
      }
      if (Number.isFinite(m.predicted.away) && Number.isFinite(m.away.points)) {
        errSum += Math.abs(m.predicted.away - m.away.points)
        errCount++
      }
    }
  }

  gameweeks.push({
    gw,
    model: {
      hits,
      misses,
      draws,
      avgAbsErr: errCount > 0 ? +(errSum / errCount).toFixed(1) : (gwRecord?.avgAbsErr ?? null),
      upset,
      calls,
    },
    superlatives: {
      weekHigh: facts.superlatives.weekHigh
        ? {
            name: facts.superlatives.weekHigh.name,
            points: facts.superlatives.weekHigh.points,
          }
        : null,
      closest: facts.superlatives.closest
        ? {
            homeName: nameById.get(facts.superlatives.closest.home),
            awayName: nameById.get(facts.superlatives.closest.away),
            margin: facts.superlatives.closest.margin,
          }
        : null,
      starPlayer,
    },
    matchups,
    wrap: recapWeekWrapSentences({ gw, matchups }),
  })
}

/* ---- pre-match look-forwards (finished GWs from archive + next GW live) ---- */

function readOptional(name) {
  try {
    return read(name)
  } catch {
    return null
  }
}

const bookie = readOptional('bookie-markets.json')
const playerPredictions = readOptional('predictions.json')
const modelCalibration = readOptional('model-calibration.json')
const elementStatus = readOptional('element_status.json')
const draftPicks = readOptional('draft_picks.json')
const sigmaScale = calibrationSigmaScale(modelCalibration)

const elementNameById = new Map(
  (bootstrapDraft?.elements ?? []).map((e) => [
    Number(e.id),
    e.web_name || e.second_name || String(e.id),
  ]),
)

const outrightPriceById = new Map(
  (bookie?.outright?.selections ?? []).map((s) => [
    Number(s.entryId),
    decimalOddsToFraction(s.odds),
  ]),
)
const lastPriceById = new Map(
  (bookie?.last?.selections ?? []).map((s) => [
    Number(s.entryId),
    decimalOddsToFraction(s.odds),
  ]),
)

const upcomingGw = (() => {
  const unfinished = (matches ?? [])
    .map((m) => Number(m.event))
    .filter((ev) => Number.isFinite(ev) && ev > lastFinishedGw)
  return unfinished.length ? Math.min(...unfinished) : null
})()

const leagueEntryByFpl = new Map(
  (details.league_entries ?? []).map((e) => [Number(e.entry_id), Number(e.id)]),
)
const ownedByLeagueEntry = new Map()
for (const row of elementStatus?.element_status ?? []) {
  const owner = leagueEntryByFpl.get(Number(row.owner))
  if (owner == null) continue
  if (!ownedByLeagueEntry.has(owner)) ownedByLeagueEntry.set(owner, [])
  ownedByLeagueEntry.get(owner).push(Number(row.element))
}
const predById = new Map((playerPredictions?.players ?? []).map((p) => [Number(p.id), p]))
const POS_FROM_TYPE = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }
const bootstrapElById = new Map(
  (bootstrapDraft?.elements ?? []).map((e) => [Number(e.id), e]),
)

function loadGwLineups(gw) {
  const p = join(dataDir, 'gw-lineups', `gw-${String(gw).padStart(2, '0')}.json`)
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

function priorXiFor(history, leagueId) {
  if (!history) return null
  for (const row of history.h2h ?? []) {
    if (Number(row.league_entry_1) === leagueId || Number(row.league_entry_2) === leagueId) {
      return archivedXi(row, leagueId)
    }
  }
  return null
}

/** Upcoming-GW selected XI: live snapshot file, else last week's archive copied forward. */
function lineupDocForGw(gw) {
  const file = loadGwLineups(gw)
  if (Array.isArray(file?.teams) && file.teams.length) return file
  if (!Number.isFinite(gw) || gw <= lastFinishedGw) return null
  const prevHistory = gw > 1 ? loadHistory(gw - 1) : null
  const teams = []
  for (const e of leagueEntries) {
    const leagueEntryId = Number(e.id)
    const row = lineupFromPriorXi({
      leagueEntryId,
      fplEntryId: Number(e.entry_id),
      priorXi: priorXiFor(prevHistory, leagueEntryId),
      ownedIds: ownedByLeagueEntry.get(leagueEntryId) ?? [],
    })
    if (row.starters.length === 11) teams.push(row)
  }
  return teams.length
    ? { gw, source: 'prior-xi', teams }
    : null
}

function enrichPickRow(pick) {
  const id = Number(pick.id ?? pick.element)
  const pred = predById.get(id)
  const el = bootstrapElById.get(id)
  const avail = playerAvailability(el)
  const xp = Number(pred?.forecast?.totalPoints)
  return {
    id,
    pickPosition: Number(pick.position) || null,
    name: pred?.name || el?.web_name || elementNameById.get(id) || `#${id}`,
    pos: pred?.position || POS_FROM_TYPE[Number(el?.element_type)] || '',
    xp: Number.isFinite(xp) ? +xp.toFixed(1) : null,
    flag: avail.flag,
    status: avail.status,
    chance: avail.chance,
    news: avail.news,
  }
}

function enrichLineupTeam(raw, prevHistory) {
  if (!raw || !Array.isArray(raw.starters) || raw.starters.length !== 11) return null
  const starters = raw.starters.map(enrichPickRow)
  const bench = (raw.bench ?? []).map(enrichPickRow)
  const prevXi = priorXiFor(prevHistory, Number(raw.leagueEntryId))
  const prevStartIds = (prevXi || []).map((p) => Number(p.id)).filter((n) => Number.isFinite(n))
  return {
    leagueEntryId: Number(raw.leagueEntryId),
    source: raw.source || 'xi',
    starters,
    bench,
    injuries: pickInjuryImpacts(starters, bench, { prevStartIds }),
    benchCall: pickBenchBlunder(starters, bench),
    predicted: sumStarterXp(starters),
  }
}

const strengthById = new Map(
  (predictions.current?.teams ?? []).map((t) => [
    Number(t.leagueEntryId),
    { mu: Number(t.strength) || 0, sigma: 11, se: 3 },
  ]),
)

const bookieByPair = new Map()
for (const row of bookie?.weekly?.matches ?? []) {
  bookieByPair.set(`${Number(row.homeEntryId)}-${Number(row.awayEntryId)}`, row)
}

function playerNameFor(elementId) {
  const id = Number(elementId)
  return elementNameById.get(id) || predById.get(id)?.name || `#${id}`
}

/** Accepted waivers / free-agent adds for this GW or the one before. */
function recentPickupsFor(leagueId, gw, n = 2) {
  const list = acquisitionsByLeagueId.get(Number(leagueId)) ?? []
  return list
    .filter((a) => a.gw === gw || a.gw === gw - 1)
    .sort((a, b) => b.gw - a.gw || (a.kind === 'w' ? -1 : 1))
    .slice(0, n)
    .map((a) => ({
      name: playerNameFor(a.elementIn),
      kind: a.kind,
      gw: a.gw,
    }))
}

function bookieFractionsFor(bookieRow, homeId, pcts) {
  const fromPcts = {
    home: probToFractionalOdds(pcts.home),
    draw: probToFractionalOdds(pcts.draw),
    away: probToFractionalOdds(pcts.away),
  }
  if (!bookieRow?.odds) return fromPcts
  const swapped = Number(bookieRow.homeEntryId) !== Number(homeId)
  const homeDec = swapped ? bookieRow.odds.away : bookieRow.odds.home
  const awayDec = swapped ? bookieRow.odds.home : bookieRow.odds.away
  return {
    home: decimalOddsToFraction(homeDec) || fromPcts.home,
    draw: decimalOddsToFraction(bookieRow.odds.draw) || fromPcts.draw,
    away: decimalOddsToFraction(awayDec) || fromPcts.away,
  }
}

/** Last week's XI for a side, regardless of who they played. */
function findSideXi(history, entryId) {
  if (!history) return null
  const id = Number(entryId)
  for (const row of history.h2h ?? []) {
    if (Number(row.league_entry_1) === id || Number(row.league_entry_2) === id) {
      return archivedXi(row, id)
    }
  }
  return null
}

function flattenArchivedPlayers(history) {
  const out = []
  for (const row of history?.h2h ?? []) {
    const sides = [
      [row.xi1, row.teamName1, row.league_entry_1],
      [row.xi2, row.teamName2, row.league_entry_2],
    ]
    for (const [xi, teamName, entryId] of sides) {
      if (!Array.isArray(xi)) continue
      for (const p of xi) {
        if (!p?.name) continue
        out.push({
          id: p.id ?? null,
          name: p.name,
          pts: p.pts,
          xp: p.xp,
          teamName,
          entryId,
        })
      }
    }
  }
  return out
}

const ownedFplByElement = new Map()
for (const row of elementStatus?.element_status ?? []) {
  if (row.owner == null) continue
  ownedFplByElement.set(Number(row.element), Number(row.owner))
}

function xpForElement(elementId, archivedPlayers) {
  const fromXi = archivedPlayers.find((p) => Number(p.id) === Number(elementId))
  if (fromXi && Number.isFinite(Number(fromXi.xp))) return Number(fromXi.xp)
  const xp = Number(predById.get(Number(elementId))?.forecast?.totalPoints)
  return Number.isFinite(xp) ? xp : null
}

/**
 * Header chips: last week's top scorer (preview), best-looking recent waiver,
 * and the earliest draft pick looking poor.
 */
function playerFunStats(gw, { history, prevHistory, useActual }) {
  const thisPlayers = flattenArchivedPlayers(history)
  const prevPlayers = flattenArchivedPlayers(prevHistory)
  const ptsById = new Map(
    thisPlayers.filter((p) => p.id != null).map((p) => [Number(p.id), p]),
  )

  const pickupRows = []
  for (const [leagueId, list] of acquisitionsByLeagueId) {
    const teamName = nameById.get(Number(leagueId)) ?? null
    for (const a of list) {
      if (useActual) {
        if (a.gw > gw) continue
      } else if (a.gw !== gw && a.gw !== gw - 1) {
        continue
      }
      const arch = ptsById.get(a.elementIn)
      pickupRows.push({
        id: a.elementIn,
        name: playerNameFor(a.elementIn),
        kind: a.kind,
        xp: useActual ? null : xpForElement(a.elementIn, thisPlayers),
        pts: Number.isFinite(Number(arch?.pts)) ? Number(arch.pts) : null,
        teamName,
      })
    }
  }

  const drafted = (draftPicks?.picks ?? [])
    .filter((pk) => ownedFplByElement.get(Number(pk.element)) === Number(pk.entryId))
    .map((pk) => {
      const arch = ptsById.get(Number(pk.element))
      return {
        name: pk.playerName || playerNameFor(pk.element),
        overallPick: pk.overallPick,
        round: pk.round,
        xp: xpForElement(pk.element, thisPlayers),
        pts: Number.isFinite(Number(arch?.pts)) ? Number(arch.pts) : null,
        teamName: pk.teamName,
        id: pk.element,
      }
    })

  const top = pickTopScorer(useActual ? thisPlayers : prevPlayers)
  const waiver = pickBestWaiver(pickupRows)
  const dud = pickDraftDud(drafted, { useActual: !!useActual })
  return {
    topScorer: top
      ? { name: top.name, pts: top.pts, teamName: top.teamName }
      : null,
    bestWaiver: waiver
      ? {
          name: waiver.name,
          kind: waiver.kind,
          xp: waiver.xp,
          pts: waiver.pts,
          teamName: waiver.teamName,
        }
      : null,
    dud: dud
      ? {
          name: dud.name,
          overallPick: dud.overallPick,
          xp: dud.xp,
          pts: dud.pts,
          teamName: dud.teamName,
        }
      : null,
  }
}

function previewTeam(entryId, asOfGw) {
  const id = Number(entryId)
  const through = Math.max(0, asOfGw)
  const table = bankedTable(matches, entryIds, through)
  const ranks = through > 0 ? ranksAsOf(matches, entryIds, through) : null
  const row = table.get(id)
  const predRow = (predictions.current?.teams ?? []).find(
    (t) => Number(t.leagueEntryId) === id,
  )
  const titleBefore = titleOddsAt(through, id)
  const lastBefore = lastPctAt(through, id)
  return {
    entryId: id,
    name: nameById.get(id) ?? String(id),
    manager: managerById.get(id) ?? null,
    rank: ranks ? ranks.get(id) ?? null : null,
    record: row ? { w: row.w, d: row.d, l: row.l } : { w: 0, d: 0, l: 0 },
    streak: through > 0 ? streakAsOf(matches, id, through) : null,
    titlePct: Number.isFinite(titleBefore)
      ? titleBefore
      : Number.isFinite(Number(predRow?.titlePct))
        ? Number(predRow.titlePct)
        : null,
    lastPct: Number.isFinite(lastBefore)
      ? lastBefore
      : Number.isFinite(Number(predRow?.lastPct))
        ? Number(predRow.lastPct)
        : null,
    titlePrice: outrightPriceById.get(id) ?? null,
    lastPrice: lastPriceById.get(id) ?? null,
    strength: Number.isFinite(Number(predRow?.strength)) ? Number(predRow.strength) : null,
  }
}

function previewOddsFor(match, history, bookieRow, homeLu, awayLu, freezeRow) {
  const h = Number(match.league_entry_1)
  const a = Number(match.league_entry_2)
  const arch = findArchivedH2hRow(history, h, a)
  const fav = matchFavorite(match, history, strengthById, freezeRow)
  const priced = resolvePreviewOdds({
    previewFreeze: freezeToResolveInput(freezeRow, h, a),
    archiveMc: arch?.xPtsMc,
    archiveHomeIsMatchHome: arch ? Number(arch.league_entry_1) === h : true,
    xiOdds: xiPredictionOdds(
      predById,
      starterElementIds(homeLu?.starters),
      starterElementIds(awayLu?.starters),
      sigmaScale,
    ),
    bookieProbs: bookieRow?.probs ?? null,
    strength:
      Number.isFinite(fav.homePct) && Number.isFinite(fav.awayPct)
        ? { homePct: fav.homePct, awayPct: fav.awayPct, source: fav.source }
        : null,
  })
  if (!priced) return null
  return { ...priced, arch }
}

function buildPreviewForGw(gw) {
  const gwMatches = (matches ?? []).filter((m) => Number(m.event) === gw)
  if (gwMatches.length === 0) return null
  const history = loadHistory(gw)
  const prevHistory = gw > 1 ? loadHistory(gw - 1) : null
  const asOfGw = gw - 1
  const bookieGw = Number(bookie?.weekly?.gw) === gw ? bookie.weekly : null
  const lineupDoc = history ? null : lineupDocForGw(gw)
  const lineupByLeague = new Map()
  for (const t of lineupDoc?.teams ?? []) {
    const enriched = enrichLineupTeam(t, prevHistory)
    if (enriched) lineupByLeague.set(enriched.leagueEntryId, enriched)
  }

  const matchups = gwMatches.map((match) => {
    const homeId = Number(match.league_entry_1)
    const awayId = Number(match.league_entry_2)
    const bookieRow = bookieGw
      ? (bookieByPair.get(`${homeId}-${awayId}`) ?? bookieByPair.get(`${awayId}-${homeId}`))
      : null
    const homeLu = lineupByLeague.get(homeId) ?? null
    const awayLu = lineupByLeague.get(awayId) ?? null
    const freezeRow = findFreezeRow(freezeByGw.get(gw), homeId, awayId)
    const priced = previewOddsFor(match, history, bookieRow, homeLu, awayLu, freezeRow)
    const pcts = priced
      ? oddsPercents({ home: priced.hw, draw: priced.dw, away: priced.aw })
      : { home: 50, draw: 0, away: 50 }
    const favoriteSide = pcts.home === pcts.away ? null : pcts.home > pcts.away ? 'home' : 'away'
    const odds = favoriteSide
      ? {
          home: pcts.home,
          draw: pcts.draw,
          away: pcts.away,
          favoriteSide,
          favoritePct: favoriteSide === 'home' ? pcts.home : pcts.away,
          source: priced?.source ?? 'strength',
        }
      : {
          home: pcts.home,
          draw: pcts.draw,
          away: pcts.away,
          favoriteSide: 'home',
          favoritePct: 50,
          source: priced?.source ?? 'strength',
        }

    const arch = priced?.arch ?? findArchivedH2hRow(history, homeId, awayId)
    const homeKeys = watchPlayersFromXi(archivedXi(arch, homeId), 2)
    const awayKeys = watchPlayersFromXi(archivedXi(arch, awayId), 2)
    const home = {
      ...previewTeam(homeId, asOfGw),
      keys: homeKeys.length
        ? homeKeys
        : watchPlayersFromXi(watchableXi(homeLu?.starters), 2),
      recentPickups: recentPickupsFor(homeId, gw),
      form: formFromXi(findSideXi(prevHistory, homeId)),
      injuries: homeLu?.injuries ?? [],
      benchCall: homeLu?.benchCall ?? null,
    }
    const away = {
      ...previewTeam(awayId, asOfGw),
      keys: awayKeys.length
        ? awayKeys
        : watchPlayersFromXi(watchableXi(awayLu?.starters), 2),
      recentPickups: recentPickupsFor(awayId, gw),
      form: formFromXi(findSideXi(prevHistory, awayId)),
      injuries: awayLu?.injuries ?? [],
      benchCall: awayLu?.benchCall ?? null,
    }

    let predicted = null
    if (
      priced?.frozen &&
      Number.isFinite(Number(priced.homeMu)) &&
      Number.isFinite(Number(priced.awayMu))
    ) {
      predicted = {
        home: Math.round(Number(priced.homeMu) * 10) / 10,
        away: Math.round(Number(priced.awayMu) * 10) / 10,
      }
    } else if (arch && Number.isFinite(Number(arch.xPtsXi1)) && Number.isFinite(Number(arch.xPtsXi2))) {
      const homeIsE1 = Number(arch.league_entry_1) === homeId
      predicted = {
        home: homeIsE1 ? Number(arch.xPtsXi1) : Number(arch.xPtsXi2),
        away: homeIsE1 ? Number(arch.xPtsXi2) : Number(arch.xPtsXi1),
      }
    } else if (Number.isFinite(priced?.homeMu) && Number.isFinite(priced?.awayMu)) {
      predicted = {
        home: Math.round(priced.homeMu * 10) / 10,
        away: Math.round(priced.awayMu * 10) / 10,
      }
    } else if (Number.isFinite(homeLu?.predicted) && Number.isFinite(awayLu?.predicted)) {
      predicted = { home: homeLu.predicted, away: awayLu.predicted }
    } else if (Number.isFinite(home.strength) && Number.isFinite(away.strength)) {
      predicted = { home: home.strength, away: away.strength }
    }

    const series = h2hSeriesAsOf(matches, homeId, awayId, asOfGw)
    const h2h = series
      ? {
          games: series.games,
          homeWins: series.aWins,
          awayWins: series.bWins,
          draws: series.draws,
        }
      : null

    const bookiePrices = bookieFractionsFor(bookieRow, homeId, pcts)

    return {
      gw,
      home,
      away,
      odds,
      bookie: bookiePrices,
      predicted,
      h2h,
      derby: namedFixtureFor(home.manager, away.manager),
    }
  })
  const previewBlurbs = generateGwBlurbs(matchups, {
    surface: 'preview',
    gw,
    state: blurbState,
  })
  matchups.forEach((m, i) => {
    const b = previewBlurbs[i]
    m.sentences = b.sentences
    m.blurb = {
      angleId: b.angleId,
      templateId: b.templateId,
      loreLineId: b.loreLineId,
      mottyLineId: b.mottyLineId,
    }
  })

  const favourite = [...matchups].sort(
    (a, b) => (b.odds?.favoritePct ?? 0) - (a.odds?.favoritePct ?? 0),
  )[0]
  const closest = [...matchups].sort(
    (a, b) => Math.abs(50 - (a.odds?.favoritePct ?? 50)) - Math.abs(50 - (b.odds?.favoritePct ?? 50)),
  )[0]
  let underdog = null
  for (const m of matchups) {
    for (const [side, raw] of [
      [m?.home, m?.odds?.home],
      [m?.away, m?.odds?.away],
    ]) {
      const pct = Number(raw)
      if (!side?.name || !Number.isFinite(pct)) continue
      if (!underdog || pct < underdog.pct) underdog = { name: side.name, pct }
    }
  }

  const fun = playerFunStats(gw, { history, prevHistory, useActual: false })

  const usedFreeze = Boolean(freezeByGw.get(gw)?.size)
  let source = 'live'
  if (usedFreeze) source = 'preview'
  else if (history) source = 'archive'
  else if (lineupDoc?.source === 'draft-api' || lineupDoc?.source === 'mixed') source = 'xi'
  else if (lineupDoc?.source === 'prior-xi' || lineupByLeague.size) source = 'xi'

  const preview = {
    gw,
    source,
    superlatives: {
      favourite: favourite
        ? {
            name: favourite.odds.favoriteSide === 'home' ? favourite.home.name : favourite.away.name,
            pct: favourite.odds.favoritePct,
          }
        : null,
      underdog: underdog
        ? {
            name: underdog.name,
            pct: underdog.pct,
          }
        : null,
      closest: closest
        ? {
            homeName: closest.home.name,
            awayName: closest.away.name,
            favoritePct: closest.odds.favoritePct,
          }
        : null,
      topScorer: fun.topScorer,
      bestWaiver: fun.bestWaiver,
      dud: fun.dud,
    },
    matchups,
    wrap: recapWeekWrapSentences({ gw, matchups }),
  }
  const freezeRows = freezeRowsFromPreview(preview)
  if (freezeRows.length) {
    persistFreezeGw(dataDir, gw, freezeRows)
    for (const row of freezeRows) mergeFreezeRow(freezeByGw, gw, row)
  }
  return preview
}

const previewGws = new Set()
for (const g of gameweeks) previewGws.add(g.gw)
if (Number.isFinite(upcomingGw) && gwDeadlineHasPassed(bootstrapDraft, upcomingGw)) {
  previewGws.add(upcomingGw)
}
const previews = [...previewGws]
  .sort((a, b) => a - b)
  .map((gw) => buildPreviewForGw(gw))
  .filter(Boolean)

for (const recap of gameweeks) {
  const history = loadHistory(recap.gw)
  const fun = playerFunStats(recap.gw, {
    history,
    prevHistory: recap.gw > 1 ? loadHistory(recap.gw - 1) : null,
    useActual: true,
  })
  recap.superlatives.bestWaiver = fun.bestWaiver
  recap.superlatives.dud = fun.dud
}

const output = {
  schemaVersion: 7,
  generatedAt: new Date().toISOString(),
  season: predictions.season,
  lastFinishedGw,
  upcomingGw,
  gameweeks,
  previews,
}

writeFileSync(join(dataDir, 'weekly-recaps.json'), JSON.stringify(output, null, 1))

const recapStateDir = join(dataDir, 'recap-state')
mkdirSync(recapStateDir, { recursive: true })
const slices = stateSlices(blurbState)
writeFileSync(join(recapStateDir, 'template-cooldowns.json'), JSON.stringify(slices.templateCooldowns, null, 1))
writeFileSync(join(recapStateDir, 'lore-cooldowns.json'), JSON.stringify(slices.loreCooldowns, null, 1))
writeFileSync(join(recapStateDir, 'opener-patterns.json'), JSON.stringify(slices.openerPatterns, null, 1))
writeFileSync(join(recapStateDir, 'pct-cap.json'), JSON.stringify(slices.usedPercentOfTeamByGw, null, 1))
writeFileSync(join(recapStateDir, 'events.json'), JSON.stringify(serializeBlurbState(blurbState), null, 1))

console.log(
  `weekly-recaps.json written: ${gameweeks.length} recap(s), ${previews.length} preview(s)`,
)

/**
 * Shared Preview + Recap blurb engine.
 *
 * One data-driven angle per H2H fixture, slot-filled templates, Motty vegan
 * line required, other lore rare. No LLM. Awards are out of scope.
 */

import recapConfig from './recap/recap-blurb-config.v1.json' with { type: 'json' }
import previewConfig from './recap/preview-blurb-config.v1.json' with { type: 'json' }
import mottyRecapBank from './recap/motty-vegan-oneliners-100.json' with { type: 'json' }
import mottyPreviewBank from './recap/motty-vegan-preview-oneliners-50.json' with { type: 'json' }
import {
  canonicalManager,
  isMottershead,
  isTitanicPair,
  namedFixtureFor,
} from './leagueLore.js'
import { probToFractionalOdds } from './oddsFormat.js'
import { benchWeek } from './recapSiteContext.js'
import { variantIndex } from './variantIndex.js'

const MANAGER_IDS = {
  'eddy webster': 'eddie_webster',
  'nick goodacre': 'nick_goodacre',
  'david higman': 'david_higman',
  'nick mottershead': 'nick_mottershead',
  'andy ward': 'andrew_ward',
  'luke butcher': 'luke_butcher',
  'mike sutton': 'mike_sutton',
  'jon ward': 'john_ward',
}

const PHRASE_BLACKLIST = recapConfig.bans?.phraseBlacklist || []

export function emptyBlurbState() {
  return { version: 1, events: [] }
}

export function createGwContext(gw, surface) {
  return {
    gw: Number(gw) || 0,
    surface,
    fixtureIndex: 0,
    usedTemplateIds: new Set(),
    usedAngleIds: [],
    usedMottyIds: new Set(),
    usedLoreIds: new Set(),
    usedOpeners: new Set(),
    loreUsed: false,
    titanicUsed: false,
    pctOfTeamUsed: false,
    voiceAssigned: false,
  }
}

function managerIdFor(name) {
  return MANAGER_IDS[canonicalManager(name)] || null
}

function firstName(mgr) {
  const s = String(mgr ?? '').trim()
  return s ? s.split(/\s+/)[0] : null
}

function mgrLabel(m, side) {
  const hn = firstName(m?.home?.manager)
  const an = firstName(m?.away?.manager)
  if (hn && an && hn.toLowerCase() === an.toLowerCase()) return side?.name || hn
  return firstName(side?.manager) || side?.name || ''
}

function teamName(side) {
  return side?.name || ''
}

function roundPct(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return null
  if (v > 0 && v <= 1) return Math.round(v * 100)
  return Math.round(v)
}

function enDashScore(a, b) {
  return `${a}–${b}`
}

function pickupOf(side) {
  const star = side?.pickup?.star
  if (star?.name) return star
  if (side?.pickup?.name) return side.pickup
  const list = Array.isArray(side?.recentPickups) ? side.recentPickups : []
  return list.find((p) => p?.name) || null
}

function rivalryBrand(homeMgr, awayMgr) {
  const named = namedFixtureFor(homeMgr, awayMgr)
  if (!named) return null
  const a = canonicalManager(homeMgr)
  const b = canonicalManager(awayMgr)
  const hit = (recapConfig.rivalries || []).find((r) => {
    const ids = (r.managers || []).map(canonicalManager)
    return ids.includes(a) && ids.includes(b)
  })
  return hit?.name || named
}

function mentionsRivalryBrand(text, brand) {
  if (!brand) return true
  const core = String(brand).replace(/^the\s+/i, '')
  return new RegExp(core.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text)
}

function sideWinPct(m, side) {
  if (!m?.odds || !side) return null
  if (side === m.home && Number.isFinite(Number(m.odds.home))) return roundPct(m.odds.home)
  if (side === m.away && Number.isFinite(Number(m.odds.away))) return roundPct(m.odds.away)
  const favPct = roundPct(m.odds.favoritePct)
  if (!Number.isFinite(favPct)) return null
  const fav = m.odds.favoriteSide === 'away' ? m.away : m.home
  if (side === fav) return favPct
  const draw = Number.isFinite(Number(m.odds.draw)) ? roundPct(m.odds.draw) : 0
  return Math.max(0, 100 - favPct - (draw || 0))
}

function favoritePair(m) {
  if (!m?.odds) return { fav: null, dog: null, p: null }
  const p = roundPct(m.odds.favoritePct)
  if (m.odds.favoriteSide === 'away') return { fav: m.away, dog: m.home, p }
  if (m.odds.favoriteSide === 'home') return { fav: m.home, dog: m.away, p }
  const hp = sideWinPct(m, m.home)
  const ap = sideWinPct(m, m.away)
  if (Number.isFinite(hp) && Number.isFinite(ap) && hp !== ap) {
    return hp > ap
      ? { fav: m.home, dog: m.away, p: hp }
      : { fav: m.away, dog: m.home, p: ap }
  }
  return { fav: null, dog: null, p }
}

function priceFor(m, side, fallbackPct) {
  if (m?.bookie && side === m.home && m.bookie.home) return m.bookie.home
  if (m?.bookie && side === m.away && m.bookie.away) return m.bookie.away
  return fallbackPct != null ? probToFractionalOdds(fallbackPct) : null
}

function predictedPts(m, side) {
  if (!m?.predicted) return null
  if (side === m.home) return Number(m.predicted.home)
  if (side === m.away) return Number(m.predicted.away)
  return null
}

function h2hTape(h) {
  if (!h || !Number.isFinite(Number(h.games))) return null
  const hw = Number(h.homeWins) || 0
  const aw = Number(h.awayWins) || 0
  const d = Number(h.draws) || 0
  return d ? `${hw}–${aw} (${d} drawn)` : `${hw}–${aw}`
}

function titleDelta(side) {
  const o = side?.titleOdds
  if (!o || !Number.isFinite(Number(o.before)) || !Number.isFinite(Number(o.after))) return null
  return Number(o.after) - Number(o.before)
}

function formatDelta(n) {
  if (!Number.isFinite(n)) return null
  const abs = Math.abs(n)
  const body = abs >= 10 || Number.isInteger(n) ? String(Math.round(n)) : n.toFixed(1)
  const signed = n > 0 ? `+${body}` : body
  return `${signed}%`
}

function openerPatternId(templateId) {
  const id = String(templateId || '')
  const cut = id.replace(/_\d+$/, '')
  return cut || id
}

function sentenceCount(text) {
  const t = String(text || '')
    .replace(/S\.F\.G/gi, 'SFG')
    .replace(/\b[A-Z]\./g, 'X')
    .replace(/\d+\.\d+/g, 'n')
  return t
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean).length
}

function stripEnd(s) {
  return String(s || '')
    .replace(/[.!?]+$/, '')
    .trim()
}

function asSentence(s) {
  const t = String(s || '').trim()
  if (!t) return ''
  const capped = t.charAt(0).toUpperCase() + t.slice(1)
  return /[.!?]$/.test(capped) ? capped : `${capped}.`
}

function fillTemplate(text, slots) {
  return String(text || '').replace(/\{(\w+)\}/g, (_, k) => {
    const v = slots[k]
    return v == null || v === '' ? '' : String(v)
  }).replace(/\s+/g, ' ').trim()
}

function missingRequired(tpl, slots) {
  for (const key of tpl.required || []) {
    const v = slots[key]
    if (v == null || v === '') return true
  }
  const filled = fillTemplate(tpl.text, slots)
  if (/\{\w+\}/.test(filled)) return true
  if (/\s[—–-]\s*[.,]/.test(filled)) return true
  if (/\s{2,}/.test(filled.replace(/ — /g, ' '))) return true
  return false
}

function numbersIn(value, into) {
  if (value == null) return
  const s = String(value)
  for (const n of s.match(/\d+(?:\.\d+)?/g) || []) into.add(n)
}

function inventedNumbers(text, slots) {
  const allowed = new Set()
  for (const v of Object.values(slots)) numbersIn(v, allowed)
  const found = String(text).match(/\d+(?:\.\d+)?/g) || []
  return found.some((n) => !allowed.has(n))
}

function withBothSides(text, m) {
  if (mentionsSides(text, m)) return text
  const home = teamName(m.home)
  const away = teamName(m.away)
  if (!home || !away) return text
  return asSentence(`${stripEnd(text)} — ${home} vs ${away}`)
}

function mentionsSides(text, m) {
  const blob = String(text || '')
  const hit = (side) => {
    if (!side) return false
    const name = String(side.name || '')
    const first = name.split(/\s+/)[0]
    const last = name.split(/\s+/).pop()
    return (
      (name && blob.includes(name)) ||
      (first && first.length > 2 && blob.includes(first)) ||
      (last && last.length > 3 && blob.includes(last))
    )
  }
  return hit(m.home) && hit(m.away)
}

function hasBlacklistedPhrase(text) {
  const lower = String(text || '').toLowerCase()
  return PHRASE_BLACKLIST.some((p) => lower.includes(String(p).toLowerCase()))
}

function isFingerprint(text, slots) {
  const blob = String(text || '')
  const homeTop = slots.homeTopPlayer
  const awayTop = slots.awayTopPlayer
  const bothTops =
    homeTop &&
    awayTop &&
    homeTop !== awayTop &&
    blob.includes(homeTop) &&
    blob.includes(awayTop)
  const pctShare = /%\s+of\s+(the|their)/i.test(blob) || /percent of/i.test(blob)
  const totals =
    slots.winnerPts != null &&
    slots.loserPts != null &&
    blob.includes(String(slots.winnerPts)) &&
    blob.includes(String(slots.loserPts))
  return Boolean(bothTops && pctShare && totals)
}

function angleFactPresent(angleId, text, slots) {
  const checks = {
    margin_blowout: [slots.margin, slots.scoreline, slots.winnerPts],
    margin_squeaker: [slots.margin, slots.scoreline],
    stalemate: [slots.scoreline, 'stalemate', 'draw', 'split'],
    upset: [slots.winnerWinProb, slots.loserWinProb, 'underdog', 'upset', slots.scoreline],
    model_miss: [slots.modelPick, 'model'],
    model_hit: [slots.modelPick, 'model', 'forecast', 'predicted'],
    bench_regret: [slots.benchPts, slots.benchPlayer, slots.bestXiRegret, 'bench', 'pine'],
    waiver_haul: [slots.waiverPlayer, slots.waiverPts, 'waiver', 'wire', 'claim'],
    engine: [slots.topPlayer, slots.topPlayerPts],
    tape: [slots.h2hTape, 'series', 'tape', 'round'],
    title_quake: [slots.deltaTitleWinner, 'title', 'odds', 'percentage'],
    rivalry: [slots.rivalryName],
    fallback_result: [slots.scoreline, slots.winnerTeam, slots.loserTeam],
    odds_fav: [slots.favPrice, slots.favPct, slots.favTeam],
    odds_dog: [slots.dogPrice, slots.dogPct, slots.dogTeam],
    coin_flip: [slots.homePrice, slots.favPrice, 'coin', 'tight', 'toss-up'],
    projected_margin: [slots.projMargin, slots.homePred, slots.awayPred],
    model_pick: [slots.modelPick, 'model'],
    waiver_claim: [slots.waiverPlayer, 'wire', 'waiver', 'claimed'],
    fallback_preview: [slots.homeTeam, slots.awayTeam],
  }
  const tokens = checks[angleId] || Object.values(slots)
  const blob = String(text || '').toLowerCase()
  return tokens.some((t) => {
    if (t == null || t === '') return false
    return blob.includes(String(t).toLowerCase())
  })
}

function recapSides(m) {
  const hp = Number(m?.home?.points)
  const ap = Number(m?.away?.points)
  if (Number.isFinite(hp) && Number.isFinite(ap) && hp !== ap) {
    return hp > ap
      ? { winner: m.home, loser: m.away, draw: false }
      : { winner: m.away, loser: m.home, draw: false }
  }
  return { winner: m.home, loser: m.away, draw: true }
}

function benchFacts(side, gw, site) {
  const week = benchWeek(site, side?.entryId, gw)
  const left = Number(week?.benchLeft)
  const player = week?.leftOnBench?.[0] || week?.leftOnBench?.[0]
  return {
    benchPts: Number.isFinite(left) ? left : null,
    benchPlayer: player?.name || null,
    benchPlayerPts: Number.isFinite(Number(player?.pts)) ? Number(player.pts) : null,
    bestXiRegret: Number.isFinite(Number(week?.bestXiRegret)) ? Number(week.bestXiRegret) : null,
  }
}

function recapSlots(m, site) {
  const { winner, loser, draw } = recapSides(m)
  const margin = Math.abs(Number(m?.home?.points) - Number(m?.away?.points))
  const { fav, dog, p } = favoritePair(m)
  const winnerIsFav = fav && winner && fav.entryId === winner.entryId
  const modelPick = fav ? teamName(fav) : null
  const modelCorrect = m?.odds?.outcome
    ? m.odds.outcome === 'hit'
    : Boolean(winner && fav && winnerIsFav)
  const homeShare = Number(m?.home?.players?.share)
  const awayShare = Number(m?.away?.players?.share)
  const homeTop = m?.home?.players?.top
  const awayTop = m?.away?.players?.top
  const topSide =
    (Number(homeTop?.pts) || 0) >= (Number(awayTop?.pts) || 0) ? m.home : m.away
  const topPlayer = topSide?.players?.top
  const homeBench = benchFacts(m.home, m.gw, site)
  const awayBench = benchFacts(m.away, m.gw, site)
  const benchSide =
    (homeBench.benchPts || 0) >= (awayBench.benchPts || 0) ? homeBench : awayBench
  const homeWaiver = pickupOf(m.home)
  const awayWaiver = pickupOf(m.away)
  const waiverPick = [homeWaiver, awayWaiver]
    .filter((p) => p?.name)
    .sort((a, b) => (Number(b.pts) || 0) - (Number(a.pts) || 0))[0]
  const waiverSide = waiverPick === homeWaiver ? m.home : waiverPick === awayWaiver ? m.away : null
  const dWin = titleDelta(winner)
  const dLose = titleDelta(loser)
  const h = m?.h2h
  const brand = rivalryBrand(m?.home?.manager, m?.away?.manager)
  const winnerWinProb = sideWinPct(m, winner)
  const loserWinProb = sideWinPct(m, loser)
  const homePts = Number(m?.home?.points)
  const awayPts = Number(m?.away?.points)

  return {
    winnerTeam: teamName(winner),
    loserTeam: teamName(loser),
    winnerMgr: mgrLabel(m, winner),
    loserMgr: mgrLabel(m, loser),
    winnerPts: Number.isFinite(Number(winner?.points)) ? Number(winner.points) : null,
    loserPts: Number.isFinite(Number(loser?.points)) ? Number(loser.points) : null,
    margin: Number.isFinite(margin) ? margin : null,
    topPlayer: topPlayer?.name || null,
    topPlayerPts: Number.isFinite(Number(topPlayer?.pts)) ? Number(topPlayer.pts) : null,
    dudPlayer: (winner === m.away ? m.home : m.away)?.players?.flop?.name || loser?.players?.flop?.name || null,
    dudPlayerPts: loser?.players?.flop?.pts ?? null,
    dudXp: loser?.players?.flop?.xp ?? null,
    benchPts: benchSide.benchPts,
    benchPlayer: benchSide.benchPlayer,
    benchPlayerPts: benchSide.benchPlayerPts,
    bestXiRegret: benchSide.bestXiRegret,
    waiverPlayer: waiverPick?.name || null,
    waiverPts: Number.isFinite(Number(waiverPick?.pts)) ? Number(waiverPick.pts) : null,
    modelPick,
    modelCorrect,
    winnerWinProb,
    loserWinProb,
    deltaTitleWinner: formatDelta(dWin),
    deltaTitleLoser: formatDelta(dLose),
    h2hTape: h2hTape(h),
    rivalryName: brand,
    scoreline: Number.isFinite(homePts) && Number.isFinite(awayPts)
      ? enDashScore(winner?.points, loser?.points)
      : null,
    homeTeam: teamName(m.home),
    awayTeam: teamName(m.away),
    homeTopPlayer: homeTop?.name || null,
    awayTopPlayer: awayTop?.name || null,
    homeShare,
    awayShare,
    draw,
    winner,
    loser,
    fav,
    dog,
    favoritePct: p,
    maxShare: Math.max(homeShare || 0, awayShare || 0),
    homeWaiverPts: Number(homeWaiver?.pts) || 0,
    awayWaiverPts: Number(awayWaiver?.pts) || 0,
    waiverSide,
    homeBenchPts: homeBench.benchPts || 0,
    awayBenchPts: awayBench.benchPts || 0,
    homeBestXi: homeBench.bestXiRegret || 0,
    awayBestXi: awayBench.bestXiRegret || 0,
    titleDeltaAbs: Math.max(Math.abs(dWin || 0), Math.abs(dLose || 0)),
    h2h: h,
    brand,
  }
}

function previewSlots(m) {
  const { fav, dog, p } = favoritePair(m)
  const homePct = sideWinPct(m, m.home)
  const awayPct = sideWinPct(m, m.away)
  const favPct = fav ? sideWinPct(m, fav) ?? p : p
  const dogPct = dog ? sideWinPct(m, dog) : Number.isFinite(favPct) ? Math.max(0, 100 - favPct) : null
  const homePred = predictedPts(m, m.home)
  const awayPred = predictedPts(m, m.away)
  const predMargin =
    Number.isFinite(homePred) && Number.isFinite(awayPred)
      ? Math.abs(homePred - awayPred)
      : null
  const predFav =
    Number.isFinite(homePred) && Number.isFinite(awayPred)
      ? homePred >= awayPred
        ? m.home
        : m.away
      : fav
  const homeWaiver = pickupOf(m.home)
  const awayWaiver = pickupOf(m.away)
  const waiverPick = homeWaiver || awayWaiver
  const waiverSide = homeWaiver ? m.home : awayWaiver ? m.away : null
  const h = m?.h2h
  const brand = rivalryBrand(m?.home?.manager, m?.away?.manager)
  const seriesLeader =
    h && Number(h.homeWins) !== Number(h.awayWins)
      ? Number(h.homeWins) > Number(h.awayWins)
        ? m.home
        : m.away
      : null
  const lastMeeting =
    h?.games === 1
      ? Number(h.homeWins) > Number(h.awayWins)
        ? `${mgrLabel(m, m.home)} took the first meeting`
        : Number(h.awayWins) > Number(h.homeWins)
          ? `${mgrLabel(m, m.away)} took the first meeting`
          : 'they drew last time'
      : null
  const modelPick = fav ? teamName(fav) : predFav ? teamName(predFav) : null
  const keys = [...(m.home?.keys || []), ...(m.away?.keys || [])]
  const topXp = keys.reduce((best, k) => Math.max(best, Number(k?.xp) || 0), 0)

  return {
    homeTeam: teamName(m.home),
    awayTeam: teamName(m.away),
    homeMgr: mgrLabel(m, m.home),
    awayMgr: mgrLabel(m, m.away),
    favTeam: teamName(fav),
    dogTeam: teamName(dog),
    favMgr: fav ? mgrLabel(m, fav) : null,
    dogMgr: dog ? mgrLabel(m, dog) : null,
    favPrice: fav ? priceFor(m, fav, favPct) : null,
    dogPrice: dog ? priceFor(m, dog, dogPct) : null,
    homePrice: priceFor(m, m.home, homePct),
    awayPrice: priceFor(m, m.away, awayPct),
    favPct,
    dogPct,
    homePct,
    awayPct,
    homePred: Number.isFinite(homePred) ? homePred : null,
    awayPred: Number.isFinite(awayPred) ? awayPred : null,
    projMargin: Number.isFinite(predMargin) ? Math.round(predMargin * 10) / 10 : null,
    modelPick,
    waiverPlayer: waiverPick?.name || null,
    waiverMgr: waiverSide ? mgrLabel(m, waiverSide) : null,
    waiverTeam: teamName(waiverSide),
    oppTeam: waiverSide ? teamName(waiverSide === m.home ? m.away : m.home) : null,
    h2hTape: h2hTape(h),
    seriesLeader: teamName(seriesLeader),
    seriesTrail: seriesLeader
      ? teamName(seriesLeader === m.home ? m.away : m.home)
      : null,
    lastMeeting,
    rivalryName: brand,
    scorelessNote: true,
    favoritePct: p,
    predFav,
    fav,
    dog,
    brand,
    h2h: h,
    hasRecentClaim: Boolean(homeWaiver || awayWaiver),
    topXp,
    homeWaiver: Boolean(homeWaiver),
    awayWaiver: Boolean(awayWaiver),
    homePredVal: homePred,
    awayPredVal: awayPred,
  }
}

function recapEligible(slots, m) {
  const hp = Number(m?.home?.points)
  const ap = Number(m?.away?.points)
  const margin = Math.abs(hp - ap)
  const draw = hp === ap
  const winnerProb = slots.winnerWinProb
  const engineShare = slots.maxShare
  const benchMax = Math.max(slots.homeBenchPts || 0, slots.awayBenchPts || 0)
  const regretMax = Math.max(slots.homeBestXi || 0, slots.awayBestXi || 0)
  const waiverMax = Math.max(slots.homeWaiverPts || 0, slots.awayWaiverPts || 0)
  const h = slots.h2h
  const revenge =
    h &&
    !draw &&
    h.games >= 2 &&
    ((slots.winner === m.home && Number(h.awayWins) >= Number(h.homeWins)) ||
      (slots.winner === m.away && Number(h.homeWins) >= Number(h.awayWins)))
  return {
    margin_blowout: Number.isFinite(margin) && !draw && margin >= 15,
    margin_squeaker: Number.isFinite(margin) && !draw && margin <= 3,
    stalemate: draw && Number.isFinite(hp),
    upset:
      !draw &&
      Number.isFinite(winnerProb) &&
      winnerProb <= 40,
    model_miss: !draw && slots.modelPick && slots.modelCorrect === false,
    model_hit: !draw && slots.modelPick && slots.modelCorrect === true,
    bench_regret: benchMax >= 8 || regretMax >= 8,
    waiver_haul: waiverMax >= 8 || (slots.waiverPlayer && Number(slots.waiverPts) >= 8),
    engine: engineShare >= 0.28,
    tape: Boolean(h && h.games >= 1 && (revenge || h.games === 1 || Number(h.homeWins) === 0 || Number(h.awayWins) === 0)),
    title_quake: (slots.titleDeltaAbs || 0) >= 3,
    rivalry: Boolean(slots.brand),
    fallback_result: true,
  }
}

function previewEligible(slots) {
  const p = Number(slots.favoritePct)
  const proj = slots.projMargin
  return {
    odds_fav: Number.isFinite(p) && p >= 55,
    odds_dog: Number.isFinite(p) && p >= 58,
    coin_flip: Number.isFinite(p) && p > 0 && p < 55,
    projected_margin:
      Number.isFinite(proj) && (proj >= 12 || proj <= 4),
    model_pick: Boolean(slots.modelPick),
    waiver_claim: Boolean(slots.hasRecentClaim),
    tape: Boolean(slots.h2h && Number(slots.h2h.games) >= 1),
    rivalry: Boolean(slots.brand),
    fallback_preview: true,
  }
}

function interestingnessOf(angle, slots, surface) {
  const raw = angle.interestingness
  if (typeof raw === 'number') return raw
  const margin = Number(slots.margin)
  const p = Number(slots.favoritePct)
  const map = {
    'abs(margin)': Math.abs(margin) || 0,
    '4 - abs(margin)': 4 - Math.abs(margin || 0),
    'loser.preMatchWinProb - winner.preMatchWinProb':
      (Number(slots.loserWinProb) || 0) - (Number(slots.winnerWinProb) || 0),
    modelConfidence: Math.abs((p || 50) - 50),
    margin: Math.abs(margin) || 0,
    'max(benchPts, bestXiRegret)': Math.max(slots.benchPts || 0, slots.bestXiRegret || 0),
    'max(waiverPtsThisGw)': Number(slots.waiverPts) || 0,
    playerShare: slots.maxShare || 0,
    'abs(deltaTitlePct)': slots.titleDeltaAbs || 0,
    favoritePct: p || 0,
    '55 - abs(favoritePct - 50)': 55 - Math.abs((p || 50) - 50),
    'abs(predictedMargin - 8)': Math.abs((Number(slots.projMargin) || 8) - 8),
  }
  if (surface === 'preview' && raw === 'favoritePct') return p || 0
  return map[raw] ?? angle.priority ?? 0
}

function angleUsedRecently(state, gw, managerKeys, angleId, cooldownGws) {
  if (!angleId || !state?.events) return false
  return state.events.some(
    (e) =>
      e.angleId === angleId &&
      gw - Number(e.gw) > 0 &&
      gw - Number(e.gw) < cooldownGws &&
      (e.managers || []).some((mgr) => managerKeys.includes(mgr)),
  )
}

function templateUsed(state, gwContext, gw, templateId, managerKeys) {
  if (gwContext.usedTemplateIds.has(templateId)) return true
  return (state.events || []).some((e) => {
    if (e.templateId !== templateId) return false
    if (Number(e.gw) === gw) return true
    if (gw - Number(e.gw) > 0 && gw - Number(e.gw) <= 3) {
      return (e.managers || []).some((mgr) => managerKeys.includes(mgr))
    }
    return false
  })
}

function pickAngles(surface, slots, m, state, gwContext) {
  const cfg = surface === 'preview' ? previewConfig : recapConfig
  const eligibleMap = surface === 'preview' ? previewEligible(slots) : recapEligible(slots, m)
  const managers = [canonicalManager(m?.home?.manager), canonicalManager(m?.away?.manager)].filter(
    Boolean,
  )
  const cooldown = cfg.angleSelection?.cooldown?.sameAngleSameManagerGws || 2
  const caps = { ...(cfg.angleSelection?.leagueCaps || {}) }
  const usedCounts = {}
  for (const id of gwContext.usedAngleIds) usedCounts[id] = (usedCounts[id] || 0) + 1

  const ranked = (cfg.angles || [])
    .filter((a) => a.id !== 'rivalry' && eligibleMap[a.id])
    .map((a) => ({
      ...a,
      score: interestingnessOf(a, slots, surface),
      cooled: angleUsedRecently(state, gwContext.gw, managers, a.id, cooldown),
    }))
    .sort((a, b) => {
      if (a.cooled !== b.cooled) return a.cooled ? 1 : -1
      if (b.priority !== a.priority) return b.priority - a.priority
      return b.score - a.score
    })

  const out = []
  for (const a of ranked) {
    const cap = caps[a.id]
    if (Number.isFinite(cap) && (usedCounts[a.id] || 0) >= cap) continue
    out.push(a)
  }
  if (!out.length) {
    const fb = (cfg.angles || []).find((a) => a.id.startsWith('fallback'))
    if (fb) out.push({ ...fb, score: 0 })
  }
  return out
}

function packsFor(surface) {
  return surface === 'preview' ? previewConfig.templatePacks : recapConfig.templatePacks
}

function templatesForAngle(surface, angleId) {
  return packsFor(surface)[angleId] || []
}

function rejectReasons(text, { angleId, slots, m, brand }) {
  if (sentenceCount(text) > 2) return 'max_sentences'
  if (hasBlacklistedPhrase(text)) return 'blacklist'
  if (isFingerprint(text, slots)) return 'fingerprint'
  if (inventedNumbers(text, slots)) return 'invented'
  if (!angleFactPresent(angleId, text, slots)) return 'missing_fact'
  if (brand && !mentionsRivalryBrand(text, brand)) return 'rivalry'
  if (!mentionsSides(text, m)) return 'sides'
  return null
}

function applyRivalryOverlay(text, brand) {
  if (!brand || mentionsRivalryBrand(text, brand)) return text
  return `${brand}: ${text.charAt(0).toLowerCase()}${text.slice(1)}`
}

function pickTemplate(surface, angleId, slots, m, state, gwContext, key) {
  const managers = [canonicalManager(m?.home?.manager), canonicalManager(m?.away?.manager)].filter(
    Boolean,
  )
  const brand = slots.brand || slots.rivalryName
  const tryPack = (packId) => {
    const tpls = templatesForAngle(surface, packId)
    const usable = tpls.filter((tpl) => {
      if (missingRequired(tpl, slots)) return false
      if (templateUsed(state, gwContext, gwContext.gw, tpl.id, managers)) return false
      const opener = openerPatternId(tpl.id)
      if (gwContext.usedOpeners.has(`${canonicalManager(m?.home?.manager)}:${opener}`)) return false
      if (gwContext.usedOpeners.has(`${canonicalManager(m?.away?.manager)}:${opener}`)) return false
      return true
    })
    const pool = usable.length ? usable : packId.startsWith('fallback') ? tpls.filter((tpl) => !missingRequired(tpl, slots)) : []
    if (!pool.length) return null
    const start = variantIndex(`${key}-${packId}`, pool.length)
    for (let i = 0; i < pool.length; i++) {
      const tpl = pool[(start + i) % pool.length]
      let text = withBothSides(asSentence(fillTemplate(tpl.text, slots)), m)
      if (brand) text = asSentence(applyRivalryOverlay(stripEnd(text), brand))
      text = withBothSides(text, m)
      const reason = rejectReasons(text, {
        angleId: packId === 'rivalry' ? angleId : packId,
        slots,
        m,
        brand,
      })
      if (!reason) return { tpl, text, packId }
    }
    return null
  }

  if (brand) {
    const rivalryHit = tryPack('rivalry')
    if (rivalryHit && angleFactPresent(angleId, rivalryHit.text, slots)) return rivalryHit
  }
  const direct = tryPack(angleId)
  if (direct) return direct
  return tryPack(surface === 'preview' ? 'fallback_preview' : 'fallback_result')
}

function mottyEventTags(m, surface, slots) {
  const tags = new Set(['any', 'swagger'])
  const mott = isMottershead(m?.home?.manager) ? m.home : m.away
  const opp = mott === m.home ? m.away : m.home
  if (surface === 'preview') {
    const p = sideWinPct(m, mott) ?? slots.favoritePct
    if (Number.isFinite(p)) {
      if (p >= 55) tags.add('fav')
      else if (p <= 40) tags.add('dog')
      else tags.add('coin')
      tags.add('odds')
    }
    if (pickupOf(mott)) tags.add('waiver_in')
    else tags.add('no_waiver')
    const mp = predictedPts(m, mott)
    const op = predictedPts(m, opp)
    const leagueMed =
      Number.isFinite(mp) && Number.isFinite(op) ? (mp + op) / 2 : null
    if (Number.isFinite(mp) && Number.isFinite(leagueMed)) {
      if (mp >= leagueMed + 8) tags.add('projected_high')
      if (mp <= leagueMed - 8) tags.add('projected_low')
    }
    if (slots.fav === mott) tags.add('model_likes')
    if (slots.dog === mott) tags.add('model_hates')
    if (Number.isFinite(slots.projMargin) && slots.projMargin >= 12) tags.add('blowout_proj')
    if (Number.isFinite(slots.projMargin) && slots.projMargin <= 4) tags.add('squeaker_proj')
    const moves = (mott.recentPickups || []).length
    if (moves >= 2) tags.add('trade_heavy')
    if (canonicalManager(opp?.manager) === 'andy ward') {
      tags.add('vs_andrew')
      tags.add('titanic_context')
    }
    if (isTitanicPair(m.home?.manager, m.away?.manager)) tags.add('titanic_context')
    if ((slots.topXp || 0) >= 6) tags.add('high_xp_star')
    if (mott.streak?.type === 'W') tags.add('win_form')
    if (mott.streak?.type === 'L') tags.add('loss_form')
    if (slots.brand) tags.add('rivalry_lite')
    return tags
  }

  const mp = Number(mott?.points)
  const op = Number(opp?.points)
  const margin = Math.abs(mp - op)
  if (mp > op) tags.add('win')
  else if (mp < op) tags.add('loss')
  else tags.add('draw')
  if (margin >= 15) tags.add('blowout')
  if (margin > 0 && margin <= 3) tags.add('squeaker')
  if ((slots.homeBenchPts >= 8 && mott === m.home) || (slots.awayBenchPts >= 8 && mott === m.away)) {
    tags.add('bench')
    tags.add('best_xi')
  }
  if (pickupOf(mott) && (Number(pickupOf(mott).pts) >= 6 || pickupOf(mott).wasHaul)) tags.add('waiver')
  if ((mott.recentPickups || []).length >= 2) tags.add('trade')
  if (slots.modelCorrect === true && tags.has('win')) tags.add('model_hit')
  if (slots.modelCorrect === false) tags.add('model_miss')
  if (tags.has('win') && (sideWinPct(m, mott) || 100) <= 40) {
    tags.add('upset')
    tags.add('underdog')
  }
  if (tags.has('loss') && (sideWinPct(m, mott) || 0) >= 60) tags.add('upset_victim')
  if (mott?.players?.share >= 0.28) tags.add('engine')
  if (opp?.players?.share >= 0.28 && tags.has('loss')) tags.add('engine_against')
  if ((slots.titleDeltaAbs || 0) >= 3) tags.add('title_quake')
  if (slots.h2h && slots.h2h.games >= 1) tags.add('tape')
  if (mott?.isWeekHigh) tags.add('high_score')
  if (!mott?.isWeekHigh && tags.has('loss') && (slots.loser === mott)) tags.add('low_score')
  if (tags.has('loss') && margin <= 3) tags.add('heartbreak')
  if (tags.has('win') && margin <= 3) tags.add('heartbreak_dealt')
  if (canonicalManager(opp?.manager) === 'andy ward') {
    tags.add('vs_andrew')
    tags.add('titanic')
  }
  if (isTitanicPair(m.home?.manager, m.away?.manager)) tags.add('titanic')
  if (mott?.players?.flop && Number(mott.players.flop.pts) <= 2 && Number(mott.players.flop.xp) >= 4) {
    tags.add('dud')
  }
  if (pickupOf(mott) || (mott.recentPickups || []).length) tags.add('active')
  if (tags.has('win') && Number(mott.rank) >= 5) tags.add('comeback')
  if (tags.has('loss') && mott.prevRank != null && Number(mott.rank) - Number(mott.prevRank) >= 2) {
    tags.add('slide')
  }
  return tags
}

function lineConflictsOutcome(lineTags, eventTags, surface) {
  const rules =
    surface === 'preview'
      ? { fav: ['dog'], dog: ['fav'], coin: [] }
      : mottyRecapBank.policy?.conflictRules || {}
  for (const [tag, conflicts] of Object.entries(rules)) {
    if (!eventTags.has(tag)) continue
    for (const c of conflicts || []) {
      if (lineTags.includes(c)) return true
    }
  }
  return false
}

function scoreMottyLine(line, eventTags) {
  let score = 0
  let matched = false
  for (const t of line.tags || []) {
    if (t === 'any') score += 1
    else if (eventTags.has(t)) {
      score += 3
      matched = true
    }
  }
  return { score, matched }
}

export function isMottyVeganLine(text, surface = 'recap') {
  const bank = surface === 'preview' ? mottyPreviewBank.lines : mottyRecapBank.lines
  const needle = stripEnd(text)
  return bank.some((l) => stripEnd(l.text) === needle)
}

function usedMottyThisSeason(state, surface) {
  const ids = new Set()
  for (const e of state.events || []) {
    if (e.surface === surface && e.mottyLineId) ids.add(e.mottyLineId)
  }
  return ids
}

function pickMottyLine(m, surface, slots, state, gwContext, key) {
  const bank = surface === 'preview' ? mottyPreviewBank : mottyRecapBank
  const tags = mottyEventTags(m, surface, slots)
  const seasonUsed = usedMottyThisSeason(state, surface)
  for (const id of gwContext.usedMottyIds) seasonUsed.add(id)
  const defaultCd = surface === 'preview' ? 6 : 8
  const cooled = new Set()
  for (const e of state.events || []) {
    if (e.surface !== surface || !e.mottyLineId) continue
    const line = (bank.lines || []).find((l) => l.id === e.mottyLineId)
    const cd = line?.cooldownGws || defaultCd
    if (gwContext.gw - Number(e.gw) >= 0 && gwContext.gw - Number(e.gw) < cd) {
      cooled.add(e.mottyLineId)
    }
  }

  const scored = []
  for (const line of bank.lines || []) {
    const tagsOf = line.tags || []
    if (lineConflictsOutcome(tagsOf, tags, surface)) continue
    if (sentenceCount(line.text) > 1) continue
    const { score, matched } = scoreMottyLine(line, tags)
    if (score <= 0) continue
    scored.push({ line, score, matched, cooled: cooled.has(line.id), season: seasonUsed.has(line.id) })
  }
  scored.sort((a, b) => {
    if (a.season !== b.season) return a.season ? 1 : -1
    if (a.cooled !== b.cooled) return a.cooled ? 1 : -1
    if (b.score !== a.score) return b.score - a.score
    return 0
  })
  const topScore = scored[0]?.score
  const top = scored.filter((x) => x.score === topScore && x.season === scored[0].season && x.cooled === scored[0].cooled)
  const pick = top.length
    ? top[variantIndex(`${key}-motty`, top.length)]
    : scored[0]
  if (!pick) {
    const any = (bank.lines || []).find((l) => (l.tags || []).includes('any') && !gwContext.usedMottyIds.has(l.id))
      || bank.lines?.[0]
    return any ? { id: any.id, text: asSentence(any.text), titanic: /titanic/i.test(any.text) } : null
  }
  const text = asSentence(pick.line.text)
  return {
    id: pick.line.id,
    text,
    titanic: tags.has('titanic') || tags.has('titanic_context') || /titanic/i.test(text),
  }
}

function loreBankFor(manager) {
  const id = managerIdFor(manager)
  return (recapConfig.loreBank?.managers || []).find((row) => row.id === id) || null
}

function loreUsedRecently(state, gw, hook) {
  const cd = hook.cooldownGws || recapConfig.loreBank?.usage?.defaultHookCooldownGws || 4
  const iconicCd = hook.iconic ? hook.cooldownGws || 6 : cd
  let seasonCount = 0
  for (const e of state.events || []) {
    if (e.loreLineId !== hook.id) continue
    seasonCount += 1
    if (gw - Number(e.gw) >= 0 && gw - Number(e.gw) < iconicCd) return true
  }
  if (hook.iconic && hook.maxPerSeason && seasonCount >= hook.maxPerSeason) return true
  if (hook.maxPerSeason && seasonCount >= hook.maxPerSeason) return true
  return false
}

function pickLore(m, angleId, state, gwContext, key) {
  if (isMottershead(m?.home?.manager) || isMottershead(m?.away?.manager)) return null
  if (gwContext.loreUsed || gwContext.voiceAssigned) return null
  const sides = [m.home, m.away].filter((s) => s?.manager && loreBankFor(s.manager))
  if (!sides.length) return null
  const prefer = sides.filter((s) => (loreBankFor(s.manager)?.preferWhenAngles || []).includes(angleId))
  const pool = prefer.length ? prefer : sides
  const side = pool[variantIndex(`${key}-lore-side`, pool.length)]
  const bank = loreBankFor(side.manager)
  const hooks = (bank.hooks || []).filter((h) => {
    if (gwContext.usedLoreIds.has(h.id)) return false
    if (loreUsedRecently(state, gwContext.gw, h)) return false
    if (h.id && /titanic/i.test(h.text) && (gwContext.titanicUsed || titanicOnCooldown(state, gwContext.gw))) {
      return false
    }
    return true
  })
  if (!hooks.length) return null
  const nonIconic = hooks.filter((h) => !h.iconic)
  const use = (nonIconic.length ? nonIconic : hooks)
  const hook = use[variantIndex(`${key}-lore-hook`, use.length)]
  return { id: hook.id, text: asSentence(hook.text), titanic: /titanic/i.test(hook.text) }
}

function titanicOnCooldown(state, gw) {
  const cd = recapConfig.partnerships?.[0]?.cooldownGws || 3
  return (state.events || []).some(
    (e) => e.titanic && gw - Number(e.gw) >= 0 && gw - Number(e.gw) < cd,
  )
}

function shouldAttachLore(gwContext, m) {
  if (isMottershead(m?.home?.manager) || isMottershead(m?.away?.manager)) return false
  if (gwContext.loreUsed || gwContext.voiceAssigned) return false
  if (!gwContext.lorePlan) {
    gwContext.lorePlan = {
      on: variantIndex(`gw${gwContext.gw}-${gwContext.surface}-lore-on`, 3) === 0,
      index: variantIndex(`gw${gwContext.gw}-${gwContext.surface}-lore-idx`, 4),
    }
  }
  return gwContext.lorePlan.on && gwContext.fixtureIndex === gwContext.lorePlan.index
}

function fallbackLine(surface, slots, m) {
  if (surface === 'preview') {
    return asSentence(`${slots.homeTeam || teamName(m.home)} host ${slots.awayTeam || teamName(m.away)}`)
  }
  if (slots.draw) {
    return asSentence(`Stalemate. ${slots.scoreline || ''}`.trim())
  }
  return asSentence(
    `${slots.winnerTeam || teamName(slots.winner)} beat ${slots.loserTeam || teamName(slots.loser)} ${slots.scoreline || ''}`.trim(),
  )
}

function recordEvent(state, gwContext, event) {
  state.events = state.events || []
  state.events.push(event)
  if (event.templateId) gwContext.usedTemplateIds.add(event.templateId)
  if (event.angleId) gwContext.usedAngleIds.push(event.angleId)
  if (event.mottyLineId) gwContext.usedMottyIds.add(event.mottyLineId)
  if (event.loreLineId) {
    gwContext.usedLoreIds.add(event.loreLineId)
    gwContext.loreUsed = true
    gwContext.voiceAssigned = true
  }
  if (event.openerPatternId) {
    for (const mgr of event.managers || []) {
      gwContext.usedOpeners.add(`${mgr}:${event.openerPatternId}`)
    }
  }
  if (event.titanic) gwContext.titanicUsed = true
  gwContext.fixtureIndex += 1
}

export function generateMatchupBlurb(m, opts = {}) {
  const surface = opts.surface === 'preview' ? 'preview' : 'recap'
  const state = opts.state || emptyBlurbState()
  const gw = Number(m?.gw ?? opts.gw) || 0
  const gwContext = opts.gwContext || createGwContext(gw, surface)
  if (!gwContext.gw) gwContext.gw = gw
  const site = opts.site || null
  const slots = surface === 'preview' ? previewSlots(m) : recapSlots(m, site)
  const key = `${m?.home?.entryId || 'h'}-${m?.away?.entryId || 'a'}-gw${gw}-${surface}`
  const mottOn = isMottershead(m?.home?.manager) || isMottershead(m?.away?.manager)
  const angles = pickAngles(surface, slots, m, state, gwContext)

  let chosen = null
  for (const angle of angles) {
    const hit = pickTemplate(surface, angle.id, slots, m, state, gwContext, `${key}-${angle.id}`)
    if (hit) {
      chosen = { angle, ...hit }
      break
    }
  }
  let sentence1 = chosen?.text || fallbackLine(surface, slots, m)
  if (slots.brand && !mentionsRivalryBrand(sentence1, slots.brand)) {
    sentence1 = asSentence(applyRivalryOverlay(stripEnd(sentence1), slots.brand))
  }
  const angleId = chosen?.angle?.id || (surface === 'preview' ? 'fallback_preview' : 'fallback_result')
  const templateId = chosen?.tpl?.id || (surface === 'preview' ? 'pv_fb_01' : 'fb_01')

  const sentences = [sentence1]
  let motty = null
  let lore = null
  if (mottOn) {
    motty = pickMottyLine(m, surface, slots, state, gwContext, key)
    if (motty?.text) sentences.push(motty.text)
  } else if (shouldAttachLore(gwContext, m)) {
    lore = pickLore(m, angleId, state, gwContext, key)
    if (lore?.text) sentences.push(lore.text)
  }

  const blurb = sentences.join(' ')
  if (sentenceCount(blurb) > 2) sentences.length = 2

  const kinds = [angleId]
  const stems = [templateId]
  if (motty) {
    kinds.push('vegan')
    stems.push('vegan')
  }
  if (lore) {
    kinds.push('joke')
    stems.push(lore.id)
  }

  recordEvent(state, gwContext, {
    gw,
    surface,
    fixtureId: key,
    managers: [canonicalManager(m?.home?.manager), canonicalManager(m?.away?.manager)].filter(Boolean),
    angleId,
    templateId,
    loreLineId: lore?.id || null,
    mottyLineId: motty?.id || null,
    openerPatternId: openerPatternId(templateId),
    titanic: Boolean(motty?.titanic || lore?.titanic),
    pctOfTeam: /%\s+of\s+(the|their)/i.test(blurb),
  })

  const outSentences = sentences.filter(Boolean)
  return {
    sentences: outSentences,
    blurb: outSentences.join(' '),
    angleId,
    templateId,
    loreLineId: lore?.id || null,
    mottyLineId: motty?.id || null,
    rivalryName: slots.brand || null,
    interestingness: chosen?.angle ? interestingnessOf(chosen.angle, slots, surface) : 0,
    kinds,
    stems,
    gwContext,
    state,
  }
}

export function generateGwBlurbs(matchups, opts = {}) {
  const surface = opts.surface === 'preview' ? 'preview' : 'recap'
  const state = opts.state || emptyBlurbState()
  const gw = Number(opts.gw ?? matchups?.[0]?.gw) || 0
  const gwContext = opts.gwContext || createGwContext(gw, surface)
  const results = []
  for (const m of matchups || []) {
    results.push(
      generateMatchupBlurb(
        { ...m, gw: m.gw ?? gw },
        { surface, state, gwContext, site: opts.site },
      ),
    )
  }
  return results
}

export function decoratePersonality(result) {
  const lines = result.sentences.slice()
  lines.kinds = result.kinds
  lines.stems = result.stems
  return lines
}

export function hydrateUsedBag(used, preview, gw) {
  if (used && !Array.isArray(used) && used._gwContext) return used
  const bag = Array.isArray(used) || !used
    ? { lines: [...(used || [])], kinds: [], stems: [] }
    : used
  bag.lines = bag.lines || []
  bag.kinds = bag.kinds || []
  bag.stems = bag.stems || []
  if (!bag._gwContext) {
    bag._gwContext = createGwContext(gw, preview ? 'preview' : 'recap')
  }
  if (!bag._state) bag._state = emptyBlurbState()
  return bag
}

export function rememberBlurb(bag, result) {
  bag.lines.push(...result.sentences)
  bag.kinds.push(...result.kinds)
  bag.stems.push(...result.stems)
  bag._gwContext = result.gwContext
  bag._state = result.state
  return bag
}

export function serializeBlurbState(state) {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    events: state.events || [],
  }
}

export function stateSlices(state) {
  const templateCooldowns = []
  const loreCooldowns = []
  const openerPatterns = []
  const usedPercentOfTeamByGw = {}
  for (const e of state.events || []) {
    templateCooldowns.push({
      gw: e.gw,
      surface: e.surface,
      templateId: e.templateId,
      managers: e.managers,
    })
    if (e.loreLineId) {
      loreCooldowns.push({
        gw: e.gw,
        surface: e.surface,
        loreLineId: e.loreLineId,
        mottyLineId: e.mottyLineId,
      })
    } else if (e.mottyLineId) {
      loreCooldowns.push({
        gw: e.gw,
        surface: e.surface,
        mottyLineId: e.mottyLineId,
      })
    }
    openerPatterns.push({
      gw: e.gw,
      managers: e.managers,
      openerPatternId: e.openerPatternId,
    })
    if (e.pctOfTeam) {
      usedPercentOfTeamByGw[e.gw] = (usedPercentOfTeamByGw[e.gw] || 0) + 1
    }
  }
  return { templateCooldowns, loreCooldowns, openerPatterns, usedPercentOfTeamByGw }
}

export { recapConfig, previewConfig, mottyRecapBank, mottyPreviewBank }

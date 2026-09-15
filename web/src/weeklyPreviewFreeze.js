/**
 * Locked Preview odds — the call the recap is scored against.
 *
 * The weekly Preview is built from the locked XI + predictions.json (same
 * path as Live Odds). After the GW finishes, projections-history is first
 * written from the current bootstrap and will crush xP / flip favourites.
 * Recap must keep the Preview board, not that reconstruction.
 *
 * Freeze files (`preview-odds/gw-NN.json`) are written once and never
 * overwritten. Vercel checkouts often lack those files, so builds also
 * ingest the live site's published weekly-recaps.json: lock-quality upcoming
 * previews (`xi` / `live`) and recap matchups already tagged `source:
 * 'preview'`. First write wins.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const PREVIEW_ODDS_DIR = 'preview-odds'

export const DEFAULT_PUBLIC_RECAP_URL =
  'https://tclot.vercel.app/league-data/weekly-recaps.json'

/** Sources that are the published Preview call, not a post-GW reconstruction. */
export function isLockQualitySource(source) {
  return source === 'xi' || source === 'live' || source === 'preview'
}

export function unorderedPairKey(homeId, awayId) {
  const a = Number(homeId)
  const b = Number(awayId)
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

export function freezeRowFromPreviewMatchup(m) {
  const home = Number(m?.home?.entryId)
  const away = Number(m?.away?.entryId)
  const odds = m?.odds
  const hw = Number(odds?.home)
  const aw = Number(odds?.away)
  if (!Number.isFinite(home) || !Number.isFinite(away) || !Number.isFinite(hw) || !Number.isFinite(aw)) {
    return null
  }
  const predHome = Number(m?.predicted?.home)
  const predAway = Number(m?.predicted?.away)
  return {
    home,
    away,
    homeWinPct: hw,
    drawPct: Number.isFinite(Number(odds?.draw)) ? Number(odds.draw) : 0,
    awayWinPct: aw,
    predHome: Number.isFinite(predHome) ? predHome : null,
    predAway: Number.isFinite(predAway) ? predAway : null,
  }
}

export function freezeRowFromRecapMatchup(m) {
  const home = Number(m?.home?.entryId)
  const away = Number(m?.away?.entryId)
  const odds = m?.odds
  if (!Number.isFinite(home) || !Number.isFinite(away) || !odds) return null
  if (odds.source && odds.source !== 'preview') return null
  let homeWinPct
  let awayWinPct
  let drawPct = 0
  if (Number.isFinite(Number(odds.home)) && Number.isFinite(Number(odds.away))) {
    homeWinPct = Number(odds.home)
    awayWinPct = Number(odds.away)
    drawPct = Number.isFinite(Number(odds.draw)) ? Number(odds.draw) : 0
  } else if (odds.favoriteSide && Number.isFinite(Number(odds.favoritePct))) {
    const fav = Number(odds.favoritePct)
    homeWinPct = odds.favoriteSide === 'home' ? fav : 100 - fav
    awayWinPct = odds.favoriteSide === 'away' ? fav : 100 - fav
  } else {
    return null
  }
  const predHome = Number(m?.predicted?.home)
  const predAway = Number(m?.predicted?.away)
  return {
    home,
    away,
    homeWinPct,
    drawPct,
    awayWinPct,
    predHome: Number.isFinite(predHome) ? predHome : null,
    predAway: Number.isFinite(predAway) ? predAway : null,
  }
}

export function freezeRowsFromPreview(preview) {
  if (!isLockQualitySource(preview?.source)) return []
  const rows = []
  for (const m of preview?.matchups ?? []) {
    const row = freezeRowFromPreviewMatchup(m)
    if (row) rows.push(row)
  }
  return rows
}

export function freezeRowsFromRecapGw(recapGw) {
  const rows = []
  for (const m of recapGw?.matchups ?? []) {
    const row = freezeRowFromRecapMatchup(m)
    if (row) rows.push(row)
  }
  return rows
}

export function mergeFreezeRow(freezeByGw, gw, row) {
  if (!row) return
  const g = Number(gw)
  if (!Number.isFinite(g)) return
  if (!freezeByGw.has(g)) freezeByGw.set(g, new Map())
  const pairs = freezeByGw.get(g)
  const key = unorderedPairKey(row.home, row.away)
  if (!pairs.has(key)) pairs.set(key, row)
}

export function ingestWeeklyRecaps(freezeByGw, recaps) {
  if (!recaps) return freezeByGw
  for (const preview of recaps.previews ?? []) {
    const gw = Number(preview?.gw)
    for (const row of freezeRowsFromPreview(preview)) mergeFreezeRow(freezeByGw, gw, row)
  }
  for (const recap of recaps.gameweeks ?? []) {
    const gw = Number(recap?.gw)
    for (const row of freezeRowsFromRecapGw(recap)) mergeFreezeRow(freezeByGw, gw, row)
  }
  return freezeByGw
}

export function findFreezeRow(gwMap, homeId, awayId) {
  if (!gwMap) return null
  return gwMap.get(unorderedPairKey(homeId, awayId)) ?? null
}

export function orientFreezeRow(row, homeId, awayId) {
  if (!row) return null
  const h = Number(homeId)
  const a = Number(awayId)
  const rh = Number(row.home)
  const ra = Number(row.away)
  if (rh === h && ra === a) {
    return {
      home: h,
      away: a,
      homeWinPct: Number(row.homeWinPct),
      drawPct: Number(row.drawPct) || 0,
      awayWinPct: Number(row.awayWinPct),
      predHome: row.predHome,
      predAway: row.predAway,
    }
  }
  if (rh === a && ra === h) {
    return {
      home: h,
      away: a,
      homeWinPct: Number(row.awayWinPct),
      drawPct: Number(row.drawPct) || 0,
      awayWinPct: Number(row.homeWinPct),
      predHome: row.predAway,
      predAway: row.predHome,
    }
  }
  return null
}

export function favoriteFromOriented(row, homeId, awayId) {
  const hw = Number(row?.homeWinPct)
  const aw = Number(row?.awayWinPct)
  if (!Number.isFinite(hw) || !Number.isFinite(aw)) {
    return {
      favorite: null,
      source: 'preview',
      homePct: null,
      awayPct: null,
      predHome: null,
      predAway: null,
    }
  }
  let favorite = null
  if (hw > aw) favorite = Number(homeId)
  else if (aw > hw) favorite = Number(awayId)
  const predHome = Number(row.predHome)
  const predAway = Number(row.predAway)
  return {
    favorite,
    source: 'preview',
    homePct: hw,
    awayPct: aw,
    predHome: Number.isFinite(predHome) ? predHome : null,
    predAway: Number.isFinite(predAway) ? predAway : null,
  }
}

export function scoreOrientedCall(row, homeId, awayId, homePts, awayPts) {
  const { favorite } = favoriteFromOriented(row, homeId, awayId)
  const hp = Number(homePts) || 0
  const ap = Number(awayPts) || 0
  const actual = hp > ap ? Number(homeId) : ap > hp ? Number(awayId) : null
  if (actual == null) return 'draw'
  if (favorite == null) return 'nocall'
  return favorite === actual ? 'hit' : 'miss'
}

export function applyFreezeToRecapOdds(row, homeId, awayId, homePts, awayPts) {
  const oriented = orientFreezeRow(row, homeId, awayId)
  if (!oriented) return null
  const call = favoriteFromOriented(oriented, homeId, awayId)
  const outcome = scoreOrientedCall(oriented, homeId, awayId, homePts, awayPts)
  const favoriteSide =
    call.favorite === Number(homeId) ? 'home' : call.favorite === Number(awayId) ? 'away' : 'home'
  const favoritePct =
    call.favorite === Number(homeId)
      ? call.homePct
      : call.favorite === Number(awayId)
        ? call.awayPct
        : 50
  return {
    odds: {
      home: oriented.homeWinPct,
      draw: oriented.drawPct,
      away: oriented.awayWinPct,
      favoriteSide,
      favoritePct: call.favorite == null ? 50 : favoritePct,
      source: 'preview',
      outcome,
    },
    predicted:
      call.predHome != null && call.predAway != null
        ? { home: call.predHome, away: call.predAway }
        : null,
  }
}

export function freezeToResolveInput(row, homeId, awayId) {
  const oriented = orientFreezeRow(row, homeId, awayId)
  if (!oriented || !Number.isFinite(oriented.homeWinPct) || !Number.isFinite(oriented.awayWinPct)) {
    return null
  }
  return {
    hw: oriented.homeWinPct,
    dw: oriented.drawPct,
    aw: oriented.awayWinPct,
    homeMu: Number.isFinite(Number(oriented.predHome)) ? Number(oriented.predHome) : undefined,
    awayMu: Number.isFinite(Number(oriented.predAway)) ? Number(oriented.predAway) : undefined,
  }
}

export function readFreezeFiles(dataDir) {
  const map = new Map()
  const dir = join(dataDir, PREVIEW_ODDS_DIR)
  if (!existsSync(dir)) return map
  for (const f of readdirSync(dir)) {
    const m = /^gw-(\d+)\.json$/.exec(f)
    if (!m) continue
    const gw = Number(m[1])
    try {
      const doc = JSON.parse(readFileSync(join(dir, f), 'utf8'))
      const rows = Array.isArray(doc?.matches) ? doc.matches : []
      for (const row of rows) mergeFreezeRow(map, gw, row)
    } catch {
      /* skip unreadable freeze files */
    }
  }
  return map
}

export function persistFreezeGw(dataDir, gw, rows, { force = false } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return false
  const dir = join(dataDir, PREVIEW_ODDS_DIR)
  mkdirSync(dir, { recursive: true })
  const dest = join(dir, `gw-${String(gw).padStart(2, '0')}.json`)
  const overwrite = force || process.env.PREVIEW_ODDS_FORCE === '1'
  if (existsSync(dest) && !overwrite) return false
  const doc = {
    schemaVersion: 1,
    gw: Number(gw),
    source: 'preview',
    generatedAt: new Date().toISOString(),
    matches: rows,
  }
  writeFileSync(dest, JSON.stringify(doc, null, 2))
  return true
}

export async function fetchPublishedWeeklyRecaps(
  url = DEFAULT_PUBLIC_RECAP_URL,
  fetchFn = globalThis.fetch,
) {
  if (typeof fetchFn !== 'function') return null
  try {
    const r = await fetchFn(url, { headers: { Accept: 'application/json' } })
    if (!r?.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

export async function loadPreviewFreezeMap(
  dataDir,
  { fetchPublished = true, fetchFn = globalThis.fetch } = {},
) {
  const map = readFreezeFiles(dataDir)
  const skipFetch =
    !fetchPublished ||
    process.env.OFFLINE === '1' ||
    process.env.SKIP_PREVIEW_FREEZE_FETCH === '1'
  if (!skipFetch) {
    const url = process.env.TCLOT_PUBLIC_RECAP_URL || DEFAULT_PUBLIC_RECAP_URL
    const published = await fetchPublishedWeeklyRecaps(url, fetchFn)
    if (published) ingestWeeklyRecaps(map, published)
  }
  return map
}

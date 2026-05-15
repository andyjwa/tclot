#!/usr/bin/env node
/**
 * Precomputes GP / 60+ / DefCon GW hits for every draft player at build time.
 * Avoids hundreds of browser→proxy element-summary calls on the Players tab.
 *
 * Runs when FPL_LEAGUE_ID / LEAGUE_ID / .fpl-league-id is set (same gate as build-draft-picks).
 * Fetches draft API server-side (no CORS / no Cloudflare Worker quota).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '../..')
const webPublic = join(repoRoot, 'web/public/league-data')
const idFile = join(repoRoot, '.fpl-league-id')
const outPath = join(webPublic, 'player-wire-stats.json')

const DRAFT = 'https://draft.premierleague.com/api'
const BATCH = 12
const BATCH_DELAY_MS = 80

function readId() {
  if (existsSync(idFile)) {
    const t = readFileSync(idFile, 'utf8').trim().split(/\r?\n/)[0]?.trim()
    if (t && /^\d+$/.test(t)) return t
  }
  const e = process.env.FPL_LEAGUE_ID?.trim() || process.env.LEAGUE_ID?.trim()
  if (e && /^\d+$/.test(e)) return e
  return null
}

function currentGwFromBootstrap(boot) {
  const cur = boot?.events?.current ?? boot?.events?.data?.current
  const n = Number(cur)
  return Number.isFinite(n) && n >= 1 ? n : null
}

async function fetchSummary(id) {
  const urls = [
    `${DRAFT}/element-summary/${id}`,
    `https://fantasy.premierleague.com/api/element-summary/${id}`,
  ]
  for (const url of urls) {
    try {
      const r = await fetch(url)
      if (r.ok) return r.json()
    } catch {
      /* try next */
    }
  }
  return null
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function defConThreshold(elementTypeId) {
  const t = Number(elementTypeId)
  if (t === 1 || t === 2) return 10
  if (t === 3 || t === 4) return 12
  return null
}

function historyGw(h) {
  const n = Number(h?.round ?? h?.event)
  return Number.isFinite(n) ? n : NaN
}

function historyDcCount(h) {
  const v = h?.defensive_contribution ?? h?.defensive_contributions ?? h?.dc ?? h?.dc_count
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function statsFromSummary(payload, elementTypeId) {
  const raw = payload?.history
  let gamesPlayed = 0
  let sixtyPlus = 0
  let defConHits = 0
  const threshold = defConThreshold(elementTypeId)
  if (Array.isArray(raw)) {
    for (const h of raw) {
      if (!h || !Number.isFinite(historyGw(h))) continue
      const mins = Number(h?.minutes)
      const m = Number.isFinite(mins) ? mins : 0
      if (m > 0) gamesPlayed += 1
      if (m >= 60) sixtyPlus += 1
      if (threshold != null) {
        const dc = historyDcCount(h)
        if (dc != null && dc >= threshold) defConHits += 1
      }
    }
  }
  return { gamesPlayed, sixtyPlus, defConHits }
}

const leagueId = readId()
if (!leagueId) {
  process.exit(0)
}

const bootPath = join(webPublic, 'bootstrap_draft.json')
if (!existsSync(bootPath)) {
  console.warn('build-player-wire-stats: skip — no bootstrap_draft.json')
  process.exit(0)
}

const boot = JSON.parse(readFileSync(bootPath, 'utf8'))
const gw = currentGwFromBootstrap(boot)
const elements = boot.elements || []
if (!elements.length) {
  console.warn('build-player-wire-stats: skip — bootstrap has no elements')
  process.exit(0)
}

if (existsSync(outPath) && process.env.FORCE_PLAYER_WIRE_STATS !== '1') {
  try {
    const prev = JSON.parse(readFileSync(outPath, 'utf8'))
    if (Number(prev?._meta?.gameweek) === gw && prev?.byElement && Object.keys(prev.byElement).length > 0) {
      console.log(
        `build-player-wire-stats: skip — GW ${gw} stats already present (${Object.keys(prev.byElement).length} players)`,
      )
      process.exit(0)
    }
  } catch {
    /* rebuild */
  }
}

try {
  console.log(
    `build-player-wire-stats: fetching ${elements.length} element-summary rows for GW ${gw ?? '?'}…`,
  )
  const byElement = {}
  let ok = 0
  let fail = 0

  for (let i = 0; i < elements.length; i += BATCH) {
    const chunk = elements.slice(i, i + BATCH)
    const rows = await Promise.all(
      chunk.map(async (el) => {
        const id = Number(el.id)
        if (!Number.isFinite(id)) return null
        const payload = await fetchSummary(id)
        if (!payload) return { id, fail: true }
        const stats = statsFromSummary(payload, el.element_type)
        return { id, stats }
      }),
    )
    for (const row of rows) {
      if (!row) continue
      if (row.fail) {
        fail += 1
        continue
      }
      byElement[String(row.id)] = row.stats
      ok += 1
    }
    if (i + BATCH < elements.length) await sleep(BATCH_DELAY_MS)
  }

  const out = {
    _meta: {
      built: new Date().toISOString(),
      leagueId: Number(leagueId),
      gameweek: gw,
      elementCount: ok,
      failed: fail,
    },
    byElement,
  }
  mkdirSync(webPublic, { recursive: true })
  writeFileSync(outPath, JSON.stringify(out, null, 2))
  console.log(`build-player-wire-stats: wrote ${ok} players (${fail} failed) → ${outPath}`)
} catch (e) {
  console.warn('build-player-wire-stats: failed —', e?.message ?? e)
  process.exit(0)
}

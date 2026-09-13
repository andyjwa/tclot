#!/usr/bin/env node
/**
 * No-bonus standings: official H2H scores with counted bonus removed.
 *
 * Reads:  public/league-data/details.json (fallback), bootstrap_draft.json
 * Writes: public/league-data/no-bonus-points.json
 *
 * Prefers a live league details fetch so a stale checkout still scores every
 * finished gameweek. Fail-soft: never break a deploy.
 * OFFLINE=1 / SKIP_NO_BONUS=1 skips.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildNoBonusReport, countedBonus } from '../src/noBonusPoints.js'
import { resolveSeasonFromBootstrap } from '../src/seasonString.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = join(root, 'public/league-data')
const DRAFT_API = 'https://draft.premierleague.com/api'
const UA = 'TCLOT/1.0 (https://tclot.vercel.app; no bonus points)'

function read(name) {
  return JSON.parse(readFileSync(join(dataDir, name), 'utf8'))
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchJson(label, url, attempts = 3) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return await r.json()
    } catch (e) {
      lastErr = e
      await sleep(350 * (i + 1))
    }
  }
  throw new Error(`${label}: ${lastErr?.message || 'fetch failed'}`)
}

function keepExisting(reason) {
  const dest = join(dataDir, 'no-bonus-points.json')
  if (existsSync(dest)) {
    console.warn(`build-no-bonus-points: ${reason} — keeping existing no-bonus-points.json`)
  } else {
    console.warn(`build-no-bonus-points: ${reason} — no existing file to keep`)
  }
}

function finishedGameweeks(matches) {
  const byEv = new Map()
  for (const m of matches ?? []) {
    const ev = Number(m.event)
    if (!Number.isFinite(ev) || ev < 1) continue
    if (!byEv.has(ev)) byEv.set(ev, [])
    byEv.get(ev).push(m)
  }
  const out = []
  for (const [ev, arr] of byEv) {
    if (arr.length && arr.every((x) => x.finished === true)) out.push(ev)
  }
  return out.sort((a, b) => a - b)
}

function bonusByElement(liveJson) {
  const raw = liveJson?.elements
  const out = {}
  const take = (id, row) => {
    const bonus = row?.stats?.bonus
    out[id] = typeof bonus === 'number' ? bonus : Number(bonus) || 0
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      const id = Number(k)
      if (Number.isFinite(id)) take(id, v)
    }
    return out
  }
  if (Array.isArray(raw)) {
    for (const row of raw) {
      const id = Number(row?.id)
      if (Number.isFinite(id)) take(id, row)
    }
  }
  return out
}

async function loadDetails(local) {
  const id = Number(local?.league?.id) || Number(process.env.FPL_LEAGUE_ID) || null
  if (!id) return local
  try {
    const live = await fetchJson('league details', `${DRAFT_API}/league/${id}/details`)
    if (Array.isArray(live?.matches) && live.matches.length) return live
  } catch (e) {
    console.warn('build-no-bonus-points: live details —', e.message)
  }
  return local
}

async function main() {
  if (process.env.OFFLINE === '1' || process.env.SKIP_NO_BONUS === '1') {
    console.log('build-no-bonus-points: skip (OFFLINE / SKIP_NO_BONUS)')
    return
  }

  let local
  let boot
  try {
    local = read('details.json')
    boot = read('bootstrap_draft.json')
  } catch (err) {
    keepExisting(err.message)
    return
  }

  const details = await loadDetails(local)
  const entries = details.league_entries || local.league_entries || []
  const matches = details.matches || []
  const gws = finishedGameweeks(matches)
  const teams = entries.map((e) => ({
    leagueEntryId: Number(e.id),
    fplEntryId: e.entry_id != null ? Number(e.entry_id) : null,
    teamName: e.entry_name || `Team ${e.id}`,
  }))
  const nameById = new Map(teams.map((t) => [t.leagueEntryId, t.teamName]))
  const season = resolveSeasonFromBootstrap(boot)

  if (!teams.length || !gws.length) {
    const empty = buildNoBonusReport({ teams, fixtures: [] })
    writeFileSync(
      join(dataDir, 'no-bonus-points.json'),
      `${JSON.stringify(
        {
          ...empty,
          generatedAt: new Date().toISOString(),
          season: season?.label ?? season?.string ?? null,
          leagueId: Number(details.league?.id) || Number(local.league?.id) || null,
          incomplete: [],
        },
        null,
        2,
      )}\n`,
    )
    console.log('build-no-bonus-points: no finished gameweeks — wrote empty report')
    return
  }

  const picksCache = new Map()
  const loadPicks = async (fplEid, gw) => {
    const key = `${fplEid}-${gw}`
    if (!picksCache.has(key)) {
      await sleep(80)
      picksCache.set(
        key,
        fetchJson(`picks ${fplEid} gw${gw}`, `${DRAFT_API}/entry/${fplEid}/event/${gw}`),
      )
    }
    return picksCache.get(key)
  }

  const fixtures = []
  const incomplete = []

  for (const gw of gws) {
    let liveJson
    try {
      liveJson = await fetchJson(`event/live gw${gw}`, `${DRAFT_API}/event/${gw}/live`)
    } catch (e) {
      console.warn(`build-no-bonus-points: GW${gw} live —`, e.message)
      incomplete.push(gw)
      continue
    }
    const bonus = bonusByElement(liveJson)
    const gwMatches = matches.filter((m) => Number(m.event) === gw && m.finished === true)
    let gwOk = true
    const scored = []

    for (const m of gwMatches) {
      const homeId = Number(m.league_entry_1)
      const awayId = Number(m.league_entry_2)
      const home = teams.find((t) => t.leagueEntryId === homeId)
      const away = teams.find((t) => t.leagueEntryId === awayId)
      if (!home?.fplEntryId || !away?.fplEntryId) {
        gwOk = false
        break
      }
      let homePicks
      let awayPicks
      try {
        homePicks = await loadPicks(home.fplEntryId, gw)
        awayPicks = await loadPicks(away.fplEntryId, gw)
      } catch (e) {
        console.warn(`build-no-bonus-points: GW${gw} picks —`, e.message)
        gwOk = false
        break
      }
      scored.push({
        gw,
        homeId,
        awayId,
        homeName: nameById.get(homeId),
        awayName: nameById.get(awayId),
        homePts: Number(m.league_entry_1_points) || 0,
        awayPts: Number(m.league_entry_2_points) || 0,
        homeBonus: countedBonus(
          homePicks?.picks,
          homePicks?.subs ?? homePicks?.automatic_subs,
          bonus,
        ),
        awayBonus: countedBonus(
          awayPicks?.picks,
          awayPicks?.subs ?? awayPicks?.automatic_subs,
          bonus,
        ),
      })
    }

    if (!gwOk || scored.length !== gwMatches.length) {
      incomplete.push(gw)
      continue
    }
    fixtures.push(...scored)
  }

  if (!fixtures.length) {
    keepExisting('no gameweeks could be scored')
    return
  }

  const report = buildNoBonusReport({ teams, fixtures })
  const out = {
    ...report,
    generatedAt: new Date().toISOString(),
    season: season?.label ?? season?.string ?? null,
    leagueId: Number(details.league?.id) || Number(local.league?.id) || null,
    incomplete,
  }
  writeFileSync(join(dataDir, 'no-bonus-points.json'), `${JSON.stringify(out, null, 2)}\n`)
  console.log(
    `build-no-bonus-points: ${report.gameweeks.length} GW(s), ${report.flippedCount} result(s) would change` +
      (incomplete.length ? ` — skipped GW ${incomplete.join(', ')}` : ''),
  )
}

main().catch((e) => {
  console.error('build-no-bonus-points FAILED:', e)
  keepExisting(e?.message || 'fatal')
})

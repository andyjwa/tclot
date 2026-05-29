import { useEffect, useRef, useState } from 'react'
import { buildEffectiveLineup } from './fplAutosubProjection'
import { draftEntryEventUrl, draftResourceUrl } from './fplDraftUrl'
import { fetchFplJsonCached } from './fplFetchCache.js'
import {
  enrichElementWithKnownName,
  fetchKnownNameMap,
} from './fplElementNames.js'
import {
  applyBonusColumn,
  classicResourceUrl,
  liveFullByElementId,
  liveStatsByElementId,
  mapPickRows,
} from './useLiveScores'

/**
 * On-demand loader for **finished** gameweek fixture squads — powers the
 * expandable rows in the Standings → Schedule sub-tab.
 *
 * Lighter than {@link useLiveScores}: skips ESPN/Pulselive Prem-window
 * fetches (they only matter for in-flight bonus / autosub projection) and
 * trusts the FPL API bonus + `automatic_subs` since the GW is finalised.
 *
 * Caching:
 *   - Per-GW bootstrap + live + PL fixtures are memoised in a module-level
 *     map (`gwContextCache`), so expanding multiple fixtures in the same
 *     GW reuses one set of fetches.
 *   - Per-(GW, fplEntryId) squads are memoised in `entrySquadCache`,
 *     so collapsing then re-expanding the same row is instant.
 *   - Failed fetches are evicted so the next attempt retries.
 *
 * @typedef {{
 *   leagueEntryId: number,
 *   teamName: string,
 *   fplEntryId: number | null,
 *   error: string | null,
 *   starters: object[],
 *   bench: object[],
 *   displayStarters: object[],
 *   displayBench: object[],
 *   gwPoints: number | null,
 *   pointsOnBench: number | null,
 *   autoSubs: Array<{ element_in: number, element_out: number }>,
 *   autosubSource: 'official' | 'projected' | 'none',
 *   projectedAutoSubs: Array<{ element_in: number, element_out: number }>,
 * }} HistoricSquad
 */

/** @type {Map<string, Promise<object>>} */
const gwContextCache = new Map()
/** @type {Map<string, Promise<HistoricSquad>>} */
const entrySquadCache = new Map()

function emptySquad(leagueEntryId, teamName, fplEntryId, errorMsg) {
  return {
    leagueEntryId,
    teamName,
    fplEntryId,
    error: errorMsg,
    starters: [],
    bench: [],
    displayStarters: [],
    displayBench: [],
    gwPoints: null,
    pointsOnBench: null,
    autoSubs: [],
    autosubSource: 'none',
    projectedAutoSubs: [],
  }
}

async function loadGwContext(gw) {
  const key = String(gw)
  if (gwContextCache.has(key)) return gwContextCache.get(key)
  const p = (async () => {
    const [boot, liveJson, knownMap] = await Promise.all([
      fetchFplJsonCached(draftResourceUrl('bootstrap-static'), {
        label: 'draft bootstrap-static (historic)',
      }),
      fetchFplJsonCached(draftResourceUrl(`event/${gw}/live`), {
        label: 'draft event/live (historic)',
      }),
      fetchKnownNameMap(),
    ])
    let gwFixtures = []
    try {
      const fxRaw = await fetchFplJsonCached(
        classicResourceUrl(`fixtures/?event=${gw}`),
        { label: 'classic fixtures (historic)' },
      )
      gwFixtures = Array.isArray(fxRaw)
        ? fxRaw.filter((f) => Number(f.event) === Number(gw))
        : []
    } catch {
      /* Classic fixtures occasionally 503s; expanded view still works without opponent labels. */
      gwFixtures = []
    }
    const elements = (boot.elements || []).map((e) =>
      enrichElementWithKnownName(e, knownMap),
    )
    const elementById = Object.fromEntries(
      elements.map((e) => [Number(e.id), e]),
    )
    const teamById = Object.fromEntries(
      (boot.teams || []).map((t) => [Number(t.id), t]),
    )
    const typeById = Object.fromEntries(
      (boot.element_types || []).map((t) => [Number(t.id), t]),
    )
    const liveByEl = liveStatsByElementId(liveJson)
    const liveFull = liveFullByElementId(liveJson)
    const liveFullNumeric = {}
    for (const [k, v] of Object.entries(liveFull)) {
      const id = Number(k)
      if (Number.isFinite(id)) liveFullNumeric[id] = v
    }
    return {
      elementById,
      teamById,
      typeById,
      liveByElementId: liveByEl,
      liveFullNumeric,
      gwFixtures,
    }
  })()
  gwContextCache.set(key, p)
  try {
    await p
  } catch (err) {
    gwContextCache.delete(key)
    throw err
  }
  return p
}

async function loadEntrySquad(gw, fplEntryId, leagueEntryId, teamName) {
  if (fplEntryId == null) {
    return emptySquad(
      leagueEntryId,
      teamName,
      null,
      'Missing FPL entry id for this team — historic lineup unavailable.',
    )
  }
  const cacheKey = `${gw}-${fplEntryId}`
  if (entrySquadCache.has(cacheKey)) return entrySquadCache.get(cacheKey)
  const p = (async () => {
    const ctx = await loadGwContext(gw)
    let picksPayload
    try {
      picksPayload = await fetchFplJsonCached(
        draftEntryEventUrl(fplEntryId, gw),
        { label: 'draft picks (historic)' },
      )
    } catch (err) {
      return emptySquad(
        leagueEntryId,
        teamName,
        fplEntryId,
        err?.message || String(err),
      )
    }
    const picks = picksPayload.picks || []
    const rows = mapPickRows(
      picks,
      ctx.liveByElementId,
      ctx.liveFullNumeric,
      ctx.elementById,
      ctx.teamById,
      ctx.typeById,
      ctx.gwFixtures,
      [],
    )
    const withBonus = applyBonusColumn(
      rows,
      new Map(),
      ctx.elementById,
      ctx.gwFixtures,
    )
    const withCaptain = withBonus.map((r) => ({
      ...r,
      total_points: Number(r.total_points) * (Number(r.fplMultiplier) || 1),
      /* Force finalised-fixture semantics so playerLiveState reads FT/DNP
       * even when classic `fixtures?event=…` couldn't be fetched (it'll
       * fall back to 'pre' otherwise, which would lie about a finished GW). */
      clubGwFixturesFinished: true,
      stillYetToPlayPl: false,
      leftToPlayStarter: false,
      leftToPlayFixtureCount: 0,
      playerGamesLeftToPlay: 0,
    }))
    const starters = withCaptain.filter((r) => r.pickPosition <= 11)
    const bench = withCaptain.filter((r) => r.pickPosition > 11)
    const autoSubs =
      picksPayload.automatic_subs ?? picksPayload.subs ?? []
    const {
      displayStarters,
      displayBench,
      autosubSource,
      projectedAutoSubs,
    } = buildEffectiveLineup({ starters, bench, autoSubs })
    const eh = picksPayload.entry_history
    const gwPoints = eh && typeof eh.points === 'number' ? eh.points : null
    const pointsOnBench =
      eh && typeof eh.points_on_bench === 'number' ? eh.points_on_bench : null
    return {
      leagueEntryId,
      teamName,
      fplEntryId,
      error: null,
      starters,
      bench,
      displayStarters,
      displayBench,
      gwPoints,
      pointsOnBench,
      autoSubs,
      autosubSource,
      projectedAutoSubs,
    }
  })()
  entrySquadCache.set(cacheKey, p)
  try {
    await p
  } catch (err) {
    entrySquadCache.delete(cacheKey)
    throw err
  }
  return p
}

/**
 * Hook: lazily load the home + away squads for a finished GW fixture
 * (typically when an accordion row opens). Mounted only when the row
 * is expanded — callers conditionally render the consumer component
 * so there's no `enabled` flag to toggle.
 *
 * @param {{
 *   gw: number | null,
 *   homeFplEntryId: number | null,
 *   awayFplEntryId: number | null,
 *   homeLeagueEntryId: number,
 *   awayLeagueEntryId: number,
 *   homeName: string,
 *   awayName: string,
 * }} params
 * @returns {{
 *   status: 'loading' | 'ready' | 'error',
 *   homeSquad: HistoricSquad | null,
 *   awaySquad: HistoricSquad | null,
 *   error: string | null,
 * }}
 */
export function useHistoricGwFixtureSquads({
  gw,
  homeFplEntryId,
  awayFplEntryId,
  homeLeagueEntryId,
  awayLeagueEntryId,
  homeName,
  awayName,
}) {
  const [state, setState] = useState({
    status: 'loading',
    homeSquad: null,
    awaySquad: null,
    error: null,
  })
  const reqRef = useRef(0)

  useEffect(() => {
    if (gw == null || !Number.isFinite(Number(gw))) return undefined
    const reqId = (reqRef.current += 1)
    const gwNum = Number(gw)
    Promise.all([
      loadEntrySquad(gwNum, homeFplEntryId, homeLeagueEntryId, homeName),
      loadEntrySquad(gwNum, awayFplEntryId, awayLeagueEntryId, awayName),
    ])
      .then(([homeSquad, awaySquad]) => {
        if (reqRef.current !== reqId) return
        setState({
          status: 'ready',
          homeSquad,
          awaySquad,
          error: null,
        })
      })
      .catch((err) => {
        if (reqRef.current !== reqId) return
        setState({
          status: 'error',
          homeSquad: null,
          awaySquad: null,
          error: err?.message || String(err),
        })
      })
    return undefined
  }, [
    gw,
    homeFplEntryId,
    awayFplEntryId,
    homeLeagueEntryId,
    awayLeagueEntryId,
    homeName,
    awayName,
  ])

  return state
}

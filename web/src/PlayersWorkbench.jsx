import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { draftCurrentGameweek } from './draftBoardRosterStatus'
import {
  enrichBootstrapElements,
  fplElementDisplayName,
  fplElementKnownName,
  fplElementWebName,
  fetchKnownNameMap,
} from './fplElementNames.js'
import { PlayerKit } from './PlayerKit.jsx'
import { TeamAvatar } from './TeamAvatar.jsx'
import { fplShirtImageUrl } from './fplShirtUrl'
import { parsePlayersHash, pushPlayersHash, replacePlayersHash } from './playerRoutes.js'
import { PlayerDetailView } from './PlayerDetailView.jsx'
import { loadLeagueFixtures } from './playerGwHistory.js'
import {
  POS_FILTER_ALL,
  POS_LABEL,
  buildNextFixturesByTeam,
  buildOwnerByElementFromElementStatus,
  compareWireElements,
  defaultSortDirForKey,
  elementSummaryStatsFromPayload,
  fetchElementSummariesBatched,
  formatWireStatValue,
  ownedElementIdsFromElementStatus,
  portraitMaxStatColumns,
  portraitDefaultWireStatIdsForPosition,
  readWireStatSelection,
  visibleWireColumns,
  wireColumnIsGroupStart,
  wireColumnToSortKey,
  wireStatsMapFromPayload,
  wireTableGridTemplate,
  WIRE_STAT_CATALOG,
  WIRE_POSITION_PILLS,
  writeWireStatSelection,
} from './playersWireList.js'
import './PlayersWorkbench.css'
import {
  FantasyTeamPill,
  PositionFilterPill,
  StatsColumnsPill,
  PillClearButton,
} from './playersFilterPills.jsx'
import { usePortraitMobile, useMobileLayout } from './usePortraitMobile.js'
import { usePillMenuDismiss } from './usePillMenuDismiss.js'

const DATA_BASE = `${import.meta.env.BASE_URL}league-data`

async function fetchBootstrapDraft(cacheKey = '') {
  const base = `${DATA_BASE}/bootstrap_draft.json`
  const url =
    cacheKey.trim() !== '' ? `${base}?v=${encodeURIComponent(cacheKey)}` : base
  const res = await fetch(url, cacheKey ? { cache: 'no-store' } : undefined)
  if (!res.ok) throw new Error(`bootstrap_draft.json (${res.status})`)
  const boot = await res.json()
  const knownMap = await fetchKnownNameMap(cacheKey)
  return enrichBootstrapElements(boot, knownMap)
}

async function fetchLeagueJsonFile(name, cacheKey = '') {
  const base = `${DATA_BASE}/${name}`
  const url =
    cacheKey.trim() !== '' ? `${base}?v=${encodeURIComponent(cacheKey)}` : base
  const res = await fetch(url, cacheKey ? { cache: 'no-store' } : undefined)
  if (!res.ok) throw new Error(`${name} (${res.status})`)
  return res.json()
}

const WIRE_STATS_SESSION_PREFIX = 'tclot-player-wire-stats-gw-'

function readWireStatsSession(gw) {
  if (typeof sessionStorage === 'undefined' || gw == null) return null
  try {
    const raw = sessionStorage.getItem(`${WIRE_STATS_SESSION_PREFIX}${gw}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return wireStatsMapFromPayload(parsed)
  } catch {
    return null
  }
}

function writeWireStatsSession(gw, map) {
  if (typeof sessionStorage === 'undefined' || gw == null) return
  try {
    const byElement = {}
    for (const [id, stats] of map) {
      byElement[String(id)] = stats
    }
    sessionStorage.setItem(
      `${WIRE_STATS_SESSION_PREFIX}${gw}`,
      JSON.stringify({ _meta: { gameweek: gw }, byElement }),
    )
  } catch {
    /* quota */
  }
}

/** @param {object} el bootstrap element */
function playerAvailabilityMark(el) {
  const status = el?.status != null ? String(el.status) : 'a'
  const news = typeof el?.news === 'string' ? el.news.trim() : ''
  if (status === 'i') {
    return { emoji: '🚑', label: 'Injured', title: news || 'Injured' }
  }
  if (status === 'd') {
    const chance = el?.chance_of_playing_next_round
    const chanceLabel =
      chance != null && Number.isFinite(Number(chance)) ? `${chance}% chance` : ''
    return {
      emoji: '⚠️',
      label: 'Doubtful',
      title: news || chanceLabel || 'Doubtful',
    }
  }
  if (status === 's') {
    return { emoji: '🟥', label: 'Suspended', title: news || 'Suspended' }
  }
  return null
}

function PlayerAvailabilityMark({ el }) {
  const mark = playerAvailabilityMark(el)
  if (!mark) return null
  return (
    <span
      className="players-availability-mark"
      title={mark.title}
      aria-label={mark.label}
      role="img"
    >
      {mark.emoji}
    </span>
  )
}

function plClubBadgeUrl(code) {
  return code != null
    ? `https://resources.premierleague.com/premierleague/badges/50/t${code}.png`
    : null
}

/**
 * @param {{
 *   clubFilter: number | 'all',
 *   clubOptions: object[],
 *   onSelect: (id: number | 'all') => void,
 * }} props
 */
function ClubFilterPill({ clubFilter, clubOptions, onSelect, compact = false }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const selectedTeam =
    clubFilter === 'all'
      ? null
      : clubOptions.find((t) => Number(t.id) === Number(clubFilter)) ?? null

  const selectedBadgeUrl = plClubBadgeUrl(selectedTeam?.code)
  const selectedLabel = selectedTeam
    ? String(selectedTeam.short_name ?? selectedTeam.name ?? 'Club')
    : 'Club'

  const dismiss = useCallback(() => setOpen(false), [])
  usePillMenuDismiss(rootRef, open, dismiss)

  const pick = (id) => {
    onSelect(id)
    setOpen(false)
  }

  const isActive = clubFilter !== 'all'
  const badgeOnly = compact && isActive

  return (
    <div
      className={`players-club-pill${badgeOnly ? ' players-club-pill--badge-only' : ''}`}
      ref={rootRef}
    >
      <button
        type="button"
        className={`team-selection-submenu__btn players-club-pill__btn${
          clubFilter !== 'all' ? ' team-selection-submenu__btn--active' : ''
        }${open ? ' players-menu-pill__btn--open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={
          clubFilter === 'all'
            ? 'Filter by club'
            : `Club filter: ${selectedLabel}`
        }
        onClick={() => setOpen((v) => !v)}
      >
        {selectedBadgeUrl ? (
          <img
            src={selectedBadgeUrl}
            alt=""
            className="players-club-pill__badge"
            width={18}
            height={18}
            loading="lazy"
          />
        ) : null}
        <span className="players-club-pill__label">{selectedLabel}</span>
        {clubFilter !== 'all' ? (
          <PillClearButton
            label="Show all clubs"
            onClear={() => onSelect('all')}
          />
        ) : null}
        <span className="players-menu-pill__chev" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <ul className="players-menu-pill__menu" role="listbox" aria-label="Clubs">
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={clubFilter === 'all'}
              className={`players-menu-pill__option${
                clubFilter === 'all' ? ' players-menu-pill__option--active' : ''
              }`}
              onClick={() => pick('all')}
            >
              <span className="players-menu-pill__option-text">All clubs</span>
            </button>
          </li>
          {clubOptions.map((t) => {
            const tid = Number(t.id)
            const active = Number(clubFilter) === tid
            const badge = plClubBadgeUrl(t.code)
            const short = String(t.short_name ?? t.name ?? '?')
            return (
              <li key={t.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`players-menu-pill__option${
                    active ? ' players-menu-pill__option--active' : ''
                  }`}
                  onClick={() => pick(tid)}
                >
                  {badge ? (
                    <img
                      src={badge}
                      alt=""
                      className="players-club-pill__badge"
                      width={20}
                      height={20}
                      loading="lazy"
                    />
                  ) : (
                    <span className="players-club-pill__badge-fallback">{short.slice(0, 3)}</span>
                  )}
                  <span className="players-menu-pill__option-text">{short}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

/** @param {{ fixtures: object[], nextOnly?: boolean }} props */
function NextFixtureBadges({ fixtures, nextOnly = false }) {
  const list = nextOnly && fixtures?.length ? [fixtures[0]] : fixtures
  if (!list?.length) {
    return <span className="players-fixtures-empty">—</span>
  }
  return (
    <span
      className={`players-fixtures-badges${nextOnly ? ' players-fixtures-badges--next-only' : ''}`}
      role="list"
      aria-label={nextOnly ? 'Next fixture' : 'Next three opponents'}
    >
      {list.map((fx, i) => (
        <span
          key={`${fx.oppTeamId}-${fx.isHome ? 'H' : 'A'}-${i}`}
          className={`players-fixture-badge${
            fx.isHome ? ' players-fixture-badge--home' : ' players-fixture-badge--away'
          }`}
          role="listitem"
          title={`${fx.isHome ? 'Home' : 'Away'} vs ${fx.shortName}`}
          aria-label={`${fx.isHome ? 'Home' : 'Away'} vs ${fx.shortName}`}
        >
          {fx.badgeUrl ? (
            <img
              src={fx.badgeUrl}
              alt=""
              className="players-fixture-badge__crest"
              width={28}
              height={28}
              loading="lazy"
            />
          ) : (
            <span className="players-fixture-badge__crest players-fixture-badge__crest--fallback">
              {fx.shortName?.slice(0, 3) ?? '?'}
            </span>
          )}
        </span>
      ))}
    </span>
  )
}

function enrichElementRow(el, teamByCode) {
  const tm = el ? teamByCode.get(el.team) : null
  const shirtUrl = fplShirtImageUrl(tm?.code, el?.element_type)
  const badgeUrl =
    tm?.code != null
      ? `https://resources.premierleague.com/premierleague/badges/50/t${tm.code}.png`
      : null
  const posLabel = POS_LABEL[el.element_type] ?? '?'
  return {
    raw: el,
    shirtUrl,
    badgeUrl,
    posLabel,
    teamShort: tm?.short_name ?? '—',
  }
}

/** @param {string} colId @param {string | null} activeSortColId @param {string} [extra] @param {boolean} [groupStart] */
function wireCellClass(colId, activeSortColId, extra = '', groupStart = false) {
  return [
    'players-table__cell',
    extra,
    colId === activeSortColId ? 'players-table__cell--sorted' : '',
    groupStart ? 'players-table__col--group-start' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * Pick lowest total-points teammate at position (quick “who might I bump?” cue).
 */
function suggestBenchTarget(rosterElements, elemsById, waiverEl) {
  if (!waiverEl?.element_type) return null
  let best = null
  let bestPts = Infinity
  for (const pid of rosterElements) {
    const e = elemsById.get(Number(pid))
    if (!e || e.element_type !== waiverEl.element_type) continue
    const pts = Number(e.total_points) || 0
    if (pts < bestPts) {
      bestPts = pts
      best = pid
    }
  }
  return best
}

function rosterIdsForLeagueEntry(leagueEntryId, ownerByElementId) {
  if (leagueEntryId == null) return new Set()
  const s = new Set()
  for (const [pid, owner] of ownerByElementId) {
    if (Number(owner.leagueEntryId) === Number(leagueEntryId)) {
      s.add(Number(pid))
    }
  }
  return s
}

function buildCompareOptionLabel(el, elementType, teamById, showClub = false) {
  const pts = Number(el.total_points) || 0
  const name = `${fplElementDisplayName(el, el.id)} (${POS_LABEL[elementType]})`
  if (!showClub || !teamById) return `${name} · ${pts} pts`
  const club = teamById.get(Number(el?.team))?.short_name ?? '—'
  return `${name} · ${club} · ${pts} pts`
}

/**
 * Waiver-wire browser + full-screen player detail (mobile portrait first).
 *
 * @param {{
 *   leagueEntries: object[],
 *   teamsForFormSelect: { id: number|null, teamName?: string|null, fplEntryId?: number|null }[],
 *   leagueDataRevision?: string,
 *   logoMap?: Record<string, string>,
 *   kitIndexByEntry?: Record<number, number>,
 *   onDetailOpenChange?: (open: boolean) => void,
 * }} props
 */
export function PlayersWorkbench({
  leagueEntries = [],
  teamsForFormSelect = [],
  leagueDataRevision = '',
  logoMap = {},
  kitIndexByEntry = {},
  onDetailOpenChange,
}) {
  const portrait = usePortraitMobile()
  const mobileLayout = useMobileLayout()
  const [bootstrap, setBootstrap] = useState(null)
  const [squadsErr, setSquadsErr] = useState(null)
  const [currentGw, setCurrentGw] = useState(null)
  /** element id → owner (from ingested element_status.json) */
  const [ownerByElementId, setOwnerByElementId] = useState(() => new Map())
  /** All rostered element ids league-wide */
  const [ownedIds, setOwnedIds] = useState(() => new Set())
  const [rostersHealthy, setRostersHealthy] = useState(false)

  const [availableOnly, setAvailableOnly] = useState(true)
  const [search, setSearch] = useState('')
  /** @type {[import('./playersWireList.js').PositionFilterId, (v: import('./playersWireList.js').PositionFilterId)=>void]} */
  const [positionFilter, setPositionFilter] = useState(POS_FILTER_ALL)
  /** @type {[number|'all', (v: number|'all')=>void]} */
  const [clubFilter, setClubFilter] = useState('all')
  /** @type {[import('./playersWireList.js').WireSortKey, (v: import('./playersWireList.js').WireSortKey)=>void]} */
  const [sortKey, setSortKey] = useState('total_points')
  /** @type {[import('./playersWireList.js').WireSortDir, (v: import('./playersWireList.js').WireSortDir)=>void]} */
  const [sortDir, setSortDir] = useState('desc')
  /** element id → { defConHits, gamesPlayed, sixtyPlus } from element-summary */
  const [summaryByElement, setSummaryByElement] = useState(() => new Map())
  const [summaryLoading, setSummaryLoading] = useState(false)
  /** @type {[number|null, (id: number|null)=>void]} */
  const [myTeamLeagueEntryId, setMyTeamLeagueEntryId] = useState(null)
  /** @type {[import('./playersFilterPills.jsx').CompareClubSource | null, (v: import('./playersFilterPills.jsx').CompareClubSource | null) => void]} */
  const [compareSource, setCompareSource] = useState(null)
  /** @type {[number|null, (id: number|null)=>void]} */
  const [detailPlayerId, setDetailPlayerId] = useState(null)
  const [benchId, setBenchId] = useState(null)
  /** @type {[string[], (ids: string[]) => void]} */
  const [selectedStatIds, setSelectedStatIds] = useState(() =>
    readWireStatSelection(POS_FILTER_ALL),
  )
  /** @type {[object[] | null, (v: object[] | null) => void]} */
  const [plFixtures, setPlFixtures] = useState(null)
  const hydratedFromUrlRef = useRef(false)
  /** True when detail was opened via `pushPlayersHash` (list entry exists behind detail). */
  const detailHistoryPushedRef = useRef(false)

  const elemsById = useMemo(() => {
    const m = new Map()
    if (!bootstrap?.elements) return m
    for (const el of bootstrap.elements) {
      m.set(Number(el.id), el)
    }
    return m
  }, [bootstrap])

  const teamById = useMemo(() => {
    const m = new Map()
    if (!bootstrap?.teams) return m
    for (const t of bootstrap.teams) {
      m.set(t.id, t)
    }
    return m
  }, [bootstrap])

  /** Every squad element rostered league-wide */
  const rosterIdsForMine = useMemo(() => {
    if (myTeamLeagueEntryId == null) return new Set()
    const s = new Set()
    for (const [pid, owner] of ownerByElementId) {
      if (Number(owner.leagueEntryId) === Number(myTeamLeagueEntryId)) {
        s.add(Number(pid))
      }
    }
    return s
  }, [myTeamLeagueEntryId, ownerByElementId])

  const nextFixturesByTeam = useMemo(() => {
    if (!bootstrap) return new Map()
    return buildNextFixturesByTeam(bootstrap, teamById, 3)
  }, [bootstrap, teamById])

  const visibleCols = useMemo(
    () => visibleWireColumns(positionFilter, selectedStatIds, { portrait }),
    [positionFilter, selectedStatIds, portrait],
  )
  const tableGridTemplate = useMemo(
    () => wireTableGridTemplate(visibleCols),
    [visibleCols],
  )
  const statColumnMax = portrait ? portraitMaxStatColumns(positionFilter) : undefined
  const handleStatSelectionChange = useCallback(
    (ids) => {
      const next = statColumnMax ? ids.slice(0, statColumnMax) : ids
      setSelectedStatIds(next)
      writeWireStatSelection(positionFilter, next)
    },
    [positionFilter, statColumnMax],
  )

  useEffect(() => {
    onDetailOpenChange?.(detailPlayerId != null)
  }, [detailPlayerId, onDetailOpenChange])

  useEffect(() => {
    if (portrait) {
      setSelectedStatIds(portraitDefaultWireStatIdsForPosition(positionFilter))
      return
    }
    setSelectedStatIds(readWireStatSelection(positionFilter))
  }, [positionFilter, portrait])

  const clubOptions = useMemo(() => {
    if (!bootstrap?.teams?.length) return []
    return [...bootstrap.teams].sort((a, b) =>
      String(a.short_name || a.name).localeCompare(String(b.short_name || b.name)),
    )
  }, [bootstrap])

  const nextFixtureSortKey = useCallback(
    (el) => {
      const fixtures = nextFixturesByTeam.get(Number(el?.team)) ?? []
      return fixtures
        .map((fx) => `${fx.isHome ? 'H' : 'A'}${fx.shortName}`)
        .join('|')
    },
    [nextFixturesByTeam],
  )

  const summaryExtraFor = useCallback(
    (el) => {
      const s = summaryByElement.get(Number(el?.id))
      return {
        defConHits: s?.defConHits,
        gamesPlayed: s?.gamesPlayed,
        sixtyPlus: s?.sixtyPlus,
      }
    },
    [summaryByElement],
  )

  const handleColumnSort = useCallback((colId) => {
    const key = wireColumnToSortKey(colId)
    if (!key) return
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
      return
    }
    setSortKey(key)
    setSortDir(defaultSortDirForKey(key))
  }, [sortKey])

  const effectiveSortKey = useMemo(() => {
    const col = visibleCols.find((c) => wireColumnToSortKey(c.id) === sortKey)
    return col ? sortKey : 'total_points'
  }, [sortKey, visibleCols])

  const activeSortColId = useMemo(
    () => visibleCols.find((c) => wireColumnToSortKey(c.id) === effectiveSortKey)?.id ?? null,
    [visibleCols, effectiveSortKey],
  )

  const outfieldList = useMemo(() => {
    if (!bootstrap?.elements?.length) return []
    let list = [...bootstrap.elements]
    if (positionFilter !== POS_FILTER_ALL) {
      list = list.filter((el) => String(el.element_type) === positionFilter)
    }
    if (clubFilter !== 'all') {
      list = list.filter((el) => Number(el.team) === Number(clubFilter))
    }
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((el) => {
        const known = fplElementKnownName(el, el.id).toLowerCase()
        const web = fplElementWebName(el, el.id).toLowerCase()
        return known.includes(q) || web.includes(q)
      })
    }
    if (availableOnly && rostersHealthy) {
      if (myTeamLeagueEntryId != null) {
        list = list.filter((el) => !rosterIdsForMine.has(Number(el.id)))
      } else {
        list = list.filter((el) => !ownedIds.has(Number(el.id)))
      }
    } else if (myTeamLeagueEntryId != null && rostersHealthy) {
      list = list.filter((el) => rosterIdsForMine.has(Number(el.id)))
    }
    list.sort((a, b) =>
      compareWireElements(a, b, effectiveSortKey, sortDir, {
        extraFor: summaryExtraFor,
        nextFixtureSortKey,
      }),
    )
    return list
  }, [
    bootstrap,
    search,
    availableOnly,
    rostersHealthy,
    ownedIds,
    rosterIdsForMine,
    myTeamLeagueEntryId,
    positionFilter,
    clubFilter,
    effectiveSortKey,
    sortDir,
    summaryExtraFor,
    nextFixtureSortKey,
  ])

  /** GP / 60+ / DefCon — static file at build time; session cache or one-time API fallback per GW. */
  useEffect(() => {
    if (currentGw == null || !bootstrap?.elements?.length) return undefined
    let cancel = false

    void (async () => {
      const cacheKey =
        leagueDataRevision && String(leagueDataRevision).trim()
          ? String(leagueDataRevision).trim()
          : ''

      try {
        const wirePayload = await fetchLeagueJsonFile('player-wire-stats.json', cacheKey)
        if (cancel) return
        const fromFile = wireStatsMapFromPayload(wirePayload)
        if (fromFile.size > 0 && Number(wirePayload?._meta?.gameweek) === Number(currentGw)) {
          setSummaryByElement(fromFile)
          setSummaryLoading(false)
          return
        }
      } catch {
        /* no prebuilt file — dev / demo */
      }

      const fromSession = readWireStatsSession(currentGw)
      if (fromSession?.size) {
        setSummaryByElement(fromSession)
        setSummaryLoading(false)
        return
      }

      setSummaryLoading(true)
      const ids = bootstrap.elements.map((el) => Number(el.id)).filter(Number.isFinite)
      const next = new Map()
      await fetchElementSummariesBatched(ids, (id, payload) => {
        if (cancel) return
        const el = elemsById.get(id)
        next.set(
          id,
          payload
            ? elementSummaryStatsFromPayload(payload, el?.element_type)
            : { defConHits: null, gamesPlayed: null, sixtyPlus: null },
        )
      })
      if (cancel) return
      setSummaryByElement(next)
      writeWireStatsSession(currentGw, next)
      setSummaryLoading(false)
    })()

    return () => {
      cancel = true
    }
  }, [currentGw, bootstrap, leagueDataRevision, elemsById])

  useEffect(() => {
    let cancel = false
    void loadLeagueFixtures(DATA_BASE).then((rows) => {
      if (!cancel) setPlFixtures(rows)
    })
    return () => {
      cancel = true
    }
  }, [leagueDataRevision])

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        setSquadsErr(null)
        const cacheKey =
          leagueDataRevision && String(leagueDataRevision).trim()
            ? String(leagueDataRevision).trim()
            : ''
        const boot = await fetchBootstrapDraft(cacheKey)
        if (cancel) return
        setBootstrap(boot)
        setCurrentGw(draftCurrentGameweek(boot))

        const statusPayload = await fetchLeagueJsonFile('element_status.json', cacheKey)
        if (cancel) return

        const owners = buildOwnerByElementFromElementStatus(statusPayload, teamsForFormSelect)
        const owned = ownedElementIdsFromElementStatus(statusPayload)
        setOwnerByElementId(owners)
        setOwnedIds(owned)
        setRostersHealthy(owned.size > 0)
      } catch (e) {
        if (!cancel) {
          const msg = e?.message ?? String(e)
          setSquadsErr(msg)
          setRostersHealthy(false)
        }
      }
    })()
    return () => {
      cancel = true
    }
  }, [teamsForFormSelect, leagueDataRevision])

  /** Hydrate from URL once bootstrap + IDs are ready (avoids clobbering `#/players?…` before load). */
  useEffect(() => {
    if (!bootstrap || elemsById.size === 0 || hydratedFromUrlRef.current) return
    const parsed = parsePlayersHash()
    if (
      parsed == null ||
      (parsed.waiver == null &&
        parsed.bench == null &&
        parsed.teamId == null &&
        parsed.plClubId == null)
    ) {
      hydratedFromUrlRef.current = true
      return
    }
    hydratedFromUrlRef.current = true
    queueMicrotask(() => {
      const { waiver, bench, teamId, plClubId } = parsed

      if (
        teamId != null &&
        teamsForFormSelect.some((x) => Number(x.id) === Number(teamId))
      ) {
        setMyTeamLeagueEntryId(Number(teamId))
        setCompareSource({ kind: 'fantasy', id: Number(teamId) })
      } else if (
        plClubId != null &&
        bootstrap?.teams?.some((x) => Number(x.id) === Number(plClubId))
      ) {
        setCompareSource({ kind: 'pl-club', id: Number(plClubId) })
      }

      const waiverNum =
        waiver != null && elemsById.has(Number(waiver)) ? Number(waiver) : null
      const sourceRosterIds =
        teamId != null
          ? rosterIdsForLeagueEntry(Number(teamId), ownerByElementId)
          : new Set()
      let nextBench =
        waiverNum != null && teamId != null
          ? suggestBenchTarget([...sourceRosterIds], elemsById, elemsById.get(waiverNum))
          : null
      if (
        waiverNum != null &&
        bench != null &&
        elemsById.has(Number(bench))
      ) {
        const bb = elemsById.get(Number(bench))
        const ww = elemsById.get(waiverNum)
        if (bb && ww && bb.element_type === ww.element_type) nextBench = Number(bench)
      }

      if (waiverNum != null) {
        setDetailPlayerId(waiverNum)
        setBenchId(nextBench)
      }
    })
  }, [teamsForFormSelect, elemsById, bootstrap, ownerByElementId])

  useEffect(() => {
    const onPop = () => {
      const parsed = parsePlayersHash()
      if (!parsed || parsed.waiver == null) {
        detailHistoryPushedRef.current = false
        setDetailPlayerId(null)
        setBenchId(null)
        setCompareSource(null)
        return
      }
      detailHistoryPushedRef.current = true
      if (elemsById.has(Number(parsed.waiver))) {
        setDetailPlayerId(Number(parsed.waiver))
        setBenchId(parsed.bench)
      }
      if (
        parsed.teamId != null &&
        teamsForFormSelect.some((x) => Number(x.id) === Number(parsed.teamId))
      ) {
        setCompareSource({ kind: 'fantasy', id: Number(parsed.teamId) })
        setMyTeamLeagueEntryId(Number(parsed.teamId))
      } else if (
        parsed.plClubId != null &&
        bootstrap?.teams?.some((x) => Number(x.id) === Number(parsed.plClubId))
      ) {
        setCompareSource({ kind: 'pl-club', id: Number(parsed.plClubId) })
      } else {
        setCompareSource(null)
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [elemsById, teamsForFormSelect, bootstrap])

  useEffect(() => {
    if (!bootstrap) return
    const slice = {
      waiver: detailPlayerId,
      bench: detailPlayerId != null ? benchId : null,
    }
    if (detailPlayerId != null && compareSource) {
      if (compareSource.kind === 'fantasy') {
        slice.teamId = compareSource.id
      } else {
        slice.plClubId = compareSource.id
      }
    } else {
      slice.teamId = myTeamLeagueEntryId
    }
    replacePlayersHash(slice)
  }, [bootstrap, detailPlayerId, benchId, compareSource, myTeamLeagueEntryId])

  const detailPlayerEl = detailPlayerId != null ? elemsById.get(detailPlayerId) : null
  const benchEl = benchId != null ? elemsById.get(benchId) : null

  const compareSearchOptions = useMemo(() => {
    const w = detailPlayerEl
    if (!w?.element_type) return []
    const out = []
    const waiverId = Number(w.id)

    for (const el of bootstrap?.elements ?? []) {
      if (el.element_type !== w.element_type) continue
      if (Number(el.id) === waiverId) continue
      out.push({
        id: Number(el.id),
        label: buildCompareOptionLabel(el, w.element_type, teamById, true),
      })
    }

    out.sort(
      (a, b) =>
        (Number(elemsById.get(b.id)?.total_points) || 0) -
        (Number(elemsById.get(a.id)?.total_points) || 0),
    )
    return out
  }, [detailPlayerEl, elemsById, bootstrap, teamById])

  const compareSquadOptions = useMemo(() => {
    const w = detailPlayerEl
    if (!w?.element_type || !compareSource) return []
    const out = []

    if (compareSource.kind === 'fantasy') {
      const rosterIds = rosterIdsForLeagueEntry(compareSource.id, ownerByElementId)
      for (const pid of rosterIds) {
        const el = elemsById.get(Number(pid))
        if (!el || el.element_type !== w.element_type) continue
        out.push({
          id: Number(pid),
          label: buildCompareOptionLabel(el, w.element_type, teamById),
        })
      }
    } else {
      for (const el of bootstrap?.elements ?? []) {
        if (Number(el.team) !== Number(compareSource.id)) continue
        if (el.element_type !== w.element_type) continue
        out.push({
          id: Number(el.id),
          label: buildCompareOptionLabel(el, w.element_type, teamById),
        })
      }
    }

    out.sort(
      (a, b) =>
        (Number(elemsById.get(b.id)?.total_points) || 0) -
        (Number(elemsById.get(a.id)?.total_points) || 0),
    )
    return out
  }, [detailPlayerEl, compareSource, ownerByElementId, elemsById, bootstrap, teamById])

  const handleSearchBenchSelect = useCallback((id) => {
    if (id != null) {
      setCompareSource(null)
    }
    setBenchId(id)
  }, [])

  const openDetailFor = useCallback(
    (el) => {
      const id = Number(el.id)
      const nextSource =
        myTeamLeagueEntryId != null
          ? { kind: 'fantasy', id: Number(myTeamLeagueEntryId) }
          : null
      const rosterIds =
        nextSource?.kind === 'fantasy'
          ? rosterIdsForLeagueEntry(nextSource.id, ownerByElementId)
          : new Set()
      const pick =
        nextSource != null
          ? suggestBenchTarget([...rosterIds], elemsById, el)
          : null
      setCompareSource(nextSource)
      setDetailPlayerId(id)
      setBenchId(pick)
      const hashSlice = { waiver: id, bench: pick }
      if (nextSource?.kind === 'fantasy') {
        hashSlice.teamId = nextSource.id
      }
      detailHistoryPushedRef.current = pushPlayersHash(hashSlice)
    },
    [elemsById, ownerByElementId, myTeamLeagueEntryId],
  )

  const closeDetail = useCallback(() => {
    const hadHistoryEntry = detailHistoryPushedRef.current
    detailHistoryPushedRef.current = false
    setDetailPlayerId(null)
    setBenchId(null)
    setCompareSource(null)
    if (hadHistoryEntry) {
      window.history.back()
    }
  }, [])

  useEffect(() => {
    if (detailPlayerId == null || !detailPlayerEl) return
    const squadIds = new Set(compareSquadOptions.map((o) => o.id))
    const searchIds = new Set(compareSearchOptions.map((o) => o.id))
    const validIds = compareSource ? squadIds : searchIds
    if (benchId != null && !validIds.has(benchId)) {
      setBenchId(null)
      return
    }
    if (compareSource?.kind === 'fantasy' && benchId == null) {
      const rosterIds = rosterIdsForLeagueEntry(compareSource.id, ownerByElementId)
      const pick = suggestBenchTarget([...rosterIds], elemsById, detailPlayerEl)
      setBenchId(pick)
    }
  }, [
    compareSource,
    compareSquadOptions,
    compareSearchOptions,
    ownerByElementId,
    detailPlayerId,
    detailPlayerEl,
    benchId,
    elemsById,
  ])

  return (
    <section
      className={`tile tile--standings players-bench-tile${portrait && detailPlayerId == null ? ' players-bench-tile--portrait-list' : ''}${detailPlayerId != null ? ' players-bench-tile--detail' : ''}`}
      aria-label={detailPlayerId != null ? 'Player detail' : 'Players wire list'}
    >
      {detailPlayerId != null && detailPlayerEl ? (
        <PlayerDetailView
          playerId={detailPlayerId}
          benchId={benchId}
          onBenchChange={setBenchId}
          onBack={closeDetail}
          playerEl={detailPlayerEl}
          benchEl={benchEl}
          teamById={teamById}
          teamsForFormSelect={teamsForFormSelect}
          plClubs={clubOptions}
          compareSource={compareSource}
          onCompareSourceChange={setCompareSource}
          compareSearchOptions={compareSearchOptions}
          compareSquadOptions={compareSquadOptions}
          onSearchBenchSelect={handleSearchBenchSelect}
          logoMap={logoMap}
          kitIndexByEntry={kitIndexByEntry}
          ownerByElementId={ownerByElementId}
          rostersHealthy={rostersHealthy}
          plFixtures={plFixtures}
        />
      ) : (
        <>
      {squadsErr ? (
        <p className="players-bench-banner" role="alert">
          Could not load player data. {squadsErr}
        </p>
      ) : null}

      <div className="players-bench-chrome section-chrome section-chrome--sticky">
      <div className="team-selection-submenu players-bench-pos-filter">
        <div className="players-bench-filter-pills">
          {portrait ? (
            <PositionFilterPill
              positionFilter={positionFilter}
              onSelect={setPositionFilter}
              compact={portrait}
            />
          ) : (
            <div className="players-bench-pos-tabs" role="tablist" aria-label="Filter by position">
              {WIRE_POSITION_PILLS.map((pill) => {
                const active = positionFilter === pill.id
                return (
                  <button
                    key={pill.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`team-selection-submenu__btn${
                      active ? ' team-selection-submenu__btn--active' : ''
                    }`}
                    onClick={() => setPositionFilter(pill.id)}
                  >
                    {pill.label}
                  </button>
                )
              })}
            </div>
          )}
          <ClubFilterPill
            clubFilter={clubFilter}
            clubOptions={clubOptions}
            onSelect={setClubFilter}
            compact={portrait}
          />
          <FantasyTeamPill
            teams={teamsForFormSelect}
            selectedId={myTeamLeagueEntryId}
            onSelect={setMyTeamLeagueEntryId}
            logoMap={logoMap}
            kitIndexByEntry={kitIndexByEntry}
            compact={portrait}
          />
          <StatsColumnsPill
            selectedIds={selectedStatIds}
            onChange={handleStatSelectionChange}
            positionFilter={positionFilter}
            maxStatColumns={statColumnMax ?? 8}
            compact={portrait}
          />
        </div>
        <div className="players-bench-toolbar-tail">
          <label className="players-bench-field players-bench-field--search">
            <input
              type="search"
              placeholder="👀 …"
              className="players-bench-search"
              enterKeyHint="search"
              aria-label="Search players"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label
            className={`players-bench-toggle${!rostersHealthy ? ' players-bench-toggle--disabled' : ''}`}
          >
            <input
              type="checkbox"
              className="players-bench-toggle__input"
              role="switch"
              checked={availableOnly}
              disabled={!rostersHealthy}
              onChange={(ev) => setAvailableOnly(ev.target.checked)}
            />
            <span className="players-bench-toggle__track" aria-hidden="true">
              <span className="players-bench-toggle__thumb" />
            </span>
            <span className="players-bench-toggle__label">
              {portrait ? 'Avail.' : 'Available only'}
              {!rostersHealthy ? (portrait ? '' : ' (needs rosters)') : ''}
            </span>
          </label>
        </div>
      </div>
      </div>

      <div className="players-table-scroll">
        <div
          className={`players-table players-table--wide${portrait ? ' players-table--portrait' : ''}`}
          role="table"
          aria-label="Waiver wire players"
          style={{ '--wire-cols': tableGridTemplate }}
        >
          <div className="players-table__head" role="rowgroup">
            <div className="players-table__head-row" role="row">
            {visibleCols.map((col, colIndex) => {
              const colSortKey = wireColumnToSortKey(col.id)
              const isActive = col.id === activeSortColId
              const groupStart = wireColumnIsGroupStart(col.id, visibleCols, colIndex)
              const ariaSort = isActive
                ? sortDir === 'asc'
                  ? 'ascending'
                  : 'descending'
                : colSortKey
                  ? 'none'
                  : undefined
              const thClass = [
                'players-table__th',
                col.id === 'player' ? 'players-table__th--player' : '',
                col.id === 'detail' ? 'players-table__th--detail' : '',
                col.id === 'pts' ? 'players-table__th--pts' : '',
                col.id === 'next3' ? 'players-table__th--next3' : '',
                isActive ? ' players-table__th--sorted' : '',
                groupStart ? 'players-table__col--group-start' : '',
              ]
                .filter(Boolean)
                .join(' ')

              if (!colSortKey) {
                return (
                  <span key={col.id} className={thClass} role="columnheader" title={col.title}>
                    {col.label}
                  </span>
                )
              }

              return (
                <button
                  key={col.id}
                  type="button"
                  className={`${thClass} players-table__th-btn`}
                  role="columnheader"
                  aria-sort={ariaSort}
                  title={col.title ? `${col.title} · click to sort` : 'Click to sort'}
                  onClick={() => handleColumnSort(col.id)}
                >
                  <span className="players-table__th-label">{col.label}</span>
                  {!mobileLayout ? (
                    isActive ? (
                      <span className="players-table__sort-indicator" aria-hidden>
                        {sortDir === 'asc' ? '↑' : '↓'}
                      </span>
                    ) : (
                      <span
                        className="players-table__sort-indicator players-table__sort-indicator--idle"
                        aria-hidden
                      >
                        ↕
                      </span>
                    )
                  ) : null}
                </button>
              )
            })}
            </div>
          </div>

          <div className="players-table__body" role="rowgroup">
            {(bootstrap ? outfieldList : []).map((el) => {
              const row = enrichElementRow(el, teamById)
              const elId = Number(el.id)
              const summary = summaryByElement.get(elId)
              const nextFixtures = nextFixturesByTeam.get(Number(el.team)) ?? []

              return (
                <div
                  key={el.id}
                  className={`players-table__row${detailPlayerId === el.id ? ' players-table__row--active' : ''}${portrait ? ' players-table__row--tappable' : ''}`}
                  role="row"
                  tabIndex={portrait ? 0 : undefined}
                  onClick={portrait ? () => openDetailFor(el) : undefined}
                  onKeyDown={
                    portrait
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            openDetailFor(el)
                          }
                        }
                      : undefined
                  }
                >
                  {visibleCols.map((col, colIndex) => {
                    const groupStart = wireColumnIsGroupStart(col.id, visibleCols, colIndex)
                    if (col.id === 'player') {
                      return (
                        <span
                          key={col.id}
                          className={wireCellClass(
                            col.id,
                            activeSortColId,
                            'players-table__cell--player',
                            groupStart,
                          )}
                          role="cell"
                        >
                          <span className="players-table__kit">
                            <PlayerKit
                              badgeUrl={row.badgeUrl}
                              teamShort={row.teamShort}
                            />
                          </span>
                          <span className="players-table__player-text">
                            <span className="players-table__name-row">
                              <span className="players-table__name">
                                {fplElementDisplayName(el, el.id)}
                              </span>
                              <PlayerAvailabilityMark el={el} />
                            </span>
                          </span>
                        </span>
                      )
                    }
                    if (col.id === 'detail') {
                      return (
                        <span
                          key={col.id}
                          className={wireCellClass(
                            col.id,
                            activeSortColId,
                            'players-table__cell--detail',
                            groupStart,
                          )}
                          role="cell"
                        >
                          <button
                            type="button"
                            className="players-table__detail-btn"
                            aria-label={`Details for ${fplElementDisplayName(el, el.id)}`}
                            title="Player detail"
                            onClick={(e) => {
                              e.stopPropagation()
                              openDetailFor(el)
                            }}
                          >
                            <span className="players-table__detail-btn-emoji" aria-hidden>
                              🔍
                            </span>
                          </button>
                        </span>
                      )
                    }
                    if (col.id === 'pts') {
                      const owner = ownerByElementId.get(elId)
                      const pts = Number.isFinite(Number(el.total_points)) ? el.total_points : '—'
                      return (
                        <span
                          key={col.id}
                          className={wireCellClass(
                            col.id,
                            activeSortColId,
                            'players-table__cell--pts',
                            groupStart,
                          )}
                          role="cell"
                        >
                          <span className="players-table__pts-value tabular">{pts}</span>
                          {rostersHealthy && owner ? (
                            <TeamAvatar
                              entryId={owner.leagueEntryId}
                              name={owner.teamName}
                              size="sm"
                              logoMap={logoMap}
                              kitIndexByEntry={kitIndexByEntry}
                              badgeFallback
                            />
                          ) : null}
                        </span>
                      )
                    }
                    if (WIRE_STAT_CATALOG[col.id]) {
                      const statDef = WIRE_STAT_CATALOG[col.id]
                      return (
                        <span
                          key={col.id}
                          className={wireCellClass(col.id, activeSortColId, 'tabular', groupStart)}
                          role="cell"
                          title={statDef.title}
                        >
                          {formatWireStatValue(col.id, el, summary, summaryLoading, {
                            portraitPosAbbrev:
                              portrait && positionFilter === POS_FILTER_ALL && col.id === 'pos',
                          })}
                        </span>
                      )
                    }
                    if (col.id === 'next3') {
                      return (
                        <span
                          key={col.id}
                          className={wireCellClass(
                            col.id,
                            activeSortColId,
                            'players-table__cell--next3',
                            groupStart,
                          )}
                          role="cell"
                        >
                          <NextFixtureBadges
                            fixtures={nextFixtures}
                            nextOnly={portrait}
                          />
                        </span>
                      )
                    }
                    return null
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {!bootstrap ? (
        <p className="muted players-bench-loading">Loading waiver pool…</p>
      ) : null}
        </>
      )}
    </section>
  )
}

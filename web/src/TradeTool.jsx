import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CompactSelectPill } from './CompactSelectPill.jsx'
import { PlayerKit } from './PlayerKit.jsx'
import { TeamAvatar } from './TeamAvatar.jsx'
import { TradeRadar } from './TradeRadar.jsx'
import { fplElementWebName } from './fplElementNames.js'
import { fplShirtImageUrl } from './fplShirtUrl.js'
import {
  fetchBootstrapDraft,
  fetchLeagueJsonFile,
} from './playersBenchShared.js'
import {
  POS_LABEL,
  buildOwnerByElementFromElementStatus,
  wireStatsMapFromPayload,
} from './playersWireList.js'
import { archivedSeasonLabel } from './seasonArchive.js'
import {
  DEFAULT_TRADE_STAT_IDS,
  TRADE_MAX_STATS,
  TRADE_MIN_STATS,
  TRADE_STAT_CATALOG,
  TRADE_STAT_GROUPS,
  aggregateSideStats,
  applyTradePick,
  buildRadarAxes,
  encodeTradeSource,
  canAddTradePosition,
  filterSquadByQuery,
  filterSquadByPosition,
  filterSquadForTrade,
  formatTradePositionNeeds,
  formatTradeStat,
  indexElementsByCode,
  joinPriorByCode,
  missingTradePositions,
  normalizeTradeStatSelection,
  tradePositionCounts,
  tradePositionsMatch,
  parseTradeSource,
  seasonShortLabel,
  toggleTradeStat,
} from './tradeToolStats.js'
import { useMobileLayout } from './usePortraitMobile.js'
import { usePillMenuDismiss } from './usePillMenuDismiss.js'
import './TradeTool.css'

const POSITION_ORDER = /** @type {(1|2|3|4)[]} */ ([1, 2, 3, 4])

function badgeUrlFor(team) {
  return team?.code != null
    ? `https://resources.premierleague.com/premierleague/badges/50/t${team.code}.png`
    : null
}

async function fetchOptionalUrl(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function sortTradePlayers(list) {
  list.sort(
    (a, b) =>
      a.positionType - b.positionType ||
      b.seasonPoints - a.seasonPoints ||
      a.name.localeCompare(b.name),
  )
}

function toTradePlayer(el, teamById, priorByCode, currentSummary, priorSummaryById) {
  const pid = Number(el?.id)
  if (!Number.isFinite(pid)) return null
  const type = /** @type {1|2|3|4} */ (Number(el.element_type))
  if (!POSITION_ORDER.includes(type)) return null
  const plTeam = teamById.get(Number(el.team))
  const priorEl = joinPriorByCode(el, priorByCode)
  const priorSummary =
    priorEl != null ? priorSummaryById.get(Number(priorEl.id)) ?? null : null
  return {
    element: pid,
    name: fplElementWebName(el, pid),
    positionType: type,
    seasonPoints: Number(el.total_points) || 0,
    teamShort: plTeam?.short_name != null ? String(plTeam.short_name) : null,
    badgeUrl: badgeUrlFor(plTeam),
    shirtUrl: fplShirtImageUrl(plTeam?.code, el.element_type),
    currentEl: el,
    priorEl,
    currentSummary: currentSummary.get(pid) ?? null,
    priorSummary,
    hasPrior: Boolean(priorEl),
  }
}

/**
 * Current-season bootstrap + ownership, plus optional prior-season bootstrap
 * joined later via Opta `code`. Also indexes every PL club's full squad.
 */
function useTradeToolData({
  enabled,
  leagueEntries,
  leagueDataRevision,
  priorSeasonLabel,
}) {
  const [state, setState] = useState({
    status: 'idle',
    error: null,
    squadsByEntry: new Map(),
    squadsByClub: new Map(),
    clubs: [],
    hasPrior: false,
  })
  const reqRef = useRef(0)

  useEffect(() => {
    if (!enabled) return undefined
    const reqId = (reqRef.current += 1)
    setState((s) => ({ ...s, status: 'loading', error: null }))

    ;(async () => {
      try {
        const cacheKey = String(leagueDataRevision ?? '').trim()
        const viewingPrior =
          priorSeasonLabel && archivedSeasonLabel() === priorSeasonLabel
        const priorBase =
          priorSeasonLabel && !viewingPrior
            ? `${import.meta.env.BASE_URL}league-data/seasons/${priorSeasonLabel}`
            : null
        const priorQs = cacheKey ? `?v=${encodeURIComponent(cacheKey)}` : ''

        const [boot, statusPayload, wireStats, priorBoot, priorWire] =
          await Promise.all([
            fetchBootstrapDraft(cacheKey),
            fetchLeagueJsonFile('element_status.json', cacheKey),
            fetchLeagueJsonFile('player-wire-stats.json', cacheKey).catch(
              () => null,
            ),
            priorBase
              ? fetchOptionalUrl(`${priorBase}/bootstrap_draft.json${priorQs}`)
              : Promise.resolve(null),
            priorBase
              ? fetchOptionalUrl(`${priorBase}/player-wire-stats.json${priorQs}`)
              : Promise.resolve(null),
          ])
        if (reqRef.current !== reqId) return

        const teamById = new Map()
        for (const t of boot?.teams || []) {
          teamById.set(Number(t.id), t)
        }
        const priorByCode = indexElementsByCode(priorBoot?.elements || [])
        const currentSummary = wireStatsMapFromPayload(wireStats)
        const priorSummaryById = wireStatsMapFromPayload(priorWire)

        const teamsForOwner = (leagueEntries || []).map((e) => ({
          id: e.id,
          fplEntryId: e.entry_id,
          teamName: e.entry_name,
        }))
        const ownerByElement = buildOwnerByElementFromElementStatus(
          statusPayload,
          teamsForOwner,
        )

        const elemsById = new Map()
        const byClub = new Map()
        for (const t of boot?.teams || []) {
          byClub.set(Number(t.id), [])
        }
        for (const el of boot?.elements || []) {
          const pid = Number(el.id)
          elemsById.set(pid, el)
          const player = toTradePlayer(
            el,
            teamById,
            priorByCode,
            currentSummary,
            priorSummaryById,
          )
          if (!player) continue
          const clubId = Number(el.team)
          if (byClub.has(clubId)) byClub.get(clubId).push(player)
        }
        for (const list of byClub.values()) sortTradePlayers(list)

        const byEntry = new Map()
        for (const e of leagueEntries || []) {
          byEntry.set(Number(e.id), [])
        }
        for (const [pid, owner] of ownerByElement) {
          const lid = Number(owner.leagueEntryId)
          if (!byEntry.has(lid)) continue
          const el = elemsById.get(Number(pid))
          if (!el) continue
          const player = toTradePlayer(
            el,
            teamById,
            priorByCode,
            currentSummary,
            priorSummaryById,
          )
          if (player) byEntry.get(lid).push(player)
        }
        for (const list of byEntry.values()) sortTradePlayers(list)

        const clubs = [...(boot?.teams || [])]
          .map((t) => ({
            id: Number(t.id),
            name: String(t.name || t.short_name || `Club ${t.id}`),
            short_name: t.short_name != null ? String(t.short_name) : null,
            code: t.code,
          }))
          .filter((t) => Number.isFinite(t.id))
          .sort((a, b) => a.name.localeCompare(b.name))

        setState({
          status: 'ready',
          error: null,
          squadsByEntry: byEntry,
          squadsByClub: byClub,
          clubs,
          hasPrior: priorByCode.size > 0,
        })
      } catch (err) {
        if (reqRef.current !== reqId) return
        setState({
          status: 'error',
          error: err?.message || String(err),
          squadsByEntry: new Map(),
          squadsByClub: new Map(),
          clubs: [],
          hasPrior: false,
        })
      }
    })()

    return undefined
  }, [enabled, leagueEntries, leagueDataRevision, priorSeasonLabel])

  return state
}

function TradeStatsPanel({ selection, onChange, sheet, onClose }) {
  return (
    <div
      className={
        sheet ? 'trade-tool__stats-sheet' : 'trade-tool__stats-panel'
      }
      role="dialog"
      aria-label="Radar stats"
    >
      <div className="trade-tool__stats-head">
        <span>Radar axes</span>
        <span className="muted">
          {selection.length} of {TRADE_MAX_STATS} · min {TRADE_MIN_STATS}
        </span>
        {sheet ? (
          <button
            type="button"
            className="trade-tool__stats-close"
            aria-label="Close stats"
            onClick={onClose}
          >
            ×
          </button>
        ) : null}
      </div>
      {TRADE_STAT_GROUPS.map((group) => (
        <section key={group.id} className="trade-tool__stats-group">
          <h4>{group.label}</h4>
          <div className="trade-tool__stats-grid">
            {Object.values(TRADE_STAT_CATALOG)
              .filter((s) => s.group === group.id)
              .map((stat) => {
                const checked = selection.includes(stat.id)
                const blocked =
                  (!checked && selection.length >= TRADE_MAX_STATS) ||
                  (checked && selection.length <= TRADE_MIN_STATS)
                return (
                  <label
                    key={stat.id}
                    className={
                      'trade-tool__stats-opt' +
                      (checked ? ' is-checked' : '') +
                      (blocked && !checked ? ' is-disabled' : '')
                    }
                    title={stat.title}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={blocked && !checked}
                      onChange={() => onChange(toggleTradeStat(selection, stat.id))}
                    />
                    {stat.label}
                  </label>
                )
              })}
          </div>
        </section>
      ))}
    </div>
  )
}

function TradeStatsPill({ selectedIds, onChange, sheet }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const selection = normalizeTradeStatSelection(selectedIds)
  const dismiss = useCallback(() => setOpen(false), [])
  usePillMenuDismiss(rootRef, open && !sheet, dismiss)

  useEffect(() => {
    if (!open || !sheet) return undefined
    const onKey = (ev) => {
      if (ev.key === 'Escape') dismiss()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [open, sheet, dismiss])

  const panel = (
    <TradeStatsPanel
      selection={selection}
      onChange={onChange}
      sheet={sheet}
      onClose={dismiss}
    />
  )

  return (
    <div className="trade-tool__stats-pill" ref={rootRef}>
      <button
        type="button"
        className={
          'cpsp__btn trade-tool__stats-btn' + (open ? ' cpsp__btn--open' : '')
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Radar stats, ${selection.length} of ${TRADE_MAX_STATS} selected`}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden>Stats</span>
        <span className="trade-tool__stats-count">
          {selection.length}/{TRADE_MAX_STATS}
        </span>
      </button>
      {open && !sheet ? panel : null}
      {open && sheet && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="trade-tool__stats-overlay"
              data-theme={
                document.querySelector('.fotmob')?.getAttribute('data-theme') ||
                undefined
              }
            >
              <button
                type="button"
                className="trade-tool__stats-backdrop"
                aria-label="Close stats"
                onClick={dismiss}
              />
              {panel}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

/** First word of a club name, so the stat-table header can sit beside a badge. */
function teamFirstName(name) {
  const trimmed = String(name ?? '').trim()
  return trimmed.split(/\s+/)[0] || trimmed
}

function TradeTableHead({
  label,
  asTeam,
  source,
  clubs,
  teamLogoMap,
  kitIndexByEntry,
}) {
  if (!asTeam) {
    return (
      <span className="trade-tool__th-name" title={label}>
        {label}
      </span>
    )
  }
  const parsed = parseTradeSource(source)
  const short = teamFirstName(label)
  const club =
    parsed?.kind === 'club'
      ? clubs.find((c) => c.id === parsed.id) ?? null
      : null
  return (
    <span className="trade-tool__th-team" title={label}>
      {parsed?.kind === 'entry' ? (
        <TeamAvatar
          entryId={parsed.id}
          name={label}
          size="sm"
          logoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
          badgeFallback
        />
      ) : parsed?.kind === 'club' ? (
        <ClubCrest
          badgeUrl={badgeUrlFor(club)}
          fallback={(club?.short_name || short).slice(0, 3)}
        />
      ) : null}
      <span className="trade-tool__th-name">{short}</span>
    </span>
  )
}

function ClubCrest({ badgeUrl, fallback }) {
  return (
    <span className="trade-tool__club-crest" aria-hidden>
      {badgeUrl ? (
        <img src={badgeUrl} alt="" width={28} height={28} loading="lazy" />
      ) : (
        <span className="trade-tool__club-crest-fallback">{fallback ?? '?'}</span>
      )}
    </span>
  )
}

function playersInPickOrder(ids, pool) {
  const byId = new Map()
  for (const p of pool || []) byId.set(Number(p.element), p)
  return (ids || []).map((id) => byId.get(Number(id))).filter(Boolean)
}

function squadForSource(source, squadsByEntry, squadsByClub) {
  const parsed = parseTradeSource(source)
  if (!parsed) return []
  if (parsed.kind === 'entry') return squadsByEntry.get(parsed.id) || []
  return squadsByClub.get(parsed.id) || []
}

function sourceDisplayName(source, managers, clubs, fallback) {
  const parsed = parseTradeSource(source)
  if (!parsed) return fallback
  if (parsed.kind === 'entry') {
    return (
      managers.find((m) => Number(m.id) === parsed.id)?.entry_name || fallback
    )
  }
  const club = clubs.find((c) => c.id === parsed.id)
  return club?.name || club?.short_name || fallback
}

function PickedChip({ player, side, onRemove }) {
  return (
    <span className={`trade-tool__chip trade-tool__chip--${side}`}>
      <PlayerKit badgeUrl={player.badgeUrl} teamShort={player.teamShort} />
      <span className="trade-tool__chip-name">{player.name}</span>
      <span className="trade-tool__chip-pos">{POS_LABEL[player.positionType]}</span>
      <button
        type="button"
        className="trade-tool__chip-x"
        aria-label={`Remove ${player.name}`}
        onClick={() => onRemove(player.element)}
      >
        ×
      </button>
    </span>
  )
}

function SquadRow({ player, selected, side, onToggle, missingPrior, seasonMode }) {
  return (
    <div
      className={
        'trade-tool__row' +
        (selected ? ` is-selected is-selected--${side}` : '')
      }
    >
      <button
        type="button"
        className="trade-tool__row-hit"
        aria-pressed={selected}
        onClick={() => onToggle(player.element)}
      >
        <PlayerKit
          shirtUrl={player.shirtUrl}
          badgeUrl={player.badgeUrl}
          teamShort={player.teamShort}
        />
        <span className="trade-tool__row-id">
          <span className="trade-tool__row-name">{player.name}</span>
          <span className="trade-tool__row-meta">
            <span className={`trade-tool__pos trade-tool__pos--${POS_LABEL[player.positionType]}`}>
              {POS_LABEL[player.positionType]}
            </span>
            {player.teamShort ? <span>{player.teamShort}</span> : null}
            {missingPrior && seasonMode !== 'current' ? (
              <span className="trade-tool__no-prior">no 25/26</span>
            ) : null}
          </span>
        </span>
        <span className="trade-tool__row-pts tabular">{player.seasonPoints}</span>
      </button>
      {selected ? (
        <button
          type="button"
          className="trade-tool__row-x"
          aria-label={`Remove ${player.name}`}
          onClick={() => onToggle(player.element)}
        >
          ×
        </button>
      ) : null}
    </div>
  )
}

/**
 * Manager-vs-manager trade builder. Analyzer only — nothing is sent to FPL.
 * Any number of players per side; the other side has to match positions.
 *
 * @param {{
 *   leagueEntries: object[],
 *   teamLogoMap: Record<string, string>,
 *   kitIndexByEntry: Record<string, number>,
 *   leagueDataRevision?: string,
 *   currentSeasonLabel?: string,
 *   priorSeasonLabel?: string | null,
 * }} props
 */
export function TradeTool({
  leagueEntries = [],
  teamLogoMap = {},
  kitIndexByEntry = {},
  leagueDataRevision = '',
  currentSeasonLabel = '',
  priorSeasonLabel = null,
}) {
  const { status, error, squadsByEntry, squadsByClub, clubs, hasPrior } =
    useTradeToolData({
      enabled: true,
      leagueEntries,
      leagueDataRevision,
      priorSeasonLabel,
    })

  const managers = useMemo(() => {
    return [...(leagueEntries || [])]
      .filter((e) => e?.id != null)
      .sort((a, b) =>
        String(a.entry_name || '').localeCompare(String(b.entry_name || '')),
      )
  }, [leagueEntries])

  const sourceOptions = useMemo(() => {
    const fantasy = managers.map((m) => ({
      value: encodeTradeSource('entry', m.id),
      label: m.entry_name || `Team ${m.id}`,
      group: 'Fantasy',
    }))
    const clubOpts = (clubs || []).map((c) => ({
      value: encodeTradeSource('club', c.id),
      label: c.name,
      group: 'Clubs',
    }))
    return [...fantasy, ...clubOpts]
  }, [managers, clubs])

  const [sourceA, setSourceA] = useState('')
  const [sourceB, setSourceB] = useState('')
  const [positionA, setPositionA] = useState(/** @type {'' | 1 | 2 | 3 | 4} */ (''))
  const [positionB, setPositionB] = useState(/** @type {'' | 1 | 2 | 3 | 4} */ (''))
  const [idsA, setIdsA] = useState(/** @type {number[]} */ ([]))
  const [idsB, setIdsB] = useState(/** @type {number[]} */ ([]))
  const [queryA, setQueryA] = useState('')
  const [queryB, setQueryB] = useState('')
  const [seasonMode, setSeasonMode] = useState(
    /** @type {'current' | 'prior' | 'combined'} */ ('current'),
  )
  const [statIds, setStatIds] = useState(() => [...DEFAULT_TRADE_STAT_IDS])
  const mobileLayout = useMobileLayout()

  const allPlayers = useMemo(() => {
    const byId = new Map()
    for (const list of squadsByClub.values()) {
      for (const p of list || []) {
        const id = Number(p.element)
        if (Number.isFinite(id) && !byId.has(id)) byId.set(id, p)
      }
    }
    return [...byId.values()]
  }, [squadsByClub])

  const pickSource = (side, raw) => {
    const next = parseTradeSource(raw)
    if (!next) return
    const encoded = encodeTradeSource(next.kind, next.id)
    const otherRaw = side === 'a' ? sourceB : sourceA
    const other = parseTradeSource(otherRaw)
    const sameFantasyEntry =
      next.kind === 'entry' &&
      other?.kind === 'entry' &&
      other.id === next.id
    if (side === 'a') {
      setSourceA(encoded)
      setIdsA([])
      setQueryA('')
      if (sameFantasyEntry) {
        setSourceB('')
        setIdsB([])
        setQueryB('')
      }
    } else {
      setSourceB(encoded)
      setIdsB([])
      setQueryB('')
      if (sameFantasyEntry) {
        setSourceA('')
        setIdsA([])
        setQueryA('')
      }
    }
  }

  const clearSource = (side) => {
    if (side === 'a') {
      setSourceA('')
      setIdsA([])
      setQueryA('')
    } else {
      setSourceB('')
      setIdsB([])
      setQueryB('')
    }
  }

  const parsedA = parseTradeSource(sourceA)
  const parsedB = parseTradeSource(sourceB)
  const squadA = squadForSource(sourceA, squadsByEntry, squadsByClub)
  const squadB = squadForSource(sourceB, squadsByEntry, squadsByClub)
  const poolA = parsedA ? squadA : allPlayers
  const poolB = parsedB ? squadB : allPlayers
  const pickedA = useMemo(
    () => playersInPickOrder(idsA, poolA),
    [idsA, poolA],
  )
  const pickedB = useMemo(
    () => playersInPickOrder(idsB, poolB),
    [idsB, poolB],
  )
  const countsA = useMemo(() => tradePositionCounts(pickedA), [pickedA])
  const countsB = useMemo(() => tradePositionCounts(pickedB), [pickedB])
  const needsA = missingTradePositions(countsA, countsB)
  const needsB = missingTradePositions(countsB, countsA)
  const positionsMatched =
    pickedA.length > 0 &&
    pickedB.length > 0 &&
    tradePositionsMatch(countsA, countsB)
  const browseA =
    parsedA || queryA.trim() || positionA ? (parsedA ? squadA : allPlayers) : []
  const browseB =
    parsedB || queryB.trim() || positionB ? (parsedB ? squadB : allPlayers) : []
  const visibleA = filterSquadForTrade(
    filterSquadByPosition(filterSquadByQuery(browseA, queryA), positionA),
    { sideCounts: countsA, otherCounts: countsB, selectedIds: idsA },
  )
  const visibleB = filterSquadForTrade(
    filterSquadByPosition(filterSquadByQuery(browseB, queryB), positionB),
    { sideCounts: countsB, otherCounts: countsA, selectedIds: idsB },
  )

  const pickPosition = (side, raw) => {
    const pos = /** @type {1 | 2 | 3 | 4} */ (Number(raw))
    if (!POSITION_ORDER.includes(pos)) return
    const sideCounts = side === 'a' ? countsA : countsB
    const otherCounts = side === 'a' ? countsB : countsA
    if (!canAddTradePosition(sideCounts, otherCounts, pos)) return
    if (side === 'a') setPositionA(pos)
    else setPositionB(pos)
  }

  const clearPosition = (side) => {
    if (side === 'a') setPositionA('')
    else setPositionB('')
  }

  const togglePlayer = (side, elementId) => {
    const next = applyTradePick({
      idsA,
      idsB,
      squadA: poolA,
      squadB: poolB,
      side,
      elementId,
    })
    const nextCountsA = tradePositionCounts(playersInPickOrder(next.idsA, poolA))
    const nextCountsB = tradePositionCounts(playersInPickOrder(next.idsB, poolB))
    setIdsA(next.idsA)
    setIdsB(next.idsB)
    if (positionA && !canAddTradePosition(nextCountsA, nextCountsB, positionA)) {
      setPositionA('')
    }
    if (positionB && !canAddTradePosition(nextCountsB, nextCountsA, positionB)) {
      setPositionB('')
    }
  }

  const sideAStats = useMemo(
    () => aggregateSideStats(pickedA, statIds, seasonMode),
    [pickedA, statIds, seasonMode],
  )
  const sideBStats = useMemo(
    () => aggregateSideStats(pickedB, statIds, seasonMode),
    [pickedB, statIds, seasonMode],
  )
  const axes = useMemo(
    () => buildRadarAxes(statIds, sideAStats, sideBStats),
    [statIds, sideAStats, sideBStats],
  )

  const nameA = sourceDisplayName(sourceA, managers, clubs, 'Side A')
  const nameB = sourceDisplayName(sourceB, managers, clubs, 'Side B')
  const compareA = pickedA.length > 1 ? nameA : pickedA[0]?.name || nameA
  const compareB = pickedB.length > 1 ? nameB : pickedB[0]?.name || nameB
  const currentShort = seasonShortLabel(currentSeasonLabel) || 'This season'
  const priorShort = seasonShortLabel(priorSeasonLabel) || 'Last season'
  const showRadar = positionsMatched
  const needLabelA = formatTradePositionNeeds(needsA, (t) => POS_LABEL[t])
  const needLabelB = formatTradePositionNeeds(needsB, (t) => POS_LABEL[t])

  const renderSquad = (side) => {
    const source = side === 'a' ? sourceA : sourceB
    const parsed = side === 'a' ? parsedA : parsedB
    const selected = side === 'a' ? idsA : idsB
    const query = side === 'a' ? queryA : queryB
    const setQuery = side === 'a' ? setQueryA : setQueryB
    const position = side === 'a' ? positionA : positionB
    const visible = side === 'a' ? visibleA : visibleB
    const groups = POSITION_ORDER.map((type) => ({
      type,
      label: POS_LABEL[type],
      players: visible.filter((p) => p.positionType === type),
    })).filter((g) => g.players.length)
    const hasTeam = parsed != null
    const hasQuery = Boolean(query.trim())
    const hasPosition = position !== ''
    const posLabel = hasPosition ? POS_LABEL[position] : null
    const sideCounts = side === 'a' ? countsA : countsB
    const otherCounts = side === 'a' ? countsB : countsA
    const needLabel = side === 'a' ? needLabelA : needLabelB
    const club =
      parsed?.kind === 'club'
        ? clubs.find((c) => c.id === parsed.id) ?? null
        : null
    const positionOptions = POSITION_ORDER.map((type) => ({
      value: String(type),
      label: POS_LABEL[type],
      disabled: !canAddTradePosition(sideCounts, otherCounts, type),
    }))

    return (
      <div className={`trade-tool__side trade-tool__side--${side}`}>
        <div className="trade-tool__side-head">
          {parsed?.kind === 'entry' ? (
            <TeamAvatar
              entryId={parsed.id}
              name={side === 'a' ? nameA : nameB}
              size="sm"
              logoMap={teamLogoMap}
              kitIndexByEntry={kitIndexByEntry}
            />
          ) : null}
          {parsed?.kind === 'club' ? (
            <ClubCrest
              badgeUrl={badgeUrlFor(club)}
              fallback={club?.short_name?.slice(0, 3)}
            />
          ) : null}
          <div className="trade-tool__picks">
            <CompactSelectPill
              ariaLabel={side === 'a' ? 'Give team or club' : 'Get team or club'}
              value={source}
              onChange={(v) => pickSource(side, v)}
              onClear={() => clearSource(side)}
              options={sourceOptions}
              placeholder="Pick a team"
              isActive={hasTeam}
              menuMaxWidth={280}
            />
            <CompactSelectPill
              ariaLabel={side === 'a' ? 'Give position' : 'Get position'}
              value={position === '' ? '' : String(position)}
              onChange={(v) => pickPosition(side, v)}
              onClear={() => clearPosition(side)}
              options={positionOptions}
              placeholder="Pick a position"
              isActive={hasPosition}
            />
          </div>
          <label className="trade-tool__search">
            <span className="visually-hidden">Search player</span>
            <input
              type="search"
              className="trade-tool__search-input"
              placeholder="Search player"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              enterKeyHint="search"
            />
          </label>
        </div>
        {!hasTeam && !hasQuery && !hasPosition ? (
          <p className="muted muted--tight">
            Pick a team, a position, or search a player.
          </p>
        ) : status === 'loading' ? (
          <p className="muted muted--tight">Loading squad…</p>
        ) : !groups.length ? (
          <p className="muted muted--tight">
            {hasQuery
              ? 'No matching player.'
              : needLabel && hasTeam
                ? `No ${needLabel} on this squad.`
                : needLabel
                  ? `Match positions · ${needLabel}.`
                  : hasPosition && hasTeam
                    ? `No ${posLabel} on this squad.`
                    : hasPosition
                      ? `No ${posLabel} players.`
                      : 'No squad on record yet.'}
          </p>
        ) : (
          <div className="trade-tool__roster">
            {needLabel ? (
              <p className="trade-tool__lock-hint">Match positions · {needLabel}</p>
            ) : null}
            {groups.map((g) => (
              <div key={g.type} className="trade-tool__pos-block">
                <div className="trade-tool__pos-h">{g.label}</div>
                {g.players.map((p) => (
                  <SquadRow
                    key={p.element}
                    player={p}
                    selected={selected.includes(p.element)}
                    side={side}
                    onToggle={(id) => togglePlayer(side, id)}
                    missingPrior={!p.hasPrior}
                    seasonMode={seasonMode}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="dashboard-stack">
      <section className="tile tile--compact" aria-labelledby="trade-tool-heading">
        <div className="tile-head-row tile-head-row--tight">
          <h2 id="trade-tool-heading" className="tile-title tile-title--sm">
            Trade Tool
          </h2>
        </div>
        <p className="tile-hint muted tile-hint--tight">
          Pick any players from one team. The other side has to match those
          positions — a mid and a forward need a mid and a forward back.
          Nothing is sent to FPL Draft. Agree the deal, then offer it in the
          official app.
        </p>

        {status === 'error' ? (
          <p className="muted muted--tight" role="alert">
            Couldn’t load squads. {error}
          </p>
        ) : (
          <div className="trade-tool">
            <div className="trade-tool__board">
              {renderSquad('a')}
              <div className="trade-tool__swap" aria-hidden>
                ⇄
              </div>
              {renderSquad('b')}
            </div>

            {(parsedA || parsedB || pickedA.length || pickedB.length) ? (
            <div className="trade-tool__picked" aria-label="Players in the trade">
              <div className="trade-tool__picked-col">
                {pickedA.length ? (
                  pickedA.map((p) => (
                    <PickedChip
                      key={p.element}
                      player={p}
                      side="a"
                      onRemove={(id) => togglePlayer('a', id)}
                    />
                  ))
                ) : (
                  <span className="muted">Tap a player to give</span>
                )}
              </div>
              <span className="trade-tool__picked-swap" aria-hidden>
                ⇄
              </span>
              <div className="trade-tool__picked-col trade-tool__picked-col--b">
                {pickedB.length ? (
                  pickedB.map((p) => (
                    <PickedChip
                      key={p.element}
                      player={p}
                      side="b"
                      onRemove={(id) => togglePlayer('b', id)}
                    />
                  ))
                ) : (
                  <span className="muted">Tap a player to get</span>
                )}
              </div>
            </div>
            ) : null}

            {showRadar ? (
              <>
                <div className="trade-tool__controls">
                  {hasPrior ? (
                    <div className="trade-tool__season" role="group" aria-label="Season">
                      <button
                        type="button"
                        className={
                          'trade-tool__season-btn' +
                          (seasonMode === 'current' ? ' is-active' : '')
                        }
                        onClick={() => setSeasonMode('current')}
                      >
                        {currentShort}
                      </button>
                      <button
                        type="button"
                        className={
                          'trade-tool__season-btn' +
                          (seasonMode === 'prior' ? ' is-active' : '')
                        }
                        onClick={() => setSeasonMode('prior')}
                      >
                        {priorShort}
                      </button>
                      <button
                        type="button"
                        className={
                          'trade-tool__season-btn' +
                          (seasonMode === 'combined' ? ' is-active' : '')
                        }
                        onClick={() => setSeasonMode('combined')}
                      >
                        Both
                      </button>
                    </div>
                  ) : null}
                  <TradeStatsPill
                    selectedIds={statIds}
                    onChange={setStatIds}
                    sheet={mobileLayout}
                  />
                </div>
                <TradeRadar axes={axes} labelA={compareA} labelB={compareB} />
                <div className="trade-tool__table" role="table" aria-label="Trade totals">
                  <div className="trade-tool__th" role="row">
                    <span>Stat</span>
                    <span className="trade-tool__th-a">
                      <TradeTableHead
                        label={pickedA.length > 1 ? nameA : compareA}
                        asTeam={pickedA.length > 1}
                        source={sourceA}
                        clubs={clubs}
                        teamLogoMap={teamLogoMap}
                        kitIndexByEntry={kitIndexByEntry}
                      />
                    </span>
                    <span className="trade-tool__th-b">
                      <TradeTableHead
                        label={pickedB.length > 1 ? nameB : compareB}
                        asTeam={pickedB.length > 1}
                        source={sourceB}
                        clubs={clubs}
                        teamLogoMap={teamLogoMap}
                        kitIndexByEntry={kitIndexByEntry}
                      />
                    </span>
                    <span>Δ</span>
                  </div>
                  {axes.map((ax) => {
                    const winA = ax.lowerIsBetter ? ax.a < ax.b : ax.a > ax.b
                    const winB = ax.lowerIsBetter ? ax.b < ax.a : ax.b > ax.a
                    const sign = ax.delta > 0 ? '+' : ax.delta < 0 ? '−' : '±'
                    return (
                      <div className="trade-tool__tr" role="row" key={ax.id}>
                        <span className="trade-tool__tk" title={ax.title}>
                          {ax.label}
                        </span>
                        <span className={'trade-tool__tv' + (winA ? ' is-win' : '')}>
                          {formatTradeStat(ax.id, ax.a)}
                        </span>
                        <span className={'trade-tool__tv' + (winB ? ' is-win' : '')}>
                          {formatTradeStat(ax.id, ax.b)}
                        </span>
                        <span
                          className={
                            'trade-tool__td' +
                            (ax.delta > 0
                              ? ' is-pos'
                              : ax.delta < 0
                                ? ' is-neg'
                                : '')
                          }
                        >
                          {sign}
                          {formatTradeStat(ax.id, Math.abs(ax.delta))}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <p className="muted muted--tight trade-tool__empty">
                {needLabelA && needLabelB
                  ? `Positions have to match. ${nameA} still needs ${needLabelA}. ${nameB} still needs ${needLabelB}.`
                  : needLabelA
                    ? `Pick ${needLabelA} on ${nameA} so the positions match.`
                    : needLabelB
                      ? `Pick ${needLabelB} on ${nameB} so the positions match.`
                      : 'Pick players on each side. The other side has to match those positions.'}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { fplElementKnownName, fplElementWebName } from './fplElementNames.js'
import { PlayerKit } from './PlayerKit.jsx'
import { TeamAvatar } from './TeamAvatar.jsx'
import { CompareClubSourcePill, ComparePlayerPill, ComparePlayerSearch, StatsColumnsPill } from './playersFilterPills.jsx'
import {
  buildWireStatPills,
  fetchElementSummary,
  portraitDetailDefaultWireStatIdsForPosition,
  portraitMaxStatColumns,
  POS_LABEL,
  readWireStatSelection,
  writeWireStatSelection,
} from './playersWireList.js'
import {
  formatHistoryBlankStat,
  formatHistoryCount,
  formatHistoryDcForRow,
  historyGw,
  historyPoints,
  normalizeHistoryRows,
} from './playerGwHistory.js'
import { useMobileLayout, usePortraitMobile } from './usePortraitMobile.js'
import './PlayerDetailView.css'

/** @param {{ k: string, v: string }[]} pills */
function WireStatBoxStrip({ pills }) {
  return (
    <dl className="players-stat-strip players-detail__stat-strip">
      {pills.map((s) => (
        <div key={s.k} className="players-stat-pill">
          <dt>{s.k}</dt>
          <dd className="tabular">{s.v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** @param {{
 *   el: object,
 *   teamById: Map<number, object>,
 *   pills: { k: string, v: string }[],
 *   owner?: { leagueEntryId: number, teamName: string } | null,
 *   rostersHealthy?: boolean,
 *   logoMap?: Record<string, string>,
 *   kitIndexByEntry?: Record<number, number>,
 * }} props */
function PlayerWireHero({
  el,
  teamById,
  pills,
  owner = null,
  rostersHealthy = false,
  logoMap = {},
  kitIndexByEntry = {},
}) {
  const tm = teamById.get(el?.team)
  const badgeUrl =
    tm?.code != null
      ? `https://resources.premierleague.com/premierleague/badges/50/t${tm.code}.png`
      : null
  const posLabel = POS_LABEL[el?.element_type] ?? '?'
  const showOwner = rostersHealthy && owner != null
  return (
    <div className="players-detail__hero">
      <h2 className="players-detail__name">
        {fplElementKnownName(el, el.id)}{' '}
        <span className="players-detail__meta muted">({posLabel})</span>
      </h2>
      <div className="players-detail__hero-row">
        <div className="players-detail__hero-badges">
          <PlayerKit badgeUrl={badgeUrl} teamShort={tm?.short_name} />
          {showOwner ? (
            <span
              className="players-detail__hero-owner"
              title={owner.teamName}
            >
              <TeamAvatar
                entryId={owner.leagueEntryId}
                name={owner.teamName}
                size="sm"
                logoMap={logoMap}
                kitIndexByEntry={kitIndexByEntry}
                badgeFallback
              />
            </span>
          ) : null}
        </div>
        <div className="players-detail__stat-cluster">
          <WireStatBoxStrip pills={pills} />
        </div>
      </div>
    </div>
  )
}

/**
 * @param {{
 *   playerId: number,
 *   benchId: number | null,
 *   onBenchChange: (id: number | null) => void,
 *   onBack: () => void,
 *   playerEl: object,
 *   benchEl: object | null,
 *   teamById: Map<number, object>,
 *   teamsForFormSelect: object[],
 *   plClubs: object[],
 *   compareSource: import('./playersFilterPills.jsx').CompareClubSource | null,
 *   onCompareSourceChange: (source: import('./playersFilterPills.jsx').CompareClubSource | null) => void,
 *   compareSearchOptions: { id: number, label: string }[],
 *   compareSquadOptions: { id: number, label: string }[],
 *   onSearchBenchSelect: (id: number | null) => void,
 *   logoMap: Record<string, string>,
 *   kitIndexByEntry: Record<number, number>,
 *   ownerByElementId: Map<number, { leagueEntryId: number, teamName: string }>,
 *   rostersHealthy?: boolean,
 *   plFixtures?: object[] | null,
 * }} props
 */
export function PlayerDetailView({
  playerId,
  benchId,
  onBenchChange,
  onBack,
  playerEl,
  benchEl,
  teamById,
  teamsForFormSelect,
  plClubs,
  compareSource,
  onCompareSourceChange,
  compareSearchOptions,
  compareSquadOptions,
  onSearchBenchSelect,
  logoMap,
  kitIndexByEntry,
  ownerByElementId,
  rostersHealthy = false,
  plFixtures = null,
}) {
  const portrait = usePortraitMobile()
  const mobileLayout = useMobileLayout()
  const [primaryPayload, setPrimaryPayload] = useState(null)
  const [comparePayload, setComparePayload] = useState(null)
  const [loadingPrimary, setLoadingPrimary] = useState(true)
  const [loadingCompare, setLoadingCompare] = useState(false)
  const [errorPrimary, setErrorPrimary] = useState(null)

  const elementType = playerEl?.element_type
  const detailPositionFilter =
    elementType != null ? String(elementType) : 'all'
  const posLabel = POS_LABEL[elementType] ?? '?'
  const showCs = elementType !== 4
  const defDetail = elementType === 2

  const [detailStatIds, setDetailStatIds] = useState(() =>
    readWireStatSelection(detailPositionFilter),
  )

  useEffect(() => {
    if (portrait) {
      setDetailStatIds(portraitDetailDefaultWireStatIdsForPosition(detailPositionFilter))
      return
    }
    setDetailStatIds(readWireStatSelection(detailPositionFilter))
  }, [playerId, detailPositionFilter, portrait])

  const handleDetailStatChange = useCallback(
    (ids) => {
      const max = portrait ? portraitMaxStatColumns(detailPositionFilter) : ids.length
      const next = portrait ? ids.slice(0, max) : ids
      setDetailStatIds(next)
      writeWireStatSelection(detailPositionFilter, next)
    },
    [detailPositionFilter, portrait],
  )

  useEffect(() => {
    let cancel = false
    setLoadingPrimary(true)
    setErrorPrimary(null)
    setPrimaryPayload(null)
    void (async () => {
      try {
        const payload = await fetchElementSummary(playerId)
        if (!cancel) setPrimaryPayload(payload)
      } catch (e) {
        if (!cancel) setErrorPrimary(e?.message ?? String(e))
      } finally {
        if (!cancel) setLoadingPrimary(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [playerId])

  useEffect(() => {
    if (benchId == null) {
      setComparePayload(null)
      setLoadingCompare(false)
      return undefined
    }
    let cancel = false
    setLoadingCompare(true)
    setComparePayload(null)
    void (async () => {
      try {
        const payload = await fetchElementSummary(benchId)
        if (!cancel) setComparePayload(payload)
      } catch {
        if (!cancel) setComparePayload(null)
      } finally {
        if (!cancel) setLoadingCompare(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [benchId])

  const primaryRows = useMemo(
    () => normalizeHistoryRows(primaryPayload || {}),
    [primaryPayload],
  )

  const compareActive = benchEl != null && benchId != null
  const compareElementType = benchEl?.element_type ?? elementType
  const primaryOwner = ownerByElementId.get(Number(playerId)) ?? null
  const benchOwner =
    benchId != null ? ownerByElementId.get(Number(benchId)) ?? null : null

  const detailStatMax = portrait ? portraitMaxStatColumns(detailPositionFilter) : 8
  const portraitCompare = portrait && compareActive
  const pillOptions = { portrait, portraitDetail: portrait, portraitCompare }
  const benchSelected = benchId != null && benchEl != null

  const primaryWirePills = useMemo(
    () =>
      buildWireStatPills(
        playerEl,
        primaryPayload,
        elementType,
        loadingPrimary,
        detailStatIds,
        detailPositionFilter,
        pillOptions,
      ),
    [
      playerEl,
      primaryPayload,
      elementType,
      loadingPrimary,
      detailStatIds,
      detailPositionFilter,
      portrait,
      portraitCompare,
    ],
  )

  const compareWirePills = useMemo(() => {
    if (!compareActive || !benchEl) return []
    return buildWireStatPills(
      benchEl,
      comparePayload,
      compareElementType,
      loadingCompare,
      detailStatIds,
      detailPositionFilter,
      pillOptions,
    )
  }, [
    compareActive,
    benchEl,
    comparePayload,
    compareElementType,
    loadingCompare,
    detailStatIds,
    detailPositionFilter,
    portrait,
    portraitCompare,
  ])

  const handleSourceChange = (source) => {
    onCompareSourceChange(source)
  }

  const comparePillOptions = compareSource ? compareSquadOptions : compareSearchOptions

  return (
    <div className="players-detail" aria-label={`${fplElementKnownName(playerEl, playerId)} season detail`}>
      <header className="players-detail__toolbar players-detail__toolbar--sticky team-selection-submenu">
        {!mobileLayout ? (
          <button
            type="button"
            className="players-detail__back"
            onClick={onBack}
            aria-label="Back to waivers"
          >
            Back
          </button>
        ) : null}
        <div className="players-detail__compare-row">
          <div className="players-detail__compare-primary">
            {!mobileLayout ? (
              <span className="players-detail__compare-label">Compare:</span>
            ) : null}
            {benchSelected ? (
              <ComparePlayerPill
                options={comparePillOptions}
                selectedId={benchId}
                onSelect={onBenchChange}
                positionLabel={posLabel}
                displayName={
                  mobileLayout
                    ? fplElementWebName(benchEl, benchId)
                    : fplElementKnownName(benchEl, benchId)
                }
              />
            ) : (
              <ComparePlayerSearch
                options={compareSearchOptions}
                selectedId={benchId}
                onSelect={onSearchBenchSelect}
                placeholder="Find a player…"
                positionLabel={posLabel}
                compact={mobileLayout}
              />
            )}
          </div>
          <div className="players-detail__compare-actions">
            <CompareClubSourcePill
              fantasyTeams={teamsForFormSelect}
              plClubs={plClubs}
              selected={compareSource}
              onSelect={handleSourceChange}
              logoMap={logoMap}
              kitIndexByEntry={kitIndexByEntry}
              compact={mobileLayout}
            />
            <StatsColumnsPill
              selectedIds={detailStatIds}
              onChange={handleDetailStatChange}
              positionFilter={detailPositionFilter}
              maxStatColumns={detailStatMax}
              compact={mobileLayout}
            />
          </div>
        </div>
      </header>

      <div className="players-detail__main">
        <div className="players-detail__content">
      <PlayerWireHero
        el={playerEl}
        teamById={teamById}
        pills={primaryWirePills}
        owner={primaryOwner}
        rostersHealthy={rostersHealthy}
        logoMap={logoMap}
        kitIndexByEntry={kitIndexByEntry}
      />

      {compareActive ? (
        <PlayerWireHero
          el={benchEl}
          teamById={teamById}
          pills={compareWirePills}
          owner={benchOwner}
          rostersHealthy={rostersHealthy}
          logoMap={logoMap}
          kitIndexByEntry={kitIndexByEntry}
        />
      ) : null}

      <div
        className={`players-detail__table-area${
          mobileLayout ? ' players-detail__table-area--edge-back' : ''
        }`}
      >
        {mobileLayout ? (
          <button
            type="button"
            className="players-detail__edge-back"
            onClick={onBack}
            aria-label="Back to waivers"
          >
            <span className="players-detail__edge-back__chev" aria-hidden="true">
              ‹
            </span>
          </button>
        ) : null}
      <div className="players-detail__table-wrap">
        {loadingPrimary ? (
          <p className="muted players-detail__loading">Loading gameweek history…</p>
        ) : errorPrimary ? (
          <p className="players-bench-banner" role="alert">
            Could not load history. {errorPrimary}
          </p>
        ) : !primaryRows.length ? (
          <p className="muted">No gameweek history available.</p>
        ) : (
          <table className="players-detail__table">
            <thead>
              <tr>
                <th scope="col">GW</th>
                <th scope="col">Mins</th>
                <th scope="col" title="Goals">
                  G
                </th>
                <th scope="col" title="Assists">
                  A
                </th>
                {!defDetail ? (
                  <th scope="col" title="Defensive contributions">
                    DC
                  </th>
                ) : null}
                {showCs ? <th scope="col">CS</th> : null}
                {defDetail ? (
                  <th scope="col" title="Defensive contributions">
                    DC
                  </th>
                ) : (
                  <th scope="col">Bps</th>
                )}
                <th scope="col">Pts</th>
              </tr>
            </thead>
            <tbody>
              {primaryRows.map((h, i) => {
                const gw = historyGw(h)
                const pts = historyPoints(h)
                return (
                  <tr key={`${gw}-${i}`}>
                    <td className="tabular players-detail__gw">
                      {Number.isFinite(gw) ? gw : '—'}
                    </td>
                    <td className="tabular">{h.minutes ?? '—'}</td>
                    <td className="tabular">
                      {formatHistoryCount('⚽', h.goals_scored)}
                    </td>
                    <td className="tabular">
                      {formatHistoryCount('🍑', h.assists)}
                    </td>
                    {!defDetail ? (
                      <td className="tabular">
                        {formatHistoryDcForRow(
                          h,
                          playerId,
                          playerEl?.team,
                          elementType,
                          plFixtures,
                        )}
                      </td>
                    ) : null}
                    {showCs ? (
                      <td className="tabular">
                        {formatHistoryBlankStat(h.clean_sheets)}
                      </td>
                    ) : null}
                    <td className="tabular">
                      {defDetail
                        ? formatHistoryDcForRow(
                            h,
                            playerId,
                            playerEl?.team,
                            elementType,
                            plFixtures,
                          )
                        : formatHistoryBlankStat(h.bonus)}
                    </td>
                    <td className="tabular players-detail__pts">
                      {pts != null ? pts : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      </div>
        </div>
      </div>
    </div>
  )
}

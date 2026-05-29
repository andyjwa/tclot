import { useCallback, useEffect, useMemo, useState } from 'react'
import { fplElementWebName } from './fplElementNames.js'
import {
  buildWireStatPills,
  fetchElementSummary,
  portraitDetailDefaultWireStatIdsForPosition,
  portraitMaxStatColumns,
  readWireStatSelection,
  writeWireStatSelection,
} from './playersWireList.js'
import { useMobileLayout, usePortraitMobile } from './usePortraitMobile.js'
import { PlayerDetailHero } from './PlayerDetailHero.jsx'
import { PlayerDetailOverview } from './PlayerDetailOverview.jsx'
import { PlayerDetailPerformance } from './PlayerDetailPerformance.jsx'
import { PlayerCompareView } from './PlayerCompareView.jsx'
import './PlayersWorkbench.css'
import './PlayerDetailView.css'

/** @typedef {'overview' | 'performance'} PdetailTabId */

const TABS = /** @type {{ id: PdetailTabId, label: string }[]} */ ([
  { id: 'overview',    label: 'Overview' },
  { id: 'performance', label: 'Performance' },
])

/** @returns {'xi' | 'bench' | 'absent'} */
function deriveXiKind(el) {
  const status = String(el?.status ?? '').toLowerCase()
  if (status === 'i' || status === 'u' || status === 's') return 'absent'
  const chance = Number(el?.chance_of_playing_next_round)
  if (Number.isFinite(chance) && chance < 50) return 'absent'
  if (Number.isFinite(chance) && chance < 100 && chance >= 50) return 'bench'
  return 'xi'
}

/**
 * Map a fantasy-team owner pill to the small "On {crest} {team-name}"
 * label rendered in the hero. Returns `null` when the player is a free
 * agent OR when rosters haven't loaded yet (the hero falls back to the
 * Free agent dot in that case — same as the locked Mockup).
 *
 * @param {{ leagueEntryId: number, teamName: string } | null} owner
 * @returns {{ code: string, name: string } | null}
 */
function buildOwnerLabel(owner) {
  if (!owner?.teamName) return null
  const parts = String(owner.teamName)
    .split(/\s+/)
    .filter(Boolean)
  const initials = parts
    .map((p) => p.charAt(0).toUpperCase())
    .join('')
    .slice(0, 3)
  return { code: initials || '?', name: owner.teamName }
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
  const [tab, setTab] = useState(/** @type {PdetailTabId} */ ('overview'))
  const [compareOpen, setCompareOpen] = useState(false)
  const [primaryPayload, setPrimaryPayload] = useState(null)
  const [comparePayload, setComparePayload] = useState(null)
  const [loadingPrimary, setLoadingPrimary] = useState(true)
  const [loadingCompare, setLoadingCompare] = useState(false)
  const [errorPrimary, setErrorPrimary] = useState(null)

  /** Reset Compare flow state when the focused player changes. */
  useEffect(() => {
    setCompareOpen(false)
  }, [playerId])

  const elementType = playerEl?.element_type
  const detailPositionFilter =
    elementType != null ? String(elementType) : 'all'

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

  const compareActive = benchEl != null && benchId != null
  const compareElementType = benchEl?.element_type ?? elementType
  const primaryOwner = ownerByElementId.get(Number(playerId)) ?? null

  const ownerLabel = useMemo(
    () => (rostersHealthy ? buildOwnerLabel(primaryOwner) : null),
    [primaryOwner, rostersHealthy],
  )
  const xiKind = useMemo(() => deriveXiKind(playerEl), [playerEl])
  const team = teamById.get(playerEl?.team) ?? null

  const detailStatMax = portrait ? portraitMaxStatColumns(detailPositionFilter) : 8
  const portraitCompare = portrait && compareActive
  const pillOptions = { portrait, portraitDetail: portrait, portraitCompare }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleCloseCompare = useCallback(() => {
    setCompareOpen(false)
  }, [])

  const handleClearCompare = useCallback(() => {
    onBenchChange?.(null)
  }, [onBenchChange])

  return (
    <div
      className={'pdetail-host' + (mobileLayout ? ' pdetail-host--mobile' : '')}
      aria-label={`${fplElementWebName(playerEl, playerId)} player detail`}
    >
      {/*
       * Top header bar — Back chevron + "Player" title. Renders for every
       * mobile-layout width (≤1080px), not just narrow portrait phones, so
       * tablets and landscape phones get the same chevron-anchored exit
       * affordance instead of a bottom "BACK" link. Mockup parity:
       * `mockup-pdetail-p__h` from the locked PlayerDetailPortrait. Round 3
       * polish: also serves the swipe-right gesture target on the surface
       * itself; clicking the chevron closes via the same path
       * (`onBack` → `requestDetailClose`).
       */}
      {mobileLayout ? (
        <div className="pdetail__topbar">
          <button
            type="button"
            className="pdetail__back"
            aria-label="Back"
            onClick={onBack}
          >
            <span aria-hidden>‹</span>
          </button>
          <span className="pdetail__topbar-title">Player</span>
          <span aria-hidden />
        </div>
      ) : null}

      {compareOpen ? null : (
        <PlayerDetailHero
          el={playerEl}
          team={team}
          ownerLabel={ownerLabel}
          xiKind={xiKind}
          portrait={portrait}
          onCompareClick={() => setCompareOpen(true)}
          compareDisabled={false}
        />
      )}

      {compareOpen ? (
        <PlayerCompareView
          primaryEl={playerEl}
          primaryPayload={primaryPayload}
          primaryPills={primaryWirePills}
          compareEl={compareActive ? benchEl : null}
          comparePayload={comparePayload}
          comparePills={compareWirePills}
          teamById={teamById}
          onClose={handleCloseCompare}
          onClearCompare={handleClearCompare}
          benchId={benchId}
          onBenchChange={onBenchChange}
          onSearchBenchSelect={onSearchBenchSelect}
          compareSource={compareSource}
          onCompareSourceChange={onCompareSourceChange}
          compareSearchOptions={compareSearchOptions}
          compareSquadOptions={compareSquadOptions}
          teamsForFormSelect={teamsForFormSelect}
          plClubs={plClubs}
          logoMap={logoMap}
          kitIndexByEntry={kitIndexByEntry}
          detailStatIds={detailStatIds}
          onDetailStatChange={handleDetailStatChange}
          detailPositionFilter={detailPositionFilter}
          detailStatMax={detailStatMax}
          portrait={portrait}
          mobileLayout={mobileLayout}
        />
      ) : (
        <>
          <div className="pdetail__tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={'pdetail__tab' + (tab === t.id ? ' is-active' : '')}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="pdetail__main">
            {loadingPrimary && !primaryPayload ? (
              <p className="muted pdetail__loading">Loading season data…</p>
            ) : errorPrimary ? (
              <p className="muted pdetail__error" role="alert">
                Could not load season data. {errorPrimary}
              </p>
            ) : tab === 'overview' ? (
              <PlayerDetailOverview
                el={playerEl}
                summaryPayload={primaryPayload}
                teamById={teamById}
                portrait={portrait}
                plFixtures={plFixtures}
              />
            ) : (
              <PlayerDetailPerformance
                el={playerEl}
                summaryPayload={primaryPayload}
                teamById={teamById}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}

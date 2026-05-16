import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import {
  buildOwnerByElementFromElementStatus,
  ownedElementIdsFromElementStatus,
} from './playersWireList.js'
import { loadLeagueFixtures } from './playerGwHistory.js'
import {
  buildCompareOptionLabel,
  fetchBootstrapDraft,
  fetchLeagueJsonFile,
  PLAYERS_LEAGUE_DATA_BASE,
  rosterIdsForLeagueEntry,
  suggestBenchTarget,
} from './playersBenchShared.js'
import { PlayerDetailView } from './PlayerDetailView.jsx'
import { useMobileLayout } from './usePortraitMobile.js'
import './PlayerDetailOverlay.css'

const OverlayContext = createContext(null)

/** @returns {{ openPlayerDetail: (payload: OverlayOpenPayload)=>void } | null} */
export function usePlayerDetailOverlayOptional() {
  return useContext(OverlayContext)
}

/**
 * @typedef {object} OverlayOpenPayload
 * @property {number} [element]
 * @property {number} [elementId]
 * @property {number | null | undefined} [leagueEntryId]
 */

export function PlayerDetailOverlayProvider({
  children,
  /** When this changes (e.g. dashboard tab switch), overlay state is torn down synchronously — App `onOpenChange` alone cannot unmount the portal */
  dashboardView = '',
  teamsForFormSelect = [],
  leagueDataRevision = '',
  logoMap = {},
  kitIndexByEntry = {},
  onOpenChange,
}) {
  const [bootstrap, setBootstrap] = useState(null)
  const [squadsErr, setSquadsErr] = useState(null)
  const [ownerByElementId, setOwnerByElementId] = useState(() => new Map())
  const [rostersHealthy, setRostersHealthy] = useState(false)
  const [plFixtures, setPlFixtures] = useState(null)

  const [overlayPlayerId, setOverlayPlayerId] = useState(null)
  const [overlayLeagueEntryId, setOverlayLeagueEntryId] = useState(null)
  const [compareSource, setCompareSource] = useState(null)
  const [benchId, setBenchId] = useState(null)

  /** Bumps whenever a new overlay session opens (not on close). Used to hydrate after async roster map. */
  const [hydrateGeneration, setHydrateGeneration] = useState(0)

  const elemsById = useMemo(() => {
    const m = new Map()
    if (!bootstrap?.elements) return m
    for (const el of bootstrap.elements) {
      m.set(Number(el.id), el)
    }
    return m
  }, [bootstrap])

  const mobileLayout = useMobileLayout()
  const slideSheetRef = useRef(null)
  const pendingSlideExitFinalizeRef = useRef(false)
  const [slideShellOpen, setSlideShellOpen] = useState(false)

  const closeDetailImmediately = useCallback(() => {
    pendingSlideExitFinalizeRef.current = false
    setSlideShellOpen(false)
    setOverlayPlayerId(null)
    setOverlayLeagueEntryId(null)
    setCompareSource(null)
    setBenchId(null)
    onOpenChange?.(false)
  }, [onOpenChange])

  const closeImmediateRef = useRef(closeDetailImmediately)
  closeImmediateRef.current = closeDetailImmediately
  const dashboardViewSeenRef = useRef(dashboardView)

  /** Tear down overlay only on real navigations — never on first paint (avoids layout churn blanking tabs). */
  useLayoutEffect(() => {
    const prev = dashboardViewSeenRef.current
    if (prev === dashboardView) return
    closeImmediateRef.current()
    dashboardViewSeenRef.current = dashboardView
  }, [dashboardView])

  const requestDetailClose = useCallback(() => {
    if (mobileLayout) {
      closeDetailImmediately()
      return
    }
    if (!slideShellOpen) {
      closeDetailImmediately()
      return
    }
    pendingSlideExitFinalizeRef.current = true
    setSlideShellOpen(false)
  }, [mobileLayout, slideShellOpen, closeDetailImmediately])

  const onDesktopSlideTransitionEnd = useCallback(
    (e) => {
      if (e.target !== slideSheetRef.current || e.propertyName !== 'transform') return
      if (!pendingSlideExitFinalizeRef.current) return
      closeDetailImmediately()
    },
    [closeDetailImmediately],
  )

  useEffect(() => {
    if (overlayPlayerId == null || mobileLayout) return undefined
    setSlideShellOpen(false)
    let innerRaf = null
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => setSlideShellOpen(true))
    })
    return () => {
      cancelAnimationFrame(outerRaf)
      if (innerRaf != null) cancelAnimationFrame(innerRaf)
    }
  }, [overlayPlayerId, mobileLayout])

  const openPlayerDetail = useCallback(
    (payload) => {
      const id = Number(payload?.element ?? payload?.elementId)
      if (!Number.isFinite(id)) return

      let leagueRaw = payload?.leagueEntryId ?? null
      if (leagueRaw != null) leagueRaw = Number(leagueRaw)
      const leagueOk =
        leagueRaw != null &&
        teamsForFormSelect.some((x) => Number(x?.id) === Number(leagueRaw))

      setHydrateGeneration((g) => g + 1)
      const nextCmp = leagueOk ? { kind: 'fantasy', id: Number(leagueRaw) } : null

      /** Best-effort before bootstrap — cleared when hydrate runs */
      setOverlayPlayerId(id)
      setOverlayLeagueEntryId(leagueOk ? Number(leagueRaw) : null)
      setCompareSource(nextCmp)
      setBenchId(null)

      onOpenChange?.(true)

      /** If bootstrap warmed, derive bench synchronously */
      if (bootstrap && elemsById.size && nextCmp && leagueOk) {
        const detailEl = elemsById.get(id)
        if (detailEl) {
          const rosterIds = rosterIdsForLeagueEntry(nextCmp.id, ownerByElementId)
          const pick = suggestBenchTarget([...rosterIds], elemsById, detailEl)
          setBenchId(pick ?? null)
        }
      }
    },
    [
      bootstrap,
      elemsById,
      ownerByElementId,
      teamsForFormSelect,
      onOpenChange,
    ],
  )

  useEffect(() => {
    let cancel = false
    void loadLeagueFixtures(PLAYERS_LEAGUE_DATA_BASE).then((rows) => {
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

        const statusPayload = await fetchLeagueJsonFile('element_status.json', cacheKey)
        if (cancel) return

        const owners = buildOwnerByElementFromElementStatus(statusPayload, teamsForFormSelect)
        const owned = ownedElementIdsFromElementStatus(statusPayload)
        setOwnerByElementId(owners)
        setRostersHealthy(owned.size > 0)
      } catch (e) {
        if (!cancel) {
          setSquadsErr(e?.message ?? String(e))
          setRostersHealthy(false)
        }
      }
    })()
    return () => {
      cancel = true
    }
  }, [teamsForFormSelect, leagueDataRevision])

  const teamById = useMemo(() => {
    const m = new Map()
    if (!bootstrap?.teams) return m
    for (const t of bootstrap.teams) {
      m.set(t.id, t)
    }
    return m
  }, [bootstrap])

  const clubOptions = useMemo(() => {
    if (!bootstrap?.teams?.length) return []
    return [...bootstrap.teams].sort((a, b) =>
      String(a.short_name || a.name).localeCompare(String(b.short_name || b.name)),
    )
  }, [bootstrap])

  /** When roster maps land, finalize bench suggestion if still empty */
  useEffect(() => {
    if (overlayPlayerId == null || benchId != null) return undefined
    if (!bootstrap?.elements?.length) return undefined
    if (!compareSource || compareSource.kind !== 'fantasy') return undefined
    const pid = Number(overlayPlayerId)
    const detailEl = elemsById.get(pid)
    if (!detailEl) return undefined
    const rosterIds = rosterIdsForLeagueEntry(compareSource.id, ownerByElementId)
    const pick = suggestBenchTarget([...rosterIds], elemsById, detailEl)
    if (pick != null) setBenchId(pick)
    return undefined
  }, [
    overlayPlayerId,
    benchId,
    bootstrap,
    elemsById,
    compareSource,
    ownerByElementId,
    hydrateGeneration,
    rostersHealthy,
  ])

  /** Invalid element id once bootstrap loaded */
  useEffect(() => {
    if (
      overlayPlayerId == null ||
      !Array.isArray(bootstrap?.elements) ||
      bootstrap.elements.length === 0
    ) {
      return undefined
    }
    if (elemsById.has(Number(overlayPlayerId))) return undefined
    queueMicrotask(() => closeDetailImmediately())
    return undefined
  }, [overlayPlayerId, bootstrap, elemsById, closeDetailImmediately])

  const detailPlayerEl =
    overlayPlayerId != null ? elemsById.get(Number(overlayPlayerId)) : null
  const benchEl = benchId != null ? elemsById.get(benchId) : null

  const compareSearchOptions = useMemo(() => {
    const w = detailPlayerEl
    if (!w?.element_type || !bootstrap?.elements?.length) return []
    const waiverId = Number(w.id)
    const out = []
    for (const el of bootstrap.elements) {
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
    if (!w?.element_type || !compareSource || !bootstrap?.elements?.length) return []
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
      for (const el of bootstrap.elements) {
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

  useEffect(() => {
    if (overlayPlayerId == null || !detailPlayerEl) return undefined

    const squadIds = new Set(compareSquadOptions.map((o) => o.id))
    const searchIds = new Set(compareSearchOptions.map((o) => o.id))
    const validIds = compareSource ? squadIds : searchIds

    if (benchId != null && !validIds.has(benchId)) {
      setBenchId(null)
      return undefined
    }

    if (compareSource?.kind === 'fantasy' && benchId == null && rostersHealthy) {
      const rosterIds = rosterIdsForLeagueEntry(compareSource.id, ownerByElementId)
      const pick = suggestBenchTarget([...rosterIds], elemsById, detailPlayerEl)
      setBenchId(pick)
    }

    return undefined
  }, [
    overlayPlayerId,
    compareSource,
    compareSquadOptions,
    compareSearchOptions,
    ownerByElementId,
    detailPlayerEl,
    benchId,
    elemsById,
    rostersHealthy,
  ])

  const ctxValue = useMemo(() => ({ openPlayerDetail }), [openPlayerDetail])

  const handleSearchBenchSelect = useCallback((id) => {
    if (id != null) setCompareSource(null)
    setBenchId(id)
  }, [])

  const desktopSlideChrome = useCallback(
    (slideInner) => (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Player detail"
        className={`live-player-slide live-player-slide--player-detail${
          slideShellOpen ? ' live-player-slide--open' : ''
        }`}
      >
        <button
          type="button"
          className="live-player-slide__scrim"
          aria-label="Close player detail"
          onClick={requestDetailClose}
        />
        <div
          ref={slideSheetRef}
          className="live-player-slide__sheet live-player-slide__sheet--player-detail"
          onTransitionEnd={onDesktopSlideTransitionEnd}
          onMouseDown={(e) => {
            e.stopPropagation()
          }}
        >
          {slideInner}
        </div>
      </div>
    ),
    [
      slideShellOpen,
      onDesktopSlideTransitionEnd,
      requestDetailClose,
    ],
  )

  const portalSubtree =
    overlayPlayerId != null ?
      <>
        <OverlayEffects onClose={requestDetailClose} />
        {!bootstrap && !squadsErr ?
          mobileLayout ?
            <div className="player-detail-overlay-shell" role="dialog" aria-modal="true">
              <div className="player-detail-overlay__panel">
                <p className="muted">Loading player…</p>
              </div>
            </div>
          : desktopSlideChrome(
              <div className="live-player-slide__body live-player-slide__body--player-detail-host">
                <p className="muted">Loading player…</p>
              </div>,
            )
        : squadsErr && bootstrap == null ?
          mobileLayout ?
            <div className="player-detail-overlay-shell" role="dialog" aria-modal="true">
              <div className="player-detail-overlay__panel player-detail-overlay__panel--error">
                <p>{squadsErr}</p>
                <button
                  type="button"
                  className="player-detail-overlay__btn"
                  onClick={requestDetailClose}
                >
                  Close
                </button>
              </div>
            </div>
          : desktopSlideChrome(
              <div className="live-player-slide__body live-player-slide__body--player-detail-host">
                <div className="player-detail-overlay__panel player-detail-overlay__panel--error player-detail-overlay__panel--slide">
                  <p>{squadsErr}</p>
                  <button
                    type="button"
                    className="player-detail-overlay__btn"
                    onClick={requestDetailClose}
                  >
                    Close
                  </button>
                </div>
              </div>,
            )
        : !detailPlayerEl ?
          mobileLayout ?
            <div className="player-detail-overlay-shell" role="dialog" aria-modal="true">
              <div className="player-detail-overlay__panel player-detail-overlay__panel--error">
                <p className="muted">Player data not loaded yet.</p>
                <button
                  type="button"
                  className="player-detail-overlay__btn"
                  onClick={requestDetailClose}
                >
                  Close
                </button>
              </div>
            </div>
          : desktopSlideChrome(
              <div className="live-player-slide__body live-player-slide__body--player-detail-host">
                <div className="player-detail-overlay__panel player-detail-overlay__panel--error player-detail-overlay__panel--slide">
                  <p className="muted">Player data not loaded yet.</p>
                  <button
                    type="button"
                    className="player-detail-overlay__btn"
                    onClick={requestDetailClose}
                  >
                    Close
                  </button>
                </div>
              </div>,
            )
        : mobileLayout ?
          <div
            className="player-detail-overlay-shell player-detail-overlay-shell--body"
            role="dialog"
            aria-modal="true"
            aria-label="Player detail"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) requestDetailClose()
            }}
          >
            <div
              className="player-detail-overlay__surface"
              onMouseDown={(e) => {
                e.stopPropagation()
              }}
            >
              <PlayerDetailView
                playerId={Number(overlayPlayerId)}
                benchId={benchId}
                onBenchChange={setBenchId}
                onBack={requestDetailClose}
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
            </div>
          </div>
        : desktopSlideChrome(
            <div className="player-detail-overlay__surface player-detail-overlay__surface--slide">
              <PlayerDetailView
                playerId={Number(overlayPlayerId)}
                benchId={benchId}
                onBenchChange={setBenchId}
                onBack={requestDetailClose}
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
            </div>,
          )}
      </>
    : null

  return (
    <OverlayContext.Provider value={ctxValue}>
      {children}
      {portalSubtree && typeof document !== 'undefined' ?
        createPortal(portalSubtree, document.body)
      : null}
    </OverlayContext.Provider>
  )
}

function OverlayEffects({ onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])
  return null
}
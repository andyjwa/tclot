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
import { matchesMobileLayoutViewport, useMobileLayout } from './usePortraitMobile.js'
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
  /** `'opening'` | `'shown'` | `'closing'` — mobile overlay sheet slide (see CSS `data-mobile-phase`). */
  const [mobileSheetPhase, setMobileSheetPhase] = useState(null)
  const mobileSheetPhaseRef = useRef(null)
  const mobileSurfaceRef = useRef(null)
  mobileSheetPhaseRef.current = mobileSheetPhase

  const closeDetailImmediately = useCallback(() => {
    pendingSlideExitFinalizeRef.current = false
    setSlideShellOpen(false)
    setMobileSheetPhase(null)
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

  useLayoutEffect(() => {
    if (mobileSheetPhase !== 'opening') return undefined
    let innerRaf = null
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() =>
        setMobileSheetPhase((p) => (p === 'opening' ? 'shown' : p)),
      )
    })
    return () => {
      cancelAnimationFrame(outerRaf)
      if (innerRaf != null) cancelAnimationFrame(innerRaf)
    }
  }, [mobileSheetPhase])

  const onMobileSheetTransitionEnd = useCallback(
    (e) => {
      if (!mobileSurfaceRef.current || e.target !== mobileSurfaceRef.current) return
      if (e.propertyName !== 'transform') return
      if (mobileSheetPhaseRef.current !== 'closing') return
      closeDetailImmediately()
    },
    [closeDetailImmediately],
  )

  /*
   * Swipe-right-to-dismiss for the mobile sheet. State lives in a ref so
   * mid-drag updates don't re-render React. The drag is "claimed"
   * (s.dragging = true) only once horizontal intent is established
   * (|dx| > |dy| AND |dx| > 8px AND dx > 0) — until then the touch
   * scrolls vertically as normal. Once claimed, we write inline
   * `transform: translateX(<dx>px)` to follow the finger; on release we
   * either animate out (if past threshold OR fast flick) using the same
   * close path as the Back button + ESC, or snap back to translateX(0).
   *
   * Conflict guard: drags that originate inside the Performance table-wrap
   * are ignored entirely so vertical/horizontal scroll inside the table
   * never accidentally dismisses the panel. (The Performance table is
   * the only inner scrollable surface today; if we add more we should
   * generalize via `data-no-swipe` markers.)
   */
  const swipeRef = useRef({
    startX: 0,
    startY: 0,
    startTime: 0,
    deltaX: 0,
    dragging: false,
    ignored: false,
  })

  const onMobileSurfaceTouchStart = useCallback((e) => {
    if (mobileSheetPhaseRef.current !== 'shown') return
    const touch = e.touches[0]
    if (!touch) return
    const target = e.target instanceof Element ? e.target : null
    /** Performance table scrolls both axes; never let drags from inside it dismiss. */
    const insideScrollable = target?.closest('.pperf__table-wrap') != null
    swipeRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: e.timeStamp || (typeof performance !== 'undefined' ? performance.now() : 0),
      deltaX: 0,
      dragging: false,
      ignored: insideScrollable,
    }
  }, [])

  const onMobileSurfaceTouchMove = useCallback((e) => {
    const s = swipeRef.current
    if (s.ignored || mobileSheetPhaseRef.current !== 'shown') return
    const touch = e.touches[0]
    if (!touch) return
    const dx = touch.clientX - s.startX
    const dy = touch.clientY - s.startY

    if (!s.dragging) {
      const absX = Math.abs(dx)
      const absY = Math.abs(dy)
      /** Below intent threshold — let the browser keep treating this as a tap/scroll. */
      if (absX < 8 && absY < 8) return
      /** Vertical / leftward intent → release the gesture, never reclaim it for this touch. */
      if (absY >= absX || dx <= 0) {
        s.ignored = true
        return
      }
      s.dragging = true
    }

    s.deltaX = dx > 0 ? dx : 0
    const surface = mobileSurfaceRef.current
    if (surface) {
      surface.style.transition = 'none'
      surface.style.transform = `translateX(${s.deltaX}px)`
    }
  }, [])

  const finishSwipeSnapback = useCallback(() => {
    const surface = mobileSurfaceRef.current
    if (!surface) return
    surface.style.transition = 'transform 0.22s cubic-bezier(0.32, 0.72, 0, 1)'
    surface.style.transform = 'translateX(0)'
    const onEnd = (e) => {
      if (e.propertyName !== 'transform') return
      surface.removeEventListener('transitionend', onEnd)
      surface.style.transition = ''
      surface.style.transform = ''
    }
    surface.addEventListener('transitionend', onEnd)
  }, [])

  const finishSwipeClose = useCallback(() => {
    const surface = mobileSurfaceRef.current
    if (!surface) {
      closeDetailImmediately()
      return
    }
    /* Drive the close animation with inline styles so we continue from the
     * dragged position; the existing data-mobile-phase='exit' CSS path
     * would snap back to translateX(0) first since inline transform is
     * cleared. After transform settles, fall through to the normal close
     * path so React state stays consistent. */
    surface.style.transition = 'transform 0.22s cubic-bezier(0.4, 0, 1, 1), opacity 0.22s'
    surface.style.transform = 'translateX(100%)'
    surface.style.opacity = '0'
    const onEnd = (e) => {
      if (e.propertyName !== 'transform') return
      surface.removeEventListener('transitionend', onEnd)
      closeDetailImmediately()
    }
    surface.addEventListener('transitionend', onEnd)
  }, [closeDetailImmediately])

  const onMobileSurfaceTouchEnd = useCallback(
    (e) => {
      const s = swipeRef.current
      if (!s.dragging) {
        s.dragging = false
        s.ignored = false
        return
      }
      s.dragging = false
      const elapsed =
        (e.timeStamp || (typeof performance !== 'undefined' ? performance.now() : 0)) -
        s.startTime
      const velocity = elapsed > 0 ? s.deltaX / elapsed : 0
      const surface = mobileSurfaceRef.current
      const sheetWidth = surface?.getBoundingClientRect()?.width || (typeof window !== 'undefined' ? window.innerWidth : 360)
      /** Threshold: 30% of sheet width OR 100px (whichever is smaller — favours quick dismissal on phones). */
      const distanceThreshold = Math.min(100, sheetWidth * 0.3)
      const shouldClose = s.deltaX > distanceThreshold || velocity > 0.5
      if (shouldClose) {
        finishSwipeClose()
      } else {
        finishSwipeSnapback()
      }
    },
    [finishSwipeClose, finishSwipeSnapback],
  )

  const requestDetailClose = useCallback(() => {
    if (mobileLayout) {
      const phase = mobileSheetPhaseRef.current
      if (phase === 'closing') return
      if (phase === 'shown') {
        setMobileSheetPhase('closing')
        return
      }
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

      if (matchesMobileLayoutViewport()) {
        setMobileSheetPhase('opening')
      }

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

  /** CSS `data-mobile-phase` (`enter`|`open`|`exit`). */
  const overlayMobileSlidePhaseAttr =
    mobileSheetPhase === 'shown'
      ? 'open'
      : mobileSheetPhase === 'closing'
        ? 'exit'
        : 'enter'

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
            <div
              className="player-detail-overlay-shell player-detail-overlay-shell--body player-detail-overlay-shell--mobile-sheet"
              role="dialog"
              aria-modal="true"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) requestDetailClose()
              }}
            >
              <div
                ref={mobileSurfaceRef}
                className="player-detail-overlay__surface player-detail-overlay__surface--mobile-sheet-anim"
                data-mobile-phase={overlayMobileSlidePhaseAttr}
                onTransitionEnd={onMobileSheetTransitionEnd}
                onMouseDown={(e) => {
                  e.stopPropagation()
                }}
              >
                <div className="player-detail-overlay__panel player-detail-overlay__panel--pullsheet">
                  <p className="muted">Loading player…</p>
                </div>
              </div>
            </div>
          : desktopSlideChrome(
              <div className="live-player-slide__body live-player-slide__body--player-detail-host">
                <p className="muted">Loading player…</p>
              </div>,
            )
        : squadsErr && bootstrap == null ?
          mobileLayout ?
            <div
              className="player-detail-overlay-shell player-detail-overlay-shell--body player-detail-overlay-shell--mobile-sheet"
              role="dialog"
              aria-modal="true"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) requestDetailClose()
              }}
            >
              <div
                ref={mobileSurfaceRef}
                className="player-detail-overlay__surface player-detail-overlay__surface--mobile-sheet-anim"
                data-mobile-phase={overlayMobileSlidePhaseAttr}
                onTransitionEnd={onMobileSheetTransitionEnd}
                onMouseDown={(e) => {
                  e.stopPropagation()
                }}
              >
                <div className="player-detail-overlay__panel player-detail-overlay__panel--error player-detail-overlay__panel--pullsheet">
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
            <div
              className="player-detail-overlay-shell player-detail-overlay-shell--body player-detail-overlay-shell--mobile-sheet"
              role="dialog"
              aria-modal="true"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) requestDetailClose()
              }}
            >
              <div
                ref={mobileSurfaceRef}
                className="player-detail-overlay__surface player-detail-overlay__surface--mobile-sheet-anim"
                data-mobile-phase={overlayMobileSlidePhaseAttr}
                onTransitionEnd={onMobileSheetTransitionEnd}
                onMouseDown={(e) => {
                  e.stopPropagation()
                }}
              >
                <div className="player-detail-overlay__panel player-detail-overlay__panel--error player-detail-overlay__panel--pullsheet">
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
            className="player-detail-overlay-shell player-detail-overlay-shell--body player-detail-overlay-shell--mobile-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Player detail"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) requestDetailClose()
            }}
          >
            <div
              ref={mobileSurfaceRef}
              className="player-detail-overlay__surface player-detail-overlay__surface--mobile-sheet-anim"
              data-mobile-phase={overlayMobileSlidePhaseAttr}
              onTransitionEnd={onMobileSheetTransitionEnd}
              onTouchStart={onMobileSurfaceTouchStart}
              onTouchMove={onMobileSurfaceTouchMove}
              onTouchEnd={onMobileSurfaceTouchEnd}
              onTouchCancel={onMobileSurfaceTouchEnd}
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
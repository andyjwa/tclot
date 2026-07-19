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
import { computeTeamCardData } from './teamCardStats.js'
import { useOverlayDismissal } from './overlayStack.js'
import { TeamDetailView } from './TeamDetailView.jsx'
import { matchesMobileLayoutViewport, useMobileLayout } from './usePortraitMobile.js'
import './TeamDetailView.css'

const TeamOverlayContext = createContext(null)

/** @returns {{ openTeamDetail: (leagueEntryId: number) => void } | null} */
export function useTeamDetailOverlayOptional() {
  return useContext(TeamOverlayContext)
}

/**
 * A team name that opens the team detail card when clicked. Falls back to a
 * plain span when no provider is mounted or no league entry is known. The click
 * always `stopPropagation`s so it never triggers a parent row handler (e.g. the
 * Standings row-highlight toggle).
 *
 * @param {object} props
 * @param {number | null | undefined} props.leagueEntryId
 * @param {import('react').ReactNode} props.children
 * @param {string} [props.className]
 * @param {string} [props.title]
 */
export function ClickableTeamName({ leagueEntryId, children, className, title }) {
  const overlay = useTeamDetailOverlayOptional()
  const canOpen = overlay != null && leagueEntryId != null
  if (!canOpen) {
    return (
      <span className={className} title={title}>
        {children}
      </span>
    )
  }
  const open = (e) => {
    e.stopPropagation()
    overlay.openTeamDetail(leagueEntryId)
  }
  return (
    <span
      className={`${className ? `${className} ` : ''}tc-team-link`}
      title={title}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open(e)
        }
      }}
    >
      {children}
    </span>
  )
}

/**
 * Slide-in team detail overlay — mirrors {@link PlayerDetailOverlayProvider}'s
 * desktop right-sheet + mobile bottom-swipe animation, but the data is derived
 * synchronously from `leagueEntries` / `matches` (no async fetch). Any descendant
 * can trigger it via {@link useTeamDetailOverlayOptional}.
 */
export function TeamDetailOverlayProvider({
  children,
  /** When this changes (dashboard tab switch), overlay state tears down synchronously. */
  dashboardView = '',
  leagueEntries = [],
  matches = [],
  teamLogoMap = {},
  kitIndexByEntry = {},
  onOpenChange,
}) {
  const data = useMemo(
    () => computeTeamCardData(leagueEntries, matches),
    [leagueEntries, matches],
  )

  const [overlayTeamId, setOverlayTeamId] = useState(null)

  const mobileLayout = useMobileLayout()
  const slideSheetRef = useRef(null)
  const pendingSlideExitFinalizeRef = useRef(false)
  const [slideShellOpen, setSlideShellOpen] = useState(false)
  /** `'opening'` | `'shown'` | `'closing'` — mobile sheet slide phase. */
  const [mobileSheetPhase, setMobileSheetPhase] = useState(null)
  const mobileSheetPhaseRef = useRef(null)
  const mobileSurfaceRef = useRef(null)
  useLayoutEffect(() => {
    mobileSheetPhaseRef.current = mobileSheetPhase
  }, [mobileSheetPhase])

  const closeImmediately = useCallback(() => {
    pendingSlideExitFinalizeRef.current = false
    setSlideShellOpen(false)
    setMobileSheetPhase(null)
    setOverlayTeamId(null)
    onOpenChange?.(false)
  }, [onOpenChange])

  const closeImmediateRef = useRef(closeImmediately)
  useLayoutEffect(() => {
    closeImmediateRef.current = closeImmediately
  }, [closeImmediately])
  const dashboardViewSeenRef = useRef(dashboardView)

  /** Tear down overlay only on real navigations — never on first paint. */
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
      closeImmediately()
    },
    [closeImmediately],
  )

  /* Swipe-right-to-dismiss (mobile). Mirrors PlayerDetailOverlay; drags that
   * originate inside the horizontal team switcher are ignored so scrolling the
   * switcher never dismisses the sheet. */
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
    const insideScrollable = target?.closest('.tc-switch') != null
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
      if (absX < 8 && absY < 8) return
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
      closeImmediately()
      return
    }
    surface.style.transition = 'transform 0.22s cubic-bezier(0.4, 0, 1, 1), opacity 0.22s'
    surface.style.transform = 'translateX(100%)'
    surface.style.opacity = '0'
    const onEnd = (e) => {
      if (e.propertyName !== 'transform') return
      surface.removeEventListener('transitionend', onEnd)
      closeImmediately()
    }
    surface.addEventListener('transitionend', onEnd)
  }, [closeImmediately])

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
      const sheetWidth =
        surface?.getBoundingClientRect()?.width ||
        (typeof window !== 'undefined' ? window.innerWidth : 360)
      const distanceThreshold = Math.min(100, sheetWidth * 0.3)
      const shouldClose = s.deltaX > distanceThreshold || velocity > 0.5
      if (shouldClose) finishSwipeClose()
      else finishSwipeSnapback()
    },
    [finishSwipeClose, finishSwipeSnapback],
  )

  const requestClose = useCallback(() => {
    if (mobileLayout) {
      const phase = mobileSheetPhaseRef.current
      if (phase === 'closing') return
      if (phase === 'shown') {
        setMobileSheetPhase('closing')
        return
      }
      closeImmediately()
      return
    }
    if (!slideShellOpen) {
      closeImmediately()
      return
    }
    pendingSlideExitFinalizeRef.current = true
    setSlideShellOpen(false)
  }, [mobileLayout, slideShellOpen, closeImmediately])

  const onDesktopSlideTransitionEnd = useCallback(
    (e) => {
      if (e.target !== slideSheetRef.current || e.propertyName !== 'transform') return
      if (!pendingSlideExitFinalizeRef.current) return
      closeImmediately()
    },
    [closeImmediately],
  )

  useEffect(() => {
    if (overlayTeamId == null || mobileLayout) return undefined
    setSlideShellOpen(false)
    let innerRaf = null
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => setSlideShellOpen(true))
    })
    return () => {
      cancelAnimationFrame(outerRaf)
      if (innerRaf != null) cancelAnimationFrame(innerRaf)
    }
  }, [overlayTeamId, mobileLayout])

  const openTeamDetail = useCallback(
    (leagueEntryId) => {
      const id = Number(leagueEntryId)
      if (!Number.isFinite(id) || !data || !data.S[id]) return
      setOverlayTeamId(id)
      if (matchesMobileLayoutViewport()) setMobileSheetPhase('opening')
      onOpenChange?.(true)
    },
    [data, onOpenChange],
  )

  const selectTeam = useCallback(
    (leagueEntryId) => {
      const id = Number(leagueEntryId)
      if (!data || !data.S[id]) return
      setOverlayTeamId(id)
    },
    [data],
  )

  const ctxValue = useMemo(() => ({ openTeamDetail }), [openTeamDetail])

  const overlayMobileSlidePhaseAttr =
    mobileSheetPhase === 'shown'
      ? 'open'
      : mobileSheetPhase === 'closing'
        ? 'exit'
        : 'enter'

  const view =
    overlayTeamId != null && data ? (
      <TeamDetailView
        teamId={overlayTeamId}
        data={data}
        onSelectTeam={selectTeam}
        onBack={requestClose}
        teamLogoMap={teamLogoMap}
        kitIndexByEntry={kitIndexByEntry}
      />
    ) : null

  const portalSubtree =
    overlayTeamId != null && data ? (
      <>
        <OverlayEffects onClose={requestClose} />
        {mobileLayout ? (
          <div
            className="player-detail-overlay-shell player-detail-overlay-shell--body player-detail-overlay-shell--mobile-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Team detail"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) requestClose()
            }}
          >
            <div
              ref={mobileSurfaceRef}
              className="player-detail-overlay__surface player-detail-overlay__surface--mobile-sheet-anim tc-overlay__surface"
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
              {view}
            </div>
          </div>
        ) : (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Team detail"
            className={`live-player-slide${slideShellOpen ? ' live-player-slide--open' : ''}`}
          >
            <button
              type="button"
              className="live-player-slide__scrim"
              aria-label="Close team detail"
              onClick={requestClose}
            />
            <div
              ref={slideSheetRef}
              className="live-player-slide__sheet live-player-slide__sheet--team-detail"
              onTransitionEnd={onDesktopSlideTransitionEnd}
              onMouseDown={(e) => {
                e.stopPropagation()
              }}
            >
              {view}
            </div>
          </div>
        )}
      </>
    ) : null

  return (
    <TeamOverlayContext.Provider value={ctxValue}>
      {children}
      {portalSubtree && typeof document !== 'undefined'
        ? createPortal(portalSubtree, document.body)
        : null}
    </TeamOverlayContext.Provider>
  )
}

function OverlayEffects({ onClose }) {
  // Esc / system-back close this overlay only while it is the topmost open
  // overlay (it can stack over the live fixture deck), one layer at a time.
  useOverlayDismissal(true, onClose, 'teamDetail')
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])
  return null
}

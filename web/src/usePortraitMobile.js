import { useEffect, useState } from 'react'

/** Portrait phone layout — Wire tab column caps, position dropdown, etc. */
export const PORTRAIT_MOBILE_MQ = '(max-width: 600px)'

/**
 * Phone-width breakpoint shared by Standings Variant C, the Live GW fixture
 * rows (first-word team names + done indicator), and any other surface that
 * wants the same "is this a phone in portrait/landscape" branch. Slightly
 * wider than {@link PORTRAIT_MOBILE_MQ} so the largest phones / smallest
 * tablets in portrait still pick up the compact-names treatment.
 */
export const MOBILE_NARROW_MQ = '(max-width: 767px)'

/**
 * Below-desktop viewport — phone + tablet (portrait/landscape) where a
 * two-column side-by-side layout no longer reads comfortably. Used by
 * surfaces that want to swap to a tabbed single-column UX across the
 * full below-desktop range (not just narrow phones). Distinct from
 * `PORTRAIT_MOBILE_MQ` so narrow-phone-specific UX (stat-column caps,
 * tap targets in the Wire workbench) stays scoped to ≤600px.
 */
export const NARROW_VIEWPORT_MQ = '(max-width: 880px)'

/** Bottom-nav mobile shell — portrait + landscape phone/tablet narrow */
export const MOBILE_LAYOUT_MQ = '(max-width: 1080px)'

/** Synchronous viewport check for non-hook code paths (overlay open helpers). */
export function matchesMobileLayoutViewport() {
  if (typeof window === 'undefined') return false
  return window.matchMedia(MOBILE_LAYOUT_MQ).matches
}

/**
 * @returns {boolean} true when viewport matches portrait-phone breakpoint
 */
export function usePortraitMobile() {
  const [portrait, setPortrait] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(PORTRAIT_MOBILE_MQ).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const mq = window.matchMedia(PORTRAIT_MOBILE_MQ)
    const onChange = () => setPortrait(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return portrait
}

/**
 * @returns {boolean} true when viewport is below the desktop two-column
 * threshold (≤880px). Use for surfaces that want a tabbed single-column
 * UX across the full below-desktop range (phones + tablets), where the
 * narrow-phone-specific `usePortraitMobile()` (≤600px) would still leave
 * 601–880px in an awkward stacked layout.
 */
export function useNarrowViewport() {
  const [narrow, setNarrow] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(NARROW_VIEWPORT_MQ).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const mq = window.matchMedia(NARROW_VIEWPORT_MQ)
    const onChange = () => setNarrow(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return narrow
}

/**
 * @returns {boolean} true when viewport matches {@link MOBILE_NARROW_MQ}
 * (≤767px). Shared by Standings Variant C and the Live GW fixture rows so
 * both surfaces switch to first-word team names at the same breakpoint.
 */
export function useMobileNarrowViewport() {
  const [narrow, setNarrow] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(MOBILE_NARROW_MQ).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const mq = window.matchMedia(MOBILE_NARROW_MQ)
    const onChange = () => setNarrow(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return narrow
}

/**
 * @returns {boolean} true for mobile layout (portrait or landscape, ≤1080px)
 */
export function useMobileLayout() {
  const [mobile, setMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(MOBILE_LAYOUT_MQ).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const mq = window.matchMedia(MOBILE_LAYOUT_MQ)
    const onChange = () => setMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return mobile
}

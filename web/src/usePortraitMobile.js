import { useEffect, useState } from 'react'

/** Portrait phone layout — Wire tab column caps, position dropdown, etc. */
export const PORTRAIT_MOBILE_MQ = '(max-width: 600px)'

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

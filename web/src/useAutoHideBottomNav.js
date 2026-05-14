import { useEffect, useRef, useState } from 'react'

const MOBILE_NAV_MQ = '(max-width: 1080px)'
const SCROLL_TOP_SHOW = 48
const SCROLL_DOWN_HIDE_AFTER = 80
const DELTA_THRESHOLD = 10

/**
 * Hides fixed bottom nav while scrolling down on mobile; shows on scroll up or near top.
 * @param {{ enabled?: boolean }} options — set false when modals/sheets are open
 */
export function useAutoHideBottomNav({ enabled = true } = {}) {
  const [hidden, setHidden] = useState(false)
  const lastYRef = useRef(0)
  const hiddenRef = useRef(false)

  useEffect(() => {
    hiddenRef.current = hidden
  }, [hidden])

  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) {
      return undefined
    }

    const mq = window.matchMedia(MOBILE_NAV_MQ)
    const onScroll = () => {
      if (!mq.matches) {
        if (hiddenRef.current) setHidden(false)
        return
      }

      const y = window.scrollY
      const delta = y - lastYRef.current

      if (y < SCROLL_TOP_SHOW) {
        if (hiddenRef.current) setHidden(false)
        lastYRef.current = y
        return
      }

      if (delta > DELTA_THRESHOLD && y > SCROLL_DOWN_HIDE_AFTER) {
        if (!hiddenRef.current) setHidden(true)
      } else if (delta < -DELTA_THRESHOLD) {
        if (hiddenRef.current) setHidden(false)
      }

      lastYRef.current = y
    }

    const onMqChange = () => {
      if (!mq.matches) setHidden(false)
    }

    lastYRef.current = window.scrollY
    window.addEventListener('scroll', onScroll, { passive: true })
    mq.addEventListener('change', onMqChange)
    return () => {
      window.removeEventListener('scroll', onScroll)
      mq.removeEventListener('change', onMqChange)
    }
  }, [enabled])

  return enabled ? hidden : false
}

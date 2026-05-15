import { useEffect, useRef } from 'react'

/**
 * Close menus on outside tap — deferred so the opening tap does not immediately dismiss (mobile).
 * @param {import('react').RefObject<HTMLElement | null>} ref
 * @param {boolean} open
 * @param {() => void} onDismiss
 * @param {(target: EventTarget | null) => boolean} [shouldIgnore]
 */
export function useDismissOnOutsidePointer(ref, open, onDismiss, shouldIgnore) {
  const ignoreUntilRef = useRef(0)

  useEffect(() => {
    if (open) {
      ignoreUntilRef.current = Date.now() + 400
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined

    const onDocPointer = (ev) => {
      if (Date.now() < ignoreUntilRef.current) return
      const target = ev.target
      if (shouldIgnore?.(target ?? null)) return
      const root = ref.current
      if (!root) return
      if (target instanceof Node && root.contains(target)) return
      onDismiss()
    }

    const timer = window.setTimeout(() => {
      document.addEventListener('pointerdown', onDocPointer, true)
    }, 0)

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('pointerdown', onDocPointer, true)
    }
  }, [open, onDismiss, ref, shouldIgnore])
}

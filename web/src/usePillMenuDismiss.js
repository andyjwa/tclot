import { useCallback, useEffect } from 'react'
import { useDismissOnOutsidePointer } from './useDismissOnOutsidePointer.js'

/**
 * Outside-tap + Escape dismiss for filter/menu pills.
 * @param {import('react').RefObject<HTMLElement | null>} rootRef
 * @param {boolean} open
 * @param {() => void} onDismiss
 * @param {(target: EventTarget | null) => boolean} [shouldIgnoreOutside]
 */
export function usePillMenuDismiss(rootRef, open, onDismiss, shouldIgnoreOutside) {
  useDismissOnOutsidePointer(rootRef, open, onDismiss, shouldIgnoreOutside)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (ev) => {
      if (ev.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onDismiss])
}

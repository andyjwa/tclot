import { useLayoutEffect } from 'react'

function resolveDom(options = {}) {
  const doc = options.document ?? globalThis.document
  const win = options.window ?? doc?.defaultView ?? globalThis.window
  return { doc, win }
}

function preventTouchMove(event) {
  event.preventDefault()
}

/**
 * Pin the document so iOS Safari cannot rubber-band or scroll behind a
 * static viewport frame. `overflow: hidden` on html/body is not enough.
 */
export function lockDocumentScroll(options) {
  const { doc, win } = resolveDom(options)
  if (!doc?.documentElement || !doc.body || !win) return
  const html = doc.documentElement
  if (html.classList.contains('tclot-scroll-lock')) return

  const scrollY = win.scrollY || win.pageYOffset || 0
  html.dataset.tclotScrollY = String(scrollY)
  html.classList.add('tclot-scroll-lock')
  doc.body.classList.add('tclot-scroll-lock')
  html.style.overflow = 'hidden'
  html.style.height = '100%'
  doc.body.style.overflow = 'hidden'
  doc.body.style.height = '100%'
  doc.body.style.position = 'fixed'
  doc.body.style.top = `-${scrollY}px`
  doc.body.style.left = '0'
  doc.body.style.right = '0'
  doc.body.style.width = '100%'
}

export function unlockDocumentScroll(options) {
  const { doc, win } = resolveDom(options)
  if (!doc?.documentElement || !doc.body || !win) return
  const html = doc.documentElement
  if (!html.classList.contains('tclot-scroll-lock')) return

  const scrollY = Number.parseInt(html.dataset.tclotScrollY || '0', 10) || 0
  html.classList.remove('tclot-scroll-lock')
  doc.body.classList.remove('tclot-scroll-lock')
  html.style.overflow = ''
  html.style.height = ''
  doc.body.style.overflow = ''
  doc.body.style.height = ''
  doc.body.style.position = ''
  doc.body.style.top = ''
  doc.body.style.left = ''
  doc.body.style.right = ''
  doc.body.style.width = ''
  delete html.dataset.tclotScrollY
  win.scrollTo(0, scrollY)
}

export function attachScrollLockTouchGuard(options) {
  const { doc } = resolveDom(options)
  if (!doc?.addEventListener) return () => {}
  doc.addEventListener('touchmove', preventTouchMove, { passive: false })
  return () => {
    doc.removeEventListener('touchmove', preventTouchMove)
  }
}

/** Lock document scroll while `locked` is true (mobile 26/27 hub). */
export function useLockBodyScroll(locked) {
  useLayoutEffect(() => {
    if (!locked) return undefined
    lockDocumentScroll()
    const detach = attachScrollLockTouchGuard()
    return () => {
      detach()
      unlockDocumentScroll()
    }
  }, [locked])
}

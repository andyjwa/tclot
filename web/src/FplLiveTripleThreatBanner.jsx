import { useCallback, useState } from 'react'
import { useMobileLayout } from './usePortraitMobile.js'
import './FplLiveTripleThreatBanner.css'

const MEET_HREF =
  typeof import.meta.env.VITE_MEET_PROMO_LINK === 'string' &&
  import.meta.env.VITE_MEET_PROMO_LINK.trim().startsWith('http')
    ? import.meta.env.VITE_MEET_PROMO_LINK.trim()
    : 'https://meet.google.com/gfh-esfp-xpd'

const DISMISS_SESSION_KEY = 'tclot:fpl-live-triple-promo:dismissed'

/** Triple Threat Meet promo banner (between FPL Live pills and H2H ticker). Shown at all breakpoints. */
export function FplLiveTripleThreatBanner() {
  const mobileLayout = useMobileLayout()
  const [dismissed, setDismissed] = useState(() => {
    if (typeof sessionStorage === 'undefined') return false
    return sessionStorage.getItem(DISMISS_SESSION_KEY) === '1'
  })

  const onDismiss = useCallback(() => {
    try {
      sessionStorage.setItem(DISMISS_SESSION_KEY, '1')
    } catch {
      /* private mode etc. */
    }
    setDismissed(true)
  }, [])

  /* Narrow layout: honor hide-until-next-tab session flag. Wide desktop still shows promo. */
  if (mobileLayout && dismissed) return null

  const basePrefix = `${import.meta.env.BASE_URL ?? '/'}`.replace(/\/?$/, '/')
  const posterSrc = `${basePrefix}promos/triple-threat-live-gw.png`

  return (
    <section className="fpl-live-triple-promo" aria-labelledby="fpl-live-triple-promo-h">
      <div className="fpl-live-triple-promo__img-wrap">
        <h2 id="fpl-live-triple-promo-h" className="fpl-live-triple-promo__sr-only">
          Triple Threat Match championship poster — join Google Meet from the hotspot at the bottom
        </h2>
        <img className="fpl-live-triple-promo__img" src={posterSrc} alt="" />
        {mobileLayout ? (
          <button
            type="button"
            className="fpl-live-triple-promo__dismiss"
            onClick={onDismiss}
            aria-label="Hide Triple Threat banner until you open a new browser tab"
          >
            <span className="fpl-live-triple-promo__dismiss-x" aria-hidden>
              ×
            </span>
          </button>
        ) : null}
        <a
          className="fpl-live-triple-promo__meet"
          href={MEET_HREF}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open Google Meet for Triple Threat (opens in new tab)"
        >
          &nbsp;
        </a>
      </div>
    </section>
  )
}

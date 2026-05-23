import { useEffect, useState } from 'react'
import { tripleThreatPromoIsActive } from './easternWallClockInstant.js'
import { usePortraitMobile } from './usePortraitMobile.js'
import './FplLiveTripleThreatBanner.css'

const MEET_HREF =
  typeof import.meta.env.VITE_MEET_PROMO_LINK === 'string' &&
  import.meta.env.VITE_MEET_PROMO_LINK.trim().startsWith('http')
    ? import.meta.env.VITE_MEET_PROMO_LINK.trim()
    : 'https://meet.google.com/gfh-esfp-xpd'

/** Live GW portrait-only banner; hidden after Eastern tomorrow 11:15 (`tripleThreatPromoIsActive`). */
export function FplLiveTripleThreatBanner() {
  const portrait = usePortraitMobile()
  const [, rerenderExpiry] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => rerenderExpiry((n) => n + 1), 30 * 1000)
    return () => window.clearInterval(id)
  }, [])

  const active = portrait && tripleThreatPromoIsActive()

  if (!active) return null

  const basePrefix = `${import.meta.env.BASE_URL ?? '/'}`.replace(/\/?$/, '/')
  const posterSrc = `${basePrefix}promos/triple-threat-live-gw.png`

  return (
    <section className="fpl-live-triple-promo" aria-labelledby="fpl-live-triple-promo-h">
      <div className="fpl-live-triple-promo__img-wrap">
        <h2 id="fpl-live-triple-promo-h" className="fpl-live-triple-promo__sr-only">
          Triple Threat Match championship poster — join Google Meet from the hotspot at the bottom
        </h2>
        <img className="fpl-live-triple-promo__img" src={posterSrc} alt="" />
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

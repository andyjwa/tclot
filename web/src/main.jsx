import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './PaintPreview.css'
import App from './App.jsx'
import { Mockup } from './Mockup.jsx'
import { GameweekStatesMockup } from './GameweekStatesMockup.jsx'
import { RebrandGallery } from './RebrandGallery.jsx'
import { SeedLabelMockup } from './SeedLabelMockup.jsx'
import { TradePillsMockup } from './TradePillsMockup.jsx'

// Local-only design preview (no production impact).
// Visit `?mockup=1` to render the design system mockup instead of the live app.
const isRebrandGallery =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('rebrand') === '1'
const isMockup =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('mockup') === '1'
const isGameweekStatesMockup =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('gwstates') === '1'
const isSeedLabelMockup =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('seed') === '1'
const isTradePillsMockup =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('tradepills') === '1'

// "Scorebook" theme (PaintPreview.css) — token-level coat of paint on the
// real app. Now the DEFAULT for everyone. `?paint=0` is a kill switch that
// sticks via localStorage; `?paint=1` re-enables (clears the kill switch).
// `?theme=light|dark|system` force-sets the stored colour theme, mainly
// for screenshots/review.
if (typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.search)
  const paint = params.get('paint')
  let paintOn = true
  try {
    if (paint === '1') localStorage.removeItem('tclot-paint')
    else if (paint === '0') localStorage.setItem('tclot-paint', '0')
    const theme = params.get('theme')
    if (theme === 'light' || theme === 'dark' || theme === 'system') {
      localStorage.setItem('tclot-theme', theme)
    }
    if (localStorage.getItem('tclot-paint') === '0') paintOn = false
  } catch {
    /* storage unavailable (private mode) — theme stays on by default */
  }
  if (paintOn) {
    document.body.dataset.tclotPaint = '1'
    // Browser chrome / iOS status bar: match the racing-green header band.
    // (index.html defaults to #17402f too, so this is a no-op kept for
    // robustness while the kill switch exists.)
    document
      .querySelector("meta[name='theme-color']")
      ?.setAttribute('content', '#17402f')
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isRebrandGallery
      ? <RebrandGallery />
      : isTradePillsMockup
        ? <TradePillsMockup />
        : isSeedLabelMockup
          ? <SeedLabelMockup />
          : isGameweekStatesMockup
            ? <GameweekStatesMockup />
            : isMockup
              ? <Mockup />
              : <App />}
  </StrictMode>,
)

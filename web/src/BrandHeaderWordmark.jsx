/**
 * BrandHeaderWordmark — turns the brand-header `TCLOT` wordmark into a
 * disclosure button that opens the League Info modal. Visually it
 * preserves the gradient pill (lion icon + white wordmark) from
 * `.brand-header__pill` unchanged — no extra affordance glyphs.
 *
 * Disclosure semantics: `aria-haspopup="dialog"` + `aria-controls` point
 * at the LeagueInfoModal (id `league-info-modal`); `aria-expanded` is
 * driven by the parent so screen readers announce open/closed state.
 */
import './BrandHeaderWordmark.css'

/**
 * @param {{
 *   label: string,
 *   icon?: React.ReactNode,
 *   isOpen?: boolean,
 *   onOpen: () => void,
 * }} props
 */
export function BrandHeaderWordmark({ label, icon, isOpen = false, onOpen }) {
  return (
    <button
      type="button"
      className="brand-header__pill brand-header-wordmark"
      aria-label={`Open League Info — ${label}`}
      aria-haspopup="dialog"
      aria-controls="league-info-modal"
      aria-expanded={isOpen}
      onClick={onOpen}
    >
      {icon}
      <span className="brand-header__wordmark">{label}</span>
    </button>
  )
}

/**
 * LeagueInfoModal — disclosure target for the BrandHeaderWordmark
 * trigger. Renders the LP-C "sectioned cards on themed background"
 * layout from the design exploration (see `LiVariantC` in
 * `web/src/Mockup.jsx`). Layout:
 *
 *   1. Hero card        — a single branded header banner
 *                         (`/brand/tclot-header.jpg`) that carries the
 *                         TCLOT lion logo, the wordmark, the "Tri-
 *                         Continental League of Titans" subtitle, and the
 *                         three country flags in one 16:9 image. It
 *                         replaced the earlier belt + <h1> + flag-row
 *                         composition.
 *   2. Tab strip        — Lingo · Teams · Managers · Settings.
 *                         The site-standard `.subnav` segmented pill row
 *                         (same look as the Heritage / Standings sub-
 *                         tabs) that gates the four content cards beneath
 *                         it. Default landing tab is `terminology`
 *                         (Lingo); resets on close.
 *   3. Active tab card  — exactly one of the four panels is rendered
 *                         per the `activeTab` state:
 *                           • Roster      — 2-up team-crest grid
 *                           • Managers    — full names + crests
 *                           • Terminology — league-canon glossary
 *                           • Settings    — `<SettingsPanelBody>`
 *                                            (shared with /settings)
 *   4. Footer           — tiny credit / version line
 *
 * The modal portals onto `document.body` (so it clears the
 * `.app.fotmob` stacking context). All design tokens used by the
 * `.li-*` styles imported from `Mockup.css` are mirrored on the shell
 * selector in `LeagueInfoModal.css` — same trick as
 * `.live-player-slide` in `App.css`.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TeamAvatar } from './TeamAvatar'
import { SettingsPanelBody } from './SettingsPage'
import './LeagueInfoModal.css'

/** Tab order — matches the order requested by the user (Lingo first).
 * The default landing tab is `terminology` (the league-canon glossary,
 * surfaced as "Lingo"); the full set is exposed as the site-standard
 * `.subnav` segmented pill row in the modal body. Internal `id`s are
 * kept stable so the content-panel gating + aria wiring don't change. */
const LI_TABS = /** @type {const} */ ([
  { id: 'terminology', label: 'Lingo' },
  { id: 'roster',      label: 'Teams' },
  { id: 'managers',    label: 'Managers' },
  { id: 'settings',    label: 'Settings' },
])

/**
 * League-canon terminology. Order is roughly grouped by theme: scoring /
 * GW outcomes first, then season-arc accolades, then manager-personality
 * jokes. Definitions are quoted verbatim from the league chat so the
 * voice stays authentic.
 */
const TCLOT_TERMS = [
  { term: 'Villains Victory',     def: 'Winning with the 7th highest score of the GW.' },
  { term: 'Heroes Defeat',        def: 'Losing with the 2nd highest score of the GW.' },
  { term: 'The Motty',            def: 'Winning thanks to a bench player coming in.' },
  { term: 'Douchebag Sneak',      def: 'Winning with the 5th highest score.' },
  { term: 'Stallions Stalemate',  def: 'The top 2 scorers of the GW drawing.' },
  { term: 'The Ream',             def: 'Picking an insanely poor first waiver.' },
  { term: 'The Sancho',           def: 'Terrible first draft pick.' },
  { term: 'La Decima',            def: 'The first to win 10 game weeks in a season.' },
  { term: 'The Golden Circuit',   def: 'Defeating all other seven managers consecutively.' },
  { term: 'La Gran Vergüenza',    def: 'Losing to all other seven managers consecutively.' },
  { term: 'Box Office',           def: 'Michael Alan Sutton and his ability to mince through life while consistently meeting the highest levels of glory.' },
  { term: 'Grumpy Goodacre',      def: "Declaring your chances in a GW over when they're clearly not." },
  { term: 'Dr Ward',              def: 'Declaring a player heading off injured in a wildly incorrect manner.' },
  { term: 'TTAT',                 def: 'Tery Talks About Tery — when Webster pops up to chime in about his own team in spite of the chatter at the time.' },
]

/**
 * Returns up to `count` leading initials of `text`. Used for the
 * crest/avatar fallback letters.
 * @param {string} text
 * @param {number} [count]
 */
function liInitials(text, count = 2) {
  return String(text)
    .split(/\s+/)
    .slice(0, count)
    .map((w) => w[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
}

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   leagueEntries?: Array<{ id: number, entry_name?: string, player_first_name?: string, player_last_name?: string }>,
 *   teamLogoMap?: Record<string|number, string>,
 *   kitIndexByEntry?: Record<string|number, number>,
 *   gw?: number | null,
 *   themePref: 'light' | 'dark' | 'system',
 *   onThemePrefChange: (t: 'light' | 'dark' | 'system') => void,
 *   defaultTab: string,
 *   onDefaultTabChange: (id: string) => void,
 * }} props
 */
export function LeagueInfoModal({
  open,
  onClose,
  leagueEntries = [],
  teamLogoMap = {},
  kitIndexByEntry = {},
  gw, // eslint-disable-line no-unused-vars -- kept for caller-API stability
  themePref,
  onThemePrefChange,
  defaultTab,
  onDefaultTabChange,
}) {
  const closeBtnRef = useRef(null)
  const modalRef = useRef(null)
  /* Active tab inside the modal body — Lingo (`terminology`) on first
   * open, then sticky for the lifetime of the open instance (resets when
   * the modal is dismissed and re-opened so the user always lands on the
   * glossary first). */
  const [activeTab, setActiveTab] = useState(/** @type {string} */ ('terminology'))
  useEffect(() => {
    if (!open) setActiveTab('terminology')
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const previousActive = typeof document !== 'undefined' ? document.activeElement : null

    /** ESC closes the modal — standard dialog behavior. */
    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      /** Focus trap — Tab / Shift+Tab cycle inside the modal so
       * keyboard users can't tab into the page behind. */
      if (e.key !== 'Tab') return
      const root = modalRef.current
      if (!root) return
      const focusables = root.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)

    /** Move focus to the close button on open. */
    const t = window.setTimeout(() => {
      closeBtnRef.current?.focus()
    }, 0)

    /** Lock body scroll while the modal is open (mobile sheet UX). */
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
      document.body.style.overflow = prevOverflow
      if (previousActive && typeof previousActive.focus === 'function') {
        try { previousActive.focus() } catch { /* ignore */ }
      }
    }
  }, [open, onClose])

  if (!open) return null

  /* Stable ordering: by `league_entry` id ascending — the standings
   * order changes week-to-week, but this list is "the league roster",
   * which is fixed. */
  const sortedEntries = [...(leagueEntries ?? [])]
    .filter((e) => e?.id != null)
    .sort((a, b) => Number(a.id) - Number(b.id))

  const body = (
    <div
      className="league-info-modal-shell"
      role="dialog"
      aria-modal="true"
      aria-labelledby="league-info-modal-title"
      id="league-info-modal"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={modalRef}
        className="league-info-modal li-modal li-modal--lp-c"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          ref={closeBtnRef}
          type="button"
          className="li-modal__close league-info-modal__close"
          aria-label="Close League Info"
          onClick={onClose}
        >
          ×
        </button>

        <div className="li-modal__body li-modal__body--scroll">
          {/* Hero — single branded header banner (`/brand/tclot-header.jpg`)
              that already carries the TCLOT lion logo, the wordmark, the
              "Tri-Continental League of Titans" subtitle, and the three
              country flags. It replaces the former belt + <h1> + flag row.
              The img keeps `id="league-info-modal-title"` so the dialog's
              `aria-labelledby` still resolves to an accessible name (via
              the `alt` text). */}
          <div className="li-card li-card--hero">
            <div className="li-hero li-hero--banner">
              <img
                className="li-hero__banner"
                src="/brand/tclot-header.jpg"
                alt="TCLOT — Tri-Continental League of Titans"
                id="league-info-modal-title"
              />
            </div>
          </div>

          {/* Tab strip — Lingo · Teams · Managers · Settings.
              Built as a `role="tablist"` so screen readers announce
              the disclosure pattern. Reuses the site-standard `.subnav`
              segmented-pill classes (same as the Heritage / Standings
              sub-tabs) so the modal switcher matches the rest of the
              site. The `li-subnav` modifier adds only minimal scoping
              (left-align + horizontal scroll on narrow viewports). */}
          <div
            className="subnav li-subnav"
            role="tablist"
            aria-label="League info sections"
          >
            {LI_TABS.map((tab) => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`li-tab-${tab.id}`}
                  aria-selected={active}
                  aria-controls={`li-tabpanel-${tab.id}`}
                  className={'subnav__tab' + (active ? ' subnav__tab--active' : '')}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Teams tab (`roster`) — 8-team grid with crests + names. */}
          {activeTab === 'roster' ? (
            <div
              className="li-card li-card--badges"
              role="tabpanel"
              id="li-tabpanel-roster"
              aria-labelledby="li-tab-roster"
            >
              <div className="li-card__eyebrow">League Roster</div>
              {sortedEntries.length === 0 ? (
                <p className="league-info-modal__placeholder">League data not loaded yet.</p>
              ) : (
                <div className="li-badges-grid league-info-modal__badges-grid">
                  {sortedEntries.map((e) => {
                    const teamName = e.entry_name ?? '—'
                    return (
                      <div className="li-badge" key={e.id}>
                        <div className="li-badge__crest league-info-modal__badge-crest">
                          <TeamAvatar
                            entryId={e.id}
                            name={teamName}
                            size="md"
                            logoMap={teamLogoMap}
                            kitIndexByEntry={kitIndexByEntry}
                            badgeFallback
                          />
                        </div>
                        <div className="li-badge__name">{teamName}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : null}

          {/* Managers tab — full names + team descriptor. */}
          {activeTab === 'managers' ? (
            <div
              className="li-card li-card--managers"
              role="tabpanel"
              id="li-tabpanel-managers"
              aria-labelledby="li-tab-managers"
            >
              <div className="li-card__eyebrow">Managers</div>
              {sortedEntries.length === 0 ? (
                <p className="league-info-modal__placeholder">League data not loaded yet.</p>
              ) : (
                <div className="li-managers-list">
                  {sortedEntries.map((e) => {
                    const teamName = e.entry_name ?? '—'
                    const mgr = `${e.player_first_name ?? ''} ${e.player_last_name ?? ''}`.trim() || '—'
                    return (
                      <div className="li-mgr-row" key={e.id}>
                        <div className="li-mgr-row__avatar league-info-modal__mgr-avatar">
                          <TeamAvatar
                            entryId={e.id}
                            name={teamName}
                            size="sm"
                            logoMap={teamLogoMap}
                            kitIndexByEntry={kitIndexByEntry}
                            badgeFallback
                          />
                        </div>
                        <div className="li-mgr-row__body">
                          <div className="li-mgr-row__name">{mgr}</div>
                          <div className="li-mgr-row__descriptor" title={teamName}>{teamName}</div>
                        </div>
                        <div className="li-mgr-row__initials" aria-hidden>
                          {liInitials(mgr)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : null}

          {/* Terminology tab — league-canon glossary. */}
          {activeTab === 'terminology' ? (
            <div
              className="li-card li-card--terminology"
              role="tabpanel"
              id="li-tabpanel-terminology"
              aria-labelledby="li-tab-terminology"
            >
              <div className="li-card__eyebrow">TCLOT Terminology</div>
              <dl className="li-terms">
                {TCLOT_TERMS.map((t) => (
                  <div className="li-term" key={t.term}>
                    <dt className="li-term__name">{t.term}</dt>
                    <dd className="li-term__def">{t.def}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          {/* Settings tab — embeds the standalone /settings route's
              SettingsPanelBody so the two surfaces never drift. */}
          {activeTab === 'settings' ? (
            <div
              className="li-card li-card--settings"
              role="tabpanel"
              id="li-tabpanel-settings"
              aria-labelledby="li-tab-settings"
            >
              <div className="li-card__eyebrow">Settings</div>
              <SettingsPanelBody
                themePref={themePref}
                onThemePrefChange={onThemePrefChange}
                defaultTab={defaultTab}
                onDefaultTabChange={onDefaultTabChange}
              />
            </div>
          ) : null}

          {/* Footer */}
          <div className="li-footer">
            TCLOT · 2025/26 ·{' '}
            <span className="league-info-modal__footer-version">
              {String(import.meta.env.VITE_LEAGUE_DATA_REVISION ?? 'dev').trim() || 'dev'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return body
  return createPortal(body, document.body)
}

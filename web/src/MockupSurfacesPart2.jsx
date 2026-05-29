/*
 * TCLOT Design Mockup — Part 2 surfaces
 *
 * Staged separately from `Mockup.jsx` so a sibling subagent can keep editing
 * `Mockup.jsx` / `Mockup.css` without merge conflicts. NONE of this file is
 * wired into the live mockup yet — the composition step (importing into the
 * showcase) is handled in a follow-up after both subagents finish.
 *
 * Surfaces in this file:
 *   1. Trophy room          (desktop + portrait, full-bleed gallery)
 *   2. Schedule             (portrait single-team mode + compact alt + desktop note)
 *   3. Standings            (portrait card list + ultra-compact alt + desktop polish)
 *   4. Waivers / Pickups / Drops / Tenure (portrait activity feed + desktop dense)
 *   5. Trades               (portrait card list)
 *
 * Class-name namespaces used:
 *   mockup-trophy-*, mockup-schedule-*, mockup-standings-*,
 *   mockup-waivers-*, mockup-trades-*
 *
 * Reuses these atoms from Mockup.css (do NOT redefine here):
 *   .mockup-portrait-page  (+ __h, __h-title, __h-meta, __sticky, __filters)
 *   .mockup-portrait-row / __col / __col__h / -frame / -frame__screen
 *   .mockup-filter-pill (+ --sm, --active, __label, __value, __caret)
 *   .mockup-subnav (+ __tab, __count)
 *   tokens: --space-*, --text-*, --r-*, --brand, --bg, --surface, --surface-2,
 *           --border, --text, --text-strong, --text-muted, --row-hi,
 *           --data-positive, --data-negative, --data-neutral
 */

import { Fragment, useState } from 'react'
import './MockupSurfacesPart2.css'

/* ================================================================== */
/* Local helper copies                                                  */
/* ------------------------------------------------------------------ */
/* These are intentionally duplicated from Mockup.jsx because that file */
/* does not currently export them. Keep them tiny + clearly marked so   */
/* the integration step knows what to reconcile.                        */
/* ================================================================== */

// local copy of helper from Mockup.jsx — see integration TODO
const PL_CODE = {
  LIV: 14, MCI: 43, ARS: 3,  CHE: 8,  BOU: 91, BRE: 94, NEW: 4,  MUN: 1,
  AVL: 7,  TOT: 6,  CRY: 31, BHA: 36, EVE: 11, NFO: 17, WHU: 21, FUL: 54,
  SUN: 56, BUR: 90, LEE: 2,  WOL: 39, IPS: 40,
}

// local copy of helper from Mockup.jsx — see integration TODO
function plCrestUrl(teamCode) {
  if (!teamCode) return null
  return `https://resources.premierleague.com/premierleague/badges/70/t${teamCode}.png`
}

// local copy of helper from Mockup.jsx — see integration TODO
function ClubCrest({ club, size = 24, className = 'mockup-trophy__crest-img' }) {
  const code = PL_CODE[club]
  return (
    <span className={className} style={{ width: size, height: size }}>
      {code ? (
        <img src={plCrestUrl(code)} alt={club} loading="lazy" decoding="async" />
      ) : (
        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)' }}>{club}</span>
      )}
    </span>
  )
}

// local copy of helper from Mockup.jsx — see integration TODO
function PortraitPageHeader({ title, meta }) {
  return (
    <div className="mockup-portrait-page__h">
      <span className="mockup-portrait-page__h-title">{title}</span>
      {meta && <span className="mockup-portrait-page__h-meta">{meta}</span>}
    </div>
  )
}

// local copy of helper from Mockup.jsx — see integration TODO
function CaretIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// local copy of helper from Mockup.jsx — see integration TODO
function PortraitFrame({ children }) {
  return (
    <div className="mockup-portrait-frame">
      <div className="mockup-portrait-frame__screen">{children}</div>
    </div>
  )
}

/* Small action icons (used by waivers + trades feed). Inline SVG, no emoji. */
function IconPlus(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
function IconMinus(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
function IconSwap(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7 7h11" />
      <polyline points="14 3 18 7 14 11" />
      <path d="M17 17H6" />
      <polyline points="10 21 6 17 10 13" />
    </svg>
  )
}
function IconCrown(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" {...props}>
      <path d="M3 7l4 3 5-6 5 6 4-3-2 12H5L3 7zm2 13h14v1H5z" />
    </svg>
  )
}
function IconArrow(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </svg>
  )
}

/* ================================================================== */
/* Shared league data (real 8 teams from details.json)                  */
/* ================================================================== */

const TEAMS_2025 = [
  { code: 'CO', name: 'Crouch End Oashisu',   manager: 'David',  slug: 'crouch-end-oashisu' },
  { code: 'SC', name: 'Seoul Club 7',          manager: 'Luke',   slug: 'seoul-club-7',   live: true },
  { code: 'TO', name: 'Toronto Oizo',          manager: 'Andy',   slug: 'toronto-oizo'   },
  { code: 'HY', name: 'Hanson of York AFC',    manager: 'Nick G', slug: 'hanson-of-york' },
  { code: 'HM', name: 'Hackney Meat Loaf',     manager: 'Nick M', slug: 'hackney-meat-loaf' },
  { code: 'CC', name: 'Clapton Cornershop',    manager: 'Mike',   slug: 'clapton-cornershop' },
  { code: 'MJ', name: 'Morpeth Jamiroquai',    manager: 'Jon',    slug: 'morpeth-jamiroquai' },
  { code: 'BM', name: 'Brampton II Men',       manager: 'Eddy',   slug: 'brampton-ii-men' },
]

function findTeam(code) {
  return TEAMS_2025.find((t) => t.code === code) ?? TEAMS_2025[0]
}

/* ================================================================== */
/* 1. Trophy room                                                       */
/* ------------------------------------------------------------------ */
/* Lives under the Hall section as a dedicated sub-nav.                 */
/* Each plaque frames the uploaded banner artwork (which already        */
/* contains the team name + season) and adds only the context the       */
/* artwork doesn't carry: manager + championship-order pip.             */
/* ================================================================== */

/**
 * Champions with uploaded banners. Only renders seasons that have a
 * designed banner/logo at /web/public/hall-champions/{image}.png. The
 * card text deliberately stays minimal — no team name, no standalone
 * season label — because the banner art already carries both. We only
 * add what the art doesn't: who managed the team, and which title in
 * that manager's chronological order this is.
 */
const TROPHY_SEASONS = [
  { season: '2025/26', team: 'Crouch End Oashisu',   manager: 'David Higman',     champNumber: '1st', image: 'crouch-end-oashisu' },
  { season: '2024/25', team: 'Soul Ze Moles',        manager: 'Luke Butcher',     champNumber: '1st', image: 'soul-ze-moles' },
  { season: '2023/24', team: 'Toronto Wiggum',       manager: 'Andy Ward',        champNumber: '1st', image: 'toronto-wiggum' },
  { season: '2022/23', team: 'Dalston Benoit',       manager: 'Nick Mottershead', champNumber: '2nd', image: 'dalston-benoit' },
  { season: '2021/22', team: 'Dalston Bellsprouts',  manager: 'Nick Mottershead', champNumber: '1st', image: 'dalston-bellsprouts' },
  { season: '2020/21', team: 'Essex Ratigans',       manager: 'Mike Sutton',      champNumber: '1st', image: 'essex-ratigans' },
]

/** Hall sub-nav. Trophy room active. */
function TrophyHallSubnav() {
  const tabs = [
    { id: 'champions',  label: 'Champions' },
    { id: 'trophy',     label: 'Trophy room', active: true },
  ]
  return (
    <div className="mockup-trophy__subnav" role="tablist" aria-label="Hall sections">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={!!t.active}
          className={'mockup-trophy__subnav-tab' + (t.active ? ' is-active' : '')}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

/**
 * One plaque card. Two elements top-to-bottom:
 *   1. Eyebrow strip: manager name in brand violet + championship-order pip
 *   2. Image well: framed banner artwork (object-fit: contain) — team name
 *      and season live in the artwork itself, no need to repeat them.
 *
 * Used in both desktop grid and portrait stack — single shared card spec.
 */
/* `variant` controls the accent treatment applied via a wrapper class:
 *   undefined / 'violet' → current 2px brand-violet top line
 *   'gold'               → 2px muted-gold top line
 *   'glow'               → no top line; soft brand-tinted hover glow
 *   'trophy-svg'         → tiny monochrome trophy SVG in top-right
 * Image-well aspect ratio + grid layout are NOT controlled here — that's
 * the responsibility of Variant Set 3's grid-variant classes. */
function TrophyPlaque({ s, variant }) {
  const variantClass = variant ? ` mockup-trophy__variant-${variant}` : ''
  return (
    <article className={'mockup-trophy__card' + variantClass}>
      <div className="mockup-trophy__card-eyebrow">
        <span className="mockup-trophy__card-eyebrow-label">{s.manager}</span>
        <span className="mockup-trophy__card-eyebrow-pip">{s.champNumber}</span>
      </div>
      {variant === 'trophy-svg' && (
        <svg
          className="mockup-trophy__variant-trophy-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>
      )}
      <div className="mockup-trophy__card-image">
        <img
          src={`/hall-champions/${s.image}.png`}
          alt={`${s.team} — ${s.season} champion banner`}
          loading="lazy"
          decoding="async"
        />
      </div>
    </article>
  )
}

export function TrophyRoomDesktop() {
  return (
    <div className="mockup-trophy">
      <TrophyHallSubnav />
      <div className="mockup-trophy__gallery">
        {TROPHY_SEASONS.map((s) => (
          <TrophyPlaque key={s.season} s={s} />
        ))}
      </div>
    </div>
  )
}

export function TrophyRoomPortrait() {
  return (
    <div className="mockup-portrait-page">
      <PortraitPageHeader title="Trophy room" meta="Hall · est. 2020" />
      <div className="mockup-trophy-p__hall-tabs" role="tablist" aria-label="Hall sections">
        {[
          { id: 'champions', label: 'Champions' },
          { id: 'trophy',    label: 'Trophy room', active: true },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={!!t.active}
            className={'mockup-trophy-p__hall-tab' + (t.active ? ' is-active' : '')}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mockup-trophy-p__gallery">
        {TROPHY_SEASONS.map((s) => (
          <TrophyPlaque key={s.season} s={s} />
        ))}
      </div>
    </div>
  )
}

/* ================================================================== */
/* 2. Schedule — portrait single-team + compact alt + desktop note      */
/* ================================================================== */

const SCHEDULE_TEAM_CODE = 'BM'
const SCHEDULE_HOME_TEAM = findTeam(SCHEDULE_TEAM_CODE)

/** Row shape: gw, opponent code, venue 'H'/'A', pf, pa, status. */
const SCHEDULE_ROWS = [
  // First half
  { gw:  1, opp: 'CC', venue: 'H', pf: 58, pa: 64, status: 'final' },
  { gw:  2, opp: 'CO', venue: 'A', pf: 71, pa: 65, status: 'final' },
  { gw:  3, opp: 'TO', venue: 'H', pf: 49, pa: 52, status: 'final' },
  { gw:  4, opp: 'SC', venue: 'A', pf: 55, pa: 72, status: 'final' },
  { gw:  5, opp: 'HY', venue: 'H', pf: 63, pa: 60, status: 'final' },
  { gw:  6, opp: 'HM', venue: 'A', pf: 48, pa: 51, status: 'final' },
  { gw:  7, opp: 'MJ', venue: 'H', pf: 67, pa: 41, status: 'final' },
  { gw:  8, opp: 'CC', venue: 'A', pf: 53, pa: 55, status: 'final' },
  { gw:  9, opp: 'CO', venue: 'H', pf: 70, pa: 68, status: 'final' },
  { gw: 10, opp: 'TO', venue: 'A', pf: 44, pa: 59, status: 'final' },
  { gw: 11, opp: 'SC', venue: 'H', pf: 62, pa: 66, status: 'final' },
  { gw: 12, opp: 'HY', venue: 'A', pf: 51, pa: 57, status: 'final' },
  { gw: 13, opp: 'HM', venue: 'H', pf: 58, pa: 55, status: 'final' },
  { gw: 14, opp: 'MJ', venue: 'A', pf: 65, pa: 49, status: 'final' },
  // Second half
  { gw: 15, opp: 'CC', venue: 'H', pf: 60, pa: 62, status: 'final' },
  { gw: 16, opp: 'CO', venue: 'A', pf: 47, pa: 71, status: 'final' },
  { gw: 17, opp: 'TO', venue: 'H', pf: 73, pa: 50, status: 'final' },
  { gw: 18, opp: 'SC', venue: 'A', pf: 52, pa: 68, status: 'final' },
  { gw: 19, opp: 'HY', venue: 'H', pf: 64, pa: 59, status: 'final' },
  { gw: 20, opp: 'HM', venue: 'A', pf: 56, pa: 53, status: 'final' },
  { gw: 21, opp: 'MJ', venue: 'H', pf: 69, pa: 44, status: 'final' },
  { gw: 22, opp: 'CC', venue: 'A', pf: 50, pa: 57, status: 'final' },
  { gw: 23, opp: 'CO', venue: 'H', pf: 61, pa: 70, status: 'final' },
  { gw: 24, opp: 'TO', venue: 'A', pf: 58, pa: 54, status: 'final' },
  { gw: 25, opp: 'SC', venue: 'H', pf: 49, pa: 73, status: 'final' },
  { gw: 26, opp: 'HY', venue: 'A', pf: 55, pa: 58, status: 'final' },
  { gw: 27, opp: 'HM', venue: 'H', pf: 67, pa: 52, status: 'final' },
  { gw: 28, opp: 'MJ', venue: 'A', pf: 41, pa: 38, status: 'live'  },
  // Upcoming GWs
  { gw: 29, opp: 'CC', venue: 'H', pf: null, pa: null, status: 'upcoming' },
  { gw: 30, opp: 'CO', venue: 'A', pf: null, pa: null, status: 'upcoming' },
  { gw: 31, opp: 'TO', venue: 'H', pf: null, pa: null, status: 'upcoming' },
  { gw: 32, opp: 'SC', venue: 'A', pf: null, pa: null, status: 'upcoming' },
]

const SCHEDULE_SEGMENTS = [
  { id: 'first',    label: 'First half',  range: [1, 14] },
  { id: 'second',   label: 'Second half', range: [15, 28] },
]

function resultFor(row) {
  if (row.status === 'upcoming') return null
  if (row.pf == null || row.pa == null) return null
  if (row.pf > row.pa) return 'W'
  if (row.pf < row.pa) return 'L'
  return 'T'
}

function computeRecordStrip(rows) {
  let w = 0, l = 0, t = 0
  let pf = 0, pa = 0
  const finished = rows.filter((r) => r.status === 'final')
  for (const r of finished) {
    const res = resultFor(r)
    if (res === 'W') w++
    else if (res === 'L') l++
    else if (res === 'T') t++
    pf += r.pf
    pa += r.pa
  }
  // streak — walk back from the latest finished row
  let streak = '—'
  const last = finished[finished.length - 1]
  if (last) {
    const lastRes = resultFor(last)
    let count = 0
    for (let i = finished.length - 1; i >= 0; i--) {
      if (resultFor(finished[i]) === lastRes) count++
      else break
    }
    streak = `${lastRes}${count}`
  }
  const avg = finished.length ? (pf / finished.length).toFixed(1) : '—'
  return { w, l, t, pf, pa, avg, streak, played: finished.length }
}

export function SchedulePortrait() {
  const [teamCode, setTeamCode] = useState(SCHEDULE_TEAM_CODE)
  const team = findTeam(teamCode)
  const rec = computeRecordStrip(SCHEDULE_ROWS)

  return (
    <div className="mockup-portrait-page">
      <PortraitPageHeader title="Schedule" meta={`2025/26 · ${rec.played}/38`} />
      <div className="mockup-portrait-page__filters">
        <span className="mockup-popover-host">
          <button
            type="button"
            className="mockup-filter-pill mockup-filter-pill--sm mockup-filter-pill--active"
            aria-haspopup="listbox"
          >
            <span className="mockup-filter-pill__label">Team</span>
            <span className="mockup-filter-pill__value">{team.name}</span>
            <CaretIcon className="mockup-filter-pill__caret" />
          </button>
        </span>
        <button type="button" className="mockup-filter-pill mockup-filter-pill--sm">
          <span className="mockup-filter-pill__label">View</span>
          <span className="mockup-filter-pill__value">Detailed</span>
          <CaretIcon className="mockup-filter-pill__caret" />
        </button>
      </div>
      <div className="mockup-schedule-p__strip">
        <div className="mockup-schedule-p__strip-cell">
          <span className="mockup-schedule-p__strip-v">{rec.w}-{rec.l}-{rec.t}</span>
          <span className="mockup-schedule-p__strip-k">W-L-T</span>
        </div>
        <div className="mockup-schedule-p__strip-cell">
          <span className={
            'mockup-schedule-p__strip-v'
            + (rec.streak.startsWith('W') ? ' is-pos' : rec.streak.startsWith('L') ? ' is-neg' : '')
          }>
            {rec.streak}
          </span>
          <span className="mockup-schedule-p__strip-k">Streak</span>
        </div>
        <div className="mockup-schedule-p__strip-cell">
          <span className="mockup-schedule-p__strip-v">{rec.avg}</span>
          <span className="mockup-schedule-p__strip-k">Avg pts</span>
        </div>
      </div>
      <div className="mockup-schedule-p__list">
        {SCHEDULE_SEGMENTS.map((seg) => {
          const segRows = SCHEDULE_ROWS.filter((r) => r.gw >= seg.range[0] && r.gw <= seg.range[1])
          if (!segRows.length) return null
          return (
            <Fragment key={seg.id}>
              <div className="mockup-schedule-p__segment">{seg.label}</div>
              {segRows.map((r) => {
                const opp = findTeam(r.opp)
                const res = resultFor(r)
                return (
                  <div
                    key={r.gw}
                    className={
                      'mockup-schedule-p__row'
                      + (r.status === 'live' ? ' is-live' : '')
                      + (r.status === 'upcoming' ? ' is-upcoming' : '')
                    }
                  >
                    <div className="mockup-schedule-p__gw-col">
                      <span className="mockup-schedule-p__gw">GW{String(r.gw).padStart(2, '0')}</span>
                      <span
                        className={
                          'mockup-schedule-p__status-dot'
                          + (r.status === 'live' ? ' is-live' :
                             r.status === 'upcoming' ? ' is-upcoming' : ' is-final')
                        }
                        aria-label={r.status}
                      />
                    </div>
                    <div className="mockup-schedule-p__opp-col">
                      <span className="mockup-schedule-p__opp-line">
                        <span className="mockup-schedule-p__venue">{r.venue}</span>
                        <span className="mockup-schedule-p__opp-crest">{opp.code}</span>
                        <span className="mockup-schedule-p__opp-name">vs {opp.name}</span>
                      </span>
                      <span className="mockup-schedule-p__opp-mgr">{opp.manager}</span>
                    </div>
                    <div className="mockup-schedule-p__score-col">
                      {r.status === 'upcoming' ? (
                        <span className="mockup-schedule-p__upcoming">—</span>
                      ) : (
                        <>
                          <span className="mockup-schedule-p__score">
                            <b>{r.pf}</b>
                            <span className="mockup-schedule-p__score-sep">·</span>
                            <span className="mockup-schedule-p__score-pa">{r.pa}</span>
                          </span>
                          {res && (
                            <span className={'mockup-schedule-p__res mockup-schedule-p__res--' + res}>
                              {res}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}

/** Compact alternative — just GW, opp crest, score, W/L. */
export function ScheduleCompactPortrait() {
  return (
    <div className="mockup-portrait-page">
      <PortraitPageHeader title="Schedule" meta="Compact · 2025/26" />
      <div className="mockup-portrait-page__filters">
        <button type="button" className="mockup-filter-pill mockup-filter-pill--sm mockup-filter-pill--active">
          <span className="mockup-filter-pill__label">Team</span>
          <span className="mockup-filter-pill__value">{SCHEDULE_HOME_TEAM.name}</span>
          <CaretIcon className="mockup-filter-pill__caret" />
        </button>
        <button type="button" className="mockup-filter-pill mockup-filter-pill--sm">
          <span className="mockup-filter-pill__label">View</span>
          <span className="mockup-filter-pill__value">Compact</span>
          <CaretIcon className="mockup-filter-pill__caret" />
        </button>
      </div>
      <div className="mockup-schedule-pc__list">
        {SCHEDULE_ROWS.map((r) => {
          const opp = findTeam(r.opp)
          const res = resultFor(r)
          return (
            <div key={r.gw} className={'mockup-schedule-pc__row' + (r.status === 'upcoming' ? ' is-upcoming' : '')}>
              <span className="mockup-schedule-pc__gw">GW{String(r.gw).padStart(2, '0')}</span>
              <span className="mockup-schedule-pc__venue">{r.venue}</span>
              <span className="mockup-schedule-pc__crest">{opp.code}</span>
              <span className="mockup-schedule-pc__score">
                {r.status === 'upcoming' ? '—' : `${r.pf} · ${r.pa}`}
              </span>
              {res ? (
                <span className={'mockup-schedule-pc__res mockup-schedule-pc__res--' + res}>{res}</span>
              ) : (
                <span className="mockup-schedule-pc__res mockup-schedule-pc__res--up">·</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Desktop note — sketch of the single-team toggle in the existing matrix header. */
export function ScheduleDesktopNote() {
  return (
    <div className="mockup-schedule-d">
      <div className="mockup-schedule-d__head">
        <div className="mockup-schedule-d__head-left">
          <h3 className="mockup-schedule-d__title">Schedule</h3>
          <p className="mockup-schedule-d__sub">
            Keep the existing 8-column matrix. Add a header toggle: matrix view ↔ single-team list.
          </p>
        </div>
        <div className="mockup-schedule-d__toggle" role="tablist">
          <button type="button" className="mockup-schedule-d__toggle-btn" role="tab" aria-selected="true">Matrix</button>
          <button type="button" className="mockup-schedule-d__toggle-btn" role="tab" aria-selected="false">Single team</button>
          <button type="button" className="mockup-filter-pill mockup-filter-pill--sm mockup-filter-pill--active" disabled>
            <span className="mockup-filter-pill__label">Team</span>
            <span className="mockup-filter-pill__value">{SCHEDULE_HOME_TEAM.name}</span>
            <CaretIcon className="mockup-filter-pill__caret" />
          </button>
        </div>
      </div>
      <div className="mockup-schedule-d__sketch" aria-hidden>
        <div className="mockup-schedule-d__sketch-cap">When single-team is on, the matrix collapses to the portrait list inside the same width.</div>
        <div className="mockup-schedule-d__sketch-rows">
          {SCHEDULE_ROWS.slice(0, 5).map((r) => {
            const opp = findTeam(r.opp)
            const res = resultFor(r)
            return (
              <div key={r.gw} className={'mockup-schedule-d__sketch-row' + (r.status === 'upcoming' ? ' is-upcoming' : '')}>
                <span className="mockup-schedule-d__sketch-gw">GW{String(r.gw).padStart(2, '0')}</span>
                <span className="mockup-schedule-d__sketch-venue">{r.venue}</span>
                <span className="mockup-schedule-d__sketch-crest">{opp.code}</span>
                <span className="mockup-schedule-d__sketch-opp">vs {opp.name}</span>
                <span className="mockup-schedule-d__sketch-score">
                  {r.status === 'upcoming' ? '—' : `${r.pf} · ${r.pa}`}
                </span>
                {res && (
                  <span className={'mockup-schedule-d__sketch-res mockup-schedule-d__sketch-res--' + res}>{res}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ================================================================== */
/* 3. Standings — portrait + ultra-compact alt + desktop brief          */
/* ================================================================== */

const STANDINGS_ROWS = [
  { rank: 1, prev: 1, code: 'SC', name: 'Seoul Club 7',         manager: 'Luke',   w: 17, d: 1, l: 9,  pf: 1623, pa: 1410, total: 52, gw: 64, form: ['W','W','W','L','W'], crown: true },
  { rank: 2, prev: 3, code: 'CO', name: 'Crouch End Oashisu',   manager: 'David',  w: 15, d: 2, l: 10, pf: 1605, pa: 1431, total: 47, gw: 71, form: ['W','W','D','W','W'] },
  { rank: 3, prev: 2, code: 'TO', name: 'Toronto Oizo',         manager: 'Andy',   w: 14, d: 1, l: 12, pf: 1582, pa: 1450, total: 43, gw: 56, form: ['L','W','L','W','W'], me: true },
  { rank: 4, prev: 4, code: 'HY', name: 'Hanson of York AFC',   manager: 'Nick G', w: 13, d: 1, l: 13, pf: 1521, pa: 1466, total: 40, gw: 53, form: ['W','L','W','L','D'] },
  { rank: 5, prev: 6, code: 'HM', name: 'Hackney Meat Loaf',    manager: 'Nick M', w: 12, d: 2, l: 13, pf: 1493, pa: 1488, total: 38, gw: 58, form: ['W','L','W','W','L'] },
  { rank: 6, prev: 5, code: 'CC', name: 'Clapton Cornershop',   manager: 'Mike',   w: 11, d: 1, l: 15, pf: 1478, pa: 1510, total: 34, gw: 49, form: ['L','L','W','L','W'] },
  { rank: 7, prev: 8, code: 'MJ', name: 'Morpeth Jamiroquai',   manager: 'Jon',    w: 9,  d: 2, l: 16, pf: 1442, pa: 1542, total: 29, gw: 47, form: ['L','W','L','L','D'] },
  { rank: 8, prev: 7, code: 'BM', name: 'Brampton II Men',      manager: 'Eddy',   w: 8,  d: 2, l: 17, pf: 1421, pa: 1568, total: 26, gw: 41, form: ['L','L','D','L','L'] },
]

function RankDelta({ delta }) {
  if (!delta || delta === 0) return <span className="mockup-standings-p__delta mockup-standings-p__delta--flat" aria-label="No change">·</span>
  if (delta > 0) return <span className="mockup-standings-p__delta mockup-standings-p__delta--up">▲{delta}</span>
  return <span className="mockup-standings-p__delta mockup-standings-p__delta--down">▼{Math.abs(delta)}</span>
}

export function StandingsPortrait() {
  const [sort, setSort] = useState('total')
  const [scope, setScope] = useState('overall')
  return (
    <div className="mockup-portrait-page">
      <PortraitPageHeader title="Standings" meta="GW 28 · Live" />
      <div className="mockup-portrait-page__filters mockup-standings-p__filters">
        <button type="button" className="mockup-filter-pill mockup-filter-pill--sm">
          <span className="mockup-filter-pill__label">Sort</span>
          <span className="mockup-filter-pill__value">Total</span>
          <CaretIcon className="mockup-filter-pill__caret" />
        </button>
        <div className="mockup-standings-p__seg" role="tablist" aria-label="Scope">
          {[
            { id: 'overall',  label: 'Overall' },
            { id: 'l5',       label: 'Last 5' },
            { id: 'strength', label: 'SoS' },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={scope === s.id}
              className={'mockup-standings-p__seg-btn' + (scope === s.id ? ' is-active' : '')}
              onClick={() => setScope(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mockup-standings-p__list">
        {STANDINGS_ROWS.map((r) => {
          const delta = r.prev - r.rank
          return (
            <div key={r.code} className={'mockup-standings-p__row' + (r.me ? ' is-me' : '')}>
              <div className="mockup-standings-p__rank-col">
                <span className="mockup-standings-p__rank">{r.rank}</span>
                <RankDelta delta={delta} />
              </div>
              <div className="mockup-standings-p__id-col">
                <div className="mockup-standings-p__name-line">
                  <span className="mockup-standings-p__crest">{r.code}</span>
                  <span className="mockup-standings-p__team">{r.name}</span>
                  {r.crown && <IconCrown className="mockup-standings-p__crown" aria-label="Leader" />}
                  {r.me && <span className="mockup-standings-p__me-pill">ME</span>}
                </div>
                <div className="mockup-standings-p__meta-line">
                  <span className="mockup-standings-p__mgr">{r.manager}</span>
                  <span className="mockup-standings-p__sep">·</span>
                  <span className="mockup-standings-p__wlt">{r.w}-{r.l}-{r.d}</span>
                  <span className="mockup-standings-p__sep">·</span>
                  <span className="mockup-standings-p__form">
                    {r.form.map((f, i) => (
                      <span
                        key={i}
                        className={'mockup-standings-p__pip mockup-standings-p__pip--' + f}
                        aria-label={f}
                      />
                    ))}
                  </span>
                </div>
              </div>
              <div className="mockup-standings-p__pts-col">
                <span className="mockup-standings-p__pts">{r.total}</span>
                <span className="mockup-standings-p__pts-gw">GW {r.gw}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function StandingsCompactPortrait() {
  return (
    <div className="mockup-portrait-page">
      <PortraitPageHeader title="Standings" meta="Ultra-compact" />
      <div className="mockup-standings-pc__list">
        {STANDINGS_ROWS.map((r) => (
          <div key={r.code} className={'mockup-standings-pc__row' + (r.me ? ' is-me' : '')}>
            <span className="mockup-standings-pc__rank">{r.rank}</span>
            <span className="mockup-standings-pc__crest">{r.code}</span>
            <span className="mockup-standings-pc__name">{r.name}</span>
            {r.crown && <IconCrown className="mockup-standings-pc__crown" />}
            {r.me && <span className="mockup-standings-pc__me">ME</span>}
            <span className="mockup-standings-pc__pts">{r.total}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function StandingsDesktopBrief() {
  return (
    <div className="mockup-standings-d">
      <header className="mockup-standings-d__head">
        <h3 className="mockup-standings-d__title">Standings · denser desktop redesign</h3>
        <p className="mockup-standings-d__sub">
          Same atoms as the portrait card list, restored to a table layout with sortable column headers
          and inline rank-delta. Keep the FotMob-flush hairline style from the existing standings.
        </p>
      </header>
      <table className="mockup-standings-d__table">
        <thead>
          <tr>
            <th className="mockup-standings-d__th mockup-standings-d__th--rank">#</th>
            <th className="mockup-standings-d__th mockup-standings-d__th--team">Team · Manager</th>
            <th className="mockup-standings-d__th mockup-standings-d__th--wlt">W-L-T</th>
            <th className="mockup-standings-d__th mockup-standings-d__th--pf">PF</th>
            <th className="mockup-standings-d__th mockup-standings-d__th--pa">PA</th>
            <th className="mockup-standings-d__th mockup-standings-d__th--form">Form</th>
            <th className="mockup-standings-d__th mockup-standings-d__th--pts">
              Pts <span className="mockup-standings-d__th-caret" aria-hidden>▾</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {STANDINGS_ROWS.map((r) => {
            const delta = r.prev - r.rank
            return (
              <tr key={r.code} className={r.me ? 'is-me' : undefined}>
                <td className="mockup-standings-d__rank">
                  <span className="mockup-standings-d__rank-n">{r.rank}</span>
                  <RankDelta delta={delta} />
                </td>
                <td className="mockup-standings-d__team-cell">
                  <span className="mockup-standings-d__crest">{r.code}</span>
                  <span className="mockup-standings-d__team-name">{r.name}</span>
                  {r.crown && <IconCrown className="mockup-standings-d__crown" />}
                  {r.me && <span className="mockup-standings-d__me-pill">ME</span>}
                  <span className="mockup-standings-d__mgr">{r.manager}</span>
                </td>
                <td className="mockup-standings-d__wlt">{r.w}-{r.l}-{r.d}</td>
                <td className="mockup-standings-d__num">{r.pf}</td>
                <td className="mockup-standings-d__num">{r.pa}</td>
                <td className="mockup-standings-d__form-cell">
                  {r.form.map((f, i) => (
                    <span key={i} className={'mockup-standings-d__pip mockup-standings-d__pip--' + f} />
                  ))}
                </td>
                <td className="mockup-standings-d__pts">{r.total}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ================================================================== */
/* 4. Waivers / Pickups / Drops / Tenure                                */
/* ================================================================== */

const WAIVERS_FEED = [
  { type: 'pickup', gw: 28, ago: '2d ago', team: 'CO', player: { name: 'O. Watkins',    club: 'AVL', pos: 'FWD' }, note: 'Picked up after Saka injury news' },
  { type: 'drop',   gw: 28, ago: '2d ago', team: 'CO', player: { name: 'A. Gordon',     club: 'NEW', pos: 'MID' }, note: 'Dropped to make room for Watkins' },
  { type: 'pickup', gw: 28, ago: '3d ago', team: 'BM', player: { name: 'Y. Wissa',      club: 'BRE', pos: 'FWD' }, note: 'Picked up free agent' },
  { type: 'trade',  gw: 27, ago: '5d ago', team: 'HM', player: { name: 'C. Palmer ⇄ B. Saka', club: null, pos: null }, note: 'Trade accepted with Crouch End' },
  { type: 'pickup', gw: 27, ago: '6d ago', team: 'SC', player: { name: 'A. Mateta',     club: 'CRY', pos: 'FWD' }, note: 'After Isak injury' },
  { type: 'drop',   gw: 27, ago: '6d ago', team: 'SC', player: { name: 'F. Wirtz',      club: 'LIV', pos: 'MID' }, note: 'Dropped — bench → free agent' },
  { type: 'pickup', gw: 26, ago: '1w ago', team: 'TO', player: { name: 'A. Semenyo',    club: 'BOU', pos: 'MID' }, note: 'Acquired via waiver claim' },
  { type: 'drop',   gw: 26, ago: '1w ago', team: 'TO', player: { name: 'D. Welbeck',    club: 'BHA', pos: 'FWD' }, note: 'Dropped — schedule run-in' },
]

function WaiverIcon({ type, ...rest }) {
  const cls = `mockup-waivers-p__icon mockup-waivers-p__icon--${type}`
  if (type === 'pickup') return <span className={cls} {...rest}><IconPlus /></span>
  if (type === 'drop')   return <span className={cls} {...rest}><IconMinus /></span>
  return <span className={cls} {...rest}><IconSwap /></span>
}

function WaiversListView({ rows }) {
  return (
    <div className="mockup-waivers-p__list">
      {rows.map((r, i) => {
        const team = findTeam(r.team)
        return (
          <div key={i} className={'mockup-waivers-p__card mockup-waivers-p__card--' + r.type}>
            <WaiverIcon type={r.type} />
            <div className="mockup-waivers-p__body">
              <div className="mockup-waivers-p__head">
                <span className="mockup-waivers-p__team-crest">{team.code}</span>
                <span className="mockup-waivers-p__team-name">{team.name}</span>
                <span className="mockup-waivers-p__time">GW {r.gw} · {r.ago}</span>
              </div>
              <div className="mockup-waivers-p__player">
                {r.player.club && <ClubCrest club={r.player.club} size={18} className="mockup-waivers-p__player-crest" />}
                <span className="mockup-waivers-p__player-name">{r.player.name}</span>
                {r.player.pos && <span className={'mockup-waivers-p__pos mockup-waivers-p__pos--' + r.player.pos}>{r.player.pos}</span>}
              </div>
              <div className="mockup-waivers-p__note">{r.note}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const WAIVERS_TABS = [
  { id: 'waivers',  label: 'Waivers' },
  { id: 'pickups',  label: 'Pickups' },
  { id: 'drops',    label: 'Drops' },
]

export function WaiversPortrait() {
  const [tab, setTab] = useState('waivers')
  const counts = {
    waivers: WAIVERS_FEED.length,
    pickups: WAIVERS_FEED.filter((r) => r.type === 'pickup').length,
    drops:   WAIVERS_FEED.filter((r) => r.type === 'drop').length,
  }
  const rows =
    tab === 'pickups' ? WAIVERS_FEED.filter((r) => r.type === 'pickup')
    : tab === 'drops' ? WAIVERS_FEED.filter((r) => r.type === 'drop')
    : WAIVERS_FEED
  return (
    <div className="mockup-portrait-page">
      <PortraitPageHeader title="Waivers" meta="GW 28" />
      <div className="mockup-waivers-p__subnav" role="tablist" aria-label="Waivers sections">
        {WAIVERS_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={'mockup-waivers-p__subnav-tab' + (tab === t.id ? ' is-active' : '')}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            <span className="mockup-waivers-p__subnav-count">{counts[t.id]}</span>
          </button>
        ))}
      </div>
      <div className="mockup-portrait-page__filters">
        <button type="button" className="mockup-filter-pill mockup-filter-pill--sm">
          <span className="mockup-filter-pill__label">Team</span>
          <span className="mockup-filter-pill__value">All</span>
          <CaretIcon className="mockup-filter-pill__caret" />
        </button>
        <button type="button" className="mockup-filter-pill mockup-filter-pill--sm">
          <span className="mockup-filter-pill__label">Position</span>
          <span className="mockup-filter-pill__value">All</span>
          <CaretIcon className="mockup-filter-pill__caret" />
        </button>
        <button type="button" className="mockup-filter-pill mockup-filter-pill--sm">
          <span className="mockup-filter-pill__label">GW</span>
          <span className="mockup-filter-pill__value">28</span>
          <CaretIcon className="mockup-filter-pill__caret" />
        </button>
      </div>
      <WaiversListView rows={rows} />
    </div>
  )
}

export function WaiversDesktop() {
  return (
    <div className="mockup-waivers-d">
      <header className="mockup-waivers-d__head">
        <h3 className="mockup-waivers-d__title">Activity feed · denser desktop</h3>
        <p className="mockup-waivers-d__sub">
          Two-column feed. Sub-tabs at top filter the stream. Same card atoms as portrait,
          tighter typography and a fixed icon column.
        </p>
      </header>
      <div className="mockup-waivers-d__grid">
        {WAIVERS_FEED.map((r, i) => {
          const team = findTeam(r.team)
          return (
            <div key={i} className={'mockup-waivers-d__card mockup-waivers-d__card--' + r.type}>
              <WaiverIcon type={r.type} />
              <div className="mockup-waivers-d__body">
                <div className="mockup-waivers-d__head-line">
                  <span className="mockup-waivers-d__team-crest">{team.code}</span>
                  <span className="mockup-waivers-d__team-name">{team.name}</span>
                  <span className="mockup-waivers-d__time">GW {r.gw} · {r.ago}</span>
                </div>
                <div className="mockup-waivers-d__player">
                  {r.player.club && <ClubCrest club={r.player.club} size={20} className="mockup-waivers-d__player-crest" />}
                  <span className="mockup-waivers-d__player-name">{r.player.name}</span>
                  {r.player.pos && <span className={'mockup-waivers-p__pos mockup-waivers-p__pos--' + r.player.pos}>{r.player.pos}</span>}
                </div>
                <div className="mockup-waivers-d__note">{r.note}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ================================================================== */
/* 5. Trades — portrait                                                 */
/* ================================================================== */

const TRADES_ROWS = [
  {
    id: 't1',
    gw: 27,
    date: 'Feb 14',
    a: { code: 'HM', name: 'Hackney Meat Loaf', manager: 'Nick M', delta: '+12' },
    b: { code: 'CO', name: 'Crouch End Oashisu', manager: 'David',  delta: '−4'  },
    aGets: [{ name: 'B. Saka',     club: 'ARS', pos: 'MID' }],
    bGets: [{ name: 'C. Palmer',   club: 'CHE', pos: 'MID' }],
    verdict: 'HM net +12 pts since trade · CO net −4 pts',
  },
  {
    id: 't2',
    gw: 23,
    date: 'Jan 20',
    a: { code: 'HY', name: 'Hanson of York AFC', manager: 'Nick G', delta: '+7' },
    b: { code: 'HM', name: 'Hackney Meat Loaf',  manager: 'Nick M', delta: '−2' },
    aGets: [{ name: 'B. Fernandes', club: 'MUN', pos: 'MID' }],
    bGets: [{ name: 'D. Wirtz',     club: 'LIV', pos: 'MID' }],
    verdict: 'HY net +7 since trade · HM net −2',
  },
  {
    id: 't3',
    gw: 13,
    date: 'Nov 23',
    a: { code: 'TO', name: 'Toronto Oizo',       manager: 'Andy',   delta: '+9' },
    b: { code: 'HM', name: 'Hackney Meat Loaf',  manager: 'Nick M', delta: '−5' },
    aGets: [
      { name: 'O. Watkins', club: 'AVL', pos: 'FWD' },
      { name: 'B. Mbeumo',  club: 'BRE', pos: 'MID' },
    ],
    bGets: [
      { name: 'A. Gordon',  club: 'NEW', pos: 'MID' },
      { name: 'D. Welbeck', club: 'BHA', pos: 'FWD' },
    ],
    verdict: 'TO net +9 pts · HM net −5 pts (2-for-2 swap)',
  },
  {
    id: 't4',
    gw: 9,
    date: 'Oct 20',
    a: { code: 'TO', name: 'Toronto Oizo',       manager: 'Andy',  delta: '+18' },
    b: { code: 'MJ', name: 'Morpeth Jamiroquai', manager: 'Jon',   delta: '−14' },
    aGets: [{ name: 'M. Salah',      club: 'LIV', pos: 'MID' }],
    bGets: [{ name: 'F. Ekitiké',    club: 'LIV', pos: 'FWD' }],
    verdict: 'TO net +18 — biggest swing of the season',
    highlight: 'biggest',
  },
]

export function TradesPortrait() {
  const totalTrades = TRADES_ROWS.length
  const biggest = TRADES_ROWS.find((t) => t.highlight === 'biggest')
  return (
    <div className="mockup-portrait-page">
      <PortraitPageHeader title="Trades" meta={`${totalTrades} accepted`} />
      <div className="mockup-trades-p__strip">
        <div className="mockup-trades-p__strip-cell">
          <span className="mockup-trades-p__strip-v">{totalTrades}</span>
          <span className="mockup-trades-p__strip-k">Season trades</span>
        </div>
        <div className="mockup-trades-p__strip-cell">
          <span className="mockup-trades-p__strip-v">Andy</span>
          <span className="mockup-trades-p__strip-k">Most active</span>
        </div>
        <div className="mockup-trades-p__strip-cell">
          <span className="mockup-trades-p__strip-v mockup-trades-p__strip-v--pos">{biggest?.a.delta ?? '—'}</span>
          <span className="mockup-trades-p__strip-k">Biggest steal · {biggest?.a.code}</span>
        </div>
      </div>
      <div className="mockup-portrait-page__filters">
        <button type="button" className="mockup-filter-pill mockup-filter-pill--sm">
          <span className="mockup-filter-pill__label">Team</span>
          <span className="mockup-filter-pill__value">All</span>
          <CaretIcon className="mockup-filter-pill__caret" />
        </button>
        <button type="button" className="mockup-filter-pill mockup-filter-pill--sm">
          <span className="mockup-filter-pill__label">GW</span>
          <span className="mockup-filter-pill__value">All</span>
          <CaretIcon className="mockup-filter-pill__caret" />
        </button>
      </div>
      <div className="mockup-trades-p__list">
        {TRADES_ROWS.map((t) => (
          <article key={t.id} className={'mockup-trades-p__card' + (t.highlight ? ' is-highlight' : '')}>
            <header className="mockup-trades-p__head">
              <span className="mockup-trades-p__gw">GW {t.gw}</span>
              <span className="mockup-trades-p__date">{t.date}</span>
              {t.highlight && <span className="mockup-trades-p__chip">Biggest swing</span>}
            </header>
            <div className="mockup-trades-p__teams">
              <div className="mockup-trades-p__team mockup-trades-p__team--a">
                <span className="mockup-trades-p__team-crest">{t.a.code}</span>
                <span className="mockup-trades-p__team-name">{t.a.name}</span>
                <span className={'mockup-trades-p__team-delta' + (t.a.delta.startsWith('+') ? ' is-pos' : ' is-neg')}>
                  {t.a.delta}
                </span>
              </div>
              <div className="mockup-trades-p__team mockup-trades-p__team--b">
                <span className="mockup-trades-p__team-crest">{t.b.code}</span>
                <span className="mockup-trades-p__team-name">{t.b.name}</span>
                <span className={'mockup-trades-p__team-delta' + (t.b.delta.startsWith('+') ? ' is-pos' : ' is-neg')}>
                  {t.b.delta}
                </span>
              </div>
            </div>
            <div className="mockup-trades-p__exchange">
              <div className="mockup-trades-p__lane mockup-trades-p__lane--a">
                <span className="mockup-trades-p__lane-eyebrow">{t.a.code} receives</span>
                {t.aGets.map((p) => (
                  <span key={p.name} className="mockup-trades-p__player">
                    <ClubCrest club={p.club} size={18} className="mockup-trades-p__player-crest" />
                    <span className="mockup-trades-p__player-name">{p.name}</span>
                    <span className={'mockup-waivers-p__pos mockup-waivers-p__pos--' + p.pos}>{p.pos}</span>
                  </span>
                ))}
              </div>
              <span className="mockup-trades-p__arrow" aria-hidden>
                <IconArrow />
              </span>
              <div className="mockup-trades-p__lane mockup-trades-p__lane--b">
                <span className="mockup-trades-p__lane-eyebrow">{t.b.code} receives</span>
                {t.bGets.map((p) => (
                  <span key={p.name} className="mockup-trades-p__player">
                    <ClubCrest club={p.club} size={18} className="mockup-trades-p__player-crest" />
                    <span className="mockup-trades-p__player-name">{p.name}</span>
                    <span className={'mockup-waivers-p__pos mockup-waivers-p__pos--' + p.pos}>{p.pos}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="mockup-trades-p__verdict">{t.verdict}</div>
          </article>
        ))}
      </div>
    </div>
  )
}

/* ================================================================== */
/* Showcase wrapper                                                     */
/* ================================================================== */

function ShowcaseSection({ id, eyebrow, title, children, sub }) {
  return (
    <section id={id} className="mockup__section">
      <div className="mockup__eyebrow">{eyebrow}</div>
      <h2 className="mockup__section-h">{title}</h2>
      {sub && <p className="mockup__section-sub">{sub}</p>}
      {children}
    </section>
  )
}

function VariantLabel({ children }) {
  return <div className="mockup-part2__variant-label">{children}</div>
}

function TrophyRoomShowcase() {
  /* Use the most polished banner across all four accent demos. */
  const accentSample = TROPHY_SEASONS.find((s) => s.image === 'crouch-end-oashisu') ?? TROPHY_SEASONS[0]
  const accentVariants = [
    { id: 'violet',      label: 'OPTION A — VIOLET LINE (CURRENT)',    variant: 'violet',     desc: '2px brand-violet top line. Current treatment.', isPicked: true },
    { id: 'gold',        label: 'OPTION B — GOLD LINE',                variant: 'gold',       desc: '2px muted gold top line.' },
    { id: 'glow',        label: 'OPTION C — HOVER GLOW (NO LINE)',     variant: 'glow',       desc: 'No top line; hover lift + soft brand-tinted glow.' },
    { id: 'trophy-svg',  label: 'OPTION D — TROPHY SVG (TOP-RIGHT)',   variant: 'trophy-svg', desc: 'Tiny monochrome trophy mark, top-right corner.' },
  ]
  const gridVariants = [
    { id: 'a-3x4',    label: 'OPTION A — 3:4 / 3-COL',               cls: 'mockup-trophy__grid-variant-3-4' },
    { id: 'b-1x1',    label: 'OPTION B — 1:1 SQUARE / 4-COL',         cls: 'mockup-trophy__grid-variant-1-1', isPicked: true },
    { id: 'c-4x5',    label: 'OPTION C — 4:5 / 3-COL',                cls: 'mockup-trophy__grid-variant-4-5' },
    { id: 'd-native', label: 'OPTION D — NATIVE / 3-COL',             cls: 'mockup-trophy__grid-variant-native' },
  ]
  return (
    <ShowcaseSection
      id="trophy-room"
      eyebrow="Hall · Trophy room (new surface)"
      title="Dedicated sub-nav · champion gallery"
      sub="A year-by-year hall of fame. Each card frames the uploaded banner artwork (which already carries team name + season) and adds only the context the art doesn't: the manager's name in brand violet at the top, with their championship number to the right. Thin brand-violet top accent, hover lift."
    >
      <VariantLabel>DESKTOP</VariantLabel>
      <TrophyRoomDesktop />
      <VariantLabel>PORTRAIT</VariantLabel>
      <div className="mockup-portrait-row">
        <div className="mockup-portrait-col">
          <div className="mockup-portrait-col__h">Trophy room · 375px</div>
          <PortraitFrame>
            <TrophyRoomPortrait />
          </PortraitFrame>
        </div>
      </div>

      {/* ---- Variant Set 2 · card accent treatment ---- */}
      <VariantLabel>CARD ACCENT · 4 OPTIONS</VariantLabel>
      <p className="mockup__section-sub mockup-trophy__variants-intro">
        Violet (current) picked. Other accents kept for reference.
      </p>
      <div className="mockup-trophy__variant-row">
        {accentVariants.map((v) => (
          <div className="mockup-trophy__variant-cell" key={v.id}>
            <div className={'mockup-trophy__variant-frame mockup-trophy__variant-frame--' + v.id}>
              <TrophyPlaque s={accentSample} variant={v.variant} />
            </div>
            <div className="mockup-trophy__variant-cell-label">
              {v.label}
              {v.isPicked && (
                <span className="mockup-variant-picked" aria-label="Picked option">PICKED</span>
              )}
            </div>
            <div className="mockup-trophy__variant-cell-desc">{v.desc}</div>
          </div>
        ))}
      </div>

      {/* ---- Variant Set 3 · grid aspect-ratio + column count ---- */}
      <VariantLabel>GRID ASPECT RATIO · 4 OPTIONS</VariantLabel>
      <p className="mockup__section-sub mockup-trophy__variants-intro">
        1:1 square / 4-col picked. Other ratios kept for reference.
      </p>
      <div className="mockup-trophy__grid-variant-stack">
        {gridVariants.map((g) => (
          <div className="mockup-trophy__grid-variant-cell" key={g.id}>
            <VariantLabel>
              {g.label}
              {g.isPicked && (
                <span className="mockup-variant-picked" aria-label="Picked option">PICKED</span>
              )}
            </VariantLabel>
            <div className={'mockup-trophy__grid-variant ' + g.cls}>
              {TROPHY_SEASONS.map((s) => (
                <TrophyPlaque key={s.season} s={s} variant="violet" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </ShowcaseSection>
  )
}

function ScheduleShowcase() {
  return (
    <ShowcaseSection
      id="schedule-portrait"
      eyebrow="Schedule · portrait"
      title="Single-team mode — vertical list, no h-scroll"
      sub="The desktop matrix would scroll horizontally on a phone. Portrait switches to single-team mode: pick a team, see their whole season as a vertical timeline with record strip, segment headers, and a status dot per row."
    >
      <VariantLabel>PORTRAIT — DETAILED</VariantLabel>
      <div className="mockup-portrait-row">
        <div className="mockup-portrait-col">
          <div className="mockup-portrait-col__h">Detailed view · 375px</div>
          <PortraitFrame>
            <SchedulePortrait />
          </PortraitFrame>
        </div>
        <div className="mockup-portrait-col">
          <div className="mockup-portrait-col__h">Compact alt · 375px</div>
          <PortraitFrame>
            <ScheduleCompactPortrait />
          </PortraitFrame>
        </div>
      </div>
      <VariantLabel>DESKTOP · NOTE</VariantLabel>
      <ScheduleDesktopNote />
    </ShowcaseSection>
  )
}

function StandingsShowcase() {
  return (
    <ShowcaseSection
      id="standings-portrait"
      eyebrow="Standings · portrait + desktop polish"
      title="Card rows on portrait, denser table on desktop"
      sub="Mobile becomes card rows (rank · crest · team + manager · W-L-T · form pips · total pts). The user's team gets an ME pill; the rank-1 team gets a crown during the run-in. Desktop adds sortable headers and rank-delta arrows in the existing flush style."
    >
      <VariantLabel>PORTRAIT</VariantLabel>
      <div className="mockup-portrait-row">
        <div className="mockup-portrait-col">
          <div className="mockup-portrait-col__h">Detailed · 375px</div>
          <PortraitFrame>
            <StandingsPortrait />
          </PortraitFrame>
        </div>
        <div className="mockup-portrait-col">
          <div className="mockup-portrait-col__h">Ultra-compact alt · 375px</div>
          <PortraitFrame>
            <StandingsCompactPortrait />
          </PortraitFrame>
        </div>
      </div>
      <VariantLabel>DESKTOP</VariantLabel>
      <StandingsDesktopBrief />
    </ShowcaseSection>
  )
}

function WaiversShowcase() {
  return (
    <ShowcaseSection
      id="waivers-portrait"
      eyebrow="Waivers · Pickups · Drops · Tenure"
      title="Activity feed on portrait, two-column on desktop"
      sub="One feed unifies all four sub-tabs. Cards carry a typed action icon, the acting team's crest, the player who moved, and a short context line. Tenure is a separate sub-view showing how long each currently-rostered player has been with their owner."
    >
      <VariantLabel>PORTRAIT</VariantLabel>
      <div className="mockup-portrait-row">
        <div className="mockup-portrait-col">
          <div className="mockup-portrait-col__h">Activity feed · 375px</div>
          <PortraitFrame>
            <WaiversPortrait />
          </PortraitFrame>
        </div>
      </div>
      <VariantLabel>DESKTOP</VariantLabel>
      <WaiversDesktop />
    </ShowcaseSection>
  )
}

function TradesShowcase() {
  return (
    <ShowcaseSection
      id="trades-portrait"
      eyebrow="Trades · portrait"
      title="Two-team trade cards with verdict line"
      sub="Each trade gets its own card: both team headers, the players moving in each direction (with crest + position), an arrow between, and a verdict line tracking net points-since-trade. A stat strip up top surfaces season totals."
    >
      <VariantLabel>PORTRAIT</VariantLabel>
      <div className="mockup-portrait-row">
        <div className="mockup-portrait-col">
          <div className="mockup-portrait-col__h">Trade cards · 375px</div>
          <PortraitFrame>
            <TradesPortrait />
          </PortraitFrame>
        </div>
      </div>
    </ShowcaseSection>
  )
}

export const MOCKUP_PART2_SECTIONS = [
  { id: 'trophy-room',       label: 'Trophy room',                 render: () => <TrophyRoomShowcase /> },
  { id: 'schedule-portrait', label: 'Schedule · portrait',         render: () => <ScheduleShowcase /> },
  { id: 'standings-portrait',label: 'Standings · portrait',        render: () => <StandingsShowcase /> },
  { id: 'waivers-portrait',  label: 'Waivers / Pickups / Drops',   render: () => <WaiversShowcase /> },
  { id: 'trades-portrait',   label: 'Trades · portrait',           render: () => <TradesShowcase /> },
]

export default function MockupSurfacesPart2() {
  return (
    <div className="mockup-part2">
      {MOCKUP_PART2_SECTIONS.map((s) => (
        <Fragment key={s.id}>{s.render()}</Fragment>
      ))}
    </div>
  )
}

/*
 * TCLOT Design Mockup — Lineups page (CONVERGED design)
 *
 * Local-only preview at ?mockup=1. This is the single chosen direction we'll
 * port to production next:
 *   - Desktop : Variant A — modernized paired home|away XI tiles.
 *   - Mobile  : Variant A's row styling + Variant C's home/away toggle, so
 *               only ONE team's XI shows at a time on a 390 px portrait screen.
 *   - Confirmed line-ups only. No "Predicted" state/badge/toggle anywhere.
 *
 * Production reference: src/PremWindow.jsx (the `prem-lineup-*` classes).
 * Features preserved: announced XIs, formation per side, PL club crest per
 * player, FPL-position pill, fantasy owner badge (only when owned), bench,
 * kickoff labels, GW / fixture selector pill.
 *
 * Everything here is namespaced `mockup-lu-*` and never touches the
 * production `prem-lineup-*` classes.
 */

import { useState } from 'react'
import './MockupLineups.css'

/* ------------------------------------------------------------------ */
/* PL crests (self-contained; mirrors Mockup.jsx's helper)             */
/* ------------------------------------------------------------------ */
const PL_CODE = {
  ARS: 3, LIV: 14, MCI: 43, CHE: 8, NEW: 4, MUN: 1, TOT: 6, AVL: 7,
  BOU: 91, BRE: 94, BRI: 36, BUR: 90, CRY: 31, EVE: 11, FUL: 54,
  LEE: 2, NFO: 17, SUN: 56, WHU: 21, WOL: 39,
}
const plCrestUrl = (code) =>
  code ? `https://resources.premierleague.com/premierleague/badges/70/t${code}.png` : null

function LuCrest({ club, size = 22 }) {
  const code = PL_CODE[club]
  const url = plCrestUrl(code)
  return (
    <span className="mockup-lu-crest" style={{ width: size, height: size }}>
      {url ? (
        <img src={url} alt={club} loading="lazy" decoding="async" />
      ) : (
        <span className="mockup-lu-crest__txt">{club}</span>
      )}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Fantasy owners (league teams) — initials chip + accent colour        */
/* ------------------------------------------------------------------ */
const OWNERS = {
  CO: { code: 'CO', name: 'Crouch End',   color: '#795bfb' },
  TO: { code: 'TO', name: 'Toronto Oizo', color: '#14b8a6' },
  CC: { code: 'CC', name: 'Clapton',      color: '#f59e0b' },
  HA: { code: 'HA', name: 'Hackney York', color: '#f43f5e' },
  SC: { code: 'SC', name: 'Seoul Club 7', color: '#38bdf8' },
  BM: { code: 'BM', name: 'Brampton II',  color: '#22c55e' },
  HM: { code: 'HM', name: 'Heavenly Loaf',color: '#fb923c' },
  MJ: { code: 'MJ', name: 'Mighty Jamir', color: '#a78bfa' },
}

/** Owner badge: tinted initials crest + (optionally) first-word name. */
function LuOwner({ owner, showName = true, size = 18 }) {
  if (!owner) return null
  const o = OWNERS[owner]
  if (!o) return null
  return (
    <span className="mockup-lu-owner" title={o.name}>
      {showName ? (
        <span className="mockup-lu-owner__name">{o.name.split(' ')[0]}</span>
      ) : null}
      <span
        className="mockup-lu-owner__crest"
        style={{
          width: size,
          height: size,
          color: o.color,
          background: `color-mix(in srgb, ${o.color} 18%, var(--surface))`,
          borderColor: `color-mix(in srgb, ${o.color} 45%, var(--border))`,
        }}
      >
        {o.code}
      </span>
    </span>
  )
}

/** Coloured FPL position bracket pill (reuses global mockup-players-pos). */
function LuPos({ pos }) {
  return <span className={`mockup-players-pos mockup-players-pos--${pos}`}>{pos}</span>
}

/** Confirmed badge — every XI shown is confirmed, so there's no Predicted state. */
function ConfirmedBadge() {
  return <span className="mockup-lu-badge mockup-lu-badge--confirmed">Confirmed</span>
}

/* ------------------------------------------------------------------ */
/* Mobile frame (self-contained mirror of Mockup.jsx PortraitFrame)     */
/* ------------------------------------------------------------------ */
function LuPhone({ children }) {
  return (
    <div className="mockup-lu-phone">
      <div className="mockup-lu-phone__screen">{children}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sample data — a single CONFIRMED fixture (Arsenal v Liverpool).      */
/* `pos`: the player's FPL position. `owner`: fantasy team code, or null */
/* when unowned.                                                        */
/* ------------------------------------------------------------------ */
const FIXTURE = {
  id: 'ars-liv',
  state: 'pre', // line-ups out, pre-kickoff
  kickoffDate: 'Sat, Apr 12',
  kickoffTime: '12:30 PM',
  home: {
    club: 'ARS', name: 'Arsenal', formation: '4-3-3',
    xi: [
      { name: 'Raya',       pos: 'GKP', owner: null },
      { name: 'White',      pos: 'DEF', owner: null },
      { name: 'Saliba',     pos: 'DEF', owner: 'CO' },
      { name: 'Gabriel',    pos: 'DEF', owner: 'SC' },
      { name: 'Calafiori',  pos: 'DEF', owner: null },
      { name: 'Rice',       pos: 'MID', owner: 'HA' },
      { name: 'Ødegaard',   pos: 'MID', owner: 'TO' },
      { name: 'Merino',     pos: 'MID', owner: null },
      { name: 'Saka',       pos: 'MID', owner: 'SC' },
      { name: 'Havertz',    pos: 'FWD', owner: 'BM' },
      { name: 'Martinelli', pos: 'MID', owner: null },
    ],
    bench: [
      { name: 'Setford',  pos: 'GKP', owner: null },
      { name: 'Timber',   pos: 'DEF', owner: 'MJ' },
      { name: 'Partey',   pos: 'MID', owner: null },
      { name: 'Trossard', pos: 'MID', owner: 'CC' },
      { name: 'Jesus',    pos: 'FWD', owner: null },
    ],
    // Fantasy-owned players on this PL club that are NOT in the matchday
    // squad (not in XI, not on bench). Surfaced as a single row under the bench.
    notInSquad: [
      { name: 'Tomiyasu',   owner: 'HM' },
      { name: 'Zinchenko',  owner: 'TO' },
      { name: 'Nwaneri',    owner: 'MJ' },
    ],
  },
  away: {
    club: 'LIV', name: 'Liverpool', formation: '4-3-3',
    xi: [
      { name: 'Alisson',     pos: 'GKP', owner: null },
      { name: 'Bradley',     pos: 'DEF', owner: null },
      { name: 'Konaté',      pos: 'DEF', owner: null },
      { name: 'Van Dijk',    pos: 'DEF', owner: 'HM' },
      { name: 'Robertson',   pos: 'DEF', owner: null },
      { name: 'Mac Allister',pos: 'MID', owner: 'HA' },
      { name: 'Gravenberch', pos: 'MID', owner: 'MJ' },
      { name: 'Szoboszlai',  pos: 'MID', owner: 'TO' },
      { name: 'Salah',       pos: 'MID', owner: 'CC' },
      { name: 'Ekitiké',     pos: 'FWD', owner: 'CO' },
      { name: 'Gakpo',       pos: 'MID', owner: null },
    ],
    bench: [
      { name: 'Mamardashvili', pos: 'GKP', owner: null },
      { name: 'Gomez',         pos: 'DEF', owner: null },
      { name: 'Endo',          pos: 'MID', owner: null },
      { name: 'Jones',         pos: 'MID', owner: 'BM' },
      { name: 'Isak',          pos: 'FWD', owner: 'SC' },
    ],
    notInSquad: [
      { name: 'Jota',   owner: 'BM' },
      { name: 'Chiesa', owner: 'HM' },
      { name: 'Trent',  owner: 'CO' },
    ],
  },
}

const STATE_META = {
  pre:       { label: 'Lineups out', cls: 'mockup-lu-state--out' },
  live:      { label: 'LIVE',        cls: 'mockup-lu-state--live' },
  ft:        { label: 'FT',          cls: 'mockup-lu-state--ft' },
  scheduled: { label: '',            cls: 'mockup-lu-state--scheduled' },
}

/* ------------------------------------------------------------------ */
/* Gameweek-level sample data — drives the fixture-list pre-selection. */
/* Only `ars-liv` has full XI (re-uses FIXTURE above); other fixtures   */
/* are header-only and show a "lineups not yet announced" placeholder. */
/* ------------------------------------------------------------------ */
const GAMEWEEK_31 = {
  number: 31,
  days: [
    {
      label: 'Friday, Apr 11',
      fixtures: [
        {
          id: 'lee-bur', state: 'ft',
          home: { club: 'LEE', name: 'Leeds United' },
          away: { club: 'BUR', name: 'Burnley' },
          score: '3-1', kickoffTime: '8:00 PM',
        },
      ],
    },
    {
      label: 'Saturday, Apr 12',
      fixtures: [
        {
          id: 'bre-whu', state: 'ft',
          home: { club: 'BRE', name: 'Brentford' },
          away: { club: 'WHU', name: 'West Ham United' },
          score: '3-0', kickoffTime: '3:00 PM',
        },
        {
          id: 'new-bri', state: 'live', liveMinute: "67'",
          home: { club: 'NEW', name: 'Newcastle United' },
          away: { club: 'BRI', name: 'Brighton' },
          score: '2-1', kickoffTime: '3:00 PM',
        },
        {
          id: 'ars-liv', state: 'pre',
          home: FIXTURE.home, away: FIXTURE.away,
          kickoffTime: '5:30 PM',
          lineup: FIXTURE,
        },
        {
          id: 'wol-sun', state: 'scheduled',
          home: { club: 'WOL', name: 'Wolves' },
          away: { club: 'SUN', name: 'Sunderland' },
          kickoffTime: '8:00 PM',
        },
      ],
    },
    {
      label: 'Sunday, Apr 13',
      fixtures: [
        {
          id: 'bou-cry', state: 'scheduled',
          home: { club: 'BOU', name: 'Bournemouth' },
          away: { club: 'CRY', name: 'Crystal Palace' },
          kickoffTime: '2:00 PM',
        },
        {
          id: 'mun-mci', state: 'scheduled',
          home: { club: 'MUN', name: 'Man United' },
          away: { club: 'MCI', name: 'Man City' },
          kickoffTime: '4:30 PM',
        },
      ],
    },
  ],
}

/** Number of fantasy-owned starters in a side's XI (the toggle count badge). */
function ownedCount(side) {
  return side.xi.filter((p) => p.owner).length
}

/* GW / fixture selector pill (static, illustrative) */
function LuSelectPill({ label, value }) {
  return (
    <span className="mockup-lu-pill">
      <span className="mockup-lu-pill__label">{label}</span>
      <span className="mockup-lu-pill__value">{value}</span>
      <svg viewBox="0 0 12 12" className="mockup-lu-pill__chev" aria-hidden>
        <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

function LuToolbar({ fixtureValue }) {
  return (
    <div className="mockup-lu-toolbar">
      <LuSelectPill label="GW" value="31" />
      {fixtureValue ? <LuSelectPill label="Fixture" value={fixtureValue} /> : null}
      <button type="button" className="mockup-lu-refresh" aria-label="Refresh">
        <svg viewBox="0 0 16 16" aria-hidden>
          <path d="M13.6 8a5.6 5.6 0 1 1-1.64-3.96M13.6 2.4V5.2H10.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}

/** Static fixture header. Uses the SAME grid layout as the collapsed
 *  `LuFixtureRow` (state chip ‖ teams ‖ kickoff time) so the deep-dive
 *  variant's header reads as one design language with the fixture list.
 *  Rendered as a plain <div> (no chev, no click target). */
function FixtureHead({ fx, narrow = false }) {
  const center = fx.state === 'live' || fx.state === 'ft' ? fx.score : 'vs'
  const homeLabel = narrow ? fx.home.club : fx.home.name
  const awayLabel = narrow ? fx.away.club : fx.away.name
  return (
    <div className="mockup-lu-fxrow mockup-lu-fxrow--static" role="heading" aria-level="3">
      <span className="mockup-lu-fxrow__chip"><LuStateChip fx={fx} /></span>
      <span className="mockup-lu-fxrow__teams">
        <span className="mockup-lu-fxrow__home">
          <span className="mockup-lu-fxrow__name">{homeLabel}</span>
          <LuCrest club={fx.home.club} size={narrow ? 18 : 22} />
        </span>
        <span className={'mockup-lu-fxrow__score' + (center === 'vs' ? ' mockup-lu-fxrow__score--vs' : '')}>
          {center}
        </span>
        <span className="mockup-lu-fxrow__away">
          <LuCrest club={fx.away.club} size={narrow ? 18 : 22} />
          <span className="mockup-lu-fxrow__name">{awayLabel}</span>
        </span>
      </span>
      <span className="mockup-lu-fxrow__right"><LuKickoff fx={fx} /></span>
    </div>
  )
}

/* ================================================================== */
/* DESKTOP — paired home|away XI tiles (Variant A, confirmed only)     */
/* ================================================================== */
function PairedHead({ side, align }) {
  return (
    <div className={`mockup-lu-a__head mockup-lu-a__head--${align}`}>
      <LuCrest club={side.club} size={26} />
      <span className="mockup-lu-a__team">{side.name}</span>
      <span className="mockup-lu-a__formation">{side.formation}</span>
      <ConfirmedBadge />
    </div>
  )
}

function PairedCell({ p, align }) {
  if (!p) return <div className="mockup-lu-a__cell mockup-lu-a__cell--empty" aria-hidden />
  return (
    <div className={`mockup-lu-a__cell mockup-lu-a__cell--${align}${p.owner ? ' is-owned' : ''}`}>
      <LuPos pos={p.pos} />
      <span className="mockup-lu-a__name">{p.name}</span>
      <LuOwner owner={p.owner} showName={false} />
    </div>
  )
}

function PairedXI({ fx }) {
  const h = fx.home
  const a = fx.away
  const xiLen = Math.max(h.xi.length, a.xi.length)
  const benchLen = Math.max(h.bench.length, a.bench.length)
  return (
    <div className="mockup-lu-a">
      <div className="mockup-lu-a__heads">
        <PairedHead side={h} align="home" />
        <PairedHead side={a} align="away" />
      </div>
      <div className="mockup-lu-a__rows">
        {Array.from({ length: xiLen }, (_, i) => (
          <div className="mockup-lu-a__row" key={i}>
            <PairedCell p={h.xi[i]} align="home" />
            <PairedCell p={a.xi[i]} align="away" />
          </div>
        ))}
      </div>
      <div className="mockup-lu-a__bench-head"><span>Bench</span><span>Bench</span></div>
      <div className="mockup-lu-a__rows mockup-lu-a__rows--bench">
        {Array.from({ length: benchLen }, (_, i) => (
          <div className="mockup-lu-a__row" key={i}>
            <PairedCell p={h.bench[i]} align="home" />
            <PairedCell p={a.bench[i]} align="away" />
          </div>
        ))}
      </div>
      {(h.notInSquad?.length || a.notInSquad?.length) ? (
        <div className="mockup-lu-a__nis-row">
          <div className="mockup-lu-a__nis-cell mockup-lu-a__nis-cell--home">
            <NotInSquadRow players={h.notInSquad} variant="desktop" />
          </div>
          <div className="mockup-lu-a__nis-cell mockup-lu-a__nis-cell--away">
            <NotInSquadRow players={a.notInSquad} variant="desktop" />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function LineupsDesktop() {
  return (
    <div className="mockup-lu-page">
      <LuToolbar fixtureValue="ARS v LIV" />
      <div className="mockup-lu-card">
        <FixtureHead fx={FIXTURE} />
        <PairedXI fx={FIXTURE} />
      </div>
    </div>
  )
}

/* ================================================================== */
/* MOBILE — A row styling + C home/away toggle (one XI at a time)      */
/* ================================================================== */
function MobileTeamToggle({ fx, team, onChange }) {
  return (
    <div className="mockup-lu-toggle" role="tablist" aria-label="Choose team">
      {['home', 'away'].map((t) => {
        const side = fx[t]
        const active = team === t
        return (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={active}
            className={'mockup-lu-toggle__pill' + (active ? ' is-active' : '')}
            onClick={() => onChange(t)}
          >
            <LuCrest club={side.club} size={18} />
            <span className="mockup-lu-toggle__name">{side.name}</span>
            <span className="mockup-lu-toggle__formation">{side.formation}</span>
            <span className="mockup-lu-toggle__count">{ownedCount(side)}</span>
          </button>
        )
      })}
    </div>
  )
}

/** A-style row, single column: crest + name + owner badge + FPL pos pill.
 *  Owner sits LEFT of the position so the position pill stays in the same
 *  rightmost column across every row (uniform vertical alignment). */
function MobileRow({ p, club, bench = false }) {
  return (
    <div className={'mockup-lu-m__row' + (bench ? ' mockup-lu-m__row--bench' : '') + (p.owner ? ' is-owned' : '')}>
      <LuCrest club={club} size={20} />
      <span className="mockup-lu-m__name">{p.name}</span>
      <LuOwner owner={p.owner} />
      <LuPos pos={p.pos} />
    </div>
  )
}

/** Single-row chip strip: fantasy-owned players on this PL club that are
 *  NOT in the matchday squad (no XI, no bench). Owner crest + name, with
 *  pipe separators between items. Wraps gracefully if there's no room. */
function NotInSquadRow({ players, variant = 'mobile' }) {
  if (!players?.length) return null
  return (
    <div className={`mockup-lu-nis mockup-lu-nis--${variant}`}>
      <span className="mockup-lu-nis__h">Not in squad</span>
      <span className="mockup-lu-nis__items">
        {players.map((p, i) => (
          <span className="mockup-lu-nis__item" key={`${p.owner}:${p.name}:${i}`}>
            {i > 0 ? <span className="mockup-lu-nis__sep" aria-hidden>|</span> : null}
            <LuOwner owner={p.owner} showName={false} size={16} />
            <span className="mockup-lu-nis__name">{p.name}</span>
          </span>
        ))}
      </span>
    </div>
  )
}

/** Mobile body: toggle + single-team XI + bench + (optional) not-in-squad.
 *  Reused inline below a fixture row in the new fixture-list view, and also
 *  by `LineupsMobile` for the standalone "deep-dive" mockup variant.
 *  The formation/confirmed/owner-count sub-bar is intentionally removed —
 *  the toggle pill carries the owned-count, the collapsed row's state chip
 *  carries "Lineups out", and formation is shown on the toggle pill itself. */
function LineupsBodyMobile({ fx, initialTeam = 'home' }) {
  const [team, setTeam] = useState(initialTeam)
  const side = fx[team]
  return (
    <>
      <MobileTeamToggle fx={fx} team={team} onChange={setTeam} />
      <div className="mockup-lu-m__list">
        {side.xi.map((p, i) => (
          <MobileRow key={i} p={p} club={side.club} />
        ))}
      </div>
      <div className="mockup-lu-m__bench-head">Bench</div>
      <div className="mockup-lu-m__list">
        {side.bench.map((p, i) => (
          <MobileRow key={i} p={p} club={side.club} bench />
        ))}
      </div>
      <NotInSquadRow players={side.notInSquad} variant="mobile" />
    </>
  )
}

function LineupsMobile({ initialTeam = 'home' }) {
  const fx = FIXTURE
  return (
    <div className="mockup-lu-page mockup-lu-page--mobile">
      <div className="mockup-lu-mtitle">Lineups<span>GW 31</span></div>
      <LuToolbar fixtureValue="ARS v LIV" />
      <div className="mockup-lu-card">
        <FixtureHead fx={fx} narrow />
        <LineupsBodyMobile fx={fx} initialTeam={initialTeam} />
      </div>
    </div>
  )
}

/* ================================================================== */
/* NEW: Gameweek fixture list (pre-selection state).                   */
/* FotMob-style day-grouped list with our state chips and inline expand */
/* below each row.                                                     */
/* ================================================================== */

/** Centered '‹ GW 31 ▾ ›' selector cluster. */
function LuGwNav({ gw }) {
  return (
    <div className="mockup-lu-gwnav" role="group" aria-label="Gameweek navigation">
      <button type="button" className="mockup-lu-gwnav__arrow" aria-label="Previous gameweek">
        <svg viewBox="0 0 16 16" aria-hidden>
          <path d="M9.5 3.5 5.5 8l4 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button type="button" className="mockup-lu-gwnav__center">
        <span className="mockup-lu-gwnav__label">GW</span>
        <span className="mockup-lu-gwnav__value">{gw.number}</span>
        <svg viewBox="0 0 12 12" className="mockup-lu-gwnav__chev" aria-hidden>
          <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button type="button" className="mockup-lu-gwnav__arrow" aria-label="Next gameweek">
        <svg viewBox="0 0 16 16" aria-hidden>
          <path d="M6.5 3.5 10.5 8l-4 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button type="button" className="mockup-lu-refresh mockup-lu-gwnav__refresh" aria-label="Refresh">
        <svg viewBox="0 0 16 16" aria-hidden>
          <path d="M13.6 8a5.6 5.6 0 1 1-1.64-3.96M13.6 2.4V5.2H10.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}

/** Coloured state chip on the LEFT of each fixture row.
 *  - live: red pulsing dot + minute
 *  - pre:  brand violet "Lineups out"
 *  - ft:   muted "FT"
 *  - scheduled: nothing (left column stays empty; kickoff time sits on the right). */
function LuStateChip({ fx }) {
  if (fx.state === 'live') {
    return (
      <span className="mockup-lu-fxchip mockup-lu-fxchip--live">
        <span className="mockup-lu-fxchip__dot" aria-hidden />
        <span>LIVE</span>
        {fx.liveMinute ? <span className="mockup-lu-fxchip__min">{fx.liveMinute}</span> : null}
      </span>
    )
  }
  if (fx.state === 'pre') {
    return <span className="mockup-lu-fxchip mockup-lu-fxchip--pre">Lineups out</span>
  }
  if (fx.state === 'ft') {
    return <span className="mockup-lu-fxchip mockup-lu-fxchip--ft">FT</span>
  }
  return <span className="mockup-lu-fxchip mockup-lu-fxchip--ghost" aria-hidden />
}

/** Right-side kickoff time (mono, muted). Hidden for live/ft — the chip
 *  on the left already conveys the time dimension. */
function LuKickoff({ fx }) {
  if (fx.state === 'live' || fx.state === 'ft') return <span className="mockup-lu-fxright" aria-hidden />
  return <span className="mockup-lu-fxright">{fx.kickoffTime}</span>
}

/** Day band: 'Saturday, Apr 12'. Spans the card. */
function LuDayBand({ label }) {
  return <div className="mockup-lu-day">{label}</div>
}

/** Single collapsed fixture row + (when expanded) inline body below it. */
function LuFixtureRow({ fx, narrow = false, expanded, onToggle }) {
  const hasLineup = Boolean(fx.lineup)
  const center = fx.state === 'live' || fx.state === 'ft' ? fx.score : 'vs'
  const homeLabel = narrow ? fx.home.club : fx.home.name
  const awayLabel = narrow ? fx.away.club : fx.away.name
  return (
    <div className={'mockup-lu-fxitem' + (expanded ? ' is-expanded' : '')}>
      <button
        type="button"
        className="mockup-lu-fxrow"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="mockup-lu-fxrow__chip"><LuStateChip fx={fx} /></span>
        <span className="mockup-lu-fxrow__teams">
          <span className="mockup-lu-fxrow__home">
            <span className="mockup-lu-fxrow__name">{homeLabel}</span>
            <LuCrest club={fx.home.club} size={narrow ? 18 : 22} />
          </span>
          <span className={'mockup-lu-fxrow__score' + (center === 'vs' ? ' mockup-lu-fxrow__score--vs' : '')}>
            {center}
          </span>
          <span className="mockup-lu-fxrow__away">
            <LuCrest club={fx.away.club} size={narrow ? 18 : 22} />
            <span className="mockup-lu-fxrow__name">{awayLabel}</span>
          </span>
        </span>
        <span className="mockup-lu-fxrow__right"><LuKickoff fx={fx} /></span>
        <span className="mockup-lu-fxrow__chev" aria-hidden>{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded ? (
        <div className="mockup-lu-fxbody">
          {hasLineup ? (
            narrow
              ? <LineupsBodyMobile fx={fx.lineup} />
              : <PairedXI fx={fx.lineup} />
          ) : (
            <div className="mockup-lu-fxbody__empty">
              Line-ups not yet announced — back closer to kickoff ({fx.kickoffTime}).
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

/** Pinned 'Live now' strip shown ONLY when ≥1 live fixture exists.
 *  Live fixtures rendered here are removed from the day groups below. */
function LuLiveStrip({ fixtures, narrow, expanded, toggle }) {
  if (!fixtures.length) return null
  return (
    <section className="mockup-lu-livenow" aria-label="Live now">
      <header className="mockup-lu-livenow__head">
        <span className="mockup-lu-livenow__dot" aria-hidden />
        <span className="mockup-lu-livenow__title">Live now</span>
        <span className="mockup-lu-livenow__count">{fixtures.length}</span>
      </header>
      <div className="mockup-lu-fxlist mockup-lu-fxlist--live">
        {fixtures.map((fx) => (
          <LuFixtureRow
            key={fx.id}
            fx={fx}
            narrow={narrow}
            expanded={expanded.has(fx.id)}
            onToggle={() => toggle(fx.id)}
          />
        ))}
      </div>
    </section>
  )
}

/** Full fixture list for a gameweek: optional live strip + day-grouped rows. */
function LuFixtureList({ gw, narrow = false }) {
  const [expanded, setExpanded] = useState(() => new Set())
  const toggle = (id) => setExpanded((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const liveFixtures = gw.days.flatMap((d) => d.fixtures.filter((f) => f.state === 'live'))
  const hasLive = liveFixtures.length > 0
  const dayGroups = gw.days
    .map((d) => ({ ...d, fixtures: hasLive ? d.fixtures.filter((f) => f.state !== 'live') : d.fixtures }))
    .filter((d) => d.fixtures.length > 0)

  return (
    <div className="mockup-lu-fixlist-wrap">
      <LuLiveStrip fixtures={liveFixtures} narrow={narrow} expanded={expanded} toggle={toggle} />
      {dayGroups.map((day) => (
        <section className="mockup-lu-daysect" key={day.label}>
          <LuDayBand label={day.label} />
          <div className="mockup-lu-fxlist">
            {day.fixtures.map((fx) => (
              <LuFixtureRow
                key={fx.id}
                fx={fx}
                narrow={narrow}
                expanded={expanded.has(fx.id)}
                onToggle={() => toggle(fx.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

/** Desktop fixture-list page (pre-selection state). */
function FixturesListDesktop() {
  return (
    <div className="mockup-lu-page">
      <LuGwNav gw={GAMEWEEK_31} />
      <div className="mockup-lu-card">
        <LuFixtureList gw={GAMEWEEK_31} />
      </div>
    </div>
  )
}

/** Mobile fixture-list page (pre-selection state). */
function FixturesListMobile() {
  return (
    <div className="mockup-lu-page mockup-lu-page--mobile">
      <div className="mockup-lu-mtitle">Lineups<span>GW {GAMEWEEK_31.number}</span></div>
      <LuGwNav gw={GAMEWEEK_31} />
      <div className="mockup-lu-card">
        <LuFixtureList gw={GAMEWEEK_31} narrow />
      </div>
    </div>
  )
}

/* ================================================================== */
/* Showcase — single converged design (desktop + both mobile states)  */
/* ================================================================== */
export function LineupsShowcase() {
  return (
    <section className="mockup__section">
      <div className="mockup__eyebrow">Lineups redesign · FPL Live › Lineups · CONVERGED</div>
      <h2 className="mockup__section-h">Announced PL line-ups — chosen design</h2>
      <p className="mockup__section-sub">
        The page now opens on a <strong>gameweek fixture list</strong> (FotMob-styled, day-grouped)
        instead of a fixture dropdown. Each row carries our state chip on the left (<em>Lineups out</em>,
        <em>LIVE n&apos;</em>, <em>FT</em>) and the kickoff time on the right for pre-kick games. Clicking a
        row <strong>expands the line-ups inline</strong> below it — desktop drops in paired home | away
        XI tiles, mobile drops in the home/away toggle + single-side row list. <strong>Multiple rows
        can be open at once</strong>; nothing is pre-expanded. A pinned <strong>Live now</strong> strip
        appears above the day groups only when ≥1 fixture is in play (those rows are removed from the
        day groups while live, to avoid duplication). The GW chrome is a centered{' '}
        <strong>‹ GW {GAMEWEEK_31.number} ▾ ›</strong> selector.
      </p>

      <div className="mockup-lu-variant">
        <div className="mockup-lu-variant__label">Gameweek fixture list · pre-selection (you land here)</div>
        <div className="mockup-lu-desktop"><FixturesListDesktop /></div>
      </div>

      <div className="mockup-portrait-row mockup-lu-frames">
        <div className="mockup-portrait-col">
          <div className="mockup-portrait-col__h">Mobile · 390 px · Fixture list (collapsed)</div>
          <LuPhone><FixturesListMobile /></LuPhone>
        </div>
        <div className="mockup-portrait-col">
          <div className="mockup-portrait-col__h">Mobile · 390 px · Single fixture deep-dive (existing)</div>
          <LuPhone><LineupsMobile initialTeam="home" /></LuPhone>
        </div>
      </div>

      <div className="mockup-lu-variant">
        <div className="mockup-lu-variant__label">Desktop · single fixture deep-dive (existing paired XI)</div>
        <div className="mockup-lu-desktop"><LineupsDesktop /></div>
      </div>

      <div className="mockup-lu-preserves">
        <span className="mockup-lu-preserves__h">Preserves</span>
        {['Paired home/away (desktop)', 'Home/away toggle (mobile)', 'Confirmed only', 'Formation', 'PL crest', 'FPL pos pill', 'Owner badge', 'Bench', 'Kickoff label', 'GW selector'].map((p) => (
          <span className="mockup-lu-preserves__chip" key={p}>{p}</span>
        ))}
      </div>
    </section>
  )
}

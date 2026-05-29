/*
 * TCLOT Design Mockup — Trade card · portrait (mobile) variants
 *
 * Production trade card (.trade2) is a head-to-head two-column split. On
 * mobile portrait the available width per side is too tight: team names
 * and player names truncate even when they're short, position pills get
 * cramped against the points figure, and the tenure sub-line wraps.
 *
 * This file mocks four portrait-targeted card layouts side-by-side. All
 * four use REAL processed trade data (data.tradesPanelRows) and all four
 * keep the result bar (score line) at the bottom of the card.
 *
 *   A · Tightened split        — same format, smaller paddings/fonts/avatars
 *   B · Stacked teams          — each team is its own full-width band
 *   C · Acquired-by feed       — one row per acquired player, team code chip
 *   D · Vertical exchange      — team A → players · ⇄ · team B → players
 *
 * Each variant renders BOTH a single-player and a multi-player trade so
 * the layout is judged on both. Rendered inside a PortraitFrame so the
 * widths match a real phone (~375 px viewport).
 */

import { useState } from 'react'
import { TeamAvatar } from './TeamAvatar'
import './MockupTradePortrait.css'

const POS_BY_TYPE = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' }

/* ------------------------------------------------------------------ */
/* Atoms                                                              */
/* ------------------------------------------------------------------ */

function ClubBadge({ player, size = 20 }) {
  const [err, setErr] = useState(false)
  const url = player?.badgeUrl
  const style = { width: size, height: size }
  if (!url || err) {
    return (
      <span className="mockup-tvp-badge mockup-tvp-badge--text" style={style}>
        {(player?.teamShort ?? '?').slice(0, 3)}
      </span>
    )
  }
  return (
    <span className="mockup-tvp-badge" style={style}>
      <img src={url} alt="" loading="lazy" decoding="async" onError={() => setErr(true)} />
    </span>
  )
}

function PosText({ typeId }) {
  const pos = POS_BY_TYPE[typeId]
  if (!pos) return null
  return <span className="mockup-tvp-pos">{pos}</span>
}

function Tenure({ leg }) {
  const kept = leg.stillOnTeam
  const range =
    leg.gwRangeLabel ??
    (leg.startGw != null && leg.endGw != null && leg.startGw !== leg.endGw
      ? `${leg.startGw}\u2013${leg.endGw}`
      : `${leg.startGw ?? leg.endGw ?? ''}`)
  return (
    <span className={'mockup-tvp-tenure' + (kept ? ' is-kept' : ' is-gone')}>
      <span className="mockup-tvp-tenure__dot" aria-hidden />
      <span className="mockup-tvp-tenure__lbl">
        {kept ? (
          <>on squad</>
        ) : (
          <>
            GW <span className="tabular">{range}</span>
          </>
        )}
      </span>
    </span>
  )
}

function fmtDate(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return null
  }
}

function sumLegs(pairs, side) {
  return (pairs || []).reduce((s, p) => s + (Number(p?.[side]?.totalPoints) || 0), 0)
}

/* Result bar (the "score line") — kept across all variants. */
function ScoreBar({ trade }) {
  const off = sumLegs(trade.pairs, 'offeredLeg')
  const rec = sumLegs(trade.pairs, 'receivedLeg')
  const total = Math.max(off + rec, 1)
  const offShare = (off / total) * 100
  const offWin = off > rec
  const recWin = rec > off
  return (
    <div className="mockup-tvp-bar">
      <div
        className="mockup-tvp-bar__track"
        role="img"
        aria-label={`${trade.offeredTeamName} ${off} — ${rec} ${trade.receivedTeamName}`}
      >
        <span
          className={'mockup-tvp-bar__seg' + (offWin ? ' is-win' : '')}
          style={{ width: `${offShare}%` }}
        />
        <span
          className={'mockup-tvp-bar__seg' + (recWin ? ' is-win' : '')}
          style={{ width: `${100 - offShare}%` }}
        />
      </div>
      <div className="mockup-tvp-bar__legend">
        <span className={'mockup-tvp-bar__pts tabular' + (offWin ? ' is-win' : '')}>{off}</span>
        <span className={'mockup-tvp-bar__pts tabular' + (recWin ? ' is-win' : '')}>{rec}</span>
      </div>
    </div>
  )
}

function CardHead({ trade }) {
  return (
    <div className="mockup-tvp-head">
      {trade.event != null ? <span className="mockup-tvp-gw">GW {trade.event}</span> : <span />}
      {trade.responseTime ? (
        <time className="mockup-tvp-date" dateTime={trade.responseTime}>
          {fmtDate(trade.responseTime)}
        </time>
      ) : null}
    </div>
  )
}

/* Compact 2-3 letter code from a team name — used for the chip in Variant C. */
function teamCode(name) {
  if (!name) return '?'
  const words = String(name).trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase()
  }
  return words.map((w) => w[0]).join('').slice(0, 3).toUpperCase()
}

/* ================================================================== */
/* A — Tightened split (spacing-only baseline)                         */
/* ================================================================== */

function SideA({ trade, side, teamLogoMap, kitIndexByEntry }) {
  const isOff = side === 'offered'
  const name = isOff ? trade.offeredTeamName : trade.receivedTeamName
  const entry = isOff
    ? trade.offeredLeagueEntry ?? trade.offeredFplEntry
    : trade.receivedLeagueEntry ?? trade.receivedFplEntry
  const total = sumLegs(trade.pairs, isOff ? 'offeredLeg' : 'receivedLeg')
  const legs = (trade.pairs || [])
    .map((p) => (isOff ? p.offeredLeg : p.receivedLeg))
    .filter(Boolean)
  return (
    <div className="mockup-tvp-A__side">
      <div className="mockup-tvp-A__team">
        <TeamAvatar
          entryId={entry}
          name={name}
          size="sm"
          logoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
        />
        <span className="mockup-tvp-A__team-name" title={name}>{name}</span>
        <span className="mockup-tvp-A__total tabular">{total}</span>
      </div>
      <div className="mockup-tvp-A__players">
        {legs.map((leg, i) => (
          <div className="mockup-tvp-A__pl" key={i}>
            <ClubBadge player={leg.gained} size={18} />
            <div className="mockup-tvp-A__pl-id">
              <span className="mockup-tvp-A__pl-name-line">
                <span className="mockup-tvp-A__pl-name">{leg.gained.web_name}</span>
                <PosText typeId={leg.gained.elementTypeId} />
              </span>
              <Tenure leg={leg} />
            </div>
            <span className="mockup-tvp-A__pl-pts tabular">{leg.totalPoints ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function VariantATight({ trade, teamLogoMap, kitIndexByEntry }) {
  return (
    <article className="mockup-tvp mockup-tvp--A">
      <CardHead trade={trade} />
      <div className="mockup-tvp-A__split">
        <SideA trade={trade} side="offered" teamLogoMap={teamLogoMap} kitIndexByEntry={kitIndexByEntry} />
        <div className="mockup-tvp-A__rule" aria-hidden />
        <SideA trade={trade} side="received" teamLogoMap={teamLogoMap} kitIndexByEntry={kitIndexByEntry} />
      </div>
      <ScoreBar trade={trade} />
    </article>
  )
}

/* ================================================================== */
/* B — Stacked teams (each team is its own full-width band)            */
/* ================================================================== */

function BandB({ trade, side, teamLogoMap, kitIndexByEntry }) {
  const isOff = side === 'offered'
  const name = isOff ? trade.offeredTeamName : trade.receivedTeamName
  const entry = isOff
    ? trade.offeredLeagueEntry ?? trade.offeredFplEntry
    : trade.receivedLeagueEntry ?? trade.receivedFplEntry
  const total = sumLegs(trade.pairs, isOff ? 'offeredLeg' : 'receivedLeg')
  const legs = (trade.pairs || [])
    .map((p) => (isOff ? p.offeredLeg : p.receivedLeg))
    .filter(Boolean)
  return (
    <div className="mockup-tvp-B__band">
      <div className="mockup-tvp-B__team">
        <TeamAvatar
          entryId={entry}
          name={name}
          size="sm"
          logoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
        />
        <div className="mockup-tvp-B__team-id">
          <span className="mockup-tvp-B__team-eyebrow">acquired by</span>
          <span className="mockup-tvp-B__team-name" title={name}>{name}</span>
        </div>
        <span className="mockup-tvp-B__total tabular">{total}</span>
      </div>
      <div className="mockup-tvp-B__players">
        {legs.map((leg, i) => (
          <div className="mockup-tvp-B__pl" key={i}>
            <ClubBadge player={leg.gained} size={22} />
            <div className="mockup-tvp-B__pl-id">
              <span className="mockup-tvp-B__pl-name-line">
                <span className="mockup-tvp-B__pl-name">{leg.gained.web_name}</span>
                <PosText typeId={leg.gained.elementTypeId} />
              </span>
              <Tenure leg={leg} />
            </div>
            <span className="mockup-tvp-B__pl-pts tabular">{leg.totalPoints ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function VariantBStacked({ trade, teamLogoMap, kitIndexByEntry }) {
  return (
    <article className="mockup-tvp mockup-tvp--B">
      <CardHead trade={trade} />
      <div className="mockup-tvp-B">
        <BandB trade={trade} side="offered" teamLogoMap={teamLogoMap} kitIndexByEntry={kitIndexByEntry} />
        <div className="mockup-tvp-B__sep" aria-hidden>
          <span className="mockup-tvp-B__sep-line" />
          <span className="mockup-tvp-B__sep-arr">⇄</span>
          <span className="mockup-tvp-B__sep-line" />
        </div>
        <BandB trade={trade} side="received" teamLogoMap={teamLogoMap} kitIndexByEntry={kitIndexByEntry} />
      </div>
      <ScoreBar trade={trade} />
    </article>
  )
}

/* ================================================================== */
/* C — Acquired-by feed (1 row per acquired player, team chip)         */
/* ================================================================== */

function VariantCFeed({ trade }) {
  const offCode = teamCode(trade.offeredTeamName)
  const recCode = teamCode(trade.receivedTeamName)
  const rows = []
  ;(trade.pairs || []).forEach((p) => {
    if (p.offeredLeg) rows.push({ leg: p.offeredLeg, team: trade.offeredTeamName, code: offCode, who: 'off' })
    if (p.receivedLeg) rows.push({ leg: p.receivedLeg, team: trade.receivedTeamName, code: recCode, who: 'rec' })
  })
  return (
    <article className="mockup-tvp mockup-tvp--C">
      <CardHead trade={trade} />
      <div className="mockup-tvp-C__teams" title={`${trade.offeredTeamName} ⇄ ${trade.receivedTeamName}`}>
        <span className="mockup-tvp-C__teams-name">{trade.offeredTeamName}</span>
        <span className="mockup-tvp-C__teams-arr">⇄</span>
        <span className="mockup-tvp-C__teams-name">{trade.receivedTeamName}</span>
      </div>
      <div className="mockup-tvp-C__rows">
        {rows.map((r, i) => (
          <div className="mockup-tvp-C__row" key={i}>
            <span className={'mockup-tvp-C__chip mockup-tvp-C__chip--' + r.who}>{r.code}</span>
            <ClubBadge player={r.leg.gained} size={20} />
            <div className="mockup-tvp-C__id">
              <span className="mockup-tvp-C__name-line">
                <span className="mockup-tvp-C__name">{r.leg.gained.web_name}</span>
                <PosText typeId={r.leg.gained.elementTypeId} />
              </span>
              <Tenure leg={r.leg} />
            </div>
            <span className="mockup-tvp-C__pts tabular">{r.leg.totalPoints ?? 0}</span>
          </div>
        ))}
      </div>
      <ScoreBar trade={trade} />
    </article>
  )
}

/* ================================================================== */
/* D — Vertical exchange (compact team headers, ⇄ between)             */
/* ================================================================== */

function ExchangeBlock({ trade, side, teamLogoMap, kitIndexByEntry }) {
  const isOff = side === 'offered'
  const name = isOff ? trade.offeredTeamName : trade.receivedTeamName
  const entry = isOff
    ? trade.offeredLeagueEntry ?? trade.offeredFplEntry
    : trade.receivedLeagueEntry ?? trade.receivedFplEntry
  const total = sumLegs(trade.pairs, isOff ? 'offeredLeg' : 'receivedLeg')
  const legs = (trade.pairs || [])
    .map((p) => (isOff ? p.offeredLeg : p.receivedLeg))
    .filter(Boolean)
  return (
    <>
      <div className="mockup-tvp-D__team">
        <TeamAvatar
          entryId={entry}
          name={name}
          size="sm"
          logoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
        />
        <span className="mockup-tvp-D__team-name" title={name}>{name}</span>
        <span className="mockup-tvp-D__total tabular">{total}</span>
      </div>
      <div className="mockup-tvp-D__players">
        {legs.map((leg, i) => (
          <div className="mockup-tvp-D__pl" key={i}>
            <ClubBadge player={leg.gained} size={20} />
            <div className="mockup-tvp-D__pl-id">
              <span className="mockup-tvp-D__pl-name-line">
                <span className="mockup-tvp-D__pl-name">{leg.gained.web_name}</span>
                <PosText typeId={leg.gained.elementTypeId} />
              </span>
              <Tenure leg={leg} />
            </div>
            <span className="mockup-tvp-D__pl-pts tabular">{leg.totalPoints ?? 0}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function VariantDExchange({ trade, teamLogoMap, kitIndexByEntry }) {
  return (
    <article className="mockup-tvp mockup-tvp--D">
      <CardHead trade={trade} />
      <div className="mockup-tvp-D">
        <ExchangeBlock trade={trade} side="offered" teamLogoMap={teamLogoMap} kitIndexByEntry={kitIndexByEntry} />
        <div className="mockup-tvp-D__arr" aria-hidden>⇄</div>
        <ExchangeBlock trade={trade} side="received" teamLogoMap={teamLogoMap} kitIndexByEntry={kitIndexByEntry} />
      </div>
      <ScoreBar trade={trade} />
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* Showcase — renders all four variants in 375 px portrait frames     */
/* ------------------------------------------------------------------ */

const VARIANTS = [
  {
    id: 'A',
    label: 'Variant A · Tightened split',
    sub:
      'Same head-to-head split as production, with smaller paddings, fonts and avatars. ' +
      'Diagnostic: shows whether the truncation is purely a spacing problem, or whether ' +
      'two columns simply do not fit on a phone.',
    render: (t, props) => <VariantATight trade={t} {...props} />,
  },
  {
    id: 'B',
    label: 'Variant B · Stacked teams',
    sub:
      'Each team is its own full-width band — team header (avatar · name · total) on top, ' +
      'their incoming players underneath. A ⇄ separator divides the two bands. Player rows ' +
      'use the full card width, so names never truncate.',
    render: (t, props) => <VariantBStacked trade={t} {...props} />,
  },
  {
    id: 'C',
    label: 'Variant C · Acquired-by feed',
    sub:
      'A header line shows the matchup; below it is one row per acquired player with a ' +
      'small team-code chip on the left for "who got this". Most compact and scannable; ' +
      'the team chip uses ~3 letters so identity is preserved without taking column space.',
    render: (t, props) => <VariantCFeed trade={t} {...props} />,
  },
  {
    id: 'D',
    label: 'Variant D · Vertical exchange',
    sub:
      'Compact team header, then the players that team acquired, then a centered ⇄ glyph, ' +
      'then the second team and their incoming players. Strongest "trade" narrative — reads ' +
      'top-to-bottom as A gets X · B gets Y.',
    render: (t, props) => <VariantDExchange trade={t} {...props} />,
  },
]

/**
 * @param {{ trades?: any[], teamLogoMap?: any, kitIndexByEntry?: any, PortraitFrame: any }} args
 */
export function TradePortraitVariants({
  trades = [],
  teamLogoMap = {},
  kitIndexByEntry = {},
  PortraitFrame,
}) {
  if (!trades.length) {
    return (
      <div className="mockup-tvp-empty">
        No trade data loaded. Trades render from <code>trades-panel.json</code> via{' '}
        <code>data.tradesPanelRows</code>.
      </div>
    )
  }
  if (!PortraitFrame) {
    return null
  }

  // Single-pair sample + a multi-pair sample so each variant is judged on both.
  const single = trades[0]
  const multi = trades.find((t) => (t.pairs?.length || 0) > 1) ?? trades[1] ?? trades[0]
  const samples = multi === single ? [single] : [single, multi]
  const props = { teamLogoMap, kitIndexByEntry }

  return (
    <div className="mockup-tvp-showcase">
      {VARIANTS.map((v) => (
        <section className="mockup-tvp-row" key={v.id}>
          <div className="mockup-tvp-row__h">
            <div className="mockup__eyebrow">{v.label}</div>
            <p className="mockup__section-sub">{v.sub}</p>
          </div>
          <div className="mockup-tvp-row__frames">
            {samples.map((t) => (
              <div className="mockup-tvp-row__frame" key={t.id}>
                <div className="mockup-tvp-row__cap">
                  GW {t.event} · {t.pairs?.length || 1}-player
                </div>
                <PortraitFrame>
                  <div className="mockup-tvp-page">
                    {v.render(t, props)}
                  </div>
                </PortraitFrame>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

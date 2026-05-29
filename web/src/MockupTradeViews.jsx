/*
 * TCLOT Design Mockup — Trade views
 *
 * Local-only preview surfaces for the Trades tab at ?mockup=1. Renders REAL
 * processed trade data (data.tradesPanelRows from useLeagueData).
 *
 * This file deliberately reuses the site's existing visual grammar so the
 * trade surfaces match every other mockup:
 *   - club BADGES (not shirts) via the player badgeUrl
 *   - position pills via the shared .mockup-players-pos--{POS} classes
 *   - the mdraft "PTS" stacked numeric + Geist Mono tabular figures
 *   - surface / border / token cards, the same row + sub-line structure
 *
 * Four side-by-side options for the per-trade card are offered for review.
 * The trade ledger (locked in) is unchanged.
 */

import { useState } from 'react'
import { TeamAvatar } from './TeamAvatar'
import './MockupTradeViews.css'

/* FPL element_type → site position label (note: GK is "GKP" in the pills). */
const POS_BY_TYPE = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' }

/* ------------------------------------------------------------------ */
/* Shared atoms — same look as the rest of the site                     */
/* ------------------------------------------------------------------ */

/** Club crest badge (NOT a shirt) — uses the player's PL badge URL. */
function ClubBadge({ player, size = 22 }) {
  const [err, setErr] = useState(false)
  const url = player?.badgeUrl
  const style = { width: size, height: size }
  if (!url || err) {
    return (
      <span className="mockup-tv-badge mockup-tv-badge--text" style={style}>
        {(player?.teamShort ?? '?').slice(0, 3)}
      </span>
    )
  }
  return (
    <span className="mockup-tv-badge" style={style}>
      <img src={url} alt="" loading="lazy" decoding="async" onError={() => setErr(true)} />
    </span>
  )
}

/** Position pill — reuses the global .mockup-players-pos styling. */
function PosPill({ typeId }) {
  const pos = POS_BY_TYPE[typeId]
  if (!pos) return null
  return <span className={`mockup-players-pos mockup-players-pos--${pos}`}>{pos}</span>
}

/** Plain-text position — muted label, no coloured pill (draft-board style). */
function PosText({ typeId }) {
  const pos = POS_BY_TYPE[typeId]
  if (!pos) return null
  return <span className="mockup-tv-pos">{pos}</span>
}

/** Tenure: how many GWs the acquired player stayed — coloured dot, light text. */
function Tenure({ leg }) {
  const weeks = Math.max((leg.endGw ?? 0) - (leg.startGw ?? 0) + 1, 1)
  const kept = leg.stillOnTeam
  return (
    <span className="mockup-tv-tenure">
      <span className="mockup-tv-tenure__weeks">
        <span className="tabular">{weeks}</span> GW{weeks === 1 ? '' : 's'}
      </span>
      <span className={'mockup-tv-tenure__state' + (kept ? ' is-kept' : ' is-gone')}>
        <span className="mockup-tv-tenure__dot" aria-hidden />
        {kept ? 'on squad' : <>dropped GW <span className="tabular">{leg.endGw}</span></>}
      </span>
    </span>
  )
}

/** Stacked points figure — mirrors the mdraft "PTS" pattern. */
function PtsStat({ value }) {
  return (
    <span className="mockup-tv-pts">
      <span className="mockup-tv-pts__v tabular">{value}</span>
      <span className="mockup-tv-pts__l">PTS</span>
    </span>
  )
}

function IconSwap(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 6h18" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 18H3" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Trade math                                                           */
/* ------------------------------------------------------------------ */

function sumLegs(pairs, side) {
  return (pairs || []).reduce((s, p) => s + (Number(p?.[side]?.totalPoints) || 0), 0)
}

function fmtDate(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return null
  }
}

function tradeMeta(trade) {
  const pairs = trade.pairs || []
  const offeredPts = sumLegs(pairs, 'offeredLeg')
  const receivedPts = sumLegs(pairs, 'receivedLeg')
  const diff = offeredPts - receivedPts
  const winnerName =
    diff === 0 ? null : diff > 0 ? trade.offeredTeamName : trade.receivedTeamName
  return { pairs, offeredPts, receivedPts, diff, winnerName }
}

function VerdictLine({ trade }) {
  const { offeredPts, diff, winnerName } = tradeMeta(trade)
  return (
    <div className="mockup-tv-verdict">
      {winnerName === null ? (
        <span>Even — {offeredPts} pts each</span>
      ) : (
        <span><strong>{winnerName}</strong> +{Math.abs(diff)} pts</span>
      )}
    </div>
  )
}

/**
 * Result bar — a coloured proportional line showing which side won the trade.
 * Left segment = offered team, right = received; the winner's segment is wider
 * and accented, the loser's stays muted. Replaces the text verdict for Option 2.
 */
function VerdictBar({ trade }) {
  const { offeredPts, receivedPts, diff } = tradeMeta(trade)
  const total = Math.max(offeredPts + receivedPts, 1)
  const offShare = (offeredPts / total) * 100
  const offWin = diff > 0
  const recWin = diff < 0
  return (
    <div className="mockup-tv-bar">
      <div
        className="mockup-tv-bar__track"
        role="img"
        aria-label={`${trade.offeredTeamName} ${offeredPts} — ${receivedPts} ${trade.receivedTeamName}`}
      >
        <span
          className={'mockup-tv-bar__seg mockup-tv-bar__seg--l' + (offWin ? ' is-win' : '')}
          style={{ width: `${offShare}%` }}
        />
        <span
          className={'mockup-tv-bar__seg mockup-tv-bar__seg--r' + (recWin ? ' is-win' : '')}
          style={{ width: `${100 - offShare}%` }}
        />
      </div>
      <div className="mockup-tv-bar__legend">
        <span className={'mockup-tv-bar__pts tabular' + (offWin ? ' is-win' : '')}>{offeredPts}</span>
        <span className={'mockup-tv-bar__pts tabular' + (recWin ? ' is-win' : '')}>{receivedPts}</span>
      </div>
    </div>
  )
}

/* ================================================================== */
/* OPTION 1 — Feed card (Waivers/mdraft grammar)                       */
/* Each acquired player is one row: badge · name+pos / →team · tenure   */
/* · PTS. Reads as a chronological "who went where" feed.               */
/* ================================================================== */

function OptionFeed({ trade }) {
  const { pairs } = tradeMeta(trade)
  const rows = []
  pairs.forEach((p) => {
    rows.push({ leg: p.offeredLeg, team: trade.offeredTeamName })
    rows.push({ leg: p.receivedLeg, team: trade.receivedTeamName })
  })
  return (
    <article className="mockup-tv-card">
      <div className="mockup-tv-card__bar">
        <span className="mockup-tv-card__bar-icon"><IconSwap /></span>
        <span className="mockup-tv-card__bar-teams">
          {trade.offeredTeamName} <span className="mockup-tv-swap">⇄</span> {trade.receivedTeamName}
        </span>
        <span className="mockup-tv-card__bar-meta">GW {trade.event} · {fmtDate(trade.responseTime)}</span>
      </div>
      <div className="mockup-tv-feed">
        {rows.map((r, i) => (
          <div className="mockup-tv-feed__row" key={i}>
            <ClubBadge player={r.leg.gained} size={24} />
            <div className="mockup-tv-feed__id">
              <span className="mockup-tv-feed__name-line">
                <span className="mockup-tv-feed__name">{r.leg.gained.web_name}</span>
                <PosPill typeId={r.leg.gained.elementTypeId} />
              </span>
              <span className="mockup-tv-feed__sub">
                <span className="mockup-tv-feed__to">→ {r.team}</span>
                <span className="mockup-tv-sep" aria-hidden>·</span>
                <Tenure leg={r.leg} />
              </span>
            </div>
            <PtsStat value={r.leg.totalPoints ?? 0} />
          </div>
        ))}
      </div>
      <VerdictLine trade={trade} />
    </article>
  )
}

/* ================================================================== */
/* OPTION 2 — Head-to-head split                                       */
/* Two columns, team header + total, player rows with badge/pos/tenure. */
/* ================================================================== */

function SplitSide({ trade, side, teamLogoMap, kitIndexByEntry }) {
  const isOff = side === 'offered'
  const name = isOff ? trade.offeredTeamName : trade.receivedTeamName
  const entry = isOff
    ? trade.offeredLeagueEntry ?? trade.offeredFplEntry
    : trade.receivedLeagueEntry ?? trade.receivedFplEntry
  const total = sumLegs(trade.pairs, isOff ? 'offeredLeg' : 'receivedLeg')
  const legs = (trade.pairs || []).map((p) => (isOff ? p.offeredLeg : p.receivedLeg))
  return (
    <div className="mockup-tv-split__side">
      <div className="mockup-tv-split__team">
        <TeamAvatar entryId={entry} name={name} size="sm" logoMap={teamLogoMap} kitIndexByEntry={kitIndexByEntry} />
        <span className="mockup-tv-split__team-name">{name}</span>
        <span className="mockup-tv-split__total tabular">{total}</span>
      </div>
      <div className="mockup-tv-split__players">
        {legs.map((leg, i) => (
          <div className="mockup-tv-pl" key={i}>
            <ClubBadge player={leg.gained} size={20} />
            <div className="mockup-tv-pl__id">
              <span className="mockup-tv-pl__name-line">
                <span className="mockup-tv-pl__name">{leg.gained.web_name}</span>
                <PosText typeId={leg.gained.elementTypeId} />
              </span>
              <Tenure leg={leg} />
            </div>
            <span className="mockup-tv-pl__pts tabular">{leg.totalPoints ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function OptionSplit({ trade, teamLogoMap, kitIndexByEntry }) {
  return (
    <article className="mockup-tv-card">
      <div className="mockup-tv-card__bar">
        <span className="mockup-tv-gw">GW {trade.event}</span>
        <span className="mockup-tv-card__bar-meta">{fmtDate(trade.responseTime)}</span>
      </div>
      <div className="mockup-tv-split">
        <SplitSide trade={trade} side="offered" teamLogoMap={teamLogoMap} kitIndexByEntry={kitIndexByEntry} />
        <div className="mockup-tv-split__rule" aria-hidden />
        <SplitSide trade={trade} side="received" teamLogoMap={teamLogoMap} kitIndexByEntry={kitIndexByEntry} />
      </div>
      <VerdictBar trade={trade} />
    </article>
  )
}

/* ================================================================== */
/* OPTION 3 — Compact table                                            */
/* Team · Player (badge+pos) · Tenure · Pts — dense, standings-like.    */
/* ================================================================== */

function OptionTable({ trade, teamLogoMap, kitIndexByEntry }) {
  const { pairs } = tradeMeta(trade)
  const rows = []
  pairs.forEach((p) => {
    rows.push({
      leg: p.offeredLeg,
      name: trade.offeredTeamName,
      entry: trade.offeredLeagueEntry ?? trade.offeredFplEntry,
    })
    rows.push({
      leg: p.receivedLeg,
      name: trade.receivedTeamName,
      entry: trade.receivedLeagueEntry ?? trade.receivedFplEntry,
    })
  })
  return (
    <article className="mockup-tv-card">
      <div className="mockup-tv-card__bar">
        <span className="mockup-tv-card__bar-teams">
          {trade.offeredTeamName} <span className="mockup-tv-swap">⇄</span> {trade.receivedTeamName}
        </span>
        <span className="mockup-tv-card__bar-meta">GW {trade.event} · {fmtDate(trade.responseTime)}</span>
      </div>
      <div className="mockup-tv-tbl">
        <div className="mockup-tv-tbl__head">
          <span>Acquired by</span>
          <span>Player</span>
          <span>Tenure</span>
          <span className="mockup-tv-tbl__r">Pts</span>
        </div>
        {rows.map((r, i) => (
          <div className="mockup-tv-tbl__row" key={i}>
            <span className="mockup-tv-tbl__team">
              <TeamAvatar entryId={r.entry} name={r.name} size="sm" logoMap={teamLogoMap} kitIndexByEntry={kitIndexByEntry} />
              <span className="mockup-tv-tbl__team-name">{r.name}</span>
            </span>
            <span className="mockup-tv-tbl__player">
              <ClubBadge player={r.leg.gained} size={20} />
              <span className="mockup-tv-tbl__player-name">{r.leg.gained.web_name}</span>
              <PosPill typeId={r.leg.gained.elementTypeId} />
            </span>
            <span className="mockup-tv-tbl__tenure"><Tenure leg={r.leg} /></span>
            <span className="mockup-tv-tbl__pts tabular">{r.leg.totalPoints ?? 0}</span>
          </div>
        ))}
      </div>
      <VerdictLine trade={trade} />
    </article>
  )
}

/* ================================================================== */
/* OPTION 4 — Minimal summary lines                                    */
/* "{team} got {player} — {pts} pts · tenure" — text-forward + quiet.   */
/* ================================================================== */

function OptionLines({ trade }) {
  const { pairs } = tradeMeta(trade)
  const rows = []
  pairs.forEach((p) => {
    rows.push({ leg: p.offeredLeg, team: trade.offeredTeamName })
    rows.push({ leg: p.receivedLeg, team: trade.receivedTeamName })
  })
  return (
    <article className="mockup-tv-card mockup-tv-card--lines">
      <div className="mockup-tv-card__bar">
        <span className="mockup-tv-card__bar-meta">GW {trade.event} · {fmtDate(trade.responseTime)}</span>
      </div>
      <div className="mockup-tv-lines">
        {rows.map((r, i) => (
          <div className="mockup-tv-lines__row" key={i}>
            <span className="mockup-tv-lines__team">{r.team}</span>
            <ClubBadge player={r.leg.gained} size={20} />
            <span className="mockup-tv-lines__name">{r.leg.gained.web_name}</span>
            <PosPill typeId={r.leg.gained.elementTypeId} />
            <Tenure leg={r.leg} />
            <span className="mockup-tv-lines__pts tabular">{r.leg.totalPoints ?? 0} pts</span>
          </div>
        ))}
      </div>
      <VerdictLine trade={trade} />
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* Per-team ledger — LOCKED IN, unchanged                               */
/* ------------------------------------------------------------------ */

function buildLedger(trades) {
  const byTeam = new Map()
  const touch = (key, name, entryId) => {
    if (!byTeam.has(key)) {
      byTeam.set(key, { key, name, entryId, in: 0, out: 0, count: 0 })
    }
    return byTeam.get(key)
  }
  for (const t of trades) {
    const offKey = t.offeredLeagueEntry ?? t.offeredFplEntry
    const recKey = t.receivedLeagueEntry ?? t.receivedFplEntry
    const off = touch(offKey, t.offeredTeamName, offKey)
    const rec = touch(recKey, t.receivedTeamName, recKey)
    const offPts = sumLegs(t.pairs, 'offeredLeg')
    const recPts = sumLegs(t.pairs, 'receivedLeg')
    off.in += offPts
    off.out += recPts
    rec.in += recPts
    rec.out += offPts
    off.count += 1
    rec.count += 1
  }
  return [...byTeam.values()]
    .map((r) => ({ ...r, net: r.in - r.out }))
    .sort((a, b) => b.net - a.net)
}

function TeamLedger({ trades, teamLogoMap, kitIndexByEntry }) {
  const rows = buildLedger(trades)
  if (!rows.length) return null
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.net)))
  return (
    <div className="mockup-tv-ledger">
      {rows.map((r) => {
        const pos = r.net >= 0
        const w = (Math.abs(r.net) / maxAbs) * 100
        return (
          <div key={r.key} className="mockup-tv-ledger__row">
            <div className="mockup-tv-ledger__team">
              <TeamAvatar entryId={r.entryId} name={r.name} size="sm" logoMap={teamLogoMap} kitIndexByEntry={kitIndexByEntry} />
              <span className="mockup-tv-ledger__name">{r.name}</span>
              <span className="mockup-tv-ledger__count">{r.count} trade{r.count === 1 ? '' : 's'}</span>
            </div>
            <div className="mockup-tv-ledger__bar">
              <span className={'mockup-tv-ledger__fill' + (pos ? ' is-pos' : ' is-neg')} style={{ width: `${Math.max(w, 4)}%` }} />
            </div>
            <div className={'mockup-tv-ledger__net tabular' + (pos ? ' is-pos' : ' is-neg')}>
              {pos ? '+' : '−'}{Math.abs(r.net)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Showcase                                                             */
/* ------------------------------------------------------------------ */

const OPTIONS = [
  {
    id: 'feed',
    label: 'Option 1 · Feed card',
    sub: 'One row per acquired player (badge · name · position / destination · tenure · points). Same row grammar as the Waivers feed and the mobile draft list.',
    render: (t, props) => <OptionFeed trade={t} {...props} />,
  },
  {
    id: 'split',
    label: 'Option 2 · Head-to-head split',
    sub: 'Two team columns with totals, then player rows with club badge, position pill and tenure. Closest to a classic trade card.',
    render: (t, props) => <OptionSplit trade={t} {...props} />,
  },
  {
    id: 'table',
    label: 'Option 3 · Compact table',
    sub: 'Acquired-by · player · tenure · points columns. Dense and scannable, matching the standings / share-table look.',
    render: (t, props) => <OptionTable trade={t} {...props} />,
  },
  {
    id: 'lines',
    label: 'Option 4 · Minimal lines',
    sub: 'Quiet, text-forward one-liners: which team got which player, the points and the tenure dot. Least chrome.',
    render: (t, props) => <OptionLines trade={t} {...props} />,
  },
]

export function TradeViewsShowcase({ trades = [], teamLogoMap = {}, kitIndexByEntry = {} }) {
  if (!trades.length) {
    return (
      <div className="mockup-tv-empty">
        No trade data loaded. Trades render from <code>trades-panel.json</code> via{' '}
        <code>data.tradesPanelRows</code>.
      </div>
    )
  }

  // Show a single-player and a multi-player trade per option so each layout is
  // judged on both cases.
  const single = trades[0]
  const multi = trades.find((t) => (t.pairs?.length || 0) > 1) ?? trades[1] ?? trades[0]
  const samples = multi === single ? [single] : [single, multi]
  const props = { teamLogoMap, kitIndexByEntry }

  return (
    <div className="mockup-tv">
      {OPTIONS.map((opt) => (
        <section className="mockup-tv-opt" key={opt.id}>
          <div className="mockup__eyebrow">{opt.label}</div>
          <p className="mockup__section-sub">{opt.sub}</p>
          <div className="mockup-tv-opt__cards">
            {samples.map((t) => (
              <div className="mockup-tv-opt__card" key={t.id}>{opt.render(t, props)}</div>
            ))}
          </div>
        </section>
      ))}

      <section className="mockup-tv-opt">
        <div className="mockup__eyebrow">Trade ledger · locked in</div>
        <p className="mockup__section-sub">
          Net points won at the trade table — points gained from incoming players minus the
          points the players they gave up scored elsewhere.
        </p>
        <TeamLedger trades={trades} teamLogoMap={teamLogoMap} kitIndexByEntry={kitIndexByEntry} />
      </section>
    </div>
  )
}

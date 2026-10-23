import { useMemo, useState } from 'react'
import { TeamAvatar } from './TeamAvatar'
import { PlayerKit } from './PlayerKit.jsx'
import { ClickablePlayerName } from './PlayerHistoryContext.jsx'
import { firstWord, standingsMobileTeamName } from './teamNameUtils.js'
import { useMobileLayout, useMobileNarrowViewport } from './usePortraitMobile.js'
import { flattenWaiverGroups, sortMovesWaiverThenFa } from './waiverMovesSort.js'
import './WaiversPanel.css'

/* =================================================================== */
/* Waivers panel — production port of the locked `mockup-wv-*` redesign */
/* (Mockup.jsx → Moves › Waivers). Real league data + real crests:      */
/*  • player CLUB crests  → <PlayerKit badgeUrl> (official PL badge URL) */
/*  • fantasy-team crests → <TeamAvatar> (team logo atom)               */
/*  • position chips      → Players-tab cream letter box (no pastel wash) */
/*  • clickable names     → <ClickablePlayerName> (tap-to-detail)       */
/* =================================================================== */

/** Same cream letter-box as PlayersWorkbench `PositionChip` / `.position-chip`
 *  (GKP/DEF/MID/FWD, no per-position pastel wash). */
function WvPosChip({ pos }) {
  if (!pos) return null
  const label = String(pos).toUpperCase()
  return (
    <span className="position-chip" title={label} aria-label={label}>
      {label}
    </span>
  )
}

/** Player's real PL club crest (reuses PlayerKit badge rendering + fallback). */
function ClubCrest({ badgeUrl, teamShort, size = 22, out = false }) {
  return (
    <span
      className={out ? 'waivers-crest waivers-crest--out' : 'waivers-crest'}
      style={{ width: size, height: size }}
    >
      <PlayerKit badgeUrl={badgeUrl} teamShort={teamShort} />
    </span>
  )
}

/** Identity cell: optional in/out arrow + club crest + clickable name + position chip.
 *  Reads left-to-right as: arrow · club badge · name · position chip. */
function WvPlayerCell({ element, name, badgeUrl, teamShort, pos, dir }) {
  return (
    <span className="waivers-player">
      {dir ? (
        <span className={`waivers-dir waivers-dir--${dir}`} aria-hidden="true">
          {dir === 'in' ? '↑' : '↓'}
        </span>
      ) : null}
      <ClubCrest badgeUrl={badgeUrl} teamShort={teamShort} size={22} out={dir === 'out'} />
      <ClickablePlayerName
        element={element}
        web_name={name}
        teamShort={teamShort}
        className="waivers-player__name"
      >
        {name}
      </ClickablePlayerName>
      <WvPosChip pos={pos} />
    </span>
  )
}

const moveOrderKey = (m) =>
  m.waiverProcessOrder == null || !Number.isFinite(Number(m.waiverProcessOrder))
    ? Infinity
    : Number(m.waiverProcessOrder)

/** `#` cell — league-wide waiver order (Live Scores glass pill), or an
 *  inline FA tag for free agency. Mirrors the mobile All Swaps header. */
function WvOrderCell({ move }) {
  return move.waiverProcessOrder != null &&
    Number.isFinite(Number(move.waiverProcessOrder)) ? (
    <span className="waivers-order tabular">{move.waiverProcessOrder}</span>
  ) : (
    <span className="waivers-fa-tag">FA</span>
  )
}

/* ── Section 1 · Weekly waivers ─────────────────────────────────────── */

/** Desktop: "All swaps" flat table ↔ "By team" phone-style tiles (expanded).
 *  `gwPill` (optional node) renders inline on the same row as the toggle. */
function WeeklyWaiversTable({ groups, teamLogoMap, kitIndexByEntry, gwPill }) {
  const [group, setGroup] = useState('flat')

  const flatRows = useMemo(() => {
    const rows = flattenWaiverGroups(groups)
    return [...rows].sort(sortMovesWaiverThenFa)
  }, [groups])

  const groupedTeams = useMemo(
    () =>
      [...groups]
        .map((g) => ({
          ...g,
          moves: [...(g.moves || [])].sort(sortMovesWaiverThenFa),
        }))
        .sort((a, b) => {
          const am = Math.min(...a.moves.map(moveOrderKey))
          const bm = Math.min(...b.moves.map(moveOrderKey))
          return am - bm
        }),
    [groups],
  )

  return (
    <div className="waivers-weekly">
      <div className="waivers-weekly__bar">
        <div
          className="waivers-toggle waivers-toggle--sm"
          role="tablist"
          aria-label="Weekly waivers grouping"
        >
          {[
            { v: 'flat', label: 'All swaps' },
            { v: 'team', label: 'By team' },
          ].map((opt) => (
            <button
              key={opt.v}
              type="button"
              role="tab"
              aria-selected={group === opt.v}
              className={'waivers-toggle__btn' + (group === opt.v ? ' is-active' : '')}
              onClick={() => setGroup(opt.v)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {gwPill ? <span className="waivers-weekly__gw">{gwPill}</span> : null}
      </div>
      {group === 'team' ? (
        <WeeklyWaiversTiles
          groups={groupedTeams}
          teamLogoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
          defaultExpanded
        />
      ) : (
        <div className="waivers-table-wrap">
          <table className="waivers-table waivers-weekly__table waivers-weekly__table--flat">
            <colgroup>
              <col className="waivers-col-num" />
              <col className="waivers-col-team" />
              <col className="waivers-col-io" />
              <col className="waivers-col-io" />
            </colgroup>
            <thead>
              <tr>
                <th className="waivers-table__num">#</th>
                <th>Team</th>
                <th>In</th>
                <th>Out</th>
              </tr>
            </thead>
            <tbody>
              {flatRows.map((r) => (
                <tr key={r.transactionId}>
                  <td className="waivers-table__num tabular">
                    <WvOrderCell move={r} />
                  </td>
                  <td>
                    <span className="waivers-table__team">
                      <TeamAvatar
                        entryId={r.leagueEntryId}
                        name={r.teamName}
                        size="sm"
                        logoMap={teamLogoMap}
                        kitIndexByEntry={kitIndexByEntry}
                      />
                      <span className="waivers-table__team-name" title={r.teamName}>
                        {standingsMobileTeamName(r.teamName)}
                      </span>
                    </span>
                  </td>
                  <td>
                    <WvPlayerCell
                      element={r.element_in}
                      name={r.pickedName}
                      badgeUrl={r.pickedBadgeUrl}
                      teamShort={r.pickedTeamShort}
                      pos={r.pickedPos}
                      dir="in"
                    />
                  </td>
                  <td>
                    <WvPlayerCell
                      element={r.element_out}
                      name={r.droppedName}
                      badgeUrl={r.droppedBadgeUrl}
                      teamShort={r.droppedTeamShort}
                      pos={r.droppedPos}
                      dir="out"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** Mobile · All Swaps — every successful pick in league waiver order, cards expanded. */
function WeeklyWaiversAllSwaps({ groups, teamLogoMap, kitIndexByEntry }) {
  const rows = useMemo(() => {
    const flat = flattenWaiverGroups(groups)
    return [...flat].sort(sortMovesWaiverThenFa)
  }, [groups])

  /* Track collapsed ids so new GW data stays expanded by default. */
  const [closed, setClosed] = useState(() => new Set())
  const toggle = (id) =>
    setClosed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <ul className="waivers-glance__list">
      {rows.map((m) => {
        const id = m.transactionId
        const isOpen = !closed.has(id)
        const order =
          m.waiverProcessOrder != null && Number.isFinite(Number(m.waiverProcessOrder))
            ? Number(m.waiverProcessOrder)
            : null
        return (
          <li className="waivers-glance__item" key={id}>
            <button
              type="button"
              className="waivers-glance__row"
              aria-expanded={isOpen}
              onClick={() => toggle(id)}
            >
              <TeamAvatar
                entryId={m.leagueEntryId}
                name={m.teamName}
                size="sm"
                logoMap={teamLogoMap}
                kitIndexByEntry={kitIndexByEntry}
              />
              <span className="waivers-glance__team" title={m.teamName}>
                {standingsMobileTeamName(m.teamName)}
              </span>
              <span className="waivers-glance__counts">
                {order != null ? (
                  <span
                    className="waivers-glance__count waivers-order"
                    aria-label={`Waiver order ${order}`}
                    title="Successful waiver order this GW (1 = first)"
                  >
                    {order}
                  </span>
                ) : (
                  <span className="waivers-fa-tag">FA</span>
                )}
              </span>
              <span
                className={'waivers-glance__caret' + (isOpen ? ' is-open' : '')}
                aria-hidden="true"
              >
                ›
              </span>
            </button>
            {isOpen ? (
              <div className="waivers-glance__moves">
                <div className="waivers-swap">
                  <WvPlayerCell
                    element={m.element_in}
                    name={m.pickedName}
                    badgeUrl={m.pickedBadgeUrl}
                    teamShort={m.pickedTeamShort}
                    pos={m.pickedPos}
                    dir="in"
                  />
                  <WvPlayerCell
                    element={m.element_out}
                    name={m.droppedName}
                    badgeUrl={m.droppedBadgeUrl}
                    teamShort={m.droppedTeamShort}
                    pos={m.droppedPos}
                    dir="out"
                  />
                </div>
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

/** Tap-a-team tiles (phone By team + iPad/desktop By team).
 *  `defaultExpanded`: iPad/desktop start open; phone stays collapsed until tapped.
 *  Expanded mode tracks a `closed` set so new GW teams stay open by default. */
function WeeklyWaiversTiles({
  groups,
  teamLogoMap,
  kitIndexByEntry,
  defaultExpanded = false,
}) {
  const [open, setOpen] = useState(() => new Set())
  const [closed, setClosed] = useState(() => new Set())
  const toggle = (entry) => {
    if (defaultExpanded) {
      setClosed((prev) => {
        const next = new Set(prev)
        if (next.has(entry)) next.delete(entry)
        else next.add(entry)
        return next
      })
    } else {
      setOpen((prev) => {
        const next = new Set(prev)
        if (next.has(entry)) next.delete(entry)
        else next.add(entry)
        return next
      })
    }
  }

  return (
    <div className="waivers-weekly-grid waivers-weekly-grid--compact">
      {groups.map((g) => {
        const isOpen = defaultExpanded ? !closed.has(g.entry) : open.has(g.entry)
        const teamOrder = Math.min(...(g.moves || []).map(moveOrderKey))
        return (
          <article className="waivers-weekly-tile" key={g.entry}>
            <button
              type="button"
              className="waivers-weekly-tile__head"
              aria-expanded={isOpen}
              onClick={() => toggle(g.entry)}
            >
              {Number.isFinite(teamOrder) ? (
                <span
                  className="waivers-weekly-tile__rank tabular"
                  title="First waiver run order this GW (1 = first)"
                >
                  {teamOrder}
                </span>
              ) : (
                <span className="waivers-weekly-tile__rank waivers-weekly-tile__rank--empty" aria-hidden="true" />
              )}
              <TeamAvatar
                entryId={g.leagueEntryId}
                name={g.teamName}
                size="sm"
                logoMap={teamLogoMap}
                kitIndexByEntry={kitIndexByEntry}
              />
              <span className="waivers-weekly-tile__team" title={g.teamName}>
                {standingsMobileTeamName(g.teamName)}
              </span>
              <span className="waivers-weekly-tile__count muted">
                {(g.moves || []).length}
              </span>
              <span className={'waivers-weekly-tile__caret' + (isOpen ? ' is-open' : '')} aria-hidden="true">
                ›
              </span>
            </button>
            {isOpen ? (
              <div className="waivers-weekly-tile__moves">
                {(g.moves || []).map((m) => (
                  <div className="waivers-swap" key={m.transactionId}>
                    <WvPlayerCell
                      element={m.element_in}
                      name={m.pickedName}
                      badgeUrl={m.pickedBadgeUrl}
                      teamShort={m.pickedTeamShort}
                      pos={m.pickedPos}
                      dir="in"
                    />
                    <WvPlayerCell
                      element={m.element_out}
                      name={m.droppedName}
                      badgeUrl={m.droppedBadgeUrl}
                      teamShort={m.droppedTeamShort}
                      pos={m.droppedPos}
                      dir="out"
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}

/**
 * Section 1 wrapper.
 *  • Desktop: flat swap table ↔ by-team tiles (expanded by default).
 *  • Mobile/tablet: "All Swaps" · "By team" · "Waiver summary"
 *    (By team tiles expand by default on tablet; phone stays collapsed).
 * `gwPill` renders inline beside the toggle; `summaryView` is the share card.
 */
export function WeeklyWaivers({
  groups,
  teamLogoMap,
  kitIndexByEntry,
  emptyMessage,
  gwPill,
  summaryView,
}) {
  const isMobile = useMobileLayout()
  /* Phone-narrow (≤767): collapsed By team. Tablet in the mobile shell
   * (768–1080): same tiles as phone, expanded by default. */
  const isPhoneNarrow = useMobileNarrowViewport()
  const [mobileView, setMobileView] = useState('flat')

  const hasGroups = Boolean(groups && groups.length > 0)

  if (isMobile) {
    const options = [
      { v: 'flat', label: 'All Swaps' },
      { v: 'tiles', label: 'By team' },
      ...(summaryView ? [{ v: 'summary', label: 'Waiver summary' }] : []),
    ]
    return (
      <div className="waivers-weekly-mobile">
        <div className="waivers-weekly__bar">
          <div
            className="waivers-toggle waivers-toggle--sm"
            role="tablist"
            aria-label="Weekly waivers mobile view"
          >
            {options.map((opt) => (
              <button
                key={opt.v}
                type="button"
                role="tab"
                aria-selected={mobileView === opt.v}
                className={'waivers-toggle__btn' + (mobileView === opt.v ? ' is-active' : '')}
                onClick={() => setMobileView(opt.v)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {gwPill ? <span className="waivers-weekly__gw">{gwPill}</span> : null}
        </div>
        {mobileView === 'summary' ? (
          summaryView
        ) : !hasGroups ? (
          <p className="muted muted--tight">{emptyMessage}</p>
        ) : mobileView === 'flat' ? (
          <WeeklyWaiversAllSwaps
            groups={groups}
            teamLogoMap={teamLogoMap}
            kitIndexByEntry={kitIndexByEntry}
          />
        ) : (
          <WeeklyWaiversTiles
            groups={groups}
            teamLogoMap={teamLogoMap}
            kitIndexByEntry={kitIndexByEntry}
            defaultExpanded={!isPhoneNarrow}
          />
        )}
      </div>
    )
  }

  if (!hasGroups) {
    return (
      <div className="waivers-weekly">
        {gwPill ? (
          <div className="waivers-weekly__bar waivers-weekly__bar--empty">
            <span className="waivers-weekly__gw">{gwPill}</span>
          </div>
        ) : null}
        <p className="muted muted--tight">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <WeeklyWaiversTable
      groups={groups}
      teamLogoMap={teamLogoMap}
      kitIndexByEntry={kitIndexByEntry}
      gwPill={gwPill}
    />
  )
}

/* ── Section 2 · Waiver in / out team totals — condensed toggle ─────── */
export function WaiverTotalsToggle({
  waiverInPointsByTeam = [],
  waiverOutPointsByTeam = [],
  teamLogoMap,
  kitIndexByEntry,
}) {
  const [mode, setMode] = useState('in')
  const rows = useMemo(() => {
    const mapped =
      mode === 'in'
        ? waiverInPointsByTeam.map((r) => ({
            league_entry: r.league_entry,
            teamName: r.teamName,
            value: r.totalWaiverInPoints,
            count: r.waiverInCount,
            avg: r.averageWaiverInPerPlayer ?? 0,
          }))
        : waiverOutPointsByTeam.map((r) => ({
            league_entry: r.league_entry,
            teamName: r.teamName,
            value: r.totalDroppedGwPoints,
            count: r.waiverOutCount,
            avg: r.averageDroppedGwPoints ?? 0,
          }))
    return mapped.sort((a, b) => b.value - a.value)
  }, [mode, waiverInPointsByTeam, waiverOutPointsByTeam])
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0)

  return (
    <div className="waivers-totals">
      <div className="waivers-toggle" role="tablist" aria-label="Waiver totals direction">
        {[
          { v: 'in', label: 'Picked up' },
          { v: 'out', label: 'Dropped' },
        ].map((opt) => (
          <button
            key={opt.v}
            type="button"
            role="tab"
            aria-selected={mode === opt.v}
            className={'waivers-toggle__btn' + (mode === opt.v ? ' is-active' : '')}
            onClick={() => setMode(opt.v)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="waivers-totals__hint">
        {mode === 'in'
          ? 'Total FPL points scored by every player a team picked up (waiver or free agent), from pickup until they left.'
          : 'Sum of dropped players’ GW points in the week each waiver or free-agent swap hit (lower = cleaner exits).'}
      </p>
      <ol className="waivers-bars">
        <li className="waivers-bar-row waivers-bars-head" aria-hidden="true">
          <span />
          <span className="waivers-bar-row__team">Team</span>
          <span className="waivers-bar-row__track-head">
            {mode === 'in' ? 'Points in' : 'Points out'}
          </span>
          <span className="waivers-bar-row__val">Pts</span>
          <span className="waivers-bar-row__col">{mode === 'in' ? 'In' : 'Out'}</span>
          <span className="waivers-bar-row__col">Avg</span>
        </li>
        {rows.map((r) => {
          const pct = max > 0 ? Math.round((r.value / max) * 100) : 0
          return (
            <li className="waivers-bar-row" key={r.league_entry}>
              <TeamAvatar
                entryId={r.league_entry}
                name={r.teamName}
                size="sm"
                logoMap={teamLogoMap}
                kitIndexByEntry={kitIndexByEntry}
              />
              <span className="waivers-bar-row__team" title={r.teamName}>
                {firstWord(r.teamName)}
              </span>
              <span className="waivers-bar-row__track">
                <span className="waivers-bar-row__fill" style={{ width: pct + '%' }} />
              </span>
              <span className="waivers-bar-row__val tabular">{r.value}</span>
              <span className="waivers-bar-row__col tabular muted">{r.count}</span>
              <span className="waivers-bar-row__col tabular muted">
                {Number(r.avg).toFixed(1)}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/* ── Section 3 · First waiver picks tracker — fixed-height scroll ─────── */
export function FirstWaiverPicks({ rows = [], teamLogoMap, kitIndexByEntry, emptyMessage }) {
  if (!rows.length) return <p className="muted muted--tight">{emptyMessage}</p>
  return (
    <div className="waivers-first">
      {/* Fixed-height scroller: all GWs are present and scroll within the box
       *  (sticky header), so no "show all" expander is needed. */}
      <div className="waivers-first__scroll">
        <table className="waivers-table waivers-first__table">
          <colgroup>
            <col className="waivers-first__col-gw" />
            <col className="waivers-first__col-pick" />
            <col className="waivers-first__col-player" />
            <col className="waivers-first__col-pts" />
          </colgroup>
          <thead>
            <tr>
              <th className="waivers-table__num">GW</th>
              <th className="waivers-first__pick-head">Pick</th>
              <th>Player</th>
              <th className="waivers-table__num">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.gameweek}>
                <td className="waivers-table__num tabular fw-700">{r.gameweek}</td>
                <td className="waivers-first__pick">
                  <TeamAvatar
                    entryId={r.leagueEntryId}
                    name={r.teamName}
                    size="sm"
                    logoMap={teamLogoMap}
                    kitIndexByEntry={kitIndexByEntry}
                  />
                </td>
                <td>
                  <WvPlayerCell
                    element={r.element_in}
                    name={r.pickedName}
                    badgeUrl={r.pickedBadgeUrl}
                    teamShort={r.pickedTeamShort}
                    pos={r.pickedPos}
                  />
                </td>
                <td className="waivers-table__num tabular">
                  <span className="waivers-pts">
                    {r.pickedUpPlayerGwPoints != null ? r.pickedUpPlayerGwPoints : '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Section 4 · Best pickups + Most waivered — combined toggle ─────── */
export function WaiverPickupsToggle({
  bestRows = [],
  mostRows = [],
  teamLogoMap,
  kitIndexByEntry,
  emptyMessage,
}) {
  const [mode, setMode] = useState('best')
  const list = mode === 'best' ? bestRows : mostRows
  if (!bestRows.length && !mostRows.length) {
    return <p className="muted muted--tight">{emptyMessage}</p>
  }
  return (
    <div className="waivers-pickups">
      <div className="waivers-toggle" role="tablist" aria-label="Pickup leaderboard mode">
        {[
          { v: 'best', label: 'Best pickups' },
          { v: 'most', label: 'Most waivered' },
        ].map((opt) => (
          <button
            key={opt.v}
            type="button"
            role="tab"
            aria-selected={mode === opt.v}
            className={'waivers-toggle__btn' + (mode === opt.v ? ' is-active' : '')}
            onClick={() => setMode(opt.v)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="waivers-totals__hint">
        {mode === 'best'
          ? 'Top player–team pairs by total FPL points from each waiver or free-agent add until they left the squad.'
          : 'Players claimed off waivers or as a free agent the most this season.'}
      </p>
      <ol className="waivers-rank-list">
        {mode === 'best'
          ? list.map((r, i) => (
              <li
                className="waivers-rank-row waivers-rank-row--best"
                key={`${r.entry}-${r.elementId}`}
              >
                <span className="waivers-rank-row__rank tabular">{r.rank ?? i + 1}</span>
                <span className="waivers-player-with-fa">
                  <WvPlayerCell
                    element={r.elementId}
                    name={r.playerName}
                    badgeUrl={r.badgeUrl}
                    teamShort={r.teamShort}
                    pos={r.pos}
                  />
                  {r.freeAgentStints > 0 ? (
                    <span className="waivers-fa-tag">FA</span>
                  ) : null}
                </span>
                <span className="waivers-rank-row__meta">
                  <span className="waivers-rank-row__owner-name">{firstWord(r.teamName)}</span>
                  <span className="waivers-rank-row__range muted">
                    GW {r.firstGw}–{r.lastGw}
                    {r.waiverStints > 1 ? ` · ${r.waiverStints}×` : ''}
                  </span>
                </span>
                <span className="waivers-pts waivers-pts--lg">{r.totalPointsForTeam}</span>
                <span className="waivers-rank-row__crest">
                  <TeamAvatar
                    entryId={r.leagueEntryId}
                    name={r.teamName}
                    size="sm"
                    logoMap={teamLogoMap}
                    kitIndexByEntry={kitIndexByEntry}
                  />
                </span>
              </li>
            ))
          : list.map((r, i) => (
              <li className="waivers-rank-row" key={r.elementId}>
                <span className="waivers-rank-row__rank tabular">{i + 1}</span>
                <WvPlayerCell
                  element={r.elementId}
                  name={r.web_name}
                  badgeUrl={r.badgeUrl}
                  teamShort={r.teamShort}
                  pos={r.pos}
                />
                <span aria-hidden />
                <span className="waivers-pts waivers-pts--lg">{r.claims}</span>
              </li>
            ))}
      </ol>
    </div>
  )
}

/** Explains waiver lag: live FPL overlay vs waiting on the static ingest deploy. */
export function WaiverFreshnessBanner({ notice }) {
  if (!notice) return null
  const isStale = notice.kind === 'stale'
  return (
    <div
      className={isStale ? 'data-banner data-banner--error' : 'data-banner'}
      role={isStale ? 'alert' : 'status'}
    >
      <strong>{notice.title}</strong> {notice.message}
    </div>
  )
}

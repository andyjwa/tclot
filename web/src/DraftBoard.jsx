import { useMemo, useState, useCallback, Fragment } from 'react'
import { useDraftBoard } from './useDraftBoard'
import { TeamAvatar } from './TeamAvatar'
import { DraftQuality } from './DraftQuality'
import { ClickablePlayerName } from './PlayerHistoryContext.jsx'
import { compareLeagueEntriesByDraftSlot, minOverallPickByEntryId } from './draftTeamOrder'

const POS_OPTIONS = ['GKP', 'DEF', 'MID', 'FWD']

/** @typedef {{ key: 'overallPick' | 'totalPoints', dir: 'asc' | 'desc' } | null} DraftBoardSortState */

function numericDraftPickPts(p) {
  const v = p.totalPoints
  if (v == null) return NaN
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

/**
 * Sortable Pick / Pts headers — same interaction as standings (StandingsSortTh): null = draft order;
 * first click on a column = desc; click again toggles asc/desc.
 */
function DraftBoardSortHeadCell({ columnKey, sortState, onSort, label, className }) {
  const isPick = columnKey === 'overallPick'
  const isPts = columnKey === 'totalPoints'
  const active = sortState?.key === columnKey
  const dir = active ? sortState.dir : null
  /** Draft list default: overall pick low → high */
  const pickDraftDefault = isPick && sortState === null

  let arrowGlyph = '↕'
  let arrowClass = 'standings-sort-arrow'
  if (isPick) {
    if (pickDraftDefault) {
      arrowGlyph = '↑'
      arrowClass += ' standings-sort-arrow--active standings-sort-arrow--asc'
    } else if (active) {
      arrowGlyph = dir === 'asc' ? '↑' : '↓'
      arrowClass += ` standings-sort-arrow--active standings-sort-arrow--${dir}`
    }
  } else if (isPts && active) {
    arrowGlyph = dir === 'asc' ? '↑' : '↓'
    arrowClass += ` standings-sort-arrow--active standings-sort-arrow--${dir}`
  }

  const ariaSort = pickDraftDefault
    ? 'ascending'
    : active
      ? dir === 'asc'
        ? 'ascending'
        : 'descending'
      : undefined

  const ariaLabel = isPick
    ? pickDraftDefault
      ? 'Draft order (early picks first). Click to sort by pick.'
      : active
        ? `Pick: sorted ${dir === 'desc' ? 'high to low' : 'low to high'}. Click to reverse.`
        : 'Sort by pick'
    : active
      ? `Pts: sorted ${dir === 'desc' ? 'high to low' : 'low to high'}. Click to reverse.`
      : 'Sort by points'

  return (
    <span className={className} role="columnheader">
      <button
        type="button"
        className="standings-sort-btn draft-board-sort-btn"
        onClick={() => onSort(columnKey)}
        aria-sort={ariaSort}
        aria-label={ariaLabel}
      >
        <span className="standings-sort-btn__label">{label}</span>
        <span className={arrowClass} aria-hidden>
          {arrowGlyph}
        </span>
      </button>
    </span>
  )
}

/** League entry id — same as standings `row.league_entry` (team-logos/, kitIndexByEntry). */
function logoLeagueEntryId(pick, fplToLeagueId) {
  if (pick?.leagueEntryId != null) return pick.leagueEntryId
  const lid = fplToLeagueId.get(pick?.entryId)
  if (lid != null) return lid
  return pick?.entryId
}

/** Visible + `title` text for screen readers / hover. */
function draftRosterStatusParts(p) {
  if (p.rosterOnSquad === true) {
    return { kind: 'emoji', emoji: '✅', title: 'Still on squad' }
  }
  if (p.rosterOnSquad === false) {
    if (p.rosterLeftGameweek != null) {
      if (p.rosterLeftKind === 'trade') {
        const text = `Traded Game Week ${p.rosterLeftGameweek}`
        return { kind: 'text', text, title: text }
      }
      const text = `Dropped Game Week ${p.rosterLeftGameweek}`
      return { kind: 'text', text, title: text }
    }
    const text = 'No longer on squad'
    return { kind: 'text', text, title: text }
  }
  return { kind: 'text', text: '—', title: 'Status unknown' }
}

function ClubBadge({ src }) {
  const [hidden, setHidden] = useState(false)
  if (!src || hidden) return null
  return (
    <img
      src={src}
      alt=""
      className="draft-board-row__club-badge"
      width={22}
      height={22}
      loading="lazy"
      decoding="async"
      onError={() => setHidden(true)}
    />
  )
}

export function DraftBoard({
  league,
  leagueEntries,
  tableRows = [],
  teamLogoMap = {},
  kitIndexByEntry = {},
}) {
  const { picks, loading, error, source, startGw } = useDraftBoard(
    league,
    leagueEntries,
  )

  /** FPL `entry_id` → season points For (standings), for Draft Quality +/- vs drafted squad. */
  const pointsForByFplEntryId = useMemo(() => {
    const gfByLeagueEntry = new Map()
    for (const r of tableRows) {
      if (r?.league_entry == null) continue
      const gf = Number(r.gf)
      if (!Number.isFinite(gf)) continue
      gfByLeagueEntry.set(Number(r.league_entry), gf)
    }
    const m = new Map()
    for (const e of leagueEntries || []) {
      const fid = e?.entry_id
      const lid = e?.id
      if (fid == null || lid == null) continue
      const g = gfByLeagueEntry.get(Number(lid))
      if (g != null) m.set(Number(fid), g)
    }
    return m
  }, [tableRows, leagueEntries])
  const [teamFilter, setTeamFilter] = useState('')
  const [roundFilter, setRoundFilter] = useState('')
  const [posFilter, setPosFilter] = useState('')
  /** `null` = draft order (overall pick ascending); otherwise sort by column */
  const [draftBoardSort, setDraftBoardSort] = useState(/** @type {DraftBoardSortState} */ (null))

  const handleDraftBoardSort = useCallback((columnKey) => {
    if (columnKey !== 'overallPick' && columnKey !== 'totalPoints') return
    setDraftBoardSort((prev) => {
      if (prev?.key === columnKey) {
        return { key: columnKey, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
      }
      return { key: columnKey, dir: 'desc' }
    })
  }, [])

  const fplToLeagueEntryId = useMemo(() => {
    const m = new Map()
    for (const e of leagueEntries || []) {
      if (e?.entry_id != null && e?.id != null) {
        m.set(e.entry_id, e.id)
      }
    }
    return m
  }, [leagueEntries])

  const teamOptions = useMemo(() => {
    const rows = [...(leagueEntries || [])]
    const minBy = minOverallPickByEntryId(picks)
    rows.sort((a, b) => compareLeagueEntriesByDraftSlot(a, b, minBy))
    return rows.map((e) => ({
      value: String(e.entry_id),
      label: String(e.entry_name ?? '').trim() || `Team ${e.entry_id}`,
    }))
  }, [leagueEntries, picks])

  const maxRound = useMemo(() => {
    let m = 0
    for (const p of picks) {
      if (p.round > m) m = p.round
    }
    return m || 15
  }, [picks])

  const filteredPicks = useMemo(() => {
    return picks.filter((p) => {
      if (teamFilter && String(p.entryId) !== teamFilter) return false
      if (roundFilter && String(p.round) !== roundFilter) return false
      if (posFilter && String(p.pos) !== posFilter) return false
      return true
    })
  }, [picks, teamFilter, roundFilter, posFilter])

  const displayPicks = useMemo(() => {
    if (!draftBoardSort) return filteredPicks
    const { key, dir } = draftBoardSort
    const out = [...filteredPicks]
    out.sort((a, b) => {
      const va =
        key === 'overallPick' ? Number(a.overallPick) : numericDraftPickPts(a)
      const vb =
        key === 'overallPick' ? Number(b.overallPick) : numericDraftPickPts(b)
      if (!Number.isFinite(va) && !Number.isFinite(vb)) return 0
      if (!Number.isFinite(va)) return 1
      if (!Number.isFinite(vb)) return -1
      const cmp = dir === 'desc' ? vb - va : va - vb
      if (cmp !== 0) return cmp
      return Number(a.overallPick) - Number(b.overallPick)
    })
    return out
  }, [filteredPicks, draftBoardSort])

  /** 1-based squad slot for this manager (draft order within team). */
  const teamSlotByPickKey = useMemo(() => {
    const m = new Map()
    const byEntry = new Map()
    for (const p of picks) {
      if (!byEntry.has(p.entryId)) byEntry.set(p.entryId, [])
      byEntry.get(p.entryId).push(p)
    }
    for (const arr of byEntry.values()) {
      arr.sort((a, b) => a.overallPick - b.overallPick)
      arr.forEach((p, idx) => {
        m.set(`${p.entryId}:${p.overallPick}`, idx + 1)
      })
    }
    return m
  }, [picks])

  const showTeamSlotCol = Boolean(teamFilter)

  return (
    <Fragment>
    <section
      className="tile tile--standings draft-board-tile"
      aria-labelledby="draft-board-heading"
    >
      <div className="tile-head-row tile-head-row--tight draft-board-tile__head">
        <div className="draft-board-title-inline">
          <h2 id="draft-board-heading" className="tile-title tile-title--sm draft-board-tile__title">
            Draft
          </h2>
          <div className="draft-board-filter-scroll">
            <div className="draft-board-filters" role="group" aria-label="Draft filters">
              <select
                className="hall-historic-season-select draft-board-filter-select"
                aria-label="Filter by team"
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                disabled={!teamOptions.length}
              >
                <option value="">All teams</option>
                {teamOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                className="hall-historic-season-select draft-board-filter-select"
                aria-label="Filter by round"
                value={roundFilter}
                onChange={(e) => setRoundFilter(e.target.value)}
                disabled={!picks.length}
              >
                <option value="">All rounds</option>
                {Array.from({ length: maxRound }, (_, i) => i + 1).map((r) => (
                  <option key={r} value={String(r)}>
                    Round {r}
                  </option>
                ))}
              </select>
              <select
                className="hall-historic-season-select draft-board-filter-select"
                aria-label="Filter by position"
                value={posFilter}
                onChange={(e) => setPosFilter(e.target.value)}
                disabled={!picks.length}
              >
                <option value="">All positions</option>
                {POS_OPTIONS.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="data-banner data-banner--error draft-board-banner" role="alert">
          <strong>Could not load draft.</strong> {error}{' '}
          <span className="muted">
            Add <code>draft_picks.json</code> under league-data, set <code>VITE_FPL_PROXY_URL</code>, or
            open from an environment where the draft API is reachable.
          </span>
        </div>
      ) : null}

      {loading ? (
        <p className="muted draft-board-loading">Loading draft…</p>
      ) : !picks.length && !error ? (
        <p className="muted draft-board-loading">No draft data.</p>
      ) : (
        <>
          {source === 'api' ? (
            <p className="draft-board-hint muted">
              Order from GW{startGw} squads and snake logic; round-1 slots need{' '}
              <code>draft_round1_order.json</code> — live <code>waiver_pick</code> follows league
              standing, not draft position. Without that file the app uses a neutral entry-id
              fallback (overall pick numbers may not match the real draft). Within-team order uses
              draft rank (approximate for reaches).
            </p>
          ) : null}
          <div
            className={[
              'draft-board-scroll',
              showTeamSlotCol ? 'draft-board-scroll--team-slot' : '',
              showTeamSlotCol ? 'draft-board-scroll--expanded' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {filteredPicks.length === 0 ? (
              <p className="muted draft-board-loading">No picks match these filters.</p>
            ) : (
              <>
                <div className="draft-board-head" role="row">
                  <DraftBoardSortHeadCell
                    columnKey="overallPick"
                    sortState={draftBoardSort}
                    onSort={handleDraftBoardSort}
                    label="Pick"
                    className="draft-board-head__cell draft-board-head__cell--pick"
                  />
                  <span
                    className="draft-board-head__cell draft-board-head__cell--team"
                    aria-label="Team"
                  >
                    Team
                  </span>
                  <span className="draft-board-head__cell draft-board-head__cell--round">
                    <span className="draft-board-head-round__long">Round</span>
                    <span className="draft-board-head-round__short tabular" aria-hidden="true">
                      R
                    </span>
                  </span>
                  {showTeamSlotCol ? (
                    <span className="draft-board-head__cell draft-board-head__cell--slot tabular">
                      #
                    </span>
                  ) : null}
                  <span className="draft-board-head__cell">
                    Player
                  </span>
                  <span className="draft-board-head__cell draft-board-head__cell--pos">Pos</span>
                  <DraftBoardSortHeadCell
                    columnKey="totalPoints"
                    sortState={draftBoardSort}
                    onSort={handleDraftBoardSort}
                    label="Pts"
                    className="draft-board-head__cell draft-board-head__cell--pts"
                  />
                  <span className="draft-board-head__cell draft-board-head__cell--status">Status</span>
                </div>
                <ol className="draft-board-list">
                  {displayPicks.map((p, i) => {
                    const prev = i > 0 ? displayPicks[i - 1] : null
                    const newRound = prev != null && p.round !== prev.round
                    const displayFull = p.playerFullName ?? p.playerName
                    const teamSlot = teamSlotByPickKey.get(`${p.entryId}:${p.overallPick}`)
                    const statusParts = draftRosterStatusParts(p)
                    return (
                      <li
                        key={`${p.overallPick}-${p.entryId}-${p.element}`}
                        className={
                          newRound
                            ? 'draft-board-row draft-board-row--round-start'
                            : 'draft-board-row'
                        }
                      >
                        <span className="draft-board-row__pick tabular" title="Overall pick">
                          {p.overallPick}
                        </span>
                        <span className="draft-board-row__fantasy-team">
                          <TeamAvatar
                            entryId={logoLeagueEntryId(p, fplToLeagueEntryId)}
                            name={p.teamName}
                            size="sm"
                            logoMap={teamLogoMap}
                            kitIndexByEntry={kitIndexByEntry}
                          />
                          <span className="draft-board-row__fantasy-team-name">{p.teamName}</span>
                        </span>
                        <span className="draft-board-row__round draft-round-display">
                          <span className="draft-round-display__long">
                            Round {p.round} Pick {p.pickInRound}
                          </span>
                          <span className="draft-round-display__short tabular" aria-hidden="true">
                            {p.round}.{p.pickInRound}
                          </span>
                        </span>
                        {showTeamSlotCol ? (
                          <span
                            className="draft-board-row__team-slot tabular"
                            title="This team's draft pick number (1–15)"
                          >
                            {teamSlot ?? '—'}
                          </span>
                        ) : null}
                        <span className="draft-board-row__player">
                          <ClubBadge src={p.badgeUrl} />
                        <span className="draft-board-row__player-names">
                          <span className="draft-board-row__player-full">
                            <ClickablePlayerName
                              element={p.element}
                              displayName={displayFull}
                              web_name={p.playerName}
                              teamShort={p.teamShort}
                            >
                              {displayFull}
                            </ClickablePlayerName>
                          </span>
                          <span className="draft-board-row__player-short">
                            <ClickablePlayerName
                              element={p.element}
                              displayName={displayFull}
                              web_name={p.playerName}
                              teamShort={p.teamShort}
                            >
                              {p.playerName}
                            </ClickablePlayerName>
                          </span>
                        </span>
                        </span>
                        <span className="draft-board-row__pos tabular">{p.pos}</span>
                        <span className="draft-board-row__pts tabular" title="Season points to date">
                          {p.totalPoints != null ? p.totalPoints : '—'}
                        </span>
                        <span
                          className="draft-board-row__status"
                          title={statusParts.title}
                        >
                          {statusParts.kind === 'emoji' ? (
                            <>
                              <span className="draft-board-a11y-label">{statusParts.title}</span>
                              <span aria-hidden="true">{statusParts.emoji}</span>
                            </>
                          ) : (
                            statusParts.text
                          )}
                        </span>
                      </li>
                    )
                  })}
                </ol>
              </>
            )}
          </div>
        </>
      )}
    </section>
    <DraftQuality
      picks={picks}
      loading={loading}
      error={error}
      pointsForByFplEntryId={pointsForByFplEntryId}
      teamLogoMap={teamLogoMap}
      kitIndexByEntry={kitIndexByEntry}
    />
    </Fragment>
  )
}

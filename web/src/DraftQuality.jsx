import { useMemo, useState, useCallback, Fragment } from 'react'
import { TeamAvatar } from './TeamAvatar'
import { ClickablePlayerName } from './PlayerHistoryContext.jsx'
import { minOverallPickByEntryId } from './draftTeamOrder'

const EMPTY_POINTS_FOR_BY_FPL = new Map()

function ClubBadge({ src }) {
  const [hidden, setHidden] = useState(false)
  if (!src || hidden) return null
  return (
    <img
      src={src}
      alt=""
      className="draft-quality__club-badge"
      width={22}
      height={22}
      loading="lazy"
      decoding="async"
      onError={() => setHidden(true)}
    />
  )
}

/** Mirrors the snake-board `DraftStatusPill`: dot + "On squad / Cut · GW# / Traded · GW#". */
function DraftPickStatus({ pick }) {
  if (pick.rosterOnSquad === true) {
    return (
      <span className="draft-status draft-status--kept" title="Still on squad">
        <span className="draft-status__dot" />
        On squad
      </span>
    )
  }
  if (pick.rosterOnSquad === false) {
    if (pick.rosterLeftGameweek != null) {
      if (pick.rosterLeftKind === 'trade') {
        return (
          <span
            className="draft-status draft-status--traded"
            title={`Traded at Game Week ${pick.rosterLeftGameweek}`}
          >
            <span className="draft-status__dot" />
            Traded · GW{pick.rosterLeftGameweek}
          </span>
        )
      }
      return (
        <span
          className="draft-status draft-status--dropped"
          title={`Dropped at Game Week ${pick.rosterLeftGameweek}`}
        >
          <span className="draft-status__dot" />
          Cut · GW{pick.rosterLeftGameweek}
        </span>
      )
    }
    return (
      <span className="draft-status draft-status--dropped" title="No longer on squad">
        <span className="draft-status__dot" />
        Off squad
      </span>
    )
  }
  return (
    <span className="draft-status draft-status--unknown" title="Status unknown">
      <span className="draft-status__dot" />—
    </span>
  )
}

function deltaVersusDrafted(pointsFor, draftedTotal) {
  if (pointsFor == null || draftedTotal == null) {
    return { text: '—', tone: null }
  }
  const d = pointsFor - draftedTotal
  const text = d > 0 ? `+${d}` : String(d)
  const tone = d > 0 ? 'pos' : d < 0 ? 'neg' : 'zero'
  return { text, tone }
}

function buildTeamRows(picks) {
  const byEntry = new Map()
  for (const p of picks) {
    if (!byEntry.has(p.entryId)) {
      byEntry.set(p.entryId, {
        entryId: p.entryId,
        leagueEntryId: p.leagueEntryId ?? null,
        teamName: p.teamName,
        picks: [],
      })
    } else {
      const row = byEntry.get(p.entryId)
      if (row.leagueEntryId == null && p.leagueEntryId != null) {
        row.leagueEntryId = p.leagueEntryId
      }
    }
    byEntry.get(p.entryId).picks.push(p)
  }
  const minOverallByEntry = minOverallPickByEntryId(picks)

  const rows = [...byEntry.values()].map((row) => {
    let total = 0
    let hasAny = false
    for (const p of row.picks) {
      if (p.totalPoints != null) {
        const n = Number(p.totalPoints)
        if (Number.isFinite(n)) {
          total += n
          hasAny = true
        }
      }
    }
    row.picks.sort((a, b) => a.overallPick - b.overallPick)
    const rosterKnown = row.picks.some((p) => p.rosterOnSquad === true || p.rosterOnSquad === false)
    const draftedPlayersRemaining = rosterKnown
      ? row.picks.filter((p) => p.rosterOnSquad === true).length
      : null
    return {
      ...row,
      totalPoints: hasAny ? total : null,
      draftedPlayersRemaining,
      draftedPickCount: row.picks.length,
    }
  })
  rows.sort((a, b) => {
    const ma = minOverallByEntry.get(Number(a.entryId))
    const mb = minOverallByEntry.get(Number(b.entryId))
    if (ma != null && mb != null && ma !== mb) return ma - mb
    if (ma != null && mb == null) return -1
    if (ma == null && mb != null) return 1
    return String(a.teamName ?? '').localeCompare(String(b.teamName ?? ''), undefined, {
      sensitivity: 'base',
    })
  })
  for (let i = 0; i < rows.length; i++) {
    rows[i].draftSlot = i + 1
  }
  return rows
}

export function DraftQuality({
  picks,
  loading,
  error,
  pointsForByFplEntryId = EMPTY_POINTS_FOR_BY_FPL,
  teamLogoMap = {},
  kitIndexByEntry = {},
}) {
  const [openIds, setOpenIds] = useState(() => new Set())

  const teamRows = useMemo(() => buildTeamRows(picks), [picks])

  const toggle = useCallback((entryId) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(entryId)) next.delete(entryId)
      else next.add(entryId)
      return next
    })
  }, [])

  return (
    <section className="tile tile--compact tile--draft-quality" aria-labelledby="draft-quality-heading">
      <div className="tile-head-row tile-head-row--tight">
        <h2 id="draft-quality-heading" className="tile-title tile-title--sm">
          Draft Quality
        </h2>
      </div>
      <p className="draft-quality-hint">
        Total fantasy points if drafted team kept.
      </p>

      {error ? (
        <p className="muted draft-quality-loading">Draft data unavailable.</p>
      ) : loading ? (
        <p className="muted draft-quality-loading">Loading…</p>
      ) : !picks.length ? (
        <p className="muted draft-quality-loading">No draft data.</p>
      ) : (
        <div className="draft-quality-table-wrap">
          <table className="draft-quality-table">
            <colgroup>
              <col className="draft-quality-col draft-quality-col--rank" />
              <col className="draft-quality-col draft-quality-col--team" />
              <col className="draft-quality-col draft-quality-col--pts" />
              <col className="draft-quality-col draft-quality-col--delta" />
              <col className="draft-quality-col draft-quality-col--og" />
            </colgroup>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="draft-quality-th draft-quality-th--rank"
                  title="Draft order: 1 = first pick in round 1"
                >
                  Draft
                </th>
                <th scope="col" className="draft-quality-th draft-quality-th--team">
                  Team
                </th>
                <th scope="col" className="draft-quality-th draft-quality-th--pts">
                  Points
                </th>
                <th
                  scope="col"
                  className="draft-quality-th draft-quality-th--delta"
                  title="Season points For minus drafted squad total (Points)"
                >
                  +/-
                </th>
                <th
                  scope="col"
                  className="draft-quality-th draft-quality-th--og"
                  title="Originally drafted players still on the current squad"
                >
                  OG players
                </th>
              </tr>
            </thead>
            <tbody>
              {teamRows.map((team) => {
                const open = openIds.has(team.entryId)
                const displayFull = (p) => p.playerFullName ?? p.playerName
                const forPts = pointsForByFplEntryId.get(Number(team.entryId))
                const { text: deltaText, tone: deltaTone } = deltaVersusDrafted(
                  forPts,
                  team.totalPoints,
                )
                const deltaClass =
                  deltaTone === 'pos'
                    ? 'draft-quality-td--delta-pos'
                    : deltaTone === 'neg'
                      ? 'draft-quality-td--delta-neg'
                      : deltaTone === 'zero'
                        ? 'draft-quality-td--delta-zero'
                        : ''
                return (
                  <Fragment key={team.entryId}>
                    <tr className="draft-quality-row draft-quality-row--team">
                      <td className="draft-quality-td draft-quality-td--rank tabular">
                        {team.draftSlot}
                      </td>
                      <td className="draft-quality-td draft-quality-td--team">
                        <button
                          type="button"
                          className="draft-quality-team-toggle"
                          onClick={() => toggle(team.entryId)}
                          aria-expanded={open}
                          aria-controls={`draft-quality-picks-${team.entryId}`}
                          id={`draft-quality-team-${team.entryId}`}
                        >
                          <span
                            className={
                              open
                                ? 'draft-quality-chevron draft-quality-chevron--open'
                                : 'draft-quality-chevron'
                            }
                            aria-hidden
                          >
                            ▶
                          </span>
                          <TeamAvatar
                            entryId={team.leagueEntryId ?? team.entryId}
                            name={team.teamName}
                            size="sm"
                            logoMap={teamLogoMap}
                            kitIndexByEntry={kitIndexByEntry}
                          />
                          <span className="draft-quality-team-name">{team.teamName}</span>
                        </button>
                      </td>
                      <td className="draft-quality-td draft-quality-td--pts tabular">
                        {team.totalPoints != null ? team.totalPoints : '—'}
                      </td>
                      <td
                        className={['draft-quality-td', 'draft-quality-td--delta', 'tabular', deltaClass]
                          .filter(Boolean)
                          .join(' ')}
                        title={
                          forPts != null && team.totalPoints != null
                            ? `For ${forPts} − drafted ${team.totalPoints}`
                            : undefined
                        }
                      >
                        {deltaText}
                      </td>
                      <td
                        className="draft-quality-td draft-quality-td--og tabular"
                        title={
                          team.draftedPlayersRemaining != null
                            ? `${team.draftedPlayersRemaining} of ${team.draftedPickCount} drafted players still on squad`
                            : undefined
                        }
                      >
                        {team.draftedPlayersRemaining != null ? team.draftedPlayersRemaining : '—'}
                      </td>
                    </tr>
                    {open ? (
                      <tr className="draft-quality-row draft-quality-row--detail">
                        <td className="draft-quality-td draft-quality-td--detail" colSpan={5}>
                          <div
                            className="draft-quality-pick-panel"
                            id={`draft-quality-picks-${team.entryId}`}
                            role="region"
                            aria-labelledby={`draft-quality-team-${team.entryId}`}
                          >
                            <ul className="draft-quality-pick-list">
                              {team.picks.map((p) => (
                                <li key={`${team.entryId}-${p.overallPick}`} className="draft-quality-pick-item">
                                  <span className="draft-quality-pick-round draft-round-display">
                                    <span className="draft-round-display__long">
                                      Round {p.round} Pick {p.pickInRound}
                                    </span>
                                    <span className="draft-round-display__short tabular" aria-hidden="true">
                                      {p.round}.{p.pickInRound}
                                    </span>
                                  </span>
                                  <span className="draft-quality-pick-player">
                                    <ClubBadge src={p.badgeUrl} />
                                    <span className="draft-quality-pick-name">
                                      <ClickablePlayerName
                                        element={p.element}
                                        displayName={displayFull(p)}
                                        web_name={p.playerName}
                                        teamShort={p.teamShort}
                                      >
                                        <span className="draft-quality-pick-name__full">
                                          {displayFull(p)}
                                        </span>
                                        <span className="draft-quality-pick-name__short">
                                          {p.playerName}
                                        </span>
                                      </ClickablePlayerName>
                                    </span>
                                  </span>
                                  <span className="draft-quality-pick-status">
                                    <DraftPickStatus pick={p} />
                                  </span>
                                  <span className="draft-quality-pick-pts tabular">
                                    {p.totalPoints != null ? p.totalPoints : '—'}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

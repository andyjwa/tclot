import { useMemo } from 'react'
import { TeamAvatar } from './TeamAvatar'
import {
  buildTeamScheduleRows,
  groupScheduleByGw,
  summarizeTeamSchedule,
} from './standingsScheduleDerivations'
import { CompactSelectPill } from './CompactSelectPill.jsx'

function pad2(n) {
  const num = Number(n)
  if (!Number.isFinite(num)) return '?'
  return num < 10 ? `0${num}` : String(num)
}

function firstWord(name) {
  if (typeof name !== 'string') return ''
  const t = name.trim()
  if (!t) return ''
  return t.split(/\s+/)[0]
}

/**
 * Schedule sub-tab — all-teams chronological list (latest GW first) plus a team-filtered
 * compact mode with W-L-T / Streak / Avg pts header card. See StandingsSubnav for
 * filter state ownership; this component receives state as props.
 *
 * @param {object} props
 * @param {object[]} props.matches Raw schedule matches (`details.matches`).
 * @param {{ id: number, teamName: string, manager?: string | null }[]} props.teamsForFormSelect
 * @param {{ league_entry?: number, teamName?: string, rank?: number }[]} props.tableRows
 * @param {object[]} props.leagueEntries
 * @param {Record<string, string>} props.teamLogoMap
 * @param {Record<number, number>} props.kitIndexByEntry
 * @param {'all' | number} props.teamFilter `'all'` or a `league_entry` id.
 * @param {(v: 'all' | number) => void} props.onTeamFilterChange
 * @param {'all' | 'results' | 'fixtures'} props.resultsFilter
 * @param {(v: 'all' | 'results' | 'fixtures') => void} props.onResultsFilterChange
 */
export function StandingsScheduleSubview({
  matches = [],
  teamsForFormSelect = [],
  tableRows = [],
  leagueEntries = [],
  teamLogoMap = {},
  kitIndexByEntry = {},
  teamFilter = 'all',
  onTeamFilterChange,
  resultsFilter = 'all',
  onResultsFilterChange,
}) {
  const idToName = useMemo(() => {
    const m = Object.create(null)
    for (const t of teamsForFormSelect || []) {
      const id = Number(t?.id)
      if (!Number.isFinite(id)) continue
      const name = t.teamName?.trim()
      m[id] = name || `Team ${id}`
    }
    for (const r of tableRows || []) {
      const id = Number(r?.league_entry)
      if (!Number.isFinite(id)) continue
      const name = r.teamName?.trim()
      if (!m[id]) m[id] = name || `Team ${id}`
    }
    for (const e of leagueEntries || []) {
      if (e?.id == null) continue
      const id = Number(e.id)
      if (!Number.isFinite(id)) continue
      const name = e.entry_name?.trim()
      if (!m[id]) m[id] = name || `Team ${id}`
      else if (name) m[id] = name
    }
    return m
  }, [teamsForFormSelect, tableRows, leagueEntries])

  const rankByEntryId = useMemo(() => {
    const m = new Map()
    for (const r of tableRows || []) {
      if (r?.league_entry != null && r.rank != null) m.set(r.league_entry, r.rank)
    }
    return m
  }, [tableRows])

  const allGwGroups = useMemo(
    () => groupScheduleByGw(matches, idToName),
    [matches, idToName],
  )

  const teamRows = useMemo(() => {
    if (teamFilter === 'all') return []
    return buildTeamScheduleRows(Number(teamFilter), matches, idToName)
  }, [matches, idToName, teamFilter])

  const teamSummary = useMemo(
    () => (teamFilter === 'all' ? null : summarizeTeamSchedule(teamRows)),
    [teamRows, teamFilter],
  )

  const filteredAllGroups = useMemo(() => {
    if (resultsFilter === 'all') return allGwGroups
    return allGwGroups.filter((g) =>
      resultsFilter === 'results' ? g.finished : !g.finished,
    )
  }, [allGwGroups, resultsFilter])

  const filteredTeamRows = useMemo(() => {
    if (resultsFilter === 'all') return teamRows
    return teamRows.filter((r) =>
      resultsFilter === 'results' ? r.finished : !r.finished,
    )
  }, [teamRows, resultsFilter])

  const filteredTeam = teamsForFormSelect.find(
    (t) => Number(t?.id) === Number(teamFilter),
  )

  return (
    <section className="standings-schedule" aria-labelledby="standings-schedule-heading">
      <h2 id="standings-schedule-heading" className="visually-hidden">
        Schedule
      </h2>

      <div
        className="standings-schedule__toolbar"
        role="group"
        aria-label="Schedule filters"
      >
        <div className="standings-schedule__picker">
          <CompactSelectPill
            label="Team"
            ariaLabel="Filter schedule by team"
            value={teamFilter === 'all' ? 'all' : String(teamFilter)}
            onChange={(next) =>
              onTeamFilterChange(next === 'all' ? 'all' : Number(next))
            }
            isActive={teamFilter !== 'all'}
            options={[
              { value: 'all', label: 'All teams' },
              ...teamsForFormSelect.map((t) => ({
                value: String(t.id),
                label: t.teamName,
              })),
            ]}
          />
        </div>

        <div
          className="standings-schedule__seg"
          role="tablist"
          aria-label="Filter results, fixtures, or both"
        >
          {[
            { v: 'all', label: 'All' },
            { v: 'results', label: 'Results' },
            { v: 'fixtures', label: 'Fixtures' },
          ].map((opt) => {
            const active = resultsFilter === opt.v
            return (
              <button
                key={opt.v}
                type="button"
                role="tab"
                aria-selected={active}
                className={
                  'standings-schedule__seg-btn' +
                  (active ? ' standings-schedule__seg-btn--active' : '')
                }
                onClick={() => onResultsFilterChange(opt.v)}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {teamFilter === 'all' ? (
        <AllTeamsScheduleList
          groups={filteredAllGroups}
          rankByEntryId={rankByEntryId}
          teamLogoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
        />
      ) : (
        <TeamScheduleCompact
          rows={filteredTeamRows}
          summary={teamSummary}
          activeTeamName={filteredTeam?.teamName ?? ''}
          teamLogoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
        />
      )}
    </section>
  )
}

function AllTeamsScheduleList({
  groups = [],
  rankByEntryId,
  teamLogoMap,
  kitIndexByEntry,
}) {
  if (!groups.length) {
    return (
      <p className="muted muted--tight standings-schedule__empty">
        No matches in the current filter.
      </p>
    )
  }
  return (
    <ol className="standings-schedule__gw-groups">
      {groups.map((g) => (
        <li key={g.event} className="standings-schedule__gw-group">
          <div className="standings-schedule__gw-band">
            <span className="standings-schedule__gw-num">GW {g.event}</span>
            <span
              className={
                'standings-schedule__gw-status' +
                (g.finished
                  ? ' standings-schedule__gw-status--complete'
                  : ' standings-schedule__gw-status--upcoming')
              }
            >
              {g.finished ? 'Complete' : 'Upcoming'}
            </span>
          </div>
          <ul className="standings-schedule__fixtures">
            {g.fixtures.map((fx, i) => {
              const homeRank = rankByEntryId.get(fx.homeId)
              const awayRank = rankByEntryId.get(fx.awayId)
              const homeWin =
                fx.finished && fx.homePts != null && fx.awayPts != null && fx.homePts > fx.awayPts
              const awayWin =
                fx.finished && fx.homePts != null && fx.awayPts != null && fx.awayPts > fx.homePts
              return (
                <li
                  key={`${fx.event}-${fx.homeId}-${fx.awayId}-${i}`}
                  className="standings-schedule__fixture"
                >
                  <span className="standings-schedule__fixture-side standings-schedule__fixture-side--home">
                    <TeamAvatar
                      entryId={fx.homeId}
                      name={fx.homeName}
                      size="sm"
                      logoMap={teamLogoMap}
                      kitIndexByEntry={kitIndexByEntry}
                    />
                    <span
                      className={
                        'standings-schedule__fixture-name' +
                        (homeWin ? ' standings-schedule__fixture-name--winner' : '') +
                        (awayWin ? ' standings-schedule__fixture-name--loser' : '')
                      }
                      title={fx.homeName}
                    >
                      <span className="standings-schedule__fixture-name-full">
                        {fx.homeName}
                      </span>
                      <span className="standings-schedule__fixture-name-short">
                        {firstWord(fx.homeName)}
                      </span>
                    </span>
                    {homeRank != null ? (
                      <span className="standings-schedule__fixture-rank muted">({homeRank})</span>
                    ) : null}
                  </span>
                  {fx.finished && fx.homePts != null && fx.awayPts != null ? (
                    <span className="standings-schedule__fixture-mid tabular">
                      <span
                        className={
                          'standings-schedule__fixture-score' +
                          (homeWin ? ' standings-schedule__fixture-score--winner' : '') +
                          (awayWin ? ' standings-schedule__fixture-score--loser' : '')
                        }
                      >
                        {fx.homePts}
                      </span>
                      <span className="standings-schedule__fixture-dash">–</span>
                      <span
                        className={
                          'standings-schedule__fixture-score' +
                          (awayWin ? ' standings-schedule__fixture-score--winner' : '') +
                          (homeWin ? ' standings-schedule__fixture-score--loser' : '')
                        }
                      >
                        {fx.awayPts}
                      </span>
                    </span>
                  ) : (
                    <span className="standings-schedule__fixture-mid standings-schedule__fixture-vs">
                      vs
                    </span>
                  )}
                  <span className="standings-schedule__fixture-side standings-schedule__fixture-side--away">
                    {awayRank != null ? (
                      <span className="standings-schedule__fixture-rank muted">({awayRank})</span>
                    ) : null}
                    <span
                      className={
                        'standings-schedule__fixture-name' +
                        (awayWin ? ' standings-schedule__fixture-name--winner' : '') +
                        (homeWin ? ' standings-schedule__fixture-name--loser' : '')
                      }
                      title={fx.awayName}
                    >
                      <span className="standings-schedule__fixture-name-full">
                        {fx.awayName}
                      </span>
                      <span className="standings-schedule__fixture-name-short">
                        {firstWord(fx.awayName)}
                      </span>
                    </span>
                    <TeamAvatar
                      entryId={fx.awayId}
                      name={fx.awayName}
                      size="sm"
                      logoMap={teamLogoMap}
                      kitIndexByEntry={kitIndexByEntry}
                    />
                  </span>
                </li>
              )
            })}
          </ul>
        </li>
      ))}
    </ol>
  )
}

function TeamScheduleCompact({
  rows = [],
  summary,
  activeTeamName,
  teamLogoMap,
  kitIndexByEntry,
}) {
  return (
    <>
      {summary ? (
        <div
          className="standings-schedule-summary"
          aria-label={`${activeTeamName} season summary`}
        >
          <div className="standings-schedule-summary__cell">
            <div className="standings-schedule-summary__num tabular">
              {`${summary.wins}-${summary.losses}-${summary.draws}`}
            </div>
            <div className="standings-schedule-summary__lbl">W-L-T</div>
          </div>
          <div className="standings-schedule-summary__divider" aria-hidden="true" />
          <div className="standings-schedule-summary__cell">
            <div
              className={
                'standings-schedule-summary__num tabular' +
                (summary.streakLetter === 'W'
                  ? ' standings-schedule-summary__num--win'
                  : summary.streakLetter === 'L'
                    ? ' standings-schedule-summary__num--loss'
                    : '')
              }
            >
              {summary.streakLabel ?? '—'}
            </div>
            <div className="standings-schedule-summary__lbl">Streak</div>
          </div>
          <div className="standings-schedule-summary__divider" aria-hidden="true" />
          <div className="standings-schedule-summary__cell">
            <div className="standings-schedule-summary__num tabular">
              {summary.avgPoints != null ? summary.avgPoints.toFixed(1) : '—'}
            </div>
            <div className="standings-schedule-summary__lbl">Avg pts</div>
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="muted muted--tight standings-schedule__empty">
          No matches in the current filter.
        </p>
      ) : (
        <ul className="standings-schedule-team">
          {rows.map((r) => {
            const showScore = r.finished && r.myPoints != null && r.oppPoints != null
            const tone =
              r.result === 'W'
                ? 'win'
                : r.result === 'L'
                  ? 'loss'
                  : r.result === 'D'
                    ? 'draw'
                    : null
            return (
              <li
                key={`${r.event}-${r.opponentId}`}
                className="standings-schedule-team__row"
              >
                <span className="standings-schedule-team__gw tabular">
                  GW{pad2(r.event)}
                </span>
                <span
                  className={
                    'standings-schedule-team__loc' +
                    (r.location === 'H'
                      ? ' standings-schedule-team__loc--home'
                      : ' standings-schedule-team__loc--away')
                  }
                  aria-label={r.location === 'H' ? 'Home' : 'Away'}
                >
                  {r.location}
                </span>
                <span
                  className="standings-schedule-team__opp"
                  title={r.opponentName}
                >
                  <TeamAvatar
                    entryId={r.opponentId}
                    name={r.opponentName}
                    size="sm"
                    logoMap={teamLogoMap}
                    kitIndexByEntry={kitIndexByEntry}
                  />
                  <span
                    className="standings-schedule-team__opp-name"
                    title={r.opponentName}
                  >
                    <span className="standings-schedule-team__opp-name-full">
                      {r.opponentName}
                    </span>
                    <span className="standings-schedule-team__opp-name-short">
                      {firstWord(r.opponentName)}
                    </span>
                  </span>
                </span>
                <span className="standings-schedule-team__score tabular">
                  {showScore ? (
                    <>
                      <span
                        className={
                          'standings-schedule-team__num' +
                          (r.result === 'W'
                            ? ' standings-schedule-team__num--winner'
                            : r.result === 'L'
                              ? ' standings-schedule-team__num--loser'
                              : '')
                        }
                      >
                        {r.myPoints}
                      </span>
                      <span className="standings-schedule-team__num-sep">·</span>
                      <span
                        className={
                          'standings-schedule-team__num' +
                          (r.result === 'L'
                            ? ' standings-schedule-team__num--winner'
                            : r.result === 'W'
                              ? ' standings-schedule-team__num--loser'
                              : '')
                        }
                      >
                        {r.oppPoints}
                      </span>
                    </>
                  ) : (
                    <span className="standings-schedule-team__vs muted">vs</span>
                  )}
                </span>
                <span className="standings-schedule-team__result">
                  {tone ? (
                    <span
                      className={`standings-schedule-team__chip standings-schedule-team__chip--${tone}`}
                      aria-label={
                        r.result === 'W' ? 'Win' : r.result === 'L' ? 'Loss' : 'Draw'
                      }
                    >
                      {r.result}
                    </span>
                  ) : (
                    <span className="standings-schedule-team__chip standings-schedule-team__chip--upcoming muted">
                      —
                    </span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

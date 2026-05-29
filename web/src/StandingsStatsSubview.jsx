import { useMemo } from 'react'
import { TeamAvatar } from './TeamAvatar'
import { FixtureScheduleMatrix } from './FixtureScheduleMatrix.jsx'
import { TeamH2HRivals } from './TeamH2HRivals.jsx'
import { WIN_MARGIN_BUCKET_KEYS } from './useLeagueData'
import { useMobileNarrowViewport } from './usePortraitMobile'

function firstWord(name) {
  if (typeof name !== 'string') return ''
  const t = name.trim()
  if (!t) return ''
  return t.split(/\s+/)[0]
}

/** Map bucket key → human-readable description for header/cell tooltips. */
function bucketTitle(key, kind) {
  const verb = kind === 'losses' ? 'Lost' : 'Won'
  if (key === '1') return `${verb} by exactly 1 point`
  if (key === '2') return `${verb} by exactly 2 points`
  if (key === '3-5') return `${verb} by 3–5 points`
  if (key === '5-10') return `${verb} by 6–10 points`
  if (key === '10+') return `${verb} by more than 10 points`
  return `${verb} by ${key}`
}

/**
 * Stats sub-tab — Phase 2 redesign.
 *
 * Sections (matches the 5.56 PM screenshot):
 *  1. Wins by margin — toggle Wins / Losses (new buckets: 1 / 2 / 3-5 / 5-10 / 10+).
 *  2. Game weeks in 1st place — toggle 1st / Last + horizontal bars.
 *  3. Schedule luck matrix — embedded (delta cells).
 *  4. Head-to-Head rivals — team picker + per-opponent P/W/D/L/PF/PA.
 *
 * @param {object} props
 * @param {{ league_entry: number, teamName: string, buckets: Record<string, number>, totalWins: number }[]} props.winMarginBucketRows
 * @param {{ league_entry: number, teamName: string, buckets: Record<string, number>, totalLosses: number }[]} props.lossMarginBucketRows
 * @param {{ league_entry: number, teamName: string, count: number, weeksLabel?: string }[]} props.gwWeeksAtFirst
 * @param {{ league_entry: number, teamName: string, count: number, weeksLabel?: string }[]} props.gwWeeksAtLast
 * @param {{ maxGw: number, teamCount: number }} props.gwRankExtremesMeta
 * @param {object[]} props.matches
 * @param {object[]} props.leagueEntries
 * @param {object[]} props.tableRows
 * @param {{ id: number, teamName: string }[]} props.teamsForFormSelect
 * @param {Record<string, string>} props.teamLogoMap
 * @param {Record<number, number>} props.kitIndexByEntry
 * @param {'wins' | 'losses'} props.marginMode
 * @param {(v: 'wins' | 'losses') => void} props.onMarginModeChange
 * @param {'first' | 'last'} props.weeksMode
 * @param {(v: 'first' | 'last') => void} props.onWeeksModeChange
 * @param {number | null} props.h2hTeamId
 * @param {(id: number | null) => void} props.onH2hTeamChange
 */
export function StandingsStatsSubview({
  winMarginBucketRows = [],
  lossMarginBucketRows = [],
  gwWeeksAtFirst = [],
  gwWeeksAtLast = [],
  gwRankExtremesMeta = { maxGw: 0, teamCount: 0 },
  matches = [],
  leagueEntries = [],
  tableRows = [],
  teamsForFormSelect = [],
  teamLogoMap = {},
  kitIndexByEntry = {},
  marginMode = 'wins',
  onMarginModeChange,
  weeksMode = 'first',
  onWeeksModeChange,
  h2hTeamId = null,
  onH2hTeamChange,
}) {
  const isMobileNarrow = useMobileNarrowViewport()
  const marginRows = marginMode === 'losses' ? lossMarginBucketRows : winMarginBucketRows
  const totalKey = marginMode === 'losses' ? 'totalLosses' : 'totalWins'
  const marginRowsSorted = useMemo(() => {
    const out = [...(marginRows || [])]
    out.sort((a, b) => {
      const cmp = (b[totalKey] ?? 0) - (a[totalKey] ?? 0)
      if (cmp !== 0) return cmp
      return (a.teamName || '').localeCompare(b.teamName || '')
    })
    return out
  }, [marginRows, totalKey])

  const weeksRows = weeksMode === 'last' ? gwWeeksAtLast : gwWeeksAtFirst
  const weeksMax = useMemo(() => {
    let max = 0
    for (const r of weeksRows || []) {
      const n = Number(r?.count) || 0
      if (n > max) max = n
    }
    return max
  }, [weeksRows])
  const weeksDenom = gwRankExtremesMeta?.maxGw || 0

  const hasMargins = marginRowsSorted.some((r) => (r[totalKey] ?? 0) > 0)

  return (
    <div className="standings-stats">
      <section
        className="standings-stats__section standings-stats__section--margins"
        aria-labelledby="standings-stats-margins-heading"
      >
        <h3 id="standings-stats-margins-heading" className="standings-stats-eyebrow">
          {marginMode === 'losses' ? 'Losses by margin' : 'Wins by margin'}
        </h3>
        <div
          className="standings-stats-toggle"
          role="tablist"
          aria-label="Margin direction"
        >
          {[
            { v: 'wins', label: 'Wins' },
            { v: 'losses', label: 'Losses' },
          ].map((opt) => {
            const active = marginMode === opt.v
            return (
              <button
                key={opt.v}
                type="button"
                role="tab"
                aria-selected={active}
                className={
                  'standings-stats-toggle__btn' +
                  (active ? ' standings-stats-toggle__btn--active' : '')
                }
                onClick={() => onMarginModeChange(opt.v)}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        {hasMargins ? (
          <div className="table-scroll table-scroll--win-margin">
            <table className="win-margin-table standings-stats-margin-table">
              <thead>
                <tr>
                  <th scope="col" className="win-margin-table__team">
                    Team
                  </th>
                  {WIN_MARGIN_BUCKET_KEYS.map((k) => (
                    <th
                      key={k}
                      scope="col"
                      className="win-margin-table__n tabular"
                      title={bucketTitle(k, marginMode)}
                    >
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {marginRowsSorted.map((row) => (
                  <tr key={row.league_entry}>
                    <th scope="row" className="win-margin-table__team">
                      <span className="win-margin-table__team-inner">
                        <TeamAvatar
                          entryId={row.league_entry}
                          name={row.teamName}
                          size="sm"
                          logoMap={teamLogoMap}
                          kitIndexByEntry={kitIndexByEntry}
                        />
                        <span
                          className="win-margin-table__name"
                          title={row.teamName}
                        >
                          {isMobileNarrow ? firstWord(row.teamName) : row.teamName}
                        </span>
                      </span>
                    </th>
                    {WIN_MARGIN_BUCKET_KEYS.map((k) => {
                      const v = row.buckets?.[k] ?? 0
                      return (
                        <td
                          key={k}
                          className={
                            'tabular win-margin-table__n' +
                            (v === 0 ? ' standings-stats-margin-table__zero' : '')
                          }
                        >
                          {v}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted muted--tight">
            {marginMode === 'losses'
              ? 'No losses in finished matches yet.'
              : 'No wins in finished matches yet.'}
          </p>
        )}
      </section>

      <section
        className="standings-stats__section standings-stats__section--weeks"
        aria-labelledby="standings-stats-weeks-heading"
      >
        <h3 id="standings-stats-weeks-heading" className="standings-stats-eyebrow">
          Game weeks in {weeksMode === 'last' ? 'last place' : '1st place'}
        </h3>
        <div
          className="standings-stats-toggle"
          role="tablist"
          aria-label="Weeks at top or bottom"
        >
          <button
            type="button"
            role="tab"
            aria-selected={weeksMode === 'first'}
            className={
              'standings-stats-toggle__btn' +
              (weeksMode === 'first' ? ' standings-stats-toggle__btn--active' : '')
            }
            onClick={() => onWeeksModeChange('first')}
          >
            1st
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={weeksMode === 'last'}
            className={
              'standings-stats-toggle__btn' +
              (weeksMode === 'last' ? ' standings-stats-toggle__btn--active' : '')
            }
            onClick={() => onWeeksModeChange('last')}
          >
            <span aria-hidden="true">Last </span>
            <span role="img" aria-label="Last">
              🧩
            </span>
          </button>
        </div>

        {weeksRows && weeksRows.length > 0 ? (
          <div className="table-scroll table-scroll--win-margin">
            <table className="win-margin-table standings-stats-weeks-table">
              <thead>
                <tr>
                  <th scope="col" className="win-margin-table__team">
                    Team
                  </th>
                  <th
                    scope="col"
                    className="win-margin-table__n tabular"
                    title={`Game weeks at ${weeksMode === 'last' ? 'last' : '1st'}`}
                  >
                    Weeks
                  </th>
                  <th
                    scope="col"
                    className="win-margin-table__n tabular"
                    title="Share of finished GWs"
                  >
                    %
                  </th>
                  <th
                    scope="col"
                    className="standings-stats-weeks-table__bar-head"
                    aria-label="Bar"
                  />
                </tr>
              </thead>
              <tbody>
                {weeksRows.map((r) => {
                  const count = Number(r.count) || 0
                  const pct =
                    weeksDenom > 0 ? Math.round((count / weeksDenom) * 100) : null
                  const fillPct =
                    weeksMax > 0 ? Math.round((count / weeksMax) * 100) : 0
                  return (
                    <tr key={r.league_entry}>
                      <th scope="row" className="win-margin-table__team">
                        <span className="win-margin-table__team-inner">
                          <TeamAvatar
                            entryId={r.league_entry}
                            name={r.teamName}
                            size="sm"
                            logoMap={teamLogoMap}
                            kitIndexByEntry={kitIndexByEntry}
                          />
                          <span
                            className="win-margin-table__name"
                            title={r.teamName}
                          >
                            {isMobileNarrow ? firstWord(r.teamName) : r.teamName}
                          </span>
                        </span>
                      </th>
                      <td className="tabular win-margin-table__n">
                        <strong>{count}</strong>
                      </td>
                      <td className="tabular win-margin-table__n muted">
                        {pct == null ? '—' : `${pct}%`}
                      </td>
                      <td className="standings-stats-weeks-table__bar-cell">
                        <span
                          className="standings-stats-weeks-table__bar"
                          aria-hidden="true"
                        >
                          <span
                            className="standings-stats-weeks-table__bar-fill"
                            style={{ width: `${fillPct}%` }}
                          />
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted muted--tight">
            {gwRankExtremesMeta?.maxGw > 0
              ? `No team data for weeks at ${weeksMode === 'last' ? 'last' : '1st'}.`
              : 'No finished gameweeks in the schedule yet.'}
          </p>
        )}
      </section>

      <section
        className="standings-stats__section standings-stats__section--luck"
        aria-label="Schedule luck matrix"
      >
        <FixtureScheduleMatrix
          matches={matches}
          leagueEntries={leagueEntries}
          tableRows={tableRows}
          teamLogoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
          embedded
        />
      </section>

      <section
        className="standings-stats__section standings-stats__section--rivals"
        aria-label="Head-to-Head Rivals"
      >
        <TeamH2HRivals
          matches={matches}
          teamsForFormSelect={teamsForFormSelect}
          tableRows={tableRows}
          leagueEntries={leagueEntries}
          teamLogoMap={teamLogoMap}
          kitIndexByEntry={kitIndexByEntry}
          activeTeamId={h2hTeamId}
          onTeamChange={onH2hTeamChange}
        />
      </section>
    </div>
  )
}

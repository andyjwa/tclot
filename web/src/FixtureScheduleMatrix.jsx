import { useMemo } from 'react'
import { TeamAvatar } from './TeamAvatar'
import { buildFixtureScheduleMatrix } from './fixtureScheduleMatrix'

/** Short label for column headers (last word, trimmed). */
function matrixColAbbrev(name) {
  if (typeof name !== 'string' || !name.trim()) return '—'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const token = parts.length ? parts[parts.length - 1] : ''
  if (token.length <= 14) return token
  return `${token.slice(0, 12)}…`
}

/**
 * @param {object} props
 * @param {object[]} props.matches
 * @param {object[]} props.leagueEntries
 * @param {{ league_entry?: number, rank?: number }[]} props.tableRows
 * @param {Record<string, string>} props.teamLogoMap
 * @param {Record<number, number>} props.kitIndexByEntry
 */
export function FixtureScheduleMatrix({
  matches = [],
  leagueEntries = [],
  tableRows = [],
  teamLogoMap = {},
  kitIndexByEntry = {},
}) {
  const model = useMemo(
    () => buildFixtureScheduleMatrix(matches, leagueEntries, tableRows),
    [matches, leagueEntries, tableRows],
  )

  if (!model) return null

  const { orderedIds, idToName, matrix, rowAverages } = model

  return (
    <section
      className="tile tile--compact"
      aria-labelledby="fixture-schedule-matrix-heading"
    >
      <div className="tile-head-row tile-head-row--tight">
        <h2 id="fixture-schedule-matrix-heading" className="tile-title tile-title--sm">
          Schedule luck matrix
        </h2>
      </div>
      <p className="tile-hint muted tile-hint--tight">
        Total table points if you had every other team’s opponent fixture list (your weekly scores
        stay the same).{' '}
        <span className="fixture-schedule-matrix__legend fixture-schedule-matrix__legend--up">
          Green
        </span>{' '}
        = better than your real schedule (diagonal);{' '}
        <span className="fixture-schedule-matrix__legend fixture-schedule-matrix__legend--down">
          red
        </span>{' '}
        = worse. <strong>Avg</strong> is the mean across all schedule columns in that row.
      </p>
      <div className="table-scroll table-scroll--win-margin">
        <table className="fixture-schedule-matrix">
          <thead>
            <tr>
              <th
                scope="col"
                className="fixture-schedule-matrix__corner"
                title="Squad (row) vs whose fixture list (column)"
              >
                Squad / fixtures
              </th>
              {orderedIds.map((id) => (
                <th
                  key={id}
                  scope="col"
                  className="fixture-schedule-matrix__col-head tabular"
                  title={idToName[id]}
                >
                  {matrixColAbbrev(idToName[id] ?? String(id))}
                </th>
              ))}
              <th
                scope="col"
                className="fixture-schedule-matrix__avg-head tabular"
                title="Mean table points (3/1/0) across all columns in this row"
              >
                Avg
              </th>
            </tr>
          </thead>
          <tbody>
            {orderedIds.map((rowId, i) => {
              const own = matrix[i][i]
              const teamName = idToName[rowId] ?? `Team ${rowId}`
              return (
                <tr key={rowId}>
                  <th scope="row" className="fixture-schedule-matrix__team">
                    <span className="fixture-schedule-matrix__team-inner">
                      <TeamAvatar
                        entryId={rowId}
                        name={teamName}
                        size="sm"
                        logoMap={teamLogoMap}
                        kitIndexByEntry={kitIndexByEntry}
                      />
                      <span className="fixture-schedule-matrix__name" title={teamName}>
                        {teamName}
                      </span>
                    </span>
                  </th>
                  {orderedIds.map((colId, j) => {
                    const v = matrix[i][j]
                    let tone = 'fixture-schedule-matrix__cell--same'
                    if (i === j) {
                      tone = 'fixture-schedule-matrix__cell--actual'
                    } else if (v > own) {
                      tone = 'fixture-schedule-matrix__cell--better'
                    } else if (v < own) {
                      tone = 'fixture-schedule-matrix__cell--worse'
                    }
                    const colTitle = idToName[colId] ?? String(colId)
                    const cmp =
                      i === j
                        ? '(real schedule)'
                        : v > own
                          ? `vs own ${own}: better`
                          : v < own
                            ? `vs own ${own}: worse`
                            : `vs own ${own}: same`
                    return (
                      <td
                        key={`${rowId}-${colId}`}
                        className={`fixture-schedule-matrix__cell tabular ${tone}`}
                        title={`${teamName} with ${colTitle}’s opponents: ${v} table pts. ${cmp}`}
                      >
                        {v}
                      </td>
                    )
                  })}
                  <td
                    className="fixture-schedule-matrix__cell fixture-schedule-matrix__avg tabular"
                    title={`Mean table points across all ${orderedIds.length} schedule columns (includes diagonal)`}
                  >
                    {rowAverages[i].toFixed(1)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

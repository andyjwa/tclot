import { useMemo } from 'react'
import { TeamAvatar } from './TeamAvatar'
import { buildFixtureScheduleMatrix } from './fixtureScheduleMatrix'

/** Format the delta cell: blank for diagonal. League points, so integers. */
function deltaCellLabel(delta, blank) {
  if (blank || delta == null) return '—'
  if (delta > 0) return `+${delta}`
  return String(delta)
}

/** Map abs(delta) to a stepped tone. Unit is league points (3 for a win). */
function tonePlus(absDelta) {
  if (absDelta >= 7) return 'better-4'
  if (absDelta >= 5) return 'better-3'
  if (absDelta >= 3) return 'better-2'
  return 'better-1'
}
function toneMinus(absDelta) {
  if (absDelta >= 7) return 'worse-4'
  if (absDelta >= 5) return 'worse-3'
  if (absDelta >= 3) return 'worse-2'
  return 'worse-1'
}

/**
 * Schedule luck matrix — Standings tab → Stats sub-tab.
 *
 * Cell value = what this row got, minus league points those scores would have
 * got on that column's opponents. A win is 3. Greener = this draw has been kinder.
 *
 * @param {object} props
 * @param {object[]} props.matches
 * @param {object[]} props.leagueEntries
 * @param {{ league_entry?: number, rank?: number }[]} props.tableRows
 * @param {Record<string, string>} props.teamLogoMap
 * @param {Record<number, number>} props.kitIndexByEntry
 * @param {boolean} [props.embedded] When true, render without outer tile chrome — used inside
 *   the Stats sub-tab where the parent section already provides padding/eyebrow.
 */
export function FixtureScheduleMatrix({
  matches = [],
  leagueEntries = [],
  tableRows = [],
  teamLogoMap = {},
  kitIndexByEntry = {},
  embedded = false,
}) {
  const model = useMemo(
    () => buildFixtureScheduleMatrix(matches, leagueEntries, tableRows),
    [matches, leagueEntries, tableRows],
  )

  if (!model) return null

  const { orderedIds, idToName, matrix } = model

  const body = (
    <>
      <p
        className={
          embedded
            ? 'standings-stats-hint'
            : 'tile-hint muted tile-hint--tight'
        }
      >
        Your scores, their opponents. Green means this draw has been kinder. A win is 3. The luck number is the average of that row.
      </p>
      <div className="table-scroll table-scroll--win-margin">
        <table className="fixture-schedule-matrix fixture-schedule-matrix--delta">
          <thead>
            <tr>
              <th
                scope="col"
                className="fixture-schedule-matrix__corner"
                aria-label="Squad (rows) vs whose schedule (columns)"
              />
              {orderedIds.map((id) => {
                const name = idToName[id] ?? `Team ${id}`
                return (
                  <th
                    key={id}
                    scope="col"
                    className="fixture-schedule-matrix__col-head fixture-schedule-matrix__col-head--crest"
                    title={name}
                  >
                    <span className="fixture-schedule-matrix__crest">
                      <TeamAvatar
                        entryId={id}
                        name={name}
                        size="sm"
                        logoMap={teamLogoMap}
                        kitIndexByEntry={kitIndexByEntry}
                      />
                    </span>
                  </th>
                )
              })}
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
                      <span
                        className="fixture-schedule-matrix__name"
                        title={teamName}
                      >
                        {teamName}
                      </span>
                    </span>
                  </th>
                  {orderedIds.map((colId, j) => {
                    const diagonal = i === j
                    const colQ = matrix[i][j]
                    const missing = own == null || colQ == null
                    const delta = diagonal || missing ? null : own - colQ
                    const abs = delta == null ? 0 : Math.abs(delta)
                    let tone = 'fixture-schedule-matrix__cell--same'
                    if (diagonal) {
                      tone = 'fixture-schedule-matrix__cell--diagonal'
                    } else if (delta > 0) {
                      tone = `fixture-schedule-matrix__cell--${tonePlus(abs)}`
                    } else if (delta < 0) {
                      tone = `fixture-schedule-matrix__cell--${toneMinus(abs)}`
                    }
                    const colTitle = idToName[colId] ?? String(colId)
                    const cmp = diagonal
                      ? '(this draw)'
                      : missing
                        ? 'no result that week'
                        : delta > 0
                          ? `vs ${colTitle}'s fixtures: kinder by ${abs}`
                          : delta < 0
                            ? `vs ${colTitle}'s fixtures: unluckier by ${abs}`
                            : `vs ${colTitle}'s fixtures: same`
                    return (
                      <td
                        key={`${rowId}-${colId}`}
                        className={`fixture-schedule-matrix__cell tabular ${tone}`}
                        title={`${teamName} ${cmp}`}
                      >
                        {deltaCellLabel(delta, diagonal || missing)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )

  if (embedded) {
    return (
      <div className="standings-stats-luck">
        <h3 className="standings-stats-eyebrow">Schedule luck matrix</h3>
        {body}
      </div>
    )
  }

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
      {body}
    </section>
  )
}

import { useMemo } from 'react'
import { TeamAvatar } from './TeamAvatar'
import { buildH2hRivalsForTeam } from './h2hRivalsTable'

/**
 * @param {object} props
 * @param {object[]} props.formStripRows — rows for the score strip (same as Team form)
 * @param {{ id?: number, teamName?: string }[]} props.teamsForFormSelect
 * @param {number | null | undefined} props.activeFormEntry
 * @param {(id: number | null) => void} props.onFormTeamChange
 * @param {object[]} props.matches
 * @param {{ league_entry?: number, teamName?: string }[]} props.tableRows
 * @param {object[]} props.leagueEntries
 * @param {Record<string, string>} props.teamLogoMap
 * @param {Record<number, number>} props.kitIndexByEntry
 */
export function FormAndH2hSection({
  formStripRows = [],
  teamsForFormSelect = [],
  activeFormEntry = null,
  onFormTeamChange,
  matches = [],
  tableRows = [],
  leagueEntries = [],
  teamLogoMap = {},
  kitIndexByEntry = {},
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

  const leagueTeamCount = teamsForFormSelect?.length ?? Object.keys(idToName).length

  const rivalRows = useMemo(
    () =>
      activeFormEntry != null && Number.isFinite(Number(activeFormEntry))
        ? buildH2hRivalsForTeam(matches, idToName, activeFormEntry)
        : [],
    [matches, idToName, activeFormEntry],
  )

  const showH2hBlock = leagueTeamCount >= 2

  return (
    <section
      className="tile tile--compact tile--team-form"
      aria-labelledby="form-and-h2h-heading"
    >
      <div className="tile-head-row tile-head-row--tight">
        <h2 id="form-and-h2h-heading" className="tile-title tile-title--sm">
          Form and H2H
        </h2>
      </div>

      <div className="form-team-toolbar form-team-toolbar--full">
        <div className="form-team-picker form-team-picker--full">
          <span className="form-team-picker__glyph" aria-hidden>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </span>
          <select
            id="form-team-select"
            className="form-team-select"
            aria-label="Team for form strip and head-to-head table"
            value={activeFormEntry ?? ''}
            onChange={(e) => {
              const v = e.target.value
              onFormTeamChange(v === '' ? null : Number(v))
            }}
          >
            {teamsForFormSelect.map((t) => (
              <option key={t.id} value={t.id}>
                {t.teamName}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-strip form-strip--tight">
        {formStripRows.length ? (
          formStripRows.map((row, i) => (
            <div key={`${row.event}-${i}`} className="form-strip__item">
              <div
                className={`form-score form-score--${
                  row.result === 'W' ? 'win' : row.result === 'L' ? 'loss' : 'draw'
                }`}
              >
                {row.scoreStr}
              </div>
              <span className="form-strip__opp" title={row.opponentName}>
                <TeamAvatar
                  entryId={row.opponentEntryId}
                  name={row.opponentName}
                  size="sm"
                  logoMap={teamLogoMap}
                  kitIndexByEntry={kitIndexByEntry}
                />
              </span>
            </div>
          ))
        ) : (
          <p className="muted">No finished matches yet.</p>
        )}
      </div>

      {showH2hBlock ? (
        <div className="form-and-h2h__h2h">
          {activeFormEntry == null || !Number.isFinite(Number(activeFormEntry)) ? (
            <p className="muted muted--tight">Choose a team in the dropdown above.</p>
          ) : rivalRows.length === 0 ? (
            <p className="muted muted--tight">No league opponents in data.</p>
          ) : (
            <div className="table-scroll table-scroll--win-margin">
              <table className="win-margin-table h2h-rivals-table">
                <thead>
                  <tr>
                    <th scope="col" className="win-margin-table__team">
                      Opponent
                    </th>
                    <th
                      scope="col"
                      className="win-margin-table__n tabular"
                      title="Wins – draws – losses vs this opponent"
                    >
                      Record
                    </th>
                    <th scope="col" className="win-margin-table__n tabular" title="Your FPL points total">
                      For
                    </th>
                    <th scope="col" className="win-margin-table__n tabular" title="Their FPL points total">
                      Faced
                    </th>
                    <th
                      scope="col"
                      className="win-margin-table__n tabular h2h-rivals-table__col--last"
                      title="Most recent finished meeting (your score first)"
                    >
                      Last
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rivalRows.map((r) => (
                    <tr key={r.opponentId}>
                      <th scope="row" className="win-margin-table__team">
                        <span className="win-margin-table__team-inner">
                          <TeamAvatar
                            entryId={r.opponentId}
                            name={r.opponentName}
                            size="sm"
                            logoMap={teamLogoMap}
                            kitIndexByEntry={kitIndexByEntry}
                          />
                          <span className="win-margin-table__name">{r.opponentName}</span>
                        </span>
                      </th>
                      <td className="tabular win-margin-table__n">{r.record}</td>
                      <td className="tabular win-margin-table__n">{r.for}</td>
                      <td className="tabular win-margin-table__n">{r.against}</td>
                      <td className="tabular win-margin-table__n h2h-rivals-table__col--last h2h-rivals-table__last-cell">
                        {r.lastLabel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}
